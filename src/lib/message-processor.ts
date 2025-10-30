/**
 * ResQLink Message Processing Engine
 *
 * Handles complete message lifecycle including:
 * - Message encryption/decryption
 * - Routing and relay logic
 * - Delivery tracking and confirmations
 * - Rate limiting and flood protection
 * - Message validation and integrity checking
 */

import {
  MeshPacket,
  MsgType,
  MsgBody,
  Contact,
  KeyPair,
  PROTOCOL_VERSION,
  DEFAULT_TTL,
  generateMessageId,
  validateMeshPacket,
  Group
} from './schema';
import {
  encryptMessage,
  decryptMessage,
  signPacket,
  verifyPacketSignature,
  generateKeyPair
} from './crypto';
import type { MeshNetworkManager } from './mesh';
import { debounce } from './utils';

// Delivery status type from schema
type DeliveryStatus = 'queued' | 'sent' | 'relayed' | 'acked' | 'failed';

// Configuration interface for message processor
export interface MessageProcessorConfig {
  // Rate limiting settings
  maxMessagesPerMinute: number;
  burstWindowMs: number;
  sosIntervalMs: number;

  // Delivery tracking settings
  maxRetryAttempts: number;
  retryDelayMs: number;
  ackTimeoutMs: number;

  // Queue management
  maxQueueSize: number;
  queueProcessIntervalMs: number;

  // Cleanup intervals
  cleanupIntervalMs: number;
}

// Default configuration
const DEFAULT_CONFIG: MessageProcessorConfig = {
  maxMessagesPerMinute: 6,
  burstWindowMs: 60 * 1000,
  sosIntervalMs: 30 * 1000,
  maxRetryAttempts: 3,
  retryDelayMs: 5000,
  ackTimeoutMs: 30 * 1000,
  maxQueueSize: 100,
  queueProcessIntervalMs: 1000,
  cleanupIntervalMs: 60 * 1000
};

// Delivery tracking interface
interface DeliveryTracker {
  messageId: string;
  status: DeliveryStatus;
  attempts: number;
  sentAt: number;
  lastAttempt: number;
  nextAttempt: number;
  recipients: string[];
  acknowledgedBy: Set<string>;
  timeout: number;
}

// Message routing information
interface MessageRoute {
  packet: MeshPacket;
  priority: 'high' | 'normal';
  nextHop?: string;
  relayHistory: string[];
}

// Rate limiting entry
interface RateLimitEntry {
  count: number;
  windowStart: number;
  lastSosTime?: number;
}

/**
 * Core message processing engine for ResQLink
 */
export class MessageProcessor {
  private keyPair: KeyPair;
  private config: MessageProcessorConfig;
  private meshNetwork: MeshNetworkManager | null = null;

  // Message tracking and queues
  private messageQueue: MessageRoute[] = [];
  private deliveryTrackers = new Map<string, DeliveryTracker>();
  private processedMessages = new Set<string>();

  // Rate limiting
  private rateLimits = new Map<string, RateLimitEntry>();

  // Processing intervals
  private queueProcessor?: ReturnType<typeof setInterval>;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  // Statistics
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesRelayed: 0,
    messagesDropped: 0,
    encryptionErrors: 0,
    rateLimitRejects: 0
  };

  constructor(keyPair: KeyPair, config: Partial<MessageProcessorConfig> = {}) {
    this.keyPair = keyPair;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startProcessing();
  }

  /**
   * Set the mesh network manager for packet transmission
   */
  setMeshNetwork(meshNetwork: MeshNetworkManager): void {
    this.meshNetwork = meshNetwork;
  }

  /**
   * Send a message to specified recipients
   */
  async sendMessage(
    type: MsgType,
    body: MsgBody,
    recipients: Contact[] | Group,
    priority: 'high' | 'normal' = 'normal'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Generate packet ID
      const messageId = generateMessageId();
      const timestamp = Date.now();

      // Check rate limits for sender
      if (!this.checkRateLimit(this.keyPair.ed25519Pub, type)) {
        this.stats.rateLimitRejects++;
        return { success: false, error: 'Rate limit exceeded' };
      }

      // Build recipient list
      const recipientList = Array.isArray(recipients)
        ? recipients
        : []; // Group support would need member resolution

      if (recipientList.length === 0) {
        return { success: false, error: 'No recipients specified' };
      }

      // Extract recipient public keys
      const recipientPubKeys = recipientList.map(contact => contact.x25519Pub);

      // Encrypt message for all recipients
      const encrypted = await encryptMessage(body, recipientPubKeys, this.keyPair.x25519Sec);

      // Create mesh packet
      const packet: MeshPacket = {
        id: messageId,
        ver: PROTOCOL_VERSION,
        type,
        ts: timestamp,
        ttl: DEFAULT_TTL,
        senderPub: this.keyPair.ed25519Pub,
        keyEnvelopes: encrypted.keyEnvelopes,
        ciphertext: encrypted.ciphertext,
        sig: '' // Will be set by signPacket
      };

      // Sign the packet
      const signature = await signPacket(packet, this.keyPair.ed25519Sec);
      const signedPacket = { ...packet, sig: signature };

      // Create message route
      const route: MessageRoute = {
        packet: signedPacket,
        priority,
        relayHistory: [this.keyPair.ed25519Pub]
      };

      // Add to queue
      if (this.messageQueue.length >= this.config.maxQueueSize) {
        this.stats.messagesDropped++;
        return { success: false, error: 'Message queue full' };
      }

      this.messageQueue.push(route);

      // Create delivery tracker
      const tracker: DeliveryTracker = {
        messageId,
        status: 'queued',
        attempts: 0,
        sentAt: timestamp,
        lastAttempt: 0,
        nextAttempt: timestamp,
        recipients: recipientPubKeys,
        acknowledgedBy: new Set(),
        timeout: timestamp + this.config.ackTimeoutMs
      };

      this.deliveryTrackers.set(messageId, tracker);
      this.stats.messagesSent++;

      return { success: true, messageId };

    } catch (error) {
      this.stats.encryptionErrors++;
      return { success: false, error: `Encryption failed: ${error}` };
    }
  }

  /**
   * Process incoming message from mesh network
   */
  async receiveMessage(packet: MeshPacket): Promise<{
    success: boolean;
    shouldRelay: boolean;
    decrypted?: MsgBody;
    error?: string;
  }> {
    try {
      // Validate packet structure
      if (!validateMeshPacket(packet)) {
        return { success: false, shouldRelay: false, error: 'Invalid packet structure' };
      }

      // Check if we've seen this message before
      if (this.processedMessages.has(packet.id)) {
        return { success: false, shouldRelay: false, error: 'Duplicate message' };
      }

      // Verify signature
      const signatureValid = await verifyPacketSignature(packet);
      if (!signatureValid) {
        return { success: false, shouldRelay: false, error: 'Invalid signature' };
      }

      // Check rate limits for sender
      if (!this.checkRateLimit(packet.senderPub, packet.type)) {
        this.stats.rateLimitRejects++;
        return { success: false, shouldRelay: false, error: 'Sender rate limit exceeded' };
      }

      // Mark as processed
      this.processedMessages.add(packet.id);

      // Try to decrypt message
      let decryptedBody: MsgBody | undefined;
      try {
        const decrypted = await decryptMessage(packet.keyEnvelopes, packet.ciphertext, this.keyPair.x25519Pub, this.keyPair.x25519Sec);
        if (decrypted) {
          decryptedBody = decrypted;
        }
      } catch (decryptError) {
        // Decryption failed - message not for us, but we can still relay
        console.debug('Decryption failed:', decryptError);
      }

      // Check if message should be relayed
      const shouldRelay = packet.ttl > 1 && !this.isMessageFromUs(packet);

      // Update statistics
      this.stats.messagesReceived++;

      // Handle acknowledgments
      if (packet.type === 'ACK' && decryptedBody?.inReplyTo) {
        this.handleAcknowledgment(decryptedBody.inReplyTo, packet.senderPub);
      }

      return {
        success: true,
        shouldRelay,
        decrypted: decryptedBody
      };

    } catch (error) {
      return { success: false, shouldRelay: false, error: `Processing failed: ${error}` };
    }
  }

  /**
   * Relay a message through the mesh network
   */
  async relayMessage(packet: MeshPacket): Promise<{ success: boolean; error?: string }> {
    try {
      // Check TTL
      if (packet.ttl <= 1) {
        return { success: false, error: 'TTL expired' };
      }

      // Don't relay our own messages
      if (this.isMessageFromUs(packet)) {
        return { success: false, error: 'Cannot relay own message' };
      }

      // Create relay packet with decremented TTL
      const relayPacket: MeshPacket = {
        ...packet,
        ttl: packet.ttl - 1
      };

      // Add to relay queue
      const route: MessageRoute = {
        packet: relayPacket,
        priority: packet.type === 'SOS' ? 'high' : 'normal',
        relayHistory: [this.keyPair.ed25519Pub]
      };

      this.messageQueue.push(route);
      this.stats.messagesRelayed++;

      return { success: true };

    } catch (error) {
      return { success: false, error: `Relay failed: ${error}` };
    }
  }

  /**
   * Send acknowledgment for received message
   */
  async sendAcknowledgment(originalPacket: MeshPacket, contact: Contact): Promise<void> {
    const ackBody: MsgBody = {
      inReplyTo: originalPacket.id
    };

    await this.sendMessage('ACK', ackBody, [contact], 'normal');
  }

  /**
   * Get delivery status for a message
   */
  getDeliveryStatus(messageId: string): DeliveryStatus | null {
    const tracker = this.deliveryTrackers.get(messageId);
    return tracker ? tracker.status : null;
  }

  /**
   * Get processing statistics
   */
  getStatistics(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // Private methods

  private startProcessing(): void {
    // Process message queue with debouncing
    const debouncedProcessor = debounce(() => this.processMessageQueue(), this.config.queueProcessIntervalMs);
    this.queueProcessor = setInterval(debouncedProcessor, this.config.queueProcessIntervalMs);

    // Cleanup expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
  }

  private async processMessageQueue(): Promise<void> {
    if (!this.meshNetwork || this.messageQueue.length === 0) {
      return;
    }

    // Sort by priority (high priority first)
    this.messageQueue.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return 0;
    });

    const route = this.messageQueue.shift();
    if (!route) return;

    try {
      // Send packet via mesh network
      await this.meshNetwork.sendMessage(route.packet, route.nextHop);

      // Update delivery tracker
      const tracker = this.deliveryTrackers.get(route.packet.id);
      if (tracker) {
        tracker.status = 'sent';
        tracker.attempts++;
        tracker.lastAttempt = Date.now();
        tracker.nextAttempt = Date.now() + this.config.retryDelayMs * Math.pow(2, tracker.attempts);
      }

    } catch (error) {
      // Retry logic
      const tracker = this.deliveryTrackers.get(route.packet.id);
      if (tracker && tracker.attempts < this.config.maxRetryAttempts) {
        tracker.attempts++;
        tracker.nextAttempt = Date.now() + this.config.retryDelayMs * Math.pow(2, tracker.attempts);
        this.messageQueue.unshift(route); // Put back at front for retry
      } else if (tracker) {
        tracker.status = 'failed';
      }
      console.error('Failed to send message:', error);
    }
  }

  private checkRateLimit(senderPub: string, msgType: MsgType): boolean {
    const now = Date.now();
    let entry = this.rateLimits.get(senderPub);

    if (!entry) {
      entry = { count: 0, windowStart: now };
      this.rateLimits.set(senderPub, entry);
    }

    // Reset window if expired
    if (now - entry.windowStart > this.config.burstWindowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    // Check SOS rate limit
    if (msgType === 'SOS') {
      if (entry.lastSosTime && (now - entry.lastSosTime) < this.config.sosIntervalMs) {
        return false;
      }
      entry.lastSosTime = now;
    }

    // Check general rate limit
    if (entry.count >= this.config.maxMessagesPerMinute) {
      return false;
    }

    entry.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean up expired delivery trackers
    for (const [messageId, tracker] of this.deliveryTrackers.entries()) {
      if (now > tracker.timeout) {
        if (tracker.status === 'sent' || tracker.status === 'queued') {
          tracker.status = 'failed';
        }
        // Keep failed entries for a bit longer for status queries
        if (now > tracker.timeout + (this.config.ackTimeoutMs * 2)) {
          this.deliveryTrackers.delete(messageId);
        }
      }
    }

    // Clean up old rate limit entries
    for (const [senderPub, entry] of this.rateLimits.entries()) {
      if (now - entry.windowStart > this.config.burstWindowMs * 2) {
        this.rateLimits.delete(senderPub);
      }
    }

    // Clean up processed message IDs (keep for 1 hour)
    // Note: In production, this should use a time-based approach
    if (this.processedMessages.size > 10000) {
      this.processedMessages.clear();
    }
  }

  private handleAcknowledgment(messageId: string, senderPub: string): void {
    const tracker = this.deliveryTrackers.get(messageId);
    if (tracker) {
      tracker.acknowledgedBy.add(senderPub);
      if (tracker.acknowledgedBy.size === tracker.recipients.length) {
        tracker.status = 'acked';
      }
    }
  }

  private isMessageFromUs(packet: MeshPacket): boolean {
    return packet.senderPub === this.keyPair.ed25519Pub;
  }
}

/**
 * Factory function to create a message processor
 */
export function createMessageProcessor(
  keyPair?: KeyPair,
  config?: Partial<MessageProcessorConfig>
): MessageProcessor {
  const keys = keyPair || generateKeyPair();
  return new MessageProcessor(keys, config);
}

/**
 * Utility function to validate message content
 */
export function validateMessageBody(body: MsgBody, type: MsgType): { valid: boolean; error?: string } {
  // Check text length for different message types
  if (body.text) {
    const maxLength = type === 'TEXT' ? 280 : 1000; // Longer allowed for SOS
    if (body.text.length > maxLength) {
      return { valid: false, error: `Message text too long (max ${maxLength} chars)` };
    }
  }

  // Validate coordinates if present
  if (body.lat !== undefined || body.lon !== undefined) {
    if (body.lat === undefined || body.lon === undefined) {
      return { valid: false, error: 'Both latitude and longitude required' };
    }
    if (body.lat < -90 || body.lat > 90) {
      return { valid: false, error: 'Invalid latitude' };
    }
    if (body.lon < -180 || body.lon > 180) {
      return { valid: false, error: 'Invalid longitude' };
    }
  }

  // Validate ACK messages
  if (type === 'ACK' && !body.inReplyTo) {
    return { valid: false, error: 'ACK messages must include inReplyTo field' };
  }

  return { valid: true };
}
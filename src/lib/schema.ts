/**
 * ResQLink Mesh - Core Data Structures and Schema
 * Implements the complete message protocol with E2E encryption support
 */

// Message types supported by the mesh network
export type MsgType = "SOS" | "TEXT" | "RESOURCE" | "ACK";

// Trust levels for contact verification
export type TrustLevel = "verified" | "known" | "unknown" | "untrusted";

// Protocol version for forward compatibility
export const PROTOCOL_VERSION = 1;

// TTL limits
export const MIN_TTL = 1;
export const MAX_TTL = 8;
export const DEFAULT_TTL = 5;

// Rate limiting constraints per sender pubkey
export const RATE_LIMITS = {
  SOS_INTERVAL_MS: 30 * 1000,    // 1 SOS per 30 seconds
  MSG_PER_MINUTE: 6,             // 6 messages per minute max
  BURST_WINDOW_MS: 60 * 1000     // Window for rate limiting
};

// Message size limits
export const MAX_MESSAGE_SIZE = 8 * 1024;      // 8KB hard limit
export const TYPICAL_MESSAGE_SIZE = 1536;      // 1.5KB typical

/**
 * Encrypted key envelope for per-recipient encryption
 * Each recipient gets their own sealed box containing the message key
 */
export interface KeyEnvelope {
  /** Base64 encoded Curve25519 recipient public key */
  rcptPub: string;
  /** Base64 encoded sealed box of message key for recipient (X25519->XSalsa20-Poly1305) */
  box: string;
}

/**
 * File attachment metadata for messages
 */
export interface FileAttachmentMetadata {
  /** Filename in filesystem */
  filename: string;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Base64 thumbnail for preview (images only) */
  thumbnail?: string;
  /** File path in local filesystem (not transmitted) */
  localPath?: string;
}

/**
 * Decrypted message body content (encrypted in ciphertext field)
 */
export interface MsgBody {
  /** Message text content (≤280 chars for TEXT, emergency info for SOS) */
  text?: string;
  /** WGS-84 latitude coordinate */
  lat?: number;
  /** WGS-84 longitude coordinate */
  lon?: number;
  /** File attachment (base64 encoded, encrypted separately) */
  attachment?: {
    /** Base64 encoded file data (encrypted with message key) */
    data: string;
    /** File metadata */
    metadata: FileAttachmentMetadata;
  };
  /** Additional data for RESOURCE messages or extensions */
  extras?: Record<string, unknown>;
  /** For ACK messages - the message ID being acknowledged */
  inReplyTo?: string;
}

/**
 * Complete mesh packet for wire transmission
 * All message content is encrypted per-recipient, no plaintext data
 */
export interface MeshPacket {
  /** UUID v4 for deduplication and ACK correlation */
  id: string;
  /** Protocol version for compatibility */
  ver: number;
  /** Message type classification */
  type: MsgType;
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Time-to-live, decremented on each hop (1-8) */
  ttl: number;
  /** Base64 Ed25519 public key of original sender */
  senderPub: string;
  /** Array of encrypted message keys, one per intended recipient */
  keyEnvelopes: KeyEnvelope[];
  /** Base64 encrypted message body (XSalsa20-Poly1305) */
  ciphertext: string;
  /** Base64 Ed25519 signature over canonical JSON (excluding this field) */
  sig: string;
}

/**
 * Contact information for mesh participants
 */
export interface Contact {
  /** User-assigned alias for the contact */
  alias: string;
  /** Base64 Ed25519 public key for signature verification */
  ed25519Pub: string;
  /** Base64 X25519 public key for encryption */
  x25519Pub: string;
  /** First 12 characters of base32 encoded pubkey for UI display */
  fingerprint: string;
  /** When this contact was added */
  addedAt: number;
  /** Trust level for this contact */
  trustLevel: TrustLevel;
  /** Whether this contact is marked as emergency contact */
  isEmergencyContact: boolean;
  /** Optional notes about this contact */
  notes?: string;
}

/**
 * Group definition for fan-out messaging
 */
export interface Group {
  /** UUID for the group */
  id: string;
  /** User-assigned group name */
  name: string;
  /** Optional description of the group */
  description?: string;
  /** Array of X25519 public keys of group members */
  memberPubs: string[];
  /** When this group was created */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
}

/**
 * Local message storage with delivery tracking
 */
export interface StoredMessage {
  /** The mesh packet data */
  packet: MeshPacket;
  /** Whether this message was sent by us */
  isOutbound: boolean;
  /** Delivery status for outbound messages */
  deliveryStatus: 'queued' | 'sent' | 'relayed' | 'acked' | 'failed';
  /** Number of hops this message has traveled */
  hopCount: number;
  /** Last time we relayed this message */
  lastRelayTime?: number;
  /** When we received/sent this message locally */
  localTimestamp: number;
  /** Decrypted message body (only if we can decrypt) */
  decryptedBody?: MsgBody;
}

/**
 * Outbox entry for messages waiting to be sent/relayed
 */
export interface OutboxEntry {
  /** The packet to be transmitted */
  packet: MeshPacket;
  /** List of recipient node IDs for this message */
  recipients: string[];
  /** Number of transmission attempts */
  attempts: number;
  /** Next scheduled transmission time */
  nextAttempt: number;
  /** Priority (SOS = high, others = normal) */
  priority: 'high' | 'normal';
  /** Whether this is a relay (vs original send) */
  isRelay: boolean;
}

/**
 * Cryptographic key pair for local node
 */
export interface KeyPair {
  /** Base64 Ed25519 public key for signatures */
  ed25519Pub: string;
  /** Base64 Ed25519 secret key for signatures */
  ed25519Sec: string;
  /** Base64 X25519 public key for encryption */
  x25519Pub: string;
  /** Base64 X25519 secret key for encryption */
  x25519Sec: string;
  /** When this keypair was generated */
  createdAt: number;
}

/**
 * Rate limiting state per sender
 */
export interface RateLimit {
  /** Last SOS timestamp */
  lastSOS?: number;
  /** Message timestamps in current window */
  messageTimestamps: number[];
}

/**
 * NGO resource pin with signature verification
 */
export interface ResourcePin {
  /** Resource type (e.g., "shelter", "water", "clinic") */
  type: string;
  /** Display name of the resource */
  name: string;
  /** WGS-84 latitude */
  lat: number;
  /** WGS-84 longitude */
  lon: number;
  /** Optional description */
  description?: string;
  /** Expiration timestamp (0 = never expires) */
  expiresAt: number;
  /** Base64 Ed25519 public key of signing NGO */
  signedBy: string;
  /** Base64 Ed25519 signature over canonical resource data */
  signature: string;
  /** When this pin was created */
  createdAt: number;
}

/**
 * Peer information from mesh discovery
 */
export interface MeshPeer {
  /** Platform-specific peer ID */
  id: string;
  /** Display name/alias */
  name: string;
  /** Signal strength (if available) */
  rssi?: number;
  /** Last seen timestamp */
  lastSeen: number;
  /** Connection status */
  connected: boolean;
}

/**
 * Mesh network status
 */
export interface MeshStatus {
  /** Whether mesh networking is active */
  active: boolean;
  /** Number of connected peers */
  peerCount: number;
  /** Discovery/advertising state */
  discovering: boolean;
  /** Current duty cycle interval (ms) */
  dutyCycleMs: number;
  /** Battery optimization mode */
  batteryOptimized: boolean;
  /** Service ID for this session */
  serviceId: string;
}

/**
 * Application configuration settings
 */
export interface AppSettings {
  /** User's display alias */
  userAlias: string;
  /** Language preference */
  language: 'en' | 'ur';
  /** Include location in messages by default */
  includeLocationDefault: boolean;
  /** High contrast mode for accessibility */
  highContrast: boolean;
  /** Font size for accessibility */
  fontSize: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
  /** Theme preference: light, dark, or auto (system) */
  theme: 'light' | 'dark' | 'auto';
  /** Gateway uplink enabled */
  gatewayEnabled: boolean;
  /** Twilio configuration (if gateway enabled) */
  gatewayConfig?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    emergencyContacts: string[];
  };
  /** Relay mode settings */
  relayMode: {
    enabled: boolean;
    dutyCycleMs: number;
    batteryThreshold: number;
  };
}

// JSON Schema validation helpers

/**
 * Validates a MeshPacket structure
 */
export function validateMeshPacket(obj: unknown): obj is MeshPacket {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const packet = obj as Record<string, unknown>;

  return (
    typeof packet.id === 'string' &&
    typeof packet.ver === 'number' &&
    packet.ver === PROTOCOL_VERSION &&
    typeof packet.type === 'string' &&
    ['SOS', 'TEXT', 'RESOURCE', 'ACK'].includes(packet.type) &&
    typeof packet.ts === 'number' &&
    typeof packet.ttl === 'number' &&
    packet.ttl >= MIN_TTL &&
    packet.ttl <= MAX_TTL &&
    typeof packet.senderPub === 'string' &&
    Array.isArray(packet.keyEnvelopes) &&
    packet.keyEnvelopes.length > 0 &&
    typeof packet.ciphertext === 'string' &&
    typeof packet.sig === 'string' &&
    packet.keyEnvelopes.every(validateKeyEnvelope)
  );
}

/**
 * Validates a KeyEnvelope structure
 */
export function validateKeyEnvelope(obj: unknown): obj is KeyEnvelope {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const envelope = obj as Record<string, unknown>;

  return (
    typeof envelope.rcptPub === 'string' &&
    typeof envelope.box === 'string'
  );
}

/**
 * Validates a MsgBody structure
 */
export function validateMsgBody(obj: unknown): obj is MsgBody {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const body = obj as Record<string, unknown>;

  return (
    (body.text === undefined || typeof body.text === 'string') &&
    (body.lat === undefined || typeof body.lat === 'number') &&
    (body.lon === undefined || typeof body.lon === 'number') &&
    (body.extras === undefined || typeof body.extras === 'object') &&
    (body.inReplyTo === undefined || typeof body.inReplyTo === 'string')
  );
}

/**
 * Creates canonical JSON for signing (excluding sig field)
 */
export function canonicalPacketJSON(packet: Omit<MeshPacket, 'sig'>): string {
  const canonical = {
    id: packet.id,
    ver: packet.ver,
    type: packet.type,
    ts: packet.ts,
    ttl: packet.ttl,
    senderPub: packet.senderPub,
    keyEnvelopes: packet.keyEnvelopes.map(env => ({
      rcptPub: env.rcptPub,
      box: env.box
    })),
    ciphertext: packet.ciphertext
  };
  return JSON.stringify(canonical);
}

/**
 * Creates a UUID v4 for message IDs
 */
export function generateMessageId(): string {
  // Use crypto.randomUUID if available, fallback to uuid library
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Checks if a rate limit is exceeded for a given sender
 */
export function checkRateLimit(
  senderPub: string,
  msgType: MsgType,
  rateLimits: Map<string, RateLimit>
): boolean {
  const now = Date.now();
  let limit = rateLimits.get(senderPub);

  if (!limit) {
    limit = { messageTimestamps: [] };
    rateLimits.set(senderPub, limit);
  }

  // Check SOS rate limit
  if (msgType === 'SOS') {
    if (limit.lastSOS && (now - limit.lastSOS) < RATE_LIMITS.SOS_INTERVAL_MS) {
      return false; // Rate limited
    }
    limit.lastSOS = now;
  }

  // Check general message rate limit
  const windowStart = now - RATE_LIMITS.BURST_WINDOW_MS;
  limit.messageTimestamps = limit.messageTimestamps.filter(ts => ts > windowStart);

  if (limit.messageTimestamps.length >= RATE_LIMITS.MSG_PER_MINUTE) {
    return false; // Rate limited
  }

  limit.messageTimestamps.push(now);
  return true;
}

/**
 * Peer information for mesh networking
 */
export interface PeerInfo {
  /** Unique identifier for the peer */
  peerId: string;
  /** Human-readable display name */
  displayName: string;
  /** Platform type (android, ios, web) */
  platform: string;
  /** List of supported capabilities */
  capabilities: string[];
  /** Last time this peer was seen */
  lastSeen: Date;
  /** Signal strength indicator (0-100) */
  signalStrength?: number;
}

/**
 * Current mesh network state
 */
export interface MeshNetworkState {
  /** Whether the mesh network is started */
  isStarted: boolean;
  /** Whether currently discovering peers */
  isDiscovering: boolean;
  /** Whether currently advertising to peers */
  isAdvertising: boolean;
  /** List of currently connected peer IDs */
  connectedPeerIds: string[];
  /** List of discovered but not connected peer IDs */
  discoveredPeerIds: string[];
  /** Last state update timestamp */
  lastUpdate: Date;
}

/**
 * Resource types available in disaster response scenarios
 */
export type ResourceType =
  | "medical"      // Medical supplies, first aid, hospitals
  | "shelter"      // Safe shelter, evacuation centers
  | "food"         // Food supplies, water, nutrition
  | "rescue"       // Rescue teams, emergency services
  | "transport"    // Vehicles, evacuation transport
  | "communication" // Radio, satellite, communication hubs
  | "hazard"       // Dangerous areas, blocked routes, risks
  | "utility"      // Power, fuel, essential services
  | "supplies";    // General supplies and resources

/**
 * Resource status indicating availability and urgency
 */
export type ResourceStatus =
  | "available"    // Resource is available and accessible
  | "limited"      // Resource exists but limited supply
  | "requested"    // Resource is needed/requested
  | "unavailable"  // Resource is depleted or inaccessible
  | "verified"     // Resource status has been verified by trusted source
  | "reported";    // Resource reported but not yet verified

/**
 * Geographic location for resources and mapping
 */
export interface Location {
  /** WGS-84 latitude coordinate */
  latitude: number;
  /** WGS-84 longitude coordinate */
  longitude: number;
  /** Optional altitude in meters */
  altitude?: number;
  /** Location accuracy radius in meters */
  accuracy?: number;
  /** Timestamp when location was recorded */
  timestamp: number;
  /** Human-readable address or landmark description */
  address?: string;
}

/**
 * Resource pin data for mapping interface
 */
export interface ResourceMapPin {
  /** Unique identifier for the resource */
  id: string;
  /** Type of resource */
  type: ResourceType;
  /** Resource status */
  status: ResourceStatus;
  /** Resource title/name */
  title: string;
  /** Detailed description of the resource */
  description: string;
  /** Geographic location */
  location: Location;
  /** Contact information for the resource */
  contact?: {
    name?: string;
    phone?: string;
    radio?: string;
  };
  /** Capacity or quantity information */
  capacity?: {
    current: number;
    maximum: number;
    unit: string; // e.g., "people", "kg", "liters"
  };
  /** Reporter information */
  reportedBy: {
    contactId: string; // ed25519Pub of reporter
    alias: string;
    timestamp: number;
  };
  /** Verification information */
  verification?: {
    verifiedBy: string; // ed25519Pub of verifier
    verifierAlias: string;
    timestamp: number;
    notes?: string;
  };
  /** Resource expiry or validity */
  validUntil?: number;
  /** Priority level for emergency resources */
  priority: "low" | "medium" | "high" | "critical";
  /** Tags for additional categorization */
  tags: string[];
  /** Whether this resource should be broadcast to mesh network */
  broadcastToMesh: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}
/**
 * ResQLink Mesh - Global State Management
 * Implements Zustand store with IndexedDB persistence for offline-first operation
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import {
  MeshPacket,
  StoredMessage,
  Contact,
  Group,
  KeyPair,
  OutboxEntry,
  MeshPeer,
  MeshStatus,
  AppSettings,
  ResourcePin,
  RateLimit,
  MsgType,
  MsgBody,
  generateMessageId
} from './schema';
import { generateKeyPair, createFingerprint, encryptMessage, signPacket } from './crypto';
import { getMeshNetworkManager } from './mesh';
import { createMessageProcessor } from './message-processor';

// IndexedDB storage wrapper
const createIndexedDBStorage = () => {
  return createJSONStorage(() => ({
    getItem: async (name: string) => {
      const db = await openDB();
      const tx = db.transaction(['settings'], 'readonly');
      const store = tx.objectStore('settings');
      const result = await store.get(name);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(result ? JSON.stringify(result) : null);
        tx.onerror = () => reject(tx.error);
      });
    },
    setItem: async (name: string, value: string) => {
      const db = await openDB();
      const tx = db.transaction(['settings'], 'readwrite');
      const store = tx.objectStore('settings');
      await store.put(JSON.parse(value), name);
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    removeItem: async (name: string) => {
      const db = await openDB();
      const tx = db.transaction(['settings'], 'readwrite');
      const store = tx.objectStore('settings');
      await store.delete(name);
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }));
};

// IndexedDB database setup
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ResQLinkMesh', 3);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'packet.id' });
        messageStore.createIndex('timestamp', 'localTimestamp');
        messageStore.createIndex('sender', 'packet.senderPub');
        messageStore.createIndex('type', 'packet.type');
      } else if (oldVersion < 3) {
        // Upgrade existing store with new indexes if needed
        const tx = (event.target as IDBOpenDBRequest).transaction;
        if (tx) {
          const messageStore = tx.objectStore('messages');
          if (!messageStore.indexNames.contains('timestamp')) {
            messageStore.createIndex('timestamp', 'localTimestamp');
          }
          if (!messageStore.indexNames.contains('sender')) {
            messageStore.createIndex('sender', 'packet.senderPub');
          }
          if (!messageStore.indexNames.contains('type')) {
            messageStore.createIndex('type', 'packet.type');
          }
        }
      }

      // Outbox store
      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'packet.id' });
        outboxStore.createIndex('nextAttempt', 'nextAttempt');
        outboxStore.createIndex('priority', 'priority');
      }

      // Contacts store
      if (!db.objectStoreNames.contains('contacts')) {
        const contactStore = db.createObjectStore('contacts', { keyPath: 'ed25519Pub' });
        contactStore.createIndex('x25519Pub', 'x25519Pub', { unique: true });
        contactStore.createIndex('fingerprint', 'fingerprint');
        contactStore.createIndex('trustLevel', 'trustLevel');
      }

      // Settings store (for Zustand persistence)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }

      // Resource pins store
      if (!db.objectStoreNames.contains('resourcePins')) {
        const resourceStore = db.createObjectStore('resourcePins', { keyPath: 'createdAt' });
        resourceStore.createIndex('location', ['lat', 'lon']);
        resourceStore.createIndex('type', 'type');
        resourceStore.createIndex('expiresAt', 'expiresAt');
        resourceStore.createIndex('typeAndStatus', ['type', 'status']);
      } else if (oldVersion < 3) {
        // Add new index for type and status queries
        const tx = (event.target as IDBOpenDBRequest).transaction;
        if (tx) {
          const resourceStore = tx.objectStore('resourcePins');
          if (!resourceStore.indexNames.contains('typeAndStatus')) {
            resourceStore.createIndex('typeAndStatus', ['type', 'status']);
          }
        }
      }
    };
  });
}

// Default settings
const defaultSettings: AppSettings = {
  userAlias: 'Anonymous',
  language: 'en',
  includeLocationDefault: true,
  highContrast: false,
  fontSize: 'medium',
  theme: 'auto', // Default to system preference
  gatewayEnabled: false,
  relayMode: {
    enabled: true,
    dutyCycleMs: 30000, // 30 second intervals
    batteryThreshold: 20 // Stop relaying below 20%
  }
};

/**
 * Theme Management Utilities
 * Implements theme switching with system preference detection
 */

// Detect if user prefers dark mode based on system settings
const getSystemThemePreference = (): 'light' | 'dark' => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

// Apply theme to the document
const applyTheme = (theme: 'light' | 'dark' | 'auto') => {
  let effectiveTheme: 'light' | 'dark';

  if (theme === 'auto') {
    effectiveTheme = getSystemThemePreference();
  } else {
    effectiveTheme = theme;
  }

  // Toggle .ion-palette-dark class on html element
  const isDark = effectiveTheme === 'dark';
  document.documentElement.classList.toggle('ion-palette-dark', isDark);

  console.log(`Theme applied: ${theme} (effective: ${effectiveTheme})`);
};

// Apply high contrast mode to the document
const applyHighContrast = (enabled: boolean) => {
  // Toggle .high-contrast-mode class on html element
  document.documentElement.classList.toggle('high-contrast-mode', enabled);

  console.log(`High contrast mode: ${enabled ? 'enabled' : 'disabled'}`);
};

// Apply font size to the document
const applyFontSize = (fontSize: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge') => {
  // Remove all font size classes first
  document.documentElement.classList.remove(
    'font-size-small',
    'font-size-medium',
    'font-size-large',
    'font-size-xlarge',
    'font-size-xxlarge'
  );

  // Add the selected font size class
  document.documentElement.classList.add(`font-size-${fontSize}`);

  console.log(`Font size set to: ${fontSize}`);
};

// Initialize system theme listener
let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

const initializeSystemThemeListener = (store: any) => {
  // Remove existing listener if any
  if (systemThemeListener) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.removeEventListener('change', systemThemeListener);
  }

  // Create new listener
  systemThemeListener = (e: MediaQueryListEvent) => {
    const settings = store.getState().settings;

    // Only react to system changes if in auto mode
    if (settings.theme === 'auto') {
      const systemTheme = e.matches ? 'dark' : 'light';
      document.documentElement.classList.toggle('ion-palette-dark', systemTheme === 'dark');
      console.log(`System theme changed to: ${systemTheme}`);
    }
  };

  // Attach listener
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', systemThemeListener);
};

// Store interface
interface ResQLinkStore {
  // State
  keyPair: sodium.KeyPair | null;
  isInitialized: boolean;
  messageProcessor: any | null;
  contacts: Contact[];
  groups: Group[];
  meshStatus: MeshStatus;
  peers: MeshPeer[];
  messages: StoredMessage[];
  outbox: OutboxEntry[];
  rateLimits: Map<string, RateLimit>;
  resourcePins: ResourcePin[];
  settings: AppSettings;
  currentLocation: { lat: number; lon: number } | null;
  activeConversation: string | null;

  // Selectors (computed values)
  getContactByPublicKey: (publicKey: string) => Contact | undefined;
  getContactsByTrustLevel: (level: TrustLevel) => Contact[];
  getGroupById: (groupId: string) => MeshGroup | undefined;
  getMessagesByRecipient: (recipientPublicKey: string) => StoredMessage[];
  getUnreadMessageCount: (recipientPublicKey?: string) => number;
  getPendingOutboxCount: () => number;
  getResourcePinsByType: (type: ResourcePin['type']) => ResourcePin[];
  getActiveResourcePins: () => ResourcePin[];

  // Key management
  initializeNode: () => Promise<void>;

  // Contact management
  addContact: (alias: string, ed25519Pub: string, x25519Pub: string) => void;
  removeContact: (ed25519Pub: string) => void;
  updateContact: (ed25519Pub: string, updates: Partial<Contact>) => void;

  // Group management
  createGroup: (name: string, memberPubs: string[]) => string;
  updateGroup: (groupId: string, updates: Partial<Group>) => void;
  removeGroup: (groupId: string) => void;
  addGroupMember: (groupId: string, memberPub: string) => void;
  removeGroupMember: (groupId: string, memberPub: string) => void;

  // Message operations
  sendMessage: (type: MsgType, body: MsgBody, recipients: string[]) => Promise<string>;
  receiveMessage: (packet: MeshPacket) => Promise<boolean>;
  markMessageRead: (messageId: string) => void;
  deleteMessage: (messageId: string) => void;

  // Mesh networking
  updateMeshStatus: (status: Partial<MeshStatus>) => void;
  updatePeers: (peers: MeshPeer[]) => void;
  addPeer: (peer: MeshPeer) => void;
  removePeer: (peerId: string) => void;

  // Resource pins
  addResourcePin: (pin: ResourcePin) => void;
  removeResourcePin: (createdAt: number) => void;
  getResourcePinsNearby: (lat: number, lon: number, radiusKm: number) => ResourcePin[];

  // Settings
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Theme management
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  initializeTheme: () => void;

  // Location
  updateLocation: (lat: number, lon: number) => void;

  // UI state
  setActiveConversation: (contactOrGroupId: string | null) => void;

  // Database operations
  loadMessagesFromDB: () => Promise<void>;
  saveMessageToDB: (message: StoredMessage) => Promise<void>;
  loadOutboxFromDB: () => Promise<void>;
  saveOutboxEntry: (entry: OutboxEntry) => Promise<void>;
  removeOutboxEntry: (messageId: string) => Promise<void>;
  loadResourcePinsFromDB: () => Promise<void>;
  saveResourcePin: (pin: ResourcePin) => Promise<void>;
  cleanupOldMessages: () => Promise<void>;
  getDatabaseSize: () => Promise<{ estimatedSize: number; quota: number; usage: number }>;
  exportDatabase: () => Promise<string>;
  importDatabase: (jsonData: string) => Promise<void>;
}

// Create the Zustand store
export const useResQLinkStore = create<ResQLinkStore>()(
  devtools(
    persist(
      (set, get) => ({
      // Initial state
      keyPair: null,
      isInitialized: false,
      messageProcessor: null,
      contacts: [],
      groups: [],
      meshStatus: {
        active: false,
        peerCount: 0,
        discovering: false,
        dutyCycleMs: 30000,
        batteryOptimized: true,
        serviceId: ''
      },
      peers: [],
      messages: [],
      outbox: [],
      rateLimits: new Map(),
      resourcePins: [],
      settings: defaultSettings,
      currentLocation: null,
      activeConversation: null,

      // Selectors - these are memoized by Zustand automatically
      getContactByPublicKey: (publicKey: string) => {
        return get().contacts.find(
          c => c.ed25519Pub === publicKey || c.x25519Pub === publicKey
        );
      },

      getContactsByTrustLevel: (level: TrustLevel) => {
        return get().contacts.filter(c => c.trustLevel === level);
      },

      getGroupById: (groupId: string) => {
        return get().groups.find(g => g.id === groupId);
      },

      getMessagesByRecipient: (recipientPublicKey: string) => {
        const state = get();
        return state.messages.filter(msg => {
          if (msg.packet.type === 'groupMessage') {
            return msg.packet.groupId === recipientPublicKey;
          }
          return msg.packet.sender === recipientPublicKey || msg.recipientId === recipientPublicKey;
        });
      },

      getUnreadMessageCount: (recipientPublicKey?: string) => {
        const state = get();
        if (recipientPublicKey) {
          return state.messages.filter(msg => {
            const isForRecipient = msg.packet.type === 'groupMessage'
              ? msg.packet.groupId === recipientPublicKey
              : msg.packet.sender === recipientPublicKey || msg.recipientId === recipientPublicKey;
            return isForRecipient && !msg.read;
          }).length;
        }
        return state.messages.filter(msg => !msg.read).length;
      },

      getPendingOutboxCount: () => {
        return get().outbox.length;
      },

      getResourcePinsByType: (type: ResourcePin['type']) => {
        return get().resourcePins.filter(pin => pin.type === type);
      },

      getActiveResourcePins: () => {
        const now = Date.now();
        return get().resourcePins.filter(pin => {
          if (pin.expiresAt && pin.expiresAt < now) return false;
          return pin.status === 'available' || pin.status === 'active';
        });
      },

      // Initialize the node with cryptographic identity
      initializeNode: async () => {
        const state = get();
        if (state.isInitialized && state.keyPair) {
          return;
        }

        const keyPair = generateKeyPair();
        const messageProcessor = createMessageProcessor(keyPair);

        set({
          keyPair,
          isInitialized: true,
          messageProcessor,
          meshStatus: {
            ...state.meshStatus,
            serviceId: createFingerprint(keyPair.ed25519Pub)
          }
        });

        // Load persisted data
        await get().loadMessagesFromDB();
        await get().loadOutboxFromDB();
        await get().loadResourcePinsFromDB();
      },

      // Contact management
      addContact: (alias, ed25519Pub, x25519Pub) => {
        const fingerprint = createFingerprint(ed25519Pub);
        const contact: Contact = {
          alias,
          ed25519Pub,
          x25519Pub,
          fingerprint,
          addedAt: Date.now(),
          trustLevel: 'unknown' as const,
          isEmergencyContact: false
        };

        set(state => ({
          contacts: [...state.contacts.filter(c => c.ed25519Pub !== ed25519Pub), contact]
        }));
      },

      removeContact: (ed25519Pub) => {
        set(state => ({
          contacts: state.contacts.filter(c => c.ed25519Pub !== ed25519Pub)
        }));
      },

      updateContact: (ed25519Pub, updates) => {
        set(state => ({
          contacts: state.contacts.map(c =>
            c.ed25519Pub === ed25519Pub ? { ...c, ...updates } : c
          )
        }));
      },

      // Group management
      createGroup: (name, memberPubs) => {
        const groupId = crypto.randomUUID();
        const group: Group = {
          id: groupId,
          name,
          memberPubs: [...memberPubs],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        set(state => ({
          groups: [...state.groups, group]
        }));

        return groupId;
      },

      updateGroup: (groupId, updates) => {
        set(state => ({
          groups: state.groups.map(g =>
            g.id === groupId ? { ...g, ...updates, updatedAt: Date.now() } : g
          )
        }));
      },

      removeGroup: (groupId) => {
        set(state => ({
          groups: state.groups.filter(g => g.id !== groupId)
        }));
      },

      addGroupMember: (groupId, memberPub) => {
        set(state => ({
          groups: state.groups.map(g =>
            g.id === groupId && !g.memberPubs.includes(memberPub)
              ? { ...g, memberPubs: [...g.memberPubs, memberPub], updatedAt: Date.now() }
              : g
          )
        }));
      },

      removeGroupMember: (groupId, memberPub) => {
        set(state => ({
          groups: state.groups.map(g =>
            g.id === groupId
              ? { ...g, memberPubs: g.memberPubs.filter(p => p !== memberPub), updatedAt: Date.now() }
              : g
          )
        }));
      },

      // Message operations
      sendMessage: async (type: MsgType, body: MsgBody, recipients: string[]) => {
        const state = get();

        if (!state.keyPair || !state.messageProcessor) {
          throw new Error('Node not initialized');
        }

        const messageId = generateMessageId();

        // Get recipient X25519 public keys for encryption
        const recipientX25519Pubs: string[] = [];
        for (const recipientPub of recipients) {
          // Look up recipient in contacts to get X25519 key
          const contact = state.contacts.find(c => c.ed25519Pub === recipientPub);
          if (contact) {
            recipientX25519Pubs.push(contact.x25519Pub);
          } else {
            console.warn(`Contact not found for recipient: ${recipientPub}`);
            // Skip this recipient for now
            continue;
          }
        }

        if (recipientX25519Pubs.length === 0) {
          throw new Error('No valid recipients found');
        }

        // Encrypt the message
        const { keyEnvelopes, ciphertext } = encryptMessage(
          body,
          recipientX25519Pubs,
          state.keyPair.x25519Sec
        );

        // Create the mesh packet (without signature)
        const unsignedPacket = {
          id: messageId,
          ver: 1, // Protocol version
          type,
          ts: Date.now(),
          ttl: 8, // Max hops
          senderPub: state.keyPair.ed25519Pub,
          keyEnvelopes,
          ciphertext
        };

        // Sign the packet
        const signature = signPacket(unsignedPacket, state.keyPair.ed25519Sec);

        const packet: MeshPacket = {
          ...unsignedPacket,
          sig: signature
        };

        // Send via mesh network
        const meshManager = getMeshNetworkManager();
        const result = await meshManager.sendMessage(packet);

        if (result.success) {
          // Store in outbox for tracking
          const outboxEntry: OutboxEntry = {
            packet,
            recipients,
            attempts: 1,
            nextAttempt: Date.now() + 30000, // Retry in 30 seconds if needed
            priority: packet.type === 'SOS' ? 'high' : 'normal',
            isRelay: false
          };

          set(state => ({
            outbox: [...state.outbox, outboxEntry]
          }));

          // Also store as a message in our local storage
          const storedMessage: StoredMessage = {
            packet,
            decryptedBody: body,
            localTimestamp: Date.now(),
            isOutbound: true,
            deliveryStatus: 'queued' as const,
            hopCount: 0
          };

          set(state => ({
            messages: [...state.messages, storedMessage]
          }));

          await get().saveMessageToDB(storedMessage);
        }

        return messageId;
      },

      receiveMessage: async (packet: MeshPacket) => {
        const state = get();

        // Early validation
        if (!state.keyPair || !state.messageProcessor) {
          console.warn('Cannot process message: Node not initialized');
          return false;
        }

        // Check if we already have this message (deduplication)
        const existingMessage = state.messages.find(m => m.packet.id === packet.id);
        if (existingMessage) {
          console.log('Message already processed:', packet.id);
          return true;
        }

        try {
          // Use messageProcessor to decrypt and validate the message
          const result = await state.messageProcessor.receiveMessage(packet);

          if (result.success && result.decrypted) {
            // Handle attachment if present
            if (result.decrypted.attachment) {
              try {
                // Import FileSystemService dynamically to avoid circular dependencies
                const { fileSystemService } = await import('../services/FileSystemService');

                const attachment = result.decrypted.attachment;
                const filename = attachment.metadata.filename || `attachment_${Date.now()}`;
                const mimeType = attachment.metadata.mimeType || 'application/octet-stream';

                // Save attachment to filesystem
                const saveResult = await fileSystemService.saveMediaFile(
                  attachment.data,
                  filename,
                  mimeType
                );

                if (saveResult.success && saveResult.metadata) {
                  // Update attachment metadata with local filesystem path
                  attachment.metadata.localPath = saveResult.path;
                  attachment.metadata.thumbnail = saveResult.metadata.thumbnail;
                  console.log('Attachment saved to filesystem:', saveResult.path);
                } else {
                  console.warn('Failed to save attachment to filesystem:', saveResult.error);
                  // Continue without saving - attachment data still in memory
                }
              } catch (error) {
                console.error('Error saving attachment:', error);
                // Continue without saving - attachment data still in memory
              }
            }

            // Store the successfully decrypted message
            const storedMessage: StoredMessage = {
              packet,
              isOutbound: false,
              deliveryStatus: 'sent', // This is an inbound message that was successfully received
              hopCount: packet.ttl <= 0 ? 8 : (8 - packet.ttl), // Calculate hops from TTL
              localTimestamp: Date.now(),
              decryptedBody: result.decrypted
            };

            // Add to messages array
            set(state => ({
              messages: [...state.messages, storedMessage]
            }));

            console.log('Message received and processed:', packet.id);
            return true;
          } else {
            // Store the message even if we can't decrypt it (for relay purposes)
            const storedMessage: StoredMessage = {
              packet,
              isOutbound: false,
              deliveryStatus: 'relayed',
              hopCount: packet.ttl <= 0 ? 8 : (8 - packet.ttl),
              localTimestamp: Date.now()
              // No decryptedBody - we couldn't decrypt it
            };

            set(state => ({
              messages: [...state.messages, storedMessage]
            }));

            console.log('Message stored for relay (could not decrypt):', packet.id);
            return true;
          }
        } catch (error) {
          console.error('Error processing received message:', error);
          return false;
        }
      },

      markMessageRead: (messageId) => {
        set(state => ({
          messages: state.messages.map(m =>
            m.packet.id === messageId ? { ...m } : m
          )
        }));
      },

      deleteMessage: (messageId) => {
        set(state => ({
          messages: state.messages.filter(m => m.packet.id !== messageId)
        }));
      },

      // Mesh networking
      updateMeshStatus: (status) => {
        set(state => ({
          meshStatus: { ...state.meshStatus, ...status }
        }));
      },

      updatePeers: (peers) => {
        set({ peers });
      },

      addPeer: (peer) => {
        set(state => ({
          peers: [...state.peers.filter(p => p.id !== peer.id), peer]
        }));
      },

      removePeer: (peerId) => {
        set(state => ({
          peers: state.peers.filter(p => p.id !== peerId)
        }));
      },

      // Resource pins
      addResourcePin: (pin) => {
        set(state => ({
          resourcePins: [...state.resourcePins, pin]
        }));
        get().saveResourcePin(pin);
      },

      removeResourcePin: (createdAt) => {
        set(state => ({
          resourcePins: state.resourcePins.filter(p => p.createdAt !== createdAt)
        }));
      },

      getResourcePinsNearby: (lat, lon, radiusKm) => {
        const state = get();
        const R = 6371; // Earth's radius in km

        return state.resourcePins.filter(pin => {
          // Haversine distance calculation
          const dLat = (pin.lat - lat) * Math.PI / 180;
          const dLon = (pin.lon - lon) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat * Math.PI / 180) * Math.cos(pin.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          return distance <= radiusKm && (pin.expiresAt === 0 || pin.expiresAt > Date.now());
        });
      },

      // Settings
      updateSettings: (updates) => {
        set(state => ({
          settings: { ...state.settings, ...updates }
        }));

        // Apply high contrast mode if it was updated
        if ('highContrast' in updates) {
          applyHighContrast(updates.highContrast!);
        }

        // Apply font size if it was updated
        if ('fontSize' in updates) {
          applyFontSize(updates.fontSize!);
        }

        // Apply theme if it was updated
        if ('theme' in updates) {
          applyTheme(updates.theme!);
        }
      },

      // Theme management
      setTheme: (theme: 'light' | 'dark' | 'auto') => {
        // Update settings
        set(state => ({
          settings: { ...state.settings, theme }
        }));

        // Apply theme immediately
        applyTheme(theme);

        console.log(`Theme preference set to: ${theme}`);
      },

      initializeTheme: () => {
        const state = get();
        const theme = state.settings.theme || 'auto';
        const highContrast = state.settings.highContrast || false;
        const fontSize = state.settings.fontSize || 'medium';

        // Apply current theme
        applyTheme(theme);

        // Apply high contrast mode
        applyHighContrast(highContrast);

        // Apply font size
        applyFontSize(fontSize);

        // Initialize system preference listener
        initializeSystemThemeListener({ getState: get });

        console.log('Theme system initialized');
      },

      // Location
      updateLocation: (lat, lon) => {
        set({ currentLocation: { lat, lon } });
      },

      // UI state
      setActiveConversation: (contactOrGroupId) => {
        set({ activeConversation: contactOrGroupId });
      },

      // Database operations
      loadMessagesFromDB: async () => {
        try {
          const db = await openDB();
          const tx = db.transaction(['messages'], 'readonly');
          const store = tx.objectStore('messages');
          const request = store.getAll();

          return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
              const messages = request.result as StoredMessage[];
              // Sort by timestamp, most recent first
              messages.sort((a: StoredMessage, b: StoredMessage) => b.localTimestamp - a.localTimestamp);
              set({ messages });
              resolve();
            };
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to load messages from DB:', error);
        }
      },

      saveMessageToDB: async (message) => {
        try {
          const db = await openDB();
          const tx = db.transaction(['messages'], 'readwrite');
          const store = tx.objectStore('messages');
          const request = store.put(message);

          return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to save message to DB:', error);
        }
      },

      loadOutboxFromDB: async () => {
        try {
          const db = await openDB();
          const tx = db.transaction(['outbox'], 'readonly');
          const store = tx.objectStore('outbox');
          const request = store.getAll();

          return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
              const outbox = request.result as OutboxEntry[];
              set({ outbox });
              resolve();
            };
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to load outbox from DB:', error);
        }
      },

      saveOutboxEntry: async (entry) => {
        try {
          const db = await openDB();
          const tx = db.transaction(['outbox'], 'readwrite');
          const store = tx.objectStore('outbox');
          const request = store.put(entry);

          return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to save outbox entry:', error);
        }
      },

      removeOutboxEntry: async (messageId) => {
        try {
          const db = await openDB();
          const tx = db.transaction(['outbox'], 'readwrite');
          const store = tx.objectStore('outbox');
          const request = store.delete(messageId);

          return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to remove outbox entry:', error);
        }
      },

      loadResourcePinsFromDB: async () => {
        try {
          const db = await openDB();
          const tx = db.transaction(['resourcePins'], 'readonly');
          const store = tx.objectStore('resourcePins');
          const request = store.getAll();

          return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
              const pins = request.result as ResourcePin[];
              // Filter out expired pins
              const now = Date.now();
              const validPins = pins.filter((pin: ResourcePin) => pin.expiresAt === 0 || pin.expiresAt > now);

              set({ resourcePins: validPins });
              resolve();
            };
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to load resource pins from DB:', error);
        }
      },

      saveResourcePin: async (pin) => {
        try {
          const db = await openDB();
          const tx = db.transaction(['resourcePins'], 'readwrite');
          const store = tx.objectStore('resourcePins');
          const request = store.put(pin);

          return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to save resource pin:', error);
        }
      },

      // Database cleanup - remove old messages (keep last 1000 or messages from last 30 days)
      cleanupOldMessages: async () => {
        try {
          const db = await openDB();
          const tx = db.transaction(['messages'], 'readwrite');
          const store = tx.objectStore('messages');
          const index = store.index('timestamp');

          // Get all messages sorted by timestamp
          const allMessages = await new Promise<StoredMessage[]>((resolve, reject) => {
            const request = index.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          if (allMessages.length <= 1000) {
            console.log('No cleanup needed - message count within limits');
            return;
          }

          // Sort by timestamp descending (newest first)
          allMessages.sort((a, b) => b.localTimestamp - a.localTimestamp);

          // Keep messages from last 30 days OR last 1000 messages (whichever is larger)
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          const messagesInLast30Days = allMessages.filter(m => m.localTimestamp >= thirtyDaysAgo);

          const keepCount = Math.max(1000, messagesInLast30Days.length);
          const messagesToDelete = allMessages.slice(keepCount);

          // Delete old messages
          const deleteTx = db.transaction(['messages'], 'readwrite');
          const deleteStore = deleteTx.objectStore('messages');

          for (const msg of messagesToDelete) {
            deleteStore.delete(msg.packet.id);
          }

          return new Promise<void>((resolve, reject) => {
            deleteTx.oncomplete = () => {
              console.log(`Cleaned up ${messagesToDelete.length} old messages`);
              // Update in-memory state
              set(state => ({
                messages: state.messages.filter(m =>
                  !messagesToDelete.find(d => d.packet.id === m.packet.id)
                )
              }));
              resolve();
            };
            deleteTx.onerror = () => reject(deleteTx.error);
          });
        } catch (error) {
          console.error('Failed to cleanup old messages:', error);
        }
      },

      // Get database storage information
      getDatabaseSize: async () => {
        try {
          if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
              estimatedSize: estimate.usage || 0,
              quota: estimate.quota || 0,
              usage: estimate.usage ? (estimate.usage / (estimate.quota || 1)) * 100 : 0
            };
          }
          return { estimatedSize: 0, quota: 0, usage: 0 };
        } catch (error) {
          console.error('Failed to get database size:', error);
          return { estimatedSize: 0, quota: 0, usage: 0 };
        }
      },

      // Export database to JSON
      exportDatabase: async () => {
        try {
          const db = await openDB();

          // Get all data from each store
          const messagesTx = db.transaction(['messages'], 'readonly');
          const messagesStore = messagesTx.objectStore('messages');
          const messages = await new Promise<StoredMessage[]>((resolve, reject) => {
            const request = messagesStore.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          const outboxTx = db.transaction(['outbox'], 'readonly');
          const outboxStore = outboxTx.objectStore('outbox');
          const outbox = await new Promise<OutboxEntry[]>((resolve, reject) => {
            const request = outboxStore.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          const resourcePinsTx = db.transaction(['resourcePins'], 'readonly');
          const resourcePinsStore = resourcePinsTx.objectStore('resourcePins');
          const resourcePins = await new Promise<ResourcePin[]>((resolve, reject) => {
            const request = resourcePinsStore.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          const state = get();

          // Create export object
          const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            data: {
              messages,
              outbox,
              resourcePins,
              contacts: state.contacts,
              groups: state.groups,
              settings: state.settings
            }
          };

          return JSON.stringify(exportData, null, 2);
        } catch (error) {
          console.error('Failed to export database:', error);
          throw error;
        }
      },

      // Import database from JSON
      importDatabase: async (jsonData: string) => {
        try {
          const importData = JSON.parse(jsonData);

          if (!importData.version || !importData.data) {
            throw new Error('Invalid backup format');
          }

          const db = await openDB();

          // Import messages
          if (importData.data.messages && Array.isArray(importData.data.messages)) {
            const messagesTx = db.transaction(['messages'], 'readwrite');
            const messagesStore = messagesTx.objectStore('messages');

            for (const msg of importData.data.messages) {
              messagesStore.put(msg);
            }

            await new Promise<void>((resolve, reject) => {
              messagesTx.oncomplete = () => resolve();
              messagesTx.onerror = () => reject(messagesTx.error);
            });
          }

          // Import outbox
          if (importData.data.outbox && Array.isArray(importData.data.outbox)) {
            const outboxTx = db.transaction(['outbox'], 'readwrite');
            const outboxStore = outboxTx.objectStore('outbox');

            for (const entry of importData.data.outbox) {
              outboxStore.put(entry);
            }

            await new Promise<void>((resolve, reject) => {
              outboxTx.oncomplete = () => resolve();
              outboxTx.onerror = () => reject(outboxTx.error);
            });
          }

          // Import resource pins
          if (importData.data.resourcePins && Array.isArray(importData.data.resourcePins)) {
            const resourcePinsTx = db.transaction(['resourcePins'], 'readwrite');
            const resourcePinsStore = resourcePinsTx.objectStore('resourcePins');

            for (const pin of importData.data.resourcePins) {
              resourcePinsStore.put(pin);
            }

            await new Promise<void>((resolve, reject) => {
              resourcePinsTx.oncomplete = () => resolve();
              resourcePinsTx.onerror = () => reject(resourcePinsTx.error);
            });
          }

          // Update Zustand state
          set({
            contacts: importData.data.contacts || [],
            groups: importData.data.groups || [],
            settings: { ...defaultSettings, ...importData.data.settings }
          });

          // Reload data from DB
          await get().loadMessagesFromDB();
          await get().loadOutboxFromDB();
          await get().loadResourcePinsFromDB();

          console.log('Database import completed successfully');
        } catch (error) {
          console.error('Failed to import database:', error);
          throw error;
        }
      }
    }),
    {
      name: 'resqlink-storage',
      storage: createIndexedDBStorage(),
      // Only persist settings and core identity data
      partialize: (state) => ({
        keyPair: state.keyPair,
        isInitialized: state.isInitialized,
        contacts: state.contacts,
        groups: state.groups,
        settings: state.settings
      })
    }
  ),
  { name: 'ResQLink Store', enabled: import.meta.env.DEV }
  )
);

// Utility hook for getting contacts by public key
export function useContactByPubKey(pubKey: string) {
  return useResQLinkStore(state =>
    state.contacts.find(c => c.ed25519Pub === pubKey || c.x25519Pub === pubKey)
  );
}

// Utility hook for getting messages for a conversation
export function useConversationMessages(contactOrGroupId: string) {
  return useResQLinkStore(state => {
    const contact = state.contacts.find(c => c.ed25519Pub === contactOrGroupId);
    const group = state.groups.find(g => g.id === contactOrGroupId);

    if (contact) {
      // Direct messages with this contact
      return state.messages.filter(m =>
        m.packet.senderPub === contact.ed25519Pub ||
        (m.isOutbound && m.packet.keyEnvelopes.some(e => e.rcptPub === contact.x25519Pub))
      );
    } else if (group) {
      // Group messages
      return state.messages.filter(m =>
        group.memberPubs.includes(m.packet.senderPub) ||
        (m.isOutbound && m.packet.keyEnvelopes.some(e => group.memberPubs.includes(e.rcptPub)))
      );
    }

    return [];
  });
}

// Utility hook for unread message count
export function useUnreadCount() {
  return useResQLinkStore(state =>
    state.messages.filter(m => !m.isOutbound && !m.packet.id.includes('read')).length
  );
}
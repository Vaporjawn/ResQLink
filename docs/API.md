# API Documentation

## Core Schemas

This document provides an overview of the core data schemas used in the ResQLink application.

### MeshPacket

The `MeshPacket` interface defines the structure of a message packet that is transmitted over the mesh network.

```typescript
export interface MeshPacket {
  id: string; // UUID v4 for deduplication and ACK correlation
  ver: number; // Protocol version for compatibility
  type: MsgType; // Message type classification
  ts: number; // Unix timestamp in milliseconds
  ttl: number; // Time-to-live, decremented on each hop (1-8)
  senderPub: string; // Base64 Ed25519 public key of original sender
  keyEnvelopes: KeyEnvelope[]; // Array of encrypted message keys, one per intended recipient
  ciphertext: string; // Base64 encrypted message body (XSalsa20-Poly1305)
  sig: string; // Base64 Ed25519 signature over canonical JSON (excluding this field)
}
```

**Example:**

```json
{
  "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "ver": 1,
  "type": "TEXT",
  "ts": 1678886400000,
  "ttl": 5,
  "senderPub": "...",
  "keyEnvelopes": [
    {
      "rcptPub": "...",
      "box": "..."
    }
  ],
  "ciphertext": "...",
  "sig": "..."
}
```

### MsgBody

The `MsgBody` interface defines the structure of the decrypted message content.

```typescript
export interface MsgBody {
  text?: string; // Message text content (≤280 chars for TEXT, emergency info for SOS)
  lat?: number; // WGS-84 latitude coordinate
  lon?: number; // WGS-84 longitude coordinate
  extras?: Record<string, unknown>; // Additional data for RESOURCE messages or extensions
  inReplyTo?: string; // For ACK messages - the message ID being acknowledged
}
```

### KeyEnvelope

The `KeyEnvelope` interface defines the structure of an encrypted key envelope for a single recipient.

```typescript
export interface KeyEnvelope {
  rcptPub: string; // Base64 encoded Curve25519 recipient public key
  box: string; // Base64 encoded sealed box of message key for recipient (X25519->XSalsa20-Poly1305)
}
```

### Contact

The `Contact` interface defines the structure of a contact in the user's contact list.

```typescript
export interface Contact {
  alias: string; // User-assigned alias for the contact
  ed25519Pub: string; // Base64 Ed25519 public key for signature verification
  x25519Pub: string; // Base64 X25519 public key for encryption
  fingerprint: string; // First 12 characters of base32 encoded pubkey for UI display
  addedAt: number; // When this contact was added
  trustLevel: TrustLevel; // Trust level for this contact
  isEmergencyContact: boolean; // Whether this contact is marked as emergency contact
  notes?: string; // Optional notes about this contact
}
```

### AppSettings

The `AppSettings` interface defines the structure of the application settings.

```typescript
export interface AppSettings {
  userAlias: string; // User's display alias
  language: 'en' | 'ur'; // Language preference
  includeLocationDefault: boolean; // Include location in messages by default
  highContrast: boolean; // High contrast mode for accessibility
  gatewayEnabled: boolean; // Gateway uplink enabled
  gatewayConfig?: { // Twilio configuration (if gateway enabled)
    accountSid: string;
    authToken: string;
    fromNumber: string;
    emergencyContacts: string[];
  };
  relayMode: { // Relay mode settings
    enabled: boolean;
    dutyCycleMs: number;
    batteryThreshold: number;
  };
}
```

---

## Services

### LocationService

The `LocationService` is responsible for managing the device's GPS location.

**Methods:**

*   `startTracking()`: Starts tracking the device's location.
*   `stopTracking()`: Stops tracking the device's location.
*   `getCurrentLocation()`: Returns the most recent location of the device.

### EmergencyBroadcastService

The `EmergencyBroadcastService` is responsible for creating and broadcasting emergency alerts.

**Methods:**

*   `broadcastEmergency(alert: EmergencyAlert)`: Broadcasts an emergency alert to all nearby users.
*   `subscribeToChannel(channel: BroadcastChannel, callback: (alert: EmergencyAlert) => void)`: Subscribes to a broadcast channel to receive emergency alerts.

### MessageProcessor

The `MessageProcessor` is responsible for handling incoming and outgoing messages, including encryption, decryption, and routing.

**Encryption/Decryption Flow:**

1.  **Encryption**: When a message is sent, the `MessageProcessor` encrypts the message content and creates a `MeshPacket`.
2.  **Decryption**: When a `MeshPacket` is received, the `MessageProcessor` attempts to decrypt the message using the user's private key.

**Routing:**

The `MessageProcessor` is responsible for routing messages through the mesh network. It uses a flooding-based routing algorithm to ensure that messages reach their destination.

**Delivery Tracking:**

The `MessageProcessor` tracks the delivery status of each message. When a message is successfully delivered, it is marked as `acked`.

---

## Zustand Store

The Zustand store (`src/lib/store.ts`) is the single source of truth for the application state.

### State Shape

```typescript
export interface ResQLinkState {
  keyPair: KeyPair | null;
  contacts: Contact[];
  groups: Group[];
  messages: StoredMessage[];
  meshStatus: MeshStatus;
  currentLocation: {
    lat: number;
    lon: number;
  } | null;
}
```

### Actions

*   `generateKeyPair()`: Generates a new key pair for the user.
*   `addContact(alias: string, ed25519Pub: string, x25519Pub: string)`: Adds a new contact.
*   `removeContact(ed25519Pub: string)`: Removes a contact.
*   `updateContact(ed25519Pub: string, data: Partial<Contact>)`: Updates a contact.
*   `createGroup(name: string, memberPubs: string[])`: Creates a new group.
*   `updateGroup(id: string, data: Partial<Group>)`: Updates a group.
*   `removeGroup(id: string)`: Removes a group.
*   `sendMessage(type: MsgType, body: MsgBody, recipients: string[])`: Sends a message.
*   `receiveMessage(packet: MeshPacket)`: Handles a received message.
*   `updateLocation(lat: number, lon: number)`: Updates the user's location.

### Usage with Hooks

```typescript
import { useResQLinkStore } from '../lib/store';

const MyComponent = () => {
  const messages = useResQLinkStore(state => state.messages);
  const sendMessage = useResQLinkStore(state => state.sendMessage);

  // ...
};
```

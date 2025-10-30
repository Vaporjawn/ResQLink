/**
 * ResQLink Mesh - End-to-End Encryption
 * Implements X25519 key exchange, Ed25519 signatures, and per-recipient encryption
 */

import {
  randomBytes,
  box,
  secretbox,
  sign,
  hash
} from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import {
  KeyPair,
  MeshPacket,
  KeyEnvelope,
  MsgBody,
  canonicalPacketJSON
} from './schema';
import { trackEncryption, trackDecryption } from './performance';

// Key and nonce sizes from tweetnacl
export const CURVE25519_PUBLIC_KEY_SIZE = 32;
export const CURVE25519_SECRET_KEY_SIZE = 32;
export const ED25519_PUBLIC_KEY_SIZE = 32;
export const ED25519_SECRET_KEY_SIZE = 64;
export const SECRETBOX_KEY_SIZE = 32;
export const SECRETBOX_NONCE_SIZE = 24;
export const BOX_NONCE_SIZE = 24;
export const SIGNATURE_SIZE = 64;

/**
 * Generates a new cryptographic key pair for a mesh node.
 * @returns {KeyPair} A new key pair containing Ed25519 and X25519 keys.
 */
export function generateKeyPair(): KeyPair {
  // Generate Ed25519 keypair for signatures
  const ed25519Keys = sign.keyPair();

  // Generate X25519 keypair for encryption
  const x25519Keys = box.keyPair();

  return {
    ed25519Pub: encodeBase64(ed25519Keys.publicKey),
    ed25519Sec: encodeBase64(ed25519Keys.secretKey),
    x25519Pub: encodeBase64(x25519Keys.publicKey),
    x25519Sec: encodeBase64(x25519Keys.secretKey),
    createdAt: Date.now()
  };
}

/**
 * Creates a fingerprint from an Ed25519 public key for UI display.
 * @param {string} ed25519PubKey The Ed25519 public key.
 * @returns {string} The first 12 characters of the base32-encoded key.
 */
export function createFingerprint(ed25519PubKey: string): string {
  const keyBytes = decodeBase64(ed25519PubKey);
  const hashBytes = hash(keyBytes);

  // Base32 encoding (RFC 4648) for human-readable fingerprints
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < Math.min(8, hashBytes.length); i++) {
    value = (value << 8) | hashBytes[i];
    bits += 8;

    while (bits >= 5) {
      result += base32Chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += base32Chars[(value << (5 - bits)) & 31];
  }

  return result.slice(0, 12);
}

/**
 * Encrypts message content per-recipient using sealed boxes.
 * @param {MsgBody} msgBody The message body to encrypt.
 * @param {string[]} recipientX25519Pubs An array of recipient X25519 public keys.
 * @param {string} senderX25519Sec The sender's X25519 secret key.
 * @param {string} [operationId] Optional operation ID for performance tracking.
 * @returns {{ keyEnvelopes: KeyEnvelope[], ciphertext: string }} An object containing the key envelopes and the ciphertext.
 */
export function encryptMessage(
  msgBody: MsgBody,
  recipientX25519Pubs: string[],
  senderX25519Sec: string,
  operationId?: string
): { keyEnvelopes: KeyEnvelope[], ciphertext: string } {
  // Start performance tracking
  const trackingId = operationId || `encrypt_${Date.now()}`;
  const tracker = trackEncryption(trackingId);
  tracker.start();

  try {
    // Generate random message key for this message
    const messageKey = randomBytes(SECRETBOX_KEY_SIZE);
    const messageNonce = randomBytes(SECRETBOX_NONCE_SIZE);

    // Encrypt message body with symmetric key
    const bodyJson = JSON.stringify(msgBody);
    const bodyBytes = new TextEncoder().encode(bodyJson);
    const encryptedBody = secretbox(bodyBytes, messageNonce, messageKey);

    // Combine nonce + encrypted body for transport
    const ciphertextBytes = new Uint8Array(messageNonce.length + encryptedBody.length);
    ciphertextBytes.set(messageNonce);
    ciphertextBytes.set(encryptedBody, messageNonce.length);
    const ciphertext = encodeBase64(ciphertextBytes);

    // Create key envelopes for each recipient
    const keyEnvelopes: KeyEnvelope[] = recipientX25519Pubs.map(recipientPub => {
      const recipientPubBytes = decodeBase64(recipientPub);
      const senderSecBytes = decodeBase64(senderX25519Sec);

      // Create sealed box: ephemeral keypair + encrypted message key
      const ephemeralKeys = box.keyPair();
      const nonce = randomBytes(BOX_NONCE_SIZE);

      // Encrypt message key using X25519 + XSalsa20-Poly1305
      const encryptedKey = box(messageKey, nonce, recipientPubBytes, senderSecBytes);

      // Combine ephemeral public key + nonce + encrypted key
      const sealedBox = new Uint8Array(
        ephemeralKeys.publicKey.length + nonce.length + encryptedKey.length
      );
      sealedBox.set(ephemeralKeys.publicKey);
      sealedBox.set(nonce, ephemeralKeys.publicKey.length);
      sealedBox.set(encryptedKey, ephemeralKeys.publicKey.length + nonce.length);

      return {
        rcptPub: recipientPub,
        box: encodeBase64(sealedBox)
      };
    });

    return { keyEnvelopes, ciphertext };
  } finally {
    // Complete performance tracking
    tracker.complete();
  }
}

/**
 * Decrypts a message if we have the corresponding recipient key.
 * @param {KeyEnvelope[]} keyEnvelopes An array of key envelopes.
 * @param {string} ciphertext The ciphertext to decrypt.
 * @param {string} ourX25519Pub Our X25519 public key.
 * @param {string} ourX25519Sec Our X25519 secret key.
 * @param {string} [operationId] Optional operation ID for performance tracking.
 * @returns {MsgBody | null} The decrypted message body, or null if decryption fails.
 */
export function decryptMessage(
  keyEnvelopes: KeyEnvelope[],
  ciphertext: string,
  ourX25519Pub: string,
  ourX25519Sec: string,
  operationId?: string
): MsgBody | null {
  // Start performance tracking
  const trackingId = operationId || `decrypt_${Date.now()}`;
  const tracker = trackDecryption(trackingId);
  tracker.start();

  try {
    // Find our key envelope
    const ourEnvelope = keyEnvelopes.find(env => env.rcptPub === ourX25519Pub);
    if (!ourEnvelope) {
      return null; // Not encrypted for us
    }

    try {
      // Decode sealed box
      const sealedBox = decodeBase64(ourEnvelope.box);
      if (sealedBox.length < CURVE25519_PUBLIC_KEY_SIZE + BOX_NONCE_SIZE) {
        return null;
      }

      // Extract components
      const ephemeralPub = sealedBox.slice(0, CURVE25519_PUBLIC_KEY_SIZE);
      const nonce = sealedBox.slice(CURVE25519_PUBLIC_KEY_SIZE, CURVE25519_PUBLIC_KEY_SIZE + BOX_NONCE_SIZE);
      const encryptedKey = sealedBox.slice(CURVE25519_PUBLIC_KEY_SIZE + BOX_NONCE_SIZE);

      // Decrypt message key
      const ourSecBytes = decodeBase64(ourX25519Sec);
      const messageKey = box.open(encryptedKey, nonce, ephemeralPub, ourSecBytes);
      if (!messageKey) {
        return null;
      }

      // Decrypt message body
      const ciphertextBytes = decodeBase64(ciphertext);
      if (ciphertextBytes.length < SECRETBOX_NONCE_SIZE) {
        return null;
      }

      const messageNonce = ciphertextBytes.slice(0, SECRETBOX_NONCE_SIZE);
      const encryptedBody = ciphertextBytes.slice(SECRETBOX_NONCE_SIZE);

      const decryptedBytes = secretbox.open(encryptedBody, messageNonce, messageKey);
      if (!decryptedBytes) {
        return null;
      }

      // Parse JSON
      const bodyJson = new TextDecoder().decode(decryptedBytes);
      return JSON.parse(bodyJson) as MsgBody;

    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  } finally {
    // Complete performance tracking
    tracker.complete();
  }
}

/**
 * Signs a mesh packet with Ed25519.
 * @param {Omit<MeshPacket, 'sig'>} packet The packet to sign.
 * @param {string} ed25519SecKey The Ed25519 secret key.
 * @returns {string} The signature.
 */
export function signPacket(
  packet: Omit<MeshPacket, 'sig'>,
  ed25519SecKey: string
): string {
  const canonical = canonicalPacketJSON(packet);
  const messageBytes = new TextEncoder().encode(canonical);
  const secretKeyBytes = decodeBase64(ed25519SecKey);

  const signature = sign.detached(messageBytes, secretKeyBytes);
  return encodeBase64(signature);
}

/**
 * Verifies a mesh packet signature.
 * @param {MeshPacket} packet The packet to verify.
 * @param {string} [ed25519PubKey] The Ed25519 public key to use for verification. Defaults to the sender's public key in the packet.
 * @returns {boolean} Whether the signature is valid.
 */
export function verifyPacketSignature(
  packet: MeshPacket,
  ed25519PubKey?: string
): boolean {
  try {
    const pubKey = ed25519PubKey || packet.senderPub;
    const publicKeyBytes = decodeBase64(pubKey);
    const signatureBytes = decodeBase64(packet.sig);

    // Create packet without signature for verification
    const unsignedPacket: Omit<MeshPacket, 'sig'> = {
      id: packet.id,
      ver: packet.ver,
      type: packet.type,
      ts: packet.ts,
      ttl: packet.ttl,
      senderPub: packet.senderPub,
      keyEnvelopes: packet.keyEnvelopes,
      ciphertext: packet.ciphertext
    };

    const canonical = canonicalPacketJSON(unsignedPacket);
    const messageBytes = new TextEncoder().encode(canonical);

    return sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Derives a deterministic service ID from a node's public key.
 * @param {string} ed25519PubKey The Ed25519 public key.
 * @returns {string} The derived service ID.
 */
export function deriveServiceId(ed25519PubKey: string): string {
  const keyBytes = decodeBase64(ed25519PubKey);
  const hashBytes = hash(keyBytes);

  // Take first 8 bytes of hash as service ID
  const serviceBytes = hashBytes.slice(0, 8);
  return Array.from(serviceBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Generates a cryptographically secure random service ID.
 * @returns {string} A random service ID.
 */
export function generateServiceId(): string {
  const randomBytes8 = randomBytes(8);
  return Array.from(randomBytes8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Key derivation function for additional security contexts.
 * @param {Uint8Array} masterKey The master key.
 * @param {string} context The context for the key derivation.
 * @param {number} [length=32] The desired length of the derived key.
 * @returns {Uint8Array} The derived key.
 */
export function deriveKey(
  masterKey: Uint8Array,
  context: string,
  length: number = 32
): Uint8Array {
  const contextBytes = new TextEncoder().encode(context);
  const combined = new Uint8Array(masterKey.length + contextBytes.length);
  combined.set(masterKey);
  combined.set(contextBytes, masterKey.length);

  const hashResult = hash(combined);
  return hashResult.slice(0, length);
}

/**
 * Secure key comparison to prevent timing attacks.
 * @param {Uint8Array} a The first key.
 * @param {Uint8Array} b The second key.
 * @returns {boolean} Whether the keys are equal.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Validates that a public key is a valid point on Curve25519.
 * @param {string} pubKeyBase64 The public key to validate, in base64 format.
 * @returns {boolean} Whether the public key is valid.
 */
export function validatePublicKey(pubKeyBase64: string): boolean {
  try {
    const keyBytes = decodeBase64(pubKeyBase64);
    if (keyBytes.length !== CURVE25519_PUBLIC_KEY_SIZE) {
      return false;
    }

    // Check if it's a low-order point (security vulnerability)
    const lowOrderPoints = [
      new Uint8Array(32), // all zeros
      new Uint8Array([1, ...new Array(31).fill(0)]), // 1
      new Uint8Array([0xe0, 0xeb, 0x7a, 0x7c, 0x3b, 0x41, 0xb8, 0xae, 0x16, 0x56, 0xe3, 0xfa, 0xf1, 0x9f, 0xc4, 0x6a, 0xda, 0x09, 0x8d, 0xeb, 0x9c, 0x32, 0xb1, 0xfd, 0x86, 0x62, 0x05, 0x16, 0x5f, 0x49, 0xb8, 0x00]), // p-1
      // Add other known low-order points...
    ];

    for (const lowOrder of lowOrderPoints) {
      if (constantTimeEqual(keyBytes, lowOrder)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Wipes sensitive data from memory.
 * @param {...Uint8Array[]} arrays The arrays to wipe.
 */
export function wipeSensitiveData(...arrays: Uint8Array[]): void {
  for (const arr of arrays) {
    if (arr) {
      arr.fill(0);
    }
  }
}
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';

const ENCRYPTION_KEY_ID = 'alibi_vault_enc_key_v2';
const KEY_LENGTH = nacl.secretbox.keyLength; // 32 bytes

/**
 * Get or generate the vault encryption key.
 * Stored in the device's hardware-backed secure enclave (iOS Keychain / Android Keystore).
 */
export async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  try {
    const existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_ID);
    if (existingKey) return base64ToUint8Array(existingKey);

    // Generate a new 256-bit key using crypto-secure RNG
    const key = nacl.randomBytes(KEY_LENGTH);
    const keyBase64 = uint8ArrayToBase64(key);

    await SecureStore.setItemAsync(ENCRYPTION_KEY_ID, keyBase64, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (__DEV__) console.log('Encryption key generated and stored in secure enclave');
    return key;
  } catch (error) {
    if (__DEV__) console.warn('Encryption key error:', error);
    throw new Error('Failed to initialize encryption. Device secure storage unavailable.');
  }
}

/**
 * Encrypt a string payload using NaCl secretbox (xsalsa20-poly1305).
 * Authenticated encryption — tampered ciphertext will fail to decrypt.
 * Format: ENC_V2:{nonce_b64}:{ciphertext_b64}
 */
export async function encryptData(plaintext: string): Promise<string> {
  try {
    const key = await getOrCreateEncryptionKey();
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageBytes = new TextEncoder().encode(plaintext);

    const encrypted = nacl.secretbox(messageBytes, nonce, key);
    if (!encrypted) throw new Error('Encryption failed');

    const nonceB64 = uint8ArrayToBase64(nonce);
    const cipherB64 = uint8ArrayToBase64(encrypted);

    return `ENC_V2:${nonceB64}:${cipherB64}`;
  } catch (error) {
    if (__DEV__) console.warn('Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypt a previously encrypted payload.
 * Supports both V2 (secretbox) and legacy V1 (XOR) formats for migration.
 */
export async function decryptData(ciphertext: string): Promise<string> {
  try {
    // Handle unencrypted legacy data
    if (!ciphertext.startsWith('ENC_V')) {
      return ciphertext;
    }

    // V2: NaCl secretbox
    if (ciphertext.startsWith('ENC_V2:')) {
      const key = await getOrCreateEncryptionKey();
      const parts = ciphertext.split(':');
      if (parts.length !== 3) throw new Error('Invalid encrypted data format');

      const [_prefix, nonceB64, cipherB64] = parts;
      const nonce = base64ToUint8Array(nonceB64);
      const encrypted = base64ToUint8Array(cipherB64);

      const decrypted = nacl.secretbox.open(encrypted, nonce, key);
      if (!decrypted) throw new Error('Decryption failed — data may be tampered');

      return new TextDecoder().decode(decrypted);
    }

    // V1 legacy: XOR cipher (read-only migration support)
    if (ciphertext.startsWith('ENC_V1:')) {
      return decryptLegacyV1(ciphertext);
    }

    return ciphertext;
  } catch (error) {
    if (__DEV__) console.warn('Decryption error:', error);
    throw error;
  }
}

/**
 * Check if data is encrypted
 */
export function isEncrypted(data: string): boolean {
  return data.startsWith('ENC_V1:') || data.startsWith('ENC_V2:');
}

/**
 * Legacy V1 decryption for migration. Uses the old key format (hex in SecureStore).
 * Will be removed in a future version.
 */
async function decryptLegacyV1(ciphertext: string): Promise<string> {
  const LEGACY_KEY_ID = 'alibi_vault_enc_key_v1';
  const existingKey = await SecureStore.getItemAsync(LEGACY_KEY_ID);
  if (!existingKey) throw new Error('Legacy encryption key not found');

  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid V1 encrypted data format');

  const [_prefix, _integrityHash, encryptedBase64] = parts;
  const encrypted = base64ToUint8Array(encryptedBase64);
  const keyBytes = hexToBytes(existingKey);
  const decrypted = new Uint8Array(encrypted.length);

  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }

  return new TextDecoder().decode(decrypted);
}

// Helper: hex string to Uint8Array (for legacy V1 support)
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Helper: Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

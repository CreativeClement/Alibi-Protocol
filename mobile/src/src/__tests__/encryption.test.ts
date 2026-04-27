import { isEncrypted, encryptData, decryptData, getOrCreateEncryptionKey } from '../services/encryption';
import * as SecureStore from 'expo-secure-store';
import { __resetStore as resetSecureStore } from 'expo-secure-store';

describe('encryption service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSecureStore();
  });

  // ================================================================
  // isEncrypted — prefix detection
  // ================================================================
  describe('isEncrypted', () => {
    it('returns true for ENC_V1 prefixed data', () => {
      expect(isEncrypted('ENC_V1:abc123:base64data')).toBe(true);
    });

    it('returns true for ENC_V2 prefixed data (secretbox)', () => {
      expect(isEncrypted('ENC_V2:nonce:ciphertext')).toBe(true);
    });

    it('returns false for plain JSON data', () => {
      expect(isEncrypted('{"key":"value"}')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('returns false for unsupported version prefixes', () => {
      expect(isEncrypted('ENC_V3:data')).toBe(false);
      expect(isEncrypted('ENCRYPTED:data')).toBe(false);
      expect(isEncrypted('ENC_:data')).toBe(false);
    });

    it('returns true even with minimal prefix (no content after colon)', () => {
      expect(isEncrypted('ENC_V1:')).toBe(true);
      expect(isEncrypted('ENC_V2:')).toBe(true);
    });
  });

  // ================================================================
  // getOrCreateEncryptionKey
  // ================================================================
  describe('getOrCreateEncryptionKey', () => {
    it('generates a 32-byte key on first call', async () => {
      const key = await getOrCreateEncryptionKey();

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32); // nacl.secretbox.keyLength
    });

    it('returns the same key on subsequent calls', async () => {
      const key1 = await getOrCreateEncryptionKey();
      const key2 = await getOrCreateEncryptionKey();

      // Both should be the same bytes (loaded from SecureStore)
      expect(Buffer.from(key1).toString('base64')).toBe(
        Buffer.from(key2).toString('base64')
      );
    });

    it('stores the key in SecureStore', async () => {
      await getOrCreateEncryptionKey();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'alibi_vault_enc_key_v2',
        expect.any(String),
        expect.objectContaining({
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        })
      );
    });

    it('throws when SecureStore is unavailable', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Secure storage unavailable')
      );

      await expect(getOrCreateEncryptionKey()).rejects.toThrow(
        'Failed to initialize encryption'
      );
    });
  });

  // ================================================================
  // encryptData — V2 secretbox
  // ================================================================
  describe('encryptData', () => {
    it('produces output with ENC_V2 prefix', async () => {
      const result = await encryptData('Hello, World!');
      expect(result.startsWith('ENC_V2:')).toBe(true);
    });

    it('produces three colon-separated parts (prefix, nonce, ciphertext)', async () => {
      const result = await encryptData('test data');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('ENC_V2');
      expect(parts[1].length).toBeGreaterThan(0); // nonce (base64)
      expect(parts[2].length).toBeGreaterThan(0); // ciphertext (base64)
    });

    it('produces different ciphertext for same input (random nonce)', async () => {
      const result1 = await encryptData('same input');
      const result2 = await encryptData('same input');

      // Nonces should differ (random), so full output differs
      expect(result1).not.toBe(result2);
    });

    it('encrypts empty string without error', async () => {
      const result = await encryptData('');
      expect(result.startsWith('ENC_V2:')).toBe(true);
    });

    it('encrypts large payloads', async () => {
      const largePayload = JSON.stringify(
        Array.from({ length: 100 }, (_, i) => ({
          id: `inc_${i}`,
          hash: 'a'.repeat(64),
          description: `Incident number ${i}`,
        }))
      );
      const result = await encryptData(largePayload);
      expect(result.startsWith('ENC_V2:')).toBe(true);
    });

    it('handles unicode content', async () => {
      const result = await encryptData('Rights: 4th Amendment 🔒 §1983');
      expect(result.startsWith('ENC_V2:')).toBe(true);
    });
  });

  // ================================================================
  // decryptData — V2 secretbox round-trip
  // ================================================================
  describe('decryptData', () => {
    it('round-trips: encrypt then decrypt returns original', async () => {
      const original = 'Fourth Amendment protection against unreasonable search';
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);

      expect(decrypted).toBe(original);
    });

    it('round-trips JSON payloads', async () => {
      const original = JSON.stringify({
        id: 'inc_001',
        hash: 'abc123',
        state: 'NH',
        timestamp: 1711300000000,
      });
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);

      expect(JSON.parse(decrypted)).toEqual(JSON.parse(original));
    });

    it('round-trips empty string', async () => {
      const encrypted = await encryptData('');
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe('');
    });

    it('round-trips unicode content', async () => {
      const original = 'Miranda rights: "You have the right to remain silent" — §1983 🔒';
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe(original);
    });

    it('returns unencrypted data as-is (migration support)', async () => {
      const plainData = '{"key":"value"}';
      const result = await decryptData(plainData);
      expect(result).toBe(plainData);
    });

    it('throws on tampered ciphertext', async () => {
      const encrypted = await encryptData('sensitive data');
      const parts = encrypted.split(':');
      // Tamper with ciphertext (flip a character)
      const tampered = `${parts[0]}:${parts[1]}:TAMPERED${parts[2].slice(8)}`;

      await expect(decryptData(tampered)).rejects.toThrow();
    });

    it('throws on corrupted nonce', async () => {
      const encrypted = await encryptData('sensitive data');
      const parts = encrypted.split(':');
      const corrupted = `${parts[0]}:BADNONCE:${parts[2]}`;

      await expect(decryptData(corrupted)).rejects.toThrow();
    });

    it('throws on V1 data without legacy key', async () => {
      // V1 format with no legacy key in SecureStore
      const v1Data = 'ENC_V1:integrityhash:base64payload';
      await expect(decryptData(v1Data)).rejects.toThrow('Legacy encryption key not found');
    });

    it('throws on malformed V2 data (missing parts)', async () => {
      await expect(decryptData('ENC_V2:onlyonepart')).rejects.toThrow(
        'Invalid encrypted data format'
      );
    });
  });

  // ================================================================
  // Cross-version compatibility
  // ================================================================
  describe('version detection', () => {
    it('isEncrypted correctly identifies encryptData output', async () => {
      const encrypted = await encryptData('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('isEncrypted returns false for decrypted output', async () => {
      const encrypted = await encryptData('plain text');
      const decrypted = await decryptData(encrypted);
      expect(isEncrypted(decrypted)).toBe(false);
    });
  });
});

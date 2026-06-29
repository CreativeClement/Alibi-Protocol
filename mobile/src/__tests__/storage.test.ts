import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { __resetStore as resetSecureStore } from 'expo-secure-store';
import {
  saveIncident,
  getIncidents,
  updateIncidentTxSignature,
  deleteIncident,
  getDePINEarnings,
  addDePINEarnings,
  saveWalletPublicKey,
  getWalletPublicKey,
  saveVaultEncryptionKey,
  getVaultEncryptionKey,
  clearAllData,
} from '../services/storage';

// Mock encryption module — bypass real encryption for isolated storage testing
jest.mock('../services/encryption', () => ({
  encryptData: jest.fn((data: string) => Promise.resolve(`MOCK_ENC:${data}`)),
  decryptData: jest.fn((data: string) =>
    Promise.resolve(data.startsWith('MOCK_ENC:') ? data.slice(9) : data)
  ),
}));

const VAULT_KEY = 'alibi_vault_incidents';
const DEPIN_KEY = 'alibi_depin_earnings';
const WALLET_KEY = 'alibi_wallet_pubkey';
const SECURE_VAULT_KEY = 'alibi_vault_encryption_key';

function makeIncident(overrides: Partial<import('../types').VaultIncident> = {}): import('../types').VaultIncident {
  return {
    id: 'inc_001',
    timestamp: 1711300000000,
    hash: 'abc123def456',
    recordingPath: '/recordings/session_001.m4a',
    description: 'Traffic stop on I-95',
    state: 'NH',
    duration: 120,
    onChainStatus: 'pending',
    latitude: 42.9956,
    longitude: -71.4548,
    speed: 55,
    ...overrides,
  };
}

describe('storage service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.clear as jest.Mock)();
    resetSecureStore();
  });

  // ================================================================
  // Vault Incident CRUD
  // ================================================================
  describe('saveIncident', () => {
    it('saves a new incident to encrypted storage', async () => {
      const incident = makeIncident();
      await saveIncident(incident);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        VAULT_KEY,
        expect.stringContaining('MOCK_ENC:')
      );
      // Verify the encrypted payload contains the serialized incident
      const savedValue = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      expect(savedValue).toContain('"inc_001"');
    });

    it('appends to existing incidents without losing data', async () => {
      const first = makeIncident({ id: 'inc_001' });
      const second = makeIncident({ id: 'inc_002', description: 'Second stop' });

      await saveIncident(first);
      await saveIncident(second);

      const incidents = await getIncidents();
      expect(incidents).toHaveLength(2);
      expect(incidents[0].id).toBe('inc_001');
      expect(incidents[1].id).toBe('inc_002');
    });

    it('propagates errors from AsyncStorage', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));

      await expect(saveIncident(makeIncident())).rejects.toThrow('Storage full');
    });
  });

  describe('getIncidents', () => {
    it('returns empty array when no incidents stored', async () => {
      const result = await getIncidents();
      expect(result).toEqual([]);
    });

    it('returns all saved incidents', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await saveIncident(makeIncident({ id: 'inc_002' }));
      await saveIncident(makeIncident({ id: 'inc_003' }));

      const result = await getIncidents();
      expect(result).toHaveLength(3);
    });

    it('returns empty array on storage read error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Read error'));

      const result = await getIncidents();
      expect(result).toEqual([]);
    });

    it('preserves all incident fields through save/get cycle', async () => {
      const incident = makeIncident({
        txSignature: 'sig_abc',
        videoPath: '/recordings/video_001.mp4',
        onChainStatus: 'confirmed',
      });
      await saveIncident(incident);

      const [result] = await getIncidents();
      expect(result.id).toBe('inc_001');
      expect(result.hash).toBe('abc123def456');
      expect(result.txSignature).toBe('sig_abc');
      expect(result.videoPath).toBe('/recordings/video_001.mp4');
      expect(result.onChainStatus).toBe('confirmed');
      expect(result.state).toBe('NH');
      expect(result.latitude).toBe(42.9956);
      expect(result.longitude).toBe(-71.4548);
      expect(result.speed).toBe(55);
      expect(result.duration).toBe(120);
    });
  });

  describe('updateIncidentTxSignature', () => {
    it('updates tx signature and status on matching incident', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await updateIncidentTxSignature('inc_001', 'tx_sig_xyz', 'confirmed');

      const [updated] = await getIncidents();
      expect(updated.txSignature).toBe('tx_sig_xyz');
      expect(updated.onChainStatus).toBe('confirmed');
    });

    it('does not modify non-matching incidents', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await saveIncident(makeIncident({ id: 'inc_002', description: 'Other stop' }));

      await updateIncidentTxSignature('inc_001', 'tx_sig_xyz', 'confirmed');

      const incidents = await getIncidents();
      const other = incidents.find((i) => i.id === 'inc_002');
      expect(other?.txSignature).toBeUndefined();
      expect(other?.onChainStatus).toBe('pending');
    });

    it('handles update on non-existent id gracefully', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await updateIncidentTxSignature('nonexistent', 'tx_sig', 'confirmed');

      const incidents = await getIncidents();
      expect(incidents).toHaveLength(1);
      expect(incidents[0].txSignature).toBeUndefined();
    });

    it('can update to failed status', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await updateIncidentTxSignature('inc_001', '', 'failed');

      const [updated] = await getIncidents();
      expect(updated.onChainStatus).toBe('failed');
    });

    it('propagates errors from AsyncStorage write', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      // First getItem call (inside update) works, second setItem fails
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Write error'));

      await expect(
        updateIncidentTxSignature('inc_001', 'tx', 'confirmed')
      ).rejects.toThrow('Write error');
    });
  });

  describe('deleteIncident', () => {
    it('removes the specified incident', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await saveIncident(makeIncident({ id: 'inc_002' }));

      await deleteIncident('inc_001');

      const incidents = await getIncidents();
      expect(incidents).toHaveLength(1);
      expect(incidents[0].id).toBe('inc_002');
    });

    it('handles deletion of non-existent id without error', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await deleteIncident('nonexistent');

      const incidents = await getIncidents();
      expect(incidents).toHaveLength(1);
    });

    it('can delete all incidents leaving empty array', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      await deleteIncident('inc_001');

      const incidents = await getIncidents();
      expect(incidents).toEqual([]);
    });

    it('propagates errors from AsyncStorage', async () => {
      await saveIncident(makeIncident({ id: 'inc_001' }));
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Delete error'));

      await expect(deleteIncident('inc_001')).rejects.toThrow('Delete error');
    });
  });

  // ================================================================
  // DePIN Earnings
  // ================================================================
  describe('getDePINEarnings', () => {
    it('returns default zero earnings when nothing stored', async () => {
      const result = await getDePINEarnings();
      expect(result).toEqual({
        dailyEarned: 0,
        totalEarned: 0,
        lastEarnTime: 0,
        dailyEarnCount: 0,
      });
    });

    it('returns stored earnings', async () => {
      const earnings = {
        dailyEarned: 5.5,
        totalEarned: 100.25,
        lastEarnTime: 1711300000000,
        dailyEarnCount: 11,
      };
      await AsyncStorage.setItem(DEPIN_KEY, JSON.stringify(earnings));

      const result = await getDePINEarnings();
      expect(result).toEqual(earnings);
    });

    it('returns default on storage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Read error'));

      const result = await getDePINEarnings();
      expect(result.totalEarned).toBe(0);
    });
  });

  describe('addDePINEarnings', () => {
    it('adds earnings from zero state', async () => {
      const result = await addDePINEarnings(0.5);

      expect(result.dailyEarned).toBe(0.5);
      expect(result.totalEarned).toBe(0.5);
      expect(result.dailyEarnCount).toBe(1);
      expect(result.lastEarnTime).toBeGreaterThan(0);
    });

    it('accumulates earnings within same day', async () => {
      await addDePINEarnings(0.5);
      const result = await addDePINEarnings(0.3);

      expect(result.dailyEarned).toBe(0.8);
      expect(result.totalEarned).toBe(0.8);
      expect(result.dailyEarnCount).toBe(2);
    });

    it('resets daily earnings on new calendar day', async () => {
      // Simulate earnings from yesterday (just before midnight)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 0, 0);

      const oldEarnings = {
        dailyEarned: 5.0,
        totalEarned: 50.0,
        lastEarnTime: yesterday.getTime(),
        dailyEarnCount: 10,
      };
      await AsyncStorage.setItem(DEPIN_KEY, JSON.stringify(oldEarnings));

      const result = await addDePINEarnings(0.5);

      expect(result.dailyEarned).toBe(0.5); // Reset to just this earn
      expect(result.totalEarned).toBe(50.5); // Total still accumulates
      expect(result.dailyEarnCount).toBe(1); // Reset count
    });

    it('does NOT reset daily earnings for earns on same calendar day', async () => {
      // Simulate earnings from earlier today (e.g. 1 hour ago, same calendar day)
      const earlierToday = new Date();
      earlierToday.setHours(earlierToday.getHours() - 1);

      const oldEarnings = {
        dailyEarned: 3.0,
        totalEarned: 30.0,
        lastEarnTime: earlierToday.getTime(),
        dailyEarnCount: 6,
      };
      await AsyncStorage.setItem(DEPIN_KEY, JSON.stringify(oldEarnings));

      const result = await addDePINEarnings(0.5);

      expect(result.dailyEarned).toBe(3.5); // Accumulated, not reset
      expect(result.totalEarned).toBe(30.5);
      expect(result.dailyEarnCount).toBe(7); // Incremented, not reset
    });

    it('returns default on storage write error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Write error'));

      const result = await addDePINEarnings(0.5);
      expect(result.totalEarned).toBe(0);
    });

    it('persists earnings to AsyncStorage', async () => {
      await addDePINEarnings(1.0);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        DEPIN_KEY,
        expect.any(String)
      );
    });
  });

  // ================================================================
  // Wallet Storage
  // ================================================================
  describe('saveWalletPublicKey', () => {
    it('saves public key string to AsyncStorage', async () => {
      await saveWalletPublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        WALLET_KEY,
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      );
    });

    it('propagates errors from AsyncStorage', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Save error'));

      await expect(
        saveWalletPublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')
      ).rejects.toThrow('Save error');
    });
  });

  describe('getWalletPublicKey', () => {
    it('returns null when no key saved', async () => {
      const result = await getWalletPublicKey();
      expect(result).toBeNull();
    });

    it('returns saved public key', async () => {
      await saveWalletPublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');

      const result = await getWalletPublicKey();
      expect(result).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    });

    it('returns null on storage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Read error'));

      const result = await getWalletPublicKey();
      expect(result).toBeNull();
    });
  });

  // ================================================================
  // Secure Vault Key Storage
  // ================================================================
  describe('saveVaultEncryptionKey', () => {
    it('saves key to SecureStore', async () => {
      await saveVaultEncryptionKey('test_key_256bit');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        SECURE_VAULT_KEY,
        'test_key_256bit'
      );
    });

    it('propagates errors from SecureStore', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Secure enclave unavailable')
      );

      await expect(saveVaultEncryptionKey('key')).rejects.toThrow(
        'Secure enclave unavailable'
      );
    });
  });

  describe('getVaultEncryptionKey', () => {
    it('returns null when no key saved', async () => {
      const result = await getVaultEncryptionKey();
      expect(result).toBeNull();
    });

    it('returns saved key from SecureStore', async () => {
      await saveVaultEncryptionKey('saved_key');

      const result = await getVaultEncryptionKey();
      expect(result).toBe('saved_key');
    });

    it('returns null on SecureStore error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Secure enclave error')
      );

      const result = await getVaultEncryptionKey();
      expect(result).toBeNull();
    });
  });

  // ================================================================
  // Clear All Data
  // ================================================================
  describe('clearAllData', () => {
    it('removes vault, depin, and wallet keys', async () => {
      await saveIncident(makeIncident());
      await addDePINEarnings(1.0);
      await saveWalletPublicKey('pubkey_123');

      await clearAllData();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        VAULT_KEY,
        DEPIN_KEY,
        WALLET_KEY,
      ]);
    });

    it('returns empty data after clear', async () => {
      await saveIncident(makeIncident());
      await addDePINEarnings(5.0);
      await saveWalletPublicKey('pubkey_123');

      await clearAllData();

      const incidents = await getIncidents();
      const earnings = await getDePINEarnings();
      const wallet = await getWalletPublicKey();

      expect(incidents).toEqual([]);
      expect(earnings.totalEarned).toBe(0);
      expect(wallet).toBeNull();
    });

    it('propagates errors from multiRemove', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(
        new Error('Clear error')
      );

      await expect(clearAllData()).rejects.toThrow('Clear error');
    });
  });
});

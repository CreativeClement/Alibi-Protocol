import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { VaultIncident, DePINEarnings } from '../types';
import { encryptData, decryptData } from './encryption';

const VAULT_KEY = 'alibi_vault_incidents';
const DEPIN_EARNINGS_KEY = 'alibi_depin_earnings';
const WALLET_KEY = 'alibi_wallet_pubkey';
const SECURE_VAULT_KEY = 'alibi_vault_encryption_key';

// ============================================================
// Vault Incident Storage (Encrypted at Rest)
// ============================================================
export async function saveIncident(incident: VaultIncident): Promise<void> {
  try {
    const existingIncidents = await getIncidents();
    const updated = [...existingIncidents, incident];
    const json = JSON.stringify(updated);
    const encrypted = await encryptData(json);
    await AsyncStorage.setItem(VAULT_KEY, encrypted);
    if (__DEV__) console.log('Incident saved (encrypted):', incident.id);
  } catch (error) {
    if (__DEV__) console.warn('Save incident error:', error);
    throw error;
  }
}

export async function getIncidents(): Promise<VaultIncident[]> {
  try {
    const data = await AsyncStorage.getItem(VAULT_KEY);
    if (!data) return [];

    const decrypted = await decryptData(data);
    const parsed = JSON.parse(decrypted);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    if (__DEV__) console.warn('Get incidents error:', error);
    return [];
  }
}

export async function updateIncidentTxSignature(
  incidentId: string,
  txSignature: string,
  status: 'pending' | 'confirmed' | 'failed'
): Promise<void> {
  try {
    const incidents = await getIncidents();
    const updated = incidents.map((incident) =>
      incident.id === incidentId
        ? {
            ...incident,
            txSignature,
            onChainStatus: status,
          }
        : incident
    );
    const json = JSON.stringify(updated);
    const encrypted = await encryptData(json);
    await AsyncStorage.setItem(VAULT_KEY, encrypted);
    if (__DEV__) console.log('Incident updated (encrypted):', incidentId, status);
  } catch (error) {
    if (__DEV__) console.warn('Update incident error:', error);
    throw error;
  }
}

export async function deleteIncident(incidentId: string): Promise<void> {
  try {
    const incidents = await getIncidents();
    const filtered = incidents.filter((i) => i.id !== incidentId);
    const json = JSON.stringify(filtered);
    const encrypted = await encryptData(json);
    await AsyncStorage.setItem(VAULT_KEY, encrypted);
    if (__DEV__) console.log('Incident deleted:', incidentId);
  } catch (error) {
    if (__DEV__) console.warn('Delete incident error:', error);
    throw error;
  }
}

// ============================================================
// DePIN Earnings Storage
// ============================================================
export async function getDePINEarnings(): Promise<DePINEarnings> {
  try {
    const data = await AsyncStorage.getItem(DEPIN_EARNINGS_KEY);
    if (!data) {
      return {
        dailyEarned: 0,
        totalEarned: 0,
        lastEarnTime: 0,
        dailyEarnCount: 0,
      };
    }
    return JSON.parse(data);
  } catch (error) {
    if (__DEV__) console.warn('Get DePIN earnings error:', error);
    return {
      dailyEarned: 0,
      totalEarned: 0,
      lastEarnTime: 0,
      dailyEarnCount: 0,
    };
  }
}

export async function addDePINEarnings(amount: number): Promise<DePINEarnings> {
  try {
    const earnings = await getDePINEarnings();
    const now = Date.now();
    // Reset daily counters at calendar midnight (local time), not after 24h elapsed
    const lastEarnDate = new Date(earnings.lastEarnTime).toDateString();
    const todayDate = new Date(now).toDateString();
    const isNewDay = earnings.lastEarnTime === 0 || lastEarnDate !== todayDate;

    const updated: DePINEarnings = {
      dailyEarned: isNewDay ? amount : earnings.dailyEarned + amount,
      totalEarned: earnings.totalEarned + amount,
      lastEarnTime: now,
      dailyEarnCount: isNewDay ? 1 : earnings.dailyEarnCount + 1,
    };

    await AsyncStorage.setItem(DEPIN_EARNINGS_KEY, JSON.stringify(updated));
    if (__DEV__) console.log('DePIN earnings updated:', updated);
    return updated;
  } catch (error) {
    if (__DEV__) console.warn('Add DePIN earnings error:', error);
    return {
      dailyEarned: 0,
      totalEarned: 0,
      lastEarnTime: 0,
      dailyEarnCount: 0,
    };
  }
}

// ============================================================
// Wallet Storage
// ============================================================
export async function saveWalletPublicKey(publicKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(WALLET_KEY, publicKey);
    if (__DEV__) console.log('Wallet public key saved');
  } catch (error) {
    if (__DEV__) console.warn('Save wallet public key error:', error);
    throw error;
  }
}

export async function getWalletPublicKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(WALLET_KEY);
  } catch (error) {
    if (__DEV__) console.warn('Get wallet public key error:', error);
    return null;
  }
}

// ============================================================
// Secure Vault Key Storage (Hardware Enclave)
// ============================================================
export async function saveVaultEncryptionKey(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_VAULT_KEY, key);
    if (__DEV__) console.log('Vault encryption key saved to secure enclave');
  } catch (error) {
    if (__DEV__) console.warn('Save vault encryption key error:', error);
    throw error;
  }
}

export async function getVaultEncryptionKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SECURE_VAULT_KEY);
  } catch (error) {
    if (__DEV__) console.warn('Get vault encryption key error:', error);
    return null;
  }
}

// ============================================================
// Clear all data (for testing/reset)
// ============================================================
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([VAULT_KEY, DEPIN_EARNINGS_KEY, WALLET_KEY]);
    if (__DEV__) console.log('All data cleared');
  } catch (error) {
    if (__DEV__) console.warn('Clear all data error:', error);
    throw error;
  }
}

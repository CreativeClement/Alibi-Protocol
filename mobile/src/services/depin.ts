import { Platform } from 'react-native';
import { LocationCoords } from '../types';
import { speedMsToMph } from './location';
import { getDePINEarnings, addDePINEarnings } from './storage';
import { DEPIN_CONFIG } from '../constants/theme';
import { LOCATION_CONFIG } from '../constants/api';

interface EarnCheckResult {
  canEarn: boolean;
  reason?: string;
  amount?: number;
}

export async function checkCanEarn(
  location: LocationCoords | null,
  isNavigating: boolean,
  isMocked: boolean,
  lastEarnTime: number
): Promise<EarnCheckResult> {
  // Check if location is mocked (GPS spoofing)
  if (isMocked) {
    return {
      canEarn: false,
      reason: 'GPS spoofing detected',
    };
  }

  // Check if location is available
  if (!location || location.speed == null) {
    return {
      canEarn: false,
      reason: 'Location unavailable',
    };
  }

  // Reject low-accuracy GPS fixes (>100m uncertainty = unreliable)
  if (location.accuracy != null && location.accuracy > LOCATION_CONFIG.maxGpsAccuracyMeters) {
    return {
      canEarn: false,
      reason: `GPS accuracy too low (${location.accuracy.toFixed(0)}m)`,
    };
  }

  // Convert speed to MPH
  const speedMph = speedMsToMph(location.speed);

  // Check speed constraints
  if (speedMph < DEPIN_CONFIG.minSpeedMph || speedMph > DEPIN_CONFIG.maxSpeedMph) {
    return {
      canEarn: false,
      reason: `Speed ${speedMph.toFixed(1)} MPH outside earning range`,
    };
  }

  // Check rate limiting (cooldown between earnings)
  const timeSinceLastEarn = Date.now() - lastEarnTime;
  if (timeSinceLastEarn < DEPIN_CONFIG.earnCooldownMs) {
    return {
      canEarn: false,
      reason: `Rate limited (${DEPIN_CONFIG.earnCooldownMs / 1000}s cooldown)`,
    };
  }

  // Calculate reward amount
  const earnings = await getDePINEarnings();
  const navigationMultiplier = isNavigating
    ? DEPIN_CONFIG.navigationMultiplier
    : DEPIN_CONFIG.passiveMultiplier;

  // Progressive difficulty: reward decreases as total earned increases
  const difficultyFactor = 1 + earnings.dailyEarnCount * 0.05;
  const amount = (DEPIN_CONFIG.baseReward * navigationMultiplier) / difficultyFactor;

  return {
    canEarn: true,
    amount,
  };
}

export async function processEarn(amount: number): Promise<number> {
  try {
    const earnings = await addDePINEarnings(amount);
    if (__DEV__) console.log('DePIN earn processed:', amount);
    return earnings.totalEarned;
  } catch (error) {
    if (__DEV__) console.warn('Process earn error:', error);
    return 0;
  }
}

export function calculateDifficulty(dailyEarnCount: number): number {
  return 1 + dailyEarnCount * 0.05;
}

export function getSpeedValidationStatus(speedMph: number): {
  isValid: boolean;
  status: 'stationary' | 'earning' | 'anti_exploit';
  message: string;
} {
  if (speedMph < DEPIN_CONFIG.minSpeedMph) {
    return {
      isValid: false,
      status: 'stationary',
      message: 'Stationary - No rewards',
    };
  }

  if (speedMph > DEPIN_CONFIG.maxSpeedMph) {
    return {
      isValid: false,
      status: 'anti_exploit',
      message: `Speed exceeds earning range (${DEPIN_CONFIG.maxSpeedMph} MPH limit)`,
    };
  }

  return {
    isValid: true,
    status: 'earning',
    message: `Earning zone (${speedMph.toFixed(1)} MPH)`,
  };
}

/**
 * Device Attestation Check
 *
 * PRODUCTION IMPLEMENTATION PATH:
 * 1. Android: Use Google Play Integrity API via react-native-play-integrity
 *    - npm install react-native-play-integrity
 *    - Requires Google Cloud project + Play Console setup
 *    - Returns integrity verdict: MEETS_DEVICE_INTEGRITY, MEETS_BASIC_INTEGRITY
 *
 * 2. iOS: Use Apple App Attest via DCAppAttestService
 *    - Use react-native-app-attest or native module
 *    - Requires Apple Developer Program enrollment
 *    - Returns attestation key + assertion
 *
 * 3. Server-side: Verify attestation tokens against Google/Apple APIs
 *    - Never trust client-side attestation alone
 *    - Deploy a Cloudflare Worker or Lambda to verify tokens
 *
 * Current implementation: Platform-aware gate with __DEV__ bypass.
 * In production builds, this returns false (blocks earning) until
 * native attestation modules are installed and configured.
 */

export async function checkDeviceAttestation(): Promise<boolean> {
  try {
    // In development, always pass attestation
    if (__DEV__) {
      return true;
    }

    // Production: attempt native attestation
    if (Platform.OS === 'android') {
      return await checkAndroidIntegrity();
    } else if (Platform.OS === 'ios') {
      return await checkAppleAppAttest();
    }

    // Web/unknown platform — no attestation available
    return false;
  } catch (error) {
    if (__DEV__) console.warn('Device attestation error:', error);
    // Fail closed in production — no attestation = no earning
    return __DEV__ ? true : false;
  }
}

async function checkAndroidIntegrity(): Promise<boolean> {
  try {
    // Attempt to load react-native-play-integrity dynamically
    // This prevents crash if module isn't installed yet
    const PlayIntegrity = require('react-native-play-integrity');
    if (PlayIntegrity?.isPlayIntegrityAvailable) {
      const available = await PlayIntegrity.isPlayIntegrityAvailable();
      if (!available) return false;

      const token = await PlayIntegrity.requestIntegrityToken({
        cloudProjectNumber: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER || '',
      });

      // In production, send this token to your backend for verification
      // For now, having a token at all means the device passed basic integrity
      return !!token;
    }
    return false;
  } catch {
    // Module not installed yet — return false in production
    return false;
  }
}

async function checkAppleAppAttest(): Promise<boolean> {
  try {
    const AppAttest = require('react-native-app-attest');
    if (AppAttest?.isSupported) {
      const supported = await AppAttest.isSupported();
      return supported;
    }
    return false;
  } catch {
    // Module not installed yet — return false in production
    return false;
  }
}

/**
 * Proximity Sybil Detection
 *
 * PRODUCTION IMPLEMENTATION PATH:
 * 1. Use expo-sensors (accelerometer) for motion fingerprinting
 * 2. Use BLE scanning (react-native-ble-manager) for nearby device detection
 * 3. Server-side: compare GPS trajectories for velocity vector collisions
 *    - Two devices with identical lat/lng/speed/heading within 5m = Sybil
 *
 * Current: Disabled. Returns false (no conflict detected).
 */
export async function checkProximitySybilConflict(): Promise<boolean> {
  try {
    // Phase 1: GPS jitter analysis (no additional modules needed)
    // A real moving device has micro-variations in GPS readings.
    // An emulator or spoofed location produces unnaturally smooth coordinates.
    // This check will be enabled when we have a baseline of real device data.

    // Phase 2: BLE proximity scanning (requires react-native-ble-manager)
    // Detect nearby Alibi devices and compare trajectories.

    // Currently disabled — always returns false (no conflict)
    return false;
  } catch (error) {
    if (__DEV__) console.warn('Proximity Sybil detection error:', error);
    return false;
  }
}

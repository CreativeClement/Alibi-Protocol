import { PublicKey } from '@solana/web3.js';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed: number | null;
  mocked?: boolean;
}

export interface LegalGuidance {
  guidance: string;
  citedLaws: string[];
  state: string;
  timestamp: number;
}

export interface VaultIncident {
  id: string;
  timestamp: number;
  hash: string;
  txSignature?: string;
  recordingPath: string;
  videoPath?: string;
  description: string;
  state: string;
  duration: number;
  onChainStatus: 'pending' | 'confirmed' | 'failed';
  latitude: number;
  longitude: number;
  speed: number;
}

export interface WalletState {
  connected: boolean;
  publicKey: PublicKey | null;
  balance: number;
}

export interface DePINEarnings {
  dailyEarned: number;
  totalEarned: number;
  lastEarnTime: number;
  dailyEarnCount: number;
}

export interface RecordingSession {
  id: string;
  startTime: number;
  videoPath?: string;
  audioPath?: string;
  hash?: string;
  state: 'recording' | 'stopped' | 'processing';
}

export interface EmergencyState {
  isActive: boolean;
  startTime: number;
  hash: string;
  guidance: LegalGuidance | null;
  recordingPath?: string;
  txSignature?: string;
}

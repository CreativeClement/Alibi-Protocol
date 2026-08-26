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

// ---------------------------------------------------------------------------
// Navigation (Waze-style turn-by-turn)
// ---------------------------------------------------------------------------

/** A simple lat/lng point used across routing + map code. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** A destination/search result returned by a geocoding provider. */
export interface Place {
  id: string;
  name: string;
  /** Secondary line, e.g. full street address or region. */
  address: string;
  latitude: number;
  longitude: number;
  /** Straight-line distance from the user in meters (optional). */
  distanceMeters?: number;
}

/** Maneuver direction used to pick the correct turn icon + spoken verb. */
export type ManeuverType =
  | 'depart'
  | 'turn-left'
  | 'turn-right'
  | 'turn-slight-left'
  | 'turn-slight-right'
  | 'turn-sharp-left'
  | 'turn-sharp-right'
  | 'uturn'
  | 'straight'
  | 'merge'
  | 'roundabout'
  | 'fork-left'
  | 'fork-right'
  | 'ramp'
  | 'arrive';

/** A single turn-by-turn step. */
export interface RouteStep {
  /** Human-readable instruction, e.g. "Turn right onto Main St". */
  instruction: string;
  maneuver: ManeuverType;
  /** Length of this step in meters. */
  distanceMeters: number;
  /** Expected duration of this step in seconds. */
  durationSeconds: number;
  /** Coordinate where the maneuver happens (end of step). */
  location: LatLng;
  /** Road name for the step, when available. */
  name?: string;
}

/** A full computed route from origin to destination. */
export interface Route {
  /** Decoded geometry for drawing the route polyline. */
  coordinates: LatLng[];
  steps: RouteStep[];
  distanceMeters: number;
  durationSeconds: number;
  /** Provider that produced the route, for debugging/labels. */
  provider: string;
}

/** Category of a Waze-style map alert. */
export type AlertType = 'police' | 'crash' | 'hazard' | 'camera' | 'incident';

/** A map alert shown to the driver as they approach it. */
export interface MapAlert {
  id: string;
  type: AlertType;
  location: LatLng;
  /** Optional human label. */
  label?: string;
  /** When the alert was created (ms epoch). */
  createdAt: number;
  /** Source of the alert: local device, or shared community feed. */
  source: 'local' | 'community';
}

/** Map camera viewing modes. */
export type MapViewMode = '2d' | '3d';
export type MapType = 'standard' | 'satellite' | 'hybrid';
export type ThemeMode = 'auto' | 'day' | 'night';
export type DistanceUnits = 'imperial' | 'metric';

/** Persisted user viewing/navigation preferences. */
export interface NavPreferences {
  viewMode: MapViewMode;
  mapType: MapType;
  themeMode: ThemeMode;
  units: DistanceUnits;
  voiceEnabled: boolean;
  /** Keep the map rotated to the direction of travel. */
  headingUp: boolean;
  alertsEnabled: boolean;
  avoidHighways: boolean;
  avoidTolls: boolean;
}

/** Live navigation session state. */
export type NavPhase = 'idle' | 'searching' | 'overview' | 'navigating' | 'arrived';


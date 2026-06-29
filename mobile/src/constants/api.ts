/**
 * API Configuration Constants
 *
 * Centralized configuration for external service integrations.
 * API keys and secrets must come from environment variables — never hardcode them.
 */

// Alibi Protocol — Official Site / Domain
// The app is connected to the alibiprotocol.com domain. All first-party API
// calls route through the domain (which proxies to the underlying Cloudflare
// Worker via a Vercel rewrite), so the workers.dev URL never appears client-side.
// Override the base URL for local/dev via EXPO_PUBLIC_SITE_URL.
export const SITE_CONFIG = {
  domain: 'alibiprotocol.com',
  baseUrl: process.env.EXPO_PUBLIC_SITE_URL || 'https://alibiprotocol.com',
  get apiBaseUrl() {
    return `${this.baseUrl}/api`;
  },
  links: {
    home: 'https://alibiprotocol.com',
    whitepaper: 'https://alibiprotocol.com/whitepaper',
    tokenomics: 'https://alibiprotocol.com/tokenomics',
    privacy: 'https://alibiprotocol.com/privacy',
    terms: 'https://alibiprotocol.com/terms',
    contact: 'https://alibiprotocol.com/contact',
  },
} as const;

// Claude AI — Legal Guidance Engine
// Routed through the alibiprotocol.com domain (Vercel rewrite -> Cloudflare
// Worker). The Anthropic API key is stored as a Worker secret — NEVER in the
// client bundle. DO NOT set EXPO_PUBLIC_CLAUDE_API_KEY in production.
export const CLAUDE_CONFIG = {
  // First-party endpoint on the official domain (proxied to the Worker).
  proxyUrl:
    process.env.EXPO_PUBLIC_LEGAL_GUIDANCE_URL ||
    `${SITE_CONFIG.baseUrl}/api/legal-guidance`,
  // Direct endpoint — only used if proxy is explicitly overridden for dev
  directApiUrl: 'https://api.anthropic.com/v1/messages',
  model: 'claude-haiku-4-5-20251001',
  apiVersion: '2023-06-01',
  maxTokens: 300,
  temperature: 0.2,
} as const;

// Solana — Evidence Vaulting
export const SOLANA_CONFIG = {
  memoProgramId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  defaultRpcUrl: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed' as const,
  lamportsPerSol: 1e9,
  cluster: 'mainnet-beta',
} as const;

// Phantom Wallet — Deep Link Integration
export const PHANTOM_CONFIG = {
  signTimeoutMs: 120_000, // 2-minute timeout for transaction signing
  appScheme: process.env.EXPO_PUBLIC_PHANTOM_DEEP_LINK_SCHEME || 'alibiprotocol',
} as const;

// Location Tracking
export const LOCATION_CONFIG = {
  trackingIntervalMs: 1_000,
  distanceIntervalMeters: 0,
  maxGpsAccuracyMeters: 100,
} as const;

// Navigation Screen
export const NAVIGATION_CONFIG = {
  earnCheckIntervalMs: 5_000,
} as const;

// Turn-by-turn Navigation (Waze-style)
//
// Provider-agnostic: defaults to free OpenStreetMap services (OSRM routing +
// Nominatim search) which require no API key. To upgrade to higher-quality
// traffic-aware routing later, set EXPO_PUBLIC_MAPBOX_TOKEN (or a Google key)
// and add a provider in services/navigation.
export const NAV_CONFIG = {
  // Active provider. Auto-selects mapbox if a token is present, else osm.
  provider: (process.env.EXPO_PUBLIC_NAV_PROVIDER || 'auto') as
    | 'auto'
    | 'osm'
    | 'mapbox',
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '',
  // Free OSM public endpoints.
  osrmBaseUrl: 'https://router.project-osrm.org',
  nominatimBaseUrl: 'https://nominatim.openstreetmap.org',
  // Distance (meters) within which the next maneuver triggers a voice cue.
  voiceCueDistanceMeters: 250,
  // Distance (meters) within which a step is considered "completed".
  stepArrivalDistanceMeters: 30,
  // Distance (meters) off the route line that triggers a recalculation.
  offRouteThresholdMeters: 50,
  // Distance (meters) within which the user is considered "arrived".
  arrivalDistanceMeters: 35,
  // Proximity (meters) at which a map alert announces itself.
  alertProximityMeters: 400,
  // Camera pitch (degrees) used in 3D mode.
  pitch3d: 60,
  // Zoom levels for follow camera.
  navZoom: 17,
  overviewPadding: 80,
} as const;

import type { NavPreferences } from '../types';

export const DEFAULT_NAV_PREFERENCES: NavPreferences = {
  viewMode: '3d',
  mapType: 'standard',
  themeMode: 'auto',
  units: 'imperial',
  voiceEnabled: true,
  headingUp: true,
  alertsEnabled: true,
  avoidHighways: false,
  avoidTolls: false,
};

export const NAV_PREFS_STORAGE_KEY = '@alibi/nav_preferences';

// Emergency Mode
export const EMERGENCY_CONFIG = {
  cameraInitDelayMs: 500,
} as const;

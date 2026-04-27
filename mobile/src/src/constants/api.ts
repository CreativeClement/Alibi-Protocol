/**
 * API Configuration Constants
 *
 * Centralized configuration for external service integrations.
 * API keys and secrets must come from environment variables — never hardcode them.
 */

// Claude AI — Legal Guidance Engine
// NOTE: Calls go through Cloudflare Worker proxy (alibi-api.timrclement.workers.dev)
// The Anthropic API key is stored as a Worker secret — NEVER in the client bundle.
// DO NOT set EXPO_PUBLIC_CLAUDE_API_KEY in production. The proxy handles auth.
export const CLAUDE_CONFIG = {
  // Proxy endpoint — API key lives server-side in Worker secrets
  proxyUrl: 'https://alibi-api.timrclement.workers.dev/legal-guidance',
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

// Emergency Mode
export const EMERGENCY_CONFIG = {
  cameraInitDelayMs: 500,
} as const;

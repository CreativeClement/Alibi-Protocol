import { Platform } from 'react-native';

// ─── Color System (5 colors max + semantic variants) ───────────────────────
// Primary:  #00E5FF (cyan)
// Neutral:  #06080C / #0D1117 / #161C26 / #1E2735  (near-black surfaces)
// Accent R: #FF3B47 (emergency/error)
// Accent G: #2EE6A0 (success/earning)
// Accent A: #FFB020 (warning)

export const COLORS = {
  // ── Core Surfaces ──────────────────────────────────────────────────────
  background:    '#06080C',   // deepest layer — app bg, tab bar
  surface:       '#0D1117',   // cards, overlays
  surfaceAlt:    '#161C26',   // inner card rows, inputs
  surfaceHover:  '#1E2735',   // hover / active tint

  // ── Brand ──────────────────────────────────────────────────────────────
  primary:        '#00E5FF',
  primaryDark:    '#009BB3',
  primaryMuted:   'rgba(0,229,255,0.10)',
  primarySubtle:  'rgba(0,229,255,0.05)',
  primaryBorder:  'rgba(0,229,255,0.25)',

  // ── Semantic ───────────────────────────────────────────────────────────
  success:        '#2EE6A0',
  successMuted:   'rgba(46,230,160,0.10)',
  successBorder:  'rgba(46,230,160,0.25)',

  warning:        '#FFB020',
  warningMuted:   'rgba(255,176,32,0.10)',
  warningBorder:  'rgba(255,176,32,0.25)',

  error:          '#FF3B47',
  errorMuted:     'rgba(255,59,71,0.10)',
  errorBorder:    'rgba(255,59,71,0.28)',

  accent:         '#FF3B47',  // alias

  // ── Text ───────────────────────────────────────────────────────────────
  text:           '#EDF2F7',
  textSecondary:  '#7A8799',
  textMuted:      '#4A5568',
  textInverse:    '#06080C',

  // ── Borders ────────────────────────────────────────────────────────────
  border:         '#1A2230',
  borderStrong:   '#263040',

  // ── Effects ────────────────────────────────────────────────────────────
  glow:           'rgba(0,229,255,0.40)',
  glowError:      'rgba(255,59,71,0.40)',
  overlay:        'rgba(6,8,12,0.80)',
  overlayLight:   'rgba(13,17,23,0.92)',
};

// ─── Typography ────────────────────────────────────────────────────────────
export const FONTS = {
  family: {
    primary: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif', default: 'System' }),
    mono:    Platform.select({ ios: 'SF Mono',     android: 'monospace',  default: 'monospace' }),
  },
  size: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   15,
    lg:   18,
    xl:   22,
    '2xl': 28,
    '3xl': 40,
  },
  weight: {
    light:    '300' as const,
    normal:   '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    heavy:    '800' as const,
  },
  tracking: {
    tight:   -0.4,
    normal:   0,
    wide:     0.4,
    wider:    0.8,
    widest:   1.6,
    label:    1.2,   // all-caps section labels
  },
  lineHeight: {
    tight:   1.2,
    normal:  1.45,
    relaxed: 1.6,
  },
};

// ─── Spacing ───────────────────────────────────────────────────────────────
export const SPACING = {
  '2xs': 2,
  xs:    4,
  sm:    8,
  md:    16,
  lg:    24,
  xl:    32,
  '2xl': 48,
};

// ─── Border Radius ─────────────────────────────────────────────────────────
export const BORDER_RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  '2xl': 32,
  full: 9999,
};

// ─── Shadows ───────────────────────────────────────────────────────────────
export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 16,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.50,
    shadowRadius: 14,
    elevation: 12,
  },
  glowError: {
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
};

// ─── DePIN Config (unchanged) ──────────────────────────────────────────────
export const DEPIN_CONFIG = {
  minSpeedMph:            5,
  maxSpeedMph:            110,
  baseReward:             0.05,
  navigationMultiplier:   1.0,
  passiveMultiplier:      0.1,
  earnCooldownMs:         30000,
  proximityThresholdMeters: 5,
};

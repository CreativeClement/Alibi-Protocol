import { Platform } from 'react-native';

export const COLORS = {
  // Base surfaces — deep, slightly blue-shifted near-black for a tactical feel
  background: '#06080C',
  backgroundAlt: '#0A0E15',
  surface: '#11161F',
  surfaceAlt: '#19202C',
  surfaceHover: '#212B3A',

  // Brand
  primary: '#00E5FF',
  primaryDark: '#00A6BD',
  primaryMuted: 'rgba(0,229,255,0.12)',
  primarySubtle: 'rgba(0,229,255,0.06)',

  // Accents / semantic
  accent: '#FF3B47',
  accentMuted: 'rgba(255,59,71,0.12)',
  success: '#2EE6A0',
  successMuted: 'rgba(46,230,160,0.12)',
  warning: '#FFB020',
  warningMuted: 'rgba(255,176,32,0.12)',
  error: '#FF3B47',
  errorMuted: 'rgba(255,59,71,0.12)',

  // Text
  text: '#F4F7FB',
  textSecondary: '#8B96A8',
  textMuted: '#5A6577',

  // Lines
  border: '#212A38',
  borderStrong: '#2E3A4C',

  // Effects
  glow: 'rgba(0,229,255,0.45)',
  overlay: 'rgba(6,8,12,0.72)',
};

export const FONTS = {
  family: {
    primary: 'Inter',
    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  size: {
    xs: 11,
    sm: 13,
    base: 16,
    lg: 18,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
  },
  weight: {
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  tracking: {
    tight: -0.4,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  full: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 14,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
  },
};

export const DEPIN_CONFIG = {
  minSpeedMph: 5,
  maxSpeedMph: 110,
  baseReward: 0.05,
  navigationMultiplier: 1.0,
  passiveMultiplier: 0.1,
  earnCooldownMs: 30000,
  proximityThresholdMeters: 5,
};

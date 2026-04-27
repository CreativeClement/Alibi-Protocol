import { Platform } from 'react-native';

export const COLORS = {
  background: '#0A0A0C',
  surface: '#1A1A1F',
  surfaceAlt: '#2A2A32',
  primary: '#00E5FF',
  primaryDark: '#00B8CC',
  accent: '#FF3333',
  success: '#32D74B',
  warning: '#FF9500',
  error: '#FF3333',
  text: '#FFFFFF',
  textSecondary: '#A0A0A8',
  border: '#3A3A42',
};

export const FONTS = {
  family: {
    primary: 'Inter',
    mono: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  size: {
    xs: 11,
    sm: 13,
    base: 16,
    lg: 18,
    xl: 24,
    '2xl': 32,
  },
  weight: {
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
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
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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

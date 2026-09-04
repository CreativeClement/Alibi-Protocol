export const Platform = {
  OS: 'ios' as const,
  select: (obj: Record<string, any>) => obj.ios ?? obj.default,
};

export const Alert = {
  alert: jest.fn(),
};

export const Linking = {
  openURL: jest.fn(),
};

export const StyleSheet = {
  create: (styles: any) => styles,
};

export const Animated = {
  Value: jest.fn(() => ({
    setValue: jest.fn(),
    interpolate: jest.fn(),
  })),
  View: 'Animated.View',
  timing: jest.fn(() => ({ start: jest.fn() })),
  loop: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
  sequence: jest.fn(),
};

export const Easing = {
  inOut: jest.fn((fn: any) => fn),
  ease: jest.fn(),
};

export default {
  Platform,
  Alert,
  Linking,
  StyleSheet,
  Animated,
  Easing,
};

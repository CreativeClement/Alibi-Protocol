import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  /** Called once the intro animation + minimum display time completes. */
  onFinish?: () => void;
  /** Status line shown under the progress bar. */
  status?: string;
  /** Minimum time (ms) the splash stays visible. */
  minDurationMs?: number;
}

export function SplashScreen({
  onFinish,
  status = 'Securing your protocol',
  minDurationMs = 2400,
}: SplashScreenProps) {
  // Logo entrance
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Glow ring pulse
  const pulse = useRef(new Animated.Value(0)).current;
  // Wordmark + tagline
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslate = useRef(new Animated.Value(12)).current;
  // Progress bar fill
  const progress = useRef(new Animated.Value(0)).current;
  // Whole-screen fade out
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTranslate, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Continuous glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Progress bar (non-native: animates width)
    Animated.timing(progress, {
      toValue: 1,
      duration: minDurationMs - 400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Exit after min duration
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish?.());
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [
    logoOpacity,
    logoScale,
    pulse,
    wordmarkOpacity,
    wordmarkTranslate,
    progress,
    screenOpacity,
    minDurationMs,
    onFinish,
  ]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Logo + pulsing glow ring */}
      <View style={styles.logoWrap}>
        <Animated.View
          style={[
            styles.glowRing,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.glowRingInner,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <Animated.Image
          source={require('../../assets/splash-icon.png')}
          style={[
            styles.logo,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
          resizeMode="contain"
        />
      </View>

      {/* Wordmark */}
      <Animated.View
        style={{
          opacity: wordmarkOpacity,
          transform: [{ translateY: wordmarkTranslate }],
          alignItems: 'center',
        }}
      >
        <Text style={styles.wordmark}>
          ALIBI<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <Text style={styles.tagline}>PROTOCOL</Text>
      </Animated.View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
      <Text style={styles.status}>{status}</Text>

      {/* Footer */}
      <Text style={styles.footer}>KNOW YOUR RIGHTS · RECORD · PROTECT</Text>
    </Animated.View>
  );
}

const RING = 132;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logoWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  glowRing: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  glowRingInner: {
    position: 'absolute',
    width: RING - 28,
    height: RING - 28,
    borderRadius: (RING - 28) / 2,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  logo: {
    width: 96,
    height: 96,
  },
  wordmark: {
    fontSize: FONTS.size['3xl'],
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.widest,
  },
  wordmarkDot: {
    color: COLORS.primary,
  },
  tagline: {
    marginTop: SPACING.xs,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
    letterSpacing: 6,
  },
  progressTrack: {
    marginTop: SPACING['2xl'],
    width: Math.min(220, width * 0.55),
    height: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  status: {
    marginTop: SPACING.md,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.wide,
  },
  footer: {
    position: 'absolute',
    bottom: SPACING['2xl'],
    fontSize: 10,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
});

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../constants/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
}

export const LoadingOverlay = React.memo(function LoadingOverlay({
  visible,
  message = 'Processing...',
  progress,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={COLORS.primary} />

        <Text style={styles.message}>{message}</Text>

        {progress !== undefined && (
          <View style={styles.progressSection}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(progress * 100, 100)}%` as `${number}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,12,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 220,
    ...SHADOW.md,
  },
  message: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  progressSection: {
    marginTop: SPACING.lg,
    width: '100%',
  },
  track: {
    height: 3,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
  },
  progressText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: FONTS.weight.semibold,
    letterSpacing: FONTS.tracking.wide,
  },
});

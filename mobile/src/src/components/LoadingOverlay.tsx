import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
}

export const LoadingOverlay = React.memo(function LoadingOverlay({ visible, message = 'Processing...', progress }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />

        <Text style={styles.message}>{message}</Text>

        {progress !== undefined && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(progress * 100, 100)}%`,
                  },
                ]}
              />
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 200,
  },
  message: {
    fontSize: FONTS.size.base,
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  progressSection: {
    marginTop: SPACING.lg,
    width: '100%',
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  progressText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../../constants/theme';
import { formatDistance, formatDuration, formatEta } from '../../services/navigation';
import type { DistanceUnits } from '../../types';

interface EtaBarProps {
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  units: DistanceUnits;
  onStop: () => void;
}

export function EtaBar({
  remainingDistanceMeters,
  remainingDurationSeconds,
  units,
  onStop,
}: EtaBarProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.stopButton} onPress={onStop} accessibilityLabel="End navigation">
        <Ionicons name="close" size={22} color={COLORS.text} />
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.eta}>{formatDuration(remainingDurationSeconds)}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{formatDistance(remainingDistanceMeters, units)}</Text>
          <View style={styles.dot} />
          <Text style={styles.meta}>{formatEta(remainingDurationSeconds)}</Text>
        </View>
      </View>

      <View style={styles.endCap}>
        <Ionicons name="flag" size={20} color={COLORS.success} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.md,
    ...SHADOW.lg,
  },
  stopButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center' },
  eta: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.success,
    letterSpacing: FONTS.tracking.tight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  meta: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.medium,
    fontFamily: FONTS.family.mono,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
  },
  endCap: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../../constants/theme';
import { formatDistance } from '../../services/navigation';
import { maneuverIcon } from './maneuverIcon';
import type { DistanceUnits, RouteStep } from '../../types';

interface InstructionBannerProps {
  step: RouteStep | null;
  nextStep: RouteStep | null;
  distanceToManeuverMeters: number;
  units: DistanceUnits;
  recalculating: boolean;
}

export function InstructionBanner({
  step,
  nextStep,
  distanceToManeuverMeters,
  units,
  recalculating,
}: InstructionBannerProps) {
  if (!step) return null;

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name={maneuverIcon(step.maneuver) as any}
            size={40}
            color={COLORS.textInverse}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.distance}>
            {recalculating ? 'Recalculating…' : formatDistance(distanceToManeuverMeters, units)}
          </Text>
          <Text style={styles.instruction} numberOfLines={2}>
            {step.instruction}
          </Text>
        </View>
      </View>

      {nextStep ? (
        <View style={styles.thenRow}>
          <Text style={styles.thenLabel}>THEN</Text>
          <MaterialCommunityIcons
            name={maneuverIcon(nextStep.maneuver) as any}
            size={16}
            color={COLORS.textSecondary}
          />
          <Text style={styles.thenText} numberOfLines={1}>
            {nextStep.instruction}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.glow,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(6,8,12,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  distance: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.tight,
  },
  instruction: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textInverse,
    marginTop: 2,
    opacity: 0.9,
  },
  thenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(6,8,12,0.85)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  thenLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  thenText: {
    flex: 1,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.medium,
  },
});

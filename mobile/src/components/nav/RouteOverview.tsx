import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../../constants/theme';
import { formatDistance, formatDuration, formatEta } from '../../services/navigation';
import type { DistanceUnits, Place, Route } from '../../types';

interface RouteOverviewProps {
  destination: Place;
  route: Route;
  units: DistanceUnits;
  loading: boolean;
  onStart: () => void;
  onCancel: () => void;
}

export function RouteOverview({
  destination,
  route,
  units,
  loading,
  onStart,
  onCancel,
}: RouteOverviewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.destIcon}>
          <Ionicons name="flag" size={18} color={COLORS.success} />
        </View>
        <View style={styles.destText}>
          <Text style={styles.destName} numberOfLines={1}>
            {destination.name}
          </Text>
          <Text style={styles.destAddress} numberOfLines={1}>
            {destination.address}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(route.durationSeconds)}</Text>
          <Text style={styles.statLabel}>TIME</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDistance(route.distanceMeters, units)}</Text>
          <Text style={styles.statLabel}>DISTANCE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatEta(route.durationSeconds)}</Text>
          <Text style={styles.statLabel}>ARRIVAL</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={onStart} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.textInverse} />
        ) : (
          <>
            <Ionicons name="navigate" size={20} color={COLORS.textInverse} />
            <Text style={styles.startText}>START</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOW.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  destIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destText: { flex: 1 },
  destName: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
  },
  destAddress: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.tight,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    ...SHADOW.glow,
  },
  startText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wider,
  },
});

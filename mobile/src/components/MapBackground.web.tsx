import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { LocationCoords } from '../types';

interface MapBackgroundProps {
  location: LocationCoords;
  speedMph: number;
}

const GRID_LINES = Array.from({ length: 9 });

/**
 * Web fallback for the native map. react-native-maps is native-only, so on
 * web we render a tactical grid placeholder with the current coordinates.
 */
export function MapBackground({ location, speedMph }: MapBackgroundProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      {/* Grid */}
      <View style={styles.grid} pointerEvents="none">
        {GRID_LINES.map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLineH, { top: `${((i + 1) / 10) * 100}%` }]} />
        ))}
        {GRID_LINES.map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLineV, { left: `${((i + 1) / 10) * 100}%` }]} />
        ))}
      </View>

      {/* Center marker */}
      <View style={styles.markerWrap} pointerEvents="none">
        <View style={styles.markerPulse} />
        <View style={styles.markerDot}>
          <Ionicons name="navigate" size={18} color={COLORS.textInverse} />
        </View>
      </View>

      {/* Coordinates chip */}
      <View style={styles.coordChip} pointerEvents="none">
        <Ionicons name="location" size={13} color={COLORS.primary} />
        <Text style={styles.coordText}>
          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </Text>
      </View>

      <Text style={styles.webNote} pointerEvents="none">
        MAP PREVIEW · LIVE ON DEVICE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceAlt ?? COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.border,
    opacity: 0.5,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.border,
    opacity: 0.5,
  },
  markerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
  },
  markerPulse: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  markerDot: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordChip: {
    position: 'absolute',
    top: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  coordText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.semibold,
    letterSpacing: FONTS.tracking.wide,
  },
  webNote: {
    position: 'absolute',
    bottom: '38%',
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
  },
});

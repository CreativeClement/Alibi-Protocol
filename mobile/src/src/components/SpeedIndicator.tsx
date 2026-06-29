import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface SpeedIndicatorProps {
  speedMph: number;
  maxSpeed?: number;
}

export const SpeedIndicator = React.memo(function SpeedIndicator({
  speedMph,
  maxSpeed = 120,
}: SpeedIndicatorProps) {
  const { color, status } = useMemo(() => {
    if (speedMph < 5)   return { color: COLORS.textMuted,    status: 'STATIONARY' };
    if (speedMph < 55)  return { color: COLORS.success,      status: 'EARNING'    };
    if (speedMph < 75)  return { color: COLORS.warning,      status: 'CAUTION'    };
    if (speedMph < 110) return { color: COLORS.error,        status: 'RISKY'      };
                        return { color: COLORS.error,        status: 'CAPPED'     };
  }, [speedMph]);

  const pct = maxSpeed > 0 ? Math.min((speedMph / maxSpeed) * 100, 100) : 0;

  return (
    <View style={styles.container}>
      {/* Top row */}
      <View style={styles.topRow}>
        <Text style={styles.label}>SPEED</Text>
        <View style={[styles.statusPill, { borderColor: color + '55', backgroundColor: color + '15' }]}>
          <Text style={[styles.statusText, { color }]}>{status}</Text>
        </View>
      </View>

      {/* Speed value */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{speedMph.toFixed(1)}</Text>
        <Text style={styles.unit}>MPH</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: COLORS.success, label: '5–55' },
          { color: COLORS.warning, label: '55–75' },
          { color: COLORS.error,   label: '75+' },
        ].map(({ color: c, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: c }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  statusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.wide,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.md,
  },
  value: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.heavy,
    letterSpacing: -1,
  },
  unit: {
    marginLeft: SPACING.xs,
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.medium,
    marginBottom: 2,
  },
  track: {
    height: 4,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  fill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  legendText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.medium,
  },
});

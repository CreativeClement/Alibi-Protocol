import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface SpeedIndicatorProps {
  speedMph: number;
  maxSpeed?: number;
}

export const SpeedIndicator = React.memo(function SpeedIndicator({ speedMph, maxSpeed = 120 }: SpeedIndicatorProps) {
  const { color, status } = useMemo(() => {
    if (speedMph < 5) {
      return { color: COLORS.textSecondary, status: 'STATIONARY' };
    }
    if (speedMph < 55) {
      return { color: COLORS.success, status: 'EARNING' };
    }
    if (speedMph < 75) {
      return { color: COLORS.warning, status: 'CAUTION' };
    }
    if (speedMph < 110) {
      return { color: COLORS.error, status: 'RISKY' };
    }
    return { color: COLORS.error, status: 'ANTI_EXPLOIT' };
  }, [speedMph]);

  const percentage = maxSpeed > 0 ? Math.min((speedMph / maxSpeed) * 100, 100) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>SPEED</Text>
        <Text style={[styles.status, { color }]}>{status}</Text>
      </View>

      <View style={styles.speedDisplay}>
        <Text style={[styles.speedValue, { color }]}>{speedMph.toFixed(1)}</Text>
        <Text style={styles.speedUnit}>MPH</Text>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>5-55</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.legendText}>55-75</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.error }]} />
          <Text style={styles.legendText}>75+</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  status: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 1,
  },
  speedDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.md,
  },
  speedValue: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.bold,
  },
  speedUnit: {
    marginLeft: SPACING.xs,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.medium,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  legendText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
});

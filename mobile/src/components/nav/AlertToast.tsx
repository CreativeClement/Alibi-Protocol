import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../../constants/theme';
import { alertIcon, alertTitle } from './maneuverIcon';
import type { MapAlert } from '../../types';

interface AlertToastProps {
  alert: MapAlert | null;
}

const TONE_COLOR: Record<'error' | 'warning' | 'primary', string> = {
  error: COLORS.error,
  warning: COLORS.warning,
  primary: COLORS.primary,
};

export function AlertToast({ alert }: AlertToastProps) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: alert ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [alert, slide]);

  if (!alert) return null;

  const { icon, tone } = alertIcon(alert.type);
  const color = TONE_COLOR[tone];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderColor: color,
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color }]}>{alertTitle(alert.type)}</Text>
        {alert.label ? (
          <Text style={styles.label} numberOfLines={1}>
            {alert.label}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.overlayLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
    ...SHADOW.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.wide,
  },
  label: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});

import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, LayoutChangeEvent } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Polyline as SvgPolyline } from 'react-native-svg';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import type {
  LatLng,
  LocationCoords,
  MapAlert,
  MapType,
  MapViewMode,
  Place,
  Route,
} from '../types';
import { alertIcon } from './nav/maneuverIcon';

export interface MapBackgroundProps {
  location: LocationCoords;
  speedMph: number;
  route?: Route | null;
  destination?: Place | null;
  alerts?: MapAlert[];
  viewMode?: MapViewMode;
  mapType?: MapType;
  headingUp?: boolean;
  navigating?: boolean;
  recenterSignal?: number;
  nightMode?: boolean;
}

const GRID_LINES = Array.from({ length: 9 });

const ALERT_TONE: Record<'error' | 'warning' | 'primary', string> = {
  error: COLORS.error,
  warning: COLORS.warning,
  primary: COLORS.primary,
};

/**
 * Web fallback for the native map. react-native-maps is native-only, so on
 * web we render a tactical grid that projects the live route, destination,
 * and alert markers into the viewport. The full Google map renders on device.
 */
export function MapBackground({
  location,
  route,
  destination,
  alerts = [],
  navigating = false,
}: MapBackgroundProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  // Compute a bounding box across all visible geometry, then project to pixels.
  const projection = useMemo(() => {
    const pts: LatLng[] = [];
    pts.push({ latitude: location.latitude, longitude: location.longitude });
    if (route?.coordinates?.length) pts.push(...route.coordinates);
    if (destination) {
      pts.push({ latitude: destination.latitude, longitude: destination.longitude });
    }
    alerts.forEach((a) => pts.push(a.location));

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of pts) {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    }
    // Pad so a single point doesn't collapse the box.
    const latPad = Math.max((maxLat - minLat) * 0.15, 0.004);
    const lngPad = Math.max((maxLng - minLng) * 0.15, 0.004);
    minLat -= latPad;
    maxLat += latPad;
    minLng -= lngPad;
    maxLng += lngPad;

    const pad = 48;
    const w = Math.max(size.width - pad * 2, 1);
    const h = Math.max(size.height - pad * 2, 1);

    const project = (p: LatLng) => {
      const x = pad + ((p.longitude - minLng) / (maxLng - minLng || 1)) * w;
      const y = pad + ((maxLat - p.latitude) / (maxLat - minLat || 1)) * h;
      return { x, y };
    };
    return { project };
  }, [location, route, destination, alerts, size]);

  const routePoints = useMemo(() => {
    if (!route?.coordinates?.length || size.width === 0) return '';
    return route.coordinates
      .map((c) => {
        const { x, y } = projection.project(c);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [route, projection, size]);

  const userPx = size.width ? projection.project(location) : { x: 0, y: 0 };
  const destPx =
    destination && size.width
      ? projection.project({
          latitude: destination.latitude,
          longitude: destination.longitude,
        })
      : null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} onLayout={onLayout}>
      {/* Grid */}
      <View style={styles.grid} pointerEvents="none">
        {GRID_LINES.map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLineH, { top: `${((i + 1) / 10) * 100}%` }]} />
        ))}
        {GRID_LINES.map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLineV, { left: `${((i + 1) / 10) * 100}%` }]} />
        ))}
      </View>

      {/* Route polyline */}
      {routePoints && size.width > 0 ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgPolyline
            points={routePoints}
            fill="none"
            stroke={COLORS.primaryDark}
            strokeWidth={10}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <SvgPolyline
            points={routePoints}
            fill="none"
            stroke={COLORS.primary}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}

      {/* Alert markers */}
      {size.width > 0
        ? alerts.map((a) => {
            const { x, y } = projection.project(a.location);
            const { icon, tone } = alertIcon(a.type);
            const color = ALERT_TONE[tone];
            return (
              <View
                key={a.id}
                pointerEvents="none"
                style={[styles.alertMarker, { left: x - 14, top: y - 14, borderColor: color }]}
              >
                <MaterialCommunityIcons name={icon as any} size={16} color={color} />
              </View>
            );
          })
        : null}

      {/* Destination marker */}
      {destPx ? (
        <View
          pointerEvents="none"
          style={[styles.destMarker, { left: destPx.x - 16, top: destPx.y - 32 }]}
        >
          <Ionicons name="location" size={32} color={COLORS.success} />
        </View>
      ) : null}

      {/* User marker */}
      <View
        pointerEvents="none"
        style={[styles.markerWrap, { left: userPx.x - 32, top: userPx.y - 32 }]}
      >
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
        {navigating ? 'NAVIGATING · MAP PREVIEW' : 'MAP PREVIEW · LIVE ON DEVICE'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceAlt ?? COLORS.surface,
  },
  grid: { ...StyleSheet.absoluteFillObject },
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
    position: 'absolute',
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
  destMarker: { position: 'absolute' },
  alertMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordChip: {
    position: 'absolute',
    top: SPACING.lg,
    alignSelf: 'center',
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
    bottom: SPACING.lg,
    alignSelf: 'center',
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
  },
});

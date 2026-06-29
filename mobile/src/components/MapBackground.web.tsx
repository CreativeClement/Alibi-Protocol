import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import maplibregl from 'maplibre-gl';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NAV_CONFIG } from '../constants/api';
import type { MapAlert, MapType, MapViewMode, Place, Route, LocationCoords } from '../types';

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

const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const STYLE_DAY = 'https://tiles.openfreemap.org/styles/liberty';

const ALERT_HEX: Record<string, string> = {
  police: COLORS.error,
  crash: COLORS.error,
  hazard: COLORS.warning,
  camera: COLORS.warning,
  incident: COLORS.primary,
};

// Inject the minimal MapLibre GL stylesheet + marker animations once. We avoid
// a CSS import so the Metro web bundler stays happy.
function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('alibi-maplibre-css')) return;
  const el = document.createElement('style');
  el.id = 'alibi-maplibre-css';
  el.textContent = `
.maplibregl-map{overflow:hidden;-webkit-tap-highlight-color:transparent;}
.maplibregl-canvas-container,.maplibregl-canvas{position:absolute;top:0;left:0;width:100%;height:100%;}
.maplibregl-canvas-container.maplibregl-interactive{cursor:grab;}
.maplibregl-ctrl-attrib{display:none!important;}
.alibi-user-marker{width:26px;height:26px;border-radius:50%;background:${COLORS.primary};border:3px solid ${COLORS.background};box-shadow:0 0 0 6px ${COLORS.primaryMuted};display:flex;align-items:center;justify-content:center;}
.alibi-user-marker::after{content:'';position:absolute;width:26px;height:26px;border-radius:50%;border:2px solid ${COLORS.primary};animation:alibi-pulse 1.8s ease-out infinite;}
@keyframes alibi-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(3.2);opacity:0}}
.alibi-dest-marker{width:18px;height:18px;border-radius:50% 50% 50% 0;background:${COLORS.success};border:2px solid ${COLORS.background};transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.5);}
.alibi-alert-marker{width:26px;height:26px;border-radius:50%;background:${COLORS.background};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;}
`;
  document.head.appendChild(el);
}

const BUILDINGS_LAYER = '3d-buildings';
const ROUTE_SRC = 'alibi-route';

/**
 * Web map background. Renders a real MapLibre GL vector map (OpenFreeMap dark
 * style) with 3D building extrusions, the live route polyline drawn on the
 * actual streets, and a Waze-style follow camera. Native uses
 * MapBackground.tsx (react-native-maps + Google).
 */
export function MapBackground({
  location,
  route,
  destination,
  alerts = [],
  viewMode = '3d',
  headingUp = true,
  navigating = false,
  recenterSignal = 0,
  nightMode = true,
}: MapBackgroundProps) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const alertMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Add the 3D buildings + route source/layers to the current style.
  const setupLayers = (map: maplibregl.Map) => {
    if (!map.getLayer(BUILDINGS_LAYER)) {
      try {
        map.addLayer({
          id: BUILDINGS_LAYER,
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': nightMode ? '#16202b' : '#c8cdd6',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.85,
          },
        });
      } catch {
        // Some styles may name the source differently; ignore if unavailable.
      }
    }

    if (!map.getSource(ROUTE_SRC)) {
      map.addSource(ROUTE_SRC, {
        type: 'geojson',
        data: routeGeoJson(route),
      });
      map.addLayer({
        id: 'alibi-route-casing',
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.primaryDark, 'line-width': 11 },
      });
      map.addLayer({
        id: 'alibi-route-line',
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.primary, 'line-width': 6 },
      });
    }
  };

  // Initialize the map once.
  useEffect(() => {
    ensureStyles();
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current as HTMLElement,
      style: nightMode ? STYLE_DARK : STYLE_DAY,
      center: [location.longitude, location.latitude],
      zoom: 15,
      pitch: viewMode === '3d' ? NAV_CONFIG.pitch3d : 0,
      attributionControl: false,
      dragRotate: true,
    });
    mapRef.current = map;

    map.on('load', () => {
      readyRef.current = true;
      setupLayers(map);

      // User marker
      const userEl = document.createElement('div');
      userEl.className = 'alibi-user-marker';
      userMarkerRef.current = new maplibregl.Marker({ element: userEl })
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap base style for day/night, then re-add custom layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(nightMode ? STYLE_DARK : STYLE_DAY);
    map.once('styledata', () => setupLayers(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightMode]);

  // Update the route geometry whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(ROUTE_SRC) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(routeGeoJson(route));

    // Fit the whole route when previewing (not actively navigating).
    if (route && route.coordinates.length > 1 && !navigating) {
      const bounds = new maplibregl.LngLatBounds();
      route.coordinates.forEach((c) => bounds.extend([c.longitude, c.latitude]));
      map.fitBounds(bounds, {
        padding: { top: 90, right: 60, bottom: 240, left: 60 },
        duration: 700,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, navigating]);

  // Follow camera while navigating + keep user marker in sync.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    userMarkerRef.current?.setLngLat([location.longitude, location.latitude]);

    if (navigating) {
      const heading =
        headingUp && location.heading != null && location.heading >= 0
          ? location.heading
          : map.getBearing();
      map.easeTo({
        center: [location.longitude, location.latitude],
        bearing: headingUp ? heading : 0,
        pitch: viewMode === '3d' ? NAV_CONFIG.pitch3d : 0,
        zoom: NAV_CONFIG.navZoom,
        duration: 800,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigating, viewMode, headingUp]);

  // Recenter when requested.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || recenterSignal === 0) return;
    map.easeTo({
      center: [location.longitude, location.latitude],
      pitch: viewMode === '3d' ? NAV_CONFIG.pitch3d : 0,
      zoom: NAV_CONFIG.navZoom,
      duration: 600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  // Destination marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    if (destination) {
      const el = document.createElement('div');
      el.className = 'alibi-dest-marker';
      destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([destination.longitude, destination.latitude])
        .addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  // Alert markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    alertMarkersRef.current.forEach((m) => m.remove());
    alertMarkersRef.current = alerts.map((a) => {
      const el = document.createElement('div');
      el.className = 'alibi-alert-marker';
      el.style.border = `2px solid ${ALERT_HEX[a.type] ?? COLORS.primary}`;
      el.style.color = ALERT_HEX[a.type] ?? COLORS.primary;
      el.textContent = a.type === 'police' ? '!' : a.type === 'crash' ? 'X' : '•';
      return new maplibregl.Marker({ element: el })
        .setLngLat([a.location.longitude, a.location.latitude])
        .addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View ref={containerRef} style={StyleSheet.absoluteFill} />
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>
          {navigating ? 'LIVE NAVIGATION' : route ? 'ROUTE PREVIEW' : 'LIVE MAP'}
        </Text>
      </View>
    </View>
  );
}

function routeGeoJson(route?: Route | null): GeoJSON.Feature<GeoJSON.LineString> {
  const coords =
    route?.coordinates?.map((c) => [c.longitude, c.latitude] as [number, number]) ?? [];
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  };
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: SPACING.lg,
    alignSelf: 'center',
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  badgeText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
  },
});

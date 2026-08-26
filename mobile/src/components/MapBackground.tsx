import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapType as RNMapType,
} from 'react-native-maps';
import { COLORS } from '../constants/theme';
import { NAV_CONFIG } from '../constants/api';
import type {
  LocationCoords,
  MapAlert,
  MapType,
  MapViewMode,
  Place,
  Route,
} from '../types';
import { bearingDegrees } from '../services/navigation/geo';
import { NAV_DARK_MAP_STYLE } from './mapStyle';

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
  /** Increment this value to force a recenter on the user. */
  recenterSignal?: number;
  nightMode?: boolean;
}

const ALERT_COLORS: Record<string, string> = {
  police: COLORS.error,
  crash: COLORS.error,
  hazard: COLORS.warning,
  camera: COLORS.warning,
  incident: COLORS.primary,
};

/**
 * Native map background (iOS / Android). Renders the live route polyline,
 * destination + alert markers, and drives a Waze-style follow camera with
 * 2D/3D pitch and heading-up rotation. On web, Metro resolves
 * MapBackground.web.tsx instead.
 */
export function MapBackground({
  location,
  speedMph,
  route,
  destination,
  alerts = [],
  viewMode = '3d',
  mapType = 'standard',
  headingUp = true,
  navigating = false,
  recenterSignal = 0,
  nightMode = true,
}: MapBackgroundProps) {
  const mapRef = useRef<MapView>(null);
  const lastHeading = useRef(0);

  // Drive the follow camera while navigating or when a recenter is requested.
  useEffect(() => {
    if (!mapRef.current) return;

    const heading =
      headingUp && location.heading != null && location.heading >= 0
        ? location.heading
        : lastHeading.current;
    lastHeading.current = heading;

    if (navigating) {
      mapRef.current.animateCamera(
        {
          center: { latitude: location.latitude, longitude: location.longitude },
          pitch: viewMode === '3d' ? NAV_CONFIG.pitch3d : 0,
          heading: headingUp ? heading : 0,
          zoom: NAV_CONFIG.navZoom,
        },
        { duration: 800 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigating, viewMode, headingUp]);

  // Recenter trigger (e.g. user tapped the navigate button).
  useEffect(() => {
    if (recenterSignal === 0 || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: { latitude: location.latitude, longitude: location.longitude },
        pitch: viewMode === '3d' ? NAV_CONFIG.pitch3d : 0,
        zoom: NAV_CONFIG.navZoom,
      },
      { duration: 600 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  // Fit the whole route when previewing it.
  useEffect(() => {
    if (!mapRef.current || navigating || !route || route.coordinates.length < 2) return;
    mapRef.current.fitToCoordinates(route.coordinates, {
      edgePadding: {
        top: NAV_CONFIG.overviewPadding,
        right: NAV_CONFIG.overviewPadding,
        bottom: NAV_CONFIG.overviewPadding * 3,
        left: NAV_CONFIG.overviewPadding,
      },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, navigating]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      customMapStyle={nightMode ? NAV_DARK_MAP_STYLE : undefined}
      mapType={mapType as RNMapType}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      pitchEnabled
      rotateEnabled
    >
      {route && route.coordinates.length > 1 ? (
        <>
          {/* Route casing for contrast */}
          <Polyline
            coordinates={route.coordinates}
            strokeColor={COLORS.primaryDark}
            strokeWidth={10}
          />
          <Polyline
            coordinates={route.coordinates}
            strokeColor={COLORS.primary}
            strokeWidth={6}
          />
        </>
      ) : null}

      {destination ? (
        <Marker
          coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
          title={destination.name}
          description={destination.address}
          pinColor={COLORS.success}
        />
      ) : null}

      {alerts.map((a) => (
        <Marker
          key={a.id}
          coordinate={a.location}
          title={a.label ?? a.type}
          pinColor={ALERT_COLORS[a.type] ?? COLORS.primary}
        />
      ))}
    </MapView>
  );
}

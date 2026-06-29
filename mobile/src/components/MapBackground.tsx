import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LocationCoords } from '../types';

interface MapBackgroundProps {
  location: LocationCoords;
  speedMph: number;
}

/**
 * Native map background (iOS / Android).
 * On web, Metro resolves MapBackground.web.tsx instead, which renders a
 * lightweight placeholder since react-native-maps is native-only.
 */
export function MapBackground({ location, speedMph }: MapBackgroundProps) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation
      showsMyLocationButton
    >
      <Marker
        coordinate={{ latitude: location.latitude, longitude: location.longitude }}
        title="Your Location"
        description={`Speed: ${speedMph.toFixed(1)} MPH`}
      />
    </MapView>
  );
}

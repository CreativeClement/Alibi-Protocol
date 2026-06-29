import * as Location from 'expo-location';
import { LocationCoords } from '../types';
import { LOCATION_CONFIG } from '../constants/api';

/** Meters-per-second to miles-per-hour conversion factor */
const MS_TO_MPH = 2.23694;

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    if (__DEV__) console.warn('Location permission error:', error);
    return false;
  }
}

export async function getCurrentLocation(): Promise<LocationCoords | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude ?? undefined,
      accuracy: location.coords.accuracy ?? undefined,
      heading: location.coords.heading ?? undefined,
      speed: location.coords.speed,
      mocked: location.mocked,
    };
  } catch (error) {
    if (__DEV__) console.warn('Get current location error:', error);
    return null;
  }
}

export async function startLocationTracking(
  onLocationChange: (location: LocationCoords) => void,
  accuracy = Location.Accuracy.High
): Promise<() => void> {
  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy,
        timeInterval: LOCATION_CONFIG.trackingIntervalMs,
        distanceInterval: LOCATION_CONFIG.distanceIntervalMeters,
      },
      (location) => {
        onLocationChange({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude ?? undefined,
          accuracy: location.coords.accuracy ?? undefined,
          altitudeAccuracy: location.coords.altitudeAccuracy ?? undefined,
          heading: location.coords.heading ?? undefined,
          speed: location.coords.speed,
          mocked: location.mocked,
        });
      }
    );

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  } catch (error) {
    if (__DEV__) console.warn('Start location tracking error:', error);
    return () => {};
  }
}

export async function getStateFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const reverseGeocoded = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (reverseGeocoded.length > 0) {
      const address = reverseGeocoded[0];
      return address.region || 'US';
    }

    return 'US';
  } catch (error) {
    if (__DEV__) console.warn('Reverse geocode error:', error);
    return 'US';
  }
}

export function speedMsToMph(speedMs: number | null): number {
  if (speedMs == null || speedMs <= 0) return 0;
  return speedMs * MS_TO_MPH;
}

export function getSpeedColor(speedMph: number): string {
  if (speedMph < 55) return '#32D74B'; // Green
  if (speedMph < 75) return '#FF9500'; // Orange
  return '#FF3333'; // Red
}

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { LocationCoords } from '../types';
import * as LocationService from '../services/location';

interface UseLocationOptions {
  enabled?: boolean;
  accuracy?: number;
}

export function useLocation(options: UseLocationOptions = {}) {
  const { enabled = true } = options;

  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        setLoading(true);

        // Request permission
        const hasPermission = await LocationService.requestLocationPermission();
        if (!hasPermission) {
          setError('Location permission denied');
          setLoading(false);
          return;
        }

        // Get initial location
        const initialLocation = await LocationService.getCurrentLocation();
        if (initialLocation) {
          setLocation(initialLocation);
        }

        // Start tracking
        unsubscribe = await LocationService.startLocationTracking(
          (newLocation) => {
            setLocation(newLocation);
            setError(null);
          },
          Location.Accuracy.High
        );

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get location');
        setLoading(false);
      }
    })();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [enabled]);

  const getState = useCallback(async (): Promise<string> => {
    if (!location) return 'US';
    return await LocationService.getStateFromCoordinates(
      location.latitude,
      location.longitude
    );
  }, [location]);

  return {
    location,
    error,
    loading,
    getState,
  };
}

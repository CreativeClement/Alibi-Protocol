import { NAV_CONFIG } from '../../constants/api';
import { MapboxProvider } from './mapboxProvider';
import { OsmProvider } from './osmProvider';
import type { NavigationProvider } from './types';

let cached: NavigationProvider | null = null;

/**
 * Returns the active navigation provider.
 *
 * Selection logic:
 *  - provider === 'mapbox' (or 'auto' with a token present) → Mapbox
 *  - otherwise → free OSM (OSRM + Nominatim)
 */
export function getNavigationProvider(): NavigationProvider {
  if (cached) return cached;

  const { provider, mapboxToken } = NAV_CONFIG;
  const wantsMapbox =
    provider === 'mapbox' || (provider === 'auto' && mapboxToken.length > 0);

  if (wantsMapbox && mapboxToken.length > 0) {
    cached = new MapboxProvider(mapboxToken);
  } else {
    cached = new OsmProvider();
  }
  return cached;
}

/** Test seam: reset the memoized provider (e.g. after env changes). */
export function resetNavigationProvider(): void {
  cached = null;
}

export * from './geo';
export type { NavigationProvider, RouteOptions } from './types';

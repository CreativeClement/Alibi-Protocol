import type { LatLng, Place, Route, NavPreferences } from '../../types';

export interface RouteOptions {
  avoidHighways?: boolean;
  avoidTolls?: boolean;
}

/**
 * A navigation provider abstracts routing + geocoding so the app can swap
 * OSM (free), Mapbox, or Google without touching the UI layer.
 */
export interface NavigationProvider {
  readonly name: string;
  /** Geocode a free-text query into ranked place results. */
  search(query: string, near?: LatLng): Promise<Place[]>;
  /** Reverse geocode a coordinate into a single place (best-effort). */
  reverse(point: LatLng): Promise<Place | null>;
  /** Compute a route between origin and destination. */
  route(
    origin: LatLng,
    destination: LatLng,
    options?: RouteOptions
  ): Promise<Route | null>;
}

export type { LatLng, Place, Route, NavPreferences };

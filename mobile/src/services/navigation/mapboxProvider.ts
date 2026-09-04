import { NAV_CONFIG } from '../../constants/api';
import type { LatLng, ManeuverType, Place, Route, RouteStep } from '../../types';
import { decodePolyline, haversineMeters } from './geo';
import type { NavigationProvider, RouteOptions } from './types';

/**
 * Mapbox provider — higher quality, traffic-aware routing + search.
 * Active only when EXPO_PUBLIC_MAPBOX_TOKEN is set; otherwise the selector
 * falls back to the free OSM provider. All calls are plain fetch, so no extra
 * SDK is required.
 */
export class MapboxProvider implements NavigationProvider {
  readonly name = 'mapbox';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async search(query: string, near?: LatLng): Promise<Place[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const params = new URLSearchParams({
      access_token: this.token,
      limit: '6',
      types: 'address,poi,place',
    });
    if (near) params.set('proximity', `${near.longitude},${near.latitude}`);

    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        trimmed
      )}.json?${params.toString()}`
    );
    if (!res.ok) throw new Error(`Mapbox search failed: ${res.status}`);
    const data = (await res.json()) as MapboxGeocode;

    return (data.features || []).map((f) => {
      const [lng, lat] = f.center;
      const place: Place = {
        id: f.id,
        name: f.text || f.place_name,
        address: f.place_name,
        latitude: lat,
        longitude: lng,
      };
      if (near) {
        place.distanceMeters = haversineMeters(near, {
          latitude: lat,
          longitude: lng,
        });
      }
      return place;
    });
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const params = new URLSearchParams({ access_token: this.token, limit: '1' });
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json?${params.toString()}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as MapboxGeocode;
    const f = data.features?.[0];
    if (!f) return null;
    const [lng, lat] = f.center;
    return {
      id: f.id,
      name: f.text || f.place_name,
      address: f.place_name,
      latitude: lat,
      longitude: lng,
    };
  }

  async route(
    origin: LatLng,
    destination: LatLng,
    options?: RouteOptions
  ): Promise<Route | null> {
    const exclude: string[] = [];
    if (options?.avoidHighways) exclude.push('motorway');
    if (options?.avoidTolls) exclude.push('toll');

    const params = new URLSearchParams({
      access_token: this.token,
      overview: 'full',
      geometries: 'polyline',
      steps: 'true',
      annotations: 'duration',
    });
    if (exclude.length) params.set('exclude', exclude.join(','));

    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params.toString()}`
    );
    if (!res.ok) throw new Error(`Mapbox directions failed: ${res.status}`);
    const data = (await res.json()) as MapboxDirections;
    const r = data.routes?.[0];
    if (!r) return null;

    const coordinates = decodePolyline(r.geometry, 5);
    const steps: RouteStep[] = [];
    for (const leg of r.legs) {
      for (const s of leg.steps) {
        const loc = s.maneuver.location;
        steps.push({
          instruction: s.maneuver.instruction || s.name || 'Continue',
          maneuver: mapManeuver(s.maneuver.type, s.maneuver.modifier),
          distanceMeters: s.distance,
          durationSeconds: s.duration,
          location: { latitude: loc[1], longitude: loc[0] },
          name: s.name || undefined,
        });
      }
    }

    return {
      coordinates,
      steps,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      provider: this.name,
    };
  }
}

function mapManeuver(type: string, modifier?: string): ManeuverType {
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';
  if (type === 'merge') return 'merge';
  if (type === 'on ramp' || type === 'ramp') return 'ramp';
  if (type === 'fork') return modifier?.includes('left') ? 'fork-left' : 'fork-right';
  switch (modifier) {
    case 'left':
      return 'turn-left';
    case 'right':
      return 'turn-right';
    case 'slight left':
      return 'turn-slight-left';
    case 'slight right':
      return 'turn-slight-right';
    case 'sharp left':
      return 'turn-sharp-left';
    case 'sharp right':
      return 'turn-sharp-right';
    case 'uturn':
      return 'uturn';
    case 'straight':
      return 'straight';
    default:
      return 'straight';
  }
}

interface MapboxGeocode {
  features?: { id: string; text: string; place_name: string; center: [number, number] }[];
}

interface MapboxDirections {
  routes?: {
    geometry: string;
    distance: number;
    duration: number;
    legs: { steps: MapboxStep[] }[];
  }[];
}

interface MapboxStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    instruction?: string;
    location: [number, number];
  };
}

import { NAV_CONFIG } from '../../constants/api';
import type { LatLng, ManeuverType, Place, Route, RouteStep } from '../../types';
import { decodePolyline, haversineMeters } from './geo';
import type { NavigationProvider, RouteOptions } from './types';

/**
 * Free OpenStreetMap-based provider:
 *  - Routing via the public OSRM demo server
 *  - Search/geocoding via Nominatim
 *
 * No API key required. Public servers are rate-limited, so this is ideal for
 * prototyping; swap in a Mapbox/Google provider for production-grade traffic.
 */
export class OsmProvider implements NavigationProvider {
  readonly name = 'osm';

  async search(query: string, near?: LatLng): Promise<Place[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const params = new URLSearchParams({
      q: trimmed,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
    });
    // Bias results toward the user with a viewbox when we know their location.
    if (near) {
      const d = 0.75; // ~80km box
      params.set(
        'viewbox',
        `${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`
      );
    }

    const res = await fetch(
      `${NAV_CONFIG.nominatimBaseUrl}/search?${params.toString()}`,
      {
        headers: {
          // Nominatim usage policy requires an identifying UA / referer.
          'Accept': 'application/json',
        },
      }
    );
    if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);
    const data = (await res.json()) as NominatimResult[];

    return data.map((r) => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      const place: Place = {
        id: String(r.place_id),
        name: primaryName(r),
        address: r.display_name,
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
    const params = new URLSearchParams({
      lat: String(point.latitude),
      lon: String(point.longitude),
      format: 'jsonv2',
    });
    const res = await fetch(
      `${NAV_CONFIG.nominatimBaseUrl}/reverse?${params.toString()}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const r = (await res.json()) as NominatimResult;
    if (!r || !r.lat) return null;
    return {
      id: String(r.place_id ?? 'reverse'),
      name: primaryName(r),
      address: r.display_name,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
    };
  }

  async route(
    origin: LatLng,
    destination: LatLng,
    _options?: RouteOptions
  ): Promise<Route | null> {
    // OSRM demo server: coordinates are lng,lat ; request full geometry + steps.
    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'polyline',
      steps: 'true',
      annotations: 'false',
    });
    const url = `${NAV_CONFIG.osrmBaseUrl}/route/v1/driving/${coords}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM route failed: ${res.status}`);
    const data = (await res.json()) as OsrmResponse;
    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const r = data.routes[0];
    const coordinates = decodePolyline(r.geometry, 5);
    const steps: RouteStep[] = [];
    for (const leg of r.legs) {
      for (const s of leg.steps) {
        const loc = s.maneuver.location;
        steps.push({
          instruction: buildInstruction(s),
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

function primaryName(r: NominatimResult): string {
  if (r.name && r.name.length > 0) return r.name;
  // Fall back to the first comma-separated chunk of the display name.
  return r.display_name?.split(',')[0] ?? 'Unknown location';
}

function buildInstruction(s: OsrmStep): string {
  const type = s.maneuver.type;
  const modifier = s.maneuver.modifier;
  const road = s.name && s.name.length > 0 ? s.name : '';

  if (type === 'depart') return road ? `Head out on ${road}` : 'Start driving';
  if (type === 'arrive') return 'Arrive at your destination';
  if (type === 'roundabout' || type === 'rotary') {
    return road ? `Take the roundabout onto ${road}` : 'Take the roundabout';
  }
  if (type === 'merge') return road ? `Merge onto ${road}` : 'Merge';
  if (type === 'on ramp' || type === 'ramp') {
    return road ? `Take the ramp toward ${road}` : 'Take the ramp';
  }
  if (type === 'fork') {
    const side = modifier?.includes('left') ? 'left' : 'right';
    return road ? `Keep ${side} onto ${road}` : `Keep ${side} at the fork`;
  }

  const verb = modifierToVerb(modifier);
  if (road) return `${verb} onto ${road}`;
  return verb;
}

function modifierToVerb(modifier?: string): string {
  switch (modifier) {
    case 'left':
      return 'Turn left';
    case 'right':
      return 'Turn right';
    case 'slight left':
      return 'Slight left';
    case 'slight right':
      return 'Slight right';
    case 'sharp left':
      return 'Sharp left';
    case 'sharp right':
      return 'Sharp right';
    case 'uturn':
      return 'Make a U-turn';
    case 'straight':
      return 'Continue straight';
    default:
      return 'Continue';
  }
}

function mapManeuver(type: string, modifier?: string): ManeuverType {
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';
  if (type === 'merge') return 'merge';
  if (type === 'on ramp' || type === 'ramp') return 'ramp';
  if (type === 'fork') {
    return modifier?.includes('left') ? 'fork-left' : 'fork-right';
  }
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

// --- OSRM / Nominatim response shapes (minimal) ---

interface NominatimResult {
  place_id?: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface OsrmResponse {
  code: string;
  routes: OsrmRoute[];
}

interface OsrmRoute {
  geometry: string;
  distance: number;
  duration: number;
  legs: { steps: OsrmStep[] }[];
}

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
}

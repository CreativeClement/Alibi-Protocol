import type { LatLng } from '../../types';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance between two points in meters (Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing (degrees, 0-360) from point a to point b. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Shortest distance (meters) from point p to the polyline defined by `line`.
 * Also returns the index of the closest segment for progress tracking.
 */
export function distanceToPolyline(
  p: LatLng,
  line: LatLng[]
): { distanceMeters: number; segmentIndex: number } {
  if (line.length === 0) return { distanceMeters: Infinity, segmentIndex: 0 };
  if (line.length === 1) {
    return { distanceMeters: haversineMeters(p, line[0]), segmentIndex: 0 };
  }

  let best = Infinity;
  let bestIndex = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const d = distanceToSegment(p, line[i], line[i + 1]);
    if (d < best) {
      best = d;
      bestIndex = i;
    }
  }
  return { distanceMeters: best, segmentIndex: bestIndex };
}

/** Distance (meters) from point p to the segment a-b, using an equirectangular projection. */
function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  // Project to a local planar space (meters) centered on `a`.
  const latRef = toRad(a.latitude);
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(latRef);

  const ax = 0;
  const ay = 0;
  const bx = (b.longitude - a.longitude) * mPerDegLng;
  const by = (b.latitude - a.latitude) * mPerDegLat;
  const px = (p.longitude - a.longitude) * mPerDegLng;
  const py = (p.latitude - a.latitude) * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;
  if (segLenSq === 0) return Math.hypot(px - ax, py - ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Decode an encoded polyline (Google/OSRM format) into coordinates.
 * @param precision 5 for Google/Mapbox default, 6 for OSRM v5 geometries=polyline6
 */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = Math.pow(10, precision);
  const coordinates: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ latitude: lat / factor, longitude: lng / factor });
  }
  return coordinates;
}

/** Format a distance in meters per the chosen unit system. */
export function formatDistance(
  meters: number,
  units: 'imperial' | 'metric'
): string {
  if (units === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 1000) return `${Math.round(feet / 10) * 10} ft`;
    const miles = meters / 1609.344;
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Format a duration in seconds as a compact "1 hr 5 min" / "8 min" string. */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`;
}

/** Compute an arrival clock time string from now + duration. */
export function formatEta(seconds: number): string {
  const arrival = new Date(Date.now() + seconds * 1000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

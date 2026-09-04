import type { AlertType, LatLng, MapAlert, VaultIncident } from '../../types';

/**
 * Alert source abstraction. Local alerts are derived from the device's own
 * reported incidents today; a community feed can be plugged in later by
 * implementing `fetchCommunityAlerts` against a backend.
 */
export interface AlertSource {
  getAlerts(near: LatLng): Promise<MapAlert[]>;
}

/** In-memory store of locally reported alerts (police, hazards, etc.). */
class LocalAlertStore implements AlertSource {
  private alerts: MapAlert[] = [];

  add(type: AlertType, location: LatLng, label?: string): MapAlert {
    const alert: MapAlert = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      location,
      label,
      createdAt: Date.now(),
      source: 'local',
    };
    this.alerts.unshift(alert);
    return alert;
  }

  /** Seed from existing vault incidents so past encounters appear on the map. */
  seedFromIncidents(incidents: VaultIncident[]): void {
    for (const inc of incidents) {
      if (inc.latitude && inc.longitude) {
        this.alerts.push({
          id: `incident-${inc.id}`,
          type: 'incident',
          location: { latitude: inc.latitude, longitude: inc.longitude },
          label: 'Past incident recorded here',
          createdAt: inc.timestamp,
          source: 'local',
        });
      }
    }
  }

  clear(): void {
    this.alerts = [];
  }

  async getAlerts(_near: LatLng): Promise<MapAlert[]> {
    // Local alerts are always returned; proximity filtering happens in the hook.
    return [...this.alerts];
  }
}

export const localAlerts = new LocalAlertStore();

/**
 * Community feed (backend-ready stub). Wire this to a real endpoint to enable
 * Waze-style shared alerts. Returns [] until a backend is configured.
 */
export async function fetchCommunityAlerts(_near: LatLng): Promise<MapAlert[]> {
  // TODO: replace with `fetch(`${API}/alerts?lat=..&lng=..`)` when backend exists.
  return [];
}

/** Merge local + community alerts. */
export async function getAllAlerts(near: LatLng): Promise<MapAlert[]> {
  const [local, community] = await Promise.all([
    localAlerts.getAlerts(near),
    fetchCommunityAlerts(near).catch(() => [] as MapAlert[]),
  ]);
  return [...local, ...community];
}

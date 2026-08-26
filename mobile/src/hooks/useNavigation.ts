import { useCallback, useEffect, useRef, useState } from 'react';
import { NAV_CONFIG } from '../constants/api';
import type {
  LatLng,
  LocationCoords,
  MapAlert,
  NavPhase,
  NavPreferences,
  Place,
  Route,
  RouteStep,
} from '../types';
import {
  getNavigationProvider,
  haversineMeters,
  distanceToPolyline,
  formatDistance,
} from '../services/navigation';
import { getAllAlerts } from '../services/navigation/alerts';
import { speak, stop as stopVoice } from '../services/voice';

interface UseNavigationArgs {
  location: LocationCoords | null;
  prefs: NavPreferences;
}

interface NavState {
  phase: NavPhase;
  destination: Place | null;
  route: Route | null;
  /** Index of the current (active) step in route.steps. */
  currentStepIndex: number;
  /** Distance in meters to the next maneuver. */
  distanceToNextManeuverMeters: number;
  /** Remaining distance / duration to destination. */
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  /** Nearby alert currently within proximity, if any. */
  activeAlert: MapAlert | null;
  alerts: MapAlert[];
  recalculating: boolean;
  error: string | null;
}

const initialState: NavState = {
  phase: 'idle',
  destination: null,
  route: null,
  currentStepIndex: 0,
  distanceToNextManeuverMeters: 0,
  remainingDistanceMeters: 0,
  remainingDurationSeconds: 0,
  activeAlert: null,
  alerts: [],
  recalculating: false,
  error: null,
};

export function useNavigation({ location, prefs }: UseNavigationArgs) {
  const [state, setState] = useState<NavState>(initialState);
  const provider = getNavigationProvider();

  // Refs so the live-location effect can read current values without re-subscribing.
  const phaseRef = useRef<NavPhase>('idle');
  const routeRef = useRef<Route | null>(null);
  const stepRef = useRef(0);
  const cuedStepRef = useRef(-1);
  const announcedAlertRef = useRef<Set<string>>(new Set());
  const lastRecalcRef = useRef(0);
  const destRef = useRef<Place | null>(null);

  phaseRef.current = state.phase;
  routeRef.current = state.route;
  stepRef.current = state.currentStepIndex;
  destRef.current = state.destination;

  const buildRoute = useCallback(
    async (origin: LatLng, dest: Place): Promise<Route | null> => {
      return provider.route(origin, dest, {
        avoidHighways: prefs.avoidHighways,
        avoidTolls: prefs.avoidTolls,
      });
    },
    [provider, prefs.avoidHighways, prefs.avoidTolls]
  );

  /** Preview a route to a destination (phase → overview). */
  const previewDestination = useCallback(
    async (dest: Place) => {
      if (!location) {
        setState((s) => ({ ...s, error: 'Waiting for your location…' }));
        return;
      }
      setState((s) => ({ ...s, recalculating: true, error: null }));
      try {
        const route = await buildRoute(
          { latitude: location.latitude, longitude: location.longitude },
          dest
        );
        if (!route) {
          setState((s) => ({
            ...s,
            recalculating: false,
            error: 'No route found to that destination.',
          }));
          return;
        }
        const alerts = await getAllAlerts({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        setState((s) => ({
          ...s,
          phase: 'overview',
          destination: dest,
          route,
          currentStepIndex: 0,
          distanceToNextManeuverMeters: route.steps[0]?.distanceMeters ?? 0,
          remainingDistanceMeters: route.distanceMeters,
          remainingDurationSeconds: route.durationSeconds,
          alerts,
          recalculating: false,
          error: null,
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          recalculating: false,
          error: e instanceof Error ? e.message : 'Routing failed.',
        }));
      }
    },
    [location, buildRoute]
  );

  /** Search for destinations by text. */
  const search = useCallback(
    async (query: string): Promise<Place[]> => {
      const near = location
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined;
      try {
        return await provider.search(query, near);
      } catch {
        return [];
      }
    },
    [provider, location]
  );

  /** Begin active turn-by-turn navigation. */
  const startNavigation = useCallback(() => {
    cuedStepRef.current = -1;
    announcedAlertRef.current = new Set();
    setState((s) => ({ ...s, phase: 'navigating' }));
    const first = routeRef.current?.steps?.[0];
    if (first) speak(`Starting navigation. ${first.instruction}.`, { force: true });
  }, []);

  /** Cancel/stop navigation and return to idle. */
  const stopNavigation = useCallback(() => {
    stopVoice();
    cuedStepRef.current = -1;
    announcedAlertRef.current = new Set();
    setState(initialState);
  }, []);

  const recalculate = useCallback(async () => {
    const dest = destRef.current;
    if (!location || !dest) return;
    const now = Date.now();
    if (now - lastRecalcRef.current < 5000) return; // throttle
    lastRecalcRef.current = now;

    setState((s) => ({ ...s, recalculating: true }));
    speak('Recalculating route.', { force: true });
    try {
      const route = await buildRoute(
        { latitude: location.latitude, longitude: location.longitude },
        dest
      );
      if (route) {
        cuedStepRef.current = -1;
        setState((s) => ({
          ...s,
          route,
          currentStepIndex: 0,
          remainingDistanceMeters: route.distanceMeters,
          remainingDurationSeconds: route.durationSeconds,
          recalculating: false,
        }));
      } else {
        setState((s) => ({ ...s, recalculating: false }));
      }
    } catch {
      setState((s) => ({ ...s, recalculating: false }));
    }
  }, [location, buildRoute]);

  // --- Core driving loop: react to each location update while navigating. ---
  useEffect(() => {
    if (!location) return;
    if (phaseRef.current !== 'navigating') return;
    const route = routeRef.current;
    if (!route || route.steps.length === 0) return;

    const here: LatLng = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    // 1) Off-route detection → recalculation.
    const { distanceMeters: offBy } = distanceToPolyline(here, route.coordinates);
    if (offBy > NAV_CONFIG.offRouteThresholdMeters && !state.recalculating) {
      void recalculate();
      return;
    }

    // 2) Advance the current step if we've reached its maneuver point.
    let stepIdx = stepRef.current;
    let step = route.steps[stepIdx];
    let distToManeuver = haversineMeters(here, step.location);
    while (
      distToManeuver < NAV_CONFIG.stepArrivalDistanceMeters &&
      stepIdx < route.steps.length - 1
    ) {
      stepIdx += 1;
      step = route.steps[stepIdx];
      distToManeuver = haversineMeters(here, step.location);
    }

    // 3) Voice cue when approaching the next maneuver.
    if (
      distToManeuver < NAV_CONFIG.voiceCueDistanceMeters &&
      cuedStepRef.current !== stepIdx &&
      step.maneuver !== 'arrive'
    ) {
      cuedStepRef.current = stepIdx;
      const dist = formatDistance(distToManeuver, prefs.units);
      speak(`In ${dist}, ${step.instruction}.`);
    }

    // 4) Remaining distance/time = sum of steps from current onward.
    let remDist = distToManeuver;
    let remDur = step.durationSeconds;
    for (let i = stepIdx + 1; i < route.steps.length; i++) {
      remDist += route.steps[i].distanceMeters;
      remDur += route.steps[i].durationSeconds;
    }

    // 5) Arrival check.
    const dest = destRef.current;
    const distToDest = dest
      ? haversineMeters(here, { latitude: dest.latitude, longitude: dest.longitude })
      : Infinity;
    if (distToDest < NAV_CONFIG.arrivalDistanceMeters) {
      speak('You have arrived at your destination.', { force: true });
      setState((s) => ({
        ...s,
        phase: 'arrived',
        currentStepIndex: route.steps.length - 1,
        distanceToNextManeuverMeters: 0,
        remainingDistanceMeters: 0,
        remainingDurationSeconds: 0,
      }));
      return;
    }

    // 6) Alert proximity announcements.
    let nearestAlert: MapAlert | null = null;
    if (prefs.alertsEnabled) {
      let nearestDist: number = NAV_CONFIG.alertProximityMeters;
      for (const a of state.alerts) {
        const d = haversineMeters(here, a.location);
        if (d < nearestDist) {
          nearestDist = d;
          nearestAlert = a;
        }
      }
      if (nearestAlert && !announcedAlertRef.current.has(nearestAlert.id)) {
        announcedAlertRef.current.add(nearestAlert.id);
        speak(alertPhrase(nearestAlert.type));
      }
    }

    setState((s) => ({
      ...s,
      currentStepIndex: stepIdx,
      distanceToNextManeuverMeters: distToManeuver,
      remainingDistanceMeters: remDist,
      remainingDurationSeconds: remDur,
      activeAlert: nearestAlert,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const currentStep: RouteStep | null =
    state.route?.steps[state.currentStepIndex] ?? null;
  const nextStep: RouteStep | null =
    state.route?.steps[state.currentStepIndex + 1] ?? null;

  return {
    ...state,
    currentStep,
    nextStep,
    previewDestination,
    search,
    startNavigation,
    stopNavigation,
    recalculate,
  };
}

function alertPhrase(type: MapAlert['type']): string {
  switch (type) {
    case 'police':
      return 'Police reported ahead.';
    case 'crash':
      return 'Crash reported ahead.';
    case 'hazard':
      return 'Hazard ahead. Use caution.';
    case 'camera':
      return 'Speed camera ahead.';
    default:
      return 'Reported incident ahead.';
  }
}

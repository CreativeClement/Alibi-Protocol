import type { AlertType, ManeuverType } from '../../types';

/** Maps a maneuver to a MaterialCommunityIcons glyph name. */
export function maneuverIcon(maneuver: ManeuverType): string {
  switch (maneuver) {
    case 'turn-left':
      return 'arrow-left-top';
    case 'turn-right':
      return 'arrow-right-top';
    case 'turn-slight-left':
    case 'fork-left':
      return 'arrow-top-left';
    case 'turn-slight-right':
    case 'fork-right':
      return 'arrow-top-right';
    case 'turn-sharp-left':
      return 'arrow-left-bottom';
    case 'turn-sharp-right':
      return 'arrow-right-bottom';
    case 'uturn':
      return 'u-turn-left';
    case 'roundabout':
      return 'rotate-right';
    case 'merge':
      return 'call-merge';
    case 'ramp':
      return 'highway';
    case 'arrive':
      return 'map-marker-check';
    case 'depart':
      return 'navigation';
    case 'straight':
    default:
      return 'arrow-up';
  }
}

/** Maps an alert type to its MaterialCommunityIcons glyph + color token key. */
export function alertIcon(type: AlertType): { icon: string; tone: 'error' | 'warning' | 'primary' } {
  switch (type) {
    case 'police':
      return { icon: 'police-badge', tone: 'error' };
    case 'crash':
      return { icon: 'car-emergency', tone: 'error' };
    case 'hazard':
      return { icon: 'alert', tone: 'warning' };
    case 'camera':
      return { icon: 'cctv', tone: 'warning' };
    case 'incident':
    default:
      return { icon: 'map-marker-alert', tone: 'primary' };
  }
}

export function alertTitle(type: AlertType): string {
  switch (type) {
    case 'police':
      return 'POLICE AHEAD';
    case 'crash':
      return 'CRASH AHEAD';
    case 'hazard':
      return 'HAZARD AHEAD';
    case 'camera':
      return 'SPEED CAMERA';
    case 'incident':
    default:
      return 'INCIDENT AHEAD';
  }
}

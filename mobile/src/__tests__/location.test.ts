import { speedMsToMph, getSpeedColor } from '../services/location';

describe('location service', () => {
  describe('speedMsToMph', () => {
    it('converts 0 m/s to 0 mph', () => {
      expect(speedMsToMph(0)).toBe(0);
    });

    it('converts null to 0 mph', () => {
      expect(speedMsToMph(null)).toBe(0);
    });

    it('converts 10 m/s to approximately 22.37 mph', () => {
      const result = speedMsToMph(10);
      expect(result).toBeCloseTo(22.3694, 2);
    });

    it('converts 25 m/s (highway speed) to approximately 55.92 mph', () => {
      const result = speedMsToMph(25);
      expect(result).toBeCloseTo(55.9235, 2);
    });

    it('converts 44.7 m/s to approximately 100 mph', () => {
      const result = speedMsToMph(44.7);
      expect(result).toBeCloseTo(100, 0);
    });

    it('returns 0 for negative speeds (GPS "unavailable" signal)', () => {
      // GPS APIs return -1 for "speed unavailable"
      expect(speedMsToMph(-1)).toBe(0);
      expect(speedMsToMph(-5)).toBe(0);
    });

    it('returns 0 for undefined speed', () => {
      expect(speedMsToMph(undefined as unknown as number | null)).toBe(0);
    });
  });

  describe('getSpeedColor', () => {
    it('returns green for speeds below 55 mph', () => {
      expect(getSpeedColor(0)).toBe('#32D74B');
      expect(getSpeedColor(30)).toBe('#32D74B');
      expect(getSpeedColor(54.9)).toBe('#32D74B');
    });

    it('returns orange for speeds 55-74 mph', () => {
      expect(getSpeedColor(55)).toBe('#FF9500');
      expect(getSpeedColor(65)).toBe('#FF9500');
      expect(getSpeedColor(74.9)).toBe('#FF9500');
    });

    it('returns red for speeds 75+ mph', () => {
      expect(getSpeedColor(75)).toBe('#FF3333');
      expect(getSpeedColor(90)).toBe('#FF3333');
      expect(getSpeedColor(120)).toBe('#FF3333');
    });
  });
});

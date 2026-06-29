import { calculateDifficulty, getSpeedValidationStatus } from '../services/depin';

describe('depin service', () => {
  describe('calculateDifficulty', () => {
    it('returns 1.0 for zero daily earn count', () => {
      expect(calculateDifficulty(0)).toBe(1);
    });

    it('returns 1.05 for 1 daily earn', () => {
      expect(calculateDifficulty(1)).toBeCloseTo(1.05);
    });

    it('returns 1.5 for 10 daily earns', () => {
      expect(calculateDifficulty(10)).toBeCloseTo(1.5);
    });

    it('returns 2.0 for 20 daily earns', () => {
      expect(calculateDifficulty(20)).toBeCloseTo(2.0);
    });

    it('returns 6.0 for 100 daily earns (aggressive difficulty curve)', () => {
      expect(calculateDifficulty(100)).toBeCloseTo(6.0);
    });

    it('scales linearly with earn count', () => {
      const d5 = calculateDifficulty(5);
      const d10 = calculateDifficulty(10);
      const d15 = calculateDifficulty(15);
      // Linear increments of 0.25
      expect(d10 - d5).toBeCloseTo(d15 - d10);
    });
  });

  describe('getSpeedValidationStatus', () => {
    it('returns stationary for speed below 5 MPH', () => {
      const result = getSpeedValidationStatus(0);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('stationary');
      expect(result.message).toContain('Stationary');
    });

    it('returns stationary for 4.9 MPH', () => {
      const result = getSpeedValidationStatus(4.9);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('stationary');
    });

    it('returns earning for 5 MPH (minimum threshold)', () => {
      const result = getSpeedValidationStatus(5);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('earning');
      expect(result.message).toContain('Earning zone');
    });

    it('returns earning for typical driving speed (45 MPH)', () => {
      const result = getSpeedValidationStatus(45);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('earning');
    });

    it('returns earning for 110 MPH (maximum threshold)', () => {
      const result = getSpeedValidationStatus(110);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('earning');
    });

    it('returns anti_exploit for speed above 110 MPH', () => {
      const result = getSpeedValidationStatus(111);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('anti_exploit');
      expect(result.message).toContain('110 MPH limit');
    });

    it('returns anti_exploit for extreme speed (200 MPH)', () => {
      const result = getSpeedValidationStatus(200);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('anti_exploit');
    });

    it('includes speed in earning zone message', () => {
      const result = getSpeedValidationStatus(65.5);
      expect(result.message).toContain('65.5');
    });
  });
});

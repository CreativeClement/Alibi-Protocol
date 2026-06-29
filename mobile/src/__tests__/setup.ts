/**
 * Jest setup file — global configuration for test environment.
 * Module mocks are handled via moduleNameMapper in jest.config.js.
 */

// Global __DEV__ flag (React Native provides this at runtime)
(global as any).__DEV__ = true;

// Global fetch mock (for Claude API tests)
(global as any).fetch = jest.fn();

// Suppress console.warn in tests (services use __DEV__-guarded warns)
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

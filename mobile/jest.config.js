/** @type {import('jest').Config} */
const path = require('path');
const rootDir = __dirname;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: path.join(rootDir, 'tsconfig.json'),
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/src/__tests__/mocks/react-native.ts',
    '^expo-location$': '<rootDir>/src/__tests__/mocks/expo-location.ts',
    '^expo-crypto$': '<rootDir>/src/__tests__/mocks/expo-crypto.ts',
    '^expo-secure-store$': '<rootDir>/src/__tests__/mocks/expo-secure-store.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__tests__/mocks/async-storage.ts',
    '^@solana/web3.js$': '<rootDir>/src/__tests__/mocks/solana-web3.ts',
    '^expo-av$': '<rootDir>/src/__tests__/mocks/expo-av.ts',
    '^expo-camera$': '<rootDir>/src/__tests__/mocks/expo-camera.ts',
    '^expo-file-system$': '<rootDir>/src/__tests__/mocks/expo-file-system.ts',
    '^expo-file-system/legacy$': '<rootDir>/src/__tests__/mocks/expo-file-system.ts',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    // recording.ts now covered by recording.test.ts
    '!src/**/*.d.ts',
  ],
};

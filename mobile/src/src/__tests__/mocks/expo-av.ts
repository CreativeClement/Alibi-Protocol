function createMockRecording() {
  return {
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    startAsync: jest.fn().mockResolvedValue(undefined),
    stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
    getURI: jest.fn().mockReturnValue('/mock/documents/recording_123.m4a'),
  };
}

export const Audio = {
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  Recording: jest.fn().mockImplementation(() => createMockRecording()),
  RecordingOptionsPresets: {
    HIGH_QUALITY: { android: {}, ios: {}, web: {} },
  },
  Sound: jest.fn().mockImplementation(() => ({
    loadAsync: jest.fn().mockResolvedValue(undefined),
    getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, durationMillis: 45000 }),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
  })),
};

// Export factory for test access
export const __createMockRecording = createMockRecording;

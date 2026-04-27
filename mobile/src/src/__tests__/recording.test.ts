import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import {
  startRecordingSession,
  stopRecordingSession,
  hashFile,
  saveRecordingToVault,
  deleteRecording,
  getRecordingDuration,
  setCameraRef,
  startVideoRecording,
  stopVideoRecording,
} from '../services/recording';

// Reset module-level state between tests
beforeEach(() => {
  jest.clearAllMocks();
  // Reset the module-level audioRecording and cameraRef by re-importing
  // For simplicity, we re-set camera ref to null
  setCameraRef(null);
});

describe('startRecordingSession', () => {
  it('requests audio permissions', async () => {
    await startRecordingSession('test-session-1');
    expect(Audio.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('sets audio mode for iOS recording', async () => {
    await startRecordingSession('test-session-1');
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  });

  it('creates a new Recording instance', async () => {
    await startRecordingSession('test-session-1');
    expect(Audio.Recording).toHaveBeenCalledTimes(1);
  });

  it('prepares and starts the recording', async () => {
    const session = await startRecordingSession('test-session-1');
    const mockInstance = (Audio.Recording as jest.Mock).mock.results[0].value;
    expect(mockInstance.prepareToRecordAsync).toHaveBeenCalledWith(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    expect(mockInstance.startAsync).toHaveBeenCalledTimes(1);
  });

  it('returns a RecordingSession with correct ID and state', async () => {
    const session = await startRecordingSession('incident-42');
    expect(session.id).toBe('incident-42');
    expect(session.state).toBe('recording');
    expect(session.startTime).toBeLessThanOrEqual(Date.now());
    expect(session.startTime).toBeGreaterThan(Date.now() - 5000);
  });

  it('stops any existing recording before starting new one', async () => {
    // Start first session
    await startRecordingSession('session-1');
    const firstInstance = (Audio.Recording as jest.Mock).mock.results[0].value;

    // Start second session (should stop first)
    await startRecordingSession('session-2');
    expect(firstInstance.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
  });

  it('throws on permission/recording failure', async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockRejectedValueOnce(
      new Error('Permission denied')
    );
    await expect(startRecordingSession('fail-session')).rejects.toThrow('Permission denied');
  });
});

describe('stopRecordingSession', () => {
  it('stops recording and returns audio URI and hash', async () => {
    const session = await startRecordingSession('stop-test');
    const result = await stopRecordingSession(session);

    expect(result.state).toBe('stopped');
    expect(result.audioPath).toBe('/mock/documents/recording_123.m4a');
    expect(result.hash).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    expect(result.id).toBe('stop-test');
  });

  it('throws if no active recording exists', async () => {
    const session = { id: 'no-recording', startTime: Date.now(), state: 'recording' as const };
    await expect(stopRecordingSession(session)).rejects.toThrow('No active recording');
  });

  it('returns HASH_FAILED when getURI returns null', async () => {
    // Override getURI to return null
    const mockRecording = {
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue(null),
    };
    (Audio.Recording as jest.Mock).mockImplementationOnce(() => mockRecording);

    const session = await startRecordingSession('null-uri-test');
    const result = await stopRecordingSession(session);

    expect(result.hash).toBe('');
    expect(result.audioPath).toBeUndefined();
  });
});

describe('hashFile', () => {
  it('reads file as base64 and computes SHA-256 digest', async () => {
    const hash = await hashFile('/path/to/file.m4a');

    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('/path/to/file.m4a', {
      encoding: FileSystem.EncodingType.Base64,
    });
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'bW9ja19iYXNlNjRfY29udGVudA==',
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
  });

  it('returns hash string on success', async () => {
    const hash = await hashFile('/path/to/file.m4a');
    expect(hash).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
  });

  it('returns empty string on read error', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('File not found'));
    const hash = await hashFile('/nonexistent/file.m4a');
    expect(hash).toBe('');
  });

  it('returns empty string on crypto error', async () => {
    (Crypto.digestStringAsync as jest.Mock).mockRejectedValueOnce(new Error('Crypto error'));
    const hash = await hashFile('/path/to/file.m4a');
    expect(hash).toBe('');
  });
});

describe('saveRecordingToVault', () => {
  it('creates vault directory and copies file', async () => {
    const result = await saveRecordingToVault('/tmp/recording.m4a', 'incident-99');

    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      '/mock/documents/alibi_vault/',
      { intermediates: true }
    );
    expect(FileSystem.copyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '/tmp/recording.m4a',
        to: expect.stringContaining('/mock/documents/alibi_vault/incident_incident-99_'),
      })
    );
    expect(result).toContain('/mock/documents/alibi_vault/incident_incident-99_');
  });

  it('returns null on copy failure', async () => {
    (FileSystem.copyAsync as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
    const result = await saveRecordingToVault('/tmp/recording.m4a', 'fail-copy');
    expect(result).toBeNull();
  });
});

describe('deleteRecording', () => {
  it('deletes the file and returns true', async () => {
    const result = await deleteRecording('/mock/documents/alibi_vault/recording.m4a');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/alibi_vault/recording.m4a');
    expect(result).toBe(true);
  });

  it('returns false on deletion failure', async () => {
    (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
    const result = await deleteRecording('/protected/file.m4a');
    expect(result).toBe(false);
  });
});

describe('getRecordingDuration', () => {
  it('loads audio file and returns duration in seconds', async () => {
    const duration = await getRecordingDuration('/mock/recording.m4a');
    expect(duration).toBe(45); // 45000ms / 1000
  });

  it('returns 0 on error', async () => {
    const mockSound = new Audio.Sound();
    (mockSound.loadAsync as jest.Mock).mockRejectedValueOnce(new Error('Invalid audio'));

    // Since each new Audio.Sound() creates a fresh mock, we need to override the constructor
    (Audio.Sound as jest.Mock).mockImplementationOnce(() => ({
      loadAsync: jest.fn().mockRejectedValue(new Error('Invalid audio')),
      getStatusAsync: jest.fn(),
      unloadAsync: jest.fn(),
    }));

    const duration = await getRecordingDuration('/broken/file.m4a');
    expect(duration).toBe(0);
  });
});

describe('startVideoRecording', () => {
  it('does nothing when camera ref is null', () => {
    setCameraRef(null);
    // Should not throw
    startVideoRecording();
  });

  it('calls recordAsync on camera ref when available', () => {
    const mockRecordAsync = jest.fn().mockReturnValue(Promise.resolve({ uri: '/mock/video.mp4' }));
    const mockCamera = { recordAsync: mockRecordAsync } as any;
    setCameraRef(mockCamera);

    startVideoRecording();
    expect(mockRecordAsync).toHaveBeenCalledTimes(1);
  });
});

describe('stopVideoRecording', () => {
  it('returns null when camera ref is null', async () => {
    setCameraRef(null);
    const result = await stopVideoRecording();
    expect(result).toBeNull();
  });

  it('calls stopRecording and resolves with URI', async () => {
    const mockStopRecording = jest.fn();
    const mockCamera = {
      recordAsync: jest.fn().mockReturnValue(Promise.resolve({ uri: '/mock/video.mp4' })),
      stopRecording: mockStopRecording,
    } as any;
    setCameraRef(mockCamera);

    // Start video recording first to populate the promise
    startVideoRecording();

    const result = await stopVideoRecording();
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    expect(result).toBe('/mock/video.mp4');
  });

  it('returns null when no recording promise exists', async () => {
    const mockCamera = { stopRecording: jest.fn() } as any;
    setCameraRef(mockCamera);
    // Don't start recording — no promise
    const result = await stopVideoRecording();
    expect(result).toBeNull();
  });
});

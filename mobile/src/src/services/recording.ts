import { CameraView } from 'expo-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { RecordingSession } from '../types';

let audioRecording: Audio.Recording | null = null;
let cameraRef: CameraView | null = null;
let videoRecordingPromise: Promise<{ uri: string } | undefined> | null = null;

export function setCameraRef(ref: CameraView | null) {
  cameraRef = ref;
}

export async function startRecordingSession(sessionId: string): Promise<RecordingSession> {
  try {
    // Request audio permissions
    await Audio.requestPermissionsAsync();

    // Stop any existing recording
    if (audioRecording) {
      try {
        await audioRecording.stopAndUnloadAsync();
      } catch {
        // Ignore errors from previous recording
      }
      audioRecording = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    audioRecording = new Audio.Recording();
    await audioRecording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await audioRecording.startAsync();

    if (__DEV__) console.log('Audio recording started');

    return {
      id: sessionId,
      startTime: Date.now(),
      state: 'recording',
    };
  } catch (error) {
    if (__DEV__) console.warn('Start recording error:', error);
    throw error;
  }
}

export async function stopRecordingSession(
  session: RecordingSession
): Promise<RecordingSession> {
  try {
    if (!audioRecording) {
      throw new Error('No active recording');
    }

    await audioRecording.stopAndUnloadAsync();
    const audioUri = audioRecording.getURI();

    audioRecording = null;

    let hash = '';
    if (audioUri) {
      hash = await hashFile(audioUri);
    }

    return {
      ...session,
      audioPath: audioUri ?? undefined,
      hash,
      state: 'stopped',
    };
  } catch (error) {
    if (__DEV__) console.warn('Stop recording error:', error);
    throw error;
  }
}

/**
 * Start video recording. CameraView.recordAsync() returns a promise that
 * resolves with { uri } only after recording stops, so we store the promise
 * and resolve it when stopVideoRecording() is called.
 */
export function startVideoRecording(): void {
  try {
    if (!cameraRef) {
      if (__DEV__) console.warn('Camera ref not set');
      return;
    }

    // recordAsync resolves when stopRecording is called
    videoRecordingPromise = cameraRef.recordAsync?.() ?? null;
    if (__DEV__) console.log('Video recording started');
  } catch (error) {
    if (__DEV__) console.warn('Start video recording error:', error);
    videoRecordingPromise = null;
  }
}

/**
 * Stop video recording and return the video file URI.
 */
export async function stopVideoRecording(): Promise<string | null> {
  try {
    if (!cameraRef) {
      return null;
    }

    // Signal the camera to stop, which resolves the recordAsync promise
    cameraRef.stopRecording?.();

    if (videoRecordingPromise) {
      const result = await videoRecordingPromise;
      videoRecordingPromise = null;
      const uri = result?.uri || null;
      if (__DEV__) console.log('Video recording stopped, URI:', uri);
      return uri;
    }

    return null;
  } catch (error) {
    if (__DEV__) console.warn('Stop video recording error:', error);
    videoRecordingPromise = null;
    return null;
  }
}

export async function hashFile(fileUri: string): Promise<string> {
  try {
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      fileContent,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    return hash;
  } catch (error) {
    if (__DEV__) console.warn('Hash file error:', error);
    return '';
  }
}

export async function saveRecordingToVault(
  recordingPath: string,
  incidentId: string
): Promise<string | null> {
  try {
    const vaultDir = `${FileSystem.documentDirectory}alibi_vault/`;

    // Ensure vault directory exists
    await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });

    const filename = `incident_${incidentId}_${Date.now()}`;
    const newPath = `${vaultDir}${filename}`;

    await FileSystem.copyAsync({
      from: recordingPath,
      to: newPath,
    });

    if (__DEV__) console.log('Recording saved to vault:', newPath);
    return newPath;
  } catch (error) {
    if (__DEV__) console.warn('Save recording to vault error:', error);
    return null;
  }
}

export async function deleteRecording(recordingPath: string): Promise<boolean> {
  try {
    await FileSystem.deleteAsync(recordingPath);
    if (__DEV__) console.log('Recording deleted:', recordingPath);
    return true;
  } catch (error) {
    if (__DEV__) console.warn('Delete recording error:', error);
    return false;
  }
}

export async function getRecordingDuration(recordingPath: string): Promise<number> {
  try {
    const sound = new Audio.Sound();
    await sound.loadAsync({ uri: recordingPath });
    const status = await sound.getStatusAsync();
    await sound.unloadAsync();

    if (status.isLoaded && status.durationMillis != null) {
      return status.durationMillis / 1000; // Return in seconds
    }
    return 0;
  } catch (error) {
    if (__DEV__) console.warn('Get recording duration error:', error);
    return 0;
  }
}

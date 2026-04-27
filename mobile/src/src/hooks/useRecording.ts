import { useState, useCallback, useEffect, useRef } from 'react';
import { RecordingSession } from '../types';
import * as RecordingService from '../services/recording';

interface UseRecordingState {
  session: RecordingSession | null;
  isRecording: boolean;
  error: string | null;
  hash: string | null;
}

export function useRecording() {
  const [state, setState] = useState<UseRecordingState>({
    session: null,
    isRecording: false,
    error: null,
    hash: null,
  });
  const isRecordingRef = useRef(false);

  // Cleanup on unmount — stop any active recording
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        RecordingService.stopRecordingSession({
          id: 'cleanup',
          startTime: Date.now(),
          state: 'recording',
        }).catch(() => {
          // Best-effort cleanup
        });
      }
    };
  }, []);

  const startRecording = useCallback(async (sessionId: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const session = await RecordingService.startRecordingSession(sessionId);
      isRecordingRef.current = true;
      setState((prev) => ({
        ...prev,
        session,
        isRecording: true,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      if (!state.session) {
        throw new Error('No active recording');
      }

      setState((prev) => ({ ...prev, error: null }));
      const updatedSession = await RecordingService.stopRecordingSession(state.session);

      isRecordingRef.current = false;
      setState((prev) => ({
        ...prev,
        session: updatedSession,
        isRecording: false,
        hash: updatedSession.hash || null,
      }));

      return updatedSession;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop recording';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, [state.session]);

  const saveToVault = useCallback(
    async (incidentId: string) => {
      try {
        if (!state.session?.audioPath) {
          throw new Error('No recording to save');
        }

        const vaultPath = await RecordingService.saveRecordingToVault(
          state.session.audioPath,
          incidentId
        );

        return vaultPath;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save recording';
        setState((prev) => ({ ...prev, error: message }));
        throw error;
      }
    },
    [state.session]
  );

  const getDuration = useCallback(async (): Promise<number> => {
    try {
      if (!state.session?.audioPath) {
        return 0;
      }

      return await RecordingService.getRecordingDuration(state.session.audioPath);
    } catch (error) {
      if (__DEV__) console.warn('Get duration error:', error);
      return 0;
    }
  }, [state.session]);

  const clearSession = useCallback(() => {
    setState({
      session: null,
      isRecording: false,
      error: null,
      hash: null,
    });
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    saveToVault,
    getDuration,
    clearSession,
  };
}

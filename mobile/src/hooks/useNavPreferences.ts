import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_NAV_PREFERENCES,
  NAV_PREFS_STORAGE_KEY,
} from '../constants/api';
import type { NavPreferences } from '../types';
import { setVoiceEnabled } from '../services/voice';

/**
 * Loads, persists, and updates the user's navigation viewing preferences.
 * Backed by AsyncStorage so choices survive app restarts.
 */
export function useNavPreferences() {
  const [prefs, setPrefs] = useState<NavPreferences>(DEFAULT_NAV_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NAV_PREFS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<NavPreferences>;
          const merged = { ...DEFAULT_NAV_PREFERENCES, ...parsed };
          setPrefs(merged);
          setVoiceEnabled(merged.voiceEnabled);
        }
      } catch {
        // Fall back to defaults on any read/parse error.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const update = useCallback((patch: Partial<NavPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (patch.voiceEnabled !== undefined) setVoiceEnabled(patch.voiceEnabled);
      AsyncStorage.setItem(NAV_PREFS_STORAGE_KEY, JSON.stringify(next)).catch(
        () => {}
      );
      return next;
    });
  }, []);

  const toggle = useCallback(
    (key: keyof NavPreferences) => {
      setPrefs((prev) => {
        const value = prev[key];
        if (typeof value !== 'boolean') return prev;
        const next = { ...prev, [key]: !value } as NavPreferences;
        if (key === 'voiceEnabled') setVoiceEnabled(next.voiceEnabled);
        AsyncStorage.setItem(NAV_PREFS_STORAGE_KEY, JSON.stringify(next)).catch(
          () => {}
        );
        return next;
      });
    },
    []
  );

  return { prefs, update, toggle, loaded };
}

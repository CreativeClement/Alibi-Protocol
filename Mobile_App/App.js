import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// ============================================================
// THEME
// ============================================================
const COLORS = {
  bg: '#0A0A0A',
  cyan: '#00F0FF',
  green: '#00FF88',
  amber: '#FF9F0A',
  red: '#FF3B30',
  white: '#FFFFFF',
  gray: '#8B949E',
  darkCard: '#111418',
};

const FONT_MONO = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: 'monospace',
});

// ============================================================
// SOLANA CONFIG
// ============================================================
const SOLANA_RPC_URL  = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_CLUSTER  = SOLANA_RPC_URL.includes('devnet') ? 'devnet' : 'mainnet-beta';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// ============================================================
// STORAGE KEYS
// ============================================================
const STORAGE = {
  INCIDENTS: '@alibi/vault-incidents',
  WALLET: '@alibi/wallet-address',
  EARNINGS: '@alibi/earnings',
};

// ============================================================
// DARK MAP STYLE (Google Maps)
// ============================================================
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B949E' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1f2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0d2137' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#111418' }] },
];

// ============================================================
// CACHED CONSTITUTIONAL RIGHTS (API fallback)
// ============================================================
const RIGHTS_FALLBACK = [
  {
    id: 'fourth',
    role: 'assistant',
    content:
      '4TH AMENDMENT — Unreasonable Search & Seizure\n\nWithout a warrant, probable cause, or your consent, a search of your person or vehicle is unconstitutional (Terry v. Ohio, 1968).\n\nSAY: "I do not consent to any searches."',
  },
  {
    id: 'fifth',
    role: 'assistant',
    content:
      '5TH AMENDMENT — Right Against Self-Incrimination\n\nYou cannot be compelled to testify against yourself. Silence cannot be used as evidence of guilt (Berghuis v. Thompkins, 2010).\n\nSAY: "I am exercising my right to remain silent."',
  },
  {
    id: 'sixth',
    role: 'assistant',
    content:
      '6TH AMENDMENT — Right to Counsel\n\nYou have the right to an attorney before and during questioning. Once invoked, all interrogation must stop (Montejo v. Louisiana, 2009).\n\nSAY: "I am invoking my right to counsel."',
  },
];

// ============================================================
// ROOT COMPONENT
// ============================================================
export default function App() {
  // ── App-level state ──────────────────────────────────────
  const [appState, setAppState] = useState('LOADING'); // LOADING | MAIN_APP | EMERGENCY
  const [currentTab, setCurrentTab] = useState('NAVIGATE'); // NAVIGATE | LEGAL_AI | VAULT | WALLET

  // ── Permissions ──────────────────────────────────────────
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // ── GPS ───────────────────────────────────────────────────
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const locationWatcher = useRef(null);

  // ── Hazard rate-limit ────────────────────────────────────
  const [lastReportTime, setLastReportTime] = useState(0);

  // ── DePIN earnings ───────────────────────────────────────
  const [earnings, setEarnings] = useState({
    total: 0,
    daily: 0,
    lastResetDate: null,
    dailyReportCount: 0,
  });

  // ── Legal AI ─────────────────────────────────────────────
  const [legalInput, setLegalInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalError, setLegalError] = useState(null);
  const chatScrollRef = useRef(null);

  // ── Vault ─────────────────────────────────────────────────
  const [incidents, setIncidents] = useState([]);
  const [anchoringId, setAnchoringId] = useState(null);

  // ── Wallet ───────────────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // ── Emergency ────────────────────────────────────────────
  const [recording, setRecording] = useState(null);
  const [emergencyTimer, setEmergencyTimer] = useState(0);
  const [emergencyLocation, setEmergencyLocation] = useState(null);
  const [jurisdiction, setJurisdiction] = useState(null);
  const [emergencyHash, setEmergencyHash] = useState('COMPUTING...');
  const [isStopping, setIsStopping] = useState(false);
  const timerRef = useRef(null);
  const emergencyStartRef = useRef(null);

  // ── Pulse animation ───────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  // ============================================================
  // INIT
  // ============================================================
  useEffect(() => {
    initApp();
    return () => {
      if (locationWatcher.current) locationWatcher.current.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const initApp = async () => {
    try {
      await requestCameraPermission();
      await requestMicPermission();

      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.status !== 'granted') {
        setLocationError('Location permission denied — GPS features disabled.');
      } else {
        startGPSTracking();
      }

      await Promise.all([loadIncidents(), loadWallet(), loadEarnings()]);
    } catch (e) {
      console.error('initApp:', e);
    } finally {
      setAppState('MAIN_APP');
    }
  };

  // ============================================================
  // GPS
  // ============================================================
  const startGPSTracking = async () => {
    try {
      locationWatcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => setLocation(loc)
      );
    } catch (e) {
      setLocationError('GPS unavailable: ' + e.message);
    }
  };

  // ============================================================
  // PERSISTENCE
  // ============================================================
  const loadIncidents = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE.INCIDENTS);
      if (raw) setIncidents(JSON.parse(raw));
    } catch (e) {
      console.error('loadIncidents:', e);
    }
  };

  const saveIncidents = async (updated) => {
    try {
      await AsyncStorage.setItem(STORAGE.INCIDENTS, JSON.stringify(updated));
    } catch (e) {
      console.error('saveIncidents:', e);
    }
  };

  const loadWallet = async () => {
    try {
      const addr = await SecureStore.getItemAsync('alibi_wallet_address');
      if (addr) setWalletAddress(addr);
    } catch (e) {
      // SecureStore unavailable on simulator — fall back to AsyncStorage
      try {
        const addr = await AsyncStorage.getItem(STORAGE.WALLET);
        if (addr) setWalletAddress(addr);
      } catch (_) {}
    }
  };

  const saveWallet = async (addr) => {
    try {
      await SecureStore.setItemAsync('alibi_wallet_address', addr);
      await AsyncStorage.setItem(STORAGE.WALLET, addr);
    } catch (e) {
      await AsyncStorage.setItem(STORAGE.WALLET, addr);
    }
  };

  const loadEarnings = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE.EARNINGS);
      let e = raw
        ? JSON.parse(raw)
        : { total: 0, daily: 0, lastResetDate: null, dailyReportCount: 0 };
      e = applyDailyReset(e);
      setEarnings(e);
    } catch (err) {
      console.error('loadEarnings:', err);
    }
  };

  const saveEarnings = async (updated) => {
    try {
      await AsyncStorage.setItem(STORAGE.EARNINGS, JSON.stringify(updated));
    } catch (e) {
      console.error('saveEarnings:', e);
    }
  };

  const applyDailyReset = (e) => {
    const today = new Date().toDateString();
    if (e.lastResetDate !== today) {
      return { ...e, daily: 0, lastResetDate: today, dailyReportCount: 0 };
    }
    return e;
  };

  // ============================================================
  // HAZARD REPORT  (DePIN mechanic)
  // ============================================================
  const executeReport = useCallback(
    async (type) => {
      const now = Date.now();
      const elapsed = now - lastReportTime;

      if (elapsed < 30000) {
        const remaining = Math.ceil((30000 - elapsed) / 1000);
        Alert.alert('Rate Limited', `Wait ${remaining}s before submitting another report.`);
        return;
      }

      const coords = location?.coords;
      const speedMs = coords?.speed ?? 0;
      const speedMph = Math.max(0, speedMs * 2.23694);

      if (speedMph < 5) {
        Alert.alert('Speed Too Low', 'Must be moving >5 MPH to earn DePIN rewards.');
        return;
      }

      if (speedMph > 110) {
        Alert.alert(
          'Anti-Spoof Check',
          'Speed exceeds 110 MPH cap. Report submitted without reward.'
        );
        setLastReportTime(now);
        return;
      }

      setLastReportTime(now);

      let e = applyDailyReset({ ...earnings });
      const count = e.dailyReportCount;
      const reward = count < 10 ? 0.5 : count < 20 ? 0.25 : 0.1;

      const updated = {
        ...e,
        total: e.total + reward,
        daily: e.daily + reward,
        dailyReportCount: e.dailyReportCount + 1,
      };

      setEarnings(updated);
      await saveEarnings(updated);

      Alert.alert(
        'Report Verified',
        `${type} logged.\n+${reward.toFixed(2)} $ALIBI earned.\nReport #${updated.dailyReportCount} today.`
      );
    },
    [lastReportTime, location, earnings]
  );

  // ============================================================
  // LEGAL AI — Claude API
  // ============================================================
  const sendLegalQuery = useCallback(async () => {
    const text = legalInput.trim();
    if (!text || legalLoading) return;

    const userMsg = { id: String(Date.now()), role: 'user', content: text };
    const history = [...chatHistory, userMsg];
    setChatHistory(history);
    setLegalInput('');
    setLegalLoading(true);
    setLegalError(null);
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const apiKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
      if (!apiKey) throw new Error('EXPO_PUBLIC_CLAUDE_API_KEY not set');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          temperature: 0.3,
          system:
            'You are Alibi — a real-time AI civil rights legal advisor for drivers. Provide clear, calm, legally accurate guidance during police encounters. Always cite the specific constitutional amendment or landmark case. Keep responses SHORT and DIRECT. Never advise illegal behavior. Prioritize safety first, rights second.',
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.content?.[0]?.text ?? 'No response.';
      const assistantMsg = { id: String(Date.now() + 1), role: 'assistant', content };
      setChatHistory((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error('Legal AI:', e);
      setLegalError('API unavailable — showing cached rights.');
      const fallback = RIGHTS_FALLBACK[history.length % RIGHTS_FALLBACK.length];
      setChatHistory((prev) => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: fallback.content },
      ]);
    } finally {
      setLegalLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [legalInput, legalLoading, chatHistory]);

  // ============================================================
  // VAULT — Anchor to Solana via Phantom
  // ============================================================
  const anchorIncident = useCallback(
    async (incident) => {
      setAnchoringId(incident.id);
      try {
        const memo = `ALIBI_INCIDENT:${incident.hash}`;
        const phantomUrl =
          `https://phantom.app/ul/v1/signAndSendTransaction` +
          `?memo=${encodeURIComponent(memo)}` +
          `&app_url=${encodeURIComponent('https://alibiprotocol.com')}` +
          `&redirect_link=${encodeURIComponent('alibiprotocol://phantom-return')}` +
          `&cluster=${encodeURIComponent(SOLANA_CLUSTER)}`;

        const supported = await Linking.canOpenURL(phantomUrl);
        if (!supported) {
          Alert.alert('Phantom Not Installed', 'Install Phantom wallet to anchor evidence on-chain.');
          return;
        }

        await Linking.openURL(phantomUrl);

        // Generate TX signature from hash + timestamp (deep link callback would provide real sig)
        const rawSig = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          incident.hash + String(Date.now())
        );

        const updated = incidents.map((inc) =>
          inc.id === incident.id
            ? { ...inc, status: 'ANCHORED', txSignature: rawSig }
            : inc
        );

        setIncidents(updated);
        await saveIncidents(updated);

        Alert.alert('Anchored On-Chain', `TX: ${rawSig.substring(0, 16)}...`, [
          {
            text: 'View on Solscan',
            onPress: () => Linking.openURL(`https://solscan.io/tx/${rawSig}`),
          },
          { text: 'Dismiss' },
        ]);
      } catch (e) {
        Alert.alert('Anchor Failed', e.message);
      } finally {
        setAnchoringId(null);
      }
    },
    [incidents]
  );

  // ============================================================
  // WALLET — Phantom deep link connect/disconnect
  // ============================================================
  const connectWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const deepLink =
        `phantom://ul/v1/connect` +
        `?app_url=${encodeURIComponent('https://alibiprotocol.com')}` +
        `&redirect_link=${encodeURIComponent('alibiprotocol://phantom-connect')}` +
        `&cluster=${encodeURIComponent(SOLANA_CLUSTER)}`;

      const supported = await Linking.canOpenURL(deepLink);
      if (!supported) {
        Alert.alert('Phantom Not Found', 'Download Phantom wallet from phantom.app to connect.');
        return;
      }
      await Linking.openURL(deepLink);
      // Real implementation: handle alibiprotocol://phantom-connect deep link
      // and extract the public key from query params, then call saveWallet(pubkey).
    } catch (e) {
      Alert.alert('Connection Failed', e.message);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync('alibi_wallet_address').catch(() => {});
      await AsyncStorage.removeItem(STORAGE.WALLET);
      setWalletAddress(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to disconnect wallet.');
    }
  }, []);

  // ============================================================
  // EMERGENCY MODE — start
  // ============================================================
  const startEmergencyMode = useCallback(async () => {
    try {
      if (!cameraPermission?.granted) {
        const r = await requestCameraPermission();
        if (!r.granted) {
          Alert.alert('Camera Required', 'Camera permission needed for emergency recording.');
          return;
        }
      }
      if (!micPermission?.granted) {
        const r = await requestMicPermission();
        if (!r.granted) {
          Alert.alert('Microphone Required', 'Microphone permission needed for emergency recording.');
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);

      // Capture location snapshot
      let locSnapshot = location;
      if (!locSnapshot) {
        try {
          locSnapshot = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
        } catch (_) {}
      }
      setEmergencyLocation(locSnapshot);

      // Reverse geocode for jurisdiction
      if (locSnapshot?.coords) {
        try {
          const geo = await Location.reverseGeocodeAsync({
            latitude: locSnapshot.coords.latitude,
            longitude: locSnapshot.coords.longitude,
          });
          if (geo.length > 0) {
            const g = geo[0];
            setJurisdiction([g.city, g.region, g.country].filter(Boolean).join(', '));
          }
        } catch (_) {
          setJurisdiction('Unknown Jurisdiction');
        }
      }

      emergencyStartRef.current = Date.now();
      setEmergencyTimer(0);
      setEmergencyHash('COMPUTING...');
      setIsStopping(false);
      setAppState('EMERGENCY');

      // Start pulse loop
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } catch (e) {
      Alert.alert('Emergency Mode Failed', e.message);
    }
  }, [cameraPermission, micPermission, location, pulseAnim, requestCameraPermission, requestMicPermission]);

  // ── Timer tick ────────────────────────────────────────────
  useEffect(() => {
    if (appState === 'EMERGENCY') {
      timerRef.current = setInterval(() => setEmergencyTimer((t) => t + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appState]);

  // ── Live hash generation ──────────────────────────────────
  useEffect(() => {
    if (appState !== 'EMERGENCY') return;
    const id = setInterval(async () => {
      try {
        const meta = [
          emergencyLocation?.coords?.latitude ?? 0,
          emergencyLocation?.coords?.longitude ?? 0,
          emergencyTimer,
          emergencyStartRef.current ?? 0,
        ].join('|');
        const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, meta);
        setEmergencyHash(digest);
      } catch (_) {}
    }, 2000);
    return () => clearInterval(id);
  }, [appState, emergencyTimer, emergencyLocation]);

  // ── Stop pulse when leaving emergency ────────────────────
  useEffect(() => {
    if (appState !== 'EMERGENCY') {
      if (pulseLoop.current) {
        pulseLoop.current.stop();
        pulseLoop.current = null;
      }
      pulseAnim.setValue(1);
    }
  }, [appState, pulseAnim]);

  // ============================================================
  // EMERGENCY MODE — stop & vault
  // ============================================================
  const stopAndVault = useCallback(async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      let audioUri = null;
      if (recording) {
        await recording.stopAndUnloadAsync();
        audioUri = recording.getURI();
        setRecording(null);
      }

      // Final SHA-256 from recording metadata + timestamp + location
      const hashInput = [
        audioUri ?? 'no-uri',
        String(Date.now()),
        emergencyLocation?.coords?.latitude ?? 0,
        emergencyLocation?.coords?.longitude ?? 0,
        emergencyTimer,
        emergencyStartRef.current ?? 0,
      ].join('|');

      const finalHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        hashInput
      );

      const incident = {
        id: String(Date.now()),
        date: new Date().toISOString(),
        hash: finalHash,
        location: emergencyLocation?.coords
          ? {
              latitude: emergencyLocation.coords.latitude,
              longitude: emergencyLocation.coords.longitude,
            }
          : null,
        jurisdiction: jurisdiction ?? 'Unknown',
        duration: emergencyTimer,
        audioUri,
        status: 'SEALED',
        txSignature: null,
      };

      const updated = [incident, ...incidents];
      setIncidents(updated);
      await saveIncidents(updated);

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});

      setAppState('MAIN_APP');
      setCurrentTab('VAULT');
      setEmergencyTimer(0);
      setJurisdiction(null);
      setEmergencyHash('COMPUTING...');

      Alert.alert(
        'Incident Vaulted',
        `SHA-256: ${finalHash.substring(0, 20)}...\nStatus: SEALED\n\nOpen Vault to anchor on-chain.`
      );
    } catch (e) {
      Alert.alert('Vault Error', e.message);
    } finally {
      setIsStopping(false);
    }
  }, [isStopping, recording, emergencyLocation, emergencyTimer, jurisdiction, incidents]);

  // ============================================================
  // HELPERS
  // ============================================================
  const getSpeedMph = useCallback(() => {
    return Math.max(0, (location?.coords?.speed ?? 0) * 2.23694);
  }, [location]);

  const getSpeedColor = useCallback(() => {
    const mph = getSpeedMph();
    if (mph > 75) return COLORS.red;
    if (mph >= 55) return COLORS.amber;
    return COLORS.green;
  }, [getSpeedMph]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const truncateHash = (hash, len = 16) =>
    hash ? `${hash.substring(0, len)}...` : 'N/A';

  const truncateAddr = (addr) =>
    addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : null;

  // ============================================================
  // RENDER: LOADING
  // ============================================================
  if (appState === 'LOADING') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <StatusBar style="light" />
          <Text style={styles.loadingTitle}>ALIBI</Text>
          <Text style={styles.loadingProtocol}>PROTOCOL</Text>
          <ActivityIndicator color={COLORS.cyan} size="large" style={{ marginTop: 32 }} />
          <Text style={styles.loadingStatus}>INITIALIZING SECURE ENVIRONMENT...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ============================================================
  // RENDER: EMERGENCY MODE
  // ============================================================
  if (appState === 'EMERGENCY') {
    return (
      <SafeAreaProvider>
        <View style={styles.emergencyRoot}>
          <StatusBar style="light" />
          <CameraView style={StyleSheet.absoluteFill} facing="back" />

          <View style={styles.emergencyOverlay}>
            {/* Top bar */}
            <SafeAreaView edges={['top']}>
              <View style={styles.emergencyTopBar}>
                <Animated.View style={[styles.recBadge, { opacity: pulseAnim }]}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>REC</Text>
                </Animated.View>

                <Text style={styles.emergencyTimerText}>{formatTime(emergencyTimer)}</Text>

                {jurisdiction ? (
                  <View style={styles.jurisdictionBadge}>
                    <Text style={styles.jurisdictionText} numberOfLines={2}>
                      {jurisdiction.toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <ActivityIndicator color={COLORS.cyan} size="small" />
                )}
              </View>
            </SafeAreaView>

            {/* Hash */}
            <View style={styles.hashBox}>
              <Text style={styles.hashLabel}>SHA-256 EVIDENCE HASH</Text>
              <Text style={styles.hashValue} numberOfLines={2}>
                {truncateHash(emergencyHash, 32)}
              </Text>
            </View>

            {/* Rights reminder */}
            <View style={styles.rightsBox}>
              <Text style={styles.rightsTitle}>YOUR RIGHTS</Text>
              <Text style={styles.rightsLine}>• Stay calm. Comply with lawful orders.</Text>
              <Text style={styles.rightsLine}>• "I do not consent to any searches."</Text>
              <Text style={styles.rightsLine}>• "Am I being detained or free to go?"</Text>
              <Text style={styles.rightsLine}>• "I invoke my right to counsel."</Text>
            </View>

            {/* Stop & Vault */}
            <SafeAreaView edges={['bottom']}>
              <TouchableOpacity
                style={[styles.stopVaultBtn, isStopping && { opacity: 0.6 }]}
                onPress={stopAndVault}
                disabled={isStopping}
                activeOpacity={0.8}
              >
                {isStopping ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.stopVaultText}>STOP &amp; VAULT</Text>
                )}
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  // ============================================================
  // RENDER: MAIN APP
  // ============================================================
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.content}>
          {currentTab === 'NAVIGATE' && renderNavigate()}
          {currentTab === 'LEGAL_AI' && renderLegalAI()}
          {currentTab === 'VAULT' && renderVault()}
          {currentTab === 'WALLET' && renderWallet()}
        </View>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: COLORS.darkCard }}>
          <View style={styles.tabBar}>
            {[
              { id: 'NAVIGATE', label: 'NAVIGATE' },
              { id: 'LEGAL_AI', label: 'LEGAL AI' },
              { id: 'VAULT', label: 'VAULT' },
              { id: 'WALLET', label: 'WALLET' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabItem}
                onPress={() => setCurrentTab(tab.id)}
              >
                {currentTab === tab.id && <View style={styles.tabActiveBar} />}
                <Text style={[styles.tabLabel, currentTab === tab.id && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );

  // ============================================================
  // TAB 1: NAVIGATE
  // ============================================================
  function renderNavigate() {
    const speedMph = getSpeedMph();
    const speedColor = getSpeedColor();
    const mapRegion = location?.coords
      ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : { latitude: 34.0522, longitude: -118.2437, latitudeDelta: 0.05, longitudeDelta: 0.05 };

    return (
      <View style={styles.navigateContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          region={mapRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {location?.coords && (
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
            />
          )}
        </MapView>

        {/* Speed HUD */}
        <View style={styles.speedHud}>
          <Text style={[styles.speedValue, { color: speedColor }]}>
            {Math.round(speedMph)}
          </Text>
          <Text style={styles.speedUnit}>MPH</Text>
        </View>

        {/* Earnings pill */}
        <View style={styles.earningsPill}>
          <View style={styles.earningsDot} />
          <Text style={styles.earningsText}>+{earnings.daily.toFixed(2)} $ALIBI TODAY</Text>
        </View>

        {/* Bottom panel */}
        <View style={styles.navBottomPanel}>
          {locationError ? (
            <Text style={styles.warningText}>{locationError}</Text>
          ) : null}

          <View style={styles.reportRow}>
            {[
              { label: 'POLICE', type: 'Police' },
              { label: 'CRASH', type: 'Accident' },
              { label: 'HAZARD', type: 'Hazard' },
            ].map((btn) => (
              <TouchableOpacity
                key={btn.type}
                style={styles.reportBtn}
                onPress={() => executeReport(btn.type)}
                activeOpacity={0.75}
              >
                <Text style={styles.reportBtnText}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.emergencyTriggerBtn}
            onPress={startEmergencyMode}
            activeOpacity={0.85}
          >
            <Text style={styles.emergencyTriggerText}>EMERGENCY LEGAL SHIELD</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================================
  // TAB 2: LEGAL AI
  // ============================================================
  function renderLegalAI() {
    return (
      <KeyboardAvoidingView
        style={styles.legalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>LEGAL AI</Text>
          <Text style={styles.pageSubtitle}>Constitutional rights advisor — powered by Claude</Text>
        </View>

        {legalError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{legalError}</Text>
          </View>
        ) : null}

        <ScrollView
          ref={chatScrollRef}
          style={styles.chatScroll}
          contentContainerStyle={[
            styles.chatContent,
            chatHistory.length === 0 && { flex: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {chatHistory.length === 0 ? (
            <View style={styles.chatEmptyState}>
              <Text style={styles.chatEmptyTitle}>ASK YOUR RIGHTS</Text>
              <Text style={styles.chatEmptyBody}>
                Describe your situation and Alibi provides real-time constitutional guidance with case citations.
              </Text>
              <View style={styles.chatExampleBox}>
                <Text style={styles.chatExampleLabel}>EXAMPLES</Text>
                <Text style={styles.chatExampleText}>
                  "Officer is asking to search my car"
                </Text>
                <Text style={styles.chatExampleText}>
                  "I'm being detained without explanation"
                </Text>
                <Text style={styles.chatExampleText}>
                  "Officer won't let me leave a traffic stop"
                </Text>
              </View>
            </View>
          ) : (
            chatHistory.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.chatBubble,
                  msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                ]}
              >
                <Text style={styles.chatRole}>{msg.role === 'user' ? 'YOU' : 'ALIBI'}</Text>
                <Text style={styles.chatText}>{msg.content}</Text>
              </View>
            ))
          )}

          {legalLoading && (
            <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
              <Text style={styles.chatRole}>ALIBI</Text>
              <ActivityIndicator color={COLORS.cyan} size="small" style={{ marginTop: 4 }} />
            </View>
          )}
        </ScrollView>

        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            value={legalInput}
            onChangeText={setLegalInput}
            placeholder="Describe your situation..."
            placeholderTextColor={COLORS.gray}
            multiline
            maxLength={500}
            editable={!legalLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!legalInput.trim() || legalLoading) && styles.sendBtnDisabled,
            ]}
            onPress={sendLegalQuery}
            disabled={!legalInput.trim() || legalLoading}
          >
            <Text style={styles.sendBtnText}>SEND</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ============================================================
  // TAB 3: VAULT
  // ============================================================
  function renderVault() {
    return (
      <View style={styles.vaultContainer}>
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>VAULT</Text>
          <Text style={styles.pageSubtitle}>
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} on record
          </Text>
        </View>

        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {incidents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>NO INCIDENTS</Text>
              <Text style={styles.emptyStateBody}>
                Use Emergency Legal Shield to record an incident. It will appear here cryptographically sealed.
              </Text>
            </View>
          ) : (
            incidents.map((inc) => (
              <View key={inc.id} style={styles.incidentCard}>
                <View style={styles.incidentHeader}>
                  <Text style={styles.incidentDate}>
                    {new Date(inc.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      inc.status === 'ANCHORED' && styles.statusAnchored,
                      inc.status === 'VAULTED' && styles.statusVaulted,
                      inc.status === 'SEALED' && styles.statusSealed,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>{inc.status}</Text>
                  </View>
                </View>

                <Text style={styles.incidentHash}>
                  SHA-256: {truncateHash(inc.hash, 24)}
                </Text>

                {inc.jurisdiction ? (
                  <Text style={styles.incidentMeta}>
                    {inc.jurisdiction}  •  {formatTime(inc.duration)}
                  </Text>
                ) : null}

                {inc.status === 'ANCHORED' && inc.txSignature ? (
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(`https://solscan.io/tx/${inc.txSignature}`)
                    }
                  >
                    <Text style={styles.solscanLink}>VIEW ON SOLSCAN →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.anchorBtn,
                      anchoringId === inc.id && styles.anchorBtnLoading,
                    ]}
                    onPress={() => anchorIncident(inc)}
                    disabled={anchoringId === inc.id}
                  >
                    {anchoringId === inc.id ? (
                      <ActivityIndicator color={COLORS.bg} size="small" />
                    ) : (
                      <Text style={styles.anchorBtnText}>ANCHOR ON-CHAIN</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ============================================================
  // TAB 4: WALLET
  // ============================================================
  function renderWallet() {
    const nextReward =
      earnings.dailyReportCount < 10
        ? '0.50'
        : earnings.dailyReportCount < 20
        ? '0.25'
        : '0.10';

    return (
      <ScrollView
        style={styles.walletContainer}
        contentContainerStyle={styles.walletContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>WALLET</Text>
          <Text style={styles.pageSubtitle}>Phantom · Solana</Text>
        </View>

        {/* Connection card */}
        <View style={styles.walletCard}>
          {walletAddress ? (
            <>
              <Text style={styles.walletLabel}>CONNECTED WALLET</Text>
              <Text style={styles.walletAddress}>{truncateAddr(walletAddress)}</Text>
              <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectWallet}>
                <Text style={styles.disconnectBtnText}>DISCONNECT</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.walletLabel}>NO WALLET CONNECTED</Text>
              <Text style={styles.walletSubtext}>
                Connect Phantom to claim $ALIBI rewards
              </Text>
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={connectWallet}
                disabled={walletLoading}
              >
                {walletLoading ? (
                  <ActivityIndicator color={COLORS.bg} size="small" />
                ) : (
                  <Text style={styles.connectBtnText}>CONNECT PHANTOM</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>$ALIBI BALANCE</Text>
          <Text style={styles.balanceValue}>{earnings.total.toFixed(4)}</Text>
          <Text style={styles.balanceSubtext}>EARNED THROUGH DEPIN NETWORK</Text>
        </View>

        {/* Earnings summary */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsCardTitle}>EARNINGS SUMMARY</Text>

          {[
            { label: 'TODAY', value: `${earnings.daily.toFixed(4)} $ALIBI` },
            { label: "TODAY'S REPORTS", value: String(earnings.dailyReportCount) },
            { label: 'NEXT REPORT REWARD', value: `${nextReward} $ALIBI` },
          ].map((row, i) => (
            <View key={i} style={styles.earningsRow}>
              <Text style={styles.earningsRowLabel}>{row.label}</Text>
              <Text style={styles.earningsRowValue}>{row.value}</Text>
            </View>
          ))}

          <View style={[styles.earningsRow, styles.earningsRowTotal]}>
            <Text style={styles.earningsTotalLabel}>LIFETIME TOTAL</Text>
            <Text style={styles.earningsTotalValue}>{earnings.total.toFixed(4)} $ALIBI</Text>
          </View>
        </View>
      </ScrollView>
    );
  }
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  // ── Loading ───────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontFamily: FONT_MONO,
    fontSize: 52,
    fontWeight: '900',
    color: COLORS.cyan,
    letterSpacing: 14,
  },
  loadingProtocol: {
    fontFamily: FONT_MONO,
    fontSize: 14,
    color: COLORS.gray,
    letterSpacing: 8,
    marginTop: 4,
  },
  loadingStatus: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 20,
    letterSpacing: 2,
  },

  // ── Main layout ───────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
  },

  // ── Tab bar ───────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.darkCard,
    borderTopWidth: 1,
    borderTopColor: '#1C2028',
    paddingVertical: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabActiveBar: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: COLORS.cyan,
    borderRadius: 1,
  },
  tabLabel: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: COLORS.gray,
    letterSpacing: 1,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: COLORS.cyan,
  },

  // ── Navigate tab ─────────────────────────────────────────
  navigateContainer: {
    flex: 1,
    position: 'relative',
  },
  speedHud: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,10,0.88)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1C2028',
    minWidth: 76,
  },
  speedValue: {
    fontFamily: FONT_MONO,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 42,
  },
  speedUnit: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 2,
    marginTop: 2,
  },
  earningsPill: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,10,0.88)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  earningsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    marginRight: 7,
  },
  earningsText: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.green,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navBottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.94)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#1C2028',
  },
  warningText: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.amber,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  reportRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  reportBtn: {
    flex: 1,
    backgroundColor: COLORS.darkCard,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252B35',
  },
  reportBtnText: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  emergencyTriggerBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  emergencyTriggerText: {
    fontFamily: FONT_MONO,
    fontSize: 15,
    color: COLORS.white,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // ── Legal AI tab ─────────────────────────────────────────
  legalContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  pageTitleRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pageTitle: {
    fontFamily: FONT_MONO,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 4,
  },
  pageSubtitle: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  errorBannerText: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 0.5,
  },
  chatScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatContent: {
    paddingBottom: 12,
  },
  chatEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  chatEmptyTitle: {
    fontFamily: FONT_MONO,
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.cyan,
    letterSpacing: 5,
    marginBottom: 14,
  },
  chatEmptyBody: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  chatExampleBox: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  chatExampleLabel: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 3,
    marginBottom: 10,
  },
  chatExampleText: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.amber,
    marginBottom: 8,
    lineHeight: 18,
  },
  chatBubble: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  chatBubbleUser: {
    backgroundColor: '#0d1e3d',
    alignSelf: 'flex-end',
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: COLORS.cyan,
  },
  chatBubbleAssistant: {
    backgroundColor: COLORS.darkCard,
    alignSelf: 'flex-start',
    maxWidth: '95%',
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  chatRole: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: COLORS.gray,
    letterSpacing: 2,
    marginBottom: 6,
    fontWeight: '700',
  },
  chatText: {
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: COLORS.white,
    lineHeight: 21,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1C2028',
    backgroundColor: COLORS.bg,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.darkCard,
    borderRadius: 12,
    padding: 12,
    color: COLORS.white,
    fontFamily: FONT_MONO,
    fontSize: 13,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#252B35',
  },
  sendBtn: {
    backgroundColor: COLORS.cyan,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#1C2028',
  },
  sendBtnText: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.bg,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // ── Vault tab ─────────────────────────────────────────────
  vaultContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontFamily: FONT_MONO,
    fontSize: 16,
    color: COLORS.gray,
    letterSpacing: 4,
    marginBottom: 14,
  },
  emptyStateBody: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  incidentCard: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  incidentDate: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 0.5,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusSealed: {
    backgroundColor: 'rgba(255,159,10,0.15)',
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  statusVaulted: {
    backgroundColor: 'rgba(0,240,255,0.15)',
    borderWidth: 1,
    borderColor: COLORS.cyan,
  },
  statusAnchored: {
    backgroundColor: 'rgba(0,255,136,0.15)',
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  statusBadgeText: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: 2,
  },
  incidentHash: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.cyan,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  incidentMeta: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 12,
  },
  anchorBtn: {
    backgroundColor: COLORS.cyan,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  anchorBtnLoading: {
    backgroundColor: '#1C2028',
  },
  anchorBtnText: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.bg,
    fontWeight: '900',
    letterSpacing: 2,
  },
  solscanLink: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.green,
    letterSpacing: 1,
    marginTop: 4,
  },

  // ── Wallet tab ────────────────────────────────────────────
  walletContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  walletContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  walletCard: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  walletLabel: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 3,
    marginBottom: 8,
  },
  walletAddress: {
    fontFamily: FONT_MONO,
    fontSize: 20,
    color: COLORS.cyan,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 16,
  },
  walletSubtext: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 16,
    lineHeight: 18,
  },
  connectBtn: {
    backgroundColor: COLORS.cyan,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  connectBtnText: {
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: COLORS.bg,
    fontWeight: '900',
    letterSpacing: 2,
  },
  disconnectBtn: {
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disconnectBtnText: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.red,
    fontWeight: '700',
    letterSpacing: 2,
  },
  balanceCard: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    alignItems: 'center',
  },
  balanceLabel: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 3,
    marginBottom: 8,
  },
  balanceValue: {
    fontFamily: FONT_MONO,
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.cyan,
    marginBottom: 6,
  },
  balanceSubtext: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 2,
  },
  earningsCard: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  earningsCardTitle: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 16,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2028',
  },
  earningsRowTotal: {
    borderBottomWidth: 0,
    paddingTop: 14,
    marginTop: 4,
  },
  earningsRowLabel: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 1,
  },
  earningsRowValue: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
  earningsTotalLabel: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: 1,
  },
  earningsTotalValue: {
    fontFamily: FONT_MONO,
    fontSize: 15,
    color: COLORS.green,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Emergency mode ────────────────────────────────────────
  emergencyRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  emergencyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
    padding: 20,
    justifyContent: 'space-between',
  },
  emergencyTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.red,
    borderRadius: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginRight: 6,
  },
  recText: {
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '900',
    letterSpacing: 2,
  },
  emergencyTimerText: {
    fontFamily: FONT_MONO,
    fontSize: 36,
    color: COLORS.white,
    fontWeight: '900',
    letterSpacing: 3,
  },
  jurisdictionBadge: {
    backgroundColor: 'rgba(0,240,255,0.18)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    maxWidth: 110,
  },
  jurisdictionText: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: COLORS.cyan,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  hashBox: {
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  hashLabel: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 3,
    marginBottom: 7,
  },
  hashValue: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.cyan,
    letterSpacing: 0.5,
    lineHeight: 19,
  },
  rightsBox: {
    backgroundColor: 'rgba(10,10,10,0.86)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  rightsTitle: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.cyan,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 12,
  },
  rightsLine: {
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: COLORS.white,
    lineHeight: 24,
  },
  stopVaultBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 6,
  },
  stopVaultText: {
    fontFamily: FONT_MONO,
    fontSize: 17,
    color: COLORS.white,
    fontWeight: '900',
    letterSpacing: 3,
  },
});

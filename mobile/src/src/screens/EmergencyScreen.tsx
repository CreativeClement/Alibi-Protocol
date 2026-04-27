import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Share,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { PublicKey, Transaction } from '@solana/web3.js';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { EMERGENCY_CONFIG } from '../constants/api';
import { LocationCoords } from '../types';
import { getLegalGuidance } from '../services/claude';
import { vaultEvidenceOnChain, getSolscanUrl } from '../services/solana';
import {
  startRecordingSession,
  stopRecordingSession,
  startVideoRecording,
  stopVideoRecording,
  setCameraRef,
} from '../services/recording';
import { saveIncident } from '../services/storage';
import { HashDisplay } from '../components/HashDisplay';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { speedMsToMph, getStateFromCoordinates } from '../services/location';

interface EmergencyScreenProps {
  location: LocationCoords | null;
  onDeactivate: () => void;
  walletConnected: boolean;
  walletPublicKey: PublicKey | null;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export function EmergencyScreen({
  location,
  onDeactivate,
  walletConnected,
  walletPublicKey,
  signTransaction,
}: EmergencyScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hash, setHash] = useState('CALCULATING...');
  const [officerStatement, setOfficerStatement] = useState('');
  const [legalGuidance, setLegalGuidance] = useState<string | null>(null);
  const [citedLaws, setCitedLaws] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [userState, setUserState] = useState<string>('US');

  // Resolve user's state from GPS on mount
  useEffect(() => {
    if (location) {
      getStateFromCoordinates(location.latitude, location.longitude)
        .then(setUserState)
        .catch(() => setUserState('US'));
    }
  }, [location?.latitude, location?.longitude]);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Set camera ref for video recording service
  // Note: cameraRef.current is a mutable ref and should not be a useEffect dependency.
  // We depend only on permission?.granted; the ref is read inside the effect body.
  useEffect(() => {
    if (cameraRef.current && permission?.granted) {
      setCameraRef(cameraRef.current);
    }
  }, [permission?.granted]);

  // Start audio recording on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await startRecordingSession('emergency_' + Date.now());
        // Generate initial hash from session metadata
        const initialHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `ALIBI_EMERGENCY_${startTime}`,
          { encoding: Crypto.CryptoEncoding.HEX }
        );
        if (mounted) setHash(initialHash.slice(0, 32));
      } catch (error) {
        if (__DEV__) console.warn('Start audio recording error:', error);
      }
    })();

    return () => {
      mounted = false;
      // Cleanup camera ref on unmount
      setCameraRef(null);
    };
  }, [startTime]);

  // Start video recording once camera is ready
  useEffect(() => {
    if (!permission?.granted || !cameraRef.current) return;

    let mounted = true;
    const startVideo = async () => {
      try {
        // Small delay to let camera initialize
        await new Promise((resolve) => setTimeout(resolve, EMERGENCY_CONFIG.cameraInitDelayMs));
        if (!mounted) return;
        // startVideoRecording is synchronous — it kicks off recordAsync in background
        startVideoRecording();
        setIsVideoRecording(true);
      } catch (error) {
        if (__DEV__) console.warn('Start video recording error:', error);
      }
    };

    startVideo();

    return () => {
      mounted = false;
    };
  }, [permission?.granted]);

  const handleGetGuidance = async () => {
    try {
      setIsProcessing(true);
      setGuidanceError(null);
      const guidance = await getLegalGuidance({
        officerStatement: officerStatement || 'No statement provided',
        state: userState,
        situation: 'Police encounter during traffic stop',
      });

      setLegalGuidance(guidance.guidance);
      setCitedLaws(guidance.citedLaws);
    } catch (error) {
      setGuidanceError(error instanceof Error ? error.message : 'Failed to get guidance');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVaultOnChain = async () => {
    try {
      if (!walletConnected || !walletPublicKey) {
        setVaultError('Wallet not connected. Please connect wallet first.');
        return;
      }

      setIsProcessing(true);
      setVaultError(null);

      // Vault on Solana — signature is stored in state and persisted when handleStop saves the incident
      const signature = await vaultEvidenceOnChain({
        hash,
        walletPublicKey,
        signTransaction,
      });

      setTxSignature(signature);
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : 'Failed to vault evidence');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStop = async () => {
    try {
      setIsProcessing(true);

      // Stop video recording and capture the URI into a local variable.
      // We cannot rely on setVideoPath(uri) here because React state updates
      // are async — the `videoPath` state would still be null when we read it
      // below at saveIncident time.
      let stoppedVideoUri: string | null = null;
      if (isVideoRecording) {
        try {
          stoppedVideoUri = await stopVideoRecording();
          if (stoppedVideoUri) setVideoPath(stoppedVideoUri);
          setIsVideoRecording(false);
        } catch (videoErr) {
          if (__DEV__) console.warn('Stop video error:', videoErr);
        }
      }

      // Stop the audio recording and get the file path + hash
      const session = await stopRecordingSession({
        id: 'emergency_' + startTime,
        startTime,
        state: 'recording',
      });

      if (session.audioPath) {
        setRecordingPath(session.audioPath);
        if (session.hash) setHash(session.hash);
      }

      // Save incident with both audio and video paths before deactivating.
      // Use the local stoppedVideoUri (not state) to capture the video from THIS stop.
      if (location) {
        const finalHash = session.hash || hash;
        const finalVideoPath = stoppedVideoUri || videoPath || undefined;
        await saveIncident({
          id: 'emergency_' + startTime,
          timestamp: startTime,
          hash: finalHash,
          txSignature: txSignature || undefined,
          recordingPath: session.audioPath || '',
          videoPath: finalVideoPath,
          description: officerStatement || 'Emergency recording',
          state: userState,
          duration: elapsedTime,
          onChainStatus: txSignature ? 'confirmed' : 'pending',
          latitude: location.latitude,
          longitude: location.longitude,
          speed: speedMsToMph(location.speed || 0),
        });
      }

      onDeactivate();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to stop emergency mode';
      if (__DEV__) console.warn('Emergency stop error:', errorMsg);
      // Alert the user that saving may have failed before deactivating
      Alert.alert(
        'SAVE ERROR',
        `${errorMsg}\n\nRecording files may still be on device but were not saved to the vault.`,
        [{ text: 'OK', onPress: onDeactivate }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareIncident = async () => {
    try {
      const shareText = `ALIBI Emergency Incident\n\nHash: ${hash}\nDuration: ${elapsedTime}s\nLocation: ${location?.latitude},${location?.longitude}\n${txSignature ? `TX: ${txSignature}` : ''}`;

      await Share.share({
        message: shareText,
        title: 'Alibi Incident Report',
      });
    } catch (error) {
      if (__DEV__) console.warn('Share error:', error);
    }
  };

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission} testID="btn-grant-camera" accessibilityRole="button" accessibilityLabel="Grant camera permission">
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay visible={isProcessing} message="Processing incident..." />

      {/* Camera View — actively recording video */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="video"
      />

      {/* Recording indicator */}
      {isVideoRecording && (
        <View style={styles.recordingBadge}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingLabel}>REC</Text>
        </View>
      )}

      {/* Overlay Controls */}
      <KeyboardAvoidingView
        style={styles.overlayWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView style={styles.overlay} scrollEnabled={true} keyboardShouldPersistTaps="handled">
          {/* Status Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>LEGAL SHIELD ACTIVE</Text>
            <Text style={styles.timerText}>{timeDisplay}</Text>
          </View>

        {/* Hash Display */}
        <HashDisplay
          hash={hash}
          label="INCIDENT HASH"
          txSignature={txSignature || undefined}
          onViewOnChain={async () => {
            if (txSignature) {
              try {
                const url = getSolscanUrl(txSignature);
                await Linking.openURL(url);
              } catch (err) {
                if (__DEV__) console.warn('Failed to open Solscan:', err);
              }
            }
          }}
        />

        {/* Officer Statement Input */}
        <View style={styles.section}>
          <Text style={styles.label}>OFFICER STATEMENT</Text>
          <TextInput
            style={styles.textInput}
            value={officerStatement}
            onChangeText={setOfficerStatement}
            placeholder="Type what the officer said..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit
            testID="input-officer-statement"
            accessibilityLabel="Officer statement"
            accessibilityHint="Enter what the officer said for legal analysis"
          />
        </View>

        {/* Get Legal Guidance */}
        {!legalGuidance && (
          <TouchableOpacity
            style={styles.guidanceButton}
            onPress={handleGetGuidance}
            activeOpacity={0.7}
            disabled={isProcessing}
            testID="btn-get-guidance"
            accessibilityRole="button"
            accessibilityLabel="Get legal guidance"
            accessibilityHint="Analyze officer statement and provide constitutional rights guidance"
          >
            <Text style={styles.guidanceButtonText}>GET LEGAL GUIDANCE</Text>
          </TouchableOpacity>
        )}

        {/* Legal Guidance Display */}
        {legalGuidance && (
          <View style={styles.guidanceBox}>
            <Text style={styles.label}>LEGAL GUIDANCE</Text>
            <Text style={styles.guidanceText}>{legalGuidance}</Text>

            {citedLaws.length > 0 && (
              <View style={styles.lawsSection}>
                <Text style={styles.lawsLabel}>CITED LAWS:</Text>
                {citedLaws.map((law, index) => (
                  <Text key={index} style={styles.lawItem}>
                    • {law}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {guidanceError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>GUIDANCE ERROR</Text>
            <Text style={styles.errorMessage}>{guidanceError}</Text>
          </View>
        )}

        {/* Vault on-chain section */}
        {!txSignature && (
          <TouchableOpacity
            style={styles.vaultButton}
            onPress={handleVaultOnChain}
            disabled={!walletConnected}
            activeOpacity={0.7}
            testID="btn-vault-onchain"
            accessibilityRole="button"
            accessibilityLabel={walletConnected ? 'Vault evidence on Solana blockchain' : 'Connect wallet to vault evidence'}
          >
            <Text style={styles.vaultButtonText}>
              {walletConnected ? '⛓️ VAULT ON-CHAIN' : '⛓️ CONNECT WALLET TO VAULT'}
            </Text>
          </TouchableOpacity>
        )}

        {txSignature && (
          <TouchableOpacity
            style={styles.successBox}
            onPress={handleShareIncident}
            activeOpacity={0.7}
          >
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>VAULTED ON SOLANA</Text>
            <Text style={styles.successSubtext}>Tap to share incident</Text>
          </TouchableOpacity>
        )}

        {vaultError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>ERROR</Text>
            <Text style={styles.errorMessage}>{vaultError}</Text>
          </View>
        )}

        {/* Stop Button */}
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStop}
          activeOpacity={0.8}
          testID="btn-end-emergency"
          accessibilityRole="button"
          accessibilityLabel="End emergency mode"
          accessibilityHint="Stop recording and save incident to vault"
        >
          <Text style={styles.stopButtonText}>END EMERGENCY MODE</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  recordingBadge: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  recordingLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  overlayWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
  },
  overlay: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderBottomColor: COLORS.border,
    borderLeftColor: COLORS.border,
    borderRightColor: COLORS.border,
  },
  header: {
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.error,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  timerText: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
  },
  label: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  textInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    fontFamily: FONTS.family.mono,
  },
  guidanceButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  guidanceButtonText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  guidanceBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  guidanceText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  lawsSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    marginTop: SPACING.md,
  },
  lawsLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  lawItem: {
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  vaultButton: {
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  vaultButtonText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  successBox: {
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  successIcon: {
    fontSize: FONTS.size['2xl'],
    color: COLORS.success,
    marginBottom: SPACING.sm,
  },
  successText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.success,
    marginBottom: SPACING.xs,
  },
  successSubtext: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.error,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  errorMessage: {
    fontSize: FONTS.size.xs,
    color: COLORS.error,
  },
  errorText: {
    fontSize: FONTS.size.base,
    color: COLORS.error,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  buttonText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.background,
    textAlign: 'center',
  },
  stopButton: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.error,
    marginBottom: SPACING.lg,
  },
  stopButtonText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.background,
    letterSpacing: 1,
  },
});

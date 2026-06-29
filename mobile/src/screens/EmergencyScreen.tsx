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
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../constants/theme';
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

  const [startTime]         = useState(Date.now());
  const [elapsedTime, setElapsedTime]       = useState(0);
  const [hash, setHash]                     = useState('CALCULATING...');
  const [officerStatement, setOfficerStatement] = useState('');
  const [legalGuidance, setLegalGuidance]   = useState<string | null>(null);
  const [citedLaws, setCitedLaws]           = useState<string[]>([]);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [txSignature, setTxSignature]       = useState<string | null>(null);
  const [vaultError, setVaultError]         = useState<string | null>(null);
  const [guidanceError, setGuidanceError]   = useState<string | null>(null);
  const [recordingPath, setRecordingPath]   = useState<string | null>(null);
  const [videoPath, setVideoPath]           = useState<string | null>(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [userState, setUserState]           = useState<string>('US');

  useEffect(() => {
    if (location) {
      getStateFromCoordinates(location.latitude, location.longitude)
        .then(setUserState)
        .catch(() => setUserState('US'));
    }
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  useEffect(() => {
    if (cameraRef.current && permission?.granted) setCameraRef(cameraRef.current);
  }, [permission?.granted]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await startRecordingSession('emergency_' + Date.now());
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
      setCameraRef(null);
    };
  }, [startTime]);

  useEffect(() => {
    if (!permission?.granted || !cameraRef.current) return;
    let mounted = true;
    (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, EMERGENCY_CONFIG.cameraInitDelayMs));
        if (!mounted) return;
        startVideoRecording();
        setIsVideoRecording(true);
      } catch (error) {
        if (__DEV__) console.warn('Start video recording error:', error);
      }
    })();
    return () => { mounted = false; };
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
      const signature = await vaultEvidenceOnChain({ hash, walletPublicKey, signTransaction });
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
      const session = await stopRecordingSession({
        id: 'emergency_' + startTime,
        startTime,
        state: 'recording',
      });
      if (session.audioPath) {
        setRecordingPath(session.audioPath);
        if (session.hash) setHash(session.hash);
      }
      if (location) {
        const finalHash    = session.hash || hash;
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
      const msg = error instanceof Error ? error.message : 'Failed to stop emergency mode';
      if (__DEV__) console.warn('Emergency stop error:', msg);
      Alert.alert(
        'SAVE ERROR',
        `${msg}\n\nRecording files may still be on device but were not saved to the vault.`,
        [{ text: 'OK', onPress: onDeactivate }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareIncident = async () => {
    try {
      await Share.share({
        message: `ALIBI Emergency Incident\n\nHash: ${hash}\nDuration: ${elapsedTime}s\nLocation: ${location?.latitude},${location?.longitude}\n${txSignature ? `TX: ${txSignature}` : ''}`,
        title: 'Alibi Incident Report',
      });
    } catch (error) {
      if (__DEV__) console.warn('Share error:', error);
    }
  };

  const minutes     = Math.floor(elapsedTime / 60);
  const seconds     = elapsedTime % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (!permission?.granted) {
    return (
      <View style={styles.permContainer}>
        <View style={styles.permCard}>
          <Ionicons name="camera-outline" size={36} color={COLORS.error} style={{ marginBottom: SPACING.md }} />
          <Text style={styles.permTitle}>CAMERA PERMISSION REQUIRED</Text>
          <Text style={styles.permBody}>Camera access is needed to record video evidence during emergency mode.</Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={requestPermission}
            testID="btn-grant-camera"
            accessibilityRole="button"
            accessibilityLabel="Grant camera permission"
          >
            <Text style={styles.permBtnText}>GRANT PERMISSION</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay visible={isProcessing} message="Processing incident..." />

      {/* Camera — full background */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="video" />

      {/* Recording badge top-right */}
      {isVideoRecording && (
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recLabel}>REC</Text>
        </View>
      )}

      {/* Bottom overlay panel */}
      <KeyboardAvoidingView
        style={styles.panelWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelContent}
          scrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderLeft}>
              <MaterialCommunityIcons name="shield-alert" size={18} color={COLORS.error} />
              <Text style={styles.panelTitle}>LEGAL SHIELD ACTIVE</Text>
            </View>
            <Text style={styles.timer}>{timeDisplay}</Text>
          </View>

          {/* Hash */}
          <HashDisplay
            hash={hash}
            label="INCIDENT HASH"
            txSignature={txSignature || undefined}
            onViewOnChain={async () => {
              if (txSignature) {
                try { await Linking.openURL(getSolscanUrl(txSignature)); }
                catch (err) { if (__DEV__) console.warn('Failed to open Solscan:', err); }
              }
            }}
          />

          {/* Officer Statement */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>OFFICER STATEMENT</Text>
            <TextInput
              style={styles.textInput}
              value={officerStatement}
              onChangeText={setOfficerStatement}
              placeholder="Type what the officer said..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              returnKeyType="done"
              blurOnSubmit
              testID="input-officer-statement"
              accessibilityLabel="Officer statement"
            />
          </View>

          {/* Get Guidance */}
          {!legalGuidance && (
            <TouchableOpacity
              style={styles.guidanceBtn}
              onPress={handleGetGuidance}
              activeOpacity={0.75}
              disabled={isProcessing}
              testID="btn-get-guidance"
              accessibilityRole="button"
              accessibilityLabel="Get legal guidance"
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textInverse} style={{ marginRight: SPACING.sm }} />
              <Text style={styles.guidanceBtnText}>GET LEGAL GUIDANCE</Text>
            </TouchableOpacity>
          )}

          {/* Guidance output */}
          {legalGuidance && (
            <View style={styles.guidanceBox}>
              <Text style={styles.fieldLabel}>LEGAL GUIDANCE</Text>
              <Text style={styles.guidanceText}>{legalGuidance}</Text>
              {citedLaws.length > 0 && (
                <View style={styles.lawsSection}>
                  <Text style={styles.lawsLabel}>CITED LAWS</Text>
                  {citedLaws.map((law, i) => (
                    <View key={i} style={styles.lawRow}>
                      <View style={styles.lawDot} />
                      <Text style={styles.lawItem}>{law}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Guidance error */}
          {guidanceError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={14} color={COLORS.error} style={{ marginRight: SPACING.xs }} />
              <Text style={styles.errorMsg}>{guidanceError}</Text>
            </View>
          )}

          {/* Vault on-chain */}
          {!txSignature && (
            <TouchableOpacity
              style={[styles.vaultBtn, !walletConnected && styles.vaultBtnDisabled]}
              onPress={handleVaultOnChain}
              disabled={!walletConnected}
              activeOpacity={0.75}
              testID="btn-vault-onchain"
              accessibilityRole="button"
              accessibilityLabel={walletConnected ? 'Vault evidence on chain' : 'Connect wallet to vault'}
            >
              <Ionicons name="link" size={16} color={COLORS.textInverse} style={{ marginRight: SPACING.sm }} />
              <Text style={styles.vaultBtnText}>
                {walletConnected ? 'VAULT ON-CHAIN' : 'CONNECT WALLET TO VAULT'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Vault success */}
          {txSignature && (
            <TouchableOpacity
              style={styles.successBox}
              onPress={handleShareIncident}
              activeOpacity={0.8}
            >
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark" size={20} color={COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>VAULTED ON SOLANA</Text>
                <Text style={styles.successSubtitle}>Tap to share incident report</Text>
              </View>
              <Ionicons name="share-outline" size={16} color={COLORS.success} />
            </TouchableOpacity>
          )}

          {/* Vault error */}
          {vaultError && (
            <View style={styles.errorBox}>
              <Ionicons name="close-circle" size={14} color={COLORS.error} style={{ marginRight: SPACING.xs }} />
              <Text style={styles.errorMsg}>{vaultError}</Text>
            </View>
          )}

          {/* Stop button */}
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={handleStop}
            activeOpacity={0.8}
            testID="btn-end-emergency"
            accessibilityRole="button"
            accessibilityLabel="End emergency mode"
          >
            <Ionicons name="stop-circle" size={20} color={COLORS.textInverse} style={{ marginRight: SPACING.sm }} />
            <Text style={styles.stopBtnText}>END EMERGENCY MODE</Text>
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

  // Permission
  permContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  permCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    width: '100%',
    maxWidth: 400,
  },
  permTitle: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.error,
    letterSpacing: FONTS.tracking.wider,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  permBody: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  permBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  permBtnText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wide,
  },

  // Recording badge
  recBadge: {
    position: 'absolute',
    top: 60,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,59,71,0.90)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    zIndex: 10,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#fff',
  },
  recLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.heavy,
    color: '#fff',
    letterSpacing: 1,
  },

  // Panel
  panelWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
  },
  panel: {
    backgroundColor: COLORS.overlayLight,
    borderTopLeftRadius:  BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderTopWidth:   1,
    borderLeftWidth:  1,
    borderRightWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOW.lg,
  },
  panelContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  panelTitle: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.error,
    letterSpacing: FONTS.tracking.wider,
  },
  timer: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.heavy,
    color: COLORS.primary,
    letterSpacing: -1,
  },

  // Form
  section: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 72,
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  // Guidance
  guidanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.glow,
  },
  guidanceBtnText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wide,
  },
  guidanceBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
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
  },
  lawsLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  lawRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  lawDot: {
    width: 4,
    height: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    marginTop: 7,
    flexShrink: 0,
  },
  lawItem: {
    flex: 1,
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    lineHeight: 18,
  },

  // Vault
  vaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  vaultBtnDisabled: {
    opacity: 0.45,
  },
  vaultBtnText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wide,
  },

  // Vault success
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.successMuted,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  successIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.successMuted,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.success,
    letterSpacing: FONTS.tracking.wide,
  },
  successSubtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.errorMuted,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
  },
  errorMsg: {
    flex: 1,
    fontSize: FONTS.size.xs,
    color: COLORS.error,
    lineHeight: 18,
  },

  // Stop
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md + 2,
    marginTop: SPACING.xs,
    ...SHADOW.glowError,
  },
  stopBtnText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wider,
  },
});

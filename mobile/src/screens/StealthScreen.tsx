import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { startRecordingSession } from '../services/recording';

const MONO = Platform.select({ ios: 'SF Mono', android: 'monospace', default: 'monospace' });

interface StealthScreenProps {
  onEmergency: () => void;
}

export function StealthScreen({ onEmergency }: StealthScreenProps) {
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState('Recording in background');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the REC dot
  useEffect(() => {
    if (!isRecording) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isRecording, pulseAnim]);

  const [panResponder] = React.useState(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderRelease: (_evt: GestureResponderEvent, gestureState) => {
        if (Math.abs(gestureState.dy) < 50 && Math.abs(gestureState.dx) < 50) {
          onEmergency();
        }
      },
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await startRecordingSession('stealth_' + Date.now());
        if (isMounted) {
          setIsRecording(true);
          setRecordingMessage('Recording in background');
        }
      } catch (error) {
        if (__DEV__) console.warn('Start recording error:', error);
        if (isMounted) {
          setRecordingMessage('Recording failed — check microphone permissions');
          setIsRecording(false);
        }
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const minutes  = Math.floor(elapsedTime / 60);
  const seconds  = elapsedTime % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View
      style={[styles.container, !isRecording && styles.containerInactive]}
      {...panResponder.panHandlers}
    >
      <View style={styles.content}>
        {/* Clock */}
        <Text style={styles.clock}>{timeDisplay}</Text>

        {/* Recording indicator */}
        {isRecording ? (
          <View style={styles.recRow}>
            <Animated.View style={[styles.recDot, { opacity: pulseAnim }]} />
            <Text style={styles.recText}>{recordingMessage.toUpperCase()}</Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Help text */}
        <Text
          style={styles.helpText}
          accessibilityHint="Tap anywhere on screen to activate emergency mode"
        >
          TAP ANYWHERE TO ACTIVATE LEGAL SHIELD
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerInactive: {
    backgroundColor: '#000000',
  },
  content: {
    alignItems: 'center',
    gap: SPACING.lg,
  },
  clock: {
    fontFamily: MONO,
    fontSize: 68,
    fontWeight: '200',
    color: COLORS.text,
    letterSpacing: 6,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.error,
  },
  recText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.border,
  },
  helpText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    textAlign: 'center',
    fontWeight: FONTS.weight.semibold,
  },
});

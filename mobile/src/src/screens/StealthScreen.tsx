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
} from 'react-native';
import { Audio } from 'expo-av';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { startRecordingSession } from '../services/recording';

interface StealthScreenProps {
  onEmergency: () => void;
}

export function StealthScreen({ onEmergency }: StealthScreenProps) {
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState('Recording in background');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for recording dot
  useEffect(() => {
    if (!isRecording) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [isRecording, pulseAnim]);

  const [panResponder] = React.useState(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState) => {
        // Long press detection: if held for a moment
        if (gestureState.dy < 50 && gestureState.dx < 50) {
          // Long press detected - reveal emergency UI
          onEmergency();
        }
      },
    })
  );

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  // Start recording on mount
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

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <View
      style={[styles.container, !isRecording && styles.containerInactive]}
      {...panResponder.panHandlers}
    >
      {/* Black screen with minimal UI */}
      <View style={styles.display}>
        {/* Clock display */}
        <Text style={styles.clock}>{timeDisplay}</Text>

        {/* Recording indicator - only visible if actually recording */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
            <Text style={styles.recordingText}>{recordingMessage}</Text>
          </View>
        )}

        {/* Help text */}
        <Text style={styles.helpText} accessibilityHint="Long press anywhere on screen to activate emergency mode">Long press to activate emergency mode</Text>
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
  display: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clock: {
    fontSize: 72,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    fontFamily: FONTS.family.mono,
    letterSpacing: 4,
    marginBottom: SPACING.xl,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.error,
    marginRight: SPACING.md,
  },
  recordingText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.medium,
  },
  helpText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xl,
  },
});

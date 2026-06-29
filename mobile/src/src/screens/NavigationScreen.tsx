import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../constants/theme';
import { NAVIGATION_CONFIG } from '../constants/api';
import { LocationCoords } from '../types';
import { speedMsToMph, getStateFromCoordinates } from '../services/location';
import { SpeedIndicator } from '../components/SpeedIndicator';
import { getDePINEarnings, saveIncident } from '../services/storage';
import { checkCanEarn, processEarn } from '../services/depin';

interface NavigationScreenProps {
  location: LocationCoords | null;
  isLoading: boolean;
  error: string | null;
  isNavigating: boolean;
  onNavigationChange: (isNavigating: boolean) => void;
  onEmergency: () => void;
}

export function NavigationScreen({
  location,
  isLoading,
  error,
  isNavigating,
  onNavigationChange,
  onEmergency,
}: NavigationScreenProps) {
  const [alibiEarned, setAlibiEarned] = useState(0);
  const [lastEarnTime, setLastEarnTime] = useState(0);
  const [earnError, setEarnError] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const speedMph = location ? speedMsToMph(location.speed ?? null) : 0;

  const handleReportSubmission = useCallback(async (reportType: 'police_encounter' | 'traffic_crash' | 'road_hazard') => {
    if (!location) {
      Alert.alert('Location Required', 'Cannot submit a report without GPS location.');
      return;
    }

    try {
      setIsSubmittingReport(true);

      const state = await getStateFromCoordinates(location.latitude, location.longitude);
      const reportId = `report_${reportType}_${Date.now()}`;
      const hashInput = `${reportId}_${location.latitude}_${location.longitude}_${Date.now()}`;
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        hashInput,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      const descriptions: Record<string, string> = {
        police_encounter: 'Police encounter reported',
        traffic_crash: 'Traffic crash reported',
        road_hazard: 'Road hazard reported',
      };

      await saveIncident({
        id: reportId,
        timestamp: Date.now(),
        hash: hash.slice(0, 32),
        recordingPath: '',
        description: descriptions[reportType],
        state,
        duration: 0,
        onChainStatus: 'pending',
        latitude: location.latitude,
        longitude: location.longitude,
        speed: speedMph,
      });

      Alert.alert(
        'Report Submitted',
        `${descriptions[reportType]} at ${speedMph.toFixed(0)} MPH.\nHash: ${hash.slice(0, 12)}...\n\nGo to Vault to view or anchor on-chain.`,
        reportType === 'police_encounter'
          ? [
              { text: 'OK' },
              { text: 'LEGAL SHIELD', onPress: onEmergency, style: 'destructive' as const },
            ]
          : [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Report Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [location, speedMph, onEmergency]);

  // DePIN earning loop
  useEffect(() => {
    let earnInterval: NodeJS.Timeout;

    if (location && isNavigating) {
      earnInterval = setInterval(async () => {
        try {
          const canEarn = await checkCanEarn(
            location,
            isNavigating,
            location.mocked || false,
            lastEarnTime
          );

          if (canEarn.canEarn && canEarn.amount != null) {
            const amount = canEarn.amount;
            await processEarn(amount);
            setAlibiEarned((prev) => prev + amount);
            setLastEarnTime(Date.now());
            setEarnError(null);
          }
        } catch (err) {
          setEarnError(err instanceof Error ? err.message : 'Earning error');
        }
      }, NAVIGATION_CONFIG.earnCheckIntervalMs); // Cooldown is 30s, no need to poll faster
    }

    return () => {
      if (earnInterval) clearInterval(earnInterval);
    };
  }, [location, isNavigating, lastEarnTime]);

  // Load initial earnings
  useEffect(() => {
    (async () => {
      const earnings = await getDePINEarnings();
      setAlibiEarned(earnings.totalEarned);
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Initializing Navigation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Location Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map View */}
      {location && (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Your Location"
            description={`Speed: ${speedMph.toFixed(1)} MPH`}
          />
        </MapView>
      )}

      {/* Overlay Controls */}
      <ScrollView style={styles.overlay} scrollEnabled={true}>
        {/* Status Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={[styles.statusDot, { backgroundColor: isNavigating ? COLORS.success : COLORS.textMuted }]} />
            <Text style={styles.headerTitle}>ALIBI NAVIGATION</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {isNavigating ? 'Earning mode active' : 'Passive mode'}
          </Text>
        </View>

        {/* Speed Indicator */}
        <SpeedIndicator speedMph={speedMph} />

        {/* Earnings Display */}
        <View style={styles.earningsBox}>
          <Text style={styles.label}>TOTAL EARNED</Text>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsValue}>{alibiEarned.toFixed(2)}</Text>
            <Text style={styles.earningsCurrency}>$ALIBI</Text>
          </View>
          {earnError && <Text style={styles.errorSmall}>{earnError}</Text>}
        </View>

        {/* Navigation Toggle */}
        <TouchableOpacity
          style={[
            styles.button,
            isNavigating && styles.buttonActive,
          ]}
          onPress={() => onNavigationChange(!isNavigating)}
          activeOpacity={0.7}
          testID="btn-toggle-navigation"
          accessibilityRole="button"
          accessibilityLabel={isNavigating ? 'Stop navigation' : 'Start navigation'}
          accessibilityState={{ selected: isNavigating }}
        >
          <Ionicons
            name={isNavigating ? 'checkmark-circle' : 'navigate'}
            size={18}
            color={isNavigating ? COLORS.background : COLORS.primary}
            style={{ marginRight: SPACING.sm }}
          />
          <Text style={[styles.buttonText, isNavigating && styles.buttonTextActive]}>
            {isNavigating ? 'NAVIGATING' : 'START NAVIGATION'}
          </Text>
        </TouchableOpacity>

        {/* Report Buttons */}
        <View style={styles.reportSection}>
          <Text style={[styles.label, { marginBottom: SPACING.md }]}>REPORTS</Text>

          <TouchableOpacity
            style={[styles.reportButton, styles.reportPolice, isSubmittingReport && styles.reportButtonDisabled]}
            activeOpacity={0.7}
            onPress={() => handleReportSubmission('police_encounter')}
            disabled={isSubmittingReport}
            testID="btn-report-police"
            accessibilityRole="button"
            accessibilityLabel="Report police encounter"
            accessibilityHint="Submit a police encounter report with your current location"
          >
            <View style={[styles.reportIconWrap, { backgroundColor: COLORS.errorMuted }]}>
              <MaterialCommunityIcons name="police-badge" size={18} color={COLORS.error} />
            </View>
            <Text style={styles.reportLabel}>Police Encounter</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportButton, styles.reportCrash, isSubmittingReport && styles.reportButtonDisabled]}
            activeOpacity={0.7}
            onPress={() => handleReportSubmission('traffic_crash')}
            disabled={isSubmittingReport}
            accessibilityRole="button"
            accessibilityLabel="Report traffic crash"
          >
            <View style={[styles.reportIconWrap, { backgroundColor: COLORS.warningMuted }]}>
              <MaterialCommunityIcons name="car-emergency" size={18} color={COLORS.warning} />
            </View>
            <Text style={styles.reportLabel}>Traffic Crash</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportButton, styles.reportHazard, isSubmittingReport && styles.reportButtonDisabled]}
            activeOpacity={0.7}
            onPress={() => handleReportSubmission('road_hazard')}
            disabled={isSubmittingReport}
            accessibilityRole="button"
            accessibilityLabel="Report road hazard"
          >
            <View style={[styles.reportIconWrap, { backgroundColor: COLORS.warningMuted }]}>
              <Ionicons name="warning" size={18} color={COLORS.warning} />
            </View>
            <Text style={styles.reportLabel}>Road Hazard</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Emergency Button */}
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={onEmergency}
          activeOpacity={0.8}
          testID="btn-emergency"
          accessibilityRole="button"
          accessibilityLabel="Initiate legal shield"
          accessibilityHint="Activate emergency recording mode with camera and legal guidance"
        >
          <MaterialCommunityIcons name="shield-alert" size={22} color={COLORS.background} style={{ marginRight: SPACING.sm }} />
          <Text style={styles.emergencyText}>INITIATE LEGAL SHIELD</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    bottom: 80,
    left: SPACING.md,
    right: SPACING.md,
    maxHeight: 420,
    backgroundColor: COLORS.overlay,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOW.lg,
  },
  header: {
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.wider,
  },
  headerSubtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  label: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  earningsBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  earningsValue: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.bold,
    color: COLORS.success,
  },
  earningsCurrency: {
    marginLeft: SPACING.sm,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.medium,
  },
  errorSmall: {
    fontSize: FONTS.size.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryMuted,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  buttonText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: FONTS.tracking.wide,
  },
  buttonTextActive: {
    color: COLORS.background,
  },
  reportSection: {
    marginBottom: SPACING.lg,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  reportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  reportLabel: {
    flex: 1,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.text,
  },
  reportPolice: {
    borderColor: 'rgba(255,59,71,0.4)',
  },
  reportCrash: {
    borderColor: 'rgba(255,176,32,0.4)',
  },
  reportHazard: {
    borderColor: 'rgba(255,176,32,0.4)',
  },
  reportButtonDisabled: {
    opacity: 0.5,
  },
  emergencyButton: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  emergencyText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.background,
    letterSpacing: 1,
  },
});

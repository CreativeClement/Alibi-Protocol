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
import * as Crypto from 'expo-crypto';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
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
          <Text style={styles.headerTitle}>ALIBI NAVIGATION ACTIVE</Text>
          <Text style={styles.headerSubtitle}>
            {isNavigating ? 'Earning Mode' : 'Passive Mode'}
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
          <Text style={styles.buttonText}>
            {isNavigating ? '✓ NAVIGATING' : 'START NAVIGATION'}
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
            <Text style={styles.reportIcon}>👮</Text>
            <Text style={styles.reportLabel}>Police Encounter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportButton, styles.reportCrash, isSubmittingReport && styles.reportButtonDisabled]}
            activeOpacity={0.7}
            onPress={() => handleReportSubmission('traffic_crash')}
            disabled={isSubmittingReport}
            accessibilityRole="button"
            accessibilityLabel="Report traffic crash"
          >
            <Text style={styles.reportIcon}>🚗</Text>
            <Text style={styles.reportLabel}>Traffic Crash</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportButton, styles.reportHazard, isSubmittingReport && styles.reportButtonDisabled]}
            activeOpacity={0.7}
            onPress={() => handleReportSubmission('road_hazard')}
            disabled={isSubmittingReport}
            accessibilityRole="button"
            accessibilityLabel="Report road hazard"
          >
            <Text style={styles.reportIcon}>⚠️</Text>
            <Text style={styles.reportLabel}>Road Hazard</Text>
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
          <Text style={styles.emergencyIcon}>🛡️</Text>
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
    maxHeight: 400,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
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
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  buttonText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  reportSection: {
    marginBottom: SPACING.lg,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  reportIcon: {
    fontSize: FONTS.size.lg,
    marginRight: SPACING.md,
  },
  reportLabel: {
    flex: 1,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    color: COLORS.text,
  },
  reportPolice: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderColor: COLORS.error,
  },
  reportCrash: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderColor: COLORS.warning,
  },
  reportHazard: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderColor: COLORS.warning,
  },
  reportButtonDisabled: {
    opacity: 0.5,
  },
  emergencyButton: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  emergencyIcon: {
    fontSize: FONTS.size.xl,
    marginRight: SPACING.md,
  },
  emergencyText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.background,
    letterSpacing: 1,
  },
});

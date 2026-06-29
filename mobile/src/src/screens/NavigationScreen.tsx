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

  const handleReportSubmission = useCallback(
    async (reportType: 'police_encounter' | 'traffic_crash' | 'road_hazard') => {
      if (!location) {
        Alert.alert('Location Required', 'Cannot submit a report without GPS location.');
        return;
      }
      try {
        setIsSubmittingReport(true);
        const state = await getStateFromCoordinates(location.latitude, location.longitude);
        const reportId = `report_${reportType}_${Date.now()}`;
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${reportId}_${location.latitude}_${location.longitude}_${Date.now()}`,
          { encoding: Crypto.CryptoEncoding.HEX }
        );
        const descriptions: Record<string, string> = {
          police_encounter: 'Police encounter reported',
          traffic_crash:    'Traffic crash reported',
          road_hazard:      'Road hazard reported',
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
    },
    [location, speedMph, onEmergency]
  );

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
            await processEarn(canEarn.amount);
            setAlibiEarned((prev) => prev + canEarn.amount!);
            setLastEarnTime(Date.now());
            setEarnError(null);
          }
        } catch (err) {
          setEarnError(err instanceof Error ? err.message : 'Earning error');
        }
      }, NAVIGATION_CONFIG.earnCheckIntervalMs);
    }
    return () => { if (earnInterval) clearInterval(earnInterval); };
  }, [location, isNavigating, lastEarnTime]);

  useEffect(() => {
    (async () => {
      const earnings = await getDePINEarnings();
      setAlibiEarned(earnings.totalEarned);
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centeredLabel}>Initializing Navigation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="location-outline" size={40} color={COLORS.error} />
        <Text style={styles.centeredTitle}>Location Error</Text>
        <Text style={styles.centeredLabel}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      {location && (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
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
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Your Location"
            description={`Speed: ${speedMph.toFixed(1)} MPH`}
          />
        </MapView>
      )}

      {/* Bottom overlay panel */}
      <View style={styles.panel}>
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderLeft}>
              <View style={[styles.statusDot, { backgroundColor: isNavigating ? COLORS.success : COLORS.textMuted }]} />
              <Text style={styles.panelTitle}>ALIBI NAVIGATION</Text>
            </View>
            <Text style={styles.panelMode}>
              {isNavigating ? 'EARN MODE' : 'PASSIVE'}
            </Text>
          </View>

          {/* Speed */}
          <SpeedIndicator speedMph={speedMph} />

          {/* Earnings */}
          <View style={styles.earningsRow}>
            <View style={styles.earningsBox}>
              <Text style={styles.microLabel}>TOTAL EARNED</Text>
              <View style={styles.earningsValueRow}>
                <Text style={styles.earningsValue}>{alibiEarned.toFixed(2)}</Text>
                <Text style={styles.earningsCurrency}>$ALIBI</Text>
              </View>
              {earnError && <Text style={styles.errorSmall}>{earnError}</Text>}
            </View>

            {/* Nav toggle */}
            <TouchableOpacity
              style={[styles.navToggle, isNavigating && styles.navToggleActive]}
              onPress={() => onNavigationChange(!isNavigating)}
              activeOpacity={0.75}
              testID="btn-toggle-navigation"
              accessibilityRole="button"
              accessibilityLabel={isNavigating ? 'Stop navigation' : 'Start navigation'}
              accessibilityState={{ selected: isNavigating }}
            >
              <Ionicons
                name={isNavigating ? 'checkmark-circle' : 'navigate'}
                size={20}
                color={isNavigating ? COLORS.textInverse : COLORS.primary}
              />
              <Text style={[styles.navToggleText, isNavigating && styles.navToggleTextActive]}>
                {isNavigating ? 'STOP' : 'START'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reports */}
          <Text style={styles.microLabel}>REPORTS</Text>

          {[
            {
              type: 'police_encounter' as const,
              label: 'Police Encounter',
              icon: <MaterialCommunityIcons name="police-badge" size={18} color={COLORS.error} />,
              borderColor: COLORS.errorBorder,
              bgColor: COLORS.errorMuted,
            },
            {
              type: 'traffic_crash' as const,
              label: 'Traffic Crash',
              icon: <MaterialCommunityIcons name="car-emergency" size={18} color={COLORS.warning} />,
              borderColor: COLORS.warningBorder,
              bgColor: COLORS.warningMuted,
            },
            {
              type: 'road_hazard' as const,
              label: 'Road Hazard',
              icon: <Ionicons name="warning" size={18} color={COLORS.warning} />,
              borderColor: COLORS.warningBorder,
              bgColor: COLORS.warningMuted,
            },
          ].map(({ type, label, icon, borderColor, bgColor }) => (
            <TouchableOpacity
              key={type}
              style={[styles.reportRow, { borderColor }, isSubmittingReport && styles.reportRowDisabled]}
              onPress={() => handleReportSubmission(type)}
              activeOpacity={0.7}
              disabled={isSubmittingReport}
              accessibilityRole="button"
              accessibilityLabel={`Report ${label}`}
            >
              <View style={[styles.reportIconWrap, { backgroundColor: bgColor }]}>{icon}</View>
              <Text style={styles.reportLabel}>{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}

          {/* Emergency */}
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={onEmergency}
            activeOpacity={0.8}
            testID="btn-emergency"
            accessibilityRole="button"
            accessibilityLabel="Initiate legal shield"
          >
            <MaterialCommunityIcons
              name="shield-alert"
              size={20}
              color={COLORS.textInverse}
              style={{ marginRight: SPACING.sm }}
            />
            <Text style={styles.emergencyText}>INITIATE LEGAL SHIELD</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  centeredTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.error,
  },
  centeredLabel: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%',
    backgroundColor: COLORS.overlayLight,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOW.lg,
  },
  panelScroll: {
    flexGrow: 0,
  },
  panelContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
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
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  panelTitle: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.wider,
  },
  panelMode: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },

  // Earnings + toggle row
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  earningsBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  earningsValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
  earningsValue: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.heavy,
    color: COLORS.success,
    letterSpacing: -1,
  },
  earningsCurrency: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.semibold,
    letterSpacing: FONTS.tracking.wide,
    marginBottom: 2,
  },
  errorSmall: {
    fontSize: FONTS.size.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  navToggle: {
    width: 72,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    gap: 4,
  },
  navToggleActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  navToggleText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: FONTS.tracking.label,
  },
  navToggleTextActive: {
    color: COLORS.textInverse,
  },

  // Reports
  microLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  reportRowDisabled: {
    opacity: 0.45,
  },
  reportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLabel: {
    flex: 1,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.text,
  },

  // Emergency
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
    ...SHADOW.glowError,
  },
  emergencyText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wider,
  },
});

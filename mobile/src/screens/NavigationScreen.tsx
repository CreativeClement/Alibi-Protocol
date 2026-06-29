import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { MapBackground } from '../components/MapBackground';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../constants/theme';
import { NAVIGATION_CONFIG } from '../constants/api';
import { AlertType, LocationCoords, MapAlert, Place } from '../types';
import { speedMsToMph, getStateFromCoordinates } from '../services/location';
import { getDePINEarnings, saveIncident } from '../services/storage';
import { checkCanEarn, processEarn } from '../services/depin';
import { useNavPreferences } from '../hooks/useNavPreferences';
import { useNavigation } from '../hooks/useNavigation';
import { localAlerts } from '../services/navigation/alerts';
import { SearchBar } from '../components/nav/SearchBar';
import { InstructionBanner } from '../components/nav/InstructionBanner';
import { EtaBar } from '../components/nav/EtaBar';
import { AlertToast } from '../components/nav/AlertToast';
import { CameraControls } from '../components/nav/CameraControls';
import { RouteOverview } from '../components/nav/RouteOverview';
import { PrefsSheet } from '../components/nav/PrefsSheet';

interface NavigationScreenProps {
  location: LocationCoords | null;
  isLoading: boolean;
  error: string | null;
  isNavigating: boolean;
  onNavigationChange: (isNavigating: boolean) => void;
  onEmergency: () => void;
}

/** Demo coordinate used when GPS is unavailable (e.g. web preview). */
const DEMO_LOCATION: LocationCoords = {
  latitude: 37.7749,
  longitude: -122.4194,
  speed: 0,
  heading: 0,
};

export function NavigationScreen({
  location,
  isLoading,
  error,
  isNavigating,
  onNavigationChange,
  onEmergency,
}: NavigationScreenProps) {
  const { prefs, update, toggle } = useNavPreferences();

  const usingDemo = !location;
  const activeLocation = location ?? DEMO_LOCATION;
  const speedMph = activeLocation ? speedMsToMph(activeLocation.speed ?? null) : 0;

  const nav = useNavigation({ location: activeLocation, prefs });
  const driving = nav.phase === 'navigating';

  const [alibiEarned, setAlibiEarned] = useState(0);
  const [lastEarnTime, setLastEarnTime] = useState(0);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [localAlertList, setLocalAlertList] = useState<MapAlert[]>([]);

  // Keep parent "driving" state in sync for any cross-screen logic.
  useEffect(() => {
    onNavigationChange(driving);
  }, [driving, onNavigationChange]);

  // DePIN earning loop runs while actively navigating (driving earns $ALIBI).
  useEffect(() => {
    let earnInterval: ReturnType<typeof setInterval> | undefined;
    if (location && driving) {
      earnInterval = setInterval(async () => {
        try {
          const canEarn = await checkCanEarn(
            location,
            true,
            location.mocked || false,
            lastEarnTime
          );
          if (canEarn.canEarn && canEarn.amount != null) {
            await processEarn(canEarn.amount);
            setAlibiEarned((prev) => prev + canEarn.amount!);
            setLastEarnTime(Date.now());
          }
        } catch {
          // Earning is best-effort; ignore transient failures.
        }
      }, NAVIGATION_CONFIG.earnCheckIntervalMs);
    }
    return () => {
      if (earnInterval) clearInterval(earnInterval);
    };
  }, [location, driving, lastEarnTime]);

  useEffect(() => {
    (async () => {
      const earnings = await getDePINEarnings();
      setAlibiEarned(earnings.totalEarned);
    })();
  }, []);

  const handleReport = useCallback(
    async (
      type: 'police_encounter' | 'traffic_crash' | 'road_hazard',
      alertType: AlertType
    ) => {
      if (!activeLocation) return;
      // Drop a live map alert immediately for Waze-style crowd reporting.
      localAlerts.add(alertType, {
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
      });
      setLocalAlertList(await localAlerts.getAlerts(activeLocation));

      try {
        const state = await getStateFromCoordinates(
          activeLocation.latitude,
          activeLocation.longitude
        );
        const reportId = `report_${type}_${Date.now()}`;
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${reportId}_${activeLocation.latitude}_${activeLocation.longitude}_${Date.now()}`,
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
          description: descriptions[type],
          state,
          duration: 0,
          onChainStatus: 'pending',
          latitude: activeLocation.latitude,
          longitude: activeLocation.longitude,
          speed: speedMph,
        });
      } catch {
        // Reporting the alert on the map already succeeded; vault write is best-effort.
      }
    },
    [activeLocation, speedMph]
  );

  const onReportAlertPress = useCallback(() => {
    Alert.alert('Report', 'What do you see ahead?', [
      { text: 'Police', onPress: () => handleReport('police_encounter', 'police') },
      { text: 'Crash', onPress: () => handleReport('traffic_crash', 'crash') },
      { text: 'Hazard', onPress: () => handleReport('road_hazard', 'hazard') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handleReport]);

  const handleSelectDestination = useCallback(
    (place: Place) => {
      void nav.previewDestination(place);
    },
    [nav]
  );

  if (isLoading && !location) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centeredLabel}>Initializing Navigation…</Text>
      </View>
    );
  }

  const combinedAlerts = [...nav.alerts, ...localAlertList].filter(
    (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i
  );

  return (
    <View style={styles.container}>
      <MapBackground
        location={activeLocation}
        speedMph={speedMph}
        route={nav.route}
        destination={nav.destination}
        alerts={combinedAlerts}
        viewMode={prefs.viewMode}
        mapType={prefs.mapType}
        headingUp={prefs.headingUp}
        navigating={driving}
        recenterSignal={recenterSignal}
        nightMode={prefs.themeMode !== 'day'}
      />

      {/* ── Top region ───────────────────────────────────────────────── */}
      <View style={styles.topRegion} pointerEvents="box-none">
        {driving ? (
          <InstructionBanner
            step={nav.currentStep}
            nextStep={nav.nextStep}
            distanceToManeuverMeters={nav.distanceToNextManeuverMeters}
            units={prefs.units}
            recalculating={nav.recalculating}
          />
        ) : (
          <SearchBar
            onSearch={nav.search}
            onSelect={handleSelectDestination}
            onOpenPrefs={() => setPrefsOpen(true)}
            units={prefs.units}
          />
        )}

        {prefs.alertsEnabled && nav.activeAlert ? (
          <View style={styles.alertWrap}>
            <AlertToast alert={nav.activeAlert} />
          </View>
        ) : null}

        {usingDemo ? (
          <View style={styles.demoChip}>
            <Ionicons name="information-circle" size={13} color={COLORS.warning} />
            <Text style={styles.demoText}>Demo location · enable GPS on device</Text>
          </View>
        ) : null}
      </View>

      {/* ── Camera controls (right rail) ─────────────────────────────── */}
      <View style={styles.cameraRail} pointerEvents="box-none">
        <CameraControls
          viewMode={prefs.viewMode}
          onToggleViewMode={() => update({ viewMode: prefs.viewMode === '3d' ? '2d' : '3d' })}
          onRecenter={() => setRecenterSignal((n) => n + 1)}
          onReportAlert={onReportAlertPress}
          showReport={driving}
        />
      </View>

      {/* ── Bottom region (phase-driven) ─────────────────────────────── */}
      <View style={styles.bottomRegion} pointerEvents="box-none">
        {nav.phase === 'overview' && nav.destination && nav.route ? (
          <RouteOverview
            destination={nav.destination}
            route={nav.route}
            units={prefs.units}
            loading={nav.recalculating}
            onStart={nav.startNavigation}
            onCancel={nav.stopNavigation}
          />
        ) : null}

        {nav.phase === 'navigating' ? (
          <View style={styles.navBottom}>
            <View style={styles.speedChip}>
              <Text style={styles.speedValue}>{Math.round(speedMph)}</Text>
              <Text style={styles.speedUnit}>{prefs.units === 'imperial' ? 'MPH' : 'KMH'}</Text>
            </View>
            <View style={styles.etaWrap}>
              <EtaBar
                remainingDistanceMeters={nav.remainingDistanceMeters}
                remainingDurationSeconds={nav.remainingDurationSeconds}
                units={prefs.units}
                onStop={nav.stopNavigation}
              />
            </View>
          </View>
        ) : null}

        {nav.phase === 'arrived' ? (
          <View style={styles.arrivedCard}>
            <View style={styles.arrivedIcon}>
              <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.arrivedTitle}>You&apos;ve arrived</Text>
              <Text style={styles.arrivedSub} numberOfLines={1}>
                {nav.destination?.name ?? 'Destination'}
              </Text>
            </View>
            <TouchableOpacity style={styles.arrivedDone} onPress={nav.stopNavigation}>
              <Text style={styles.arrivedDoneText}>DONE</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {nav.phase === 'idle' ? (
          <IdlePanel
            speedMph={speedMph}
            alibiEarned={alibiEarned}
            error={error}
            onReport={handleReport}
            onEmergency={onEmergency}
          />
        ) : null}
      </View>

      <PrefsSheet
        visible={prefsOpen}
        prefs={prefs}
        onClose={() => setPrefsOpen(false)}
        onUpdate={update}
        onToggle={toggle}
      />
    </View>
  );
}

// ── Idle panel: ops dashboard with speed, earnings, reports, emergency ──────
interface IdlePanelProps {
  speedMph: number;
  alibiEarned: number;
  error: string | null;
  onReport: (
    type: 'police_encounter' | 'traffic_crash' | 'road_hazard',
    alertType: AlertType
  ) => void;
  onEmergency: () => void;
}

const IdlePanel = React.memo(function IdlePanel({
  speedMph,
  alibiEarned,
  error,
  onReport,
  onEmergency,
}: IdlePanelProps) {
  const reports = [
    {
      type: 'police_encounter' as const,
      alertType: 'police' as AlertType,
      label: 'Police',
      icon: <MaterialCommunityIcons name="police-badge" size={18} color={COLORS.error} />,
      borderColor: COLORS.errorBorder,
      bgColor: COLORS.errorMuted,
    },
    {
      type: 'traffic_crash' as const,
      alertType: 'crash' as AlertType,
      label: 'Crash',
      icon: <MaterialCommunityIcons name="car-emergency" size={18} color={COLORS.warning} />,
      borderColor: COLORS.warningBorder,
      bgColor: COLORS.warningMuted,
    },
    {
      type: 'road_hazard' as const,
      alertType: 'hazard' as AlertType,
      label: 'Hazard',
      icon: <Ionicons name="warning" size={18} color={COLORS.warning} />,
      borderColor: COLORS.warningBorder,
      bgColor: COLORS.warningMuted,
    },
  ];

  return (
    <View style={styles.panel}>
      <ScrollView
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderLeft}>
            <View style={styles.handleBar} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.microLabel}>SPEED</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statBig}>{Math.round(speedMph)}</Text>
              <Text style={styles.statUnit}>MPH</Text>
            </View>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.microLabel}>EARNED</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statBig, { color: COLORS.success }]}>
                {alibiEarned.toFixed(2)}
              </Text>
              <Text style={styles.statUnit}>$ALIBI</Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.infoRow}>
            <Ionicons name="navigate-circle-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.infoText}>Search a destination to start turn-by-turn</Text>
          </View>
        ) : null}

        <Text style={styles.microLabel}>QUICK REPORT</Text>
        <View style={styles.reportGrid}>
          {reports.map(({ type, alertType, label, icon, borderColor, bgColor }) => (
            <TouchableOpacity
              key={type}
              style={[styles.reportCard, { borderColor }]}
              onPress={() => onReport(type, alertType)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Report ${label}`}
            >
              <View style={[styles.reportIconWrap, { backgroundColor: bgColor }]}>{icon}</View>
              <Text style={styles.reportLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  centeredLabel: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Top region
  topRegion: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
  },
  alertWrap: { marginTop: SPACING.sm },
  demoChip: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  demoText: {
    fontSize: FONTS.size.xs,
    color: COLORS.warning,
    fontWeight: FONTS.weight.semibold,
  },

  // Camera rail
  cameraRail: {
    position: 'absolute',
    right: SPACING.md,
    top: '38%',
  },

  // Bottom region
  bottomRegion: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
  },
  navBottom: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  speedChip: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.lg,
  },
  speedValue: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.tight,
  },
  speedUnit: {
    fontSize: 8,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  etaWrap: { flex: 1 },

  // Arrived
  arrivedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    padding: SPACING.md,
    ...SHADOW.lg,
  },
  arrivedIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivedTitle: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
  },
  arrivedSub: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: 1 },
  arrivedDone: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.successMuted,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  arrivedDoneText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.success,
    letterSpacing: FONTS.tracking.label,
  },

  // Idle panel
  panel: {
    maxHeight: 320,
    backgroundColor: COLORS.overlayLight,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOW.lg,
  },
  panelContent: { padding: SPACING.md },
  panelHeader: { alignItems: 'center', marginBottom: SPACING.sm },
  panelHeaderLeft: { alignItems: 'center' },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
  },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs },
  statBig: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.tight,
  },
  statUnit: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.semibold,
    letterSpacing: FONTS.tracking.wide,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  infoText: { fontSize: FONTS.size.xs, color: COLORS.textMuted },
  microLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  reportGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  reportCard: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
  },
  reportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.text,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    ...SHADOW.glowError,
  },
  emergencyText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wider,
  },
});

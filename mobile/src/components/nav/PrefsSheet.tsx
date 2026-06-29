import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { SectionLabel } from '../primitives';
import type { NavPreferences } from '../../types';

interface PrefsSheetProps {
  visible: boolean;
  prefs: NavPreferences;
  onClose: () => void;
  onUpdate: (patch: Partial<NavPreferences>) => void;
  onToggle: (key: keyof NavPreferences) => void;
}

export function PrefsSheet({ visible, prefs, onClose, onUpdate, onToggle }: PrefsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Map & Navigation</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <SectionLabel>View</SectionLabel>
            <Segmented
              options={[
                { label: '3D', value: '3d' },
                { label: '2D', value: '2d' },
              ]}
              value={prefs.viewMode}
              onChange={(v) => onUpdate({ viewMode: v as NavPreferences['viewMode'] })}
            />
            <View style={styles.gap} />
            <Segmented
              options={[
                { label: 'Standard', value: 'standard' },
                { label: 'Satellite', value: 'satellite' },
                { label: 'Hybrid', value: 'hybrid' },
              ]}
              value={prefs.mapType}
              onChange={(v) => onUpdate({ mapType: v as NavPreferences['mapType'] })}
            />

            <View style={styles.sectionGap} />
            <SectionLabel>Theme</SectionLabel>
            <Segmented
              options={[
                { label: 'Auto', value: 'auto' },
                { label: 'Day', value: 'day' },
                { label: 'Night', value: 'night' },
              ]}
              value={prefs.themeMode}
              onChange={(v) => onUpdate({ themeMode: v as NavPreferences['themeMode'] })}
            />

            <View style={styles.sectionGap} />
            <SectionLabel>Units</SectionLabel>
            <Segmented
              options={[
                { label: 'Miles', value: 'imperial' },
                { label: 'Kilometers', value: 'metric' },
              ]}
              value={prefs.units}
              onChange={(v) => onUpdate({ units: v as NavPreferences['units'] })}
            />

            <View style={styles.sectionGap} />
            <SectionLabel>Guidance</SectionLabel>
            <ToggleRow
              icon="volume-high"
              label="Voice guidance"
              value={prefs.voiceEnabled}
              onToggle={() => onToggle('voiceEnabled')}
            />
            <ToggleRow
              icon="compass"
              label="Rotate map to heading"
              value={prefs.headingUp}
              onToggle={() => onToggle('headingUp')}
            />
            <ToggleRow
              icon="alert-circle"
              label="Hazard & police alerts"
              value={prefs.alertsEnabled}
              onToggle={() => onToggle('alertsEnabled')}
            />

            <View style={styles.sectionGap} />
            <SectionLabel>Route</SectionLabel>
            <ToggleRow
              icon="car"
              label="Avoid highways"
              value={prefs.avoidHighways}
              onToggle={() => onToggle('avoidHighways')}
            />
            <ToggleRow
              icon="cash"
              label="Avoid tolls"
              value={prefs.avoidTolls}
              onToggle={() => onToggle('avoidTolls')}
            />
            <View style={styles.bottomPad} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface SegmentedProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface ToggleRowProps {
  icon: string;
  label: string;
  value: boolean;
  onToggle: () => void;
}

function ToggleRow({ icon, label, value, onToggle }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        <Ionicons name={icon as any} size={18} color={COLORS.textSecondary} />
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.surfaceHover, true: COLORS.primaryDark }}
        thumbColor={value ? COLORS.primary : COLORS.textMuted}
        ios_backgroundColor={COLORS.surfaceHover}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.wide,
  },
  body: { paddingBottom: SPACING.md },
  gap: { height: SPACING.sm },
  sectionGap: { height: SPACING.lg },
  bottomPad: { height: SPACING.xl },
  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  segmentText: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.wide,
  },
  segmentTextActive: { color: COLORS.primary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  toggleLabel: {
    fontSize: FONTS.size.base,
    color: COLORS.text,
    fontWeight: FONTS.weight.medium,
  },
});

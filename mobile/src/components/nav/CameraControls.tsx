import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../../constants/theme';
import type { MapViewMode } from '../../types';

interface CameraControlsProps {
  viewMode: MapViewMode;
  onToggleViewMode: () => void;
  onRecenter: () => void;
  onReportAlert: () => void;
  showReport: boolean;
}

export function CameraControls({
  viewMode,
  onToggleViewMode,
  onRecenter,
  onReportAlert,
  showReport,
}: CameraControlsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onToggleViewMode} accessibilityLabel="Toggle 2D/3D view">
        <MaterialCommunityIcons
          name={viewMode === '3d' ? 'cube-outline' : 'square-outline'}
          size={20}
          color={COLORS.primary}
        />
        <Text style={styles.buttonLabel}>{viewMode === '3d' ? '3D' : '2D'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onRecenter} accessibilityLabel="Recenter map">
        <Ionicons name="navigate" size={20} color={COLORS.primary} />
      </TouchableOpacity>

      {showReport ? (
        <TouchableOpacity
          style={[styles.button, styles.reportButton]}
          onPress={onReportAlert}
          accessibilityLabel="Report an alert"
        >
          <Ionicons name="alert-circle" size={22} color={COLORS.error} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm, alignItems: 'center' },
  button: {
    width: 48,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    ...SHADOW.md,
  },
  buttonLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: FONTS.tracking.wide,
    marginTop: 2,
  },
  reportButton: {
    borderColor: COLORS.errorBorder,
  },
});

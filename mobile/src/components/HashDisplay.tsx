import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

const MONO_FONT = Platform.select({ ios: 'SF Mono', android: 'monospace', default: 'monospace' });

interface HashDisplayProps {
  hash: string;
  label?: string;
  txSignature?: string;
  onViewOnChain?: () => void;
}

export const HashDisplay = React.memo(function HashDisplay({
  hash,
  label = 'INCIDENT HASH',
  txSignature,
  onViewOnChain,
}: HashDisplayProps) {
  const displayHash = hash && hash.length > 0 ? hash : 'CALCULATING...';

  return (
    <View style={styles.container}>
      {/* Hash row */}
      <Text style={styles.label}>{label}</Text>
      <View style={styles.hashBox}>
        <View style={styles.hashIconWrap}>
          <Ionicons name="lock-closed" size={12} color={COLORS.primary} />
        </View>
        <Text style={styles.hash} numberOfLines={1} ellipsizeMode="middle">
          {displayHash}
        </Text>
      </View>

      {/* TX Signature */}
      {txSignature && (
        <>
          <Text style={[styles.label, { marginTop: SPACING.md }]}>TX SIGNATURE</Text>
          <TouchableOpacity
            style={styles.txBox}
            onPress={onViewOnChain}
            activeOpacity={0.75}
            accessibilityRole="link"
            accessibilityLabel="View transaction on Solscan"
          >
            <Text style={styles.txSignature} numberOfLines={1} ellipsizeMode="middle">
              {txSignature.slice(0, 24)}...
            </Text>
            <View style={styles.viewRow}>
              <Text style={styles.viewLink}>VIEW ON-CHAIN</Text>
              <Ionicons name="arrow-forward" size={11} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  hashBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    gap: SPACING.sm,
  },
  hashIconWrap: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.xs,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hash: {
    flex: 1,
    fontFamily: MONO_FONT,
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    letterSpacing: 0.4,
  },
  txBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  txSignature: {
    fontFamily: MONO_FONT,
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    letterSpacing: 0.4,
    marginBottom: SPACING.xs,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewLink: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weight.semibold,
    letterSpacing: FONTS.tracking.wide,
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

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
      <Text style={styles.label}>{label}</Text>

      <View style={styles.hashBox}>
        <Text style={styles.hash} numberOfLines={1} ellipsizeMode="middle">
          {displayHash}
        </Text>
      </View>

      {txSignature && (
        <>
          <Text style={[styles.label, { marginTop: SPACING.md }]}>TX SIGNATURE</Text>
          <TouchableOpacity
            style={styles.txBox}
            onPress={onViewOnChain}
            activeOpacity={0.7}
          >
            <Text style={styles.txSignature} numberOfLines={1} ellipsizeMode="middle">
              {txSignature.slice(0, 20)}...
            </Text>
            <Text style={styles.viewLink}>VIEW ON-CHAIN →</Text>
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
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  hashBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hash: {
    fontFamily: MONO_FONT,
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  txBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  txSignature: {
    fontFamily: MONO_FONT,
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  viewLink: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weight.medium,
  },
});

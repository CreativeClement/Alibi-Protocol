import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { PublicKey } from '@solana/web3.js';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../constants/theme';
import { WalletState } from '../types';
import { getDePINEarnings } from '../services/storage';
import { ScreenHeader } from '../components/primitives';

interface WalletScreenProps {
  wallet: WalletState;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletScreen({ wallet, onConnect, onDisconnect }: WalletScreenProps) {
  const [depinEarnings, setDePINEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadWalletData = useCallback(async () => {
    try {
      setIsLoading(true);
      const earnings = await getDePINEarnings();
      setDePINEarnings(earnings.totalEarned);
    } catch (error) {
      if (__DEV__) console.warn('Load wallet data error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadWalletData(); }, [loadWalletData]);

  const truncateKey = (pubkey: PublicKey | null): string => {
    if (!pubkey) return '';
    const s = pubkey.toBase58();
    return `${s.slice(0, 8)}...${s.slice(-8)}`;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="WALLET"
        subtitle={wallet.connected ? 'Phantom connected' : 'Not connected'}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Wallet Connection */}
          <Text style={styles.sectionLabel}>WALLET STATUS</Text>

          {wallet.connected ? (
            <View style={[styles.card, styles.cardConnected]}>
              <View style={styles.connectedTopRow}>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusPillText}>CONNECTED</Text>
                </View>
                <TouchableOpacity
                  style={styles.disconnectBtn}
                  onPress={onDisconnect}
                  activeOpacity={0.75}
                  testID="btn-disconnect-wallet"
                  accessibilityRole="button"
                  accessibilityLabel="Disconnect wallet"
                >
                  <Text style={styles.disconnectBtnText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.publicKey}>{truncateKey(wallet.publicKey)}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.disconnectedNote}>Connect your Phantom wallet to vault evidence on-chain and claim DePIN rewards.</Text>
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={onConnect}
                activeOpacity={0.8}
                testID="btn-connect-wallet"
                accessibilityRole="button"
                accessibilityLabel="Connect Phantom wallet"
              >
                <Ionicons name="wallet" size={18} color={COLORS.textInverse} style={{ marginRight: SPACING.sm }} />
                <Text style={styles.connectBtnText}>CONNECT PHANTOM WALLET</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Balance */}
          <Text style={styles.sectionLabel}>BALANCE</Text>
          <View style={styles.card}>
            <View style={styles.balanceRow}>
              <View style={styles.balanceIconWrap}>
                <Ionicons name="logo-bitcoin" size={18} color={COLORS.warning} />
              </View>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>SOL BALANCE</Text>
                <Text style={styles.balanceValue}>{wallet.balance.toFixed(3)} SOL</Text>
              </View>
            </View>
          </View>

          {/* DePIN Earnings */}
          <Text style={styles.sectionLabel}>DEPIN EARNINGS</Text>
          <View style={[styles.card, styles.cardEarnings]}>
            <View style={styles.earningsHeader}>
              <Text style={styles.earningsLabel}>TOTAL EARNED</Text>
              <View style={styles.earningsValueRow}>
                <Text style={styles.earningsValue}>{depinEarnings.toFixed(2)}</Text>
                <Text style={styles.earningsCurrency}>$ALIBI</Text>
              </View>
            </View>
            <View style={styles.earningsDivider} />
            <Text style={styles.earningsNote}>Earn rewards by driving with navigation active</Text>
          </View>

          {/* Security */}
          <View style={[styles.card, styles.cardSecurity]}>
            <View style={styles.securityHeaderRow}>
              <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
              <Text style={styles.securityTitle}>SECURITY</Text>
            </View>
            {[
              'Private keys stored in Hardware Enclave (Apple Secure Enclave / Android Keystore)',
              'Phantom wallet used for signing transactions',
              'Evidence vaulted immutably on Solana blockchain',
            ].map((item) => (
              <View key={item} style={styles.securityRow}>
                <Ionicons name="checkmark" size={12} color={COLORS.success} style={{ marginTop: 2 }} />
                <Text style={styles.securityText}>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
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
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  sectionLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  cardConnected: {
    borderColor: COLORS.successBorder,
  },
  cardEarnings: {
    borderColor: COLORS.successBorder,
  },
  cardDashed: {
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
  },
  cardSecurity: {
    borderColor: COLORS.primaryBorder,
    marginBottom: SPACING.xl,
  },

  // Connected
  connectedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.successMuted,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.success,
  },
  statusPillText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.success,
    letterSpacing: FONTS.tracking.label,
  },
  disconnectBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    backgroundColor: COLORS.errorMuted,
  },
  disconnectBtnText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.error,
    letterSpacing: FONTS.tracking.wide,
  },
  publicKey: {
    fontFamily: undefined,
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // Disconnected
  disconnectedNote: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    ...SHADOW.glow,
  },
  connectBtnText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textInverse,
    letterSpacing: FONTS.tracking.wide,
  },

  // Balance
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  balanceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.warningMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  balanceInfo: { flex: 1 },
  balanceLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.primary,
  },

  // Earnings
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  earningsLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  earningsValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
  earningsValue: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.success,
    letterSpacing: -0.5,
  },
  earningsCurrency: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.semibold,
    letterSpacing: FONTS.tracking.wide,
    marginBottom: 2,
  },
  earningsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  earningsNote: {
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
    letterSpacing: 0.2,
  },

  // Staking
  comingSoonBadgeRow: { marginBottom: SPACING.md },
  comingSoonBadge: {
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: BORDER_RADIUS.sm,
  },
  comingSoonBadgeText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.warning,
    letterSpacing: FONTS.tracking.wider,
  },
  comingSoonTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  comingSoonBody: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Security
  securityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  securityTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: FONTS.tracking.wider,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  securityText: {
    flex: 1,
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    lineHeight: 18,
  },
});

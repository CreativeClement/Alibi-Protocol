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
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { WalletState } from '../types';
import { getDePINEarnings } from '../services/storage';

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

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const truncatePublicKey = (pubkey: PublicKey | null): string => {
    if (!pubkey) return '';
    const str = pubkey.toBase58();
    return `${str.slice(0, 8)}...${str.slice(-8)}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WALLET</Text>
        <Text style={styles.headerSubtitle}>
          {wallet.connected ? 'Connected' : 'Not connected'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Wallet Connection Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WALLET STATUS</Text>

            {wallet.connected ? (
              <View style={styles.connectedBox}>
                <Text style={styles.connectedLabel}>CONNECTED</Text>
                <Text style={styles.publicKey}>{truncatePublicKey(wallet.publicKey)}</Text>
                <TouchableOpacity
                  style={styles.disconnectButton}
                  onPress={onDisconnect}
                  activeOpacity={0.7}
                  testID="btn-disconnect-wallet"
                  accessibilityRole="button"
                  accessibilityLabel="Disconnect Phantom wallet"
                >
                  <Text style={styles.disconnectButtonText}>DISCONNECT PHANTOM</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.disconnectedBox}>
                <Text style={styles.disconnectedLabel}>NOT CONNECTED</Text>
                <TouchableOpacity
                  style={styles.connectButton}
                  onPress={onConnect}
                  activeOpacity={0.7}
                  testID="btn-connect-wallet"
                  accessibilityRole="button"
                  accessibilityLabel="Connect Phantom wallet"
                  accessibilityHint="Opens Phantom app to connect your Solana wallet"
                >
                  <Text style={styles.connectButtonText}>CONNECT PHANTOM WALLET</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Balance Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BALANCE</Text>

            <View style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>SOL BALANCE</Text>
                <Text style={styles.balanceValue}>{wallet.balance.toFixed(3)} SOL</Text>
              </View>
            </View>
          </View>

          {/* DePIN Earnings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DEPIN EARNINGS</Text>

            <View style={styles.earningsCard}>
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>TOTAL EARNED</Text>
                <Text style={styles.earningsValue}>{depinEarnings.toFixed(2)}</Text>
                <Text style={styles.earningsCurrency}>$ALIBI</Text>
              </View>

              <View style={styles.earningsDetail}>
                <Text style={styles.detailText}>
                  Earn rewards by driving with navigation active
                </Text>
              </View>
            </View>
          </View>

          {/* Staking Section — COMING SOON */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>STAKING</Text>

            <View style={styles.comingSoonCard}>
              <Text style={styles.comingSoonBadge}>COMING SOON</Text>
              <Text style={styles.comingSoonTitle}>$ALIBI STAKING</Text>
              <Text style={styles.comingSoonText}>
                Stake your $ALIBI tokens to earn yield and unlock DAO voting power. Staking contracts are currently under development.
              </Text>
            </View>
          </View>

          {/* Security Info */}
          <View style={styles.securityBox}>
            <Text style={styles.securityTitle}>🔐 SECURITY</Text>
            <Text style={styles.securityText}>
              • Private keys stored in Hardware Enclave (Apple Secure Enclave / Android Keystore)
            </Text>
            <Text style={styles.securityText}>
              • Phantom wallet used for signing transactions
            </Text>
            <Text style={styles.securityText}>
              • Evidence vaulted immutably on Solana blockchain
            </Text>
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
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  connectedBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  connectedLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.success,
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  publicKey: {
    fontFamily: FONTS.family.mono,
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    marginBottom: SPACING.lg,
    letterSpacing: 0.5,
  },
  disconnectButton: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    alignItems: 'center',
  },
  disconnectButtonText: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.error,
  },
  disconnectedBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disconnectedLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.lg,
  },
  connectButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
  },
  earningsCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.md,
  },
  earningsLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginRight: SPACING.md,
  },
  earningsValue: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.success,
  },
  earningsCurrency: {
    marginLeft: SPACING.sm,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.medium,
  },
  earningsDetail: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  comingSoonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  comingSoonBadge: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.warning,
    letterSpacing: 2,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  comingSoonTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  comingSoonText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  securityBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  securityTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  securityText: {
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
});

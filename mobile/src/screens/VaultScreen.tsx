import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Share,
  Alert,
  Linking,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../constants/theme';
import { VaultIncident } from '../types';
import { getIncidents, deleteIncident, updateIncidentTxSignature } from '../services/storage';
import { getSolscanUrl, checkTransactionStatus } from '../services/solana';
import { ScreenHeader } from '../components/primitives';

const MONO = Platform.select({ ios: 'SF Mono', android: 'monospace', default: 'monospace' });

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  confirmed: { icon: 'checkmark-sharp' as const, color: COLORS.success, bg: COLORS.successMuted, border: COLORS.successBorder, label: 'CONFIRMED' },
  pending:   { icon: 'time-outline'    as const, color: COLORS.warning, bg: COLORS.warningMuted, border: COLORS.warningBorder, label: 'PENDING'   },
  failed:    { icon: 'close-sharp'     as const, color: COLORS.error,   bg: COLORS.errorMuted,   border: COLORS.errorBorder,   label: 'FAILED'    },
} as const;

export function VaultScreen() {
  const [incidents, setIncidents]   = useState<VaultIncident[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getIncidents();
      const sorted = data.sort((a, b) => b.timestamp - a.timestamp);
      setIncidents(sorted);
      pollPendingTransactions(sorted);
    } catch (error) {
      if (__DEV__) console.warn('Load incidents error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadIncidents(); }, [loadIncidents]);

  const pollPendingTransactions = async (list: VaultIncident[]) => {
    const pending = list.filter((i) => i.onChainStatus === 'pending' && i.txSignature);
    for (const incident of pending) {
      try {
        const status = await checkTransactionStatus(incident.txSignature!);
        if (status !== 'pending') {
          await updateIncidentTxSignature(incident.id, incident.txSignature!, status);
          setIncidents((prev) =>
            prev.map((i) => (i.id === incident.id ? { ...i, onChainStatus: status } : i))
          );
        }
      } catch (error) {
        if (__DEV__) console.warn(`Poll TX error for ${incident.id}:`, error);
      }
    }
  };

  const handleDelete = useCallback((incidentId: string) => {
    Alert.alert('Delete Incident', 'Are you sure? This action cannot be undone.', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteIncident(incidentId);
            setIncidents((prev) => prev.filter((i) => i.id !== incidentId));
          } catch {
            Alert.alert('Error', 'Failed to delete incident');
          }
        },
      },
    ]);
  }, []);

  const handleShare = useCallback(async (incident: VaultIncident) => {
    try {
      await Share.share({
        message: `ALIBI Vault Incident\n\nDate: ${new Date(incident.timestamp).toLocaleString()}\nHash: ${incident.hash}\nDuration: ${incident.duration}s\nLocation: ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}\nSpeed: ${incident.speed.toFixed(1)} MPH\n${incident.txSignature ? `TX: ${incident.txSignature}` : 'Not on-chain'}`,
        title: 'Alibi Incident Report',
      });
    } catch (error) {
      if (__DEV__) console.warn('Share error:', error);
    }
  }, []);

  const renderIncident = ({ item, index }: { item: VaultIncident; index: number }) => {
    const sc = STATUS_CONFIG[item.onChainStatus] ?? STATUS_CONFIG.pending;
    const date = new Date(item.timestamp);

    return (
      <View style={[styles.card, index === 0 && styles.cardFirst]}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardDate}>
              {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Ionicons name={sc.icon} size={12} color={sc.color} />
            <Text style={[styles.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        {/* Data rows */}
        <View style={styles.dataSection}>
          {[
            { label: 'HASH',     value: `${item.hash.slice(0, 20)}...` },
            { label: 'DURATION', value: `${item.duration}s`            },
            { label: 'LOCATION', value: `${item.latitude.toFixed(2)}°, ${item.longitude.toFixed(2)}°` },
            { label: 'SPEED',    value: `${item.speed.toFixed(1)} MPH` },
          ].map(({ label, value }, i, arr) => (
            <View key={label} style={[styles.dataRow, i === arr.length - 1 && !item.txSignature && styles.dataRowLast]}>
              <Text style={styles.dataLabel}>{label}</Text>
              <Text style={styles.dataValue} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
            </View>
          ))}
          {item.txSignature && (
            <View style={[styles.dataRow, styles.dataRowLast]}>
              <Text style={styles.dataLabel}>TX</Text>
              <Text style={[styles.dataValue, styles.txValue]} numberOfLines={1} ellipsizeMode="middle">
                {item.txSignature.slice(0, 16)}...
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleShare(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share incident"
          >
            <Ionicons name="share-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.actionBtnText}>SHARE</Text>
          </TouchableOpacity>

          {item.txSignature && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  const url = getSolscanUrl(item.txSignature!);
                  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
                  else Alert.alert('Error', 'Unable to open Solscan');
                } catch {
                  Alert.alert('Error', 'Failed to open Solscan');
                }
              }}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="View on Solscan"
            >
              <Ionicons name="link-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.actionBtnText}>SOLSCAN</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDelete]}
            onPress={() => handleDelete(item.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Delete incident"
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.error} />
            <Text style={[styles.actionBtnText, { color: COLORS.error }]}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="EVIDENCE VAULT"
        subtitle={`${incidents.length} incident${incidents.length !== 1 ? 's' : ''} recorded`}
      />

      {isLoading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading vault...</Text>
        </View>
      ) : incidents.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="lock-closed-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No incidents recorded</Text>
          <Text style={styles.emptySubtitle}>Activate emergency mode to begin recording evidence</Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={renderIncident}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                await loadIncidents();
                setIsRefreshing(false);
              }}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // List
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  cardFirst: {
    borderColor: COLORS.primaryBorder,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  cardHeaderLeft: { flex: 1 },
  cardDate: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.primary,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.text,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
  },

  // Data rows
  dataSection: {},
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dataRowLast: { borderBottomWidth: 0 },
  dataLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    width: 72,
  },
  dataValue: {
    flex: 1,
    fontFamily: MONO,
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    textAlign: 'right',
  },
  txValue: {
    color: COLORS.primary,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.xs,
    backgroundColor: COLORS.surfaceAlt,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnDelete: {
    borderColor: COLORS.errorBorder,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyText: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
  },
});

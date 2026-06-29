import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Share,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../constants/theme';
import { VaultIncident } from '../types';
import { getIncidents, deleteIncident, updateIncidentTxSignature } from '../services/storage';
import { getSolscanUrl, checkTransactionStatus } from '../services/solana';

export function VaultScreen() {
  const [incidents, setIncidents] = useState<VaultIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getIncidents();
      const sorted = data.sort((a, b) => b.timestamp - a.timestamp);
      setIncidents(sorted);

      // Poll on-chain status for pending incidents with TX signatures
      pollPendingTransactions(sorted);
    } catch (error) {
      if (__DEV__) console.warn('Load incidents error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const pollPendingTransactions = async (incidentList: VaultIncident[]) => {
    const pendingWithTx = incidentList.filter(
      (i) => i.onChainStatus === 'pending' && i.txSignature
    );

    for (const incident of pendingWithTx) {
      try {
        const status = await checkTransactionStatus(incident.txSignature!);
        if (status !== 'pending') {
          await updateIncidentTxSignature(
            incident.id,
            incident.txSignature!,
            status
          );
          setIncidents((prev) =>
            prev.map((i) =>
              i.id === incident.id ? { ...i, onChainStatus: status } : i
            )
          );
        }
      } catch (error) {
        if (__DEV__) console.warn(`Poll TX status error for ${incident.id}:`, error);
      }
    }
  };

  const handleDelete = useCallback((incidentId: string) => {
    Alert.alert(
      'Delete Incident',
      'Are you sure? This action cannot be undone.',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteIncident(incidentId);
              setIncidents((prev) => prev.filter((i) => i.id !== incidentId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete incident');
            }
          },
          style: 'destructive',
        },
      ]
    );
  }, []);

  const handleShare = useCallback(async (incident: VaultIncident) => {
    try {
      const shareText = `ALIBI Vault Incident\n\nDate: ${new Date(incident.timestamp).toLocaleString()}\nHash: ${incident.hash}\nDuration: ${incident.duration}s\nLocation: ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}\nSpeed: ${incident.speed.toFixed(1)} MPH\n${incident.txSignature ? `TX: ${incident.txSignature}` : 'Not on-chain'}`;

      await Share.share({
        message: shareText,
        title: 'Alibi Incident Report',
      });
    } catch (error) {
      if (__DEV__) console.warn('Share error:', error);
    }
  }, []);

  const renderIncident = ({ item }: { item: VaultIncident }) => {
    const date = new Date(item.timestamp);
    const dateString = date.toLocaleDateString();
    const timeString = date.toLocaleTimeString();

    return (
      <View style={styles.incidentCard}>
        {/* Status Header */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.incidentDate}>{dateString} {timeString}</Text>
            <Text style={styles.incidentDescription} numberOfLines={1}>
              {item.description}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.onChainStatus === 'confirmed' && styles.statusConfirmed,
              item.onChainStatus === 'pending' && styles.statusPending,
              item.onChainStatus === 'failed' && styles.statusFailed,
            ]}
          >
            <Ionicons
              name={
                item.onChainStatus === 'confirmed'
                  ? 'checkmark-sharp'
                  : item.onChainStatus === 'pending'
                  ? 'time-outline'
                  : 'close-sharp'
              }
              size={16}
              color={
                item.onChainStatus === 'confirmed'
                  ? COLORS.success
                  : item.onChainStatus === 'pending'
                  ? COLORS.warning
                  : COLORS.error
              }
            />
          </View>
        </View>

        {/* Incident Details */}
        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>HASH:</Text>
            <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
              {item.hash.slice(0, 20)}...
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>DURATION:</Text>
            <Text style={styles.detailValue}>{item.duration}s</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>LOCATION:</Text>
            <Text style={styles.detailValue}>
              {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SPEED:</Text>
            <Text style={styles.detailValue}>{item.speed.toFixed(1)} MPH</Text>
          </View>

          {item.txSignature && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>TX:</Text>
              <Text style={styles.txLink} numberOfLines={1} ellipsizeMode="middle">
                {item.txSignature.slice(0, 12)}...
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShare(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share incident report"
          >
            <Ionicons name="share-outline" size={15} color={COLORS.text} style={styles.actionIcon} />
            <Text style={styles.actionButtonText}>SHARE</Text>
          </TouchableOpacity>

          {item.txSignature && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={async () => {
                try {
                  const url = getSolscanUrl(item.txSignature!);
                  const canOpen = await Linking.canOpenURL(url);
                  if (canOpen) {
                    await Linking.openURL(url);
                  } else {
                    Alert.alert('Error', 'Unable to open Solscan link');
                  }
                } catch (err) {
                  Alert.alert('Error', 'Failed to open Solscan');
                }
              }}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="View transaction on Solscan"
            >
              <Ionicons name="link-outline" size={15} color={COLORS.text} style={styles.actionIcon} />
              <Text style={styles.actionButtonText}>SOLSCAN</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Delete incident"
            accessibilityHint="Permanently delete this incident from the vault"
          >
            <Ionicons name="trash-outline" size={15} color={COLORS.error} style={styles.actionIcon} />
            <Text style={styles.deleteButtonText}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EVIDENCE VAULT</Text>
        <Text style={styles.headerSubtitle}>
          {incidents.length} incident{incidents.length !== 1 ? 's' : ''} recorded
        </Text>
      </View>

      {/* Vault List */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading vault...</Text>
        </View>
      ) : incidents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="lock-closed-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyText}>No incidents recorded yet</Text>
          <Text style={styles.emptySubtext}>
            Activate emergency mode to record evidence
          </Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={renderIncident}
          keyExtractor={(item) => item.id}
          scrollEnabled={true}
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
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.wider,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SPACING.lg,
  },
  incidentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOW.sm,
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
  },
  incidentDate: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  incidentDescription: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    fontWeight: FONTS.weight.medium,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
    borderColor: COLORS.success,
  },
  statusPending: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderColor: COLORS.warning,
  },
  statusFailed: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderColor: COLORS.error,
  },
  statusText: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
  },
  cardDetails: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    flex: 1,
    marginLeft: SPACING.md,
    textAlign: 'right',
  },
  txLink: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    flex: 1,
    marginLeft: SPACING.md,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIcon: {
    marginRight: SPACING.xs,
  },
  actionButtonText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.wide,
  },
  deleteButton: {
    borderColor: 'rgba(255,59,71,0.4)',
  },
  deleteButtonText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyText: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

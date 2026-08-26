import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { ScreenHeader } from '../components/primitives';

interface Proposal {
  id: string;
  title: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  status: 'active' | 'passed' | 'rejected';
}

const STATUS_CONFIG = {
  active:   { label: 'ACTIVE',   color: COLORS.success, border: COLORS.successBorder, bg: COLORS.successMuted },
  passed:   { label: 'PASSED',   color: COLORS.primary, border: COLORS.primaryBorder, bg: COLORS.primaryMuted },
  rejected: { label: 'REJECTED', color: COLORS.error,   border: COLORS.errorBorder,   bg: COLORS.errorMuted   },
} as const;

export function DAOScreen() {
  const [proposals, setProposals] = useState<Proposal[]>([
    {
      id: '1',
      title: 'Increase LegalGPT context window',
      description: 'Expand Claude integration to support 150K token context',
      votesFor: 12450,
      votesAgainst: 2310,
      status: 'active',
    },
    {
      id: '2',
      title: 'Launch mobile app v2.0',
      description: 'Deploy enhanced emergency mode with video evidence',
      votesFor: 18900,
      votesAgainst: 890,
      status: 'passed',
    },
    {
      id: '3',
      title: 'Add facial recognition safety',
      description: 'Implement AI-powered officer identification system',
      votesFor: 3200,
      votesAgainst: 14500,
      status: 'rejected',
    },
  ]);

  const handleVote = useCallback((proposalId: string, voteType: 'for' | 'against') => {
    Alert.alert(
      'Governance Coming Soon',
      `On-chain voting will go live with mainnet $ALIBI staking.\n\nYour vote: ${voteType.toUpperCase()} on proposal #${proposalId}\n\nThis vote has been recorded locally.`,
      [{ text: 'OK' }]
    );
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId && p.status === 'active') {
          return {
            ...p,
            votesFor:     voteType === 'for'     ? p.votesFor + 1     : p.votesFor,
            votesAgainst: voteType === 'against' ? p.votesAgainst + 1 : p.votesAgainst,
          };
        }
        return p;
      })
    );
  }, []);

  const renderProposal = (proposal: Proposal) => {
    const total   = proposal.votesFor + proposal.votesAgainst;
    const forPct  = total === 0 ? 0 : (proposal.votesFor / total) * 100;
    const sc      = STATUS_CONFIG[proposal.status];

    return (
      <View key={proposal.id} style={styles.proposalCard}>
        {/* Header */}
        <View style={styles.proposalHeader}>
          <View style={styles.proposalHeaderLeft}>
            <Text style={styles.proposalTitle}>{proposal.title}</Text>
            <Text style={styles.proposalDesc} numberOfLines={2}>{proposal.description}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        {/* Vote bar */}
        <View style={styles.voteSection}>
          <View style={styles.voteTrack}>
            <View style={[styles.voteFill, { width: `${forPct}%` as `${number}%` }]} />
          </View>
          <View style={styles.voteStats}>
            {[
              { label: 'FOR',     value: proposal.votesFor,     color: COLORS.success },
              { label: 'AGAINST', value: proposal.votesAgainst, color: COLORS.error   },
              { label: 'TOTAL',   value: total,                 color: COLORS.text     },
            ].map(({ label, value, color }) => (
              <View key={label} style={styles.voteStat}>
                <Text style={styles.voteStatLabel}>{label}</Text>
                <Text style={[styles.voteStatValue, { color }]}>{value.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions */}
        {proposal.status === 'active' && (
          <View style={styles.voteActions}>
            <TouchableOpacity
              style={[styles.voteBtn, styles.voteBtnFor]}
              onPress={() => handleVote(proposal.id, 'for')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Vote for: ${proposal.title}`}
            >
              <Ionicons name="thumbs-up-outline" size={14} color={COLORS.success} />
              <Text style={[styles.voteBtnText, { color: COLORS.success }]}>VOTE FOR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteBtn, styles.voteBtnAgainst]}
              onPress={() => handleVote(proposal.id, 'against')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Vote against: ${proposal.title}`}
            >
              <Ionicons name="thumbs-down-outline" size={14} color={COLORS.error} />
              <Text style={[styles.voteBtnText, { color: COLORS.error }]}>VOTE AGAINST</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="DAO GOVERNANCE"
        subtitle="Community governance for the Alibi network"
      />

      {/* Dev banner */}
      <View style={styles.devBanner}>
        <Ionicons name="construct-outline" size={14} color={COLORS.warning} style={{ marginRight: SPACING.sm }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.devBannerTitle}>GOVERNANCE MODULE IN DEVELOPMENT</Text>
          <Text style={styles.devBannerBody}>Preview of upcoming on-chain governance. Voting will go live with mainnet staking.</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {proposals.map(renderProposal)}

        {/* Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoTitle}>HOW DAO VOTING WORKS</Text>
          </View>
          {[
            'Token holders vote on network upgrades and parameter changes',
            '1 $ALIBI = 1 vote (must be staked for voting rights)',
            'Voting period: 7 days per proposal',
            'Quorum required: 40% of total staked tokens',
            'Passed if: More FOR votes than AGAINST votes',
          ].map((item) => (
            <View key={item} style={styles.infoRow}>
              <View style={styles.infoRowDot} />
              <Text style={styles.infoText}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  devBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.warningMuted,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  devBannerTitle: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.warning,
    letterSpacing: FONTS.tracking.label,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  devBannerBody: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  proposalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  proposalHeaderLeft: { flex: 1 },
  proposalTitle: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  proposalDesc: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  statusBadge: {
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

  voteSection: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  voteTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  voteFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.full,
  },
  voteStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voteStat: { alignItems: 'center', flex: 1 },
  voteStatLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  voteStatValue: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.heavy,
  },

  voteActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderWidth: 0,
  },
  voteBtnFor: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  voteBtnAgainst: {},
  voteBtnText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.wide,
  },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  infoTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: FONTS.tracking.wide,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  infoRowDot: {
    width: 4,
    height: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    marginTop: 7,
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    lineHeight: 18,
  },
});

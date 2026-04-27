import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface Proposal {
  id: string;
  title: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  status: 'active' | 'passed' | 'rejected';
}

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
      `On-chain voting will go live with mainnet $ALIBI staking.\n\nYour vote: ${voteType.toUpperCase()} on proposal #${proposalId}\n\nThis vote has been recorded locally and will be submitted when governance contracts are deployed.`,
      [{ text: 'OK' }]
    );

    // Optimistic UI update to show user interaction
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId && p.status === 'active') {
          return {
            ...p,
            votesFor: voteType === 'for' ? p.votesFor + 1 : p.votesFor,
            votesAgainst: voteType === 'against' ? p.votesAgainst + 1 : p.votesAgainst,
          };
        }
        return p;
      })
    );
  }, []);

  const getTotalVotes = (proposal: Proposal) => proposal.votesFor + proposal.votesAgainst;

  const getVotingPercentage = (votesFor: number, total: number) => {
    return total === 0 ? 0 : (votesFor / total) * 100;
  };

  const renderProposal = (proposal: Proposal) => {
    const totalVotes = getTotalVotes(proposal);
    const forPercentage = getVotingPercentage(proposal.votesFor, totalVotes);

    return (
      <View key={proposal.id} style={styles.proposalCard}>
        {/* Header */}
        <View style={styles.proposalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.proposalTitle}>{proposal.title}</Text>
            <Text style={styles.proposalDescription} numberOfLines={2}>
              {proposal.description}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              proposal.status === 'active' && styles.statusActive,
              proposal.status === 'passed' && styles.statusPassed,
              proposal.status === 'rejected' && styles.statusRejected,
            ]}
          >
            <Text style={styles.statusText}>{proposal.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Voting Bar */}
        <View style={styles.votingSection}>
          <View style={styles.votingBar}>
            <View
              style={[
                styles.votingBarFill,
                {
                  width: `${forPercentage}%`,
                  backgroundColor: COLORS.success,
                },
              ]}
            />
          </View>

          <View style={styles.votingStats}>
            <View style={styles.votingStatItem}>
              <Text style={styles.votingLabel}>FOR</Text>
              <Text style={[styles.votingValue, { color: COLORS.success }]}>
                {proposal.votesFor.toLocaleString()}
              </Text>
              <Text style={styles.votingPercent}>{forPercentage.toFixed(1)}%</Text>
            </View>

            <View style={styles.votingStatItem}>
              <Text style={styles.votingLabel}>AGAINST</Text>
              <Text style={[styles.votingValue, { color: COLORS.error }]}>
                {proposal.votesAgainst.toLocaleString()}
              </Text>
              <Text style={styles.votingPercent}>{(100 - forPercentage).toFixed(1)}%</Text>
            </View>

            <View style={styles.votingStatItem}>
              <Text style={styles.votingLabel}>TOTAL</Text>
              <Text style={styles.votingValue}>{totalVotes.toLocaleString()}</Text>
              <Text style={styles.votingPercent}>100%</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {proposal.status === 'active' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.voteButton, styles.forButton]}
              activeOpacity={0.7}
              onPress={() => handleVote(proposal.id, 'for')}
              accessibilityRole="button"
              accessibilityLabel={`Vote for: ${proposal.title}`}
            >
              <Text style={styles.voteButtonText}>👍 VOTE FOR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteButton, styles.againstButton]}
              activeOpacity={0.7}
              onPress={() => handleVote(proposal.id, 'against')}
              accessibilityRole="button"
              accessibilityLabel={`Vote against: ${proposal.title}`}
            >
              <Text style={styles.voteButtonText}>👎 VOTE AGAINST</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DAO GOVERNANCE</Text>
        <Text style={styles.headerSubtitle}>
          Community governance for the Alibi network
        </Text>
      </View>

      {/* DAO Status Banner */}
      <View style={styles.demoBanner}>
        <Text style={styles.demoBannerText}>GOVERNANCE MODULE IN DEVELOPMENT</Text>
        <Text style={styles.demoBannerSubtext}>
          Preview of upcoming on-chain governance. Voting will go live with mainnet staking.
        </Text>
      </View>

      {/* Proposals List */}
      <ScrollView
        style={styles.proposalsContainer}
        contentContainerStyle={styles.proposalsContent}
        scrollEnabled={true}
      >
        {proposals.map(renderProposal)}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>HOW DAO VOTING WORKS</Text>
          <Text style={styles.infoText}>
            • Token holders vote on network upgrades and parameter changes
          </Text>
          <Text style={styles.infoText}>
            • 1 $ALIBI = 1 vote (must be staked for voting rights)
          </Text>
          <Text style={styles.infoText}>
            • Voting period: 7 days per proposal
          </Text>
          <Text style={styles.infoText}>
            • Quorum required: 40% of total staked tokens
          </Text>
          <Text style={styles.infoText}>
            • Passed if: More FOR votes than AGAINST votes
          </Text>
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
  demoBanner: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  demoBannerText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.warning,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  demoBannerSubtext: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  proposalsContainer: {
    flex: 1,
  },
  proposalsContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  proposalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  proposalTitle: {
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  proposalDescription: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusActive: {
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
    borderColor: COLORS.success,
  },
  statusPassed: {
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
    borderColor: COLORS.success,
  },
  statusRejected: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderColor: COLORS.error,
  },
  statusText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
  },
  votingSection: {
    marginBottom: SPACING.md,
  },
  votingBar: {
    height: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  votingBarFill: {
    height: '100%',
  },
  votingStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  votingStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  votingLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  votingValue: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  votingPercent: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  voteButton: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
  },
  forButton: {
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
    borderColor: COLORS.success,
  },
  againstButton: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderColor: COLORS.error,
  },
  voteButtonText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
  },
  infoBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  infoTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    lineHeight: 16,
  },
});

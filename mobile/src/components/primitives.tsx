/**
 * Shared UI primitives — ScreenHeader, SectionLabel, DataRow, DataCard, StatusBadge.
 * Import from here instead of duplicating styles across screens.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

// ─── ScreenHeader ──────────────────────────────────────────────────────────
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional right-side element (e.g. a badge or icon). */
  right?: React.ReactNode;
  noBorder?: boolean;
}

export const ScreenHeader = React.memo(function ScreenHeader({
  title,
  subtitle,
  right,
  noBorder = false,
}: ScreenHeaderProps) {
  return (
    <View style={[headerStyles.container, noBorder && headerStyles.noBorder]}>
      <View style={headerStyles.left}>
        <Text style={headerStyles.title}>{title}</Text>
        {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={headerStyles.right}>{right}</View> : null}
    </View>
  );
});

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  left: { flex: 1 },
  right: { marginLeft: SPACING.md },
  title: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: FONTS.tracking.wider,
  },
  subtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    letterSpacing: 0,
  },
});

// ─── SectionLabel ──────────────────────────────────────────────────────────
interface SectionLabelProps {
  children: string;
  style?: object;
}

export const SectionLabel = React.memo(function SectionLabel({ children, style }: SectionLabelProps) {
  return <Text style={[sectionLabelStyles.text, style]}>{children}</Text>;
});

const sectionLabelStyles = StyleSheet.create({
  text: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
});

// ─── DataCard ──────────────────────────────────────────────────────────────
interface DataCardProps {
  children: React.ReactNode;
  /** Override border color. */
  accentColor?: string;
  style?: object;
}

export const DataCard = React.memo(function DataCard({ children, accentColor, style }: DataCardProps) {
  return (
    <View
      style={[
        dataCardStyles.card,
        accentColor ? { borderColor: accentColor } : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
});

const dataCardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
});

// ─── DataRow ───────────────────────────────────────────────────────────────
interface DataRowProps {
  label: string;
  value: string;
  valueColor?: string;
  noBorder?: boolean;
}

export const DataRow = React.memo(function DataRow({ label, value, valueColor, noBorder }: DataRowProps) {
  return (
    <View style={[dataRowStyles.row, noBorder && dataRowStyles.noBorder]}>
      <Text style={dataRowStyles.label}>{label}</Text>
      <Text style={[dataRowStyles.value, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
});

const dataRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  noBorder: { borderBottomWidth: 0 },
  label: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    color: COLORS.text,
    flex: 1,
    marginLeft: SPACING.md,
    textAlign: 'right',
  },
});

// ─── StatusBadge ───────────────────────────────────────────────────────────
type StatusVariant = 'confirmed' | 'pending' | 'failed' | 'active' | 'passed' | 'coming-soon';

const STATUS_COLORS: Record<StatusVariant, { bg: string; border: string; text: string }> = {
  confirmed:   { bg: COLORS.successMuted,  border: COLORS.successBorder, text: COLORS.success },
  active:      { bg: COLORS.successMuted,  border: COLORS.successBorder, text: COLORS.success },
  passed:      { bg: COLORS.successMuted,  border: COLORS.successBorder, text: COLORS.success },
  pending:     { bg: COLORS.warningMuted,  border: COLORS.warningBorder, text: COLORS.warning },
  failed:      { bg: COLORS.errorMuted,    border: COLORS.errorBorder,   text: COLORS.error   },
  'coming-soon': { bg: 'rgba(255,255,255,0.04)', border: COLORS.border, text: COLORS.textSecondary },
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
}

export const StatusBadge = React.memo(function StatusBadge({ variant, label }: StatusBadgeProps) {
  const c = STATUS_COLORS[variant] ?? STATUS_COLORS['coming-soon'];
  const displayLabel = label ?? variant.toUpperCase();
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>{displayLabel}</Text>
    </View>
  );
});

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
  },
  text: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
  },
});

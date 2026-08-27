import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
  UIManager,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { LocationCoords } from '../types';
import { getStateFromCoordinates } from '../services/location';
import { ScreenHeader } from '../components/primitives';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Recording Laws ─────────────────────────────────────────────────────────
interface StateLaw {
  consent: 'one' | 'two';
  statute: string;
  summary: string;
}

const RECORDING_LAWS: Record<string, StateLaw> = {
  AL: { consent: 'one', statute: 'Ala. Code § 13A-11-30',            summary: 'One-party consent. You can record your own conversations.' },
  AK: { consent: 'one', statute: 'Alaska Stat. § 42.20.300',         summary: 'One-party consent state.' },
  AZ: { consent: 'one', statute: 'Ariz. Rev. Stat. § 13-3005',       summary: 'One-party consent state.' },
  AR: { consent: 'one', statute: 'Ark. Code Ann. § 5-60-120',        summary: 'One-party consent state.' },
  CA: { consent: 'two', statute: 'Cal. Penal Code § 632',            summary: 'All-party consent required for private conversations. Recording police in public is legal and protected.' },
  CO: { consent: 'one', statute: 'Colo. Rev. Stat. § 18-9-303',     summary: 'One-party consent state.' },
  CT: { consent: 'two', statute: 'Conn. Gen. Stat. § 52-570d',      summary: 'All-party consent required for private conversations.' },
  DE: { consent: 'two', statute: 'Del. Code Ann. tit. 11, § 1335',  summary: 'All-party consent required.' },
  FL: { consent: 'two', statute: 'Fla. Stat. § 934.03',             summary: 'All-party consent required. Felony to violate. Recording police in public is still protected.' },
  GA: { consent: 'one', statute: 'Ga. Code Ann. § 16-11-62',        summary: 'One-party consent state.' },
  HI: { consent: 'one', statute: 'Haw. Rev. Stat. § 803-42',        summary: 'One-party consent state.' },
  ID: { consent: 'one', statute: 'Idaho Code § 18-6702',            summary: 'One-party consent state.' },
  IL: { consent: 'two', statute: '720 Ill. Comp. Stat. 5/14-2',    summary: 'All-party consent required for private conversations.' },
  IN: { consent: 'one', statute: 'Ind. Code § 35-33.5-1-5',        summary: 'One-party consent state.' },
  IA: { consent: 'one', statute: 'Iowa Code § 808B.2',              summary: 'One-party consent state.' },
  KS: { consent: 'one', statute: 'Kan. Stat. Ann. § 21-6101',      summary: 'One-party consent state.' },
  KY: { consent: 'one', statute: 'Ky. Rev. Stat. Ann. § 526.010',  summary: 'One-party consent state.' },
  LA: { consent: 'one', statute: 'La. Rev. Stat. Ann. § 15:1303',  summary: 'One-party consent state.' },
  ME: { consent: 'one', statute: 'Me. Rev. Stat. tit. 15, § 709',  summary: 'One-party consent state.' },
  MD: { consent: 'two', statute: 'Md. Code Ann., Cts. § 10-402',   summary: 'All-party consent required.' },
  MA: { consent: 'two', statute: 'Mass. Gen. Laws ch. 272, § 99',  summary: 'All-party consent required. Felony to violate.' },
  MI: { consent: 'two', statute: 'Mich. Comp. Laws § 750.539c',    summary: 'All-party consent required.' },
  MN: { consent: 'one', statute: 'Minn. Stat. § 626A.02',          summary: 'One-party consent state.' },
  MS: { consent: 'one', statute: 'Miss. Code Ann. § 41-29-531',    summary: 'One-party consent state.' },
  MO: { consent: 'one', statute: 'Mo. Rev. Stat. § 542.402',       summary: 'One-party consent state.' },
  MT: { consent: 'two', statute: 'Mont. Code Ann. § 45-8-213',     summary: 'All-party consent required.' },
  NE: { consent: 'one', statute: 'Neb. Rev. Stat. § 86-290',       summary: 'One-party consent state.' },
  NV: { consent: 'two', statute: 'Nev. Rev. Stat. § 200.620',      summary: 'All-party consent required.' },
  NH: { consent: 'two', statute: 'N.H. Rev. Stat. Ann. § 570-A:2',summary: 'All-party consent required.' },
  NJ: { consent: 'one', statute: 'N.J. Stat. Ann. § 2A:156A-3',   summary: 'One-party consent state.' },
  NM: { consent: 'one', statute: 'N.M. Stat. Ann. § 30-12-1',     summary: 'One-party consent state.' },
  NY: { consent: 'one', statute: 'N.Y. Penal Law § 250.00',        summary: 'One-party consent state.' },
  NC: { consent: 'one', statute: 'N.C. Gen. Stat. § 15A-287',      summary: 'One-party consent state.' },
  ND: { consent: 'one', statute: 'N.D. Cent. Code § 12.1-15-02',   summary: 'One-party consent state.' },
  OH: { consent: 'one', statute: 'Ohio Rev. Code Ann. § 2933.52',  summary: 'One-party consent state.' },
  OK: { consent: 'one', statute: 'Okla. Stat. tit. 13, § 176.4',  summary: 'One-party consent state.' },
  OR: { consent: 'two', statute: 'Or. Rev. Stat. § 165.540',       summary: 'All-party consent required.' },
  PA: { consent: 'two', statute: '18 Pa. Cons. Stat. § 5704',      summary: 'All-party consent required. Strictly enforced.' },
  RI: { consent: 'one', statute: 'R.I. Gen. Laws § 11-35-21',      summary: 'One-party consent state.' },
  SC: { consent: 'one', statute: 'S.C. Code Ann. § 17-30-30',      summary: 'One-party consent state.' },
  SD: { consent: 'one', statute: 'S.D. Codified Laws § 23A-35A-20',summary: 'One-party consent state.' },
  TN: { consent: 'one', statute: 'Tenn. Code Ann. § 39-13-601',    summary: 'One-party consent state.' },
  TX: { consent: 'one', statute: 'Tex. Penal Code Ann. § 16.02',   summary: 'One-party consent state.' },
  UT: { consent: 'one', statute: 'Utah Code Ann. § 77-23a-4',      summary: 'One-party consent state.' },
  VT: { consent: 'one', statute: 'Vt. Stat. Ann. tit. 13, § 4601',summary: 'One-party consent state.' },
  VA: { consent: 'one', statute: 'Va. Code Ann. § 19.2-62',        summary: 'One-party consent state.' },
  WA: { consent: 'two', statute: 'Wash. Rev. Code § 9.73.030',     summary: 'All-party consent required.' },
  WV: { consent: 'one', statute: 'W. Va. Code § 62-1D-3',          summary: 'One-party consent state.' },
  WI: { consent: 'one', statute: 'Wis. Stat. § 968.31',            summary: 'One-party consent state.' },
  WY: { consent: 'one', statute: 'Wyo. Stat. Ann. § 7-3-702',      summary: 'One-party consent state.' },
  DC: { consent: 'one', statute: 'D.C. Code § 23-542',             summary: 'One-party consent.' },
};

// ─── Rights Scripts ──────────────────────────────────────────────────────────
interface RightsScript {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  prompt: string;
  script: string;
  note: string;
  cases: string[];
}

const RIGHTS_SCRIPTS: RightsScript[] = [
  {
    id: 'detained',
    icon: 'help-circle-outline',
    label: 'Am I Being Detained?',
    prompt: 'SAY CALMLY AND CLEARLY:',
    script: '"Officer, am I being detained, or am I free to go?"',
    note: 'If detained: "I am invoking my right to remain silent. I do not consent to any searches."\n\nIf free to go: leave calmly and immediately. Do not run.',
    cases: ['Terry v. Ohio (1968)', 'Florida v. Bostick (1991)'],
  },
  {
    id: 'search',
    icon: 'search-outline',
    label: 'Search Refusal',
    prompt: 'IF ASKED TO SEARCH:',
    script: '"I do not consent to any searches of my person, vehicle, or belongings."',
    note: 'Repeat this if asked again. A warrant is required without consent. Refusing consent cannot legally be used as grounds for arrest.',
    cases: ['4th Amendment', 'Schneckloth v. Bustamonte (1973)', 'Rodriguez v. US (2015)'],
  },
  {
    id: 'stop',
    icon: 'hand-left-outline',
    label: 'Traffic Stop',
    prompt: 'WHEN PULLED OVER:',
    script: '"Here is my license and registration. I am exercising my right to remain silent beyond identification. I do not consent to any searches."',
    note: 'Provide your license, registration, and proof of insurance when asked. You are not required to answer questions about where you came from or where you are going.',
    cases: ['Pennsylvania v. Mimms (1977)', 'Rodriguez v. US (2015)'],
  },
  {
    id: 'recording',
    icon: 'videocam-outline',
    label: 'Recording Rights',
    prompt: 'IF OFFICER OBJECTS:',
    script: '"I have the constitutional right to record police officers performing their duties in a public space. I am not interfering."',
    note: 'Recording police in public is protected by the First Amendment. Do not physically resist — assert your right verbally.',
    cases: ['1st Amendment', 'Glik v. Cunniffe (1st Cir. 2011)', 'ACLU v. Alvarez (7th Cir. 2012)'],
  },
  {
    id: 'silence',
    icon: 'mic-off-outline',
    label: 'Invoke Silence',
    prompt: 'TO INVOKE YOUR 5th AMENDMENT RIGHT:',
    script: '"I am invoking my Fifth Amendment right to remain silent. I will not answer questions without my attorney present."',
    note: 'You must explicitly state you are invoking your right — simply staying quiet is not enough after Berghuis v. Thompkins (2010). Once invoked, questioning must stop.',
    cases: ['5th Amendment', 'Miranda v. Arizona (1966)', 'Berghuis v. Thompkins (2010)'],
  },
];

const LEGAL_RESOURCES = [
  { name: 'ACLU Know Your Rights',                desc: 'Free legal guides by state',        url: 'https://www.aclu.org/know-your-rights' },
  { name: 'National Police Accountability Project', desc: 'Civil rights attorney referrals', url: 'https://www.napapoliceaccountability.org' },
  { name: 'NAACP Legal Defense Fund',             desc: 'Civil rights legal assistance',     url: 'https://www.naacpldf.org' },
];

// ─── Component ──────────────────────────────────────────────────────────────
interface AfterScreenProps {
  location: LocationCoords | null;
}

export function AfterScreen({ location }: AfterScreenProps) {
  const [detectedState, setDetectedState] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);

  useEffect(() => {
    if (location && !detectedState) {
      getStateFromCoordinates(location.latitude, location.longitude)
        .then(setDetectedState)
        .catch(() => {});
    }
  }, [location, detectedState]);

  const toggleScript = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedScript((prev) => (prev === id ? null : id));
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try { await Share.share({ message: text }); } catch {}
  }, []);

  const openURL = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch {}
  }, []);

  const stateLaw = detectedState ? RECORDING_LAWS[detectedState] : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="AFTER THE STOP"
        subtitle="Evidence · Rights · Resources"
        noBorder
      />

      {/* State Recording Law */}
      <View style={[styles.card, styles.cardCyan]}>
        <Text style={styles.sectionLabel}>YOUR STATE — RECORDING LAW</Text>
        {stateLaw ? (
          <>
            <View style={styles.stateRow}>
              <Text style={styles.stateAbbr}>{detectedState}</Text>
              <View style={[
                styles.consentBadge,
                { backgroundColor: stateLaw.consent === 'two' ? COLORS.warningMuted : COLORS.successMuted,
                  borderColor: stateLaw.consent === 'two' ? COLORS.warningBorder : COLORS.successBorder },
              ]}>
                <Ionicons
                  name={stateLaw.consent === 'two' ? 'warning-outline' : 'checkmark-circle-outline'}
                  size={12}
                  color={stateLaw.consent === 'two' ? COLORS.warning : COLORS.success}
                />
                <Text style={[
                  styles.consentText,
                  { color: stateLaw.consent === 'two' ? COLORS.warning : COLORS.success },
                ]}>
                  {stateLaw.consent === 'two' ? 'TWO-PARTY CONSENT' : 'ONE-PARTY CONSENT'}
                </Text>
              </View>
            </View>
            <Text style={styles.lawSummary}>{stateLaw.summary}</Text>
            <Text style={styles.lawStatute}>{stateLaw.statute}</Text>
            {stateLaw.consent === 'two' && (
              <View style={styles.warningBox}>
                <Ionicons name="information-circle-outline" size={14} color={COLORS.warning} style={{ marginRight: 6 }} />
                <Text style={styles.warningText}>
                  Even in two-party consent states, recording police in public is protected by the First Amendment.
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.stateEmpty}>
            {location
              ? 'Detecting your state...'
              : 'Enable location access to see your recording law.'}
          </Text>
        )}
      </View>

      {/* Rights Scripts */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>KNOW YOUR RIGHTS — REFERENCE SCRIPTS</Text>
        {RIGHTS_SCRIPTS.map((script) => (
          <View key={script.id} style={styles.scriptRow}>
            <TouchableOpacity
              style={styles.scriptHeader}
              onPress={() => toggleScript(script.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={script.label}
            >
              <View style={styles.scriptHeaderLeft}>
                <View style={styles.scriptIconWrap}>
                  <Ionicons name={script.icon} size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.scriptTitle}>{script.label}</Text>
              </View>
              <Ionicons
                name={expandedScript === script.id ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>

            {expandedScript === script.id && (
              <View style={styles.scriptDetail}>
                <View style={styles.scriptBox}>
                  <Text style={styles.scriptPrompt}>{script.prompt}</Text>
                  <Text style={styles.scriptText}>{script.script}</Text>
                </View>
                <Text style={styles.scriptNote}>{script.note}</Text>
                <View style={styles.casesRow}>
                  {script.cases.map((c) => (
                    <View key={c} style={styles.caseTag}>
                      <Text style={styles.caseTagText}>{c}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(script.script)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.copyBtnText}>SHARE SCRIPT</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.scriptDivider} />
          </View>
        ))}
      </View>

      {/* Evidence Packaging */}
      <View style={[styles.card, styles.cardCyanBorder]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="archive-outline" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Evidence Packaging</Text>
          <View style={[styles.badge, { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primaryBorder }]}>
            <Text style={[styles.badgeText, { color: COLORS.primary }]}>READY</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          Download a complete evidence package from any vault entry — SHA-256 hash, GPS coordinates, timestamp, detention duration, and applicable case law. Ready to send to counsel.
        </Text>
        <Text style={[styles.cardBody, { color: COLORS.textSecondary, marginTop: SPACING.sm }]}>
          Go to <Text style={{ color: COLORS.text, fontWeight: '700' }}>Vault</Text>
          {' '} then tap <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Package</Text> on any incident.
        </Text>
      </View>

      {/* Legal Resources */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="call-outline" size={16} color={COLORS.success} />
          </View>
          <Text style={styles.cardTitle}>Legal Resources</Text>
          <View style={[styles.badge, { backgroundColor: COLORS.successMuted, borderColor: COLORS.successBorder }]}>
            <Text style={[styles.badgeText, { color: COLORS.success }]}>FREE</Text>
          </View>
        </View>
        {LEGAL_RESOURCES.map((resource) => (
          <TouchableOpacity
            key={resource.name}
            style={styles.resourceRow}
            onPress={() => openURL(resource.url)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={resource.name}
          >
            <View style={styles.resourceInfo}>
              <Text style={styles.resourceName}>{resource.name}</Text>
              <Text style={styles.resourceDesc}>{resource.desc}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        Recording laws vary by state. This app provides general information, not legal advice. In two-party consent states, obtain all-party consent before recording private conversations. Recording police in public is generally protected by the First Amendment. Consult an attorney for your specific situation.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING['2xl'],
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCyan: {
    backgroundColor: COLORS.primarySubtle,
    borderColor: COLORS.primaryBorder,
  },
  cardCyanBorder: {
    borderColor: COLORS.primaryBorder,
  },
  cardComingSoon: {
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },

  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },

  // State
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  stateAbbr: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.heavy,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  consentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  consentText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.wide,
  },
  lawSummary: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  lawStatute: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    fontFamily: undefined,
    letterSpacing: 0.3,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warningMuted,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  warningText: {
    flex: 1,
    color: COLORS.warning,
    fontSize: FONTS.size.xs,
    lineHeight: 17,
  },
  stateEmpty: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontStyle: 'italic',
  },

  // Scripts
  scriptRow: {
    marginBottom: 2,
  },
  scriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  scriptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  scriptIconWrap: {
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scriptTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
  },
  scriptDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  scriptDetail: {
    paddingBottom: SPACING.md,
  },
  scriptBox: {
    backgroundColor: COLORS.primarySubtle,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  scriptPrompt: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  scriptText: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    lineHeight: 26,
  },
  scriptNote: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  casesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  caseTag: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  caseTagText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    letterSpacing: 0.3,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignSelf: 'flex-start',
  },
  copyBtnText: {
    color: COLORS.primary,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.wide,
  },

  // Card header row (for info/resource cards)
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.label,
    textTransform: 'uppercase',
  },
  cardBody: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  comingSoonBody: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },

  // Resources
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  resourceInfo: { flex: 1 },
  resourceName: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
  },
  resourceDesc: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },

  disclaimer: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
});

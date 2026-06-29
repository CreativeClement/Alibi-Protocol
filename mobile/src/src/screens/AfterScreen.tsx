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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────
// 50-STATE RECORDING LAW KNOWLEDGE BASE
// ─────────────────────────────────────────────
interface StateLaw {
  consent: 'one' | 'two';
  statute: string;
  summary: string;
}

const RECORDING_LAWS: Record<string, StateLaw> = {
  AL: { consent: 'one', statute: 'Ala. Code § 13A-11-30', summary: 'One-party consent. You can record your own conversations.' },
  AK: { consent: 'one', statute: 'Alaska Stat. § 42.20.300', summary: 'One-party consent state.' },
  AZ: { consent: 'one', statute: 'Ariz. Rev. Stat. § 13-3005', summary: 'One-party consent state.' },
  AR: { consent: 'one', statute: 'Ark. Code Ann. § 5-60-120', summary: 'One-party consent state.' },
  CA: { consent: 'two', statute: 'Cal. Penal Code § 632', summary: 'All-party consent required for private conversations. Recording police in public is legal and protected.' },
  CO: { consent: 'one', statute: 'Colo. Rev. Stat. § 18-9-303', summary: 'One-party consent state.' },
  CT: { consent: 'two', statute: 'Conn. Gen. Stat. § 52-570d', summary: 'All-party consent required for private conversations.' },
  DE: { consent: 'two', statute: 'Del. Code Ann. tit. 11, § 1335', summary: 'All-party consent required.' },
  FL: { consent: 'two', statute: 'Fla. Stat. § 934.03', summary: 'All-party consent required. Felony to violate. Recording police in public is still protected.' },
  GA: { consent: 'one', statute: 'Ga. Code Ann. § 16-11-62', summary: 'One-party consent state.' },
  HI: { consent: 'one', statute: 'Haw. Rev. Stat. § 803-42', summary: 'One-party consent state.' },
  ID: { consent: 'one', statute: 'Idaho Code § 18-6702', summary: 'One-party consent state.' },
  IL: { consent: 'two', statute: '720 Ill. Comp. Stat. 5/14-2', summary: 'All-party consent required for private conversations.' },
  IN: { consent: 'one', statute: 'Ind. Code § 35-33.5-1-5', summary: 'One-party consent state.' },
  IA: { consent: 'one', statute: 'Iowa Code § 808B.2', summary: 'One-party consent state.' },
  KS: { consent: 'one', statute: 'Kan. Stat. Ann. § 21-6101', summary: 'One-party consent state.' },
  KY: { consent: 'one', statute: 'Ky. Rev. Stat. Ann. § 526.010', summary: 'One-party consent state.' },
  LA: { consent: 'one', statute: 'La. Rev. Stat. Ann. § 15:1303', summary: 'One-party consent state.' },
  ME: { consent: 'one', statute: 'Me. Rev. Stat. tit. 15, § 709', summary: 'One-party consent state.' },
  MD: { consent: 'two', statute: 'Md. Code Ann., Cts. § 10-402', summary: 'All-party consent required.' },
  MA: { consent: 'two', statute: 'Mass. Gen. Laws ch. 272, § 99', summary: 'All-party consent required. Felony to violate.' },
  MI: { consent: 'two', statute: 'Mich. Comp. Laws § 750.539c', summary: 'All-party consent required.' },
  MN: { consent: 'one', statute: 'Minn. Stat. § 626A.02', summary: 'One-party consent state.' },
  MS: { consent: 'one', statute: 'Miss. Code Ann. § 41-29-531', summary: 'One-party consent state.' },
  MO: { consent: 'one', statute: 'Mo. Rev. Stat. § 542.402', summary: 'One-party consent state.' },
  MT: { consent: 'two', statute: 'Mont. Code Ann. § 45-8-213', summary: 'All-party consent required.' },
  NE: { consent: 'one', statute: 'Neb. Rev. Stat. § 86-290', summary: 'One-party consent state.' },
  NV: { consent: 'two', statute: 'Nev. Rev. Stat. § 200.620', summary: 'All-party consent required.' },
  NH: { consent: 'two', statute: 'N.H. Rev. Stat. Ann. § 570-A:2', summary: 'All-party consent required.' },
  NJ: { consent: 'one', statute: 'N.J. Stat. Ann. § 2A:156A-3', summary: 'One-party consent state.' },
  NM: { consent: 'one', statute: 'N.M. Stat. Ann. § 30-12-1', summary: 'One-party consent state.' },
  NY: { consent: 'one', statute: 'N.Y. Penal Law § 250.00', summary: 'One-party consent state.' },
  NC: { consent: 'one', statute: 'N.C. Gen. Stat. § 15A-287', summary: 'One-party consent state.' },
  ND: { consent: 'one', statute: 'N.D. Cent. Code § 12.1-15-02', summary: 'One-party consent state.' },
  OH: { consent: 'one', statute: 'Ohio Rev. Code Ann. § 2933.52', summary: 'One-party consent state.' },
  OK: { consent: 'one', statute: 'Okla. Stat. tit. 13, § 176.4', summary: 'One-party consent state.' },
  OR: { consent: 'two', statute: 'Or. Rev. Stat. § 165.540', summary: 'All-party consent required.' },
  PA: { consent: 'two', statute: '18 Pa. Cons. Stat. § 5704', summary: 'All-party consent required. Strictly enforced.' },
  RI: { consent: 'one', statute: 'R.I. Gen. Laws § 11-35-21', summary: 'One-party consent state.' },
  SC: { consent: 'one', statute: 'S.C. Code Ann. § 17-30-30', summary: 'One-party consent state.' },
  SD: { consent: 'one', statute: 'S.D. Codified Laws § 23A-35A-20', summary: 'One-party consent state.' },
  TN: { consent: 'one', statute: 'Tenn. Code Ann. § 39-13-601', summary: 'One-party consent state.' },
  TX: { consent: 'one', statute: 'Tex. Penal Code Ann. § 16.02', summary: 'One-party consent state.' },
  UT: { consent: 'one', statute: 'Utah Code Ann. § 77-23a-4', summary: 'One-party consent state.' },
  VT: { consent: 'one', statute: 'Vt. Stat. Ann. tit. 13, § 4601', summary: 'One-party consent state.' },
  VA: { consent: 'one', statute: 'Va. Code Ann. § 19.2-62', summary: 'One-party consent state.' },
  WA: { consent: 'two', statute: 'Wash. Rev. Code § 9.73.030', summary: 'All-party consent required.' },
  WV: { consent: 'one', statute: 'W. Va. Code § 62-1D-3', summary: 'One-party consent state.' },
  WI: { consent: 'one', statute: 'Wis. Stat. § 968.31', summary: 'One-party consent state.' },
  WY: { consent: 'one', statute: 'Wyo. Stat. Ann. § 7-3-702', summary: 'One-party consent state.' },
  DC: { consent: 'one', statute: 'D.C. Code § 23-542', summary: 'One-party consent.' },
};

// ─────────────────────────────────────────────
// RIGHTS SCRIPTS
// ─────────────────────────────────────────────
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
    emoji: '🤐',
    label: 'Invoke Silence',
    prompt: 'TO INVOKE YOUR 5th AMENDMENT RIGHT:',
    script: '"I am invoking my Fifth Amendment right to remain silent. I will not answer questions without my attorney present."',
    note: 'You must explicitly state you are invoking your right — simply staying quiet is not enough after Berghuis v. Thompkins (2010). Once invoked, questioning must stop.',
    cases: ['5th Amendment', 'Miranda v. Arizona (1966)', 'Berghuis v. Thompkins (2010)'],
  },
];

const LEGAL_RESOURCES = [
  { name: 'ACLU Know Your Rights', desc: 'Free legal guides by state', url: 'https://www.aclu.org/know-your-rights' },
  { name: 'National Police Accountability Project', desc: 'Civil rights attorney referrals', url: 'https://www.napapoliceaccountability.org' },
  { name: 'NAACP Legal Defense Fund', desc: 'Civil rights legal assistance', url: 'https://www.naacpldf.org' },
];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
interface AfterScreenProps {
  location: LocationCoords | null;
}

export function AfterScreen({ location }: AfterScreenProps) {
  const [detectedState, setDetectedState] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);

  // Detect state from GPS on mount / location change
  useEffect(() => {
    if (location && !detectedState) {
      getStateFromCoordinates(location.latitude, location.longitude)
        .then(setDetectedState)
        .catch(() => {});
    }
  }, [location, detectedState]);

  const toggleScript = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedScript(prev => (prev === id ? null : id));
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      // Clipboard import avoided to keep dependencies minimal — use Share instead
      await Share.share({ message: text });
    } catch {}
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AFTER THE STOP</Text>
        <Text style={styles.headerSubtitle}>Evidence · Rights · Resources</Text>
      </View>

      {/* State Recording Law */}
      <View style={[styles.card, styles.cardCyan]}>
        <Text style={styles.sectionLabel}>YOUR STATE · RECORDING LAW</Text>
        {stateLaw ? (
          <>
            <View style={styles.stateRow}>
              <Text style={styles.stateAbbr}>{detectedState}</Text>
              <View style={[
                styles.consentBadge,
                { backgroundColor: stateLaw.consent === 'two' ? 'rgba(255,149,0,0.12)' : 'rgba(50,215,75,0.10)' },
              ]}>
                <Text style={[
                  styles.consentText,
                  { color: stateLaw.consent === 'two' ? COLORS.warning : COLORS.success },
                ]}>
                  {stateLaw.consent === 'two' ? '⚠️ TWO-PARTY CONSENT' : '✓ ONE-PARTY CONSENT'}
                </Text>
              </View>
            </View>
            <Text style={styles.lawSummary}>{stateLaw.summary}</Text>
            <Text style={styles.lawStatute}>{stateLaw.statute}</Text>
            {stateLaw.consent === 'two' && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  Note: Even in two-party consent states, recording police officers in public spaces is protected by the First Amendment.
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.stateEmpty}>
            {location ? 'Detecting your state...' : 'Enable location access to see your state\'s recording law.'}
          </Text>
        )}
      </View>

      {/* Rights Scripts */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>KNOW YOUR RIGHTS — REFERENCE SCRIPTS</Text>
        {RIGHTS_SCRIPTS.map(script => (
          <View key={script.id} style={styles.scriptRow}>
            <TouchableOpacity
              style={styles.scriptHeader}
              onPress={() => toggleScript(script.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.scriptTitle}>{script.emoji} {script.label}</Text>
              <Text style={styles.chevron}>{expandedScript === script.id ? '∧' : '›'}</Text>
            </TouchableOpacity>

            {expandedScript === script.id && (
              <View style={styles.scriptDetail}>
                <View style={styles.scriptBox}>
                  <Text style={styles.scriptPrompt}>{script.prompt}</Text>
                  <Text style={styles.scriptText}>{script.script}</Text>
                </View>
                <Text style={styles.scriptNote}>{script.note}</Text>
                <View style={styles.casesRow}>
                  {script.cases.map(c => (
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
                  <Text style={styles.copyBtnText}>SHARE SCRIPT</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.scriptDivider} />
          </View>
        ))}
      </View>

      {/* Evidence Packaging */}
      <View style={[styles.card, { borderColor: 'rgba(0,229,255,0.3)' }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📦 Evidence Packaging</Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.3)' }]}>
            <Text style={[styles.badgeText, { color: COLORS.primary }]}>READY</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          Download a complete evidence package from any vault entry — SHA-256 hash, GPS coordinates, timestamp, detention duration, and applicable case law. Ready to send to counsel.
        </Text>
        <Text style={[styles.cardBody, { color: COLORS.textSecondary, marginTop: SPACING.sm }]}>
          Go to <Text style={{ color: COLORS.text, fontWeight: '700' }}>🔐 Vault</Text> → tap <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Package</Text> on any incident.
        </Text>
      </View>

      {/* Legal Resources */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📞 Legal Resources</Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(50,215,75,0.10)', borderColor: 'rgba(50,215,75,0.25)' }]}>
            <Text style={[styles.badgeText, { color: COLORS.success }]}>FREE</Text>
          </View>
        </View>
        {LEGAL_RESOURCES.map(resource => (
          <TouchableOpacity
            key={resource.name}
            style={styles.resourceRow}
            onPress={() => openURL(resource.url)}
            activeOpacity={0.7}
          >
            <View style={styles.resourceInfo}>
              <Text style={styles.resourceName}>{resource.name}</Text>
              <Text style={styles.resourceDesc}>{resource.desc}</Text>
            </View>
            <Text style={styles.resourceArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mugshot Monitor — COMING SOON */}
      <View style={[styles.card, styles.comingSoonCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🔭 Mugshot Monitor</Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: COLORS.border }]}>
            <Text style={[styles.badgeText, { color: COLORS.textSecondary }]}>COMING SOON</Text>
          </View>
        </View>
        <Text style={styles.comingSoonBody}>
          Automated scanning and removal requests for your image on mugshot aggregator sites. If charges are dropped or you're acquitted, your image gets removed.
        </Text>
      </View>

      {/* Reputation Defense — COMING SOON */}
      <View style={[styles.card, styles.comingSoonCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🛡️ Reputation Defense</Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: COLORS.border }]}>
            <Text style={[styles.badgeText, { color: COLORS.textSecondary }]}>COMING SOON</Text>
          </View>
        </View>
        <Text style={styles.comingSoonBody}>
          Evidence-backed reputation restoration. Connect your incident hash to attorney filings, track case outcomes, and build a documented record that protects your employment and housing rights.
        </Text>
      </View>

      {/* Legal disclaimer */}
      <Text style={styles.disclaimer}>
        Recording laws vary by state. This app provides general information, not legal advice. In two-party consent states, obtain all-party consent before recording private conversations. Recording police in public spaces is generally protected by the First Amendment. Consult an attorney for your specific situation.
      </Text>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING['2xl'],
  },
  header: {
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(20,20,24,0.65)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCyan: {
    backgroundColor: 'rgba(0,229,255,0.04)',
    borderColor: 'rgba(0,229,255,0.25)',
  },
  comingSoonCard: {
    backgroundColor: 'rgba(255,149,0,0.03)',
    borderColor: 'rgba(255,149,0,0.18)',
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 1.5,
    fontFamily: FONTS.family.mono,
    marginBottom: SPACING.sm,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  stateAbbr: {
    fontSize: FONTS.size['2xl'],
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
  },
  consentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  consentText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    fontFamily: FONTS.family.mono,
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
    fontFamily: FONTS.family.mono,
  },
  warningBox: {
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: FONTS.size.xs,
    lineHeight: 17,
  },
  stateEmpty: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontStyle: 'italic',
  },
  scriptRow: {
    marginBottom: 2,
  },
  scriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
  },
  scriptTitle: {
    color: COLORS.text,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
  },
  chevron: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: FONTS.weight.bold,
  },
  scriptDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  scriptDetail: {
    paddingBottom: SPACING.md,
  },
  scriptBox: {
    backgroundColor: 'rgba(0,229,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  scriptPrompt: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    fontFamily: FONTS.family.mono,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  caseTagText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.family.mono,
  },
  copyBtn: {
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  copyBtnText: {
    color: COLORS.primary,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    fontFamily: FONTS.family.mono,
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    fontFamily: FONTS.family.mono,
    letterSpacing: 0.5,
  },
  cardBody: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  comingSoonBody: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceName: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
  },
  resourceDesc: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },
  resourceArrow: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
    marginLeft: SPACING.sm,
  },
  disclaimer: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
  },
});

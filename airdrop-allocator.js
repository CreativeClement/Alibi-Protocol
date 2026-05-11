/**
 * ALIBI PROTOCOL — Airdrop Allocation Calculator
 * Run locally after snapshot reveal: node airdrop-allocator.js
 *
 * INPUT:  snapshot-data.json  (exported from D1 at snapshot time)
 * OUTPUT: allocations.json    (final $ALIBI amounts per wallet)
 *         allocations-report.txt (human-readable summary)
 *
 * ALLOCATION FORMULA:
 *   BaseScore = (miles × 10) + (hazard_reports × 50) + (verified_events × 200) + (referrals × 100)
 *   ActivityScore = BaseScore ^ 0.65          ← diminishing returns anti-whale
 *   TierMultiplier: RECRUIT=1.0, NAVIGATOR=1.1, SENTINEL=1.25, GUARDIAN=1.5, OPERATOR=2.0
 *   StakeMultiplier: none=1.0, <1K=1.25, 1K-10K=1.5, 10K-50K=2.0, 50K+=2.5
 *   LoyaltyBonus: joined > 30 days before snapshot → +10%
 *   FinalScore = ActivityScore × TierMultiplier × StakeMultiplier × LoyaltyBonus
 *   Allocation = (FinalScore / TotalFinalScores) × AIRDROP_POOL
 *
 * ANTI-SYBIL GUARDS applied before scoring:
 *   - Minimum 10 GPS-verified miles to qualify
 *   - Minimum 1 activity event (hazard OR verified encounter)
 *   - Max per-wallet cap: 0.5% of pool (5,000,000 $ALIBI)
 *   - Wallets flagged for spoofing: score = 0 (excluded)
 */

const fs   = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────
const AIRDROP_POOL          = 150_000_000;   // 150M $ALIBI (15% of 1B supply)
const MIN_MILES             = 10;
const MIN_ACTIVITY_EVENTS   = 1;
const MAX_WALLET_PCT        = 0.005;         // 0.5% cap per wallet
const LOYALTY_DAYS          = 30;
const LOYALTY_BONUS         = 1.10;
const SCORE_EXPONENT        = 0.65;

const TIER_MULTIPLIERS = {
  RECRUIT:   1.00,
  NAVIGATOR: 1.10,
  SENTINEL:  1.25,
  GUARDIAN:  1.50,
  OPERATOR:  2.00,
};

function stakeMultiplier(amountStaked) {
  if (amountStaked >= 50_000) return 2.50;
  if (amountStaked >= 10_000) return 2.00;
  if (amountStaked >=  1_000) return 1.50;
  if (amountStaked >       0) return 1.25;
  return 1.00;
}

// ── Core scoring engine ──────────────────────────────────
function scoreWallet(user, snapshotDate) {
  // Anti-sybil qualification check
  if (user.drive_miles      < MIN_MILES)          return 0;
  if ((user.hazard_reports + user.verified_events) < MIN_ACTIVITY_EVENTS) return 0;
  if (user.flagged_spoof)                          return 0;

  const baseScore    = (user.drive_miles * 10)
                     + (user.hazard_reports   * 50)
                     + (user.verified_events  * 200)
                     + (user.referral_count   * 100);

  const activity     = Math.pow(baseScore, SCORE_EXPONENT);
  const tier         = TIER_MULTIPLIERS[user.tier] || 1.0;
  const stake        = stakeMultiplier(user.amount_staked || 0);
  const memberDays   = (snapshotDate - new Date(user.member_since)) / (1000 * 60 * 60 * 24);
  const loyalty      = memberDays >= LOYALTY_DAYS ? LOYALTY_BONUS : 1.0;

  return activity * tier * stake * loyalty;
}

function calculateAllocations(users, snapshotDate = new Date()) {
  // Score every wallet
  const scored = users.map(u => ({ ...u, score: scoreWallet(u, snapshotDate) }));
  const qualifying = scored.filter(u => u.score > 0);

  console.log(`\n📊 SNAPSHOT ANALYSIS`);
  console.log(`   Total wallets:      ${users.length}`);
  console.log(`   Qualifying:         ${qualifying.length}`);
  console.log(`   Excluded (sybil/no activity): ${users.length - qualifying.length}`);

  const totalScore = qualifying.reduce((sum, u) => sum + u.score, 0);
  const maxPerWallet = AIRDROP_POOL * MAX_WALLET_PCT;

  // First pass: raw allocation
  let allocations = qualifying.map(u => ({
    wallet:      u.wallet,
    discord_id:  u.discord_id,
    tier:        u.tier,
    score:       u.score,
    drive_miles: u.drive_miles,
    hazard_reports: u.hazard_reports,
    verified_events: u.verified_events,
    referral_count: u.referral_count,
    stake_multiplier: stakeMultiplier(u.amount_staked || 0),
    raw_allocation: Math.floor((u.score / totalScore) * AIRDROP_POOL),
  }));

  // Apply whale cap — redistribute overflow pro-rata
  let overflow = 0;
  allocations = allocations.map(a => {
    if (a.raw_allocation > maxPerWallet) {
      overflow += a.raw_allocation - maxPerWallet;
      return { ...a, allocation: maxPerWallet, capped: true };
    }
    return { ...a, allocation: a.raw_allocation, capped: false };
  });

  // Redistribute overflow to uncapped wallets
  if (overflow > 0) {
    const uncapped     = allocations.filter(a => !a.capped);
    const uncappedTotal = uncapped.reduce((s, a) => s + a.score, 0);
    allocations = allocations.map(a => {
      if (a.capped) return a;
      const bonus = Math.floor((a.score / uncappedTotal) * overflow);
      return { ...a, allocation: Math.min(a.allocation + bonus, maxPerWallet) };
    });
  }

  // Sort by allocation descending
  allocations.sort((a, b) => b.allocation - a.allocation);

  const totalAllocated = allocations.reduce((s, a) => s + a.allocation, 0);
  const rarity = allocations.map(a => {
    const pct = a.allocation / AIRDROP_POOL;
    if (pct >= 0.001) return { ...a, package: 'MYTHICAL'  };
    if (pct >= 0.0002)return { ...a, package: 'LEGENDARY' };
    if (pct >= 0.00005) return { ...a, package: 'RARE'    };
    return { ...a, package: 'UNCOMMON' };
  });

  return { allocations: rarity, totalAllocated, qualifying: qualifying.length };
}

// ── Entry point ──────────────────────────────────────────
try {
  const inputFile = path.join(__dirname, 'snapshot-data.json');
  if (!fs.existsSync(inputFile)) {
    console.error('❌ snapshot-data.json not found.');
    console.error('   Export from D1: wrangler d1 execute alibi-discord --command="SELECT u.*, sp.*, ss.amount_staked FROM user_full_stats u LEFT JOIN shield_points sp ON sp.wallet=u.wallet LEFT JOIN seed_stakers ss ON ss.wallet=u.wallet" --json > snapshot-data.json');
    process.exit(1);
  }

  const raw      = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const users    = Array.isArray(raw) ? raw : raw.results || raw;
  const result   = calculateAllocations(users);

  fs.writeFileSync('allocations.json', JSON.stringify(result.allocations, null, 2));

  // Human-readable report
  const lines = [
    '═══════════════════════════════════════════════════',
    '  ALIBI PROTOCOL — AIRDROP ALLOCATION REPORT',
    `  Generated: ${new Date().toISOString()}`,
    '═══════════════════════════════════════════════════',
    `  Total pool:       ${AIRDROP_POOL.toLocaleString()} $ALIBI`,
    `  Total allocated:  ${result.totalAllocated.toLocaleString()} $ALIBI`,
    `  Qualifying wallets: ${result.qualifying}`,
    '',
    '  TOP 20 RECIPIENTS:',
    ...result.allocations.slice(0,20).map((a,i) =>
      `  ${String(i+1).padStart(2)}. ${a.wallet.slice(0,8)}...${a.wallet.slice(-6)}  ${a.allocation.toLocaleString().padStart(12)} $ALIBI  [${a.package}] ×${a.stake_multiplier}`
    ),
    '',
    '  PACKAGE BREAKDOWN:',
    ...['MYTHICAL','LEGENDARY','RARE','UNCOMMON'].map(p => {
      const count = result.allocations.filter(a => a.package === p).length;
      return `  ${p.padEnd(10)} ${count} wallets`;
    }),
    '═══════════════════════════════════════════════════',
  ];
  const report = lines.join('\n');
  fs.writeFileSync('allocations-report.txt', report);
  console.log(report);
  console.log('\n✅ allocations.json and allocations-report.txt written.');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
}

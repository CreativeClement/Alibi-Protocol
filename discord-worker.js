/**
 * ALIBI PROTOCOL — DISCORD BOT (Cloudflare Worker)
 * ─────────────────────────────────────────────────
 * Webhook-based Discord bot. No persistent connection needed.
 * Deploy as a Cloudflare Worker. Visit /setup once to register slash commands.
 *
 * SLASH COMMANDS:
 *   /verify <wallet>  — Link Discord account to Solana wallet
 *   /stats            — Shield Points, tier, activity breakdown
 *   /leaderboard      — Top 20 drivers (global / weekly / recruiters)
 *   /snapshot         — VRF status, network stats, commitment hash
 *   /tier             — Tier progress + fastest path to advance
 *   /package          — Projected Shield Package rarity + $ALIBI estimate
 *   /recruit          — Your referral stats + lifetime bonus SP
 *
 * REQUIRED WORKER BINDINGS (Cloudflare Dashboard → Settings → Variables):
 *   DB                       D1 database bound to alibi-waitlist
 *   DISCORD_PUBLIC_KEY        Secret — Discord app public key
 *   DISCORD_BOT_TOKEN         Secret — Bot token (starts with "Bot ")
 *   DISCORD_APPLICATION_ID    Secret — Discord Application ID
 *   LEADERBOARD_CHANNEL_ID    Secret — #live-leaderboard channel ID
 *   ANNOUNCEMENT_CHANNEL_ID   Secret — #tier-upgrades channel ID
 *
 * CRON TRIGGERS (add in Cloudflare Dashboard → Triggers):
 *   0 * * * *     Hourly tier-upgrade scan
 *   0 9 * * *     Daily leaderboard digest (9AM UTC)
 */

// ─── TIER CONFIGURATION ──────────────────────────────────────────────────────

const TIERS = {
  RECRUIT:   { min: 0,      max: 499,      color: 0x8B949E, emoji: '🔰', label: 'RECRUIT'   },
  NAVIGATOR: { min: 500,    max: 4999,     color: 0x00E5FF, emoji: '🧭', label: 'NAVIGATOR' },
  SENTINEL:  { min: 5000,   max: 14999,    color: 0x00FF88, emoji: '🛡️', label: 'SENTINEL'  },
  GUARDIAN:  { min: 15000,  max: 49999,    color: 0xFF9F0A, emoji: '⚔️', label: 'GUARDIAN'  },
  OPERATOR:  { min: 50000,  max: Infinity, color: 0xFF3B30, emoji: '👁️', label: 'OPERATOR'  },
};

const PACKAGE_RANGES = {
  RECRUIT:   '100 – 499 $ALIBI',
  NAVIGATOR: '500 – 2,500 $ALIBI',
  SENTINEL:  '2,500 – 10,000 $ALIBI',
  GUARDIAN:  '10,000 – 50,000 $ALIBI',
  OPERATOR:  '50,000 – 250,000 $ALIBI',
};

function getTier(points) {
  for (const [name, cfg] of Object.entries(TIERS)) {
    if (points >= cfg.min && points <= cfg.max) return { name, ...cfg };
  }
  return { name: 'RECRUIT', ...TIERS.RECRUIT };
}

function getNextTierName(currentName) {
  const names = Object.keys(TIERS);
  const idx = names.indexOf(currentName);
  return idx < names.length - 1 ? names[idx + 1] : null;
}

function bar(pct, len = 14) {
  const filled = Math.round((Math.min(pct, 100) / 100) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function shortWallet(w) {
  return w ? `\`${w.slice(0, 6)}...${w.slice(-4)}\`` : '`unknown`';
}

// ─── ED25519 SIGNATURE VERIFICATION ─────────────────────────────────────────

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}

async function verifyRequest(req, rawBody, publicKey) {
  const sig = req.headers.get('X-Signature-Ed25519');
  const ts  = req.headers.get('X-Signature-Timestamp');
  if (!sig || !ts) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw', hexToBytes(publicKey),
      { name: 'Ed25519' }, false, ['verify']
    );
    return crypto.subtle.verify(
      'Ed25519', key, hexToBytes(sig),
      new TextEncoder().encode(ts + rawBody)
    );
  } catch { return false; }
}

// ─── MAIN WORKER ENTRY ───────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // One-time command registration — visit /setup in browser
    if (url.pathname === '/setup') return registerCommands(env);

    if (req.method !== 'POST') return new Response('OK', { status: 200 });

    const body = await req.text();
    const valid = await verifyRequest(req, body, env.DISCORD_PUBLIC_KEY);
    if (!valid) return new Response('Unauthorized', { status: 401 });

    const ix = JSON.parse(body);
    if (ix.type === 1) return json({ type: 1 });           // PING
    if (ix.type === 2) return handleCommand(ix, env);      // Slash command
    if (ix.type === 3) return handleComponent(ix, env);    // Button click
    return new Response('Unknown', { status: 400 });
  },

  async scheduled(event, env) {
    const hour = new Date().getUTCHours();
    if (hour === 9) await postDailyLeaderboard(env);
    await scanTierUpgrades(env);
  },
};

// ─── COMMAND ROUTER ──────────────────────────────────────────────────────────

async function handleCommand(ix, env) {
  const name = ix.data.name;
  const uid  = ix.member?.user?.id || ix.user?.id;
  const uname = ix.member?.user?.username || ix.user?.username || 'Driver';
  const opts = ix.data.options || [];

  switch (name) {
    case 'verify':    return cmdVerify(uid, uname, opts, env);
    case 'stats':     return cmdStats(uid, env);
    case 'leaderboard': return cmdLeaderboard(opts, env);
    case 'snapshot':  return cmdSnapshot(env);
    case 'tier':      return cmdTier(uid, env);
    case 'package':   return cmdPackage(uid, env);
    case 'recruit':   return cmdRecruit(uid, env);
    default: return ephemeral('🛡️ Unknown command.');
  }
}

// ─── /verify ─────────────────────────────────────────────────────────────────

async function cmdVerify(uid, uname, opts, env) {
  const wallet = (opts.find(o => o.name === 'wallet')?.value || '').trim();
  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return ephemeral('❌ Invalid Solana wallet address. Double-check and try again.');
  }
  const clash = await env.DB.prepare(
    'SELECT discord_id FROM discord_users WHERE wallet_address = ?'
  ).bind(wallet).first();
  if (clash && clash.discord_id !== uid) {
    return ephemeral('❌ That wallet is already linked to another Discord account.');
  }
  await env.DB.prepare(`
    INSERT INTO discord_users (discord_id, wallet_address, username, verified_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      wallet_address = excluded.wallet_address,
      username       = excluded.username,
      verified_at    = excluded.verified_at
  `).bind(uid, wallet, uname, Date.now()).run();

  const stats = await getStats(wallet, env);
  const tier  = getTier(stats?.shield_points || 0);
  return json({ type: 4, data: { flags: 64, embeds: [{
    title: '🛡️ WALLET VERIFIED',
    description: `Linked to ${shortWallet(wallet)}`,
    color: tier.color,
    fields: [
      { name: 'SHIELD POINTS', value: `**${(stats?.shield_points||0).toLocaleString()} SP**`, inline: true },
      { name: 'TIER',          value: `${tier.emoji} **${tier.name}**`,                        inline: true },
      { name: 'MILES DRIVEN',  value: `**${(stats?.miles_driven||0).toFixed(1)} mi**`,         inline: true },
    ],
    footer: { text: 'ALIBI PROTOCOL | Drive. Protect. Earn.' },
    timestamp: new Date().toISOString(),
  }] } });
}

// ─── /stats ──────────────────────────────────────────────────────────────────

async function cmdStats(uid, env) {
  const user = await env.DB.prepare(
    'SELECT wallet_address, username FROM discord_users WHERE discord_id = ?'
  ).bind(uid).first();
  if (!user) return ephemeral('❌ No wallet linked yet. Run `/verify <wallet>` first.');

  const s = await getStats(user.wallet_address, env);
  if (!s) return ephemeral('📊 No activity yet. Start driving with the Alibi app!');

  const tier  = getTier(s.shield_points);
  const nName = getNextTierName(tier.name);
  const nTier = nName ? TIERS[nName] : null;
  const pct   = nTier
    ? Math.min(100, Math.floor(((s.shield_points - tier.min) / (nTier.min - tier.min)) * 100))
    : 100;

  return json({ type: 4, data: { embeds: [{
    title: `${tier.emoji} ${(user.username||'DRIVER').toUpperCase()} — SHIELD REPORT`,
    color: tier.color,
    fields: [
      { name: '◆ SHIELD POINTS', value: `\`\`\`${s.shield_points.toLocaleString()} SP\`\`\``, inline: false },
      { name: '🎯 TIER',   value: `${tier.emoji} **${tier.name}**${nTier ? ` → ${TIERS[nName].emoji} ${nName}` : ' ⭐ MAX'}`, inline: false },
      { name: '📈 PROGRESS', value: `${bar(pct)} ${pct}%\n${nTier ? `${(nTier.min - s.shield_points).toLocaleString()} SP to ${nName}` : 'OPERATOR ACHIEVED'}`, inline: false },
      { name: '🛣️ Miles',     value: `**${(s.miles_driven||0).toFixed(1)}**`,   inline: true },
      { name: '⚠️ Hazards',   value: `**${s.hazards_reported||0}**`,             inline: true },
      { name: '🚨 Shields',   value: `**${s.legal_shields_used||0}**`,           inline: true },
      { name: '👥 Recruits',  value: `**${s.referrals||0}**`,                    inline: true },
      { name: '📅 Active Days', value: `**${s.active_days||0}/30**`,             inline: true },
      { name: '📍 Wallet',    value: shortWallet(user.wallet_address),           inline: true },
    ],
    footer: { text: 'ALIBI PROTOCOL | Snapshot: WATCHING 👁️' },
    timestamp: new Date().toISOString(),
  }] } });
}

// ─── /leaderboard ────────────────────────────────────────────────────────────

async function cmdLeaderboard(opts, env) {
  const type = opts.find(o => o.name === 'type')?.value || 'global';

  let rows, title, sub;
  if (type === 'weekly') {
    const since = Date.now() - 7 * 86400000;
    const res = await env.DB.prepare(`
      SELECT sp.wallet_address, sp.shield_points, sp.miles_driven, du.username
      FROM shield_points sp LEFT JOIN discord_users du ON du.wallet_address = sp.wallet_address
      WHERE sp.last_updated > ? ORDER BY sp.shield_points DESC LIMIT 20
    `).bind(since).all();
    rows = res.results || [];
    title = '🏆 WEEKLY LEADERBOARD';
    sub   = '*Resets every Monday 00:00 UTC*';
  } else if (type === 'referrals') {
    const res = await env.DB.prepare(`
      SELECT r.referrer_wallet, COUNT(*) as recruits, du.username,
             SUM(sp.miles_driven) as recruit_miles
      FROM referrals r
      LEFT JOIN shield_points sp ON sp.wallet_address = r.referee_wallet
      LEFT JOIN discord_users du ON du.wallet_address = r.referrer_wallet
      GROUP BY r.referrer_wallet ORDER BY recruits DESC LIMIT 20
    `).all();
    rows = res.results || [];
    title = '🤝 RECRUITER LEADERBOARD';
    sub   = '*By qualified referrals*';
  } else {
    const res = await env.DB.prepare(`
      SELECT sp.wallet_address, sp.shield_points, sp.miles_driven, du.username
      FROM shield_points sp LEFT JOIN discord_users du ON du.wallet_address = sp.wallet_address
      ORDER BY sp.shield_points DESC LIMIT 20
    `).all();
    rows = res.results || [];
    title = '🌐 GLOBAL LEADERBOARD';
    sub   = '*All-time Shield Points*';
  }

  if (!rows.length) return ephemeral('📊 No data yet — be the first on the board!');

  const medals = ['🥇','🥈','🥉'];
  const lines  = rows.map((r, i) => {
    const medal = medals[i] || `**${i+1}.**`;
    const name  = r.username ? `@${r.username}` : `${(r.wallet_address||r.referrer_wallet||'').slice(0,6)}...`;
    const t     = getTier(r.shield_points || 0);
    return type === 'referrals'
      ? `${medal} ${t.emoji} ${name} — **${r.recruits} recruits** | ${parseFloat(r.recruit_miles||0).toFixed(0)} mi`
      : `${medal} ${t.emoji} ${name} — **${(r.shield_points||0).toLocaleString()} SP** | ${parseFloat(r.miles_driven||0).toFixed(1)} mi`;
  }).join('\n');

  return json({ type: 4, data: { embeds: [{
    title, color: 0x00E5FF,
    description: `${sub}\n\n${lines}`,
    footer: { text: `ALIBI PROTOCOL | ${new Date().toUTCString()}` },
    timestamp: new Date().toISOString(),
  }], components: [{ type: 1, components: [
    { type: 2, style: 2, label: 'Global',     custom_id: 'lb_global'    },
    { type: 2, style: 2, label: 'This Week',  custom_id: 'lb_weekly'    },
    { type: 2, style: 2, label: 'Recruiters', custom_id: 'lb_referrals' },
  ]}] } });
}

// ─── /snapshot ───────────────────────────────────────────────────────────────

async function cmdSnapshot(env) {
  const commit = await env.DB.prepare(
    'SELECT * FROM snapshot_commitment ORDER BY created_at DESC LIMIT 1'
  ).first();
  const net = await env.DB.prepare(`
    SELECT COUNT(DISTINCT wallet_address) as drivers,
           SUM(miles_driven)   as miles,
           SUM(shield_points)  as sp,
           SUM(legal_shields_used) as shields
    FROM shield_points WHERE shield_points > 0
  `).first();

  const TARGET_MILES = 100000;
  const miles = parseFloat(net?.miles || 0);
  const pct   = Math.min(100, Math.floor((miles / TARGET_MILES) * 100));

  return json({ type: 4, data: { embeds: [{
    title: '👁️ SNAPSHOT WATCH',
    description: '**Triggered by Switchboard VRF when total verified miles cross the threshold.**\nNo one knows the exact moment. The blockchain decides.',
    color: 0xFF9F0A,
    fields: [
      { name: '🔐 VRF STATUS', value: commit ? '🟡 MONITORING — ACTIVE' : '🔴 COMMITMENT PENDING', inline: false },
      { name: '📋 COMMITMENT HASH', value: commit
          ? `\`${commit.hash?.slice(0,20)}...${commit.hash?.slice(-8)}\`\n[Verify on Solana](https://solscan.io/tx/${commit.tx_signature})`
          : '`Will be published on-chain before snapshot triggers`', inline: false },
      { name: '🛣️ MILES TO TRIGGER', value: `${bar(pct)} ${pct}%\n**${miles.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} / ${TARGET_MILES.toLocaleString()} mi**`, inline: false },
      { name: '👤 Active Drivers', value: `**${(net?.drivers||0).toLocaleString()}**`, inline: true },
      { name: '💎 Total SP',       value: `**${(net?.sp||0).toLocaleString()}**`,      inline: true },
      { name: '🚨 Shields Used',   value: `**${(net?.shields||0).toLocaleString()}**`, inline: true },
    ],
    footer: { text: 'ALIBI PROTOCOL | Stay active. The snapshot watches everything.' },
    timestamp: new Date().toISOString(),
  }] } });
}

// ─── /tier ───────────────────────────────────────────────────────────────────

async function cmdTier(uid, env) {
  const user = await env.DB.prepare(
    'SELECT wallet_address FROM discord_users WHERE discord_id = ?'
  ).bind(uid).first();
  if (!user) return ephemeral('❌ Run `/verify <wallet>` first.');

  const s    = await getStats(user.wallet_address, env);
  const sp   = s?.shield_points || 0;
  const tier = getTier(sp);
  const nName = getNextTierName(tier.name);
  const nTier = nName ? TIERS[nName] : null;

  const map = Object.entries(TIERS).map(([name, cfg]) => {
    const cur  = name === tier.name;
    const done = sp >= cfg.min;
    const icon = cur ? '▶' : (done ? '✓' : '○');
    return `${icon} ${cfg.emoji} **${name}** — ${cfg.min.toLocaleString()} SP${cur ? '  ← YOU ARE HERE' : ''}`;
  }).join('\n');

  return json({ type: 4, data: { embeds: [{
    title: `${tier.emoji} TIER STATUS — ${tier.name}`,
    description: map,
    color: tier.color,
    fields: [
      { name: '📊 YOUR SP',  value: `**${sp.toLocaleString()} SP**`, inline: true },
      { name: nTier ? `🎯 TO ${nName}` : '⭐ STATUS',
        value: nTier ? `**${(nTier.min - sp).toLocaleString()} SP needed**` : '**MAX TIER**', inline: true },
      { name: '⚡ FASTEST PATH UP',
        value: nTier
          ? `• Drive **${Math.ceil((nTier.min - sp)/3)} more miles**\n• Report **${Math.ceil((nTier.min - sp)/15)} hazards**\n• **Activate Legal Shield** during a real stop *(10× multiplier)*`
          : '🛡️ You have reached OPERATOR. The apex.',
        inline: false },
    ],
    footer: { text: 'ALIBI PROTOCOL | Every mile moves the needle.' },
    timestamp: new Date().toISOString(),
  }] } });
}

// ─── /package ────────────────────────────────────────────────────────────────

async function cmdPackage(uid, env) {
  const user = await env.DB.prepare(
    'SELECT wallet_address FROM discord_users WHERE discord_id = ?'
  ).bind(uid).first();
  if (!user) return ephemeral('❌ Run `/verify <wallet>` first.');

  const s  = await getStats(user.wallet_address, env);
  const sp = s?.shield_points || 0;
  const t  = getTier(sp);

  return json({ type: 4, data: { flags: 64, embeds: [{
    title: '🎁 YOUR SHIELD PACKAGE',
    description: '**Snapshot has not triggered yet.** This is your projected rarity based on current activity.\n\n*Keep driving to increase your tier before VRF fires.*',
    color: t.color,
    fields: [
      { name: '📦 PROJECTED RARITY', value: `\`\`\`${t.name} PACKAGE\`\`\``, inline: false },
      { name: '💎 $ALIBI RANGE',     value: `**${PACKAGE_RANGES[t.name]}**`,  inline: true  },
      { name: '📊 CURRENT SP',       value: `**${sp.toLocaleString()} SP**`,  inline: true  },
      { name: '🔒 VAULT CHOICE',
        value: 'When snapshot triggers: **CLAIM NOW** (instant) or **VAULT 90 days for 1.6×**.\nYour call — choose wisely.',
        inline: false },
    ],
    footer: { text: '🔐 Package sealed until Switchboard VRF triggers.' },
    timestamp: new Date().toISOString(),
  }] } });
}

// ─── /recruit ────────────────────────────────────────────────────────────────

async function cmdRecruit(uid, env) {
  const user = await env.DB.prepare(
    'SELECT wallet_address FROM discord_users WHERE discord_id = ?'
  ).bind(uid).first();
  if (!user) return ephemeral('❌ Run `/verify <wallet>` first.');

  const r = await env.DB.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN sp.miles_driven >= 10 THEN 1 ELSE 0 END) as qualified,
           SUM(sp.miles_driven) as recruit_miles
    FROM referrals rf
    LEFT JOIN shield_points sp ON sp.wallet_address = rf.referee_wallet
    WHERE rf.referrer_wallet = ?
  `).bind(user.wallet_address).first();

  const bonusSP = Math.floor(parseFloat(r?.recruit_miles || 0) * 0.08 * 3);
  const wallet  = user.wallet_address;

  return json({ type: 4, data: { embeds: [{
    title: '🤝 RECRUITER STATS', color: 0x00FF88,
    fields: [
      { name: '👥 Total Recruits',         value: `**${r?.total || 0}**`,                                      inline: true },
      { name: '✅ Qualified (10+ mi)',      value: `**${r?.qualified || 0}**`,                                  inline: true },
      { name: '🛣️ Total Recruit Miles',    value: `**${parseFloat(r?.recruit_miles||0).toFixed(1)} mi**`,      inline: true },
      { name: '💎 Bonus SP Earned',        value: `**${bonusSP.toLocaleString()} SP** *(8% of recruit miles)* — forever`, inline: false },
      { name: '🔗 Your Referral Link',     value: `\`https://alibiprotocol.com/?ref=${wallet.slice(0,8)}\``,   inline: false },
    ],
    footer: { text: 'ALIBI PROTOCOL | Earn 8% of every mile your recruits drive. Forever.' },
    timestamp: new Date().toISOString(),
  }] } });
}

// ──────────────────────────────────────────────────────
// COMPONENT HANDLER — button interactions (leaderboard tabs)
// ──────────────────────────────────────────────────────
async function handleComponent(ix, env) {
  const customId = ix.data.custom_id;
  if (customId.startsWith('lb_')) {
    const mode = customId.replace('lb_', ''); // global | weekly | referrals
    return json(await buildLeaderboardEmbed(mode, env));
  }
  return ephemeral('Unknown action.');
}

// ──────────────────────────────────────────────────────
// UTILITY — getStats(wallet, env) — pull full user record
// ──────────────────────────────────────────────────────
async function getStats(wallet, env) {
  const row = await env.DB.prepare(`
    SELECT sp.total_points, sp.drive_miles, sp.hazard_reports,
           sp.verified_events, sp.referral_count, sp.updated_at,
           du.tier, du.discord_id,
           COALESCE(ss.amount_staked, 0)  AS amount_staked,
           COALESCE(ss.multiplier,    1.0) AS stake_multiplier
    FROM shield_points sp
    LEFT JOIN discord_users du ON du.wallet = sp.wallet
    LEFT JOIN seed_stakers  ss ON ss.wallet = sp.wallet
    WHERE sp.wallet = ?
  `).bind(wallet).first();
  if (!row) return null;

  const rankRow = await env.DB.prepare(`
    SELECT COUNT(*) AS rank FROM shield_points
    WHERE total_points > (SELECT total_points FROM shield_points WHERE wallet = ?)
  `).bind(wallet).first();

  return { ...row, rank: (rankRow?.rank ?? 0) + 1, staked: row.amount_staked > 0 };
}

// ──────────────────────────────────────────────────────
// LEADERBOARD EMBED BUILDER (shared by /leaderboard + daily cron)
// ──────────────────────────────────────────────────────
async function buildLeaderboardEmbed(mode, env) {
  let rows, title, desc;

  if (mode === 'weekly') {
    rows = await env.DB.prepare(`
      SELECT sp.wallet, sp.total_points, COALESCE(ss.multiplier,1.0) AS stake_multiplier
      FROM shield_points sp
      LEFT JOIN seed_stakers ss ON ss.wallet = sp.wallet
      WHERE sp.updated_at >= datetime('now','-7 days')
      ORDER BY sp.total_points DESC LIMIT 10
    `).all();
    title = '⚡ WEEKLY SHIELD LEADERBOARD'; desc = 'Top navigators this week.';
  } else if (mode === 'referrals') {
    rows = await env.DB.prepare(`
      SELECT r.referrer_wallet AS wallet, COUNT(*) AS total_points,
             COALESCE(ss.multiplier,1.0) AS stake_multiplier
      FROM referrals r
      LEFT JOIN seed_stakers ss ON ss.wallet = r.referrer_wallet
      WHERE r.qualified = 1 GROUP BY r.referrer_wallet ORDER BY total_points DESC LIMIT 10
    `).all();
    title = '🤝 TOP RECRUITERS'; desc = 'Qualified referrals this epoch.';
  } else {
    rows = await env.DB.prepare(`
      SELECT sp.wallet, sp.total_points, COALESCE(ss.multiplier,1.0) AS stake_multiplier
      FROM shield_points sp
      LEFT JOIN seed_stakers ss ON ss.wallet = sp.wallet
      ORDER BY total_points DESC LIMIT 10
    `).all();
    title = '🏆 GLOBAL SHIELD LEADERBOARD'; desc = 'All-time top Alibi Protocol navigators.';
  }

  const medals = ['🥇','🥈','🥉'];
  const lines = (rows?.results || []).map((r, i) => {
    const pos      = medals[i] || `**${i+1}.**`;
    const stakeTag = r.stake_multiplier > 1 ? ` 🔒×${r.stake_multiplier.toFixed(1)}` : '';
    return `${pos} \`${shortWallet(r.wallet)}\` — **${Number(r.total_points).toLocaleString()} SP**${stakeTag}`;
  });

  const seedCTA = '> 🔒 **Seed phase stakers earn a launch-day multiplier on ALL earned $ALIBI.**\n> Use `/package` to see your projected bonus. Stake early — locks are permanent.';
  return {
    type: 4,
    data: {
      embeds: [{ title, color: 0x00E5FF, timestamp: new Date().toISOString(),
        description: `${desc}\n\n${lines.join('\n') || '_No data yet — start navigating._'}\n\n${seedCTA}`,
        footer: { text: 'ALIBI PROTOCOL · Shield Points Engine' },
      }],
      components: [{ type: 1, components: [
        { type: 2, style: 2, label: '🌐 Global',      custom_id: 'lb_global'    },
        { type: 2, style: 2, label: '⚡ Weekly',       custom_id: 'lb_weekly'   },
        { type: 2, style: 2, label: '🤝 Recruiters',   custom_id: 'lb_referrals'},
      ]}],
    },
  };
}

// ──────────────────────────────────────────────────────
// CRON — daily leaderboard digest (9AM UTC)
// ──────────────────────────────────────────────────────
async function postDailyLeaderboard(env) {
  if (!env.LEADERBOARD_CHANNEL_ID) return;
  const embed = await buildLeaderboardEmbed('global', env);
  await postToChannel(env.LEADERBOARD_CHANNEL_ID, {
    content: [
      '📡 **DAILY SHIELD REPORT — NAVIGATE. EARN. PROTECT.**',
      '> Every mile driven, every hazard reported, every recruit onboarded — it all compounds.',
      '> 🔒 **Seed phase stakers:** your launch-day multiplier locks in at snapshot. Don\'t wait.',
    ].join('\n'),
    embeds:     embed.data.embeds,
    components: embed.data.components,
  }, env);
}

// ──────────────────────────────────────────────────────
// CRON — tier upgrade scanner (runs hourly)
// ──────────────────────────────────────────────────────
async function scanTierUpgrades(env) {
  if (!env.TIER_CHANNEL_ID) return;
  const users = await env.DB.prepare(`
    SELECT du.discord_id, du.wallet, du.tier AS old_tier, sp.total_points
    FROM discord_users du JOIN shield_points sp ON sp.wallet = du.wallet
  `).all();

  for (const u of (users?.results || [])) {
    const newTierName = getTier(u.total_points).name;
    if (newTierName === u.old_tier) continue;
    await env.DB.prepare(`UPDATE discord_users SET tier = ? WHERE wallet = ?`)
      .bind(newTierName, u.wallet).run();

    const t = TIERS[newTierName];
    const stakeBonus = { SENTINEL: '1.5×', GUARDIAN: '2.0×', OPERATOR: '2.5×' };
    const stakeLine = stakeBonus[newTierName]
      ? `\n🔒 **Seed stakers at this tier lock a ${stakeBonus[newTierName]} launch-day multiplier.** Use \`/package\` to claim yours.`
      : '\nKeep pushing — every mile stacks toward the snapshot.';

    await postToChannel(env.TIER_CHANNEL_ID, {
      content: `<@${u.discord_id}>`,
      embeds: [{
        title: `${t.emoji} TIER UNLOCKED — ${newTierName}`,
        color: t.color,
        timestamp: new Date().toISOString(),
        description: `\`${shortWallet(u.wallet)}\` has reached **${newTierName}** tier.\n> ${Number(u.total_points).toLocaleString()} Shield Points${stakeLine}`,
        footer: { text: 'ALIBI PROTOCOL · TIER ENGINE' },
      }],
    }, env);
  }
}

// ──────────────────────────────────────────────────────
// RESPONSE HELPERS
// ──────────────────────────────────────────────────────
function json(data) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
function ephemeral(content) {
  return json({ type: 4, data: { content, flags: 64 } });
}

// ──────────────────────────────────────────────────────
// DISCORD REST — post to channel
// ──────────────────────────────────────────────────────
async function postToChannel(channelId, payload, env) {
  return fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    body: JSON.stringify(payload),
  });
}

// ──────────────────────────────────────────────────────
// REGISTER SLASH COMMANDS — hit GET /setup once after deploy
// ──────────────────────────────────────────────────────
async function registerCommands(env) {
  const commands = [
    { name: 'verify',      description: 'Link your Solana wallet to start earning Shield Points.',
      options: [{ type: 3, name: 'wallet', description: 'Your Solana wallet address', required: true }] },
    { name: 'stats',       description: 'View your Shield Points, tier, and staking multiplier.' },
    { name: 'leaderboard', description: 'View the global Shield Points leaderboard.' },
    { name: 'snapshot',    description: 'Check snapshot commitment, network stats, and your allocation.' },
    { name: 'tier',        description: 'View the full tier map and your current position.' },
    { name: 'package',     description: 'See your projected Shield Package rarity and seed staking bonus.' },
    { name: 'recruit',     description: 'Get your referral link and view your recruit stats.' },
  ];
  const res = await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    body: JSON.stringify(commands),
  });
  const data = await res.json();
  return json({ registered: commands.length, status: res.status, commands: data });
}

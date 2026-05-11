/**
 * ALIBI PROTOCOL — API Worker
 * Deploy to: alibi-api.alibiprotocol.workers.dev
 *
 * Endpoints:
 *   POST /legal-guidance          — Claude AI proxy
 *   POST /founding-shield         — Founding Shield wallet claim
 *   GET  /founding-shield/count   — Count of claims
 *   POST /airdrop/register        — Register wallet + twitter for airdrop
 *   POST /airdrop/activity        — Log an activity (from app)
 *   GET  /airdrop/status          — User's points + tasks (?wallet=)
 *   GET  /airdrop/leaderboard     — Top earners (public)
 *   GET  /airdrop/admin           — Full admin view (?key=)
 */

const ALLOWED_ORIGINS = [
  'https://alibiprotocol.com',
  'https://app.alibiprotocol.com',
  'https://alibi-protocol.alibiprotocol.workers.dev',
  'https://www.alibiprotocol.com',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Alibi-Version',
  'Access-Control-Max-Age': '86400',
};

// Admin key — change this in Cloudflare Worker env vars as ADMIN_KEY secret
const ADMIN_KEY_DEFAULT = 'ALIBI911ADMIN';

// Points per activity type
const POINTS = {
  app_session:       10,   // limited 5x per day per wallet
  hazard_report:     25,   // unlimited
  legal_shield:      50,   // per activation
  twitter_follow:   100,   // one-time
  twitter_retweet:   50,   // one-time
  twitter_like:      25,   // one-time
  discord_join:     100,   // one-time
  referral:         200,   // per referred user who registers
  article_share:     75,   // one-time
};

const ONE_TIME_ACTIVITIES = new Set([
  'twitter_follow', 'twitter_retweet', 'twitter_like', 'discord_join', 'article_share'
]);

async function checkRateLimit(ip, env, suffix = '') {
  if (!env.RATE_LIMIT_KV) return true; // Allow if KV not configured
  const key = `rl:${ip}${suffix}`;
  const current = await env.RATE_LIMIT_KV.get(key);
  const count = current ? parseInt(current) : 0;
  if (count >= 30) return false;
  await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 60 });
  return true;
}

function jsonResponse(data, status = 200, corsOrigin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin,
      'Cache-Control': 'no-cache',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);
    const corsOrigin = isAllowedOrigin ? origin : '*';
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, 'Access-Control-Allow-Origin': corsOrigin },
      });
    }

    const url = new URL(request.url);

    // ── FOUNDING SHIELD: GET count ──────────────────────────────
    if (request.method === 'GET' && url.pathname === '/founding-shield/count') {
      try {
        const result = await env.DB.prepare(
          'SELECT COUNT(*) as total FROM founding_shields'
        ).first();
        return jsonResponse({ total: result?.total || 0, cap: 10000 }, 200, corsOrigin);
      } catch {
        return jsonResponse({ total: 0, cap: 10000 }, 200, corsOrigin);
      }
    }

    // ── FOUNDING SHIELD: POST claim ──────────────────────────────
    if (request.method === 'POST' && url.pathname === '/founding-shield') {
      const allowed = await checkRateLimit(clientIP + ':shield', env);
      if (!allowed) return jsonResponse({ error: 'Rate limit exceeded.' }, 429, corsOrigin);

      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, corsOrigin);
      }

      const { wallet, email, ref_by, source, activated_at } = body;
      const solanaBase58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (!wallet || !solanaBase58Regex.test(wallet)) {
        return jsonResponse({ error: 'Invalid Solana wallet address' }, 400, corsOrigin);
      }

      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS founding_shields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet TEXT UNIQUE NOT NULL,
          email TEXT,
          ref_by TEXT,
          ref_code TEXT,
          source TEXT,
          activated_at TEXT,
          ip TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();

        const existing = await env.DB.prepare(
          'SELECT id, ref_code FROM founding_shields WHERE wallet = ?'
        ).bind(wallet).first();

        if (existing) {
          const position = await env.DB.prepare(
            'SELECT COUNT(*) as pos FROM founding_shields WHERE id <= ?'
          ).bind(existing.id).first();
          return jsonResponse({ position: position?.pos, ref_code: existing.ref_code, status: 'already_claimed' }, 200, corsOrigin);
        }

        const count = await env.DB.prepare(
          'SELECT COUNT(*) as total FROM founding_shields'
        ).first();
        if (count?.total >= 10000) {
          return jsonResponse({ error: 'Founding Shield program is full.' }, 409, corsOrigin);
        }

        const randomBytes = new Uint8Array(6);
        crypto.getRandomValues(randomBytes);
        const randomSuffix = Array.from(randomBytes).map(b => b.toString(36)).join('').slice(0, 8).toUpperCase();
        const ref_code = wallet.slice(0, 6) + randomSuffix;

        await env.DB.prepare(
          'INSERT INTO founding_shields (wallet, email, ref_by, ref_code, source, activated_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(wallet, email || null, ref_by || null, ref_code, source || 'app', activated_at || new Date().toISOString(), clientIP).run();

        const newCount = await env.DB.prepare(
          'SELECT COUNT(*) as total FROM founding_shields'
        ).first();
        return jsonResponse({ position: newCount?.total, ref_code, status: 'claimed' }, 200, corsOrigin);

      } catch (e) {
        return jsonResponse({ error: 'Server error', detail: e.message }, 500, corsOrigin);
      }
    }

    // ── AIRDROP: REGISTER wallet + twitter ────────────────────────
    if (request.method === 'POST' && url.pathname === '/airdrop/register') {
      const allowed = await checkRateLimit(clientIP + ':airdrop', env);
      if (!allowed) return jsonResponse({ error: 'Rate limit exceeded.' }, 429, corsOrigin);

      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, corsOrigin);
      }

      const { wallet, twitter, email, ref_code } = body;
      const solanaBase58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (!wallet || !solanaBase58Regex.test(wallet)) {
        return jsonResponse({ error: 'Valid Solana wallet address required.' }, 400, corsOrigin);
      }

      try {
        // Upsert into founding_shields (that's our primary user table)
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS founding_shields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet TEXT UNIQUE NOT NULL,
          email TEXT,
          twitter TEXT,
          ref_by TEXT,
          ref_code TEXT,
          source TEXT,
          activated_at TEXT,
          ip TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();

        // Add twitter column if missing (migration)
        try {
          await env.DB.prepare('ALTER TABLE founding_shields ADD COLUMN twitter TEXT').run();
        } catch { /* column already exists */ }

        const existing = await env.DB.prepare(
          'SELECT id, ref_code FROM founding_shields WHERE wallet = ?'
        ).bind(wallet).first();

        let userRefCode;
        if (existing) {
          // Update twitter/email if provided
          if (twitter) {
            await env.DB.prepare(
              'UPDATE founding_shields SET twitter = ?, email = COALESCE(NULLIF(?, ""), email) WHERE wallet = ?'
            ).bind(twitter, email || '', wallet).run();
          }
          userRefCode = existing.ref_code;
        } else {
          const randomBytes = new Uint8Array(6);
          crypto.getRandomValues(randomBytes);
          const randomSuffix = Array.from(randomBytes).map(b => b.toString(36)).join('').slice(0, 8).toUpperCase();
          userRefCode = wallet.slice(0, 6) + randomSuffix;

          await env.DB.prepare(
            'INSERT INTO founding_shields (wallet, email, twitter, ref_by, ref_code, source, activated_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(wallet, email || null, twitter || null, ref_code || null, userRefCode, 'airdrop', new Date().toISOString(), clientIP).run();

          // Award referral points to whoever referred this user
          if (ref_code) {
            const referrer = await env.DB.prepare(
              'SELECT wallet FROM founding_shields WHERE ref_code = ? AND wallet != ?'
            ).bind(ref_code, wallet).first();
            if (referrer) {
              await env.DB.prepare(
                'INSERT INTO airdrop_activities (wallet, activity_type, points, metadata) VALUES (?, ?, ?, ?)'
              ).bind(referrer.wallet, 'referral', POINTS.referral, JSON.stringify({ referred_wallet: wallet })).run();
            }
          }
        }

        // Get current points
        const pts = await env.DB.prepare(
          'SELECT SUM(points) as total FROM airdrop_activities WHERE wallet = ?'
        ).bind(wallet).first();

        return jsonResponse({
          status: existing ? 'updated' : 'registered',
          wallet,
          ref_code: userRefCode,
          points: pts?.total || 0,
        }, 200, corsOrigin);

      } catch (e) {
        return jsonResponse({ error: 'Server error', detail: e.message }, 500, corsOrigin);
      }
    }

    // ── AIRDROP: LOG ACTIVITY ─────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/airdrop/activity') {
      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, corsOrigin);
      }

      const { wallet, activity_type, metadata } = body;
      const solanaBase58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (!wallet || !solanaBase58Regex.test(wallet)) {
        return jsonResponse({ error: 'Valid Solana wallet required.' }, 400, corsOrigin);
      }
      if (!activity_type || !POINTS[activity_type]) {
        return jsonResponse({ error: `Unknown activity_type. Valid: ${Object.keys(POINTS).join(', ')}` }, 400, corsOrigin);
      }

      try {
        // Check wallet is registered
        const user = await env.DB.prepare(
          'SELECT id FROM founding_shields WHERE wallet = ?'
        ).bind(wallet).first();
        if (!user) {
          return jsonResponse({ error: 'Wallet not registered. Call /airdrop/register first.' }, 403, corsOrigin);
        }

        // One-time activity check
        if (ONE_TIME_ACTIVITIES.has(activity_type)) {
          const already = await env.DB.prepare(
            'SELECT id FROM airdrop_activities WHERE wallet = ? AND activity_type = ?'
          ).bind(wallet, activity_type).first();
          if (already) {
            return jsonResponse({ status: 'already_credited', activity_type, points_awarded: 0 }, 200, corsOrigin);
          }
        }

        // Daily cap for app_session (5 per day)
        if (activity_type === 'app_session') {
          const today = new Date().toISOString().slice(0, 10);
          const todayCount = await env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM airdrop_activities WHERE wallet = ? AND activity_type = 'app_session' AND created_at >= ?"
          ).bind(wallet, today).first();
          if (todayCount?.cnt >= 5) {
            return jsonResponse({ status: 'daily_cap_reached', activity_type, points_awarded: 0 }, 200, corsOrigin);
          }
        }

        const points = POINTS[activity_type];
        await env.DB.prepare(
          'INSERT INTO airdrop_activities (wallet, activity_type, points, metadata) VALUES (?, ?, ?, ?)'
        ).bind(wallet, activity_type, points, metadata ? JSON.stringify(metadata) : null).run();

        const total = await env.DB.prepare(
          'SELECT SUM(points) as total FROM airdrop_activities WHERE wallet = ?'
        ).bind(wallet).first();

        return jsonResponse({
          status: 'credited',
          activity_type,
          points_awarded: points,
          total_points: total?.total || 0,
        }, 200, corsOrigin);

      } catch (e) {
        return jsonResponse({ error: 'Server error', detail: e.message }, 500, corsOrigin);
      }
    }

    // ── AIRDROP: STATUS (user dashboard) ──────────────────────────
    if (request.method === 'GET' && url.pathname === '/airdrop/status') {
      const wallet = url.searchParams.get('wallet');
      const solanaBase58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (!wallet || !solanaBase58Regex.test(wallet)) {
        return jsonResponse({ error: 'Valid ?wallet= required.' }, 400, corsOrigin);
      }

      try {
        const user = await env.DB.prepare(
          'SELECT wallet, twitter, email, ref_code, created_at FROM founding_shields WHERE wallet = ?'
        ).bind(wallet).first();
        if (!user) return jsonResponse({ registered: false }, 200, corsOrigin);

        const activities = await env.DB.prepare(
          'SELECT activity_type, SUM(points) as pts, COUNT(*) as cnt FROM airdrop_activities WHERE wallet = ? GROUP BY activity_type'
        ).bind(wallet).all();

        const totalPts = await env.DB.prepare(
          'SELECT SUM(points) as total FROM airdrop_activities WHERE wallet = ?'
        ).bind(wallet).first();

        const rank = await env.DB.prepare(
          `SELECT COUNT(*) + 1 as rank FROM (
            SELECT wallet, SUM(points) as pts FROM airdrop_activities GROUP BY wallet
          ) WHERE pts > (SELECT COALESCE(SUM(points),0) FROM airdrop_activities WHERE wallet = ?)`
        ).bind(wallet).first();

        return jsonResponse({
          registered: true,
          wallet: user.wallet,
          twitter: user.twitter,
          ref_code: user.ref_code,
          joined: user.created_at,
          total_points: totalPts?.total || 0,
          rank: rank?.rank || 1,
          activities: activities.results || [],
          completed_tasks: (activities.results || []).map(a => a.activity_type),
        }, 200, corsOrigin);

      } catch (e) {
        return jsonResponse({ error: 'Server error', detail: e.message }, 500, corsOrigin);
      }
    }

    // ── AIRDROP: LEADERBOARD (public top 50) ──────────────────────
    if (request.method === 'GET' && url.pathname === '/airdrop/leaderboard') {
      try {
        const leaders = await env.DB.prepare(
          `SELECT aa.wallet, fs.twitter, SUM(aa.points) as total_points, COUNT(aa.id) as activity_count
           FROM airdrop_activities aa
           LEFT JOIN founding_shields fs ON aa.wallet = fs.wallet
           GROUP BY aa.wallet
           ORDER BY total_points DESC
           LIMIT 50`
        ).all();

        const totalUsers = await env.DB.prepare(
          'SELECT COUNT(DISTINCT wallet) as cnt FROM airdrop_activities'
        ).first();

        return jsonResponse({
          leaderboard: leaders.results || [],
          total_participants: totalUsers?.cnt || 0,
        }, 200, corsOrigin);

      } catch (e) {
        return jsonResponse({ error: 'Server error', detail: e.message }, 500, corsOrigin);
      }
    }

    // ── AIRDROP: ADMIN VIEW (protected) ───────────────────────────
    if (request.method === 'GET' && url.pathname === '/airdrop/admin') {
      const adminKey = url.searchParams.get('key');
      const validKey = env.ADMIN_KEY || ADMIN_KEY_DEFAULT;
      if (adminKey !== validKey) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsOrigin);
      }

      try {
        const users = await env.DB.prepare(
          `SELECT fs.wallet, fs.twitter, fs.email, fs.ref_code, fs.created_at,
                  COALESCE(SUM(aa.points), 0) as total_points,
                  COALESCE(COUNT(aa.id), 0) as activity_count
           FROM founding_shields fs
           LEFT JOIN airdrop_activities aa ON fs.wallet = aa.wallet
           GROUP BY fs.wallet
           ORDER BY total_points DESC`
        ).all();

        const activityBreakdown = await env.DB.prepare(
          `SELECT activity_type, COUNT(*) as cnt, SUM(points) as pts
           FROM airdrop_activities GROUP BY activity_type ORDER BY cnt DESC`
        ).all();

        const totalStats = await env.DB.prepare(
          `SELECT COUNT(DISTINCT wallet) as total_wallets,
                  SUM(points) as total_points_issued,
                  COUNT(*) as total_activities
           FROM airdrop_activities`
        ).first();

        const registrations = await env.DB.prepare(
          'SELECT COUNT(*) as cnt FROM founding_shields'
        ).first();

        return jsonResponse({
          stats: {
            total_registered: registrations?.cnt || 0,
            total_active: totalStats?.total_wallets || 0,
            total_points_issued: totalStats?.total_points_issued || 0,
            total_activities: totalStats?.total_activities || 0,
          },
          activity_breakdown: activityBreakdown.results || [],
          users: users.results || [],
        }, 200, corsOrigin);

      } catch (e) {
        return jsonResponse({ error: 'Server error', detail: e.message }, 500, corsOrigin);
      }
    }

    // ── LEGAL GUIDANCE PROXY ──────────────────────────────────────
    if (request.method !== 'POST' || url.pathname !== '/legal-guidance') {
      return jsonResponse({ error: 'Not found' }, 404, corsOrigin);
    }

    const allowed = await checkRateLimit(clientIP, env);
    if (!allowed) return jsonResponse({ error: 'Rate limit exceeded.' }, 429, corsOrigin);

    let body;
    try { body = await request.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsOrigin);
    }

    const { officerStatement, state, situation } = body;
    if (!state || typeof state !== 'string') {
      return jsonResponse({ error: 'Missing required field: state' }, 400, corsOrigin);
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return jsonResponse({
        guidance: 'You have the right to remain silent. Do not consent to searches. Ask for a lawyer.',
        citedLaws: ['5th Amendment', '4th Amendment', '6th Amendment'],
        state, fallback: true,
      }, 200, corsOrigin);
    }

    const systemPrompt = `You are Alibi — a real-time AI civil rights legal advisor for drivers in ${state}.
Provide clear, calm, legally accurate guidance during police encounters.
Always cite the specific constitutional amendment or landmark case.
Keep responses SHORT and DIRECT — this person is in a live police stop.
Never advise illegal behavior. Prioritize safety first, rights second.
Format response as exactly two labeled sections:
[GUIDANCE]
Your clear, actionable guidance here.

[LAWS]
- Amendment or case 1
- Amendment or case 2`;

    const userContent = officerStatement
      ? `Officer said: "${officerStatement}". Situation: ${situation || 'traffic stop'}. State: ${state}. What should I say and what are my rights?`
      : `I am in a police encounter in ${state}. Situation: ${situation || 'traffic stop'}. What are my rights and what should I say?`;

    try {
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!claudeResponse.ok) throw new Error(`Claude API returned ${claudeResponse.status}`);

      const claudeData = await claudeResponse.json();
      const rawText = claudeData.content?.[0]?.text || '';
      const guidanceMatch = rawText.match(/\[GUIDANCE\]\s*([\s\S]*?)(?:\[LAWS\]|$)/);
      const lawsMatch = rawText.match(/\[LAWS\]\s*([\s\S]*?)$/);
      const guidance = guidanceMatch ? guidanceMatch[1].trim() : rawText.trim();
      const lawsRaw = lawsMatch ? lawsMatch[1].trim() : '';
      const citedLaws = lawsRaw.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(l => l.length > 0);

      return jsonResponse({ guidance, citedLaws, state, fallback: false, model: 'claude-haiku-4-5' }, 200, corsOrigin);

    } catch (error) {
      return jsonResponse({
        guidance: 'You have the right to remain silent. Do not consent to searches. Ask: "Am I being detained or am I free to go?"',
        citedLaws: ['5th Amendment', '4th Amendment', 'Rodriguez v. US (2015)'],
        state, fallback: true,
      }, 200, corsOrigin);
    }
  },
};

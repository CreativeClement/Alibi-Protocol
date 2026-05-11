# ALIBI PROTOCOL — DISCORD SERVER SETUP GUIDE
*Complete blueprint. Follow in order. Takes ~45 minutes.*

---

## STEP 1 — CREATE THE SERVER

1. Open Discord → click **+** (Add a Server) → **Create My Own** → **For a club or community**
2. Server name: **Alibi Protocol**
3. Upload the shield logo as the server icon
4. Set region to Auto

---

## STEP 2 — CATEGORIES & CHANNELS

Create these categories in order. Each category has exact channel names.

### 📡 PROTOCOL HQ
| Channel | Type | Topic |
|---|---|---|
| `#welcome` | Text | Auto-role entry point. Pin the onboarding message here. |
| `#announcements` | Text | Announcements only. Bot + admin post here. |
| `#rules` | Text | Community rules. Lock to read-only. |
| `#roadmap` | Text | Public roadmap updates. |

### 🛡️ SHIELD NETWORK
| Channel | Type | Topic |
|---|---|---|
| `#verify-wallet` | Text | Use `/verify` here to link your Solana wallet. |
| `#shield-stats` | Text | Use `/stats` and `/leaderboard` here. |
| `#tier-upgrades` | Text | Bot auto-posts tier promotions here. Set TIER_CHANNEL_ID to this. |
| `#leaderboard` | Text | Daily digest auto-posts here at 9AM UTC. Set LEADERBOARD_CHANNEL_ID. |

### 💰 SEED PHASE
| Channel | Type | Topic |
|---|---|---|
| `#seed-phase-info` | Text | READ ONLY. Pinned staking explainer + multiplier table. |
| `#staking-chat` | Text | General staking discussion. |
| `#seed-winners` | Text | Bot auto-announces confirmed seed stakers with their multiplier tier. |

### 🗺️ NAVIGATION NETWORK (DePIN)
| Channel | Type | Topic |
|---|---|---|
| `#earn-while-you-drive` | Text | How the DePIN earn loop works. Pinned FAQ. |
| `#hazard-reports` | Text | Community shares live hazards. |
| `#depin-strategy` | Text | Route optimization, earnings discussion. |

### ⚖️ RIGHTS & LEGAL
| Channel | Type | Topic |
|---|---|---|
| `#know-your-rights` | Text | State-by-state rights guides. Pinned resources. |
| `#encounter-stories` | Text | Members share (safely anonymized) real encounter outcomes. |
| `#legal-resources` | Text | Links to ACLU state chapters, NLG, legal aid. |

### 💬 COMMUNITY
| Channel | Type | Topic |
|---|---|---|
| `#general` | Text | Open discussion. |
| `#alpha-chat` | Text | Signal-to-noise only. Locked to SENTINEL+ tier. |
| `#media-kit` | Text | Logos, banners, share assets. Read-only. |
| `#showcase` | Text | Members share dashcam clips, evidence vault screenshots. |

### 🔊 VOICE
| Channel | Type | Topic |
|---|---|---|
| `📡 Operations Room` | Voice | General VC |
| `🛡️ Guardian Lounge` | Voice | GUARDIAN+ only |
| `👁️ Operator Briefing` | Voice | OPERATOR only |

---

## STEP 3 — ROLES

Create these roles in order (highest = top). Colors match the Alibi brand palette.

| Role | Color | How Assigned | Perks |
|---|---|---|---|
| `ARCHITECT_0x01` | `#FF3B30` Red | Manual (founder only) | All channels |
| `OPERATOR` | `#FF9F0A` Amber | Bot — 50,000+ SP | `#alpha-chat`, Operator VC |
| `GUARDIAN` | `#00FF88` Green | Bot — 15,000+ SP | `#alpha-chat`, Guardian VC |
| `SENTINEL` | `#00E5FF` Cyan | Bot — 5,000+ SP | `#alpha-chat` |
| `NAVIGATOR` | `#4A90E2` Blue | Bot — 500+ SP | Standard |
| `RECRUIT` | `#8B949E` Gray | Auto on join | Standard |
| `SEED STAKER 🔒` | `#FFD700` Gold | Bot — verified stake | `#seed-winners` badge |
| `MYTHICAL STAKER` | `#FF3B30` Red | Bot — 50K+ staked | Exclusive channel (future) |

**Role permissions matrix:**
- `#alpha-chat` → SENTINEL, GUARDIAN, OPERATOR, ARCHITECT only
- `#seed-winners` post → SEED STAKER badge required to post
- `Guardian Lounge` VC → GUARDIAN+
- `Operator Briefing` VC → OPERATOR only

---

## STEP 4 — CREATE THE BOT

1. Go to https://discord.com/developers/applications → **New Application**
2. Name: **Alibi Protocol** — upload shield logo
3. Left sidebar → **Bot** → **Add Bot**
4. Copy the **Bot Token** (save it — you'll need it for Worker secrets)
5. Under **Privileged Gateway Intents**: enable **Server Members Intent** and **Message Content Intent**
6. Left sidebar → **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`, `Manage Roles`
7. Copy the generated URL → open it → invite bot to your server
8. Left sidebar → **General Information** → copy **Application ID** (this is DISCORD_APP_ID)

---

## STEP 5 — DEPLOY THE WORKER BOT

### Create the D1 database
```bash
wrangler d1 create alibi-discord
# Copy the database_id from output
```

### Run the schema migration
```bash
wrangler d1 execute alibi-discord --file=discord-d1-schema.sql
```

### Add to wrangler.toml (create new entry or add to existing)
```toml
[[d1_databases]]
binding     = "DB"
database_name = "alibi-discord"
database_id   = "YOUR_DATABASE_ID_HERE"

[triggers]
crons = ["0 9 * * *", "0 * * * *"]
# First cron  = daily leaderboard at 9AM UTC
# Second cron = hourly tier scan
```

### Set Worker secrets
```bash
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_APP_ID
wrangler secret put LEADERBOARD_CHANNEL_ID
wrangler secret put TIER_CHANNEL_ID
```

### Deploy
```bash
# In Cloudflare dashboard: Paste discord-worker.js as a new Worker
# Name it: alibi-discord-bot
# Bind the D1 database in Settings → Bindings
```

### Register slash commands (one-time)
After deploying, visit:
```
https://alibi-discord-bot.YOUR_SUBDOMAIN.workers.dev/setup
```
This fires `registerCommands()` and registers all 7 slash commands globally.

---

## STEP 6 — WIRE UP THE INTERACTIONS ENDPOINT

1. Go to your Discord Developer Application → **General Information**
2. Set **Interactions Endpoint URL** to:
   ```
   https://alibi-discord-bot.YOUR_SUBDOMAIN.workers.dev/
   ```
3. Discord will ping it with a verification request. The Worker handles it automatically (type: 1 PING → type: 1 PONG).

---

## STEP 7 — PIN THE SEED PHASE ANNOUNCEMENT

Post this to `#seed-phase-info` and pin it:

```
🔒 SEED PHASE — LOCK IN YOUR LAUNCH-DAY MULTIPLIER

The snapshot is coming. When it fires, every $ALIBI token you've earned 
through the drive-to-earn network gets multiplied — but ONLY if you've 
staked your seed phase tokens before the snapshot hits.

MULTIPLIER TIERS:
  1–999 ALIBI staked      → 1.25× launch-day boost  [UNCOMMON]
  1,000–9,999 staked      → 1.50× launch-day boost  [RARE]
  10,000–49,999 staked    → 2.00× launch-day boost  [LEGENDARY]
  50,000+ staked          → 2.50× launch-day boost  [MYTHICAL]

The snapshot fires at a random time. You will NOT get advance notice.
Multipliers lock at stake time — they do not change retroactively.
Every dollar committed in the seed phase is a force multiplier on everything 
you've earned by driving. Miss this window and you leave real $ALIBI on the table.

→ Connect your wallet: /verify
→ Check your position: /package
→ See who's staked: #seed-winners

ALIBI PROTOCOL — Before. During. After.
```

---

## STEP 8 — ONBOARDING MESSAGE FOR #welcome

Set up a bot welcome message using Discord's AutoMod or a welcome webhook:

```
🛡️ Welcome to Alibi Protocol.

This is the command center for the world's first civil rights protection 
network for drivers. You earn $ALIBI for driving. You protect your rights 
with every mile.

GET STARTED:
1. Read #rules
2. Link your wallet: /verify in #verify-wallet  
3. Download the app: alibiprotocol.com
4. Check your tier: /stats
5. See the seed phase: #seed-phase-info

The snapshot fires without warning. Navigate. Stack points. Stake early.
```

---

## STEP 9 — WRANGLER.TOML ENVIRONMENT VARIABLES REFERENCE

All values to set as Worker secrets (never in code):

| Secret Name | Where to Get It |
|---|---|
| `DISCORD_BOT_TOKEN` | Discord Dev Portal → Bot → Token |
| `DISCORD_PUBLIC_KEY` | Discord Dev Portal → General Info → Public Key |
| `DISCORD_APP_ID` | Discord Dev Portal → General Info → Application ID |
| `LEADERBOARD_CHANNEL_ID` | Right-click `#leaderboard` → Copy Channel ID |
| `TIER_CHANNEL_ID` | Right-click `#tier-upgrades` → Copy Channel ID |

To enable Channel IDs in Discord: User Settings → Advanced → Developer Mode ✓

---

*Bot is fully serverless. Zero hosting fees. Scales to any community size.*
*Total deploy time: ~45 minutes from zero.*

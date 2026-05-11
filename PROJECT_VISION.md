# ALIBI PROTOCOL — COMPLETE PROJECT VISION & SESSION LOG
# Last Updated: April 5, 2026
# This document preserves ALL decisions, context, and roadmap from the build session

---

## THE FULL PRODUCT VISION

Alibi Protocol is NOT just a navigation app. It is a **continuous evidence machine** with **driver safety superpowers**:

### Core Product Tabs:
1. **NAVIGATE** — Turn-by-turn nav (Valhalla routing), voice guidance, speed display, hazard reports, DePIN earning
2. **DASHCAM** — Always-on front camera recording, 5-7 minute rolling buffer. If pulled over, auto-saves the last 5-7 mins of driving footage. Officer says you were swerving? Video proves otherwise. Says you were speeding? GPS data shows exact speed at every second.
3. **RIDESHARE MODE** — For Uber/Lyft/taxi drivers. Interior cab recording. 3-word secret panic phrase that silently calls 911 with location + starts recording interior. Protects drivers from false accusations by passengers.
4. **VAULT** — All evidence entries with SHA-256 hashes, blockchain anchoring on Solana, timestamps, location data
5. **WALLET** — $ALIBI earnings, Phantom wallet connect, daily/lifetime stats
6. **SETTINGS** — Map brightness, voice volume, voice selection (5 options), vehicle icon picker, notification toggles, set panic phrase

### Future Features:
- **Reputation Cleanup** — Tools to remove mugshots from predatory websites after false arrests or dismissed charges
- **Mugshot Removal** — Automated service to scrub mugshot sites
- **Premium Tier ($4.99/mo)** — Extended vault storage, priority AI legal guidance, advanced dashcam features

---

## WHO IT'S FOR

ALL drivers. Not targeted at any specific demographic. The product protects:
- Rideshare drivers (Uber, Lyft, DoorDash)
- Taxi drivers
- Everyday commuters
- Fleet drivers
- Anyone who wants navigation + safety + crypto rewards

The messaging is: "Alibi Protocol protects ALL drivers" — neutral, universal, legally safe.

---

## THE TOKEN — $ALIBI

- Solana SPL token
- 1 billion total supply
- Earned by driving and reporting hazards (DePIN model)
- Revenue split: 55% stakers / 25% treasury / 10% burn / 10% growth fund
- Burn: 10% base, governance-adjustable to 20%
- Burn acceleration: 10K users → 12%, 50K → 15%, 100K → 18%
- NOT positioned as investment — utility token for evidence vaulting and driver rewards
- Token metadata at: assets/metadata.json (shield logo, proper attributes)

---

## KEY FEATURES — WHAT MAKES THIS DIFFERENT

1. **Waze navigates. Alibi navigates AND protects your rights.**
2. **Dashcams record forward only. Alibi records forward AND has interior cab mode for rideshare.**
3. **No other app has a secret panic phrase that calls 911 while recording.**
4. **No other nav app pays you crypto for driving and reporting hazards.**
5. **Evidence is SHA-256 hashed and anchored on Solana — immutable chain of custody.**
6. **AI legal guidance (Claude API) gives real-time constitutional rights advice.**

---

## DESIGN & BRANDING

- **Shield logo** = THE brand mark. Goes on EVERYTHING.
- **Colors:** #0A0A0C dark, #00E5FF cyan, #00FF88 green, #FF9F0A amber, #FF3B30 red
- **Fonts:** JetBrains Mono (headings, status), Inter (body)
- **Aesthetic:** Dark terminal/military/classified — premium, serious, trustworthy
- **Status labels:** ALL CAPS — SEALED, VAULTED, ANCHORED, PENDING
- **NOT memecoin energy.** Professional protocol energy.

---

## FOUNDER IDENTITY

- Pseudonymous: "Anonymous Core Team" / "ARCHITECT_0x01"
- NO personal name, email, username in any deployed code
- Git config: "Alibi Protocol" / "dev@alibiprotocol.com"
- GitHub: Str8-Profits (has old commits with real name — consider fresh repo)
- Old commits have real name in git history — fresh repo recommended

---

## WHAT'S BEEN COMPLETED (April 5, 2026)

### Landing Page (index.html ~564 lines):
- Simplified from 1,928 lines
- Shield logo, proper SEO, JSON-LD Organization schema
- TRY THE APP button linking to web demo
- Founding Shield CTA
- PROTOCOL LIVE state
- No fake data, no personal info

### Web App (alibi-protocol-app.html ~600+ lines):
- Real Valhalla routing with turn-by-turn voice
- 5 voice profiles (Dispatcher, Standard F/M, Young F/M)
- Car avatar on map with heading rotation
- 8 hazard report types with earn rewards
- PULLED OVER emergency with rights display + evidence hash
- Settings tab (brightness, volume, voice, vehicle, notifications)
- Shield logo top center
- Beta watermark
- OSM tiles with dark filter (Carto was down)

### Sub-Pages:
- tokenomics.html — Tiered burns, growth fund, 4 revenue streams
- pitchdeck.html — 11 slides
- whitepaper.html — 12 sections with sidebar TOC
- privacy.html, terms.html, disclaimer.html — All exist

### Mobile App (Mobile_App/App.js ~1,918 lines):
- Real expo-camera + expo-av recording
- Claude API legal guidance with fallback
- Solana memo TX vaulting via Phantom deep-link
- react-native-maps with dark theme
- AsyncStorage persistence
- DePIN earn loop with GPS verification
- UNTESTED on real device

### Token Scripts:
- alibi_token_mint.js — Mainnet-ready, --revoke-authority, --dry-run, balance checks
- alibi_brand_token.js — Mainnet-ready, requires ALIBI_MINT_ADDRESS env
- Both use env vars only, no hardcoded keys

### Branding:
- Shield logo on ALL 7 HTML pages (og:image, twitter:image)
- JSON-LD Organization schema with shield logo
- manifest.json with shield logo
- Token metadata.json with shield logo + proper attributes
- Brand guidelines document created (Alibi_Protocol_Brand_Guidelines.md)

### Security:
- Zero personal info in codebase (confirmed via search)
- All backup files deleted
- Internal docs with personal info deleted
- Git config set to anonymous
- CSP headers fixed for MapLibre

---

## WHAT'S LEFT TO DO

### CRITICAL (before any public launch):
1. Upload metadata + logo to IPFS/Arweave (or keep on Vercel for now)
2. Mint token on mainnet (dry-run first)
3. Revoke mint authority after genesis
4. Verify token on Solscan/Birdeye
5. Create liquidity pool (Raydium/Orca)
6. Fresh GitHub repo (fully anonymous history)

### APP — NEW FEATURES TO BUILD:
7. DASHCAM MODE — Always-on front camera, 5-7 min rolling buffer, auto-save on emergency
8. RIDESHARE MODE — Interior cab recording, 3-word panic phrase → auto 911 + location
9. Continuous GPS/speed data logging for dispute defense
10. Better map tiles (MapTiler free vector dark style when Carto is back)
11. Real audio/video recording in web app (MediaRecorder API)
12. Claude API integration with real key for live legal guidance

### MARKETING & GROWTH:
13. Airdrop campaign design (task-based: try app → report hazard → earn)
14. Twitter/X account creation and content strategy
15. Discord server
16. Landing page — add app screenshots, "How It Works" animation
17. Blog/content marketing for SEO

### POLISH:
18. Offline mode (cache routes, store vault entries offline)
19. Accessibility (ARIA labels, high contrast, font size)
20. Native mobile app device testing
21. App Store / Google Play submission prep

---

## VOICE OPTIONS IN APP
1. DISPATCHER — Professional radio operator. Clear and direct. Deep male.
2. STANDARD FEMALE — Classic GPS voice. Smooth and reliable.
3. STANDARD MALE — Classic GPS voice. Calm and steady.
4. YOUNG FEMALE — Friendly and upbeat. Co-pilot energy.
5. YOUNG MALE — Chill and confident. Ride along energy.

## HAZARD REPORT TYPES
1. Police (earn 0.50 $ALIBI)
2. Speed Camera
3. Flock/ALPR Camera
4. Accident
5. Construction
6. Vehicle on Shoulder
7. Pothole
8. Road Debris

## VEHICLE ICONS
Arrow (default), Car, SUV, Truck, Motorcycle, Van, Taxi, Patrol

---

## TECHNICAL STACK
- Frontend: Vanilla HTML/CSS/JS (web app), React Native/Expo (mobile)
- Map: MapLibre GL + OSM/Carto tiles
- Routing: Valhalla (OpenStreetMap.de hosted)
- Search: Nominatim (OpenStreetMap geocoding)
- Voice: Browser Speech Synthesis API
- Blockchain: Solana (web3.js, Memo Program, Phantom deep-link)
- AI: Claude API (claude-sonnet-4-20250514)
- Hosting: Vercel (auto-deploy from GitHub)
- Domain: alibiprotocol.com
- DNS: Cloudflare

---

## IMPORTANT URLS
- Live site: https://alibiprotocol.com
- Web app: https://alibiprotocol.com/alibi-protocol-app
- GitHub: https://github.com/Str8-Profits/Alibi-Protocol
- Vercel: https://vercel.com/clement-creates/alibi-protocol

---

*This document is the source of truth for the next build session. Read this first.*

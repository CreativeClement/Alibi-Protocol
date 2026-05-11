# Alibi Protocol

**I built this because I lived it.**

Profiled. Pulled over. Searched on nothing. Cuffed before I understood what was happening. The mugshot goes up, the name travels, the career bleeds out — and nobody comes back later to clean the mess up if the charge was bullshit.

So I built the weapon civilians have been missing: an app that's **already recording before the cop says a word.**

This repo is the thing. The landing page, the PWA, the workers, the assets, the legal. Everything that ships when someone types `alibiprotocol.com` into their browser or adds the app to their home screen.

---

## What's in here

```
index.html              The landing page you see at alibiprotocol.com
privacy.html            The privacy policy. Written like a human.
terms.html              The terms. Same.
favicon.svg             Plus the PNG fallbacks and the Apple touch icon.
og-image.png            1200×630 social card. Voice-matched to the landing.
sitemap.xml / robots.txt
vercel.json             Landing page deploy config.

workers/
  alibi-app-final.html      The PWA. The actual app. One HTML file, every screen.
  alibi-protocol-worker.js  Cloudflare Worker that serves the PWA with correct headers.
  alibi-api-worker.js       Proxy for Claude (in-app rights coach) + waitlist capture.
  wrangler-app.toml         Config reference for alibi-protocol worker.
  wrangler-api.toml         Config reference for alibi-api worker.
```

---

## How it works, in one breath

**BEFORE.** The app pays you to drive. Waze-style nav with `$ALIBI` drive-to-earn. That solves the cold-start problem — the app has to already be running before the encounter starts. Paying users to navigate is how you get there.

**DURING.** One tap and Legal Shield is on. Back camera records the road, front camera records the cabin, mic picks up audio, GPS logs speed and heading. There's a 5-minute rolling buffer on the device so the moment before you saw the lights is already on tape. An AI rights coach pulls your state's rules in real time. A detention timer runs. Everything hashes with SHA-256.

**AFTER.** You leave the stop with a signed, time-stamped, location-stamped evidence package. Hand it to a real lawyer. Get it on record. Watch for your mugshot showing up on trash sites and start the removal process. Cops fear lawsuits. This is the lawsuit file, pre-built.

---

## $ALIBI

Solana SPL. 1,000,000,000 fixed supply. Mint authority revoked on-chain. No freeze authority. I can't print more. I can't freeze your wallet. It's a utility token — earn it by driving, spend it on premium features, cash out on the market once trading opens.

**Not a security.** No staking theater, no DAO governance cosplay, no promised returns.

```
396ypp7wKqVry36RhHcC8dLAxTWTg9juatoRFwnyzzRq
```

[Solscan →](https://solscan.io/token/396ypp7wKqVry36RhHcC8dLAxTWTg9juatoRFwnyzzRq)

---

## Stack

- **Maps:** MapLibre GL JS + OpenFreeMap dark vector tiles.
- **Routing:** Valhalla first, OSRM fallback, straight-line if both die.
- **Recording:** MediaRecorder, 1-second chunks, 5-minute rolling window. Audio + dashcam video + GPS track snapshot.
- **Evidence:** Web Crypto SHA-256 hashing in the browser before anything moves.
- **Runtime:** Single HTML file, Cloudflare Worker.
- **Landing:** Static HTML/CSS/JS. GSAP + ScrollTrigger. Three.js r128 for the hero particles.
- **Waitlist:** Formspree → D1 backup (`alibi-waitlist`).
- **Chain:** Solana mainnet SPL.

---

## Deploy

**Landing page.** Push to `main` on `Str8-Profits/Alibi-Protocol`. Vercel auto-deploys. Done.

**App worker.** Edit `workers/alibi-app-final.html` and `workers/alibi-protocol-worker.js`. Paste into the Cloudflare dashboard — Workers & Pages → `alibi-protocol` → Quick Edit → Save and Deploy. `wrangler publish` is referenced in `workers/wrangler-ap
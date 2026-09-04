# Alibi Protocol

The navigation app that is already recording before the stop. Drive-to-earn `$ALIBI`, one-tap Legal Shield, on-device SHA-256 evidence vault.

Live site: [alibiprotocol.com](https://www.alibiprotocol.com/)  
App: [alibiprotocol.com/app](https://www.alibiprotocol.com/app)

---

## Launch surface (Vercel)

```
index.html          Landing (original)
alibi.html          Product app — served at /app
privacy.html        Privacy
terms.html          Terms
disclaimer.html     Disclaimer
contact.html        Contact
transparency.html   On-chain / process notes
404.html            Not-found
vercel.json         Rewrites: /app → /alibi, token supply JSON, API proxy
```

`app.html` is the editable source for the product. Copy it to `alibi.html` before deploy. Vercel ignores `app.html` because `cleanUrls` would map it onto the reserved `/app` path and 404.

---

## How the product works

**Drive.** Leaflet + OpenStreetMap. Search via Nominatim. Routes via OSRM. START DASHCAM keeps a rolling on-device buffer. SHIELD starts Legal Shield.

**Vault.** Recordings and SHA-256 hashes stay in the browser. PACKAGE exports a JSON evidence file. Nothing is uploaded unless the user exports it.

**After.** State recording-law reference, rights scripts, ACLU / NPAP / NAACP links.

**Wallet.** Session earnings and a locally saved Solana address. Not a live on-chain claim.

---

## $ALIBI

Solana SPL. Contract:

`396ypp7wKqVry36RhHcC8dLAxTWTg9juatoRFwnyzzRq`

[Solscan](https://solscan.io/token/396ypp7wKqVry36RhHcC8dLAxTWTg9juatoRFwnyzzRq)

Utility token. Session earnings in the web app are tracked on-device until a claim service is live.

---

## Deploy

**Website + app.** Merge to `main`. Vercel production deploy. Confirm:

- `https://www.alibiprotocol.com/` — landing
- `https://www.alibiprotocol.com/app` — legal gate, then Drive
- `https://www.alibiprotocol.com/api/total-supply` — JSON

**API worker (optional for launch).** `alibi-api-worker.js` proxies legal guidance and Founding Shield. Deploy with Wrangler to the hostname in `vercel.json`. Set `ANTHROPIC_API_KEY` and `ADMIN_KEY` as secrets. Bind D1. The app already falls back to on-device rights scripts if this worker is down.

**Native app.** `mobile/` is Expo. Store submit still needs Apple / Play IDs in `eas.json`.

---

## Native / workers (not on Vercel)

`mobile/` — Expo client  
`worker/` — Cloudflare HTML embeds for an alternate host  
`alibi-api-worker.js` — API worker source

// build_v14.mjs
//   - App: FINAL VERSION OF $ALIBI APP 4-7-26 (user's definitive app)
//   - Landing: alibi-repo-deploy/index.html (full 2153-line version w/ BDA section)
//   - Styles: alibi-repo-deploy/styles.css (full styles w/ BDA + nav-visited fix)
import { readFileSync, writeFileSync } from 'fs';

const ALIBI_NEW  = 'C:\\Users\\GotHi\\ALIBI NEW';
const REPO       = 'C:\\Users\\GotHi\\alibi-repo-deploy';

const appHtml    = readFileSync(ALIBI_NEW + '\\alibi-app-final.html',  'utf8');
const landingHtml= readFileSync(REPO      + '\\index.html',            'utf8');
const stylesCSS  = readFileSync(REPO      + '\\styles.css',            'utf8');
let   workerBase = readFileSync(ALIBI_NEW + '\\alibi-protocol-worker-v11-sec.js', 'utf8');

console.log('Assets:');
console.log(`  App:     ${appHtml.length.toLocaleString()} chars | dashcam: ${appHtml.includes('dashcam')} | rideshare: ${appHtml.includes('rideshare')}`);
console.log(`  Landing: ${landingHtml.length.toLocaleString()} chars | BDA: ${landingHtml.includes('safety-lifecycle')} | no airdrop nav: ${!landingHtml.includes('/airdrop" style="color:#00FF88')}`);
console.log(`  Styles:  ${stylesCSS.length.toLocaleString()} chars | bda-phase: ${stylesCSS.includes('bda-phase')}`);

const appB64     = Buffer.from(appHtml,     'utf8').toString('base64');
const landingB64 = Buffer.from(landingHtml, 'utf8').toString('base64');
const stylesB64  = Buffer.from(stylesCSS,   'utf8').toString('base64');

const APP_RE     = /(const APP_B64 = ")[^"]*(";\s*\r?\n)/;
const LANDING_RE = /(const LANDING_B64 = ")[^"]*(";\s*\r?\n)/;
const STYLES_RE  = /(const STYLES_B64 = ")[^"]*(";\s*\r?\n)/;

if (!APP_RE.test(workerBase))     { console.error('APP_B64 not found');     process.exit(1); }
if (!LANDING_RE.test(workerBase)) { console.error('LANDING_B64 not found'); process.exit(1); }
if (!STYLES_RE.test(workerBase))  { console.error('STYLES_B64 not found');  process.exit(1); }

workerBase = workerBase.replace(APP_RE,     `$1${appB64}$2`);
workerBase = workerBase.replace(LANDING_RE, `$1${landingB64}$2`);
workerBase = workerBase.replace(STYLES_RE,  `$1${stylesB64}$2`);

console.log(`\nv14 size: ${workerBase.length.toLocaleString()} chars`);
writeFileSync(ALIBI_NEW + '\\alibi-protocol-worker-v14.js', workerBase, 'utf8');
console.log('Wrote alibi-protocol-worker-v14.js');

// Verify
const vApp  = Buffer.from(workerBase.match(/const APP_B64 = "([^"]+)"/)[1],     'base64').toString('utf8');
const vLand = Buffer.from(workerBase.match(/const LANDING_B64 = "([^"]+)"/)[1], 'base64').toString('utf8');
const vSty  = Buffer.from(workerBase.match(/const STYLES_B64 = "([^"]+)"/)[1],  'base64').toString('utf8');

console.log('\nVerification:');
console.log('  APP dashcam:',      vApp.includes('dashcam'));
console.log('  APP rideshare:',    vApp.includes('rideshare'));
console.log('  APP screen-nav:',   vApp.includes('screen-nav'));
console.log('  APP screen-after:', vApp.includes('screen-after'));
console.log('  LANDING BDA:',      vLand.includes('safety-lifecycle'));
console.log('  LANDING title:',    vLand.includes('Get Paid to Drive'));
console.log('  LANDING no airdrop nav:', !vLand.includes('/airdrop" style="color:#00FF88'));
console.log('  STYLES bda-phase:', vSty.includes('bda-phase'));
console.log('  WORKER no BOM:',    workerBase.charCodeAt(0) !== 0xFEFF);
console.log('\nRun run_deploy_v14.bat');

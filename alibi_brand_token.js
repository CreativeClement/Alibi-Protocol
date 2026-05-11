const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { createCreateMetadataAccountV3Instruction, PROGRAM_ID } = require('@metaplex-foundation/mpl-token-metadata');
const bs58 = require('bs58');

require('dotenv').config();

// ── CLI flags ──────────────────────────────────────────────────────────────────
const USE_DEVNET = process.argv.includes('--devnet');
const DRY_RUN    = process.argv.includes('--dry-run');

// ── Network config ─────────────────────────────────────────────────────────────
const NETWORK     = USE_DEVNET ? 'devnet' : 'mainnet-beta';
const DEFAULT_RPC = USE_DEVNET
    ? 'https://api.devnet.solana.com'
    : 'https://api.mainnet-beta.solana.com';
const RPC_URL         = process.env.SOLANA_RPC_URL || DEFAULT_RPC;
const MIN_BALANCE_SOL = 0.5;

// ── Env validation ─────────────────────────────────────────────────────────────
if (!process.env.ALIBI_MINT_ADDRESS) {
    console.error('❌  FATAL: ALIBI_MINT_ADDRESS environment variable is not set.');
    console.error('    Set it to the token mint address output by alibi_token_mint.js.');
    console.error('    Example: ALIBI_MINT_ADDRESS=ExRmXPt24nU7HnBGMGFcVDjEegnYgb34mDYu4qpUBDSy');
    process.exit(1);
}

// ── Key parsing — supports JSON byte array or base58 ─────────────────────────
function parseSecretKey(raw) {
    if (!raw) {
        console.error('❌  FATAL: FOUNDER_SECRET_KEY environment variable is not set.');
        console.error('    Provide a JSON byte array [1,2,...] or a base58-encoded private key.');
        process.exit(1);
    }
    const trimmed = raw.trim();
    try {
        if (trimmed.startsWith('[')) {
            return new Uint8Array(JSON.parse(trimmed));
        }
        return bs58.decode(trimmed);
    } catch (e) {
        console.error('❌  FATAL: Bad FOUNDER_SECRET_KEY format.');
        console.error('    Expected a JSON byte array [1,2,...] or a base58-encoded string.');
        console.error(`    Parse error: ${e.message}`);
        process.exit(1);
    }
}

// ── Retry with exponential backoff on 429 / 503 / timeout ────────────────────
async function withRetry(fn, label, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const retryable =
                err.message?.includes('429') ||
                err.message?.includes('503') ||
                err.message?.includes('timeout') ||
                err.message?.includes('ETIMEDOUT') ||
                err.message?.includes('ECONNRESET');
            if (retryable && attempt < maxAttempts) {
                const delay = Math.pow(2, attempt) * 1000; // 2 s, 4 s
                console.warn(`⚠️  ${label}: attempt ${attempt} failed (${err.message}). Retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
}

// ── 10-second mainnet warning countdown ───────────────────────────────────────
async function mainnetWarning(action, walletAddr, balanceSOL) {
    console.log('\n' + '═'.repeat(60));
    console.log('⚠️   MAINNET TRANSACTION — REAL FUNDS AT RISK');
    console.log('═'.repeat(60));
    console.log(`  Network : ${NETWORK}`);
    console.log(`  Wallet  : ${walletAddr}`);
    console.log(`  Balance : ${balanceSOL.toFixed(4)} SOL`);
    console.log(`  Action  : ${action}`);
    console.log('═'.repeat(60));
    for (let i = 10; i > 0; i--) {
        process.stdout.write(`\r  Proceeding in ${i}s... (Ctrl+C to abort) `);
        await new Promise(r => setTimeout(r, 1000));
    }
    process.stdout.write('\r  Proceeding...                              \n\n');
}

async function brandAlibiToken() {
    console.log('🛡️  ENGAGING METAPLEX BRANDING PROTOCOL...');
    console.log(`   Network : ${NETWORK}${DRY_RUN ? ' (DRY RUN — no transactions will be sent)' : ''}`);
    console.log(`   RPC     : ${RPC_URL}`);

    // Init wallet
    const founderWallet = Keypair.fromSecretKey(parseSecretKey(process.env.FOUNDER_SECRET_KEY));

    // Validate mint address
    let ALIBI_MINT_ADDRESS;
    try {
        ALIBI_MINT_ADDRESS = new PublicKey(process.env.ALIBI_MINT_ADDRESS);
    } catch (e) {
        console.error(`❌  FATAL: ALIBI_MINT_ADDRESS is not a valid Solana public key: "${process.env.ALIBI_MINT_ADDRESS}"`);
        process.exit(1);
    }

    const METADATA_URI = process.env.ALIBI_METADATA_URI || 'https://alibiprotocol.com/assets/metadata.json';

    const connection = new Connection(RPC_URL, 'finalized');

    // Balance check (≥ 0.5 SOL)
    let balanceLamports;
    try {
        balanceLamports = await withRetry(
            () => connection.getBalance(founderWallet.publicKey),
            'getBalance'
        );
    } catch (err) {
        if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
            console.error(`❌  RPC timeout connecting to ${RPC_URL}. Check SOLANA_RPC_URL or network.`);
        } else {
            console.error(`❌  Failed to fetch balance: ${err.message}`);
        }
        process.exit(1);
    }
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
    console.log(`\n🏛️  FOUNDER WALLET : ${founderWallet.publicKey.toBase58()}`);
    console.log(`💰  Wallet balance  : ${balanceSOL.toFixed(4)} SOL`);
    if (balanceSOL < MIN_BALANCE_SOL) {
        console.error(`❌  ABORT: Insufficient SOL balance (${balanceSOL.toFixed(4)} SOL). Minimum required: ${MIN_BALANCE_SOL} SOL.`);
        process.exit(1);
    }

    // Mainnet warning
    if (!USE_DEVNET && !DRY_RUN) {
        await mainnetWarning(
            'Attach Metaplex metadata (isMutable=false — irreversible)',
            founderWallet.publicKey.toBase58(),
            balanceSOL
        );
    }

    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            PROGRAM_ID.toBuffer(),
            ALIBI_MINT_ADDRESS.toBuffer(),
        ],
        PROGRAM_ID
    );

    console.log(`\n🔹 Token Address  : ${ALIBI_MINT_ADDRESS.toBase58()}`);
    console.log(`🔹 Metadata PDA   : ${metadataPDA.toBase58()}`);
    console.log(`🔹 Name           : ALIBI`);
    console.log(`🔹 Symbol         : $ALIBI`);
    console.log(`🔹 Metadata URI   : ${METADATA_URI}`);

    const tokenMetadata = {
        name:                 'ALIBI',
        symbol:               'ALIBI',
        uri:                  METADATA_URI,
        sellerFeeBasisPoints: 0,
        creators:             null,
        collection:           null,
        uses:                 null,
    };

    const createMetadataIx = createCreateMetadataAccountV3Instruction(
        {
            metadata:        metadataPDA,
            mint:            ALIBI_MINT_ADDRESS,
            mintAuthority:   founderWallet.publicKey,
            payer:           founderWallet.publicKey,
            updateAuthority: founderWallet.publicKey,
        },
        {
            createMetadataAccountArgsV3: {
                data:              tokenMetadata,
                isMutable:         false, // Permanently locks branding
                collectionDetails: null,
            },
        }
    );

    const tx = new Transaction().add(createMetadataIx);
    console.log('\n🔐 Locking Metaplex Ledger (This may take ~15 seconds)...');

    if (DRY_RUN) {
        console.log('[DRY RUN] Would send: createMetadataAccountV3 transaction');
        console.log('\n✅ DRY RUN complete — no transaction sent.');
        return;
    }

    try {
        const txid = await withRetry(
            () => sendAndConfirmTransaction(connection, tx, [founderWallet], { commitment: 'finalized' }),
            'createMetadata'
        );
        const clusterParam = USE_DEVNET ? '?cluster=devnet' : '';
        console.log(`\n✅ ALIBI OFFICIALLY BRANDED ON THE BLOCKCHAIN.`);
        console.log(`Solana Explorer: https://explorer.solana.com/tx/${txid}${clusterParam}`);
    } catch (err) {
        if (err.message?.includes('insufficient') || err.message?.includes('0x1')) {
            console.error('❌  Branding failed: Insufficient SOL for transaction fees.');
        } else if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
            console.error(`❌  Branding failed: RPC timeout. Check SOLANA_RPC_URL (${RPC_URL}).`);
        } else {
            console.error('❌  Branding failed:', err.message);
        }
        process.exit(1);
    }
}

brandAlibiToken();

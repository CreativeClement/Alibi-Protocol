const {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const {
    createInitializeMintInstruction,
    getMinimumBalanceForRentExemptMint,
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    createMintToInstruction,
    setAuthority,
    AuthorityType
} = require('@solana/spl-token');
const bs58 = require('bs58');

require('dotenv').config();

// ── CLI flags ──────────────────────────────────────────────────────────────────
const USE_DEVNET       = process.argv.includes('--devnet');
const DRY_RUN          = process.argv.includes('--dry-run');
const REVOKE_AUTHORITY = process.argv.includes('--revoke-authority');
const REVOKE_FREEZE    = process.argv.includes('--revoke-freeze');

// ── Network config ─────────────────────────────────────────────────────────────
const NETWORK     = USE_DEVNET ? 'devnet' : 'mainnet-beta';
const DEFAULT_RPC = USE_DEVNET
    ? 'https://api.devnet.solana.com'
    : 'https://api.mainnet-beta.solana.com';
const RPC_URL         = process.env.SOLANA_RPC_URL || DEFAULT_RPC;
const MIN_BALANCE_SOL = 0.5;

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

async function launchAlibiToken() {
    console.log('🚀 INITIALIZING ALIBI PROTOCOL DEPLOYMENT...');
    console.log(`   Network : ${NETWORK}${DRY_RUN ? ' (DRY RUN — no transactions will be sent)' : ''}`);
    console.log(`   RPC     : ${RPC_URL}`);
    console.log('--------------------------------------------------');

    // 1. Parse key and init wallet
    const founderWallet = Keypair.fromSecretKey(parseSecretKey(process.env.FOUNDER_SECRET_KEY));
    console.log(`\n🏛️  FOUNDER WALLET: ${founderWallet.publicKey.toBase58()}`);

    // 2. Connect
    const connection = new Connection(RPC_URL, 'finalized');

    // 3. Balance check (≥ 0.5 SOL)
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
    console.log(`💰  Wallet balance: ${balanceSOL.toFixed(4)} SOL`);
    if (balanceSOL < MIN_BALANCE_SOL) {
        console.error(`❌  ABORT: Insufficient SOL balance (${balanceSOL.toFixed(4)} SOL). Minimum required: ${MIN_BALANCE_SOL} SOL.`);
        if (USE_DEVNET) console.error('    Fund via: https://faucet.solana.com/');
        else            console.error('    Transfer SOL to this wallet before retrying.');
        process.exit(1);
    }

    // 4. Mainnet warning
    if (!USE_DEVNET && !DRY_RUN) {
        await mainnetWarning('Genesis mint + create ATA + mint 1B tokens', founderWallet.publicKey.toBase58(), balanceSOL);
    }

    // 5. Create Mint Account
    console.log('\n💎 MINTING THE $ALIBI SMART CONTRACT...');
    const alibiMint = Keypair.generate();
    console.log(`$ALIBI TOKEN CONTRACT ADDRESS: ${alibiMint.publicKey.toBase58()}`);

    let lamports;
    try {
        lamports = await withRetry(
            () => getMinimumBalanceForRentExemptMint(connection),
            'getMinimumBalanceForRentExemptMint'
        );
    } catch (err) {
        console.error(`❌  RPC timeout fetching rent exemption: ${err.message}`);
        process.exit(1);
    }

    const mintTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey:     founderWallet.publicKey,
            newAccountPubkey: alibiMint.publicKey,
            space:          MINT_SIZE,
            lamports,
            programId:      TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
            alibiMint.publicKey,
            9,                          // 9 decimals — standard for Solana tokens
            founderWallet.publicKey,    // mint authority
            founderWallet.publicKey,    // freeze authority
            TOKEN_PROGRAM_ID
        )
    );

    console.log('Anchoring contract to the blockchain...');
    if (DRY_RUN) {
        console.log('[DRY RUN] Would send: createMint transaction');
    } else {
        await withRetry(
            () => sendAndConfirmTransaction(connection, mintTransaction, [founderWallet, alibiMint], { commitment: 'finalized' }),
            'createMint'
        );
    }
    console.log('✅ $ALIBI Token Created Successfully.');

    // 6. Create Associated Token Account
    console.log('\n🏦 CREATING FOUNDER VAULT POCKET...');
    const associatedTokenAccount = await getAssociatedTokenAddress(
        alibiMint.publicKey,
        founderWallet.publicKey
    );
    const ataTransaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
            founderWallet.publicKey,
            associatedTokenAccount,
            founderWallet.publicKey,
            alibiMint.publicKey
        )
    );

    if (DRY_RUN) {
        console.log('[DRY RUN] Would send: createAssociatedTokenAccount transaction');
    } else {
        await withRetry(
            () => sendAndConfirmTransaction(connection, ataTransaction, [founderWallet], { commitment: 'finalized' }),
            'createATA'
        );
    }
    console.log(`✅ Vault Created: ${associatedTokenAccount.toBase58()}`);

    // 7. Genesis Mint — 1 billion tokens
    console.log('\n🔥 EXECUTING GENESIS MINT (1 BILLION $ALIBI)...');
    const GENESIS_SUPPLY = 1_000_000_000;
    const amountToMint   = BigInt(GENESIS_SUPPLY) * BigInt(10 ** 9);
    const mintToTransaction = new Transaction().add(
        createMintToInstruction(
            alibiMint.publicKey,
            associatedTokenAccount,
            founderWallet.publicKey,
            amountToMint
        )
    );

    if (DRY_RUN) {
        console.log('[DRY RUN] Would send: mintTo transaction');
    } else {
        await withRetry(
            () => sendAndConfirmTransaction(connection, mintToTransaction, [founderWallet], { commitment: 'finalized' }),
            'mintTo'
        );
    }
    console.log('✅ 1,000,000,000 $ALIBI securely injected into Founder Vault.');

    // 8. Revoke Mint Authority (--revoke-authority)
    let mintAuthorityStatus = 'ACTIVE (founder wallet)';
    if (REVOKE_AUTHORITY) {
        console.log('\n🔒 MINT AUTHORITY REVOCATION REQUESTED.');
        console.log('   WARNING: This is IRREVERSIBLE. No additional tokens can ever be minted.');
        if (!USE_DEVNET && !DRY_RUN) {
            await mainnetWarning('REVOKE mint authority (IRREVERSIBLE)', founderWallet.publicKey.toBase58(), balanceSOL);
        }
        if (DRY_RUN) {
            console.log('[DRY RUN] Would revoke mint authority');
            mintAuthorityStatus = 'REVOKED (dry run)';
        } else {
            await withRetry(
                () => setAuthority(connection, founderWallet, alibiMint.publicKey, founderWallet, AuthorityType.MintTokens, null),
                'revokeMintAuthority'
            );
            mintAuthorityStatus = 'REVOKED';
        }
        console.log('✅ Mint Authority REVOKED. Supply is permanently fixed at 1,000,000,000 $ALIBI.');
    }

    // 9. Revoke Freeze Authority (--revoke-freeze)
    let freezeAuthorityStatus = 'ACTIVE (founder wallet)';
    if (REVOKE_FREEZE) {
        console.log('\n🔒 FREEZE AUTHORITY REVOCATION REQUESTED.');
        console.log('   WARNING: This is IRREVERSIBLE. No account can ever be frozen.');
        if (!USE_DEVNET && !DRY_RUN) {
            await mainnetWarning('REVOKE freeze authority (IRREVERSIBLE)', founderWallet.publicKey.toBase58(), balanceSOL);
        }
        if (DRY_RUN) {
            console.log('[DRY RUN] Would revoke freeze authority');
            freezeAuthorityStatus = 'REVOKED (dry run)';
        } else {
            await withRetry(
                () => setAuthority(connection, founderWallet, alibiMint.publicKey, founderWallet, AuthorityType.FreezeAccount, null),
                'revokeFreezeAuthority'
            );
            freezeAuthorityStatus = 'REVOKED';
        }
        console.log('✅ Freeze Authority REVOKED.');
    }

    // 10. Deployment summary
    console.log('\n' + '═'.repeat(60));
    console.log('🎉  ALIBI DEPLOYMENT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Token Address    : ${alibiMint.publicKey.toBase58()}`);
    console.log(`  Founder Vault    : ${associatedTokenAccount.toBase58()}`);
    console.log(`  Supply           : ${GENESIS_SUPPLY.toLocaleString()} $ALIBI`);
    console.log(`  Decimals         : 9`);
    console.log(`  Mint Authority   : ${mintAuthorityStatus}`);
    console.log(`  Freeze Authority : ${freezeAuthorityStatus}`);
    console.log(`  Network          : ${NETWORK}${DRY_RUN ? ' (DRY RUN)' : ''}`);
    console.log('═'.repeat(60));
    console.log('\nNext Step: Set ALIBI_MINT_ADDRESS in .env and run alibi_brand_token.js.');
}

launchAlibiToken().catch(err => {
    if (err.message?.includes('insufficient') || err.message?.includes('0x1')) {
        console.error('❌  Deployment failed: Insufficient SOL for transaction fees.');
    } else if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
        console.error(`❌  Deployment failed: RPC timeout. Check SOLANA_RPC_URL (${RPC_URL}).`);
    } else {
        console.error('❌  Deployment failed:', err.message);
    }
    process.exit(1);
});

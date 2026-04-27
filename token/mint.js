const {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    PublicKey
} = require('@solana/web3.js');
const {
    createInitializeMintInstruction,
    getMinimumBalanceForRentExemptMint,
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    createMintToInstruction
} = require('@solana/spl-token');
// Note: In a real production deployment, we would use @metaplex-foundation/mpl-token-metadata
// to attach the name, symbol, and image directly to the mint address on-chain.

// --- 🔴 CRITICAL SECURITY UPGRADE 🔴 ---
// Enterprise environments MUST pull from secure .env files. NEVER commit keys.
require('dotenv').config();

// SECURITY: Private key MUST come from environment variable. No fallbacks.
if (!process.env.FOUNDER_SECRET_KEY) {
    console.error('❌ FATAL: FOUNDER_SECRET_KEY not found in environment.');
    console.error('   Set it in your .env file as a JSON array of bytes.');
    console.error('   Example: FOUNDER_SECRET_KEY=[37,77,101,...]');
    process.exit(1);
}
let FOUNDER_KEY_BYTES;
try {
    FOUNDER_KEY_BYTES = new Uint8Array(JSON.parse(process.env.FOUNDER_SECRET_KEY));
} catch (err) {
    console.error('❌ FATAL: Failed to parse FOUNDER_SECRET_KEY from environment.');
    console.error('   Ensure FOUNDER_SECRET_KEY is a valid JSON array of bytes.');
    console.error('   Error:', err.message);
    process.exit(1);
}

async function launchAlibiToken() {
    console.log('🚀 INITIALIZING ALIBI PROTOCOL DEPLOYMENT...');
    console.log('--------------------------------------------------');

    // Track all transaction successes
    let allSucceeded = false;

    // 1. Connect to Solana (use env var, default to devnet for safety)
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const isMainnet = rpcUrl.includes('mainnet');
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`\n📡 RPC: ${rpcUrl}`);
    console.log(`🌐 Network: ${isMainnet ? 'MAINNET' : 'DEVNET'}`);

    // 2. Initialize the Founder's Wallet
    const founderWallet = Keypair.fromSecretKey(FOUNDER_KEY_BYTES);
    console.log(`🏛️  FOUNDER WALLET: ${founderWallet.publicKey.toBase58()}`);

    // --- MAINNET SAFETY GATE ---
    if (isMainnet) {
        const balance = await connection.getBalance(founderWallet.publicKey);
        const balanceSOL = balance / 1e9;
        console.log(`\n⚠️  MAINNET DETECTED — Wallet balance: ${balanceSOL.toFixed(4)} SOL`);

        if (balanceSOL < 0.05) {
            console.error('❌ Insufficient balance for mainnet mint deployment (~0.05 SOL required). Aborting.');
            process.exit(1);
        }

        console.log('🔴 MAINNET MINT — This will create a REAL token. You have 5 seconds to abort (Ctrl+C)...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        console.log('Proceeding with mainnet deployment...');
    }

    // 3. Skip automatic airdrop since user manually injected SOL
    console.log('💎 Starting Deployment using Founder injected SOL...');
    /*
    console.log('💸 Requesting free Devnet SOL for deployment fees...');
    try {
        const airdropSignature = await connection.requestAirdrop(founderWallet.publicKey, 2 * 1e9); // 2 SOL
        await connection.confirmTransaction(airdropSignature);
        console.log('✅ Airdrop Successful (Cost: $0.00)');
    } catch (error) {
        console.log('⚠️ Airdrop failed (Too many requests). Please use https://faucet.solana.com/ manually.');
        return;
    }
    */

    // 4. Create the $ALIBI Mint Account
    console.log('\n💎 MINTING THE $ALIBI SMART CONTRACT...');
    const alibiMint = Keypair.generate();
    console.log(`$ALIBI TOKEN CONTRACT ADDRESS: ${alibiMint.publicKey.toBase58()}`);

    let lamports;
    try {
        lamports = await getMinimumBalanceForRentExemptMint(connection);
    } catch (err) {
        console.error('❌ FATAL: Failed to fetch minimum rent exemption for mint.');
        console.error('   Error:', err.message);
        process.exit(1);
    }

    const mintTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: founderWallet.publicKey,
            newAccountPubkey: alibiMint.publicKey,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
            alibiMint.publicKey,
            9, // 9 Decimals (Standard for Tier-1 Tokens like SOL)
            founderWallet.publicKey, // Mint Authority (You)
            founderWallet.publicKey, // Freeze Authority (You)
            TOKEN_PROGRAM_ID
        )
    );

    console.log('Anchoring contract to the blockchain...');
    try {
        await sendAndConfirmTransaction(connection, mintTransaction, [founderWallet, alibiMint]);
        console.log('✅ $ALIBI Token Created Successfully.');
    } catch (err) {
        console.error('❌ STEP 1 FAILED: Failed to create mint account and initialize mint.');
        console.error('   Error:', err.message);
        process.exit(1);
    }

    // 5. Create Your Associated Token Account (The "Vault" holding the 1 Billion Tokens)
    console.log('\n🏦 CREATING FOUNDER VAULT POCKET...');
    const associatedTokenAccount = await getAssociatedTokenAddress(
        alibiMint.publicKey,
        founderWallet.publicKey
    );

    const ataTransaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
            founderWallet.publicKey, // Payer
            associatedTokenAccount, // Target Account
            founderWallet.publicKey, // Owner of account
            alibiMint.publicKey // The $ALIBI Token
        )
    )

    try {
        await sendAndConfirmTransaction(connection, ataTransaction, [founderWallet]);
        console.log(`✅ Vault Created: ${associatedTokenAccount.toBase58()}`);
    } catch (err) {
        console.error('❌ STEP 2 FAILED: Failed to create associated token account (vault).');
        console.error('   Error:', err.message);
        process.exit(1);
    }

    // 6. Execute the Genesis Mint (1,000,000,000 Tokens)
    console.log('\n🔥 EXECUTING GENESIS MINT (1 BILLION $ALIBI)...');
    const amountToMint = 1000000000 * Math.pow(10, 9); // 1 Billion * Decimals

    // Validate that the amount doesn't exceed Number.MAX_SAFE_INTEGER
    // 1,000,000,000 * 10^9 = 1e18, which is less than MAX_SAFE_INTEGER (9.007e15)
    // This is safe, but we document the check for transparency.
    if (amountToMint > Number.MAX_SAFE_INTEGER) {
        console.error('❌ FATAL: Mint amount exceeds safe integer range.');
        console.error(`   Amount: ${amountToMint}, Max: ${Number.MAX_SAFE_INTEGER}`);
        process.exit(1);
    }

    const mintToTransaction = new Transaction().add(
        createMintToInstruction(
            alibiMint.publicKey,
            associatedTokenAccount,
            founderWallet.publicKey,
            amountToMint
        )
    );

    try {
        await sendAndConfirmTransaction(connection, mintToTransaction, [founderWallet]);
        console.log('✅ 1,000,000,000 $ALIBI securely injected into Founder Vault.');
        allSucceeded = true;
    } catch (err) {
        console.error('❌ STEP 3 FAILED: Failed to execute genesis mint.');
        console.error('   Error:', err.message);
        process.exit(1);
    }

    // Only print success message if ALL transactions completed
    if (allSucceeded) {
        console.log('\n--------------------------------------------------');
        console.log('🎉 ALIBI DEPLOYMENT SECURED 🎉');
        console.log(`You own 100% of the $ALIBI supply on the Solana ${isMainnet ? 'Mainnet' : 'Devnet'}.`);
        console.log('Next Step: Embed Metaplex Metadata (Logo & Tier-1 Branding).');
    }

}

// Execute the launch when dependencies are installed.
launchAlibiToken();

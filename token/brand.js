const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createCreateMetadataAccountV3Instruction, PROGRAM_ID } = require('@metaplex-foundation/mpl-token-metadata');

require('dotenv').config();

// --- 🔴 CRITICAL SECURITY UPGRADE 🔴 ---
// Enterprise environments pull private keys dynamically from secure encrypted .env files.
// NEVER hardcode or commit secret phrases to version control.
// SECURITY: Private key MUST come from environment variable. No fallbacks.
if (!process.env.FOUNDER_SECRET_KEY) {
    console.error('❌ FATAL: FOUNDER_SECRET_KEY not found in environment.');
    console.error('   Set it in your .env file as a JSON array of bytes.');
    console.error('   Example: FOUNDER_SECRET_KEY=[37,77,101,...]');
    process.exit(1);
}
let FOUNDER_SECRET_KEY;
try {
    FOUNDER_SECRET_KEY = new Uint8Array(JSON.parse(process.env.FOUNDER_SECRET_KEY));
} catch (err) {
    console.error('❌ FATAL: Failed to parse FOUNDER_SECRET_KEY from environment.');
    console.error('   Ensure FOUNDER_SECRET_KEY is a valid JSON array of bytes.');
    console.error('   Error:', err.message);
    process.exit(1);
}

// 2. YOUR PREVIOUSLY DEPLOYED TOKEN CONTRACT (From Step 1)
// NOTE: Landing page references 396ypp7wKqVry36RhHcC8dLAxTWTg9juatoRFwnyzzRq (mainnet)
// This script references the devnet mint below. Confirm which is canonical before mainnet deployment.
const ALIBI_MINT_ADDRESS = new PublicKey(process.env.ALIBI_MINT_ADDRESS || 'ExRmXPt24nU7HnBGMGFcVDjEegnYgb34mDYu4qpUBDSy');

async function brandAlibiToken() {
    console.log('🛡️  ENGAGING METAPLEX BRANDING PROTOCOL...');

    // Use RPC from environment, default to devnet for safety
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const isMainnet = rpcUrl.includes('mainnet');

    const connection = new Connection(rpcUrl, 'confirmed');
    const founderWallet = Keypair.fromSecretKey(FOUNDER_SECRET_KEY);

    // --- MAINNET SAFETY GATE ---
    if (isMainnet) {
        let balance;
        try {
            balance = await connection.getBalance(founderWallet.publicKey);
        } catch (err) {
            console.error('❌ FATAL: Failed to fetch wallet balance from Solana RPC.');
            console.error('   Error:', err.message);
            process.exit(1);
        }
        const balanceSOL = balance / 1e9;
        console.log(`\n⚠️  MAINNET DETECTED — Wallet balance: ${balanceSOL.toFixed(4)} SOL`);

        if (balanceSOL < 0.01) {
            console.error('❌ Insufficient balance for mainnet transaction. Aborting.');
            process.exit(1);
        }

        console.log('🔴 MAINNET DEPLOYMENT — You have 5 seconds to abort (Ctrl+C)...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        console.log('Proceeding with mainnet deployment...');
    }

    // This address determines where the token's visual branding gets permanently stored in memory
    let metadataPDA;
    try {
        [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                PROGRAM_ID.toBuffer(),
                ALIBI_MINT_ADDRESS.toBuffer(),
            ],
            PROGRAM_ID
        );
    } catch (err) {
        console.error('❌ FATAL: Failed to derive Metaplex metadata PDA.');
        console.error('   Error:', err.message);
        process.exit(1);
    }

    console.log(`\n🔹 Token Address: ${ALIBI_MINT_ADDRESS.toBase58()}`);
    console.log(`🔹 Embedding Name: ALIBI`);
    console.log(`🔹 Embedding Symbol: $ALIBI`);
    console.log(`🔹 Anchoring AI Generated Logo...`);

    // PRODUCTION: Set TOKEN_METADATA_URI in .env to your Arweave/IPFS JSON URI.
    // Upload your metadata JSON to Arweave (via Irys/Bundlr) or IPFS (via Pinata/NFT.Storage).
    // The JSON should contain: { "name": "ALIBI", "symbol": "ALIBI", "description": "...", "image": "<arweave-image-uri>" }
    // Example Arweave URI: https://arweave.net/<TX_ID>
    // Example IPFS URI: https://ipfs.io/ipfs/<CID>
    const metadataUri = process.env.TOKEN_METADATA_URI;
    if (!metadataUri || metadataUri.includes('placeholder') || metadataUri.includes('github.com/solana-developers')) {
        console.warn('⚠️  WARNING: TOKEN_METADATA_URI is not set or still points to a placeholder.');
        console.warn('   For production, upload metadata JSON to Arweave or IPFS and set TOKEN_METADATA_URI in .env');
        if (isMainnet) {
            console.error('❌ Cannot deploy to mainnet with placeholder metadata URI. Aborting.');
            process.exit(1);
        }
    }

    const tokenMetadata = {
        name: "ALIBI",
        symbol: "ALIBI",
        uri: metadataUri || "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens-and-minting/token-2022/token-metadata.json",
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null
    };

    const createMetadataIx = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataPDA,
            mint: ALIBI_MINT_ADDRESS,
            mintAuthority: founderWallet.publicKey,
            payer: founderWallet.publicKey,
            updateAuthority: founderWallet.publicKey,
        },
        {
            createMetadataAccountArgsV3: {
                data: tokenMetadata,
                isMutable: false, // Permanently locks the branding so it can NEVER be changed
                collectionDetails: null
            }
        }
    );

    const tx = new Transaction().add(createMetadataIx);
    
    console.log('\n🔐 Locking Metaplex Ledger (This may take roughly 15 seconds)...');
    
    try {
        const txid = await sendAndConfirmTransaction(connection, tx, [founderWallet]);
        console.log(`\n✅ ALIBI OFFICIALLY BRANDED ON THE BLOCKCHAIN.`);
        const explorerCluster = isMainnet ? '' : '?cluster=devnet';
        console.log(`Solana Explorer Hash: https://explorer.solana.com/tx/${txid}${explorerCluster}`);
    } catch (err) {
        const networkName = isMainnet ? 'Mainnet' : 'Devnet';
        const solName = isMainnet ? 'Mainnet SOL' : 'Devnet SOL';
        console.error(`⚠️ Branding Update Failed on ${networkName}. You may need to request ${solName} manually.`, err.message);
    }
}

brandAlibiToken();

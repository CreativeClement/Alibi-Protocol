import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SOLANA_CONFIG } from '../constants/api';

const MEMO_PROGRAM_ID = new PublicKey(SOLANA_CONFIG.memoProgramId);
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || SOLANA_CONFIG.defaultRpcUrl;

export interface SolanaVaultParams {
  hash: string;
  walletPublicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export async function vaultEvidenceOnChain(params: SolanaVaultParams): Promise<string> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Create memo instruction
    const memoData = `ALIBI_INCIDENT:${params.hash}`;
    const memoInstruction = new TransactionInstruction({
      keys: [
        {
          pubkey: params.walletPublicKey,
          isSigner: true,
          isWritable: true,
        },
      ],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoData, 'utf-8'),
    });

    // Create and sign transaction
    const transaction = new Transaction().add(memoInstruction);
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = params.walletPublicKey;

    const signed = await params.signTransaction(transaction);

    // Send transaction
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    if (__DEV__) console.log('Evidence vaulted on-chain:', signature);

    // Wait for confirmation with 60s timeout to prevent indefinite hang.
    // Clear the timeout when done to avoid timer leaks and unhandled rejection warnings.
    const confirmPromise = connection.confirmTransaction(signature, 'confirmed');
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Transaction confirmation timed out (60s)')), 60_000);
    });
    try {
      await Promise.race([confirmPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }

    return signature;
  } catch (error) {
    if (__DEV__) console.warn('Vault evidence on-chain error:', error);
    throw error;
  }
}

export async function checkTransactionStatus(
  signature: string
): Promise<'confirmed' | 'failed' | 'pending'> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const status = await connection.getSignatureStatus(signature);

    if (status.value?.err) {
      return 'failed';
    }

    if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
      return 'confirmed';
    }

    return 'pending';
  } catch (error) {
    if (__DEV__) console.warn('Check transaction status error:', error);
    return 'pending';
  }
}

export function getSolscanUrl(signature: string, cluster = 'mainnet'): string {
  return `https://solscan.io/tx/${signature}?cluster=${cluster}`;
}

export async function getWalletBalance(publicKey: PublicKey): Promise<number> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(publicKey);
    return balance / SOLANA_CONFIG.lamportsPerSol;
  } catch (error) {
    if (__DEV__) console.warn('Get wallet balance error:', error);
    return 0;
  }
}

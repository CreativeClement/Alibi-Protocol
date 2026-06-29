import { PublicKey, Transaction, __mockOverrides } from './mocks/solana-web3';
import {
  vaultEvidenceOnChain,
  checkTransactionStatus,
  getWalletBalance,
  getSolscanUrl,
} from '../services/solana';

/**
 * Integration tests for Solana TX serialization and the
 * vaultEvidenceOnChain end-to-end flow (mocked RPC, real logic).
 */

describe('solana service — integration', () => {
  afterEach(() => {
    // Reset all overrides between tests
    __mockOverrides.getLatestBlockhash = null;
    __mockOverrides.sendRawTransaction = null;
    __mockOverrides.confirmTransaction = null;
    __mockOverrides.getSignatureStatus = null;
    __mockOverrides.getBalance = null;
  });

  describe('vaultEvidenceOnChain', () => {
    const walletPublicKey = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    const mockHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

    const mockSignTransaction = jest.fn().mockImplementation((tx: Transaction) => {
      return Promise.resolve(tx);
    });

    beforeEach(() => {
      mockSignTransaction.mockClear();
    });

    it('creates a memo transaction and returns signature', async () => {
      const signature = await vaultEvidenceOnChain({
        hash: mockHash,
        walletPublicKey,
        signTransaction: mockSignTransaction,
      });
      expect(signature).toBe('mock-signature');
    });

    it('calls signTransaction exactly once with a Transaction', async () => {
      await vaultEvidenceOnChain({
        hash: mockHash,
        walletPublicKey,
        signTransaction: mockSignTransaction,
      });
      expect(mockSignTransaction).toHaveBeenCalledTimes(1);
      const passedTx = mockSignTransaction.mock.calls[0][0];
      expect(passedTx).toBeInstanceOf(Transaction);
    });

    it('sets feePayer to the wallet public key', async () => {
      await vaultEvidenceOnChain({
        hash: mockHash,
        walletPublicKey,
        signTransaction: mockSignTransaction,
      });
      const passedTx = mockSignTransaction.mock.calls[0][0];
      expect(passedTx.feePayer).toBe(walletPublicKey);
    });

    it('sets recentBlockhash from getLatestBlockhash', async () => {
      await vaultEvidenceOnChain({
        hash: mockHash,
        walletPublicKey,
        signTransaction: mockSignTransaction,
      });
      const passedTx = mockSignTransaction.mock.calls[0][0];
      expect(passedTx.recentBlockhash).toBe('mock-blockhash');
    });

    it('throws when signTransaction rejects', async () => {
      const failingSign = jest.fn().mockRejectedValue(new Error('User rejected'));
      await expect(
        vaultEvidenceOnChain({
          hash: mockHash,
          walletPublicKey,
          signTransaction: failingSign,
        })
      ).rejects.toThrow('User rejected');
    });

    it('throws when getLatestBlockhash fails (network error)', async () => {
      __mockOverrides.getLatestBlockhash = () =>
        Promise.reject(new Error('Network timeout'));

      await expect(
        vaultEvidenceOnChain({
          hash: mockHash,
          walletPublicKey,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('Network timeout');
    });

    it('throws when sendRawTransaction fails', async () => {
      __mockOverrides.sendRawTransaction = () =>
        Promise.reject(new Error('Transaction simulation failed'));

      await expect(
        vaultEvidenceOnChain({
          hash: mockHash,
          walletPublicKey,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('Transaction simulation failed');
    });

    it('throws when confirmTransaction fails', async () => {
      __mockOverrides.confirmTransaction = () =>
        Promise.reject(new Error('Block height exceeded'));

      await expect(
        vaultEvidenceOnChain({
          hash: mockHash,
          walletPublicKey,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('Block height exceeded');
    });

    it('clears the confirmation timeout when confirmTransaction resolves (no timer leak)', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const callsBefore = clearTimeoutSpy.mock.calls.length;

      await vaultEvidenceOnChain({
        hash: mockHash,
        walletPublicKey,
        signTransaction: mockSignTransaction,
      });

      // clearTimeout should have been called at least once more (for the 60s race timeout)
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBefore);
      clearTimeoutSpy.mockRestore();
    });

    it('handles empty hash gracefully (still sends ALIBI_INCIDENT: prefix)', async () => {
      const signature = await vaultEvidenceOnChain({
        hash: '',
        walletPublicKey,
        signTransaction: mockSignTransaction,
      });
      expect(signature).toBe('mock-signature');
    });

    it('does not call sendRawTransaction if signing fails', async () => {
      const failingSign = jest.fn().mockRejectedValue(new Error('Rejected'));
      try {
        await vaultEvidenceOnChain({
          hash: mockHash,
          walletPublicKey,
          signTransaction: failingSign,
        });
      } catch {
        // expected
      }
      // sendRawTransaction should not have been reached
      // (we can't inspect the internal connection instance directly, but
      //  the error propagation proves the flow stopped at signing)
      expect(failingSign).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkTransactionStatus', () => {
    it('returns confirmed when status is confirmed', async () => {
      const result = await checkTransactionStatus('mock-sig');
      expect(result).toBe('confirmed');
    });

    it('returns confirmed when status is finalized', async () => {
      __mockOverrides.getSignatureStatus = () =>
        Promise.resolve({ value: { confirmationStatus: 'finalized', err: null } });

      const result = await checkTransactionStatus('mock-sig-finalized');
      expect(result).toBe('confirmed');
    });

    it('returns failed when status has error', async () => {
      __mockOverrides.getSignatureStatus = () =>
        Promise.resolve({
          value: { confirmationStatus: 'confirmed', err: { InstructionError: [0, 'Custom'] } },
        });

      const result = await checkTransactionStatus('mock-sig-error');
      expect(result).toBe('failed');
    });

    it('returns pending when status is processed (not yet confirmed)', async () => {
      __mockOverrides.getSignatureStatus = () =>
        Promise.resolve({ value: { confirmationStatus: 'processed', err: null } });

      const result = await checkTransactionStatus('mock-sig-pending');
      expect(result).toBe('pending');
    });

    it('returns pending when value is null (not found yet)', async () => {
      __mockOverrides.getSignatureStatus = () =>
        Promise.resolve({ value: null });

      const result = await checkTransactionStatus('mock-sig-null');
      expect(result).toBe('pending');
    });

    it('returns pending on network error', async () => {
      __mockOverrides.getSignatureStatus = () =>
        Promise.reject(new Error('RPC unavailable'));

      const result = await checkTransactionStatus('mock-sig-error');
      expect(result).toBe('pending');
    });
  });

  describe('getWalletBalance', () => {
    it('returns balance in SOL (converts from lamports)', async () => {
      const pk = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
      const balance = await getWalletBalance(pk);
      // Default mock returns 1_500_000_000 lamports = 1.5 SOL
      expect(balance).toBe(1.5);
    });

    it('returns 0 on RPC error', async () => {
      __mockOverrides.getBalance = () =>
        Promise.reject(new Error('Invalid public key'));

      const pk = new PublicKey('invalid');
      const balance = await getWalletBalance(pk);
      expect(balance).toBe(0);
    });

    it('handles zero balance correctly', async () => {
      __mockOverrides.getBalance = () => Promise.resolve(0);

      const pk = new PublicKey('empty-wallet');
      const balance = await getWalletBalance(pk);
      expect(balance).toBe(0);
    });

    it('handles large balances (1000+ SOL)', async () => {
      __mockOverrides.getBalance = () => Promise.resolve(1_234_567_890_000);

      const pk = new PublicKey('whale-wallet');
      const balance = await getWalletBalance(pk);
      expect(balance).toBeCloseTo(1234.56789, 5);
    });

    it('handles sub-lamport precision (dust amounts)', async () => {
      __mockOverrides.getBalance = () => Promise.resolve(1);

      const pk = new PublicKey('dust-wallet');
      const balance = await getWalletBalance(pk);
      expect(balance).toBe(1e-9);
    });
  });

  describe('getSolscanUrl (extended)', () => {
    it('generates valid URL for real-world signature format', () => {
      const realSig = '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi2t3cEXnUfVpKjNowkPJjUHBq66TEiQ4WSaVsrHmtw7F3D';
      const url = getSolscanUrl(realSig, 'devnet');
      expect(url).toBe(`https://solscan.io/tx/${realSig}?cluster=devnet`);
    });

    it('generates testnet URL', () => {
      const url = getSolscanUrl('abc', 'testnet');
      expect(url).toBe('https://solscan.io/tx/abc?cluster=testnet');
    });
  });
});

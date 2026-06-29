import { getSolscanUrl } from '../services/solana';

describe('solana service', () => {
  describe('getSolscanUrl', () => {
    const mockSignature = '5KtPn1LGuxhFiwjxErkxTb5dTMKBnJGqMBjKQvDBhQHVK5W8FRKMq9PzNJoD8z2r';

    it('generates correct mainnet URL by default', () => {
      const url = getSolscanUrl(mockSignature);
      expect(url).toBe(`https://solscan.io/tx/${mockSignature}?cluster=mainnet`);
    });

    it('generates correct mainnet URL when explicitly specified', () => {
      const url = getSolscanUrl(mockSignature, 'mainnet');
      expect(url).toBe(`https://solscan.io/tx/${mockSignature}?cluster=mainnet`);
    });

    it('generates correct devnet URL', () => {
      const url = getSolscanUrl(mockSignature, 'devnet');
      expect(url).toBe(`https://solscan.io/tx/${mockSignature}?cluster=devnet`);
    });

    it('handles empty signature', () => {
      const url = getSolscanUrl('');
      expect(url).toBe('https://solscan.io/tx/?cluster=mainnet');
    });

    it('handles special characters in signature (edge case)', () => {
      const url = getSolscanUrl('abc123');
      expect(url).toContain('abc123');
      expect(url).toContain('solscan.io/tx/');
    });
  });
});

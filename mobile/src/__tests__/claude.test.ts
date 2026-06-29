import { getLegalGuidance } from '../services/claude';

// Store original env
const originalEnv = process.env;

describe('claude service', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear any global fetch mocks
    (global as any).fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getLegalGuidance', () => {
    const mockParams = {
      officerStatement: 'Can I search your vehicle?',
      state: 'New Hampshire',
      situation: 'Routine traffic stop',
    };

    it('returns fallback guidance when API key is not configured', async () => {
      delete process.env.EXPO_PUBLIC_CLAUDE_API_KEY;

      const result = await getLegalGuidance(mockParams);

      expect(result.guidance).toContain('right to remain silent');
      expect(result.citedLaws).toContain('Fifth Amendment - Right to remain silent');
      expect(result.citedLaws).toContain('Fourth Amendment - Protection against unreasonable searches');
      expect(result.citedLaws).toContain('Sixth Amendment - Right to counsel');
      expect(result.state).toBe('US');
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('calls Claude API with correct parameters when key is available', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: '[GUIDANCE]\nYou do not have to consent to a search. Say: "I do not consent to searches."\n\n[LAWS]\n- Fourth Amendment - Protection against unreasonable searches\n- State v. Ball (NH 2006) - Officers need probable cause',
          }],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getLegalGuidance(mockParams);

      // Verify fetch was called with correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-key-123',
            'anthropic-version': '2023-06-01',
          }),
        })
      );

      // Verify the body includes state context
      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe('claude-sonnet-4-20250514');
      expect(body.max_tokens).toBe(300);
      expect(body.temperature).toBe(0.3);
      expect(body.system).toContain('New Hampshire');

      // Verify parsed response
      expect(result.guidance).toContain('do not consent');
      expect(result.citedLaws).toHaveLength(2);
      expect(result.citedLaws[0]).toContain('Fourth Amendment');
      expect(result.state).toBe('New Hampshire');
    });

    it('returns fallback on API error response', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'rate_limited' }),
      });

      const result = await getLegalGuidance(mockParams);

      expect(result.guidance).toContain('right to remain silent');
      expect(result.citedLaws.length).toBeGreaterThan(0);
    });

    it('returns fallback on network failure', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await getLegalGuidance(mockParams);

      expect(result.guidance).toContain('right to remain silent');
    });

    it('parses guidance without explicit section markers', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: 'You have the right to refuse a search. Politely decline by saying "I do not consent to any searches."',
          }],
        }),
      });

      const result = await getLegalGuidance(mockParams);

      // Without section markers, entire text becomes guidance
      expect(result.guidance).toContain('right to refuse');
      // Without law markers, fallback laws are used
      expect(result.citedLaws).toContain('Fifth Amendment - Right to remain silent');
    });

    it('parses laws with asterisk bullet markers', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: '[GUIDANCE]\nYou can refuse the search.\n\n[LAWS]\n* Fourth Amendment - Unreasonable search protection\n* Terry v. Ohio (1968) - Stop and frisk limits',
          }],
        }),
      });

      const result = await getLegalGuidance(mockParams);

      expect(result.citedLaws).toHaveLength(2);
      expect(result.citedLaws[0]).toContain('Fourth Amendment');
      expect(result.citedLaws[1]).toContain('Terry v. Ohio');
    });

    it('parses laws with numbered list markers', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: '[GUIDANCE]\nRemain calm and assert your rights.\n\n[LAWS]\n1. Fifth Amendment - Right to remain silent\n2) Miranda v. Arizona (1966) - Right to counsel during interrogation',
          }],
        }),
      });

      const result = await getLegalGuidance(mockParams);

      expect(result.citedLaws).toHaveLength(2);
      expect(result.citedLaws[0]).toContain('Fifth Amendment');
      expect(result.citedLaws[1]).toContain('Miranda v. Arizona');
    });

    it('handles invalid API response structure gracefully', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [], // Empty content array
        }),
      });

      const result = await getLegalGuidance(mockParams);

      // Should return fallback guidance
      expect(result.guidance).toContain('right to remain silent');
    });

    it('truncates guidance to 300 characters', async () => {
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY = 'test-key-123';

      const longText = '[GUIDANCE]\n' + 'A'.repeat(500) + '\n\n[LAWS]\n- Test Law';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ text: longText }],
        }),
      });

      const result = await getLegalGuidance(mockParams);

      expect(result.guidance.length).toBeLessThanOrEqual(300);
    });
  });
});

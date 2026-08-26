import { getLegalGuidance } from '../services/claude';

describe('claude service', () => {
  const mockParams = {
    officerStatement: 'Can I search your vehicle?',
    state: 'New Hampshire',
    situation: 'Routine traffic stop',
  };

  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('calls the first-party legal-guidance proxy, never Anthropic directly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        guidance: 'You do not have to consent to a search.',
        citedLaws: ['Fourth Amendment — Protection against unreasonable searches'],
      }),
    });

    const result = await getLegalGuidance(mockParams);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://alibiprotocol.com/api/legal-guidance');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-Alibi-Version']).toBe('3.0');
    expect(init.headers['x-api-key']).toBeUndefined();

    const body = JSON.parse(init.body);
    expect(body).toEqual(mockParams);

    expect(result.guidance).toContain('do not have to consent');
    expect(result.citedLaws).toHaveLength(1);
    expect(result.state).toBe('New Hampshire');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('returns fallback guidance when the proxy is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await getLegalGuidance(mockParams);

    expect(result.guidance).toContain('right to remain silent');
    expect(result.citedLaws).toEqual(
      expect.arrayContaining([
        'Fifth Amendment — Right to remain silent',
        'Fourth Amendment — Protection against unreasonable searches',
        'Sixth Amendment — Right to counsel',
      ])
    );
    expect(result.state).toBe('New Hampshire');
  });

  it('returns fallback guidance when the proxy returns a non-OK status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      json: jest.fn().mockResolvedValue({ error: 'upstream' }),
    });

    const result = await getLegalGuidance(mockParams);

    expect(result.guidance).toContain('right to remain silent');
    expect(result.citedLaws.length).toBeGreaterThan(0);
  });

  it('returns fallback when the proxy payload is missing guidance', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ content: [] }),
    });

    const result = await getLegalGuidance(mockParams);

    expect(result.guidance).toContain('right to remain silent');
  });
});

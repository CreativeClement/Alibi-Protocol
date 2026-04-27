/**
 * Legal Guidance Service
 *
 * Calls the Alibi Cloudflare Worker proxy at alibi-api.timrclement.workers.dev.
 * The Anthropic API key is stored as a Worker secret — it is NEVER bundled
 * into the client app. Do not use EXPO_PUBLIC_CLAUDE_API_KEY in production.
 */
import { LegalGuidance } from '../types';
import { CLAUDE_CONFIG } from '../constants/api';

// Fallback — always show something useful during a live stop
const FALLBACK_GUIDANCE: LegalGuidance = {
  guidance: 'You have the constitutional right to remain silent. Do not consent to searches. Ask the officer: "Am I being detained, or am I free to go?"',
  citedLaws: [
    'Fifth Amendment — Right to remain silent',
    'Fourth Amendment — Protection against unreasonable searches',
    'Rodriguez v. US (2015) — Stop may not extend beyond its mission',
    'Sixth Amendment — Right to counsel',
  ],
  state: 'US',
  timestamp: Date.now(),
};

export async function getLegalGuidance(params: {
  officerStatement: string;
  state: string;
  situation: string;
}): Promise<LegalGuidance> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout — must be fast in a live stop

  try {
    let response: Response;
    try {
      response = await fetch(CLAUDE_CONFIG.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alibi-Version': '3.0',
        },
        signal: controller.signal,
        body: JSON.stringify({
          officerStatement: params.officerStatement,
          state: params.state,
          situation: params.situation,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (__DEV__) console.warn('Legal guidance proxy error:', response.status);
      return { ...FALLBACK_GUIDANCE, state: params.state, timestamp: Date.now() };
    }

    const data = await response.json();

    // The proxy already returns guidance + citedLaws — use directly
    if (data.guidance && Array.isArray(data.citedLaws)) {
      return {
        guidance: data.guidance,
        citedLaws: data.citedLaws,
        state: params.state,
        timestamp: Date.now(),
      };
    }

    // Proxy returned fallback structure
    return { ...FALLBACK_GUIDANCE, state: params.state, timestamp: Date.now() };

  } catch (error) {
    clearTimeout(timeout);
    if (__DEV__) console.warn('Legal guidance request failed:', error);
    return { ...FALLBACK_GUIDANCE, state: params.state, timestamp: Date.now() };
  }
}

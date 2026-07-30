import type { NextApiRequest, NextApiResponse } from 'next';

const upstream = process.env.GENLAYER_RPC_UPSTREAM || 'https://studio.genlayer.com/api';
const retryable = (status: number) => status === 429 || status >= 500;
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }
  let upstreamResponse: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      upstreamResponse = await fetch(upstream, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request.body),
        cache: 'no-store',
      });
      if (!retryable(upstreamResponse.status) || attempt === 3) break;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
    }
    await delay(300 * (attempt + 1));
  }
  if (!upstreamResponse) {
    return response.status(502).json({
      error: 'genlayer_upstream_unavailable',
      detail: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
  response.status(upstreamResponse.status);
  response.setHeader('content-type', upstreamResponse.headers.get('content-type') || 'application/json');
  return response.send(await upstreamResponse.text());
}

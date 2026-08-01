import type { NextApiRequest, NextApiResponse } from "next";

const UPSTREAM = process.env.GENLAYER_RPC_UPSTREAM || "https://studio.genlayer.com/api";
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 25_000;
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const retryable = (status: number) => status === 429 || status >= 500;
const retryableRpcBody = (body: string) => {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    const message = JSON.stringify(parsed.error || "").toLowerCase();
    return message.includes("server busy")
      || message.includes("execution slots")
      || message.includes("temporarily unavailable")
      || message.includes("too many requests");
  } catch {
    return false;
  }
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  const payload = request.body;
  if (!payload || payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return response.status(400).json({ error: "invalid_json_rpc_request" });
  }
  let upstreamResponse: Response | undefined;
  let upstreamBody = "";
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    upstreamResponse = undefined;
    upstreamBody = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      upstreamResponse = await fetch(UPSTREAM, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });
      upstreamBody = await upstreamResponse.text();
      const shouldRetry = retryable(upstreamResponse.status) || retryableRpcBody(upstreamBody);
      if (!shouldRetry || attempt === MAX_ATTEMPTS - 1) break;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS - 1) break;
    } finally {
      clearTimeout(timeout);
    }
    await delay(Math.min(400 * (2 ** attempt), 2_500));
  }
  if (!upstreamResponse) {
    return response.status(502).json({
      error: "genlayer_upstream_unavailable",
      detail: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-type", upstreamResponse.headers.get("content-type") || "application/json");
  return response.status(upstreamResponse.status).send(upstreamBody);
}

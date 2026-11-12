import { readListing, type ApiJob } from "./extract/read";
import type { Reading } from "./extract/types";

const BASE = "https://speedrun-talent-network.com/api/v1";
const SOURCE = "fine-print";
const HOSTS = new Set(["speedrun-talent-network.com", "www.speedrun-talent-network.com"]);

export type ParseResult = { ok: true; key: string } | { ok: false; error: "empty" | "not_speedrun" | "not_a_job" };

/** Accepts a speedrun job URL, a canonical slug, a UUID, or an 8-hex id prefix. */
export function parseJobInput(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "empty" };
  let candidate = raw;
  if (/^https?:\/\//i.test(raw) || raw.includes("/")) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return { ok: false, error: "not_a_job" };
    }
    if (!HOSTS.has(url.hostname.toLowerCase())) return { ok: false, error: "not_speedrun" };
    const m = /^\/jobs\/([^/]+)\/?$/.exec(url.pathname);
    if (!m) return { ok: false, error: "not_a_job" };
    candidate = decodeURIComponent(m[1]);
  }
  candidate = candidate.toLowerCase();
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(candidate)) return { ok: true, key: candidate };
  if (/^[0-9a-f]{8}$/.test(candidate)) return { ok: true, key: candidate };
  // canonical slug ends in the 8-hex id prefix
  const tail = /-([0-9a-f]{8})$/.exec(candidate);
  if (tail && /^[a-z0-9-]{1,200}$/.test(candidate)) return { ok: true, key: tail[1] };
  return { ok: false, error: "not_a_job" };
}

export type ReadResult =
  | { ok: true; reading: Reading }
  | { ok: false; error: "not_found" | "rate_limited" | "upstream"; status: number };

class UpstreamError extends Error {
  constructor(public status: number) {
    super(`speedrun API answered ${status}`);
  }
}

// Small in-memory cache so repeat views do not spend the speedrun API's rate
// budget. Failures are never cached. Only the reading is kept: the description
// is read in memory and never stored.
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; reading: Reading | null }>();

async function cachedReading(key: string): Promise<Reading | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.reading;
  const res = await fetch(`${BASE}/jobs/${encodeURIComponent(key)}?source=${SOURCE}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  let reading: Reading | null;
  if (res.status === 404) reading = null;
  else if (!res.ok) throw new UpstreamError(res.status);
  else {
    const body = (await res.json()) as { job?: ApiJob };
    if (!body.job) throw new UpstreamError(res.status);
    reading = readListing(body.job);
  }
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), reading });
  return reading;
}

/** One API call per role, so a pasted link always works without an index. */
export async function getReading(key: string): Promise<ReadResult> {
  try {
    const reading = await cachedReading(key);
    return reading ? { ok: true, reading } : { ok: false, error: "not_found", status: 404 };
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 0;
    return { ok: false, error: status === 429 ? "rate_limited" : "upstream", status };
  }
}

// Calls the speedrun talent network API straight from the visitor's browser.
// The API is public and CORS-open. Reading in the browser means descriptions
// never pass through a fine_print server, and each visitor uses their own
// share of the API's rate limit.
import { readListing, type ApiJob } from "./extract/read";
import type { Reading } from "./extract/types";

const BASE = "https://speedrun-talent-network.com/api/v1";
const SOURCE = "fine-print";

export interface ListedRole {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  published_at: string | null;
}

export interface RoleList {
  roles: ListedRole[];
  total: number;
  page: number;
  hasMore: boolean;
  levelCounts: Record<string, number>;
  fetchedAt: string;
}

export class BoardError extends Error {
  constructor(
    public kind: "busy" | "not_found" | "down",
    message: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}source=${SOURCE}`, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    // A rate-limit page from the CDN carries no CORS header, so it surfaces here as a network error.
    throw new BoardError("busy", "The speedrun board did not answer.");
  }
  if (res.status === 404) throw new BoardError("not_found", "No role with that id on the speedrun board.");
  if (res.status === 429) throw new BoardError("busy", "The speedrun board asked us to slow down.");
  if (!res.ok) throw new BoardError("down", `The speedrun board answered ${res.status}.`);
  return res.json();
}

export const LEVELS = [
  { key: "intern", label: "Internships" },
  { key: "new_grad", label: "New grad" },
  { key: "junior", label: "Junior" },
] as const;

export async function listRoles(
  opts: { levels: string[]; q: string; page: number },
  signal?: AbortSignal,
): Promise<RoleList> {
  const params = new URLSearchParams({ lvl: opts.levels.join(","), page: String(opts.page) });
  if (opts.q.trim()) params.set("q", opts.q.trim().slice(0, 120));
  else params.set("sort", "new");
  const body = (await get(`/jobs?${params}`, signal)) as {
    jobs: (ListedRole & Record<string, unknown>)[];
    total: number;
    page: number;
    has_more: boolean;
    facets?: { lvl?: { v: string; n: number }[] };
  };
  return {
    roles: body.jobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location ?? null,
      url: String(j.url).split("?")[0],
      published_at: j.published_at ?? null,
    })),
    total: body.total,
    page: body.page,
    hasMore: body.has_more,
    levelCounts: Object.fromEntries((body.facets?.lvl ?? []).map((f) => [f.v, f.n])),
    fetchedAt: new Date().toISOString(),
  };
}

const readings = new Map<string, Reading>();

/** Reads one role. Results are kept in memory for the visit; nothing is stored. */
export async function readRole(key: string, signal?: AbortSignal): Promise<Reading> {
  const hit = readings.get(key);
  if (hit) return hit;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = (await get(`/jobs/${encodeURIComponent(key)}`, signal)) as { job?: ApiJob };
      if (!body.job) throw new BoardError("down", "The speedrun board sent an empty answer.");
      const reading = readListing(body.job);
      readings.set(key, reading);
      readings.set(reading.board.id, reading);
      readings.set(reading.board.id.slice(0, 8), reading);
      return reading;
    } catch (e) {
      lastError = e;
      if (!(e instanceof BoardError) || e.kind !== "busy") throw e;
      await sleep(10000); // the board's own retry-after
    }
  }
  throw lastError;
}

/** Accepts a speedrun job URL, a canonical slug, a UUID or an 8-character id. */
export function keyFromInput(input: string): { key: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "Paste a job link from the speedrun talent network first." };
  let candidate = raw;
  if (/^https?:\/\//i.test(raw) || raw.includes("/")) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return { error: "That does not look like a link. Copy the address of a role on the speedrun board." };
    }
    if (!/(^|\.)speedrun-talent-network\.com$/i.test(u.hostname))
      return { error: "That link is not from speedrun-talent-network.com. fine_print only reads the speedrun board." };
    const m = /^\/jobs\/([^/]+)\/?$/.exec(u.pathname);
    if (!m) return { error: "That is a speedrun page, but not a single job. Open a role and copy its link." };
    candidate = decodeURIComponent(m[1]);
  }
  candidate = candidate.toLowerCase();
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(candidate) || /^[0-9a-f]{8}$/.test(candidate)) return { key: candidate };
  const tail = /-([0-9a-f]{8})$/.exec(candidate);
  if (tail) return { key: tail[1] };
  return { error: "That does not look like a speedrun job link. Open a role on the board and copy its address." };
}

// Calls the speedrun talent network API straight from the visitor's browser.
// The API is public and CORS-open. Reading in the browser means descriptions
// never pass through a fine_print server, and each visitor uses their own
// share of the API's rate limit.
import { readListing, type ApiJob } from "./extract/read";
import type { Reading } from "./extract/types";
import { jobFeatures, type JobFeatures } from "./match/features";

const BASE = "https://speedrun-talent-network.com/api/v1";
const SOURCE = "fine-print";

export interface ListedRole {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  published_at: string | null;
  function: string | null;
  seniority: string | null;
  workplace_type: string | null;
  employment_type: string | null;
  remote: boolean;
  comp_min: number | null;
  comp_max: number | null;
  comp_currency: string | null;
  comp_period: string | null;
}

/** A reading plus what the listing asks for. Built once per role, while the description is in hand. */
export interface Analysis {
  reading: Reading;
  features: JobFeatures;
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

/** How long to wait when the board says it is busy. Its retry-after is ten seconds. */
export let RETRY_MS = 10000;
export function setRetryMs(ms: number) {
  RETRY_MS = ms;
}
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

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
  return searchRoles(params, signal);
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);
const numOrNull = (v: unknown) => (typeof v === "number" ? v : null);

export function toListedRole(j: Raw): ListedRole {
  return {
    id: String(j.id),
    title: String(j.title ?? ""),
    company: String(j.company ?? ""),
    location: str(j.location),
    url: String(j.url ?? "").split("?")[0],
    published_at: str(j.published_at),
    function: str(j.function),
    seniority: str(j.seniority),
    workplace_type: str(j.workplace_type),
    employment_type: str(j.employment_type),
    remote: j.remote === true,
    comp_min: numOrNull(j.comp_min),
    comp_max: numOrNull(j.comp_max),
    comp_currency: str(j.comp_currency),
    comp_period: str(j.comp_period),
  };
}

/** One list call with any of the board's own filters (q, lvl, fn, eng, wp, metro, page). */
export async function searchRoles(params: URLSearchParams, signal?: AbortSignal): Promise<RoleList> {
  const body = (await get(`/jobs?${params}`, signal)) as {
    jobs: Raw[];
    total: number;
    page: number;
    has_more: boolean;
    facets?: { lvl?: { v: string; n: number }[] };
  };
  return {
    roles: body.jobs.map(toListedRole),
    total: body.total,
    page: body.page,
    hasMore: body.has_more,
    levelCounts: Object.fromEntries((body.facets?.lvl ?? []).map((f) => [f.v, f.n])),
    fetchedAt: new Date().toISOString(),
  };
}

// Public job data, kept in memory for the visit so the same role is never downloaded twice.
// It holds readings and short excerpts only, and nothing about the visitor.
const analyses = new Map<string, Analysis>();

export async function readRole(key: string, signal?: AbortSignal): Promise<Reading> {
  return (await analyzeRole(key, signal)).reading;
}

/** Reads one role and what it asks for. Retries when the board says it is busy. */
export async function analyzeRole(key: string, signal?: AbortSignal): Promise<Analysis> {
  const hit = analyses.get(key);
  if (hit) return hit;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = (await get(`/jobs/${encodeURIComponent(key)}`, signal)) as { job?: ApiJob };
      if (!body.job) throw new BoardError("down", "The speedrun board sent an empty answer.");
      const reading = readListing(body.job);
      const analysis: Analysis = { reading, features: jobFeatures(body.job.description_text ?? "") };
      for (const k of [key, reading.board.id, reading.board.id.slice(0, 8)]) analyses.set(k, analysis);
      return analysis;
    } catch (e) {
      lastError = e;
      if (!(e instanceof BoardError) || e.kind !== "busy") throw e;
      await sleep(RETRY_MS, signal); // the board's own retry-after
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

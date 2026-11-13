// Finds a bounded pool of live roles for a set of preferences, then analyzes them a few
// at a time. Several searches run (one per wanted title, one per wanted function), the
// results are interleaved and de-duplicated by job id, and the pool is capped.
import { analyzeRole, BoardError, searchRoles, type Analysis, type ListedRole } from "../board";
import type { Preferences } from "../profile";

export const POOL_MAX = 60;
export const BATCH = 15;
/** Detail calls in flight at once. The board rate limits at about two requests a second. */
export const CONCURRENCY = 2;
const GAP_MS = 250;

export interface Query {
  label: string;
  params: Record<string, string>;
}

/** The searches to run. `broad` drops the level, workplace, engagement and metro filters. */
export function buildQueries(prefs: Preferences, broad = false): Query[] {
  const base: Record<string, string> = {};
  if (!broad) {
    if (prefs.levels.values.length) base.lvl = prefs.levels.values.join(",");
    if (prefs.engagement.required && prefs.engagement.values.length === 1) base.eng = prefs.engagement.values[0];
    if (prefs.workplace.required && prefs.workplace.values.length) base.wp = prefs.workplace.values.join(",");
    if (prefs.metros.required && prefs.metros.values.length) base.metro = prefs.metros.values.slice(0, 5).join(",");
  }
  const out: Query[] = [];
  for (const t of prefs.titles.slice(0, 4)) out.push({ label: `“${t}”`, params: { ...base, q: t.slice(0, 120) } });
  for (const f of prefs.functions.slice(0, 3)) out.push({ label: f.replace(/_/g, " "), params: { ...base, fn: f, sort: "new" } });
  return out;
}

/** Round-robin across the result lists so no single search fills the pool. */
export function interleave(lists: ListedRole[][], max = POOL_MAX): ListedRole[] {
  const seen = new Set<string>();
  const out: ListedRole[] = [];
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const r = l[i];
      if (!r || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
      if (out.length >= max) break;
    }
  }
  return out;
}

export interface Retrieved {
  pool: ListedRole[];
  /** How many roles each search found on the board, before the cap. */
  searches: { label: string; total: number; failed: boolean }[];
}

export async function retrieve(prefs: Preferences, broad: boolean, signal: AbortSignal): Promise<Retrieved> {
  const queries = buildQueries(prefs, broad);
  const lists: ListedRole[][] = [];
  const searches: Retrieved["searches"] = [];
  for (const q of queries) {
    try {
      const res = await searchRoles(new URLSearchParams(q.params), signal);
      lists.push(res.roles);
      searches.push({ label: q.label, total: res.total, failed: false });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      lists.push([]);
      searches.push({ label: q.label, total: 0, failed: true });
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }
  if (searches.length && searches.every((s) => s.failed)) throw new BoardError("busy", "The speedrun board did not answer.");
  return { pool: interleave(lists), searches };
}

export type Outcome = { role: ListedRole; analysis: Analysis } | { role: ListedRole; error: "busy" | "not_found" | "down" };

/** Analyzes roles with bounded concurrency. Each result is reported as it lands, a
 *  failure never discards the successes, and an aborted run reports nothing further. */
export async function analyzeAll(roles: ListedRole[], signal: AbortSignal, onResult: (o: Outcome) => void): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < roles.length && !signal.aborted) {
      const role = roles[next++];
      try {
        const analysis = await analyzeRole(role.id, signal);
        if (signal.aborted) return;
        onResult({ role, analysis });
      } catch (e) {
        if (signal.aborted || (e as Error).name === "AbortError") return;
        onResult({ role, error: e instanceof BoardError ? e.kind : "down" });
      }
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, roles.length) }, worker));
}

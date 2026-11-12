import { segment, type Sentence } from "./segment";
import { RULES, type Hit } from "./rules";
import { GATES, type BoardFacts, type Gate, type LabelConflict, type Reading, type Requirement } from "./types";

export const EXTRACTOR_VERSION = "0.2.0";
const MAX_QUOTE = 320;
const TEXT_CAP = 15000; // the API caps description_text here

/** Shape of `job` in GET /api/v1/jobs/{id}. Only the fields we read. */
export interface ApiJob {
  id: string;
  status: "open" | "closed";
  url: string;
  title: string;
  company: string;
  tier?: string;
  stealth: boolean;
  location?: string | null;
  workplace_type?: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  comp_summary?: string | null;
  comp_min?: number | null;
  comp_max?: number | null;
  comp_currency?: string | null;
  comp_period?: string | null;
  published_at?: string | null;
  description_text?: string | null;
  labels?: {
    seniority?: string | null;
    min_experience?: string | null;
    workplace?: string | null;
    engagement?: string | null;
  } | null;
}

function quoteSpan(text: string, s: Sentence, hit: Hit): { start: number; end: number } {
  let start = s.start;
  let end = s.end;
  if (hit.withHeading && s.heading) start = s.heading.start;
  if (end - start > MAX_QUOTE) end = start + MAX_QUOTE;
  // do not cut inside a word
  if (end < s.end) {
    const sp = text.lastIndexOf(" ", end);
    if (sp > start + 80) end = sp;
  }
  return { start, end };
}

export function boardFacts(job: ApiJob): BoardFacts {
  return {
    id: job.id,
    status: job.status,
    url: job.url.split("?")[0],
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    workplace_type: job.workplace_type ?? null,
    employment_type: job.employment_type ?? null,
    seniority: job.seniority ?? null,
    label_seniority: job.labels?.seniority ?? null,
    label_min_experience: job.labels?.min_experience ?? null,
    label_workplace: job.labels?.workplace ?? null,
    label_engagement: job.labels?.engagement ?? null,
    comp_summary: job.comp_summary ?? null,
    comp_min: job.comp_min ?? null,
    comp_max: job.comp_max ?? null,
    comp_currency: job.comp_currency ?? null,
    comp_period: job.comp_period ?? null,
    published_at: job.published_at ?? null,
    stealth: job.stealth,
    tier: job.tier ?? null,
  };
}

const STRENGTH_RANK = { required: 0, alternative: 1, info: 2, preferred: 3 } as const;

export function extractRequirements(text: string, opts: { isInternLike: boolean }): Requirement[] {
  const sentences = segment(text);
  const found: Requirement[] = [];
  for (const s of sentences) {
    if (s.boilerplate) continue;
    const labelOnly = /:\s*$/.test(s.text);
    for (const rule of RULES) {
      if (labelOnly && rule.gate !== "pay") continue; // a bare "Security Clearance Requirement:" states nothing
      const hit = rule.match(s, opts);
      if (!hit) continue;
      const { start, end } = quoteSpan(text, s, hit);
      found.push({
        gate: rule.gate,
        kind: hit.kind,
        strength: hit.strength ?? "required",
        summary: hit.summary,
        quote: text.slice(start, end),
        start,
        end,
        rule_id: rule.id,
        ...(hit.value ? { value: hit.value } : {}),
        ...(hit.note ? { note: hit.note } : {}),
      });
    }
  }
  // One requirement per kind: keep the strongest statement, then the earliest.
  const best = new Map<string, Requirement>();
  for (const r of found) {
    const key = `${r.gate}:${r.kind}`;
    const cur = best.get(key);
    if (!cur || STRENGTH_RANK[r.strength] < STRENGTH_RANK[cur.strength]) best.set(key, r);
  }
  // A single stated figure is dropped when a range was also found.
  if (best.has("pay:pay_range")) best.delete("pay:pay_single");
  return [...best.values()].sort((a, b) => GATES.indexOf(a.gate) - GATES.indexOf(b.gate) || a.start - b.start);
}

function conflicts(board: BoardFacts, reqs: Requirement[]): LabelConflict[] {
  const out: LabelConflict[] = [];
  const level = (board.label_seniority ?? board.seniority ?? "").toLowerCase();
  reqs.forEach((r, i) => {
    // A Ph.D. floor contradicts a "junior" label. New-grad roles for Ph.D. graduates are consistent.
    if (r.kind === "degree_phd" && r.strength === "required" && /junior|entry/.test(level) && !/ph\.?\s?d|doctor/i.test(board.title)) {
      out.push({
        field: "level",
        board_label: board.label_seniority ?? board.seniority ?? "",
        text_says: "Ph.D. required",
        rule_id: "conflict.level_phd",
        requirement_index: i,
      });
    }
    if (r.kind === "years" && r.strength === "required") {
      const min = Number(r.value?.min ?? 0);
      const limit = /intern|new/.test(level) ? 2 : /junior|entry/.test(level) ? 4 : null;
      if (limit !== null && min >= limit) {
        out.push({
          field: "experience",
          board_label: board.label_seniority ?? board.seniority ?? "",
          text_says: r.summary,
          rule_id: "conflict.level_years",
          requirement_index: i,
        });
      } else if (/^no experience/i.test(board.label_min_experience ?? "") && min >= 1) {
        out.push({
          field: "experience",
          board_label: board.label_min_experience ?? "",
          text_says: r.summary,
          rule_id: "conflict.minexp_years",
          requirement_index: i,
        });
      }
    }
    const wp = (board.workplace_type ?? board.label_workplace ?? "").toLowerCase();
    if (r.kind === "remote" && /onsite|on-site/.test(wp)) {
      out.push({
        field: "workplace",
        board_label: board.workplace_type ?? board.label_workplace ?? "",
        text_says: r.summary,
        rule_id: "conflict.workplace_remote",
        requirement_index: i,
      });
    }
    if ((r.kind === "onsite" || r.kind === "office_days") && /^remote/.test(wp)) {
      out.push({
        field: "workplace",
        board_label: board.workplace_type ?? board.label_workplace ?? "",
        text_says: r.summary,
        rule_id: "conflict.workplace_onsite",
        requirement_index: i,
      });
    }
  });
  return out;
}

export function readListing(job: ApiJob, now: Date = new Date()): Reading {
  const board = boardFacts(job);
  const text = job.description_text ?? "";
  const level = `${board.label_seniority ?? ""} ${board.seniority ?? ""} ${board.label_engagement ?? ""} ${board.employment_type ?? ""} ${board.title}`;
  const isInternLike = /\b(intern|internship|co-?op)\b/i.test(level);
  const requirements = text ? extractRequirements(text, { isInternLike }) : [];
  const has = new Set<Gate>(requirements.map((r) => r.gate));
  if (board.comp_min != null || board.comp_max != null) has.add("pay");
  return {
    board,
    requirements,
    label_conflicts: conflicts(board, requirements),
    silent_gates: GATES.filter((g) => g !== "terms" && !has.has(g)),
    text: { length: text.length, truncated: text.length >= TEXT_CAP, available: text.length > 0 },
    read_at: now.toISOString(),
    extractor_version: EXTRACTOR_VERSION,
  };
}

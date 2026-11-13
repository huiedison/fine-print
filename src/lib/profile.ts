// One profile for the whole app: facts the person states directly, what was read
// from their resume (and then reviewed by them), and what they want.
//
// Rules this file enforces:
// - Unknown stays unknown. A field is undefined until the person confirms it.
// - Nothing about work authorization, enrollment or location is inferred from a resume.
// - Enrollment is asked directly. A graduation date alone does not establish it.
import type { Profile as CompareProfile } from "./compare";

export type DegreeLevel = "associate" | "bachelor" | "master" | "phd";
export type Country = "US" | "CA" | "other";
export type Workplace = "remote" | "hybrid" | "onsite";
export type Engagement = "internship" | "full_time";
export type Level = "intern" | "new_grad" | "junior" | "mid" | "senior";

/** Facts only the person can state. All optional. */
export interface Facts {
  workAuth?: "citizen" | "pr" | "other_no_sponsor" | "needs_sponsor";
  enrolled?: "yes" | "no";
  returning?: "yes" | "no";
  /** YYYY-MM */
  gradMonth?: string;
  degree?: DegreeLevel;
  degreeStatus?: "in_progress" | "completed";
  /** Years of full-time work, as confirmed by the person. */
  yearsFullTime?: number;
  countries?: Country[];
  inPerson?: "yes" | "no";
}

/** A span of the resume text that supports a claim. */
export interface Evidence {
  quote: string;
  start: number;
  end: number;
  /** Which part of the resume it came from. */
  section: "skills" | "experience" | "projects" | "education" | "summary" | "other";
  /** For experience and project evidence: the entry it belongs to. */
  where?: string;
}

export interface SkillClaim {
  /** Stable taxonomy id, or "custom:<name>" for one the person typed. */
  id: string;
  name: string;
  /** listed: named in a skills section. shown: found in described work. added: typed in by the person. */
  basis: "listed" | "shown" | "added";
  evidence: Evidence[];
}

export interface ExperienceEntry {
  title: string;
  org: string;
  /** YYYY-MM, or null when the resume gives none. */
  start: string | null;
  /** YYYY-MM, "present", or null. */
  end: string | null;
  kind: "internship" | "full_time" | "part_time" | "other";
  bullets: Evidence[];
  evidence: Evidence;
}

export interface ProjectEntry {
  name: string;
  bullets: Evidence[];
  evidence: Evidence;
}

export interface EducationEntry {
  school: string;
  degree: DegreeLevel | null;
  field: string | null;
  /** YYYY-MM */
  end: string | null;
  /** True when the resume says "expected", "anticipated" or similar. */
  expected: boolean;
  evidence: Evidence;
}

export interface ResumeProfile {
  fileName: string | null;
  skills: SkillClaim[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
}

export interface Preference<T> {
  values: T[];
  /** true: a must-have. false: nice to have. */
  required: boolean;
}

export interface Preferences {
  /** Desired job titles. These guide the search even when past titles differ. */
  titles: string[];
  /** speedrun function keys, e.g. "operations". */
  functions: string[];
  levels: Preference<Level>;
  workplace: Preference<Workplace>;
  engagement: Preference<Engagement>;
  /** speedrun metro keys, e.g. "sf", "tor". Countries live in facts.countries. */
  metros: Preference<string>;
  salary?: { min: number; currency: "USD" | "CAD"; period: "year" | "hour" | "month"; required: boolean };
}

export interface CandidateProfile {
  version: 3;
  facts: Facts;
  resume: ResumeProfile | null;
  prefs: Preferences;
}

export const EMPTY_PREFS: Preferences = {
  titles: [],
  functions: [],
  levels: { values: [], required: false },
  workplace: { values: [], required: false },
  engagement: { values: [], required: false },
  metros: { values: [], required: false },
};

export function emptyProfile(): CandidateProfile {
  return { version: 3, facts: {}, resume: null, prefs: structuredClone(EMPTY_PREFS) };
}

// ---------- validation and migration ----------

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const month = (v: unknown) => (typeof v === "string" && /^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(v) ? v : undefined);
const listOf = <T extends string>(v: unknown, allowed: readonly T[]): T[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = [...new Set(v.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x)))];
  return out.length ? out : undefined;
};
const strings = (v: unknown, max: number, maxLen = 80) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, maxLen)).filter(Boolean))].slice(0, max) : [];

const AUTH = ["citizen", "pr", "other_no_sponsor", "needs_sponsor"] as const;
const YES_NO = ["yes", "no"] as const;
const COUNTRIES = ["US", "CA", "other"] as const;
const DEGREES = ["associate", "bachelor", "master", "phd"] as const;
export const LEVEL_KEYS = ["intern", "new_grad", "junior", "mid", "senior"] as const;
export const WORKPLACE_KEYS = ["remote", "hybrid", "onsite"] as const;
export const ENGAGEMENT_KEYS = ["internship", "full_time"] as const;

export function validFacts(raw: unknown): Facts {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const years = typeof r.yearsFullTime === "number" && r.yearsFullTime >= 0 && r.yearsFullTime <= 60 ? Math.round(r.yearsFullTime * 10) / 10 : undefined;
  const facts: Facts = {
    workAuth: oneOf(r.workAuth, AUTH),
    enrolled: oneOf(r.enrolled, YES_NO),
    returning: oneOf(r.returning, YES_NO),
    gradMonth: month(r.gradMonth),
    degree: oneOf(r.degree, DEGREES),
    degreeStatus: oneOf(r.degreeStatus, ["in_progress", "completed"] as const),
    yearsFullTime: years,
    countries: listOf(r.countries, COUNTRIES),
    inPerson: oneOf(r.inPerson, YES_NO),
  };
  return Object.fromEntries(Object.entries(facts).filter(([, v]) => v !== undefined)) as Facts;
}

/** fine_print.answers.v2 held { workAuth, gradMonth, countries, inPerson }.
 *  Those four carry over. Everything new (enrollment, return to school, degree,
 *  experience) starts unknown. In particular, enrollment is NOT derived from gradMonth. */
export function migrateAnswersV2(raw: unknown): Facts {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return validFacts({ workAuth: r.workAuth, gradMonth: r.gradMonth, countries: r.countries, inPerson: r.inPerson });
}

function validPref<T extends string>(raw: unknown, allowed: readonly T[] | null): Preference<T> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const values = allowed ? (listOf(r.values, allowed) ?? []) : (strings(r.values, 5, 12).filter((s) => /^[a-z]{2,4}$/.test(s)) as T[]);
  return { values, required: r.required === true && values.length > 0 };
}

export function validPrefs(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (r.salary && typeof r.salary === "object" ? r.salary : null) as Record<string, unknown> | null;
  const min = s && typeof s.min === "number" && s.min > 0 && s.min < 10_000_000 ? s.min : null;
  return {
    titles: strings(r.titles, 6),
    functions: strings(r.functions, 6, 40).filter((f) => /^[a-z_]+$/.test(f)),
    levels: validPref(r.levels, LEVEL_KEYS),
    workplace: validPref(r.workplace, WORKPLACE_KEYS),
    engagement: validPref(r.engagement, ENGAGEMENT_KEYS),
    metros: validPref<string>(r.metros, null),
    ...(s && min
      ? {
          salary: {
            min,
            currency: oneOf(s.currency, ["USD", "CAD"] as const) ?? "USD",
            period: oneOf(s.period, ["year", "hour", "month"] as const) ?? "year",
            required: s.required === true,
          },
        }
      : {}),
  };
}

function validEvidence(raw: unknown): Evidence | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.quote !== "string" || typeof r.start !== "number" || typeof r.end !== "number") return null;
  return {
    quote: r.quote.slice(0, 400),
    start: r.start,
    end: r.end,
    section: oneOf(r.section, ["skills", "experience", "projects", "education", "summary", "other"] as const) ?? "other",
    ...(typeof r.where === "string" ? { where: r.where.slice(0, 120) } : {}),
  };
}

function validResume(raw: unknown): ResumeProfile | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter((x) => x && typeof x === "object") : []);
  const evs = (v: unknown) => arr(v).map(validEvidence).filter((e): e is Evidence => !!e);
  const str = (v: unknown, n = 120) => (typeof v === "string" ? v.slice(0, n) : "");
  const none: Evidence = { quote: "", start: 0, end: 0, section: "other" };
  return {
    fileName: typeof r.fileName === "string" ? r.fileName.slice(0, 120) : null,
    skills: arr(r.skills)
      .filter((s) => typeof s.id === "string" && typeof s.name === "string")
      .slice(0, 120)
      .map((s) => ({ id: str(s.id, 60), name: str(s.name, 60), basis: oneOf(s.basis, ["listed", "shown", "added"] as const) ?? "added", evidence: evs(s.evidence).slice(0, 4) })),
    experience: arr(r.experience)
      .slice(0, 30)
      .map((e) => ({
        title: str(e.title),
        org: str(e.org),
        start: month(e.start) ?? null,
        end: e.end === "present" ? "present" : (month(e.end) ?? null),
        kind: oneOf(e.kind, ["internship", "full_time", "part_time", "other"] as const) ?? "other",
        bullets: evs(e.bullets).slice(0, 20),
        evidence: validEvidence(e.evidence) ?? none,
      })),
    projects: arr(r.projects)
      .slice(0, 30)
      .map((p) => ({ name: str(p.name), bullets: evs(p.bullets).slice(0, 20), evidence: validEvidence(p.evidence) ?? none })),
    education: arr(r.education)
      .slice(0, 10)
      .map((e) => ({
        school: str(e.school),
        degree: oneOf(e.degree, DEGREES) ?? null,
        field: typeof e.field === "string" ? e.field.slice(0, 120) : null,
        end: month(e.end) ?? null,
        expected: e.expected === true,
        evidence: validEvidence(e.evidence) ?? none,
      })),
  };
}

/** Reads anything that was saved by this or an earlier version and returns a valid profile. */
export function validProfile(raw: unknown): CandidateProfile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.version !== 3) return { ...emptyProfile(), facts: migrateAnswersV2(raw) };
  return { version: 3, facts: validFacts(r.facts), resume: validResume(r.resume), prefs: validPrefs(r.prefs) };
}

// ---------- experience arithmetic ----------

const toIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/** Months covered by the given entries, counting overlapping months once. */
export function monthsCovered(entries: Pick<ExperienceEntry, "start" | "end">[], now: Date): number {
  const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const spans = entries
    .filter((e) => e.start)
    .map((e) => [toIndex(e.start as string), e.end === "present" || !e.end ? (e.end === "present" ? nowIdx : toIndex(e.start as string)) : toIndex(e.end)] as [number, number])
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curEnd = -Infinity;
  for (const [a, b] of spans) {
    const from = Math.max(a, curEnd + 1);
    if (b >= from) total += b - from + 1;
    curEnd = Math.max(curEnd, b);
  }
  return total;
}

/** Full-time years the resume shows. A starting point for the person to confirm, never used unconfirmed. */
export function resumeYearsFullTime(resume: ResumeProfile | null, now: Date): number {
  if (!resume) return 0;
  return Math.round((monthsCovered(resume.experience.filter((e) => e.kind === "full_time"), now) / 12) * 10) / 10;
}

// ---------- adapters ----------

/** What compare.ts needs. Only confirmed facts are passed; nothing is inferred. */
export function toCompareProfile(facts: Facts): CompareProfile {
  return {
    workAuth: facts.workAuth,
    student: facts.enrolled === "yes" ? "enrolled" : facts.enrolled === "no" ? "graduated" : undefined,
    degree: facts.degree === "associate" ? undefined : facts.degree,
    gradMonth: facts.gradMonth,
    returning: facts.returning,
    years: facts.yearsFullTime,
  };
}

/** Number of the direct questions that have an answer. */
export function factsAnswered(f: Facts): number {
  return [f.workAuth, f.enrolled, f.gradMonth, f.countries?.length || f.inPerson].filter(Boolean).length;
}

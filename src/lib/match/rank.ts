// Scores one analyzed role against a reviewed profile and explains the score.
//
// The score is a rubric total out of 16. It says how much of what the listing asks for
// is backed by evidence in the resume and by stated preferences. It is NOT a probability
// of an interview or an offer, and the UI shows a plain label, not the number.
//
//   Role you asked for      0-4   the listing's title or function against the titles you want
//   Required skills         0-4   share of the listing's required items your resume backs
//   Demonstrated work       0-4   share of the kinds of work the listing describes that your resume shows
//   Level                   0-2   stated years against your confirmed years, and your level preference
//   Preferences             0-2   share of your flexible preferences the role meets
//
// Labels: strong 13-16, good 10-12, possible 7-9, weak 0-6.
//
// Eligibility (work authorization, school status, place) is a separate dimension and
// never changes the score. Roles are ordered by label, then no-conflict before conflict,
// then score, then newest, then id.
import type { Analysis, ListedRole } from "../board";
import { gateResults, type GateResult } from "../gates";
import { countryOf } from "../place";
import type { CandidateProfile, Engagement, Evidence, Level, SkillClaim, Workplace } from "../profile";
import type { JobTerm } from "./features";

export type Label = "strong" | "good" | "possible" | "weak";
export const LABEL_TEXT: Record<Label, string> = {
  strong: "Strong match",
  good: "Good match",
  possible: "Possible match",
  weak: "Weak match",
};
const LABEL_RANK: Record<Label, number> = { strong: 0, good: 1, possible: 2, weak: 3 };

export type Eligibility = "conflict" | "unknown" | "no_conflict";
export const ELIGIBILITY_TEXT: Record<Eligibility, string> = {
  conflict: "Stated eligibility conflict",
  unknown: "Eligibility not confirmed",
  no_conflict: "No stated eligibility conflict",
};

/** One piece of resume evidence set beside the line of the listing it answers. */
export interface Pair {
  name: string;
  kind: JobTerm["kind"];
  strength: JobTerm["strength"];
  job: { quote: string; start: number; end: number };
  resume: Evidence | null;
  /** listed: named in your skills. shown: found in described work. added: you typed it in. */
  basis: SkillClaim["basis"];
}

export interface Gap {
  name: string;
  strength: JobTerm["strength"];
  job: { quote: string; start: number; end: number };
}

export interface Reason {
  text: string;
  job: string;
  resume: string | null;
}

export interface PrefCheck {
  name: string;
  status: "met" | "missed" | "unknown";
  required: boolean;
  note: string;
}

export interface Match {
  role: ListedRole;
  analysis: Analysis;
  score: number;
  parts: { role: number; required: number; work: number; level: number; prefs: number };
  label: Label;
  eligibility: Eligibility;
  eligibilityNotes: string[];
  gates: GateResult[];
  reasons: Reason[];
  pairs: Pair[];
  gaps: Gap[];
  uncertainties: string[];
  prefs: PrefCheck[];
  missedMustHaves: string[];
  workplace: Workplace | null;
  pay: string | null;
}

const STOP = new Set(["and", "the", "of", "for", "in", "at", "a", "an", "to", "with", "i", "ii", "iii", "&", "-", "–", "summer", "fall", "winter", "spring", "program", "us"]);
const LEVEL_WORDS = new Set(["intern", "internship", "co", "op", "coop", "junior", "jr", "senior", "sr", "associate", "new", "grad", "graduate", "entry", "level", "lead", "staff", "principal", "early", "career"]);
const stem = (w: string) => w.replace(/(ing|ement|ment|ions?|ers?|ors?|s)$/, "").replace(/e$/, "");

export function titleTokens(s: string): string[] {
  return [
    ...new Set(
      s
        .toLowerCase()
        .replace(/[^a-z+#/ ]+/g, " ")
        .split(/[\s/]+/)
        .filter((w) => w.length > 1 && !STOP.has(w) && !LEVEL_WORDS.has(w) && !/^\d+$/.test(w))
        .map(stem),
    ),
  ];
}

/** Share of the wanted title's words that appear in the job title. */
export function titleOverlap(wanted: string, jobTitle: string): number {
  const w = titleTokens(wanted);
  if (!w.length) return 0;
  const j = new Set(titleTokens(jobTitle));
  return w.filter((t) => j.has(t)).length / w.length;
}

function jobWorkplace(role: ListedRole, a: Analysis): Workplace | null {
  const t = `${role.workplace_type ?? ""} ${a.reading.board.label_workplace ?? ""}`.toLowerCase();
  if (/remote/.test(t) || role.remote) return "remote";
  if (/hybrid/.test(t)) return "hybrid";
  if (/on-?site/.test(t)) return "onsite";
  return null;
}

function jobEngagement(role: ListedRole, a: Analysis): Engagement | null {
  const t = `${a.reading.board.label_engagement ?? ""} ${role.employment_type ?? ""} ${role.seniority ?? ""}`.toLowerCase();
  if (/intern/.test(t)) return "internship";
  if (/full/.test(t)) return "full_time";
  return null;
}

function jobLevel(role: ListedRole, a: Analysis): Level | null {
  const t = `${a.reading.board.label_seniority ?? ""} ${role.seniority ?? ""}`.toLowerCase();
  if (/intern/.test(t)) return "intern";
  if (/new/.test(t)) return "new_grad";
  if (/junior|entry/.test(t)) return "junior";
  if (/mid/.test(t)) return "mid";
  if (/senior|staff|lead|principal|director|exec/.test(t)) return "senior";
  return null;
}

const METRO: Record<string, RegExp> = {
  sf: /San Francisco|Oakland|Berkeley/i,
  sv: /Palo Alto|Mountain View|Sunnyvale|San Jose|Santa Clara|Menlo Park|Cupertino|Redwood City|San Mateo|Los Altos|Milpitas/i,
  nyc: /New York|Brooklyn|NYC|Manhattan/i,
  la: /Los Angeles|El Segundo|Santa Monica|Culver City|Long Beach|Hawthorne|Torrance/i,
  oc: /Irvine|Costa Mesa|Newport Beach|Orange County/i,
  sd: /San Diego/i,
  sea: /Seattle|Bellevue|Redmond|Kirkland/i,
  bos: /Boston|Cambridge, MA|Somerville|Waltham/i,
  aus: /Austin/i,
  dal: /Dallas|Plano|Irving|Fort Worth/i,
  chi: /Chicago/i,
  dc: /Washington|Arlington|Reston|McLean|Sterling, V/i,
  atl: /Atlanta/i,
  tor: /Toronto|Mississauga|Waterloo|Kitchener/i,
  lon: /London/i,
};
export const METRO_NAME: Record<string, string> = {
  sf: "San Francisco", sv: "Silicon Valley", nyc: "New York", la: "Los Angeles", oc: "Orange County", sd: "San Diego", sea: "Seattle",
  bos: "Boston", aus: "Austin", dal: "Dallas", chi: "Chicago", dc: "Washington, D.C.", atl: "Atlanta", tor: "Toronto", lon: "London",
};

function payOf(role: ListedRole, a: Analysis): { text: string; min: number; max: number; period: string; currency: string } | null {
  const f = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (role.comp_min != null || role.comp_max != null) {
    const min = (role.comp_min ?? role.comp_max) as number;
    const max = (role.comp_max ?? role.comp_min) as number;
    const period = role.comp_period ?? "year";
    return { text: `${min === max ? f(min) : `${f(min)} to ${f(max)}`} per ${period} (posted on the board)`, min, max, period, currency: role.comp_currency ?? "USD" };
  }
  const p = a.reading.requirements.find((r) => r.gate === "pay");
  if (p?.value && typeof p.value.min === "number" && typeof p.value.max === "number")
    return { text: `${p.summary} (found in the description)`, min: p.value.min, max: p.value.max, period: String(p.value.period), currency: String(p.value.currency ?? "USD") };
  return null;
}

function prefChecks(profile: CandidateProfile, role: ListedRole, a: Analysis, wp: Workplace | null): PrefCheck[] {
  const { prefs } = profile;
  const out: PrefCheck[] = [];
  if (prefs.workplace.values.length) {
    out.push({
      name: "Workplace",
      required: prefs.workplace.required,
      status: !wp ? "unknown" : prefs.workplace.values.includes(wp) ? "met" : "missed",
      note: !wp ? "The board does not label remote, hybrid or on-site for this role." : `The board labels this role ${wp === "onsite" ? "on-site" : wp}.`,
    });
  }
  if (prefs.engagement.values.length) {
    const e = jobEngagement(role, a);
    out.push({
      name: "Internship or full-time",
      required: prefs.engagement.required,
      status: !e ? "unknown" : prefs.engagement.values.includes(e) ? "met" : "missed",
      note: !e ? "The board does not say whether this is an internship or full-time." : `The board labels this ${e === "internship" ? "an internship" : "full-time"}.`,
    });
  }
  if (prefs.levels.values.length) {
    const l = jobLevel(role, a);
    out.push({
      name: "Level",
      required: prefs.levels.required,
      status: !l ? "unknown" : prefs.levels.values.includes(l) ? "met" : "missed",
      note: !l ? "The board gives no level for this role." : `The board labels this role ${l.replace("_", " ")}.`,
    });
  }
  if (prefs.metros.values.length) {
    const loc = role.location ?? "";
    const known = !!loc && (!!countryOf(loc) || Object.values(METRO).some((re) => re.test(loc)));
    const hit = prefs.metros.values.some((m) => METRO[m]?.test(loc));
    out.push({
      name: "Location",
      required: prefs.metros.required,
      status: hit ? "met" : wp === "remote" || !known ? "unknown" : "missed",
      note: loc ? `The board lists this role in ${loc}.` : "The board gives no location.",
    });
  }
  if (prefs.salary) {
    const pay = payOf(role, a);
    const s = prefs.salary;
    const comparable = pay && pay.period === s.period && pay.currency === s.currency;
    out.push({
      name: "Pay",
      required: s.required,
      status: !comparable ? "unknown" : pay.max >= s.min ? "met" : "missed",
      note: !pay ? "No pay is posted or found in the description." : !comparable ? `Pay is given as ${pay.text}, which is not in the currency and period you chose.` : `Pay is ${pay.text}.`,
    });
  }
  return out;
}

/** Strong 13-16, good 10-12, possible 7-9, weak 0-6. */
const labelOf = (score: number): Label => (score >= 13 ? "strong" : score >= 10 ? "good" : score >= 7 ? "possible" : "weak");

export function scoreRole(profile: CandidateProfile, role: ListedRole, analysis: Analysis): Match {
  const { prefs, facts, resume } = profile;
  const claims = new Map((resume?.skills ?? []).map((s) => [s.id, s]));
  const uncertainties: string[] = [];

  // --- role you asked for
  const best = prefs.titles.map((t) => ({ t, o: titleOverlap(t, role.title) })).sort((x, y) => y.o - x.o)[0];
  const fnHit = !!role.function && prefs.functions.includes(role.function);
  let rolePts = 2;
  if (prefs.titles.length || prefs.functions.length) rolePts = best && best.o >= 0.99 ? 4 : best && best.o >= 0.5 ? 3 : (best && best.o > 0) || fnHit ? 2 : 0;

  // --- skills and work
  const pairs: Pair[] = [];
  const gaps: Gap[] = [];
  for (const t of analysis.features.terms) {
    const c = claims.get(t.id);
    const job = { quote: t.quote, start: t.start, end: t.end };
    if (c) {
      // prefer evidence from described work over a bare listing in a skills section
      const e = c.evidence.find((x) => x.section === "experience" || x.section === "projects") ?? c.evidence[0] ?? null;
      pairs.push({ name: t.name, kind: t.kind, strength: t.strength, job, resume: e, basis: c.basis });
    } else if (t.strength !== "mentioned") gaps.push({ name: t.name, strength: t.strength, job });
  }
  const required = analysis.features.terms.filter((t) => t.strength === "required");
  const requiredMet = pairs.filter((p) => p.strength === "required").length;
  const requiredPts = required.length ? Math.round((4 * requiredMet) / required.length) : 2;
  if (!required.length) uncertainties.push("The listing names no required skills that fine_print recognizes, so that part of the score is neutral.");
  const workShown = pairs.filter((p) => p.kind === "work" && p.resume && (p.resume.section === "experience" || p.resume.section === "projects"));
  // share of the kinds of work the listing describes, so a listing that describes a lot is not matched by one line
  const workAsked = analysis.features.terms.filter((t) => t.kind === "work").length;
  const workPts = workAsked ? Math.min(4, Math.round((4 * workShown.length) / Math.max(workAsked, 3))) : 0;

  // --- level
  const years = analysis.reading.requirements.find((r) => r.kind === "years" && r.strength === "required");
  const minYears = years ? Number(years.value?.min ?? 0) : null;
  let levelPts: number;
  if (minYears != null) {
    if (facts.yearsFullTime == null) {
      levelPts = 1;
      uncertainties.push(`The listing asks for ${years?.summary.toLowerCase()}. You have not confirmed your years of full-time work.`);
    } else levelPts = facts.yearsFullTime >= minYears ? 2 : facts.yearsFullTime >= minYears - 1 ? 1 : 0;
  } else {
    const l = jobLevel(role, analysis);
    levelPts = !prefs.levels.values.length || (l && prefs.levels.values.includes(l)) ? 2 : 1;
  }

  // --- preferences
  const wp = jobWorkplace(role, analysis);
  const checks = prefChecks(profile, role, analysis, wp);
  const flexible = checks.filter((c) => !c.required);
  const prefPts = flexible.length ? Math.round((2 * flexible.filter((c) => c.status === "met").length) / flexible.length) : 1;
  const missedMustHaves = checks.filter((c) => c.required && c.status === "missed").map((c) => `${c.name}: ${c.note}`);
  for (const c of checks.filter((x) => x.status === "unknown")) uncertainties.push(`${c.name}: ${c.note}`);

  // --- eligibility, kept apart from the score
  const gates = gateResults(analysis.reading, facts);
  const elig = gates.filter((g) => g.gate === "work_auth" || g.gate === "school" || g.gate === "place_time");
  const blocked = elig.filter((g) => g.state === "blocked");
  const open = elig.filter((g) => g.state === "unclear" || (g.gate === "work_auth" && g.state === "silent"));
  const eligibility: Eligibility = blocked.length ? "conflict" : open.length ? "unknown" : "no_conflict";
  const eligibilityNotes = (blocked.length ? blocked : open).map((g) => g.because);
  const expGate = gates.find((g) => g.gate === "experience");
  if (expGate?.state === "blocked") gaps.unshift(...expGate.lines.filter((l) => l.state === "blocked").map((l) => ({ name: l.r.summary, strength: "required" as const, job: { quote: l.r.quote, start: l.r.start, end: l.r.end } })));

  // --- reasons: each one carries the listing's words, and the resume's where there are any
  const reasons: Reason[] = [];
  if (best && best.o >= 0.5) reasons.push({ text: `The title is close to “${best.t}”, which you asked for.`, job: role.title, resume: null });
  else if (fnHit) reasons.push({ text: `The board files this under ${role.function?.replace(/_/g, " ")}, a function you asked for.`, job: role.title, resume: null });
  const ordered = [...pairs].filter((p) => p.resume).sort((a, b) => Number(b.strength === "required") - Number(a.strength === "required") || Number(b.kind === "work") - Number(a.kind === "work") || Number(b.resume?.section !== "skills") - Number(a.resume?.section !== "skills"));
  const used = new Set<number>();
  for (const p of ordered) {
    if (reasons.length >= 3) break;
    if (!p.resume || used.has(p.resume.start)) continue; // one resume line per reason
    used.add(p.resume.start);
    const ask = p.strength === "required" ? "asks for" : p.strength === "preferred" ? "prefers" : "describes";
    reasons.push({
      text: p.kind === "work" ? `The listing ${ask} ${p.name.toLowerCase()}, and your resume shows it.` : `The listing ${ask} ${p.name}, which ${p.basis === "listed" && p.resume.section === "skills" ? "you list" : "your resume shows"}.`,
      job: p.job.quote,
      resume: p.resume.quote,
    });
  }

  const parts = { role: rolePts, required: requiredPts, work: workPts, level: levelPts, prefs: prefPts };
  const score = rolePts + requiredPts + workPts + levelPts + prefPts;
  return {
    role, analysis, score, parts, label: labelOf(score), eligibility, eligibilityNotes, gates, reasons, pairs, gaps, uncertainties,
    prefs: checks, missedMustHaves, workplace: wp, pay: payOf(role, analysis)?.text ?? null,
  };
}

/** Stable order: label, then no conflict before conflict or a missed must-have, then score, newest, id. */
export function compareMatches(a: Match, b: Match): number {
  const hold = (m: Match) => Number(m.eligibility === "conflict" || m.missedMustHaves.length > 0);
  return (
    LABEL_RANK[a.label] - LABEL_RANK[b.label] ||
    hold(a) - hold(b) ||
    b.score - a.score ||
    (b.role.published_at ?? "").localeCompare(a.role.published_at ?? "") ||
    a.role.id.localeCompare(b.role.id)
  );
}

export function rankMatches(matches: Match[]): Match[] {
  return [...matches].sort(compareMatches);
}

// Reads resume text into a structured profile. Every claim keeps the span of resume
// text it came from. Rules only: no model, nothing leaves the browser.
//
// What this never does: guess work authorization, location preference or current
// enrollment. Those are asked directly.
import { TERMS } from "../match/taxonomy";
import type { DegreeLevel, EducationEntry, Evidence, ExperienceEntry, ProjectEntry, ResumeProfile, SkillClaim } from "../profile";

type Section = Evidence["section"];
interface Line {
  text: string;
  start: number;
  end: number;
  bullet: boolean;
  section: Section;
  /** experience-like sections that are not paid work (leadership, activities, volunteering) */
  side: boolean;
}

const HEADINGS: [RegExp, Section, boolean][] = [
  [/^(technical |core |key |relevant )?(skills|technologies|tools|competencies|languages)( (&|and) (interests|tools|technologies|certifications))?:?$/i, "skills", false],
  [/^(work |professional |relevant |employment )?(experience|employment|work history)( & leadership)?:?$/i, "experience", false],
  [/^(leadership|activities|extracurriculars?|volunteer(ing)?|involvement|community)( (&|and) (activities|leadership|involvement|experience))?( experience)?:?$/i, "experience", true],
  [/^(selected |personal |academic |technical |relevant )?projects:?$/i, "projects", false],
  [/^education( (&|and) (honou?rs|awards|certifications))?:?$/i, "education", false],
  [/^(summary|profile|objective|about( me)?)( statement)?:?$/i, "summary", false],
  [/^(awards|honou?rs|certifications|publications|interests|references|courses|coursework)( (&|and) [a-z ]+)?:?$/i, "other", false],
];

const BULLET = /^\s*([•●◦▪■‣⁃∙·*–—-]|o(?=\s))\s+/;
const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12", spring: "05", summer: "08", fall: "12", autumn: "12", winter: "01" };
const MON = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter)\.?`;
const DATE = String.raw`(?:(${MON})\s+)?((?:19|20)\d\d)|(\d{1,2})\/((?:19|20)\d\d)`;
const RANGE = new RegExp(String.raw`(?:${DATE})\s*(?:-|–|—|to|until)\s*(?:(present|current|now|ongoing)|${DATE})`, "i");
const SINGLE = new RegExp(DATE, "gi");

function ym(mon: string | undefined, year: string | undefined, mm: string | undefined, yy: string | undefined, end: boolean): string | null {
  if (mm && yy) return `${yy}-${mm.padStart(2, "0")}`;
  if (!year) return null;
  const key = mon?.toLowerCase().replace(".", "");
  const m = key ? (MONTHS[key] ?? MONTHS[key.slice(0, 3)]) : null;
  return `${year}-${m ?? (end ? "12" : "01")}`;
}

/** Start and end of the first date range on a line. */
export function dateRange(text: string): { start: string | null; end: string | null; index: number; length: number } | null {
  const m = RANGE.exec(text);
  if (!m) return null;
  const start = ym(m[1], m[2], m[3], m[4], false);
  const end = m[5] ? "present" : ym(m[6], m[7], m[8], m[9], true);
  return { start, end, index: m.index, length: m[0].length };
}

function toLines(text: string): Line[] {
  const out: Line[] = [];
  let pos = 0;
  let section: Section = "other";
  let side = false;
  for (const raw of text.split("\n")) {
    const start = pos;
    pos += raw.length + 1;
    const t = raw.trim();
    if (!t) continue;
    const head = t.length <= 48 ? HEADINGS.find(([re]) => re.test(t.replace(/[^A-Za-z& ]/g, "").trim())) : undefined;
    if (head) {
      section = head[1];
      side = head[2];
      continue;
    }
    const lead = raw.length - raw.trimStart().length;
    const mark = BULLET.exec(raw);
    const s = start + (mark ? mark[0].length : lead);
    out.push({ text: text.slice(s, start + raw.trimEnd().length), start: s, end: start + raw.trimEnd().length, bullet: !!mark, section, side });
  }
  return out;
}

const ev = (l: Line, where?: string): Evidence => {
  const quote = l.text.length > 280 ? l.text.slice(0, l.text.lastIndexOf(" ", 280) > 120 ? l.text.lastIndexOf(" ", 280) : 280) : l.text;
  return { quote, start: l.start, end: l.start + quote.length, section: l.section, ...(where ? { where } : {}) };
};

const TITLE_WORD =
  /\b(intern(ship)?|co-?op|engineer|developer|analyst|manager|lead|co-?founder|founder|assistant|associate|coordinator|specialist|consultant|researcher|scientist|director|designer|president|representative|tutor|officer|advisor|strategist|architect|technician|fellow|executive|head|member|captain|volunteer|ambassador|instructor|editor|writer|marketer|recruiter|accountant|trader|banker|teller|cashier|server|barista|supervisor|administrator|programmer)\b/i;

function splitHeader(text: string): string[] {
  return text
    .split(/\s+[|•·]\s+|\s+[–—-]\s+|\s{3,}|\t+|\s+at\s+(?=[A-Z])|,\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[\s,|–—-]+|[\s,|–—-]+$/g, ""))
    .filter((s) => s.length > 1);
}

const PLACE = /^(remote|hybrid|[A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+)*,\s?[A-Z]{2,3}|[A-Z][a-zA-Z]+,\s?[A-Z][a-zA-Z]+|Vancouver|Toronto|New York|San Francisco|London|Canada|USA|United States)$/;

function kindOfRole(title: string, side: boolean): ExperienceEntry["kind"] {
  if (/\b(intern(ship)?|co-?op|summer (analyst|associate)|trainee|apprentice)\b/i.test(title)) return "internship";
  if (/\b(part[- ]time|tutor|teaching assistant|TA|barista|server|cashier|volunteer)\b/i.test(title)) return "part_time";
  if (side) return "other";
  return "full_time";
}

interface Block {
  head: Line[];
  bullets: Line[];
}

/** Groups a section's lines into entries: a few header lines, then bullets. */
function blocks(lines: Line[], full: string, titled = false): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.bullet) {
      if (!cur) cur = { head: [], bullets: [] };
      cur.bullets.push(l);
      continue;
    }
    // A plain line after bullets is a wrapped bullet unless it looks like a new header.
    const next = lines[i + 1];
    const headerish =
      !!dateRange(l.text) ||
      (TITLE_WORD.test(l.text) && l.text.length < 90) ||
      (next && !next.bullet && !!dateRange(next.text) && l.text.length < 90) ||
      // project names: a short capitalised line with no closing punctuation, followed by a bullet
      (titled && !!next?.bullet && l.text.length < 70 && /^[A-Z0-9]/.test(l.text) && !/[.;,]$/.test(l.text));
    if (cur && cur.bullets.length && !headerish) {
      const last = cur.bullets[cur.bullets.length - 1];
      // keep the quote a verbatim span of the resume, line break included
      cur.bullets[cur.bullets.length - 1] = { ...last, text: full.slice(last.start, l.end), end: l.end };
      continue;
    }
    if (!cur || cur.bullets.length) {
      if (cur) out.push(cur);
      cur = { head: [], bullets: [] };
    }
    cur.head.push(l);
  }
  if (cur) out.push(cur);
  return out.filter((b) => b.head.length || b.bullets.length);
}

function experience(lines: Line[], text: string): ExperienceEntry[] {
  return blocks(lines, text)
    .filter((b) => b.head.length)
    .map((b) => {
      const headText = b.head.map((h) => h.text).join("  |  ");
      const range = b.head.map((h) => dateRange(h.text)).find(Boolean) ?? null;
      const parts = b.head.flatMap((h) => {
        const r = dateRange(h.text);
        const t = r ? h.text.slice(0, r.index) + "   " + h.text.slice(r.index + r.length) : h.text;
        return splitHeader(t);
      }).filter((p) => !PLACE.test(p) && !/^\(?\d/.test(p));
      const title = parts.find((p) => TITLE_WORD.test(p)) ?? parts[0] ?? "";
      const org = parts.find((p) => p !== title) ?? "";
      const where = [title, org].filter(Boolean).join(", ");
      const first = b.head[0];
      const lastHead = b.head[b.head.length - 1];
      const side = first.side;
      return {
        title,
        org,
        start: range?.start ?? null,
        end: range?.end ?? null,
        kind: kindOfRole(title, side),
        bullets: b.bullets.map((l) => ev(l, where)),
        evidence: { quote: text.slice(first.start, lastHead.end).slice(0, 280), start: first.start, end: Math.min(lastHead.end, first.start + 280), section: "experience" as const, where: headText.slice(0, 120) },
      };
    })
    .filter((e) => e.title || e.org);
}

function projects(lines: Line[], text: string): ProjectEntry[] {
  return blocks(lines, text, true)
    .filter((b) => b.head.length)
    .map((b) => {
      const first = b.head[0];
      const r = dateRange(first.text);
      const name = splitHeader(r ? first.text.slice(0, r.index) : first.text)[0] ?? first.text.slice(0, 80);
      const extra = b.head.slice(1);
      const all = [...extra, ...b.bullets];
      return {
        name: name.slice(0, 100),
        bullets: all.map((l) => ev(l, name)),
        evidence: { quote: first.text.slice(0, 280), start: first.start, end: Math.min(first.end, first.start + 280), section: "projects" as const },
      };
    });
}

const DEGREE: [RegExp, DegreeLevel][] = [
  [/\b(ph\.?\s?d\.?|doctor(ate| of philosophy))/i, "phd"],
  [/\b(master|m\.?s\.?c?\b|m\.?a\.?\b|mba\b|m\.?eng\b|m\.?a\.?sc\b)/i, "master"],
  [/\b(bachelor|b\.?s\.?c?\b|b\.?a\.?\b|b\.?com+\b|b\.?eng\b|b\.?a\.?sc\b|bba\b|undergraduate degree)/i, "bachelor"],
  [/\b(associate('?s)? degree|a\.?a\.?s?\b(?= in))/i, "associate"],
];
const SCHOOL = /\b(university|college|institute|school|polytechnic|academy|UBC|MIT|UCLA|USC|NYU|CMU|SFU|UofT|McGill|Waterloo)\b/i;

function education(lines: Line[], text: string): EducationEntry[] {
  // an entry starts at each line that names a school
  const groups: Line[][] = [];
  for (const l of lines) {
    if (SCHOOL.test(l.text) && !l.bullet && (groups.length === 0 || groups[groups.length - 1].some((x) => DEGREE.some(([re]) => re.test(x.text)) || dateRange(x.text) || new RegExp(DATE, "i").test(x.text)))) groups.push([l]);
    else if (groups.length) groups[groups.length - 1].push(l);
    else groups.push([l]);
  }
  return groups
    .map((g) => {
      const joined = g.map((l) => l.text).join(" \n ");
      const schoolLine = g.find((l) => SCHOOL.test(l.text)) ?? g[0];
      const school = splitHeader(schoolLine.text.replace(RANGE, " ").replace(new RegExp(DATE, "gi"), " ")).find((p) => SCHOOL.test(p)) ?? schoolLine.text.slice(0, 100);
      const degree = DEGREE.find(([re]) => re.test(joined))?.[1] ?? null;
      const fieldMatch = /\b(?:in|of (?:science|arts|commerce|engineering|applied science)(?:,| in)?|major(?:ing)? in|,)\s+([A-Z][A-Za-z&]+(?:(?:\s+(?:and|&)\s+|\s+|,\s+)[A-Z][A-Za-z&]+){0,5})/.exec((g.find((l) => DEGREE.some(([re]) => re.test(l.text)))?.text ?? "").replace(/\s*\(?\b(expected|anticipated|graduating|class of)\b.*$/i, "").replace(RANGE, " "));
      const range = g.map((l) => dateRange(l.text)).find(Boolean);
      let end = range?.end && range.end !== "present" ? range.end : null;
      if (!end) {
        const all = [...joined.matchAll(SINGLE)];
        const last = all[all.length - 1];
        if (last) end = ym(last[1], last[2], last[3], last[4], true);
      }
      const first = g[0];
      const last = g[g.length - 1];
      const span = Math.min(last.end, first.start + 280);
      return {
        school: school.trim(),
        degree,
        field: fieldMatch ? fieldMatch[1].replace(/\s+/g, " ").trim().slice(0, 80) : null,
        end,
        expected: /\b(expected|anticipated|candidate|in progress|present|current)\b/i.test(joined) || range?.end === "present",
        evidence: { quote: text.slice(first.start, span), start: first.start, end: span, section: "education" as const },
      };
    })
    .filter((e) => e.school && (SCHOOL.test(e.school) || e.degree));
}

function skills(lines: Line[], exp: ExperienceEntry[], proj: ProjectEntry[]): SkillClaim[] {
  const claims = new Map<string, SkillClaim>();
  const add = (id: string, name: string, basis: SkillClaim["basis"], e: Evidence) => {
    const c = claims.get(id) ?? { id, name, basis, evidence: [] };
    if (basis === "listed") c.basis = "listed";
    if (c.evidence.length < 3 && !c.evidence.some((x) => x.start === e.start)) c.evidence.push(e);
    claims.set(id, c);
  };
  for (const l of lines.filter((x) => x.section === "skills")) {
    for (const t of TERMS) if (t.re.test(l.text)) add(t.id, t.name, "listed", ev(l));
  }
  const work: Evidence[] = [...exp.flatMap((e) => e.bullets), ...proj.flatMap((p) => p.bullets)];
  for (const b of work) {
    for (const t of TERMS) if (t.re.test(b.quote)) add(t.id, t.name, "shown", b);
  }
  // listed first, then by how much work evidence backs each one
  return [...claims.values()].sort((a, b) => Number(b.basis === "listed") - Number(a.basis === "listed") || b.evidence.length - a.evidence.length || a.name.localeCompare(b.name));
}

export function parseResume(text: string, fileName: string | null = null): ResumeProfile {
  const lines = toLines(text);
  const exp = experience(lines.filter((l) => l.section === "experience"), text);
  const proj = projects(lines.filter((l) => l.section === "projects"), text);
  return {
    fileName,
    skills: skills(lines, exp, proj),
    experience: exp,
    projects: proj,
    education: education(lines.filter((l) => l.section === "education"), text),
  };
}

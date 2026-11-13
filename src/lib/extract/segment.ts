export type Section = "required" | "preferred" | "neutral";

export interface Sentence {
  text: string;
  start: number;
  end: number;
  section: Section;
  /** The nearest heading line above, with its offsets, if directly adjacent. */
  heading: { text: string; start: number; end: number } | null;
  boilerplate: boolean;
  /** The line was a list item. */
  bullet: boolean;
}

const PREFERRED_HEAD =
  /\b(preferred|nice[- ]to[- ]haves?|bonus|pluses|plus points|desired|desirable|extra credit|would be (great|nice)|stand out|not required|optional|good to have|ideal(ly)?)\b/i;
const REQUIRED_HEAD =
  /\b(require[ds]?|requirements|qualifications|must[- ]haves?|what you('ll| will)? (need|bring)|who you are|minimum|basic|eligibility|about you|you have|you are)\b/i;

// Statements that mention protected traits or legal notices without stating a
// requirement of the candidate. Matching is skipped inside these.
const BOILERPLATE: RegExp[] = [
  /without regard to/i,
  /regardless of\b[^.]{0,200}\b(race|religion|gender|citizenship|national origin|age|disability)/i,
  /equal (employment )?opportunity/i,
  /\b(race|color|religion|sex|gender)\b[^.]{0,160}\b(national origin|citizenship|veteran|disability)\b/i,
  /\bE-?Verify\b/i,
  /reasonable accommodations?/i,
  /(recruit(ing|ment)|hiring|job|employment)\s+(scams?|fraud)/i,
  /fraudulent (job|offer|recruit)/i,
  /privacy (notice|policy)/i,
  /\b(CCPA|GDPR)\b/,
  /does not discriminate/i,
  /fair chance|criminal histor(y|ies)|arrest and conviction/i,
  /Form I-9/i,
];

const NO_SPLIT_BEFORE = /(\bU\.S|\be\.g|\bi\.e|\bPh\.D|\bB\.S|\bM\.S|\bB\.A|\bM\.A|\bInc|\betc|\bvs|\bSr|\bJr|\bNo|\bapprox|\bU\.K|\bSt|\bDr|\bMr|\bMs)\.$/i;

function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/^[-•*·\d]/.test(t)) return false;
  if (/[.;,!?]$/.test(t)) return false;
  if (/\$\s?\d/.test(t)) return false;
  return true;
}

/** Splits text into sentences with offsets. Bullets and lines are hard
 *  boundaries; inside a line we split on sentence punctuation. */
export function segment(text: string): Sentence[] {
  const out: Sentence[] = [];
  let section: Section = "neutral";
  let lastHeading: Sentence["heading"] = null;
  let headingAdjacent = false;
  let pos = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    const lineStart = pos;
    pos += line.length + 1;
    if (!line.trim()) continue;

    if (isHeading(line)) {
      const lead = line.length - line.trimStart().length;
      const t = line.trim();
      lastHeading = { text: t, start: lineStart + lead, end: lineStart + lead + t.length };
      headingAdjacent = true;
      section = PREFERRED_HEAD.test(t) ? "preferred" : REQUIRED_HEAD.test(t) ? "required" : "neutral";
      // Headings are also emitted so that rules can read "US Salary Range: ..." style lines.
    }

    // split the line into sentences
    const bounds: number[] = [0];
    const re = /[.!?]["'”)\]]?\s+(?=[A-Z(“"'])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const before = line.slice(0, m.index + 1);
      if (NO_SPLIT_BEFORE.test(before)) continue;
      bounds.push(m.index + m[0].length);
    }
    bounds.push(line.length);
    const headingLine = isHeading(line);
    for (let i = 0; i < bounds.length - 1; i++) {
      let s = bounds[i];
      let e = bounds[i + 1];
      const raw = line.slice(s, e);
      const lead = raw.length - raw.replace(/^[\s\-•*·]+/, "").length;
      s += lead;
      e -= raw.length - raw.trimEnd().length;
      if (e <= s) continue;
      const t = line.slice(s, e);
      out.push({
        text: t,
        start: lineStart + s,
        end: lineStart + e,
        section,
        heading: !headingLine && headingAdjacent ? lastHeading : null,
        boilerplate: BOILERPLATE.some((b) => b.test(t)),
        bullet: /^\s*[-•*·]/.test(line),
      });
    }
    if (!headingLine) headingAdjacent = false;
  }
  return out;
}

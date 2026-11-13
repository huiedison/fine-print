// What a listing asks for, read while its description is in hand: the tools it names and
// the kinds of work it describes, each with the sentence it came from. The description
// itself is not kept.
import { segment } from "../extract/segment";
import { TERMS, type Term } from "./taxonomy";

export type Strength = "required" | "preferred" | "mentioned";

export interface JobTerm {
  id: string;
  name: string;
  kind: Term["kind"];
  strength: Strength;
  /** Verbatim span of the description: text.slice(start, end) === quote. */
  quote: string;
  start: number;
  end: number;
}

export interface JobFeatures {
  terms: JobTerm[];
}

const RANK: Record<Strength, number> = { required: 0, preferred: 1, mentioned: 2 };
const PREFERRED_INLINE = /\b(preferred|a plus|is a plus|are a plus|nice[- ]to[- ]have|bonus|ideally|desired|not required|optional)\b/i;
const MAX_QUOTE = 280;

export function jobFeatures(text: string): JobFeatures {
  const best = new Map<string, JobTerm>();
  for (const s of segment(text)) {
    if (s.boilerplate || /:\s*$/.test(s.text)) continue;
    // Company blurbs mention customers, operations and so on without asking anything of
    // the candidate. Kinds of work are read only from bullets and from requirement sections.
    const asksSomething = s.bullet || s.section !== "neutral";
    const strength: Strength = PREFERRED_INLINE.test(s.text) || s.section === "preferred" ? "preferred" : s.section === "required" ? "required" : "mentioned";
    for (const term of TERMS) {
      if (term.kind === "work" && !asksSomething) continue;
      if (!term.re.test(s.text)) continue;
      const cur = best.get(term.id);
      if (cur && RANK[cur.strength] <= RANK[strength]) continue;
      let end = s.end;
      if (end - s.start > MAX_QUOTE) {
        const sp = text.lastIndexOf(" ", s.start + MAX_QUOTE);
        end = sp > s.start + 80 ? sp : s.start + MAX_QUOTE;
      }
      best.set(term.id, { id: term.id, name: term.name, kind: term.kind, strength, quote: text.slice(s.start, end), start: s.start, end });
    }
  }
  return { terms: [...best.values()].sort((a, b) => RANK[a.strength] - RANK[b.strength] || a.start - b.start) };
}

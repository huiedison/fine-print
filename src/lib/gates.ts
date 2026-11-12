import { compare, outsideUS, type Comparison, type Profile } from "./compare";
import type { Gate, Reading, Requirement } from "./extract/types";
import { COUNTRY_NAME, countryOf } from "./place";

/** The three things a person tells fine_print. All optional, all kept in the browser. */
export interface Answers {
  workAuth?: Profile["workAuth"];
  /** YYYY-MM */
  gradMonth?: string;
  countries?: ("US" | "CA" | "other")[];
  inPerson?: "yes" | "no";
}

export type State = "clear" | "blocked" | "silent";

export interface GateResult {
  gate: Gate;
  state: State;
  /** True when the listing says something but it cannot be called clear or blocked. Shown under "doesn't say". */
  unclear: boolean;
  /** One plain sentence. Always about what the listing says. */
  because: string;
  lines: { r: Requirement; index: number; state: State; unclear: boolean; because: string | null }[];
}

export const SHOWN_GATES: Gate[] = ["work_auth", "school", "experience", "place_time", "pay"];

export const SHORT_LABEL: Record<Gate, string> = {
  work_auth: "Work authorization",
  school: "School",
  experience: "Experience",
  place_time: "Place",
  pay: "Pay",
  terms: "Other terms",
};

function monthNow(now: Date) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** What the comparison code needs, worked out from the three answers. */
export function toProfile(a: Answers, now: Date): Profile {
  return {
    workAuth: a.workAuth,
    gradMonth: a.gradMonth,
    student: a.gradMonth ? (a.gradMonth > monthNow(now) ? "enrolled" : "graduated") : undefined,
  };
}

type Line = GateResult["lines"][number];

function fromComparison(c: Comparison | null): Pick<Line, "state" | "unclear" | "because"> {
  if (!c) return { state: "clear", unclear: false, because: null };
  if (c.verdict === "conflicts") return { state: "blocked", unclear: false, because: c.because };
  if (c.verdict === "meets") return { state: "clear", unclear: false, because: c.because };
  return { state: "silent", unclear: true, because: c.because };
}

function schoolLine(r: Requirement, p: Profile): Pick<Line, "state" | "unclear" | "because"> {
  // We ask for a graduation date and nothing else about school, so a line that
  // names degree programs can be clear only as far as "you are a student".
  if (r.kind === "enrolled" && r.strength === "required" && p.student === "enrolled") {
    const levels = (r.value?.levels as string[] | undefined) ?? [];
    if (levels.length && !levels.includes("bachelor")) {
      return { state: "silent", unclear: true, because: "The listing names specific degree programs. Check that yours is one of them." };
    }
    return {
      state: "clear",
      unclear: false,
      because: levels.length
        ? "The listing asks for a current student, and your graduation date is still ahead. It names degree programs, so check yours is one."
        : "The listing asks for a current student, and your graduation date is still ahead.",
    };
  }
  return fromComparison(compare(r, p));
}

function experienceLine(r: Requirement): Pick<Line, "state" | "unclear" | "because"> {
  if (r.strength === "preferred") return { state: "clear", unclear: false, because: "Stated as preferred, not required." };
  if (r.kind === "years_max") return { state: "clear", unclear: false, because: "The listing is aimed at people early in their careers." };
  if (r.kind === "years" || r.kind === "degree_phd") {
    return {
      state: "silent",
      unclear: true,
      because:
        r.strength === "alternative"
          ? "The listing gives this as one of several options."
          : "fine_print does not ask about your experience or degree, so it cannot check this one for you.",
    };
  }
  return { state: "clear", unclear: false, because: null };
}

function placeGate(reading: Reading, a: Answers, items: { r: Requirement; index: number }[]): GateResult {
  const b = reading.board;
  const country = countryOf(b.location);
  const wp = `${b.workplace_type ?? ""} ${b.label_workplace ?? ""}`.toLowerCase();
  const remoteRole = /remote/.test(wp) || items.some((x) => x.r.kind === "remote" && x.r.value?.scope === "role");
  const inPersonLine = items.find((x) => ["onsite", "office_days", "relocate"].includes(x.r.kind) && x.r.strength === "required") ??
    items.find((x) => x.r.kind === "term" && x.r.value?.in_person === true);
  const inPersonNeeded = !!inPersonLine || /onsite|on-site|hybrid/.test(wp);

  const lines: Line[] = items.map((x) => ({ ...x, state: "clear", unclear: false, because: null }));
  const answered = !!a.countries?.length || !!a.inPerson;
  const where = b.location ? `The board lists this role in ${b.location}.` : "The board does not give a location.";

  let state: State = items.length || b.location ? "clear" : "silent";
  let unclear = false;
  let because = items.length ? where : b.location ? `${where} The listing adds nothing about where or when you work.` : "The listing does not say where you would work.";

  if (!answered) {
    return { gate: "place_time", state: items.length || b.location ? "silent" : "silent", unclear: !!(items.length || b.location), because: items.length || b.location ? `${where} Tell us where you can work to check it.` : because, lines };
  }
  if (a.countries?.length && country && !a.countries.includes(country) && !remoteRole) {
    state = "blocked";
    because = `${where} You did not pick ${COUNTRY_NAME[country]} as a place you can work.`;
  } else if (a.inPerson === "no" && inPersonNeeded && !remoteRole) {
    state = "blocked";
    because = inPersonLine
      ? "The listing asks for in-person work, and you said you cannot work in person."
      : `The board labels this role ${b.workplace_type ?? b.label_workplace}, and you said you cannot work in person.`;
    if (inPersonLine) {
      const l = lines.find((x) => x.index === inPersonLine.index);
      if (l) l.state = "blocked";
    }
  } else if (a.countries?.length && !country && !remoteRole) {
    state = "silent";
    unclear = true;
    because = b.location ? `${where} fine_print could not tell which country that is.` : "The listing does not say where you would work.";
    if (!b.location && !items.length) unclear = false;
  } else if (remoteRole && a.countries?.length && country && !a.countries.includes(country)) {
    state = "silent";
    unclear = true;
    because = `The role is described as remote, and the board lists it in ${b.location}. It does not say whether you can do it from where you are.`;
  } else if (remoteRole) {
    because = "The role is described as remote.";
  }
  return { gate: "place_time", state, unclear, because, lines };
}

/** Works out clear, blocked or doesn't say for each gate. Blocked is used only when a
 *  line plainly rules the person out. Anything hedged or unanswered stays under doesn't say. */
export function gateResults(reading: Reading, answers: Answers, now: Date = new Date()): GateResult[] {
  const p = toProfile(answers, now);
  const loc = reading.board.location;
  return SHOWN_GATES.map((gate): GateResult => {
    const items = reading.requirements.map((r, index) => ({ r, index })).filter((x) => x.r.gate === gate);

    if (gate === "place_time") return placeGate(reading, answers, items);

    if (gate === "pay") {
      const onBoard = reading.board.comp_min != null || reading.board.comp_max != null;
      const lines: Line[] = items.map((x) => ({ ...x, state: "clear", unclear: false, because: null }));
      if (onBoard) return { gate, state: "clear", unclear: false, because: "Pay is posted on the board.", lines };
      if (items.length) return { gate, state: "clear", unclear: false, because: "The board's pay field is empty. This figure was found in the description.", lines };
      return { gate, state: "silent", unclear: false, because: "No pay on the board and none found in the description.", lines };
    }

    if (!items.length) {
      const text = reading.text.available;
      return {
        gate,
        state: "silent",
        unclear: false,
        because: !text
          ? "The board has no description text for this role."
          : gate === "work_auth"
            ? "The listing says nothing about work authorization or sponsorship. That is not a yes or a no."
            : "The listing has no line about this.",
        lines: [],
      };
    }

    const lines: Line[] = items.map((x) => {
      let res: Pick<Line, "state" | "unclear" | "because">;
      if (x.r.strength === "preferred") res = { state: "clear", unclear: false, because: "Stated as preferred, not required." };
      else if (gate === "experience") res = experienceLine(x.r);
      else if (gate === "school") res = schoolLine(x.r, p);
      else if (gate === "work_auth" && x.r.strength === "info" && x.r.kind !== "sponsorship_offered")
        res = { state: "silent", unclear: true, because: x.r.note ?? "The listing mentions this without making it a firm rule." };
      else if (gate === "work_auth" && x.r.kind === "sponsorship_offered" && p.workAuth && p.workAuth !== "needs_sponsor")
        res = { state: "clear", unclear: false, because: "The listing says sponsorship is on offer. You said you do not need it." };
      else res = fromComparison(compare(x.r, p, loc));
      return { ...x, ...res };
    });

    const blocked = lines.find((l) => l.state === "blocked");
    const fuzzy = lines.find((l) => l.unclear);
    if (blocked) return { gate, state: "blocked", unclear: false, because: blocked.because ?? "A stated requirement rules this out.", lines };
    if (fuzzy) return { gate, state: "silent", unclear: true, because: fuzzy.because ?? "The listing says something here, and it is not a plain yes or no.", lines };
    const first = lines.find((l) => l.because);
    return { gate, state: "clear", unclear: false, because: first?.because ?? "Nothing stated here rules you out.", lines };
  });
}

export function overall(results: GateResult[]): State {
  if (results.some((r) => r.state === "blocked")) return "blocked";
  if (results.filter((r) => r.gate !== "pay").every((r) => r.state === "clear")) return "clear";
  return "silent";
}

export { outsideUS };

import { compare, type Comparison } from "./compare";
import type { Gate, Reading, Requirement } from "./extract/types";
import { COUNTRY_NAME, countryOf } from "./place";
import { toCompareProfile, type Facts } from "./profile";

/** clear: a stated line was checked against a confirmed fact and is met.
 *  blocked: a stated line plainly rules the person out.
 *  unclear: the listing says something that could not be checked (hedged wording, or a fact not yet given).
 *  stated: the listing states something that is information, not a bar to check (pay, a preferred skill).
 *  silent: the listing says nothing. Never a yes or a no. */
export type State = "clear" | "blocked" | "unclear" | "stated" | "silent";

export interface GateLine {
  r: Requirement;
  index: number;
  state: Exclude<State, "silent">;
  because: string | null;
}

export interface GateResult {
  gate: Gate;
  state: State;
  /** One plain sentence. Always about what the listing says. */
  because: string;
  lines: GateLine[];
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

export const STATE_WORD: Record<State, string> = {
  clear: "clear",
  blocked: "blocked",
  unclear: "unclear",
  stated: "stated",
  silent: "doesn’t say",
};

/** A comparison that returns nothing means the line is information or was not compared.
 *  That is "stated", never "clear": clear needs a confirmed fact that meets the line. */
export function fromComparison(c: Comparison | null, r: Requirement): Pick<GateLine, "state" | "because"> {
  if (!c) {
    return {
      state: "stated",
      because:
        r.strength === "preferred"
          ? "Stated as preferred, not required."
          : r.strength === "alternative"
            ? "Stated as one of several accepted options."
            : (r.note ?? null),
    };
  }
  if (c.verdict === "conflicts") return { state: "blocked", because: c.because };
  if (c.verdict === "meets") return { state: "clear", because: c.because };
  return { state: "unclear", because: c.because };
}

function roll(gate: Gate, lines: GateLine[]): GateResult {
  const pick = (s: State) => lines.find((l) => l.state === s);
  const blocked = pick("blocked");
  if (blocked) return { gate, state: "blocked", because: blocked.because ?? "A stated requirement rules this out.", lines };
  const unclear = pick("unclear");
  if (unclear) return { gate, state: "unclear", because: unclear.because ?? "The listing says something here that could not be checked.", lines };
  const clear = pick("clear");
  if (clear) return { gate, state: "clear", because: clear.because ?? "The stated lines here are met.", lines };
  return { gate, state: "stated", because: pick("stated")?.because ?? "The listing states this for your information.", lines };
}

function placeGate(reading: Reading, f: Facts, items: { r: Requirement; index: number }[]): GateResult {
  const b = reading.board;
  const country = countryOf(b.location);
  const wp = `${b.workplace_type ?? ""} ${b.label_workplace ?? ""}`.toLowerCase();
  const remoteRole = /remote/.test(wp) || items.some((x) => x.r.kind === "remote" && x.r.value?.scope === "role");
  const inPersonLine =
    items.find((x) => ["onsite", "office_days", "relocate"].includes(x.r.kind) && x.r.strength === "required") ??
    items.find((x) => x.r.kind === "term" && x.r.value?.in_person === true);
  const inPersonNeeded = !!inPersonLine || /onsite|on-site|hybrid/.test(wp);
  const lines: GateLine[] = items.map((x) => ({ ...x, state: "stated", because: null }));
  const where = b.location ? `The board lists this role in ${b.location}.` : "The board does not give a location.";
  const answered = !!f.countries?.length || !!f.inPerson;

  if (!items.length && !b.location) return { gate: "place_time", state: "silent", because: "The listing does not say where you would work.", lines };
  if (!answered) return { gate: "place_time", state: "unclear", because: `${where} Tell us where you can work to check it.`, lines };

  if (f.countries?.length && country && !f.countries.includes(country) && !remoteRole)
    return { gate: "place_time", state: "blocked", because: `${where} You did not pick ${COUNTRY_NAME[country]} as a place you can work.`, lines };
  if (f.inPerson === "no" && inPersonNeeded && !remoteRole) {
    const l = inPersonLine ? lines.find((x) => x.index === inPersonLine.index) : null;
    if (l) l.state = "blocked";
    return {
      gate: "place_time",
      state: "blocked",
      because: inPersonLine
        ? "The listing asks for in-person work, and you said you cannot work in person."
        : `The board labels this role ${b.workplace_type ?? b.label_workplace}, and you said you cannot work in person.`,
      lines,
    };
  }
  if (remoteRole && f.countries?.length && country && !f.countries.includes(country))
    return { gate: "place_time", state: "unclear", because: `The role is described as remote, and the board lists it in ${b.location}. It does not say whether you can do it from where you are.`, lines };
  if (f.countries?.length && !country && !remoteRole)
    return { gate: "place_time", state: "unclear", because: `${where} fine_print could not tell which country that is.`, lines };
  if (!f.countries?.length) return { gate: "place_time", state: "unclear", because: `${where} You have not said which countries you can work in.`, lines };
  return { gate: "place_time", state: "clear", because: remoteRole ? "The role is described as remote." : `${where} That is a place you said you can work.`, lines };
}

/** Works out a state for each gate from confirmed facts only. Blocked is used only when
 *  a line plainly rules the person out. Nothing is inferred from a resume or a date. */
export function gateResults(reading: Reading, facts: Facts): GateResult[] {
  const p = toCompareProfile(facts);
  const loc = reading.board.location;
  return SHOWN_GATES.map((gate): GateResult => {
    const items = reading.requirements.map((r, index) => ({ r, index })).filter((x) => x.r.gate === gate);

    if (gate === "place_time") return placeGate(reading, facts, items);

    if (gate === "pay") {
      const onBoard = reading.board.comp_min != null || reading.board.comp_max != null;
      const lines: GateLine[] = items.map((x) => ({ ...x, state: "stated", because: null }));
      if (onBoard) return { gate, state: "stated", because: "Pay is posted on the board.", lines };
      if (items.length) return { gate, state: "stated", because: "The board's pay field is empty. This figure was found in the description.", lines };
      return { gate, state: "silent", because: "No pay on the board and none found in the description.", lines };
    }

    if (!items.length) {
      return {
        gate,
        state: "silent",
        because: !reading.text.available
          ? "The board has no description text for this role."
          : gate === "work_auth"
            ? "The listing says nothing about work authorization or sponsorship. That is not a yes or a no."
            : "The listing has no line about this.",
        lines: [],
      };
    }

    const lines: GateLine[] = items.map((x) => {
      // "may be required" and export-control notices are hedged: unclear, with the note
      if (gate === "work_auth" && x.r.strength === "info" && x.r.kind !== "sponsorship_offered")
        return { ...x, state: "unclear", because: x.r.note ?? "The listing mentions this without making it a firm rule." };
      return { ...x, ...fromComparison(compare(x.r, p, loc), x.r) };
    });
    return roll(gate, lines);
  });
}

export function overall(results: GateResult[]): "blocked" | "clear" | "open" {
  if (results.some((r) => r.state === "blocked")) return "blocked";
  const checked = results.filter((r) => r.gate !== "pay");
  if (checked.every((r) => r.state === "clear" || r.state === "stated") && checked.some((r) => r.state === "clear")) return "clear";
  return "open";
}

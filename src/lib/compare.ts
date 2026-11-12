import type { Reading, Requirement } from "./extract/types";

/** Facts the person chose to share. Everything is optional and stays in the browser. */
export interface Profile {
  /** citizen | pr | other_no_sponsor (authorized, will not need sponsorship) | needs_sponsor */
  workAuth?: "citizen" | "pr" | "other_no_sponsor" | "needs_sponsor";
  student?: "enrolled" | "graduated";
  /** Degree being pursued, or the highest one held. */
  degree?: "bachelor" | "master" | "phd";
  /** YYYY-MM */
  gradMonth?: string;
  /** Asked only when a listing states a return-to-school requirement. */
  returning?: "yes" | "no";
  years?: number;
}

export type Verdict = "meets" | "conflicts" | "clarify";
export type ClarifyReason = "silence" | "ambiguous_wording" | "conflicting_text" | "missing_profile";

export const VERDICT_LABEL: Record<Verdict, string> = {
  meets: "Meets this stated requirement",
  conflicts: "Conflicts with this stated requirement",
  clarify: "Needs clarification",
};

export const REASON_LABEL: Record<ClarifyReason, string> = {
  silence: "The listing does not say.",
  ambiguous_wording: "The wording leaves this open.",
  conflicting_text: "The listing says two things that do not agree.",
  missing_profile: "You have not shared the fact needed to compare.",
};

export interface Comparison {
  verdict: Verdict;
  reason?: ClarifyReason;
  /** One plain sentence on why. Always phrased around what the listing says. */
  because: string;
  /** Profile field to ask for when reason is missing_profile. */
  ask?: keyof Profile;
}

const meets = (because: string): Comparison => ({ verdict: "meets", because });
const conflictsWith = (because: string): Comparison => ({ verdict: "conflicts", because });
const clarify = (reason: ClarifyReason, because: string, ask?: keyof Profile): Comparison => ({
  verdict: "clarify",
  reason,
  because,
  ...(ask ? { ask } : {}),
});

const AUTH_TEXT: Record<NonNullable<Profile["workAuth"]>, string> = {
  citizen: "a U.S. citizen",
  pr: "a U.S. permanent resident",
  other_no_sponsor: "authorized to work without sponsorship",
  needs_sponsor: "someone who would need sponsorship",
};

const NON_US =
  /\b(Canada|Ontario|Quebec|Québec|British Columbia|Alberta|Toronto|Vancouver|Montreal|Montréal|Ottawa|Calgary|Waterloo|United Kingdom|UK|England|Scotland|London|Edinburgh|Bristol|Manchester|Cambridge, (UK|England)|Ireland|Dublin|Germany|Berlin|Munich|France|Paris|Netherlands|Amsterdam|Spain|Madrid|Barcelona|Italy|Poland|Warsaw|Sweden|Stockholm|Switzerland|Zurich|Israel|Tel Aviv|India|Bangalore|Bengaluru|Hyderabad|Mumbai|Pune|Singapore|Japan|Tokyo|China|Shanghai|Beijing|Shenzhen|Hong Kong|Taiwan|Korea|Seoul|Philippines|Manila|Australia|Sydney|Melbourne|Mexico|Brazil|São Paulo|Argentina|UAE|Dubai)\b/;

/** True when the board's location, or the sentence itself, places the rule outside the U.S. */
export function outsideUS(location: string | null, r?: Requirement): boolean {
  // The board's location wins: a role in Bangalore that mentions the U.S. in passing is still outside it.
  if (location && !/\b(United States|USA|U\.S\.)\b/.test(location) && NON_US.test(location)) return true;
  const c = r?.value?.country;
  return typeof c === "string" && c !== "US";
}

const WORK_AUTH_KINDS = new Set(["us_person", "citizen", "citizen_or_pr", "no_sponsorship", "sponsorship_offered", "work_authorization"]);

/** Compares one requirement with the profile. Returns null when the requirement
 *  is informational or preferred, or when fine_print does not compare that kind. */
export function compare(r: Requirement, p: Profile, location: string | null = null): Comparison | null {
  if (r.strength === "preferred") return null;
  if (WORK_AUTH_KINDS.has(r.kind) && r.kind !== "us_person" && r.kind !== "citizen" && r.kind !== "citizen_or_pr" && outsideUS(location, r)) {
    return p.workAuth
      ? clarify("missing_profile", "This line is about working outside the U.S. fine_print only asks about U.S. work authorization.")
      : null;
  }
  const you = p.workAuth ? AUTH_TEXT[p.workAuth] : null;

  switch (r.kind) {
    case "us_person":
      if (!p.workAuth) return clarify("missing_profile", "The listing asks for U.S. Person status.", "workAuth");
      if (p.workAuth === "citizen" || p.workAuth === "pr")
        return meets(`The listing asks for a U.S. Person, and you said you are ${you}.`);
      if (p.workAuth === "needs_sponsor")
        return conflictsWith("The listing asks for a U.S. Person. People who need visa sponsorship are not U.S. Persons under that definition.");
      return clarify(
        "missing_profile",
        "U.S. Person covers citizens, permanent residents and certain protected individuals. Your answer does not show which applies.",
      );
    case "citizen":
      if (!p.workAuth) return clarify("missing_profile", "The listing asks for U.S. citizenship.", "workAuth");
      return p.workAuth === "citizen"
        ? meets("The listing asks for U.S. citizenship, and you said you are a U.S. citizen.")
        : conflictsWith(`The listing asks for U.S. citizenship, and you said you are ${you}.`);
    case "citizen_or_pr":
      if (!p.workAuth) return clarify("missing_profile", "The listing asks for U.S. citizenship or permanent residency.", "workAuth");
      return p.workAuth === "citizen" || p.workAuth === "pr"
        ? meets(`The listing asks for a citizen or permanent resident, and you said you are ${you}.`)
        : conflictsWith(`The listing asks for a citizen or permanent resident, and you said you are ${you}.`);
    case "clearance_active":
    case "clearance_eligible":
      if (r.strength === "info") return null;
      return clarify(
        "missing_profile",
        "The listing asks about a security clearance. fine_print does not ask about or judge clearance eligibility.",
      );
    case "no_sponsorship":
      if (!p.workAuth) return clarify("missing_profile", "The listing says it does not sponsor visas.", "workAuth");
      if (r.value?.h1b_only && p.workAuth === "needs_sponsor")
        return clarify("ambiguous_wording", "The listing rules out new H-1B sponsorship and does not mention other kinds.");
      return p.workAuth === "needs_sponsor"
        ? conflictsWith("The listing says it does not sponsor visas, and you said you would need sponsorship.")
        : meets("The listing says it does not sponsor visas, and you said you do not need sponsorship.");
    case "sponsorship_offered":
      if (p.workAuth !== "needs_sponsor") return null;
      return r.value?.hedged
        ? clarify("ambiguous_wording", "The listing says sponsorship may be available, without committing to it.")
        : meets("The listing says sponsorship is available.");
    case "work_authorization":
      if (!p.workAuth) return clarify("missing_profile", "The listing asks for U.S. work authorization.", "workAuth");
      return p.workAuth === "needs_sponsor"
        ? clarify("ambiguous_wording", "The listing asks for work authorization and does not say whether it sponsors.")
        : meets(`The listing asks for U.S. work authorization, and you said you are ${you}.`);
    case "export_control":
      return null;

    case "enrolled": {
      if (r.strength === "alternative") return null;
      if (!p.student) return clarify("missing_profile", "The listing asks for a current student.", "student");
      if (p.student === "graduated") return conflictsWith("The listing asks for a current student, and you said you have graduated.");
      const levels = (r.value?.levels as string[] | undefined) ?? [];
      if (levels.length && p.degree && !levels.includes(p.degree))
        return conflictsWith(`The listing names specific degree programs, and yours (${p.degree}) is not among them.`);
      if (levels.length && !p.degree) return clarify("missing_profile", "The listing names specific degree programs.", "degree");
      return meets("The listing asks for a current student, and you said you are enrolled.");
    }
    case "return_to_school":
      if (p.student === "graduated") return conflictsWith("The listing asks you to return to school afterwards, and you said you have graduated.");
      if (!p.returning)
        return clarify(
          "missing_profile",
          "The listing asks you to return to school after the internship. A graduation date alone cannot show that.",
          "returning",
        );
      return p.returning === "yes"
        ? meets("The listing asks you to return to school afterwards, and you said you will.")
        : conflictsWith("The listing asks you to return to school afterwards, and you said you will not.");
    case "grad_window": {
      const from = (r.value?.from as string | null) ?? null;
      const to = (r.value?.to as string | null) ?? null;
      if (!r.value?.clean || (!from && !to)) return clarify("ambiguous_wording", "The listing gives graduation dates that fine_print could not read as one clear window.");
      if (!p.gradMonth) return clarify("missing_profile", "The listing states a graduation window.", "gradMonth");
      const inside = (!from || p.gradMonth >= from) && (!to || p.gradMonth <= to);
      const win = from && to ? `${from} to ${to}` : from ? `${from} or later` : `${to} or earlier`;
      return inside
        ? meets(`The listing's graduation window reads as ${win}, and yours is ${p.gradMonth}.`)
        : conflictsWith(`The listing's graduation window reads as ${win}, and yours is ${p.gradMonth}.`);
    }

    case "degree_phd":
      if (r.strength === "alternative") return clarify("ambiguous_wording", "The listing names a Ph.D. alongside other accepted options.");
      if (!p.degree) return clarify("missing_profile", "The listing asks for a Ph.D.", "degree");
      return p.degree === "phd" && p.student !== "enrolled"
        ? meets("The listing asks for a Ph.D., and you said you hold one.")
        : p.degree === "phd"
          ? clarify("ambiguous_wording", "The listing asks for a Ph.D. and does not say whether a degree in progress counts.")
          : conflictsWith("The listing asks for a Ph.D., and you said your degree is a different level.");
    case "years": {
      if (r.strength !== "required") return null;
      const min = Number(r.value?.min);
      if (p.years == null) return clarify("missing_profile", `The listing asks for ${r.summary.toLowerCase()}.`, "years");
      return p.years >= min
        ? meets(`The listing asks for ${min}+ years, and you said you have ${p.years}.`)
        : conflictsWith(`The listing asks for ${min}+ years, and you said you have ${p.years}.`);
    }
    default:
      return null;
  }
}

/** Requirement-level comparisons, plus a note for work authorization silence. */
export function compareReading(reading: Reading, p: Profile) {
  const loc = reading.board.location;
  const perRequirement = reading.requirements.map((r) => compare(r, p, loc));
  const silence: Comparison[] = [];
  if (reading.text.available && reading.silent_gates.includes("work_auth") && p.workAuth === "needs_sponsor" && !outsideUS(loc)) {
    silence.push(clarify("silence", "The listing says nothing about sponsorship or work authorization. That is not a yes or a no."));
  }
  return { perRequirement, silence };
}

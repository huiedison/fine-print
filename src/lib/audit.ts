import summary from "../../data/audit-summary.json";
import evaluation from "../../data/evaluation.json";

export { summary, evaluation };

/** "158/273 (57.9%)" -> { count: 158, of: 273, pct: "57.9%" } */
export function parseShare(s: string) {
  const m = /^(\d+)\/(\d+)(?: \(([\d.]+%)\))?$/.exec(s);
  return m ? { count: Number(m[1]), of: Number(m[2]), pct: m[3] ?? "n/a" } : { count: 0, of: 0, pct: "n/a" };
}

export const MEASURED_ON = new Date(summary.measured_on).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export const MEASURES: { key: keyof typeof summary.measures; label: string; note?: string }[] = [
  {
    key: "explicit_eligibility_requirement",
    label: "State an eligibility requirement",
    note: "A line stated as required about work authorization, citizenship, clearance, sponsorship, enrollment, returning to school or a graduation window.",
  },
  {
    key: "explicit_eligibility_missing_from_fields",
    label: "State one that the board's fields do not carry",
    note: "The board has no field for work authorization or school status, so this is every one of them.",
  },
  {
    key: "explicit_eligibility_excluding_must_be_a_student",
    label: "Same, leaving out “must be a current student”",
    note: "The stricter reading: an internship asking for a student is no surprise.",
  },
  { key: "work_auth_requirement", label: "State a work authorization requirement" },
  { key: "us_person_citizenship_or_clearance_line", label: "Have a U.S. Person, citizenship or clearance line" },
  { key: "mentions_sponsorship_either_way", label: "Mention sponsorship, yes or no" },
  { key: "silent_on_work_auth", label: "Say nothing about work authorization", note: "Silence is not a yes or a no." },
  {
    key: "pay_null_with_band_in_text",
    label: "Have pay in the description when the board's pay field is empty",
    note: "Counted only among roles with an empty pay field.",
  },
  {
    key: "ambiguous_or_contradictory",
    label: "Have an ambiguous or contradictory requirement",
    note: "A requirement offered as one of several options, or a board label the text contradicts.",
  },
  { key: "at_least_one_quoted_statement", label: "Have at least one quoted statement of any kind" },
];

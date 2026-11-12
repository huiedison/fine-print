export type Gate = "work_auth" | "school" | "experience" | "place_time" | "pay" | "terms";

export const GATES: Gate[] = ["work_auth", "school", "experience", "place_time", "pay", "terms"];

export const GATE_LABEL: Record<Gate, string> = {
  work_auth: "Work authorization",
  school: "School status",
  experience: "Experience and degree",
  place_time: "Place and time",
  pay: "Pay",
  terms: "Other terms",
};

/** required: stated as a must. preferred: stated as a nice-to-have.
 *  alternative: one of several accepted options. info: a stated fact, not a bar. */
export type Strength = "required" | "preferred" | "alternative" | "info";

export interface Requirement {
  gate: Gate;
  kind: string;
  strength: Strength;
  /** Plain summary of what the listing states. */
  summary: string;
  /** Verbatim substring of description_text: text.slice(start, end) === quote. */
  quote: string;
  start: number;
  end: number;
  rule_id: string;
  /** Parsed values, when the rule extracts any. */
  value?: Record<string, string | number | boolean | string[] | null>;
  /** Extra plain-language note shown with the requirement. */
  note?: string;
}

export interface LabelConflict {
  field: "level" | "experience" | "workplace";
  board_label: string;
  text_says: string;
  rule_id: string;
  /** Index into requirements[] for the quoted evidence. */
  requirement_index: number;
}

export interface BoardFacts {
  id: string;
  status: "open" | "closed";
  url: string;
  title: string;
  company: string;
  location: string | null;
  workplace_type: string | null;
  employment_type: string | null;
  seniority: string | null;
  label_seniority: string | null;
  label_min_experience: string | null;
  label_workplace: string | null;
  label_engagement: string | null;
  comp_summary: string | null;
  comp_min: number | null;
  comp_max: number | null;
  comp_currency: string | null;
  comp_period: string | null;
  published_at: string | null;
  stealth: boolean;
  tier: string | null;
}

export interface Reading {
  board: BoardFacts;
  requirements: Requirement[];
  label_conflicts: LabelConflict[];
  /** Gates with no explicit statement found. Silence is not a pass or a fail. */
  silent_gates: Gate[];
  text: { length: number; truncated: boolean; available: boolean };
  read_at: string;
  extractor_version: string;
}

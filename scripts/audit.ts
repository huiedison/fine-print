// Runs the extractor over the locally cached sample (data/raw, gitignored) and
// writes data/sample-readings.json: findings and short quotes only.
// Usage: npx tsx scripts/audit.ts [--review 50]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { readListing, type ApiJob } from "../src/lib/extract/read";
import type { Reading } from "../src/lib/extract/types";
import { compare, type Profile } from "../src/lib/compare";

// Until the sampler finishes there is no manifest; read whatever is cached and say so.
const partial = !existsSync("data/sample-manifest.json");
const manifest = partial ? { partial: true } : JSON.parse(readFileSync("data/sample-manifest.json", "utf8"));
const ids = partial
  ? null
  : new Set<string>(manifest.roles.filter((r: { fetch: string }) => r.fetch === "ok").map((r: { id: string }) => r.id));

interface Row {
  sample_level: string;
  fetched_at: string;
  reading: Reading;
}
const rows: Row[] = [];
for (const f of readdirSync("data/raw")) {
  const id = f.replace(".json", "");
  if (ids && !ids.has(id)) continue;
  const raw = JSON.parse(readFileSync(`data/raw/${f}`, "utf8")) as { fetched_at: string; sample_level: string; job: ApiJob };
  rows.push({ sample_level: raw.sample_level, fetched_at: raw.fetched_at, reading: readListing(raw.job, new Date(raw.fetched_at)) });
}

const open = rows.filter((r) => r.reading.board.status === "open");
const withText = open.filter((r) => r.reading.text.available);
const n = withText.length;
const pct = (a: number, b: number) => (b ? `${a}/${b} (${((100 * a) / b).toFixed(1)}%)` : `${a}/0`);

// An eligibility requirement: a stated must on authorization, school status,
// or a degree/experience floor that contradicts the board's own level label.
const ELIG = new Set(["us_person", "citizen", "citizen_or_pr", "clearance_active", "clearance_eligible", "no_sponsorship", "work_authorization", "enrolled", "return_to_school", "grad_window"]);
const hasElig = (r: Row) => r.reading.requirements.some((q) => ELIG.has(q.kind) && q.strength === "required");
const hasAuth = (r: Row) => r.reading.requirements.some((q) => q.gate === "work_auth" && q.strength === "required");
const mentionsSponsorship = (r: Row) => r.reading.requirements.some((q) => q.kind === "no_sponsorship" || q.kind === "sponsorship_offered");
const usPersonCitizenClearance = (r: Row) => r.reading.requirements.some((q) => ["us_person", "citizen", "citizen_or_pr", "clearance_active", "clearance_eligible"].includes(q.kind) && q.strength !== "preferred");
const payNull = withText.filter((r) => r.reading.board.comp_min == null && r.reading.board.comp_max == null);
const payRecovered = payNull.filter((r) => r.reading.requirements.some((q) => q.gate === "pay"));
const ambiguous = withText.filter((r) => r.reading.label_conflicts.length > 0 || r.reading.requirements.some((q) => q.strength === "alternative" && q.gate !== "pay"));

const byCompany = new Map<string, number>();
for (const r of withText) byCompany.set(r.reading.board.company, (byCompany.get(r.reading.board.company) ?? 0) + 1);
const top = [...byCompany.entries()].sort((a, b) => b[1] - a[1]);
const titleKey = (r: Row) => `${r.reading.board.company}|${r.reading.board.title}`.toLowerCase();
const titleDupes = withText.length - new Set(withText.map(titleKey)).size;

const kinds: Record<string, number> = {};
for (const r of withText) for (const q of r.reading.requirements) kinds[`${q.gate}.${q.kind}.${q.strength}`] = (kinds[`${q.gate}.${q.kind}.${q.strength}`] ?? 0) + 1;

// Example profile used to count personal conflict calls. It is an example, not a real person.
const EXAMPLE_PROFILE: Profile = { workAuth: "needs_sponsor", student: "enrolled", degree: "bachelor", gradMonth: "2027-12", returning: "yes", years: 0 };
const calls = { meets: 0, conflicts: 0, clarify: 0 };
const conflictCalls: { id: string; company: string; title: string; location: string | null; kind: string; because: string; quote: string }[] = [];
let rolesWithConflict = 0;
for (const r of withText) {
  let any = false;
  for (const q of r.reading.requirements) {
    const c = compare(q, EXAMPLE_PROFILE, r.reading.board.location);
    if (!c) continue;
    calls[c.verdict]++;
    if (c.verdict === "conflicts") {
      any = true;
      conflictCalls.push({ id: r.reading.board.id.slice(0, 8), company: r.reading.board.company, title: r.reading.board.title, location: r.reading.board.location, kind: q.kind, because: c.because, quote: q.quote.slice(0, 200) });
    }
  }
  if (any) rolesWithConflict++;
}
// School-status lines other than "must be a student" on a role already labeled as an internship.
const NON_OBVIOUS = new Set([...ELIG].filter((k) => k !== "enrolled"));
const hasNonObvious = (r: Row) => r.reading.requirements.some((q) => NON_OBVIOUS.has(q.kind) && q.strength === "required");

const summary = {
  partial_sample: partial,
  measured_on: manifest.finished_at,
  extractor_version: rows[0]?.reading.extractor_version,
  frame: manifest.frame,
  frame_total: manifest.frame_total,
  allocation: manifest.allocation,
  seed: manifest.seed,
  drawn: manifest.drawn,
  fetched: rows.length,
  closed: rows.length - open.length,
  no_description: open.length - withText.length,
  roles_read: n,
  employers: byCompany.size,
  top_employers: top.slice(0, 8),
  top_employer_share: pct(top[0]?.[1] ?? 0, n),
  top5_employer_share: pct(top.slice(0, 5).reduce((a, b) => a + b[1], 0), n),
  same_company_and_title_duplicates: titleDupes,
  truncated_at_15000_chars: pct(withText.filter((r) => r.reading.text.truncated).length, n),
  by_level: Object.fromEntries(["intern", "new_grad", "junior"].map((l) => [l, withText.filter((r) => r.sample_level === l).length])),
  measures: {
    explicit_eligibility_requirement: pct(withText.filter(hasElig).length, n),
    // The board has no authorization or school fields, so every such requirement is missing from structured fields.
    explicit_eligibility_missing_from_fields: pct(withText.filter(hasElig).length, n),
    explicit_eligibility_excluding_must_be_a_student: pct(withText.filter(hasNonObvious).length, n),
    work_auth_requirement: pct(withText.filter(hasAuth).length, n),
    us_person_citizenship_or_clearance_line: pct(withText.filter(usPersonCitizenClearance).length, n),
    mentions_sponsorship_either_way: pct(withText.filter(mentionsSponsorship).length, n),
    silent_on_work_auth: pct(withText.filter((r) => r.reading.silent_gates.includes("work_auth")).length, n),
    pay_null_on_board: pct(payNull.length, n),
    pay_null_with_band_in_text: pct(payRecovered.length, payNull.length),
    ambiguous_or_contradictory: pct(ambiguous.length, n),
    label_conflicts: pct(withText.filter((r) => r.reading.label_conflicts.length > 0).length, n),
    at_least_one_quoted_statement: pct(withText.filter((r) => r.reading.requirements.length > 0).length, n),
  },
  by_level_eligibility: Object.fromEntries(
    ["intern", "new_grad", "junior"].map((l) => {
      const g = withText.filter((r) => r.sample_level === l);
      return [l, pct(g.filter(hasElig).length, g.length)];
    }),
  ),
  example_profile: EXAMPLE_PROFILE,
  example_profile_calls: calls,
  example_profile_roles_with_a_conflict: pct(rolesWithConflict, n),
  kinds: Object.fromEntries(Object.entries(kinds).sort()),
};

writeFileSync(
  "data/sample-readings.json",
  JSON.stringify({ summary, roles: rows.map((r) => ({ sample_level: r.sample_level, ...r.reading })) }),
);
// Small files the app imports: the summary, and one compact row per role read.
writeFileSync("data/audit-summary.json", JSON.stringify(summary, null, 1));
writeFileSync(
  "data/sample-index.json",
  JSON.stringify(
    withText
      .map((r) => ({
        id: r.reading.board.id.slice(0, 8),
        title: r.reading.board.title,
        company: r.reading.board.company,
        location: r.reading.board.location,
        level: r.sample_level,
        read_at: r.fetched_at,
        stated: [...new Set(r.reading.requirements.filter((q) => q.gate !== "terms").map((q) => q.gate))],
        statements: r.reading.requirements.length,
        pay_in_text: r.reading.board.comp_min == null && r.reading.requirements.some((q) => q.gate === "pay"),
      }))
      .sort((x, y) => x.company.localeCompare(y.company) || x.title.localeCompare(y.title)),
  ),
);
writeFileSync("data/conflict-calls.json", JSON.stringify(conflictCalls, null, 1));
console.log(JSON.stringify(summary, null, 2));

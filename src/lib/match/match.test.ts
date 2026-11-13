import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toListedRole, type Analysis, type ListedRole } from "../board";
import { readListing, type ApiJob } from "../extract/read";
import { emptyProfile, migrateAnswersV2, monthsCovered, resumeYearsFullTime, toCompareProfile, validProfile, type CandidateProfile } from "../profile";
import { parseResume } from "../resume/parse";
import { jobFeatures } from "./features";
import { compareMatches, rankMatches, scoreRole, titleOverlap } from "./rank";
import { analyzeAll, buildQueries, interleave } from "./retrieve";

const RESUME_TEXT = readFileSync(join(__dirname, "../resume/fixtures/synthetic-resume.txt"), "utf8");
const NOW = new Date("2026-11-12T00:00:00Z");

function make(over: Partial<ApiJob> & { function?: string }): { role: ListedRole; analysis: Analysis } {
  const job: ApiJob = {
    id: "aaaaaaaa-0000-0000-0000-000000000000",
    status: "open",
    url: "https://speedrun-talent-network.com/jobs/x-aaaaaaaa",
    title: "Business Operations Associate",
    company: "Northwind Robotics",
    stealth: false,
    location: "San Francisco, CA",
    workplace_type: "Hybrid",
    published_at: "2026-11-01T00:00:00Z",
    ...over,
  };
  return { role: toListedRole({ ...job, remote: false, function: over.function ?? "operations" }), analysis: { reading: readListing(job), features: jobFeatures(job.description_text ?? "") } };
}

const OPS = `About Northwind
We serve customers in forty countries with warehouse robots.

What you'll do
- Coordinate with engineering, finance and support stakeholders to keep launches on schedule
- Streamline manual reporting workflows and track operational metrics
- Present findings to leadership every week

Requirements
- Strong SQL and Excel skills
- Experience with Salesforce
- Experience analyzing data and building dashboards

Nice to have
- Python
- Kubernetes
`;

/** The same listing with one more line under Requirements. */
const opsWith = (line: string) => OPS.replace("\nNice to have", `${line}\n\nNice to have`);

function profile(over: Partial<CandidateProfile> = {}): CandidateProfile {
  const p = emptyProfile();
  p.resume = parseResume(RESUME_TEXT, "synthetic-resume.txt");
  p.prefs.titles = ["business operations"];
  return { ...p, ...over };
}

describe("profile migration and adapters", () => {
  it("carries the four v2 answers over and leaves new fields unknown", () => {
    const facts = migrateAnswersV2({ workAuth: "needs_sponsor", gradMonth: "2027-12", countries: ["US", "CA"], inPerson: "yes" });
    expect(facts).toEqual({ workAuth: "needs_sponsor", gradMonth: "2027-12", countries: ["US", "CA"], inPerson: "yes" });
    expect(facts.enrolled).toBeUndefined();
    expect(facts.returning).toBeUndefined();
    expect(facts.yearsFullTime).toBeUndefined();
  });

  it("drops invalid stored values instead of trusting them", () => {
    expect(migrateAnswersV2({ workAuth: "admin", gradMonth: "2027-13", countries: ["US", "MARS", 7], inPerson: true })).toEqual({ countries: ["US"] });
    expect(migrateAnswersV2("not an object")).toEqual({});
    expect(migrateAnswersV2(null)).toEqual({});
  });

  it("reads a v2 blob through validProfile, and round-trips a v3 profile", () => {
    const fromV2 = validProfile({ workAuth: "citizen", gradMonth: "2026-05" });
    expect(fromV2.version).toBe(3);
    expect(fromV2.facts).toEqual({ workAuth: "citizen", gradMonth: "2026-05" });
    expect(fromV2.resume).toBeNull();
    const p = profile();
    p.facts = { enrolled: "yes", yearsFullTime: 1.5 };
    p.prefs.workplace = { values: ["remote"], required: true };
    expect(validProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it("does not infer enrollment from a graduation month", () => {
    expect(toCompareProfile({ gradMonth: "2027-12" }).student).toBeUndefined();
    expect(toCompareProfile({ gradMonth: "2027-12", enrolled: "yes" }).student).toBe("enrolled");
  });

  it("counts overlapping job dates once", () => {
    expect(monthsCovered([{ start: "2024-01", end: "2024-12" }, { start: "2024-07", end: "2025-06" }], NOW)).toBe(18);
    expect(monthsCovered([{ start: "2024-01", end: "2024-06" }, { start: "2025-01", end: "2025-06" }], NOW)).toBe(12);
    expect(monthsCovered([{ start: "2024-01", end: "2024-12" }, { start: "2024-03", end: "2024-05" }], NOW)).toBe(12);
    expect(monthsCovered([{ start: "2026-09", end: "present" }, { start: null, end: null }], NOW)).toBe(3);
    // the fixture: two full-time roles, back to back; the internship is not counted
    expect(resumeYearsFullTime(profile().resume, NOW)).toBe(2.5);
  });
});

describe("what a listing asks for", () => {
  const f = jobFeatures(OPS);
  const by = (name: string) => f.terms.find((t) => t.name === name);

  it("keeps required, preferred and described work apart", () => {
    expect(by("SQL")?.strength).toBe("required");
    expect(by("Salesforce")?.strength).toBe("required");
    expect(by("Python")?.strength).toBe("preferred");
    expect(by("Kubernetes")?.strength).toBe("preferred");
    expect(by("Working with stakeholders")?.strength).toBe("mentioned");
  });

  it("quotes are verbatim spans, and company blurbs are not read as asks", () => {
    for (const t of f.terms) expect(OPS.slice(t.start, t.end)).toBe(t.quote);
    expect(by("Working with customers")).toBeUndefined(); // "We serve customers" is the company describing itself
  });
});

describe("scoring", () => {
  it("a career change: the wanted title drives role fit, and transferable work is paired with evidence", () => {
    // The resume's titles are analyst intern, co-founder and member services. None is "operations".
    const m = scoreRole(profile(), ...Object.values(make({ description_text: OPS })) as [ListedRole, Analysis]);
    expect(m.parts.role).toBe(4);
    const stake = m.pairs.find((p) => p.name === "Working with stakeholders");
    expect(stake?.resume?.quote).toContain("Coordinated with compliance, operations and portfolio stakeholders");
    expect(stake?.job.quote).toContain("Coordinate with engineering, finance and support stakeholders");
    expect(m.pairs.find((p) => p.name === "Improving a process")?.resume?.quote).toContain("reduced manual reconciliation time");
    expect(m.parts.work).toBeGreaterThanOrEqual(3);
    expect(["strong", "good"]).toContain(m.label);
  });

  it("every reason carries the listing's words, and resume words when it cites the resume", () => {
    const { role, analysis } = make({ description_text: OPS });
    const m = scoreRole(profile(), role, analysis);
    expect(m.reasons.length).toBeGreaterThanOrEqual(2);
    expect(m.reasons.length).toBeLessThanOrEqual(3);
    for (const r of m.reasons) {
      expect(r.job.length).toBeGreaterThan(0);
      expect(r.job === role.title || OPS.includes(r.job)).toBe(true);
      if (r.resume) expect(RESUME_TEXT.includes(r.resume)).toBe(true);
    }
    expect(m.reasons.filter((r) => r.resume).length).toBeGreaterThanOrEqual(1);
  });

  it("a missing skill is a gap 'not evidenced', split by required and preferred, and never a pair", () => {
    const { role, analysis } = make({ description_text: OPS });
    const m = scoreRole(profile(), role, analysis);
    expect(m.gaps.map((g) => [g.name, g.strength])).toEqual([
      ["Salesforce", "required"],
      ["Kubernetes", "preferred"],
    ]);
    expect(m.pairs.some((p) => p.name === "Salesforce")).toBe(false);
    // 3 of 4 required items are backed: SQL, Excel, Analyzing data. Salesforce is not.
    expect(m.parts.required).toBe(3);
  });

  it("a skill the person added counts, and says it has no resume line", () => {
    const p = profile();
    p.resume!.skills.push({ id: "tool:salesforce", name: "Salesforce", basis: "added", evidence: [] });
    const { role, analysis } = make({ description_text: OPS });
    const m = scoreRole(p, role, analysis);
    expect(m.gaps.some((g) => g.name === "Salesforce")).toBe(false);
    expect(m.pairs.find((x) => x.name === "Salesforce")).toMatchObject({ basis: "added", resume: null });
    expect(m.parts.required).toBe(4);
  });

  it("eligibility is separate from relevance: a strong match can carry a stated conflict", () => {
    const text = opsWith("- Must be a U.S. citizen due to government contracts.");
    const { role, analysis } = make({ description_text: text });
    const open = scoreRole(profile(), role, analysis);
    const p = profile();
    p.facts = { workAuth: "needs_sponsor" };
    const blocked = scoreRole(p, role, analysis);
    expect(blocked.eligibility).toBe("conflict");
    expect(blocked.eligibilityNotes[0]).toContain("U.S. citizenship");
    expect(blocked.score).toBe(open.score); // the conflict does not move the score
    expect(blocked.label).toBe(open.label);
  });

  it("unknown authorization stays unknown, whether the listing is silent or the person has not answered", () => {
    const silent = make({ description_text: OPS });
    expect(scoreRole(profile(), silent.role, silent.analysis).eligibility).toBe("unknown");
    const p = profile();
    p.facts = { workAuth: "needs_sponsor", countries: ["US"], inPerson: "yes" };
    const m = scoreRole(p, silent.role, silent.analysis);
    expect(m.eligibility).toBe("unknown");
    expect(m.eligibilityNotes.join(" ")).toContain("says nothing about work authorization");
    const stated = make({ description_text: opsWith("- Must be a U.S. citizen due to government contracts.") });
    const unanswered = scoreRole(profile(), stated.role, stated.analysis);
    expect(unanswered.eligibility).toBe("unknown");
    const citizen = profile();
    citizen.facts = { workAuth: "citizen", countries: ["US"], inPerson: "yes" };
    expect(scoreRole(citizen, stated.role, stated.analysis).eligibility).toBe("no_conflict");
  });

  it("must-haves and nice-to-haves are treated differently", () => {
    const { role, analysis } = make({ description_text: OPS, workplace_type: "OnSite" });
    const flexible = profile();
    flexible.prefs.workplace = { values: ["remote"], required: false };
    const strict = profile();
    strict.prefs.workplace = { values: ["remote"], required: true };
    expect(scoreRole(flexible, role, analysis).missedMustHaves).toEqual([]);
    expect(scoreRole(flexible, role, analysis).parts.prefs).toBe(0);
    expect(scoreRole(strict, role, analysis).missedMustHaves[0]).toContain("on-site");
  });

  it("pay is compared only when currency and period line up; otherwise it is unknown", () => {
    const p = profile();
    p.prefs.salary = { min: 30, currency: "USD", period: "hour", required: true };
    const hourly = make({ description_text: `${OPS}\nPay range: $28 - $35 per hour` });
    expect(scoreRole(p, hourly.role, hourly.analysis).prefs.find((c) => c.name === "Pay")?.status).toBe("met");
    const none = make({ description_text: OPS });
    expect(scoreRole(p, none.role, none.analysis).prefs.find((c) => c.name === "Pay")?.status).toBe("unknown");
    expect(scoreRole(p, none.role, none.analysis).missedMustHaves).toEqual([]);
  });

  it("years are compared only with a confirmed number", () => {
    const { role, analysis } = make({ description_text: opsWith("- 3+ years of experience in operations") });
    expect(scoreRole(profile(), role, analysis).uncertainties.join(" ")).toContain("have not confirmed your years");
    const p = profile();
    p.facts = { yearsFullTime: 1 };
    expect(scoreRole(p, role, analysis).parts.level).toBe(0);
  });

  it("title overlap ignores level words and word endings", () => {
    expect(titleOverlap("business operations", "Supply Chain Business Operations Intern (Summer 2027)")).toBe(1);
    expect(titleOverlap("product manager", "Associate Product Management Intern")).toBe(1);
    expect(titleOverlap("data analyst", "Software Engineer")).toBe(0);
  });
});

describe("ranking", () => {
  const p = profile();
  p.facts = { workAuth: "needs_sponsor" };
  const strongOpen = scoreRole(p, ...(Object.values(make({ id: "bbbbbbbb-0000-0000-0000-000000000000", description_text: OPS })) as [ListedRole, Analysis]));
  const strongBlocked = scoreRole(p, ...(Object.values(make({ id: "aaaaaaaa-0000-0000-0000-000000000000", description_text: opsWith("- Must be a U.S. citizen due to government contracts.") })) as [ListedRole, Analysis]));
  const weak = scoreRole(p, ...(Object.values(make({ id: "cccccccc-0000-0000-0000-000000000000", title: "Mechanical Engineer", function: "hardware_manufacturing", description_text: "Requirements\n- SolidWorks\n- Experience with PCB design" })) as [ListedRole, Analysis]));

  it("puts a stated conflict below an otherwise comparable match, and keeps it in the list", () => {
    expect(strongBlocked.label).toBe(strongOpen.label);
    const ranked = rankMatches([weak, strongBlocked, strongOpen]);
    expect(ranked.map((m) => m.role.id.slice(0, 8))).toEqual(["bbbbbbbb", "aaaaaaaa", "cccccccc"]);
  });

  it("breaks ties the same way every time: score, then newest, then id", () => {
    const a = { ...strongOpen, role: { ...strongOpen.role, id: "b", published_at: "2026-11-01T00:00:00Z" } };
    const b = { ...strongOpen, role: { ...strongOpen.role, id: "a", published_at: "2026-11-01T00:00:00Z" } };
    const c = { ...strongOpen, role: { ...strongOpen.role, id: "z", published_at: "2026-11-09T00:00:00Z" } };
    expect(rankMatches([a, b, c]).map((m) => m.role.id)).toEqual(["z", "a", "b"]);
    expect(rankMatches([c, b, a]).map((m) => m.role.id)).toEqual(["z", "a", "b"]);
    expect(compareMatches(a, a)).toBe(0);
  });
});

describe("retrieval", () => {
  const role = (id: string): ListedRole => toListedRole({ id, title: id, company: "c", url: "u" });

  it("builds one search per wanted title and function, with must-haves as filters", () => {
    const p = profile();
    p.prefs.titles = ["business operations", "chief of staff"];
    p.prefs.functions = ["operations"];
    p.prefs.levels = { values: ["intern", "new_grad"], required: false };
    p.prefs.workplace = { values: ["remote"], required: true };
    p.prefs.engagement = { values: ["internship"], required: false };
    const q = buildQueries(p.prefs);
    expect(q.map((x) => x.params)).toEqual([
      { lvl: "intern,new_grad", wp: "remote", q: "business operations" },
      { lvl: "intern,new_grad", wp: "remote", q: "chief of staff" },
      { lvl: "intern,new_grad", wp: "remote", fn: "operations", sort: "new" },
    ]);
    expect(buildQueries(p.prefs, true)[0].params).toEqual({ q: "business operations" }); // broadened
  });

  it("interleaves searches, removes duplicate job ids and caps the pool", () => {
    const out = interleave([[role("a"), role("b"), role("c")], [role("b"), role("d")], [role("a"), role("e")]]);
    expect(out.map((r) => r.id)).toEqual(["a", "b", "d", "e", "c"]);
    expect(interleave([[role("a"), role("b"), role("c")]], 2).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("an aborted run reports nothing more, so an old search cannot overwrite a new one", async () => {
    const ctl = new AbortController();
    const seen: string[] = [];
    ctl.abort();
    await analyzeAll([role("a"), role("b")], ctl.signal, (o) => seen.push(o.role.id));
    expect(seen).toEqual([]);
  });
});

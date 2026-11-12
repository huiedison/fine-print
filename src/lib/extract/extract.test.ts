import { describe, expect, it } from "vitest";
import { extractRequirements, readListing, type ApiJob } from "./read";
import { compare } from "../compare";

// Short verbatim excerpts from live listings (read Nov 12, 2026) and hand-written
// hard cases. Full descriptions are never committed.
const find = (text: string, kind: string, intern = false) =>
  extractRequirements(text, { isInternLike: intern }).find((r) => r.kind === kind);

const job = (over: Partial<ApiJob>): ApiJob => ({
  id: "00000000-0000-0000-0000-000000000000",
  status: "open",
  url: "https://speedrun-talent-network.com/jobs/x-00000000",
  title: "Role",
  company: "Co",
  stealth: false,
  ...over,
});

describe("quotes", () => {
  it("are verbatim substrings at the stated offsets", () => {
    const text =
      "REQUIRED QUALIFICATIONS\n\n- Must be a U.S. Person due to required access to U.S. export-controlled information or facilities; U.S. clearance eligibility may be required depending on program.\n\nUS Hourly Range\n$40&mdash;$55 USD\n";
    for (const r of extractRequirements(text, { isInternLike: true })) {
      expect(text.slice(r.start, r.end)).toBe(r.quote);
      expect(r.quote.length).toBeLessThanOrEqual(320);
    }
  });
});

describe("known listings", () => {
  it("EliseAI junior research scientist: Ph.D., trial, office days, pay in text, label conflict", () => {
    const r = readListing(
      job({
        seniority: "junior",
        workplace_type: "OnSite",
        labels: { seniority: "junior" },
        description_text:
          "We recently raised a $350 million funding round at a $4 billion valuation.\n\nNote: For this position, we will conduct a 2 month trial period before transitioning to full-time employment.\n\nRequirements\n\n- Ph.D. in Mathematics, Theoretical Physics, Computer Science, or a related field\n\n- Willingness to work in person at our office 4-5 days a week\n\nJob Compensation\nThe salary range for this role is $150,000 - $230,000. EliseAI offers a competitive total rewards package.",
      }),
    );
    const kinds = r.requirements.map((q) => `${q.kind}:${q.strength}`);
    expect(kinds).toContain("degree_phd:required");
    expect(kinds).toContain("trial:info");
    expect(kinds).toContain("office_days:required");
    const pay = r.requirements.find((q) => q.gate === "pay");
    expect(pay?.value).toMatchObject({ min: 150000, max: 230000, period: "year" });
    expect(r.requirements.filter((q) => q.gate === "pay")).toHaveLength(1); // funding round rejected
    expect(r.label_conflicts.map((c) => c.rule_id)).toContain("conflict.level_phd");
    expect(r.silent_gates).toContain("work_auth");
  });

  it("Anduril intern: U.S. Person, enrollment, return to school, term, hourly pay", () => {
    const text =
      "REQUIRED QUALIFICATIONS\n\n- Must be pursuing a bachelor’s or master’s degree in Systems Engineering, Physics, or a related field.\n\n- Must be returning to school at the end of the internship to continue academic studies for at least one quarter or semester.\n\n- Must be a U.S. Person due to required access to U.S. export-controlled information or facilities; U.S. clearance eligibility may be required depending on program.\n\n- Ability to complete an in-person 12-week internship in one of our offices in summer 2027.\n\nPREFERRED QUALIFICATIONS\n\n- Experience with RF payload design and testing\n\nUS Hourly Range\n$40&mdash;$55 USD\n";
    expect(find(text, "us_person", true)?.strength).toBe("required");
    expect(find(text, "us_person", true)?.note).toMatch(/does not mean citizens only/);
    expect(find(text, "clearance_eligible", true)?.strength).toBe("info");
    expect(find(text, "enrolled", true)?.value?.levels).toEqual(["bachelor", "master"]);
    expect(find(text, "return_to_school", true)).toBeTruthy();
    expect(find(text, "term", true)?.summary).toBe("In-person term: 12 weeks, summer 2027");
    const pay = find(text, "pay_range", true);
    expect(pay?.value).toMatchObject({ min: 40, max: 55, period: "hour" });
    expect(pay?.quote).toBe("US Hourly Range\n$40&mdash;$55 USD");
  });

  it("Anduril sustainment engineer: clearance eligibility, years, salary line, transcripts", () => {
    const text =
      "REQUIRED QUALIFICATIONS\n\n- 3+ years of experience designing, testing, and sustaining complex board designs and products\n\n- Eligible to obtain and maintain an active U.S. Secret security clearance\n\nUS Salary Range: $114,000- $152,000\n\nWe request transcripts as part of the early application process to understand your academic background.";
    expect(find(text, "clearance_eligible")?.strength).toBe("required");
    expect(find(text, "years")?.value).toMatchObject({ min: 3 });
    expect(find(text, "pay_range")?.value).toMatchObject({ min: 114000, max: 152000 });
    expect(find(text, "transcripts")).toBeTruthy();
  });

  it("Sekai: company-wide remote statement conflicts with the OnSite label, and is labeled company-wide", () => {
    const r = readListing(
      job({
        workplace_type: "OnSite",
        description_text:
          "We are a Series A company backed by Khosla, a16z and Mayfield, with $30M raised to date. We are remote-first across all positions and are looking for ambitious, AI-native builders.\n\nQualifications\n\n- 5+ years of backend development experience, including at least 2 years in cloud or infrastructure work.",
      }),
    );
    const remote = r.requirements.find((q) => q.kind === "remote");
    expect(remote?.value?.scope).toBe("company");
    expect(r.label_conflicts[0]?.field).toBe("workplace");
    expect(r.requirements.some((q) => q.gate === "pay")).toBe(false);
  });
});

describe("hard cases", () => {
  it("boilerplate: equal opportunity and E-Verify lines are not requirements", () => {
    const text =
      "We are an equal opportunity employer and consider applicants without regard to race, religion, national origin, citizenship, or veteran status.\nThis employer participates in E-Verify and will confirm you are authorized to work in the United States.";
    expect(extractRequirements(text, { isInternLike: false })).toHaveLength(0);
  });
  it("negation: citizenship not required", () => {
    expect(find("U.S. citizenship is not required for this role.", "citizen")).toBeUndefined();
  });
  it("questions on application forms are not statements", () => {
    expect(find("Will you now or in the future require visa sponsorship?", "no_sponsorship")).toBeUndefined();
  });
  it("sponsorship: says no", () => {
    expect(find("We are unable to sponsor visas for this position.", "no_sponsorship")).toBeTruthy();
    expect(find("Must be legally authorized to work in the U.S. and not require sponsorship now or in the future.", "no_sponsorship")).toBeTruthy();
  });
  it("sponsorship: says yes", () => {
    expect(find("Visa sponsorship is available for this role.", "sponsorship_offered")).toBeTruthy();
    expect(find("Visa sponsorship is available for this role.", "no_sponsorship")).toBeUndefined();
  });
  it("preferred qualifications are not required", () => {
    const text = "Nice to have\n\n- Ph.D. in Computer Science\n- 5+ years of experience building distributed systems";
    expect(find(text, "degree_phd")?.strength).toBe("preferred");
    expect(find(text, "years")?.strength).toBe("preferred");
    expect(find("Active Secret clearance preferred.", "clearance_active")?.strength).toBe("preferred");
  });
  it("alternative qualifications: Ph.D. or equivalent experience", () => {
    expect(find("Requirements\n- Ph.D. or equivalent industry experience in machine learning", "degree_phd")?.strength).toBe("alternative");
    expect(find("Requirements\n- BS/MS/PhD in Computer Science", "degree_phd")?.strength).toBe("alternative");
  });
  it("citizenship lists that include protected status read as U.S. Person", () => {
    expect(find("- U.S. Citizenship, Lawful Permanent Residency, or Refugee/Asylee Status Required", "us_person")).toBeTruthy();
    expect(find("- Must be a U.S. citizen or permanent resident", "citizen_or_pr")).toBeTruthy();
    expect(find("- Must be a U.S. Citizen due to clients under U.S. government contracts.", "citizen")).toBeTruthy();
  });
  it("founder bios and funding are not requirements", () => {
    expect(find("Mani earned his Engineering PhD at Stanford.", "degree_phd")).toBeUndefined();
    expect(find("We raised $20 - $30 million in salary-linked financing.", "pay_range")).toBeUndefined();
    expect(find("We offer a $1,000 - $2,000 learning stipend.", "pay_range")).toBeUndefined();
  });
  it("students or recent graduates is not a students-only line", () => {
    const r = find("- Must be pursuing or have recently completed a bachelor’s degree in Finance.", "enrolled", true);
    expect(r?.strength).toBe("alternative");
  });
  it("label-only lines state nothing", () => {
    expect(find("Security Clearance Requirement:", "clearance_eligible")).toBeUndefined();
  });
  it("graduation windows parse months correctly", () => {
    expect(find("Acceptable Graduation Dates: December 2027 - June 2028", "grad_window", true)?.value).toMatchObject({
      from: "2027-12",
      to: "2028-06",
      clean: true,
    });
    expect(find("Must graduate by August 2028", "grad_window", true)?.value).toMatchObject({ from: null, to: "2028-08" });
    expect(find("with plans to graduate in December 2027 or 2028.", "grad_window", true)?.value?.clean).toBe(false);
  });
});

describe("comparisons", () => {
  const usPerson = find("- Must be a U.S. Person due to export controls.", "us_person")!;
  it("U.S. Person: permanent residents meet it; it is not citizens only", () => {
    expect(compare(usPerson, { workAuth: "pr" })?.verdict).toBe("meets");
    expect(compare(usPerson, { workAuth: "needs_sponsor" })?.verdict).toBe("conflicts");
    expect(compare(usPerson, { workAuth: "other_no_sponsor" })?.verdict).toBe("clarify");
  });
  it("missing profile facts need clarification, never a conflict", () => {
    const c = compare(usPerson, {});
    expect(c?.verdict).toBe("clarify");
    expect(c?.reason).toBe("missing_profile");
  });
  it("a graduation date alone cannot establish a return to school", () => {
    const r = find("- Must be returning to school at the end of the internship.", "return_to_school", true)!;
    const c = compare(r, { student: "enrolled", gradMonth: "2027-12" });
    expect(c?.verdict).toBe("clarify");
    expect(c?.ask).toBe("returning");
    expect(compare(r, { returning: "yes" })?.verdict).toBe("meets");
  });
  it("clearance is never judged", () => {
    const r = find("- Eligible to obtain and maintain an active U.S. Secret security clearance", "clearance_eligible")!;
    expect(compare(r, { workAuth: "citizen" })?.verdict).toBe("clarify");
  });
  it("preferred lines get no verdict", () => {
    const r = find("Nice to have\n- 5+ years of experience building systems", "years")!;
    expect(compare(r, { years: 0 })).toBeNull();
  });
  it("lines about another country get no U.S. verdict", () => {
    const r = find("Applicants must already have the right to work in the UK without requiring visa sponsorship.", "no_sponsorship")!;
    expect(compare(r, { workAuth: "citizen" })?.verdict).toBe("clarify");
  });
});

import { describe, expect, it } from "vitest";
import { readListing, type ApiJob } from "./extract/read";
import { gateResults, overall } from "./gates";
import { countryOf } from "./place";
import type { Facts } from "./profile";

const job = (over: Partial<ApiJob>): ApiJob => ({
  id: "00000000-0000-0000-0000-000000000000",
  status: "open",
  url: "https://speedrun-talent-network.com/jobs/x-00000000",
  title: "Engineering Intern",
  company: "Co",
  stealth: false,
  location: "Costa Mesa, California, United States",
  ...over,
});

const INTERN = readListing(
  job({
    seniority: "intern",
    labels: { seniority: "intern", workplace: "onsite" },
    description_text:
      "REQUIRED QUALIFICATIONS\n\n- Must be pursuing a bachelor’s or master’s degree in Physics or a related field.\n\n- Must be returning to school at the end of the internship.\n\n- Must be a U.S. Person due to required access to U.S. export-controlled information.\n\n- Ability to complete an in-person 12-week internship in one of our offices in summer 2027.\n\nUS Hourly Range\n$40&mdash;$55 USD\n",
  }),
);

const gate = (facts: Facts, name: string, reading = INTERN) => gateResults(reading, facts).find((x) => x.gate === name)!;
const state = (facts: Facts, name: string, reading = INTERN) => gate(facts, name, reading).state;

describe("gate states", () => {
  it("work authorization: blocked, clear, and unclear until answered", () => {
    expect(state({ workAuth: "needs_sponsor" }, "work_auth")).toBe("blocked");
    expect(state({ workAuth: "pr" }, "work_auth")).toBe("clear");
    expect(state({ workAuth: "other_no_sponsor" }, "work_auth")).toBe("unclear");
    expect(state({}, "work_auth")).toBe("unclear");
  });

  it("a graduation date alone never establishes enrollment", () => {
    const g = gate({ gradMonth: "2027-12" }, "school");
    expect(g.lines.find((l) => l.r.kind === "enrolled")?.state).toBe("unclear");
    expect(g.state).toBe("unclear");
  });

  it("enrollment and return to school are checked only against direct answers", () => {
    const g = gate({ enrolled: "yes", degree: "bachelor", returning: "yes" }, "school");
    expect(g.lines.map((l) => [l.r.kind, l.state])).toEqual([
      ["enrolled", "clear"],
      ["return_to_school", "clear"],
    ]);
    expect(g.state).toBe("clear");
    expect(state({ enrolled: "yes", degree: "bachelor" }, "school")).toBe("unclear"); // return to school not answered
    expect(state({ enrolled: "no" }, "school")).toBe("blocked");
    expect(state({ enrolled: "yes", degree: "phd", returning: "yes" }, "school")).toBe("blocked"); // listing names bachelor's or master's
  });

  it("experience and degree floors are compared with confirmed facts", () => {
    const r = readListing(job({ title: "Engineer", description_text: "Requirements\n- 3+ years of experience building backend systems\n- Ph.D. in Computer Science" }));
    expect(state({}, "experience", r)).toBe("unclear");
    expect(state({ yearsFullTime: 1, degree: "bachelor" }, "experience", r)).toBe("blocked");
    const years = (f: Facts) => gate(f, "experience", r).lines.find((l) => l.r.kind === "years")?.state;
    expect(years({ yearsFullTime: 4 })).toBe("clear");
    expect(years({ yearsFullTime: 2 })).toBe("blocked");
    expect(years({})).toBe("unclear");
  });

  it("informational and preferred lines are 'stated', never 'clear'", () => {
    const r = readListing(job({ title: "Engineer", description_text: "Nice to have\n- 5+ years of experience building distributed systems\n\nVisa sponsorship is available for this role." }));
    expect(state({ yearsFullTime: 0 }, "experience", r)).toBe("stated");
    // sponsorship on offer is information for someone who does not need it
    expect(state({ workAuth: "citizen" }, "work_auth", r)).toBe("stated");
    expect(state({ workAuth: "needs_sponsor" }, "work_auth", r)).toBe("clear");
  });

  it("hedged lines are unclear", () => {
    const r = readListing(job({ description_text: "Visa sponsorship may be available for exceptional candidates.\n- U.S. clearance eligibility may be required depending on program." }));
    expect(state({ workAuth: "needs_sponsor" }, "work_auth", r)).toBe("unclear");
    expect(state({ workAuth: "citizen" }, "work_auth", r)).toBe("unclear");
  });

  it("silence is doesn't say, even for someone who needs sponsorship", () => {
    const quiet = readListing(job({ description_text: "We build things. Join us." }));
    expect(state({ workAuth: "needs_sponsor" }, "work_auth", quiet)).toBe("silent");
    expect(state({}, "pay", quiet)).toBe("silent");
  });

  it("place: blocked by country or by in-person work, clear otherwise, unclear when it cannot tell", () => {
    expect(state({ countries: ["CA"], inPerson: "yes" }, "place_time")).toBe("blocked");
    expect(state({ countries: ["US"], inPerson: "no" }, "place_time")).toBe("blocked");
    expect(state({ countries: ["US", "CA"], inPerson: "yes" }, "place_time")).toBe("clear");
    expect(state({}, "place_time")).toBe("unclear");
    const many = readListing(job({ location: "4 Locations", description_text: "We build things." }));
    expect(state({ countries: ["CA"], inPerson: "yes" }, "place_time", many)).toBe("unclear");
    const tokyo = readListing(job({ location: "Tokyo", workplace_type: "Remote", description_text: "This role is remote-first." }));
    expect(state({ countries: ["US", "CA"], inPerson: "yes" }, "place_time", tokyo)).toBe("unclear");
  });

  it("pay is stated, never clear or blocked", () => {
    expect(state({}, "pay")).toBe("stated");
  });

  it("overall: blocked if any gate is blocked; clear needs at least one checked line and nothing open", () => {
    expect(overall(gateResults(INTERN, { workAuth: "needs_sponsor" }))).toBe("blocked");
    expect(overall(gateResults(INTERN, { workAuth: "citizen" }))).toBe("open");
    const simple = readListing(job({ description_text: "Requirements\n- Must be a U.S. citizen or permanent resident.\n- 1+ years of experience in support." }));
    expect(overall(gateResults(simple, { workAuth: "citizen", yearsFullTime: 2, countries: ["US"], inPerson: "yes" }))).toBe("open"); // school is silent
  });
});

describe("countryOf", () => {
  it("reads common board location formats", () => {
    expect(countryOf("Costa Mesa, California, United States")).toBe("US");
    expect(countryOf("San Francisco")).toBe("US");
    expect(countryOf("MN - Apple Valley")).toBe("US");
    expect(countryOf("Chaska, MN")).toBe("US");
    expect(countryOf("Toronto, ON")).toBe("CA");
    expect(countryOf("Montréal, Quebec, Canada")).toBe("CA");
    expect(countryOf("Bangalore, IN")).toBe("other");
    expect(countryOf("IN - Chennai")).toBe("other");
    expect(countryOf("London, England, GBR")).toBe("other");
    expect(countryOf("Singapore")).toBe("other");
  });
  it("returns null when it cannot tell", () => {
    expect(countryOf("4 Locations")).toBeNull();
    expect(countryOf("Lahey Clinic")).toBeNull();
    expect(countryOf(null)).toBeNull();
  });
});

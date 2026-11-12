import { describe, expect, it } from "vitest";
import { readListing, type ApiJob } from "./extract/read";
import { gateResults, overall, type Answers } from "./gates";
import { countryOf } from "./place";

const NOW = new Date("2026-11-12T00:00:00Z");

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

const state = (answers: Answers, gate: string, reading = INTERN) => {
  const g = gateResults(reading, answers, NOW).find((x) => x.gate === gate)!;
  return g.state === "silent" && g.unclear ? "unclear" : g.state;
};

describe("three states", () => {
  it("work authorization: blocked, clear, and unclear until answered", () => {
    expect(state({ workAuth: "needs_sponsor" }, "work_auth")).toBe("blocked");
    expect(state({ workAuth: "pr" }, "work_auth")).toBe("clear");
    expect(state({ workAuth: "other_no_sponsor" }, "work_auth")).toBe("unclear");
    expect(state({}, "work_auth")).toBe("unclear");
  });

  it("school: a future graduation date reads as a current student, but return-to-school stays unclear", () => {
    const g = gateResults(INTERN, { gradMonth: "2027-12" }, NOW).find((x) => x.gate === "school")!;
    expect(g.lines.find((l) => l.r.kind === "enrolled")?.state).toBe("clear");
    expect(g.lines.find((l) => l.r.kind === "return_to_school")?.unclear).toBe(true);
    expect(g.state).toBe("silent");
    expect(g.unclear).toBe(true);
  });

  it("school: someone who has graduated is blocked by a must-be-a-student line", () => {
    expect(state({ gradMonth: "2025-05" }, "school")).toBe("blocked");
  });

  it("place: blocked by country or by in-person work, clear otherwise", () => {
    expect(state({ countries: ["CA"], inPerson: "yes" }, "place_time")).toBe("blocked");
    expect(state({ countries: ["US"], inPerson: "no" }, "place_time")).toBe("blocked");
    expect(state({ countries: ["US", "CA"], inPerson: "yes" }, "place_time")).toBe("clear");
    expect(state({}, "place_time")).toBe("unclear");
  });

  it("place: a remote role listed in a country you did not pick is unclear, not clear", () => {
    const r = readListing(job({ location: "Tokyo", workplace_type: "Remote", description_text: "This role is remote-first." }));
    expect(state({ countries: ["US", "CA"], inPerson: "yes" }, "place_time", r)).toBe("unclear");
  });

  it("place: an unreadable location is unclear, never blocked", () => {
    const r = readListing(job({ location: "4 Locations", description_text: "We build things." }));
    expect(state({ countries: ["CA"], inPerson: "yes" }, "place_time", r)).toBe("unclear");
  });

  it("pay: found in the text counts as stated; nothing anywhere is doesn't say", () => {
    expect(state({}, "pay")).toBe("clear");
    const none = readListing(job({ description_text: "We build things. Join us." }));
    expect(state({}, "pay", none)).toBe("silent");
  });

  it("silence on work authorization is doesn't say, even for someone who needs sponsorship", () => {
    const quiet = readListing(job({ description_text: "We build things. Join us." }));
    const g = gateResults(quiet, { workAuth: "needs_sponsor" }, NOW).find((x) => x.gate === "work_auth")!;
    expect(g.state).toBe("silent");
    expect(g.unclear).toBe(false);
  });

  it("experience floors are never called blocked, because we do not ask about experience", () => {
    const r = readListing(job({ title: "Engineer", description_text: "Requirements\n- 5+ years of experience building backend systems" }));
    expect(state({ gradMonth: "2027-12" }, "experience", r)).toBe("unclear");
  });

  it("hedged sponsorship is unclear for someone who needs it", () => {
    const r = readListing(job({ description_text: "Visa sponsorship may be available for exceptional candidates." }));
    expect(state({ workAuth: "needs_sponsor" }, "work_auth", r)).toBe("unclear");
  });

  it("overall is blocked if any gate is blocked", () => {
    expect(overall(gateResults(INTERN, { workAuth: "needs_sponsor" }, NOW))).toBe("blocked");
    expect(overall(gateResults(INTERN, { workAuth: "citizen" }, NOW))).toBe("silent");
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

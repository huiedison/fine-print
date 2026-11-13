import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileToText, LIMITS, pastedToText, ResumeError, type Parsers } from "./extractText";
import { dateRange, parseResume } from "./parse";

// Every fixture is synthetic. See scripts/make-fixtures.py.
const DIR = join(__dirname, "fixtures");
const TEXT = readFileSync(join(DIR, "synthetic-resume.txt"), "utf8");

const parsers: Parsers = {
  pdf: async () => (await import("pdfjs-dist/legacy/build/pdf.mjs")) as never,
  docx: async () => {
    const mammoth = await import("mammoth");
    return { extractRawText: ({ arrayBuffer }) => mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) }) };
  },
};

function file(name: string, type: string, bytes: Uint8Array) {
  return { name, type, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}
const fixture = (name: string, type: string) => file(name, type, new Uint8Array(readFileSync(join(DIR, name))));
const kind = async (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof ResumeError ? e.kind : `other:${e}`));

describe("reading a resume file", () => {
  it("reads a DOCX", async () => {
    const text = await fileToText(fixture("synthetic-resume.docx", ""), parsers);
    expect(text).toContain("Harbourline Pension Partners");
    expect(parseResume(text).experience).toHaveLength(3);
  });

  it("reads a PDF with a text layer, line by line", async () => {
    const text = await fileToText(fixture("synthetic-resume.pdf", "application/pdf"), parsers);
    expect(text).toContain("EXPERIENCE\n");
    const r = parseResume(text);
    expect(r.experience.map((e) => e.org)).toContain("Lumen Collective");
    expect(r.skills.find((s) => s.name === "Python")?.basis).toBe("listed");
  });

  it("says a PDF with no text layer looks scanned", async () => {
    expect(await kind(fileToText(fixture("scanned-no-text.pdf", "application/pdf"), parsers))).toBe("scanned");
  });

  it("rejects unsupported types before reading them", async () => {
    expect(await kind(fileToText(file("resume.pages", "application/octet-stream", new Uint8Array(10)), parsers))).toBe("unsupported");
    expect(await kind(fileToText(file("photo.png", "image/png", new Uint8Array(10)), parsers))).toBe("unsupported");
    expect(await kind(fileToText(file("old.doc", "application/msword", new Uint8Array(10)), parsers))).toBe("unsupported");
  });

  it("rejects files over the size limit without opening them", async () => {
    const big = { name: "big.pdf", type: "application/pdf", size: LIMITS.maxBytes + 1, arrayBuffer: async () => { throw new Error("must not be read"); } };
    expect(await kind(fileToText(big, parsers))).toBe("oversized");
  });

  it("reports a damaged file as unreadable", async () => {
    const junk = new TextEncoder().encode("this is not a real document ".repeat(20));
    expect(await kind(fileToText(file("broken.pdf", "application/pdf", junk), parsers))).toBe("unreadable");
    expect(await kind(fileToText(file("broken.docx", "", junk), parsers))).toBe("unreadable");
    expect(await kind(fileToText(file("empty.pdf", "application/pdf", new Uint8Array(0)), parsers))).toBe("unreadable");
  });

  it("asks for more when pasted text is too short", () => {
    expect(() => pastedToText("Jordan Rivera")).toThrowError(ResumeError);
    expect(pastedToText(TEXT)).toContain("Jordan Rivera");
  });
});

describe("parsing", () => {
  const r = parseResume(TEXT, "synthetic-resume.txt");

  it("finds roles with titles, employers, dates and kind", () => {
    expect(r.experience.map((e) => [e.title, e.org, e.start, e.end, e.kind])).toEqual([
      ["Product Analyst Intern", "Harbourline Pension Partners", "2026-05", "present", "internship"],
      ["Co-founder", "Lumen Collective", "2025-09", "present", "full_time"],
      ["Member Services Representative", "Pacific Ridge Credit Union", "2024-06", "2025-08", "full_time"],
    ]);
  });

  it("finds projects and education, and notes an expected graduation", () => {
    expect(r.projects.map((p) => p.name)).toEqual(["Transit Delay Dashboard", "Campus Marketplace"]);
    expect(r.education[0]).toMatchObject({ school: "University of Northern Cascadia", degree: "bachelor", field: "Economics and Statistics", end: "2027-12", expected: true });
  });

  it("every piece of evidence is a verbatim span of the resume", () => {
    const all = [...r.skills.flatMap((s) => s.evidence), ...r.experience.flatMap((e) => [e.evidence, ...e.bullets]), ...r.projects.flatMap((p) => p.bullets), ...r.education.map((e) => e.evidence)];
    expect(all.length).toBeGreaterThan(20);
    for (const e of all) expect(TEXT.slice(e.start, e.end)).toBe(e.quote);
  });

  it("separates skills named in a skills section from skills read out of described work", () => {
    const by = (name: string) => r.skills.find((s) => s.name === name);
    expect(by("Figma")?.basis).toBe("listed");
    expect(by("Figma")?.evidence[0].section).toBe("skills");
    expect(by("Working with stakeholders")?.basis).toBe("shown");
    expect(by("Working with stakeholders")?.evidence[0]).toMatchObject({ section: "experience", where: "Product Analyst Intern, Harbourline Pension Partners" });
    // Next.js appears only in a project line, never in the skills list
    expect(by("Next.js")?.basis).toBe("shown");
    expect(by("Next.js")?.evidence[0].where).toBe("Campus Marketplace");
    // Python is listed, and the work that backs it is kept too
    expect(by("Python")?.basis).toBe("listed");
    expect(by("Python")?.evidence.some((e) => e.section === "experience")).toBe(true);
  });

  it("does not claim a skill the resume never mentions", () => {
    expect(r.skills.some((s) => s.name === "Kubernetes" || s.name === "Salesforce")).toBe(false);
  });

  it("reads nothing about authorization, enrollment or where the person wants to work", () => {
    expect(Object.keys(r).sort()).toEqual(["education", "experience", "fileName", "projects", "skills"]);
  });

  it("reads common date formats", () => {
    expect(dateRange("Jan 2024 – Mar 2025")).toMatchObject({ start: "2024-01", end: "2025-03" });
    expect(dateRange("September 2023 - Present")).toMatchObject({ start: "2023-09", end: "present" });
    expect(dateRange("06/2022 to 08/2022")).toMatchObject({ start: "2022-06", end: "2022-08" });
    expect(dateRange("2021 - 2023")).toMatchObject({ start: "2021-01", end: "2023-12" });
    expect(dateRange("Built a thing in 2023")).toBeNull();
  });
});

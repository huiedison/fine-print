// End-to-end check of the resume flow: upload, review, preferences, matches, clear.
//
// Needs the app running (npm run dev, or npm run build && npm start) and Google Chrome
// installed. The speedrun API is replaced with synthetic roles so the run is repeatable.
//
//   npm run e2e                      # against http://localhost:3000
//   BASE_URL=http://localhost:4000 npm run e2e
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../src/lib/resume/fixtures");

const OPS = `What you'll do
- Coordinate with engineering, finance and support stakeholders to keep launches on schedule
- Streamline manual reporting workflows and track operational metrics

Requirements
- Strong SQL and Excel skills
- Experience with Salesforce
`;
const job = (id, title, extra = "") => ({
  id: `${id}-0000-0000-0000-000000000000`,
  status: "open",
  url: `https://speedrun-talent-network.com/jobs/x-${id}`,
  title,
  company: "Northwind Robotics (synthetic)",
  tier: "a16z",
  stealth: false,
  location: "San Francisco, CA",
  workplace_type: "Hybrid",
  employment_type: "FullTime",
  function: "operations",
  seniority: "junior",
  remote: false,
  comp_min: null,
  comp_max: null,
  comp_currency: null,
  comp_period: null,
  published_at: "2026-11-01T00:00:00Z",
  description_text: OPS + extra,
});
const JOBS = [
  job("aaaaaaaa", "Business Operations Associate"),
  job("bbbbbbbb", "Business Operations Analyst", "- Must be a U.S. citizen due to government contracts.\n"),
  job("cccccccc", "Operations Coordinator"),
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const check = (name, fn) => results.push([name, fn]);

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const sent = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("request", (r) => sent.push({ url: r.url(), method: r.method(), body: r.postData() ?? "" }));

  let detailCalls = 0;
  await page.route("https://speedrun-talent-network.com/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (url.pathname.endsWith("/jobs")) {
      const list = JOBS.map((j) => ({ ...j, description_text: undefined }));
      return route.fulfill({ headers, body: JSON.stringify({ jobs: list, total: 3, page: 0, has_more: false, facets: { lvl: [] } }) });
    }
    detailCalls++;
    const id = url.pathname.split("/").pop();
    // the third role always fails, to exercise partial results
    if (id.startsWith("cccccccc")) return route.fulfill({ status: 500, headers, body: "{}" });
    return route.fulfill({ headers, body: JSON.stringify({ job: JOBS.find((j) => j.id === id) }) });
  });

  const tag = `${viewport.width}px`;
  await page.goto(BASE, { waitUntil: "networkidle" });

  // 1. upload
  assert.match(await page.getByText("What happens to your resume").locator("..").innerText(), /not uploaded/);
  await page.getByTestId("resume-file").setInputFiles(join(FIXTURES, "synthetic-resume.pdf"));
  await page.getByTestId("resume-summary").waitFor({ timeout: 20000 });
  assert.match(await page.getByTestId("resume-summary").innerText(), /synthetic-resume\.pdf/);
  assert.match(await page.getByTestId("resume-summary").innerText(), /3 roles/);

  // 2. review
  await page.getByRole("button", { name: "Review what we found" }).click();
  assert.match(await page.getByTestId("skills-listed").innerText(), /Python/);
  assert.match(await page.getByTestId("skills-shown").innerText(), /Working with stakeholders/);
  await page.getByTestId("skills-shown").getByText("Where each one came from").click();
  assert.match(await page.getByTestId("skills-shown").innerText(), /Coordinated with compliance, operations and portfolio stakeholders/);
  // nothing about authorization or enrollment is pre-filled from the resume
  assert.equal(await page.getByRole("button", { pressed: true }).count(), 0);
  assert.equal(await page.getByTestId("find-matches").isDisabled(), true);

  // 3. preferences and direct questions
  await page.getByRole("button", { name: "I’d need sponsorship" }).click();
  await page.getByLabel("Job titles you want").fill("business operations");
  await page.getByRole("button", { name: "Add title" }).click();
  assert.match(await page.getByTestId("wanted-titles").innerText(), /business operations/);
  await page.getByTestId("find-matches").click();

  // 4. matches
  await page.getByTestId("match-card").first().waitFor({ timeout: 20000 });
  await page.getByText("could not be read").waitFor({ timeout: 20000 });
  const status = await page.getByTestId("match-status").innerText();
  assert.match(status, /Retrieved 3 roles/);
  assert.match(status, /Analyzed 2/);
  assert.match(status, /best matches among the 2 analyzed, not the whole board/);
  assert.match(status, /1 could not be read/);
  // the role with a citizenship line is held back under its own filter
  assert.equal(await page.getByTestId("match-card").count(), 1);
  const first = page.getByTestId("match-card").first();
  assert.match(await first.innerText(), /Business Operations Associate/);
  assert.match(await first.getByTestId("eligibility").innerText(), /Eligibility not confirmed/);
  assert.match(await first.getByTestId("label").innerText(), /match$/);
  assert.doesNotMatch(await first.innerText(), /%|probability|likely to get/i);
  await page.getByTestId("filter-conflicts").click();
  assert.equal(await page.getByTestId("match-card").count(), 1);
  assert.match(await page.getByTestId("match-card").first().innerText(), /Stated eligibility conflict/);
  assert.match(await page.getByTestId("match-card").first().innerText(), /U\.S\. citizenship/);
  await page.getByTestId("filter-all").click();
  const cards = page.getByTestId("match-card");
  assert.equal(await cards.count(), 2);
  // every reason on every card shows the listing's words; at least one per card shows the resume's
  for (let i = 0; i < 2; i++) {
    const reasons = cards.nth(i).getByTestId("reasons").locator("> li");
    const n = await reasons.count();
    assert.ok(n >= 2 && n <= 3, `card ${i} has ${n} reasons`);
    let withResume = 0;
    for (let j = 0; j < n; j++) {
      const text = await reasons.nth(j).innerText();
      assert.match(text, /the listing says/i);
      if (/your resume says/i.test(text)) withResume++;
    }
    assert.ok(withResume >= 1, `card ${i} cites the resume`);
  }
  await cards.first().getByText("Evidence, gaps and requirements").click();
  assert.match(await cards.first().innerText(), /Salesforce · required · not evidenced in your resume/);
  assert.match(await cards.first().innerText(), /not a chance of getting an interview/);

  // 5. the resume never left the browser
  const leaked = sent.filter((r) => r.method !== "GET" || /Harbourline|Jordan|Rivera/i.test(r.url + r.body));
  assert.deepEqual(leaked, [], "no request carried resume content");
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fine_print")).length), 0, "nothing saved unless asked");

  // 6. clear: back to step one, nothing left, and nothing comes back
  const before = detailCalls;
  await page.getByTestId("clear-all").click();
  await page.getByTestId("resume-file").waitFor();
  assert.equal(await page.getByTestId("resume-summary").count(), 0);
  assert.equal(await page.getByTestId("match-card").count(), 0);
  await page.getByRole("button", { name: "Continue without a resume" }).click();
  assert.equal(await page.getByTestId("wanted-titles").locator("li").count(), 0);
  assert.equal(await page.getByRole("button", { pressed: true }).count(), 0);
  await page.waitForTimeout(800);
  assert.equal(detailCalls, before, "no job requests after clearing");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
  assert.deepEqual(consoleErrors.filter((e) => !/500|Failed to load resource/.test(e)), [], "no console errors");

  check(`${tag}: upload, review, preferences, matches, clear`, true);
  await context.close();
}

await browser.close();
for (const [name] of results) console.log(`ok  ${name}`);
console.log(`${results.length} end-to-end checks passed`);

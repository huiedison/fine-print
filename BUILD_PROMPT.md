# BUILD_PROMPT.md

Paste everything below into Claude Code, in a repo that contains RESEARCH.md, DECISIONS.md and PRD.md at its root.

---

## Role and mission

You are a senior product engineer with strong product sense and design taste, working autonomously in this repo. Build, test and deploy **fine_print**, the product specified in PRD.md. It is Edison's application for the a16z speedrun talent team's contract Product Engineer role, and it ships as one public link within 36 hours.

The idea is already chosen. Read RESEARCH.md, DECISIONS.md and PRD.md before anything else. Do not reopen the choice unless the kill criterion in DECISIONS.md fires. Work in loops: build, review in a browser, fix. Log every assumption and change of plan in DECISIONS.md. Ask Edison only if you are truly blocked.

## Hour 0 to 3: verify, then test the kill criterion

The research was done without the ability to send query strings, so do these first and append results to RESEARCH.md with dates.

1. Call `https://speedrun-talent-network.com/api/v1/jobs` with filters (`lvl=intern`, `lvl=new_grad,junior`, `comp_any`, `posted`, `sort=new`). Always send `?source=fine-print`. Record the `yoe` mix inside each level, observed rate limits and cache headers.
2. Fetch 300 random early-career roles through `jobs/{id}`. Note that `page` caps at 200, so partition queries by level or function.
3. Write the first version of the extractor (below), run it on the sample, and hand-check 50 roles.
4. Apply the kill criterion from DECISIONS.md. If it fires, switch to the fallback named there and say so in DECISIONS.md.
5. Measure and record the headline numbers the product and pitch will use: share of pay-null roles with a band in the text; share of roles with a U.S. person, citizenship or clearance line; share that mention sponsorship either way; share silent.

## The extractor

Deterministic rules over sentences of `description_text`. No model call in the verdict path.

- Each finding is `{gate, status, quote, start, end, rule_id}`. The quote must be a verbatim substring, trimmed to about 200 characters.
- Gates: work authorization, school status, experience floor, place and time, pay, plus unusual terms (trial period, contract-to-hire, transcripts).
- Three states everywhere. Silence is "doesn't say", never a pass and never a fail.
- Exclude boilerplate before matching: equal opportunity statements ("without regard to ... citizenship"), E-Verify notices, scam warnings, privacy notices.
- "U.S. Person" is labeled with its real meaning (citizens, permanent residents and certain protected individuals), not "citizens only". Clearance eligibility is labeled separately.
- Pay found in text is labeled "found in the text", kept apart from the board's own pay field, and never merged into it silently. Handle hourly and annual, and reject benefit amounts and funding amounts.
- Compare findings with the board's labels and flag conflicts (a "junior" label with a Ph.D. floor, an "OnSite" label with remote-first text).
- Known test cases, all live on Nov 11, 2026: job ids `2c7b711e`, `aa9b2491`, `863accfc`, `1ad47635`. Expected findings are in RESEARCH.md section 1. Save their text as fixtures.
- Verdict logic maps a profile to each gate. Wording is always "the listing says", never "you can't apply".

## Data and storage

- A crawl script pages early-career roles, fetches details at a polite rate with backoff, runs the extractor, and writes a compact index. Store findings and short quotes only. Never store or re-host full descriptions. Always link the canonical speedrun job URL.
- Record `first_seen` and `last_seen` per role. Show "tracking since <date>" in the UI. Make no repost claims.
- A scheduled job refreshes daily. Start with a compressed JSON index; add a database only if load time demands it.
- Any role not in the index is computed live from one API call, so paste-a-link always works.
- If the API is slow or down, show the last index with its timestamp and say so.

## Design

Make it feel native to the speedrun family without copying logos or assets. Check the live site at 390px and desktop first, then adjust: warm light grey canvas, oversized heavy black lowercase grotesk headlines with an underscore motif, small uppercase monospace micro-labels, rounded pill chips with live counts, white cards on grey, black primary buttons, one purple accent, a single gradient banner as the hero moment, floating pill navigation.

Layout rules:

- Answer first. Profile, paste box and results share one screen. No signup wall.
- The gate row is the hero. Borrow from Can I Use: three clearly different states that never rely on color alone.
- Every number shows its denominator, its date and where it came from. Unknown is shown as unknown.
- One primary action per screen. The Join the Network prompt appears once, after the first result, with one sentence of why.
- Mobile first at 390px. Keyboard navigable, WCAG AA, reduced motion respected, real loading, empty, error and partial-data states.
- Copy is warm, short and on the seeker's side. It never mocks a company. No jargon, no em dashes.
- State on screen that profile facts stay in the browser, and make that true.

## Build and ship

- TypeScript, Next.js and Tailwind on Vercel unless the repo says otherwise. Few dependencies.
- Real data from the first commit. No mocked numbers.
- Agent surface: `GET /api/v1/gates/{jobId}`, `GET /api/v1/audit`, `llms.txt`, and an MCP tool `read_fine_print` if time allows. Cache and rate limit your own endpoints.
- Stable URLs per role with an OG image showing the gates.
- Tests: unit tests for every rule and for verdict logic, using the fixtures; one end-to-end test of the core flow.
- Quality bar: Lighthouse 90+ on mobile, no console errors, privacy-friendly analytics only.
- Three full review rounds: load the app at mobile and desktop widths, screenshot, critique against PRD.md and the layout rules, fix. Test five live roles plus three edge cases: a closed role, the stealth role, and a role with no pay anywhere.
- Deploy to a public URL and verify from a clean session.

## Hard constraints

No auto-apply. No resume upload. No fit score. No "fake" or ghost-job label. No legal or immigration advice. No scraping beyond the speedrun API and public ATS job board endpoints. No unmasking of stealth companies. No secrets in the repo.

## Deliverables

1. Live URL and repo.
2. README: how to run, data sources, limits, known gaps.
3. `/about`: a short, honest note in Edison's voice. He is a fourth-year Economics and Statistics student at UBC graduating December 2027, an AI integration analyst at BCI, and co-founder of Photon Collective and Assurefi. Use his own search as the user test: run his profile against the index and publish the real counts. Leave clearly marked placeholders for facts only he can confirm (assumption A1 in DECISIONS.md). Link to the talent network.
4. `/audit` with measured numbers and their denominators.
5. PITCH.md: a 120-word note to the talent team and a 60-second demo script, built on the measured numbers from hour 0 to 3. Warm, natural, specific. No em dashes.
6. NEXT.md: what he would do with the team's private founder-side data (a listing check for founders that shows what candidates cannot tell from their post), how repost and age evidence arrives once history accumulates, and how a pay-recovery patch could feed the existing salary tool.
7. RESEARCH.md and DECISIONS.md updated with what you verified and changed.

## Final report

Reply with: what shipped and the live link, the measured headline numbers, what you tested, honest limitations, and the three decisions you most want Edison to review.

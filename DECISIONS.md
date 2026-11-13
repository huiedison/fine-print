# DECISIONS.md

Decided November 11, 2026. Evidence is in RESEARCH.md.

## The pick

**fine_print**: tell it three things about you, and it reads every listing for the lines that rule you in or out, then quotes them.

Working headline: *some jobs already said no. it's in paragraph nine.*

Each role gets a short row of gates (work authorization, school status, experience floor, place and time, pay). Each gate shows one of three states: **clear**, **blocked**, or **doesn't say**, with the listing's own sentence beside it. Pay is shown when the board has it, and recovered from the description when the board missed it.

## Ideas and scores

Criteria, 1 to 5 each: (a) pain severity and frequency, (b) fit with speedrun data and principles, (c) differentiation, (d) buildable and excellent in 48 hours, (e) shareability, (f) agent surface, (g) shows Product, Design, Ship, Lived It.

| # | Idea | a | b | c | d | e | f | g | Total |
|---|---|---|---|---|---|---|---|---|---|
| 6 | **fine_print: gates read from the listing, quoted, with a personal verdict** | 5 | 5 | 4 | 4 | 5 | 5 | 5 | **33** |
| 3 | Honest entry-level finder | 5 | 4 | 3 | 4 | 4 | 3 | 4 | 27 |
| 7 | Pay recovered: bands found in text that the pay field missed | 3 | 5 | 4 | 5 | 3 | 4 | 3 | 27 |
| 1 | Before you apply: reality check on any link, with repost history | 4 | 4 | 3 | 2 | 4 | 4 | 4 | 25 |
| 2 | Pay check by craft, level, metro, stage | 3 | 5 | 2 | 5 | 3 | 4 | 3 | 25 |
| 8 | Listing linter for founders | 3 | 4 | 4 | 4 | 3 | 3 | 3 | 24 |
| 11 | Weekly shortlist agent over MCP | 3 | 4 | 2 | 3 | 2 | 5 | 3 | 22 |
| 9 | Repost and age tracker from snapshots | 4 | 3 | 3 | 1 | 4 | 3 | 3 | 21 |
| 4 | Evidence-first fit explainer (CV in browser) | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 20 |
| 10 | Layoff to open-roles matcher | 3 | 3 | 2 | 4 | 3 | 3 | 2 | 20 |
| 5 | Founder brief generator | 3 | 3 | 3 | 3 | 2 | 3 | 2 | 19 |

Why the starting hypotheses lost:

- **1, Before you apply.** Its best evidence (reposts, first seen) needs weeks of snapshots. We have two days. fine_print keeps its shape and swaps in evidence that exists today.
- **2, Pay check.** The salary tool and `/stats/hiring` already do most of it. The new part, recovered pay, is folded into fine_print as a gate.
- **3, Entry-level finder.** The board already filters by level and experience. The gap is eligibility, which fine_print covers for the same audience.
- **4 and 5.** Crowded, and weak on lived experience.

## Why this one

1. **It came out of their data.** In four listings I read, the fields missed a Ph.D. requirement on a "junior" role, two posted pay bands, a U.S. person rule, a return-to-school rule, and a remote-first policy on an "OnSite" role.
2. **The audience is half the board.** 48% of open roles are intern, new grad or junior. The team's own job post welcomes students and co-ops.
3. **The pain is current and measured.** 109 applications per internship. Sponsorship mentioned in 2.6% of postings. 15% of the board is defense and space.
4. **It is Edison's search.** A Canadian student graduating in December 2027, applying to U.S. internships, hits these gates on most applications.
5. **It honors every principle.** Evidence over scores, unknown shown as unknown, no auto-apply, same data for people and agents, join prompt after value.
6. **It works on day one.** A single role check needs one live API call. No history required.

## Trying to kill it

**The strongest case against:**

1. *A wrong "blocked" costs someone a real chance.* Rules misread text. Mitigation: we never say "you can't apply". We say "the listing says" and show the sentence, link the original, favor precision over recall, and offer "report a miss".
2. *Sponsorship filters exist.* Jobright and FrogHire infer from employer history; Simplify lists carry sparse tags. Ours reads the listing, quotes it, counts silence, and adds school and clearance gates. Overlap is partial, not total.
3. *Most listings say nothing about authorization.* Then most rows read "doesn't say". That is honest and still useful, and the other gates carry the product for interns.
4. *speedrun could add these labels in a week.* Good. A prototype of a label they would want is the point of the application.
5. *It touches sensitive ground.* Citizenship and visas. We quote employers and give no legal or immigration advice, and say so.
6. *A crawl leans on their API.* About 11,000 detail calls for early career. Mitigation: low rate, backoff, `?source=`, incremental after the first pass, on-demand only if limits bite.

**Kill criterion.** Before building UI, run the extractor over a random sample of at least 300 early-career roles and hand-check 50.

- Kill if fewer than 25% of sampled roles yield at least one hard gate or a recovered pay band.
- Kill if precision on "blocked" calls is under 90% after one round of rule fixes.

If killed, build idea 3 with idea 7 inside it: an honest entry-level finder that leads with recovered pay.

**Verdict.** It survives on today's evidence (4 of 4 listings had a missed fact), with the caveat that n is tiny. The sample above is the real test and runs first.

## Assumptions log

| # | Assumption | Risk if wrong | How to check |
|---|---|---|---|
| A1 | Edison is a Canadian citizen without U.S. work authorization | The About note and his user test are wrong | Edison confirms |
| A2 | The API tolerates a crawl at about 2 requests a second | Crawl fails; fall back to on-demand plus a stated sample | Measure; read response headers |
| A3 | Rules (regex over sentences) reach 90%+ precision on blocked calls | Kill criterion fires | Fixture set and hand audit |
| A4 | Short quotes with a link back are fair use of listing text and within the API's spirit | Trust issue with the team | Keep quotes under about 200 characters; always link the canonical URL; never store full descriptions |
| A5 | "U.S. Person" is shown as its legal meaning (citizens, permanent residents and certain protected individuals), not as "citizens only" | Misleading verdicts | Unit test the label copy |
| A6 | Vercel plus a scheduled GitHub Action is enough; no database needed for about 11,000 small records | Slow loads | Start with a compressed JSON index; add Postgres only if needed |
| A7 | The name fine_print does not collide with a speedrun product | Awkward | Search the live site |

## Decisions made without asking

- Early-career roles are the first lens, but paste-a-link works for any role on the board.
- Rules first, no model call in the verdict path. A model may propose candidate sentences at crawl time only if recall is poor, and every quote must be a verbatim substring.
- No fit score, no CV upload, no ghost-job label, no repost claims. First seen and last seen are recorded from day one and shown as "tracking since".
- Company sponsorship history is out of scope for v1. It answers a different question.

## Three decisions for Edison to review

1. **Audience.** Leading with students, co-ops and people who need work authorization, rather than all job seekers. It is half the board and your own story, but it is narrower.
2. **Rules over AI.** The verdicts are deterministic and quoted. This trades recall for trust and testability. A reviewer may expect more visible AI.
3. **Tone of the headline.** "Some jobs already said no" is pointed. It must read as on the seeker's side without reading as a dig at portfolio companies.

## Build log, November 12, 2026

FINE_PRINT_HANDOFF.md revises the original brief. Where they differ, the handoff wins.

**Kill criterion: not fired.** Measured numbers are in RESEARCH.md section 8. Eligibility coverage passes the handoff's 25% bar (57.9%, or 30.8% without "must be a student"). Pay recovery is reported on its own (80 of 261 pay-null roles, 30.7%) and does not count toward the bar.

**Changes from the original brief**

- Headline is "See the requirements before you apply", per the handoff. "Some jobs already said no" is dropped.
- The three gate states are replaced by requirement cards. Each card shows what the listing states and its quote. A comparison appears only after the person shares a fact, and reads "Meets this stated requirement", "Conflicts with this stated requirement" or "Needs clarification" with the reason (silence, ambiguous wording, conflicting text, missing profile information).
- Profile questions appear only when the listing asks about that fact. Return to school is asked directly and never inferred from a graduation date.
- Clearance is reported and never judged. U.S. Person lines carry the full definition.
- Full crawl, daily refresh, MCP, share images, `/r/[id]`, `/audit`, `/about` and `/developers` are deferred until the core flow is reviewed.

**Assumptions made in this session**

| # | Assumption | Status |
|---|---|---|
| A1 | Edison is a Canadian citizen without U.S. work authorization | Still unconfirmed. Nothing personal is published. The audit uses a labeled example profile instead. |
| A2 | The API tolerates about 2 requests a second | Wrong. 41 of 509 requests were rate limited (429, retry after 10s). Any crawl must go slower. The live lookup now reports a rate limit plainly and never caches a failure. |
| A8 | The target role is Product Engineer (BUILD_PROMPT) and not prompt engineering (handoff) | Unresolved. No model-assisted extraction was built or compared. Needs Edison. |
| A9 | Fixtures are short verbatim excerpts inside the unit tests, not full descriptions | BUILD_PROMPT asked for full text fixtures. Full text stays in gitignored `data/raw/` so the repo never re-hosts a description. |
| A10 | "Eligibility requirement" means a line stated as required about authorization, citizenship, clearance, sponsorship, enrollment, return to school or graduation window | Degree and years floors are reported under experience and are not counted as eligibility. |
| A11 | Work-authorization comparisons are U.S. only. Roles the board places outside the U.S. get "Needs clarification" | The location check is a keyword list and will miss places. |
| A12 | The hand check was done by Claude | The public evaluation page must say so, or Edison re-checks the 50 roles himself first. |
| A13 | The page says "unofficial" and "not affiliated with a16z speedrun" | Wording for Edison to confirm. |
| A14 | The Join link points to speedrun-talent-network.com/join | Path taken from RESEARCH.md, not re-verified in this session. |
| A15 | Next.js 16 defaults (Cache Components on), Geist fonts, in-memory 5-minute cache per server instance | The live site's visual language was not inspected; design follows the written brief only. |

## Build log, November 12, 2026 (second pass)

Added `/audit` (measured results, review method, known errors, browsable sample), `/about`, `GET /api/v1/audit`, `llms.txt`, PITCH.md and NEXT.md.

| # | Assumption | Status |
|---|---|---|
| A16 | The About page uses only the facts in BUILD_PROMPT (UBC, Economics and Statistics, graduating December 2027, BCI, Photon Collective, Assurefi) | Per the handoff, unconfirmed facts stay out of public copy. The open items show in a "draft notes" box that renders in development only. |
| A17 | About publishes counts for a labeled example profile, not Edison's own | BUILD_PROMPT asked for his real profile. A1 is still unconfirmed, so the example stands in until he says otherwise. |
| A18 | The evaluation page states that an AI assistant did the review | It stays until Edison re-checks the 50 roles himself. |
| A19 | `data/sample-readings.json`, `sample-index.json` and `conflict-calls.json` are committed | They hold findings and quotes of at most 320 characters, never full descriptions. Per-role quotes are a larger share of short listings, so this is worth a second look under A4. |
| A20 | Not deployed | Deployment is public and needs Edison's Vercel account. The "verify from a clean session" step is still owed. |
| A21 | Stealth roles pass through as the API masks them (company "Stealth") | A quote could still name the company if the description does. Not checked across stealth roles; there was one on the board today. |

Still not built from BUILD_PROMPT: full crawl and daily refresh, `first_seen` and `last_seen`, `/r/[id]` with share images, `/developers`, MCP tool, rate limiting on our own endpoints, an end-to-end test, a Lighthouse run, analytics.

## Build log, November 12, 2026 (third pass, Edison's feedback)

**Product shape.** Back to the original pick: you tell it three things (work authorization, graduation date, where you can work), it reads listings for the lines that rule you in or out, and each gate shows clear, blocked or doesn't say. This replaces the handoff's "Meets / Conflicts / Needs clarification" cards on the home page. Edison's call.

**Decisions Edison made**

- Listings come live from the speedrun API. The browser calls it directly (it is CORS-open), reads 10 roles at a time, one request after another. No crawl and no index. Each visitor uses their own share of the rate limit, and descriptions never pass through a fine_print server.
- "Where you can work" is countries (U.S., Canada, somewhere else) plus whether you can work in person or move.
- Anything hedged or unanswered shows under doesn't say with an "unclear" mark and the quote. Blocked is kept for lines that plainly rule you out.
- About: Assurefi removed; BCI role is product manager focused on AI integrations; no application story; his own work authorization is not mentioned; the example-student count stays; LinkedIn and GitHub links added.
- The "Who checked" line is removed from `/audit` and from `GET /api/v1/audit`. The record of who did the review stays in RESEARCH.md section 8 and in A12 above.

**Assumptions in this pass**

| # | Assumption | Status |
|---|---|---|
| A22 | Experience and degree floors are never called blocked | The three questions do not ask about experience or degree, so those lines show as unclear with the quote. |
| A23 | "Must be a current student (bachelor's or master's)" reads as clear for anyone whose graduation date is ahead | The card adds "check yours is one". Lines that name only master's or Ph.D. programs show as unclear. |
| A24 | "Must return to school" stays unclear | A graduation date cannot show it, and there is no fourth question. |
| A25 | Place is judged from the board's location string, read by a keyword list | Unknown locations ("4 Locations", a building name) are unclear, never blocked. A remote role listed in a country you did not pick is unclear. |
| A26 | Pay shows clear when a figure exists and doesn't say when none does | Pay is never blocked. |
| A27 | GitHub link is github.com/huiedison | Built from the handle Edison gave. |

## Build log, November 12, 2026 (fourth pass: resume upload and ranked matches)

Edison expanded the scope: resume upload and personalized, explainable ranking are now in. This reverses "no resume upload" and "no fit score" in PRD.md and BUILD_PROMPT.md, and both files now say so. README.md documents the flow, the rubric, privacy and limits.

**Decisions**

| # | Decision | Why |
|---|---|---|
| D1 | No model. Resume reading and matching are rules, run in the browser | No model key was configured, so a model path could not be tested. Rules keep every explanation quotable and let the privacy promise stay literal: the resume never leaves the device. Cost: a small hand-written vocabulary, so recall is limited. |
| D2 | pdf.js and mammoth, loaded only on upload | Both run in the browser, so nothing depends on the hosting runtime. |
| D3 | Limits: 5 MB, 10 pages, at least 200 readable characters, text cut at 60,000 | A text resume is far smaller. A PDF under 200 characters is treated as scanned. |
| D4 | One profile type (`src/lib/profile.ts`) with adapters | `Answers` in gates.ts is gone. `toCompareProfile` feeds compare.ts. `fine_print.answers.v2` is validated and migrated: its four answers carry over, every new field starts unknown. |
| D5 | Enrollment, return to school, degree and years are asked directly | `toProfile` used to infer enrollment from the graduation month. It no longer does. The resume offers "use this" suggestions for degree and years, and nothing is applied until the person taps it. |
| D6 | Five gate states: clear, blocked, unclear, stated, doesn't say | "Clear" now needs a confirmed fact that meets the line. Preferred and informational lines are "stated" (they used to fall through to "clear"). Experience and degree floors are compared with confirmed years and degree. |
| D7 | Session memory by default; saving is opt-in | Earlier versions saved answers automatically. People who had v2 answers keep them saved; everyone else starts unsaved. The saved profile includes short resume quotes, and the checkbox says so. |
| D8 | Retrieval: one search per title and function, pool capped at 60, 15 analyzed per batch, 2 requests at a time | The board rate limits near 2 requests a second. Must-haves become API filters where the API has one. |
| D9 | Rubric out of 16, shown as a label; eligibility kept apart | See README. Past job titles are not scored, so a career change is not penalized. |
| D10 | Home is the resume flow; the paste-a-link and browse view moved to `/browse` | The resume flow is the main path. `/audit` sample links now open in `/browse`. |
| D11 | The headline changed to "find the roles worth your application" | The old one described the listing checker, which is now the second path. Edison should confirm. |
| D12 | End-to-end test uses playwright-core with installed Chrome and a mocked speedrun API | No browser download, and the run is repeatable. Live listings were checked separately by hand. |

**Known gaps**

- The rubric has not been checked against human judgments of fit. Label thresholds are a first guess.
- Loose vocabulary words can pair a resume line with a listing line that is only loosely related.
- Degree level is not part of the score.
- No OCR, no two-column PDF handling, English only.
- Not deployed; the PDF worker is untested on Vercel.

## Hosting, November 13, 2026

fine_print is hosted on Vercel. The repo now says so: `vercel.json` (Next.js, `npm install`, `npm run build`) and a Hosting section in README.md with a deploy button and the preview and production rules. No environment variables are needed.

- This supersedes A20 ("Not deployed"), except that the live URL is not recorded here. Add it to README.md once Vercel assigns one.
- A6 (Vercel with no database) still holds. No scheduled refresh exists, so no GitHub Action is needed.
- Still owed: confirm PDF upload and live roles on the deployed site, and replace `[LINK]` in PITCH.md.

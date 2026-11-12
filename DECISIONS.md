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

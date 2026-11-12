# RESEARCH.md

Researched November 11, 2026, in a chat session (web search and page fetch only). Every claim is tagged **[fact]** (observed or sourced today), **[inference]** (my reading of facts) or **[opinion]**. Section 7 lists what I could not verify, so the build agent checks it first.

## 1. Probe of the live speedrun API

Source: `GET /api/v1`, `/api/v1/openapi.json` (v1.4.0), `/api/v1/jobs` (unfiltered, page 0), `/api/v1/stats/hiring`, and four public job pages. All fetched Nov 11, 2026.

### What the board labels, and what it does not

| Measure (default portfolio scope) | Count | Share of 23,008 |
|---|---|---|
| Open roles | 23,008 | 100% |
| Structured pay band present (`compAvailable`) | 4,604 | 20.0% |
| Published in last 30 days | 8,006 | 34.8% |
| Published more than 30 days ago | 15,002 | 65.2% |
| Level: intern | 7,955 | 34.6% |
| Level: new_grad | 1,420 | 6.2% |
| Level: junior | 1,665 | 7.2% |
| Early career total (intern + new_grad + junior) | 11,040 | 48.0% |
| No level label (`lvlUnspecified`) | 1,483 | 6.4% |
| No experience label (`yoeUnspecified`) | 4,977 | 21.6% |
| Workplace labeled (remote 2,078, onsite 4,477, hybrid 1,652) | 8,207 | 35.7% |
| No workplace label | 14,801 | 64.3% |
| ATS employment type present | 15,380 | 66.8% |
| Defense and space industry | 3,462 | 15.0% |
| Seed to Series B companies | 3,067 | 13.3% |
| Tier: a16z / wider market / speedrun | 11,861 / 10,939 / 208 | 51.6% / 47.5% / 0.9% |
| Toronto metro | 219 | 1.0% |
| Stealth roles | 1 | 0.0% |

All rows **[fact]**. Other facts worth knowing:

- **[fact]** The classifier finds 7,387 internships; the source ATS field marks only 1,632. The ATS field undercounts internships about 4.5x.
- **[fact]** `/stats/hiring` reported 18,276 live roles, 3,550 with pay, and a split of 10,394 / 7,729 / 153, while `/jobs` reported 23,008, 4,604 and 11,861 / 10,939 / 208 minutes apart. **[inference]** The stats endpoint is cached or computed on a different schedule. Worth a polite note to the team, not a headline.
- **[fact]** `published_at` arrives in three timestamp styles on page 0 (`+00:00`, `Z`, `-05:00`). Parse defensively.
- **[fact]** `page` is capped at 200 with 50 per page, so one query returns at most 10,050 rows. A full crawl must partition by a facet (level or function).
- **[fact]** There is no posting history, no work authorization label, no school or graduation label, and no field for terms like trial periods.
- **[fact]** `jobs/{id}` returns `description_text` (capped at 15,000 characters) and a `labels` object; closed roles return `status: closed` with a null description.
- **[fact]** The same Junior Research Scientist role appears twice (San Francisco and New York). Near-duplicates by location exist.

### Four listings, read end to end

| Role | What the API fields say | What the listing text says |
|---|---|---|
| Junior Research Scientist, EliseAI | seniority `junior`, pay null | Requires a Ph.D. States a $150,000 to $230,000 range in prose. Two-month trial before full-time. In office 4 to 5 days a week. |
| Electrical Sustainment Engineer, Anduril | pay null, workplace null, employment null | States a US salary range of $114,000 to $152,000. Asks for 3+ years. Must be eligible for a U.S. Secret clearance. |
| 2027 Optical Payload Engineer Intern, Anduril | (API pay fields not observed; the site's role panel shows no pay row) | Must be pursuing a bachelor's or master's. Must return to school after the internship. "Must be a U.S. Person". 12 weeks in person, summer 2027. Hourly range $40 to $55. |
| Senior Backend and Cloud Infrastructure Engineer, Sekai (speedrun SR003) | workplace `OnSite`, San Francisco, pay null | Says the company is remote-first across all positions. 5+ years. No pay number, no authorization statement. |

All cells **[fact]**.

**[inference]** Three patterns follow:

1. **Pay is posted more often than the pay field says.** Two of three roles I could confirm as pay-null had a band in the description. The Anduril wording matches Greenhouse's pay transparency block, which the Job Board API only returns when called with `pay_transparency=true`. With roughly 1,300 Costa Mesa roles on the board, one employer alone could move the 20% figure. n is 3, so this is a lead, not a rate.
2. **Hard gates sit in the requirements list, unlabeled.** Citizenship or U.S. person status, clearance, enrollment, returning to school, term dates, degree floors. None is filterable. 15% of the board is defense and space, where these gates are routine.
3. **Labels and text can disagree.** A "junior" role that needs a Ph.D. An "OnSite" role at a remote-first company.

## 2. Job seeker pain, last 12 months

**New grads and interns**
- **[fact]** NY Fed: recent graduate unemployment was about 5.7% in Q1 2026 and 5.6% in Q2; Q3 came in at 5.2% with 42.5% underemployed. https://www.newyorkfed.org/research/college-labor-market ; https://www.fingerlakes1.com/2026/11/10/college-graduate-unemployment-eases-but-many-still-work-in-jobs-that-dont-require-degrees/
- **[fact]** Handshake: 109 applications per internship posting in 2025, nearly double the prior year; 273 in tech, 192 in finance (CNN, Apr 6, 2026). https://krdo.com/news/2026/04/06/the-job-market-is-so-tough-young-people-are-struggling-just-to-land-internships/
- **[fact]** Cengage survey: 77% of recent grads say employers demand too much experience for entry-level roles; 75% say too few jobs are truly entry-level (CNBC via Black Enterprise, Oct 2, 2026). https://www.blackenterprise.com/grads-struggle-employers-raise-the-bar-entry-level-jobs/
- **[fact]** WSJ: students send hundreds of applications, and employers say generic ones backfire. https://www.tovima.com/wsj/companies-predict-2026-will-be-the-worst-college-grad-job-market-in-five-years/amp/

**Everyone: silence**
- **[fact]** Criteria Corp 2026: 53% of job seekers were ghosted in the past year, up from 48% and 38% (via Fortune, Mar 2026). https://www.pin.com/blog/candidate-ghosting/
- **[fact]** Resume Genius 2026 (n=1,000): 55% name being ghosted after applying as their top frustration. https://resumegenius.com/blog/job-hunting/job-seeker-insights-report-2026
- **[fact]** Greenhouse: 81% never heard back at least once in the past year (Fast Company). https://fastcompany.com/91629911/at-this-point-80-of-jobseekers-apply-and-hear-nothing
- **[fact]** ResumeBuilder, Aug 27, 2026 (n=1,011): 86% have met a listing they suspected was a ghost job. The survey measures suspicion, not employer intent. https://www.resumebuilder.com/ghost-jobs/ ; https://www.consumeraffairs.com/news/ghost-jobs-leave-applicants-questioning-which-employers-are-actually-hiring-110226.html

**International candidates**
- **[fact]** Handshake via CNBC (May 24, 2026): full-time postings that mention sponsorship fell from 10.9% in 2023 to 2.6% in 2026. That is the share that says so explicitly; most postings say nothing. https://www.f1jobs.io/resources/blog/percentage-jobs-offer-visa-sponsorship-2026
- **[fact]** The $100,000 H-1B fee (Sept 19, 2025) was vacated in June 2026, a stay was denied July 24, 2026, and DHS proposed a $103,265 cap-subject fee on Aug 25, 2026. Rules are unsettled. https://oiss.yale.edu/news/presidential-proclamation-extends-h-1b-100000-fee-policy-fee-remains-blocked-by-court-order
- **[fact]** User voice on Blind: sponsorship is usually stated only inside the description, found after opening the page. https://www.teamblind.com/post/visa-sponsorship-filter-tnxefcob

**Laid-off experienced workers and career switchers**
- **[fact]** The speedrun layoffs tracker counted 800,755+ reported layoffs in 2026 as of Nov 10 (project PDF).
- **[inference]** Their sharpest pains (reposted or stale roles, level mismatch, pay opacity) need history or pay data. I found less new evidence here today than for early career, so treat this segment as secondary.

**[inference] The common thread:** the costly failure is the wasted application. People apply in volume, hear nothing, and cannot tell a role they lost from a role they were never eligible for.

## 3. Founder and recruiter pain

- **[fact]** Robert Half: 67% of HR leaders say AI-generated applications slowed hiring; 84% report heavier workloads. https://www.deel.com/deel-works/ai-resume-crisis
- **[fact]** GoodTime 2026: fraudulent or AI-assisted candidates rank as the top anticipated hiring challenge. https://www.recruitingnewsnetwork.com/posts/fake-candidates-top-2026-hiring-threats-as-99-8-of-recruiters-race-to-adopt-ai
- **[fact]** Checkr 2026 (n=3,000 managers): 40% have interviewed someone later shown to use a fake identity. https://www.pin.com/blog/deepfake-candidate-report/
- **[fact]** Greenhouse 2025: 34% of U.S. recruiters spend up to half their week filtering spam applications. https://runtimewire.com/article/obra-hire-outbound-recruiting-ai-application-flood
- **[inference]** A listing that states its gates plainly (authorization, level, pay, location) is a cheap noise filter for a founder with no recruiting team. Ineligible applicants are noise for both sides.

## 4. Teardown

| Product | What it does | Who pays | Complaint or limit | Gap |
|---|---|---|---|---|
| career-ops | Local, open-source agent on Claude Code. Scores a role A to H, includes a posting legitimacy block, never submits. | Free (your own model costs) | Terminal only; needs setup and a CLI agent | No hosted, zero-setup version; verdicts are model reasoning, not quoted rules |
| Tsenta | Watches 50,000+ career pages, tailors and applies after approval | Seeker, about $19 to $99 a month after 25 free | Adds to the application flood founders complain about | Speeds up applying; does not ask whether you should |
| Jack and Jill | Voice agent per side; agents make the intro | Employer, about 10% of salary | Opaque matching; a March 2026 security incident was reported | Lives outside public listings |
| Juicebox | Natural-language sourcing over 800M profiles, plus agents | Employer, $139 per seat plus agents | Two price rises in 2026; idle agents still bill | Sourcing only |
| Paraform | Marketplace of vetted recruiters with AI tooling | Employer, about 20 to 25% per hire | Costly for small teams | Human-heavy |
| gstack | Named by the team as a model of usefulness to builders | n/a | Not researched today | Lesson only: usefulness earns the brand |
| SimplifyJobs internship lists | Community lists with flags for no sponsorship and citizenship | Free (funnels to Simplify) | Flags are sparse: one study found about 1.9% of roles flagged; no flag means "may sponsor or has not said" | Unknown reads as fine; no graduation or enrollment gates |
| Jobright | AI matching with an H-1B filter built on employer filing history | Seeker, about $39.99 a month | Billing complaints; history is not the same as this role | Company-level guess, not what the listing says |
| FrogHire | Sponsorship context while browsing job boards | Seeker | Says itself that postings often stay silent | H-1B focus; not interns, TN or clearance |
| Auto-apply class (LazyApply, JobCopilot, Sorce) | Mass submission | Seeker | Generic applications; no sponsor filter found on LazyApply | Makes the wasted-application problem worse |
| Handshake | Campus jobs with school-side eligibility | Schools and employers | Walled by school | No startup board coverage |
| layoffs.fyi and Levels.fyi | Layoff log; pay data | Free and paid tiers | Not re-verified today | Already covered by speedrun's own tracker and salary tool |

Sources: https://github.com/santifer/career-ops ; https://scoutify.com/blog/tsenta-review/ ; https://siliconangle.com/2025/10/16/jack-jill-raises-20m-fix-job-hunting-conversational-ai/ ; https://www.pin.com/blog/juicebox-pricing/ ; https://www.herohunt.ai/blog/paraform-pricing-alternatives-2026/ ; https://github.com/SimplifyJobs/Summer2026-Internships ; https://azarins1.github.io/InternshipMap ; https://techcrunch.com/2024/06/25/jobright-uses-ai-to-help-foreign-workers-navigate-the-us-job-market ; https://www.froghire.ai/learn/sponsorship/h1b-sponsorship-jobs

**[inference]** Nobody reads the listing itself for hard gates, quotes the line, and counts the roles that stay silent. Existing sponsorship filters guess from employer history or sparse community tags.

## 5. Data sources

| Source | Status | Notes |
|---|---|---|
| speedrun REST API | **[fact]** tested | Keyless, CORS-open, edge cached 1 to 5 minutes. Rate limits not published and not measured. Send `?source=`. |
| speedrun MCP | **[fact]** documented, not called | Ten tools, streamable HTTP, no auth. |
| Greenhouse Job Board API | **[fact]** docs confirm `pay_transparency=true` returns `pay_input_ranges` | https://developers.greenhouse.io/job-board.html . Useful to confirm pay the board missed. |
| Ashby posting API | **[inference]** `includeCompensation=true` per third-party docs | Verify against Ashby's own docs before use. |
| Lever postings API | Not tested | Verify before use. |
| layoffs.fyi | Not tested | speedrun already credits it; link out instead of ingesting. |
| NY Fed college labor market | **[fact]** current through Q3 2026 | Context only. |

## 6. UI patterns to borrow

**[opinion, from prior knowledge, not fetched today]**

1. **Can I Use**: a support matrix with yes, no and unknown as three distinct states. The closest analogue to a gate check.
2. **GOV.UK eligibility checkers**: a few plain questions, then a verdict with the reason.
3. **Have I Been Pwned**: one input, an immediate verdict, evidence listed below.
4. **Google Flights price insights**: plain labels (low, typical, high) with the basis shown.
5. **Wise fee comparison**: the answer first, the breakdown beside it.
6. **Levels.fyi**: distributions that show n.
7. **Linear**: filter chips with live counts, full keyboard control.
8. **Redfin listing facts**: dense facts in scannable rows, each with a source.
9. **speedrun /join**: one question per screen, tap to advance. Reuse this for the three facts.

## 7. Not verified. Check first.

1. Filtered API queries. My fetch tool dropped query strings, so every cross-tab is untested (for example the `yoe` mix within `lvl=new_grad,junior`).
2. The rate at which pay-null roles carry a band in the text. n=3 today.
3. The share of early-career roles with at least one extractable gate. n=4 listings today.
4. API rate limits, and whether a crawl of 11,000 detail calls is welcome.
5. Whether `jobs/{id}.labels.min_experience` already captures degree floors.
6. Ashby and Lever endpoint behavior and terms.
7. The live site's visual language. I read text only, not rendered pages.

## 8. Verified November 12, 2026 (build session)

Everything here was measured on Nov 12, 2026 against API v1.5.0 (the research above saw v1.4.0). Scripts: `scripts/sample.mjs`, `scripts/audit.ts`, `scripts/review.ts`. Full descriptions are cached in `data/raw/` (gitignored) and never committed.

### API behavior

- **[fact]** Filters work: `lvl`, `posted`, `sort=new`, `comp` with `comp_any`, `page`. Facet counts respond to the query. `page=200` and beyond return an empty list.
- **[fact]** Early-career frame today: intern 8,257, new_grad 1,420, junior 1,770, total 11,447 of 23,516 open roles (48.7%).
- **[fact]** Structured pay is rare in this frame: 38 of 8,257 intern roles (0.5%) and 221 of 11,447 early-career roles (1.9%) have `compAvailable`.
- **[fact]** `yoe` mix: intern is 6,991 "0", 128 under_1, 86 1_2, 24 3_5, 1,028 unlabeled. Junior is 401 1_2, 328 "0", 166 3_5, 61 under_1, 7 6_9, 1 10_14, 806 unlabeled.
- **[fact]** Detail responses wrap the role in `{ job, source }`. `labels.min_experience` is a band string ("no experience", "3 to 5 yrs"). It does not capture degree floors (answers item 5 in section 7).
- **[fact]** Cache headers: list `s-maxage=60`, detail `s-maxage=300`, both `stale-while-revalidate=600`.
- **[fact]** Rate limit: Cloudflare answers 429 (error 1015, `retry-after: 10`). At about 2 requests a second the sampler made 509 requests and got 41 429s and 4 500s. Assumption A2 is wrong as written: a crawl needs to run slower than 2 requests a second.
- **[fact]** Description text keeps some HTML entities (`&mdash;`, `&#xa;`). Quotes stay verbatim; the UI decodes them for display only.

### Sample

- Frame: all roles labeled intern, new_grad or junior. Seeded draw (seed 20261112), proportional by level: 216 intern, 37 new_grad, 47 junior. 300 drawn, 300 fetched, 0 closed, 0 duplicate ids.
- **27 of 300 (9.0%) had no description text.** Roles read: 273 (202 intern, 34 new_grad, 37 junior).
- 115 employers. Concentration: TikTok 48 of 273 (17.6%), top five employers 90 of 273 (33.0%). 8 roles share a company and title with another sampled role (location variants).
- The frame is global. Many sampled roles are outside the U.S. (Singapore, London, Manila, Dubai and others), and most top employers are wider-market companies, not portfolio startups.

### Measures (n = 273 roles read, extractor v0.2.0)

| Measure | Count | Share |
|---|---|---|
| Explicit eligibility requirement (authorization or school status, stated as required) | 158 / 273 | 57.9% |
| Same, missing from structured fields (the board has no authorization or school fields, so all of them) | 158 / 273 | 57.9% |
| Same, not counting "must be a current student" | 84 / 273 | 30.8% |
| Work authorization requirement | 65 / 273 | 23.8% |
| U.S. Person, citizenship or clearance line | 23 / 273 | 8.4% |
| Mentions sponsorship either way | 36 / 273 | 13.2% |
| Silent on work authorization | 205 / 273 | 75.1% |
| Pay-null roles with a pay figure in the text | 80 / 261 | 30.7% |
| Ambiguous or contradictory requirements | 13 / 273 | 4.8% |
| Board label contradicted by the text | 2 / 273 | 0.7% |
| At least one quoted statement | 223 / 273 | 81.7% |

By level, explicit eligibility: intern 140 / 202 (69.3%), new_grad 10 / 34 (29.4%), junior 8 / 37 (21.6%).

**Threshold.** The handoff's provisional bar is 25% of sampled early-career roles with an explicit eligibility requirement missing from structured fields. Measured 57.9%, or 30.8% under the stricter reading that leaves out "must be a student" on a role already labeled an internship. It passes on both, driven by internships. New-grad and junior roles alone sit near the bar.

### Extraction check

Reviewed by Claude in the build session, not yet by Edison. Treat these as a first pass.

- **Random subset, 50 roles** (seeded shuffle of the 254 roles fetched first; 216 intern, 37 new_grad, 1 junior). 100 quoted statements, 97 correct, 3 wrong. One of two label-conflict flags was wrong. 3 misses noticed. 44 of 50 roles had at least one statement.
- **Held-out set, 36 roles with text** (46 roles never inspected while writing rules). 44 statements, 39 correct, 5 wrong (88.6%). 2 of 4 label-conflict flags wrong. 3 misses noticed. Caveat: because details were fetched in level order, the held-out set is all junior-labeled roles, so it is a harder, different slice and not a random hold-out.
- Errors found were fixed afterwards (v0.2.0). **The fixes have not been re-checked on unseen roles.**
- **Hard cases** (negation, preferred, alternative, boilerplate, conflicting text, missing profile facts) are reported separately as unit tests: 22 of 22 pass (`npm test`).

### Personal conflict calls

Example profile (an example, not a real person): would need sponsorship, enrolled in a bachelor's, graduating December 2027, returning to school, 0 years of experience.

- 94 conflict calls reviewed across the 273 roles: 90 correct, 4 wrong (95.7%). Target 95%, floor 90%.
- The 4 wrong calls: one India-based role read as a U.S. sponsorship line, one "no new H-1B" line read as no sponsorship at all, two "years or equivalent" lines read as hard floors. All four patterns are fixed in v0.2.0; after the fixes the same profile gets 90 conflict calls, 116 meets, 33 needs clarification, with a conflict on 84 of 273 roles (30.8%).
- Same caveat: reviewed by Claude, on the same sample the rules were tuned on.

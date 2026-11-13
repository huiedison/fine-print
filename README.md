# fine_print

Upload your resume, say what you want, and get live roles from the a16z speedrun talent network ranked against your experience. Every match shows the lines from your resume and from the listing behind it, and the listing's own requirements (work authorization, school, experience, place, pay) stay visible beside the ranking. Unofficial, built as a job application.

## Run it

```
npm install
npm run dev        # http://localhost:3000
```

Checks:

```
npm run typecheck
npm run lint
npm test           # unit tests
npm run build
npm run e2e        # needs the app running and Google Chrome installed
```

No environment variables are needed. See `.env.example`.

## Hosting

fine_print is hosted on [Vercel](https://vercel.com). The config lives in [`vercel.json`](vercel.json) (Next.js, `npm install`, `npm run build`).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhuiedison%2Ffine-print)

- **Deploys:** pushing to `main` deploys to production. Pushing any other branch or opening a pull request makes a preview deployment with its own URL.
- **Settings:** import the GitHub repo at [vercel.com/new](https://vercel.com/new) and keep the defaults. Add no environment variables. Node 20 or later.
- **Nothing runs on a server for the resume.** The resume is read in the visitor's browser, and job data is fetched from the public speedrun API by the browser. The only server code is `GET /api/v1/gates/{jobId}` and `GET /api/v1/audit`, which run as Vercel functions.
- **From the command line:** `npm i -g vercel`, `vercel login`, then `vercel` for a preview or `vercel --prod` for production. `.vercel/` is gitignored.
- **After each deploy,** upload a PDF resume on the live site to confirm the PDF reader loads. That is the one piece only tested locally.

## Pages

- `/` the three-step flow: upload your resume, review your profile and say what you want, explore your matches.
- `/browse` paste one speedrun job link, or browse live early-career roles, and see the lines that rule you in or out.
- `/audit` measured results from a 300-role sample, how they were checked, and known errors.
- `/about` a short note from Edison.
- `GET /api/v1/gates/{jobId}`, `GET /api/v1/audit`, `/llms.txt` for agents.

## The flow

1. **Upload.** PDF or .docx, up to 5 MB and 10 pages, or pasted text. Scanned PDFs (no text layer) are rejected with a message saying what to do.
2. **Review.** The page shows what it read: skills, roles, projects and education, each with the resume line it came from. Skills named in a skills section are kept apart from skills read out of described work, and you can remove or add any of them. Then you answer the things a resume cannot establish (work authorization, enrollment, return to school, graduation date, degree, years of full-time work, where you can work) and say what you want (titles, functions, level, internship or full-time, remote or on-site, cities, pay). Each preference is a nice-to-have unless you mark it a must-have.
3. **Matches.** fine_print runs one search per wanted title and function, merges the results, analyzes 15 roles at a time and ranks them. The page says how many roles were retrieved and how many were analyzed, and calls the list "the best matches among those analyzed". You can analyze more or broaden the search.

## Privacy

- The resume is read in your browser with pdf.js and mammoth. The file and its text are never uploaded to fine_print and never sent to a model provider. No model is used anywhere.
- Job listings are fetched by your browser straight from the public speedrun API. The only requests the page makes are GETs for job data, and none carries resume content. The end-to-end test asserts this.
- The resume text and profile live in the tab's memory and are gone on reload. "Remember this profile on this device" is off by default. Turning it on saves the reviewed profile, answers and preferences to `localStorage`, including the short resume quotes used as evidence. The file and full text are never saved.
- "Clear" removes the resume, the profile and the matches, and cancels any requests in flight so old results cannot come back.
- Nothing about the resume is logged, put in a URL, or sent to analytics. There are no analytics.

## How matching works

Rules only. A hand-written vocabulary (`src/lib/match/taxonomy.ts`) of about 50 tools and 22 kinds of work is matched against both the resume and each listing.

**Retrieval.** `buildQueries` makes one board search per wanted title (`q=`) and per function (`fn=`). Level always filters. Workplace, internship or full-time, and city filter only when marked must-have. Results are interleaved, de-duplicated by job id and capped at 60. "Broaden" drops every filter except the title or function.

**Score.** A rubric total out of 16 (`src/lib/match/rank.ts`):

| Part | Points | What it measures |
|---|---|---|
| Role you asked for | 0 to 4 | The listing's title or function against the titles you want. Your past titles are not used, so a career change is not penalized. |
| Required skills | 0 to 4 | Share of the listing's required items your resume backs |
| Demonstrated work | 0 to 4 | Share of the kinds of work the listing describes that your experience or projects show |
| Level | 0 to 2 | Stated years against your confirmed years, and your level preference |
| Preferences | 0 to 2 | Share of your nice-to-have preferences the role meets |

Labels: strong 13 to 16, good 10 to 12, possible 7 to 9, weak 0 to 6. The page shows the label. The number appears only inside "How this was scored", with a note that it is not a chance of an interview or an offer.

**Eligibility is separate.** Work authorization, school status and place are checked against your direct answers and never change the score. Each match shows "No stated eligibility conflict", "Eligibility not confirmed" or "Stated eligibility conflict".

**Order.** Label, then matches without a conflict or a missed must-have ahead of those with one, then score, then newest, then job id. Conflicts stay available under their own filter.

**Words used.** A required skill the resume does not show is "not evidenced in your resume", never "missing". A requirement is "clear" only when a fact you confirmed meets it. Preferred and informational lines are "stated". Anything hedged or unanswered is "unclear".

## Limits

- The vocabulary is small and pattern-based. It misses skills it does not know, and a loose word can pair the wrong resume line with a listing line. Read the quotes.
- Resume parsing expects headed sections (Experience, Education, Projects, Skills) and dated roles. Two-column and heavily designed PDFs can come out in the wrong order. The review step is there to fix that.
- Degree level is not scored. An MBA internship can rank well for an undergraduate; the school line shows as unclear or blocked beside it.
- Scanned resumes are not read (no OCR). English only. Work authorization is about the U.S.
- Only a slice of the board is analyzed. The speedrun API rate limits at about two requests a second, so matches arrive 15 at a time.
- Country is guessed from the board's location text and is sometimes unknown.
- The extraction rules behind the requirement cards have measured errors. See `/audit` and RESEARCH.md section 8. The matching rubric has not been evaluated against human judgments.
- The production build passes and the PDF reader works in a local production build. It has not been verified on a live Vercel deployment yet.

## Audit scripts

```
node scripts/sample.mjs              # seeded 300-role sample into data/raw (gitignored)
npx tsx scripts/audit.ts             # measures -> data/*.json
npx tsx scripts/review.ts data/dev-ids.txt 25 7 0   # hand-check sheet
python3 scripts/make-fixtures.py     # rebuilds the synthetic resume fixtures
```

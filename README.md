# fine_print

See the requirements before you apply. Paste a job link from the a16z speedrun talent network and fine_print quotes the lines about work authorization, school status, experience, place and pay. Unofficial, built as a job application.

## Run it

```
npm install
npm run dev        # http://localhost:3000
npm test           # extractor and comparison tests
```

Try `http://localhost:3000/?job=863accfc`.

Other checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## Pages

- `/` paste a speedrun job link and read its requirements.
- `/audit` measured results from the 300-role sample, how they were checked, known errors, and the sample to browse.
- `/about` a short note from Edison.
- `GET /api/v1/gates/{jobId}`, `GET /api/v1/audit`, `/llms.txt` for agents.

## How it works

- `GET /api/v1/gates/{jobId}` makes one call to the speedrun API (`?source=fine-print`), runs deterministic rules over the description, and returns requirements with verbatim quotes and character offsets. No model call.
- Profile answers are optional, compared in the browser, and stored only in `localStorage`.
- Descriptions are read in memory and never stored or re-hosted.

## Audit scripts

```
node scripts/sample.mjs              # seeded 300-role sample into data/raw (gitignored)
npx tsx scripts/audit.ts             # measures -> data/sample-readings.json
npx tsx scripts/review.ts data/dev-ids.txt 25 7 0   # hand-check sheet
```

Measured results and their limits are in RESEARCH.md section 8.

## Known gaps

- Rules miss and misread lines. Held-out statement precision was 39 of 44 before the last round of fixes.
- U.S. work authorization only. English only.
- The speedrun API rate limits; a busy moment shows a "try again" message.
- No full crawl, daily refresh, share pages, MCP tool or end-to-end test yet. Not deployed.
- The review behind `/audit` was done by an AI assistant and not yet repeated by a person.

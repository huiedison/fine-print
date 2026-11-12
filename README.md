# fine_print

See the requirements before you apply. Tell fine_print three things about you (work authorization, graduation date, where you can work). It reads listings on the a16z speedrun talent network for the lines that rule you in or out and quotes them. Each area shows clear, blocked or doesn't say. Unofficial, built as a job application.

## Run it

```
npm install
npm run dev        # http://localhost:3000
npm test           # extractor and comparison tests
```

Try `http://localhost:3000/?job=863accfc`.

Other checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## Pages

- `/` answer three questions, then browse live early-career roles or paste a link. Each role gets a row of clear, blocked or doesn't say.
- `/audit` measured results from the 300-role sample, how they were checked, known errors, and the sample to browse.
- `/about` a short note from Edison.
- `GET /api/v1/gates/{jobId}`, `GET /api/v1/audit`, `/llms.txt` for agents.

## How it works

- The home page calls the speedrun API from the browser (`?source=fine-print`): one list call, then one detail call per role shown, 10 roles at a time. Deterministic rules run over each description in the browser. No model call.
- `GET /api/v1/gates/{jobId}` does the same reading on the server for agents, and returns requirements with verbatim quotes and character offsets.
- Your three answers are optional, compared in the browser, and stored only in `localStorage`.
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
- Experience and degree floors are quoted but never called blocked, because the three questions do not cover them.
- Country is guessed from the board's location text and is sometimes unknown.
- The speedrun API rate limits; a busy moment shows a "try again" message.
- No full crawl, daily refresh, share pages, MCP tool or end-to-end test yet. Not deployed.
- The review behind `/audit` was done by an AI assistant and not yet repeated by a person.

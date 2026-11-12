# PRD.md: fine_print

One page. November 11, 2026.

## User

A student, co-op or new grad applying to startup roles, whose situation is not the default: needs sponsorship or is not a U.S. person, graduates off-cycle, or is outside the U.S. Edison is user zero. Secondary: anyone with a link to a role on the speedrun board.

## Job to be done

"Before I spend 40 minutes on this application, tell me whether the listing already rules me out, and show me the line."

## Core flow (three steps)

1. **Say three things about you.** Work authorization, graduation month (or years of experience), where you can work. One question per screen, tap to advance. Stored in the browser only, and the screen says so. Skippable.
2. **See roles with their gates.** Browse early-career roles from the live board, or paste any speedrun job link. Each role shows five gates. Each gate is clear, blocked or doesn't say, with the listing's sentence quoted.
3. **Apply or skip.** One primary button out to the canonical speedrun job URL. After the first result, one line invites the user to join the network.

Input and result share one screen. No signup wall.

## The gates

| Gate | Reads for | States shown |
|---|---|---|
| Work authorization | U.S. person, citizenship, clearance, "no sponsorship", "we sponsor" | says yes, says no, doesn't say |
| School status | Must be enrolled, must return to school, graduation window, degree level | fits you, rules you out, doesn't say |
| Experience floor | Years required, Ph.D. or other degree floor, compared with the board's level label | matches label, higher than label, doesn't say |
| Place and time | On-site days, location, term and length, relocation; conflicts with the workplace label | stated, conflicts with label, doesn't say |
| Pay | Board's pay band, or a band found in the description | posted, found in the text, not posted |

A sixth, quiet row lists unusual terms when present: trial periods, contract-to-hire, transcripts required.

## Screens

- `/` Answer first: profile chips, paste box, role list with gate rows, live counts on every filter including "doesn't say".
- `/r/[id]` One role, shareable, with an OG image that shows its gates.
- `/audit` The state of the fine print: for each gate, how many roles say yes, say no, stay silent, or are not yet read. Every number has its denominator and date.
- `/about` A short note from Edison, with a link to the talent network.
- `/developers` The JSON endpoint, MCP tool and `llms.txt`.

## Agent surface

- `GET /api/v1/gates/{jobId}` returns the gates with status, quote, character offsets and rule id.
- `GET /api/v1/audit` returns the aggregate counts.
- MCP tool `read_fine_print(job)`; stretch: `roles_i_can_apply_to(profile, filters)`.
- `llms.txt` describing both.

## Success metric

- **Product:** share of role views where at least one gate is backed by a quote. Target 60% for early-career roles.
- **Trust:** precision of "blocked" calls in a 50-role hand audit. Target 95%; floor 90%.
- **For speedrun:** join clicks per session that saw a result.
- **For the application:** Edison's own test, published on the About page: of N intern roles, how many said no to him, with the lines.

## MVP scope

Early-career roles (about 11,000) crawled and indexed. Paste-a-link for any role, computed live. Five gates plus terms. Audit page. JSON endpoint and `llms.txt`. First seen and last seen recorded per role, shown as "tracking since <date>".

## Non-goals

No auto-apply. No resume upload or rewriting. No fit score. No "fake job" or ghost-job label. No repost claims. No legal or immigration advice. No sponsorship guesses from company history. No stealth unmasking. No scraping beyond the speedrun API and public ATS endpoints.

## Risks

| Risk | Response |
|---|---|
| A wrong verdict | Quote always shown; "the listing says" wording; precision over recall; report-a-miss link; hand audit published |
| Silence dominates the authorization gate | Count it and show it; other gates carry value |
| API limits | Low-rate crawl with backoff; on-demand fallback; audit states its n |
| Stale index | Daily refresh; each role shows when it was last read |
| Sensitive topic | Neutral copy; no advice; link to the original listing |
| Tone | Warm and on the seeker's side; never mocks a company |

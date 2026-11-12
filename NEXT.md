# NEXT.md

What I would build next with the talent team. Numbers are from the November 12, 2026 sample (RESEARCH.md section 8).

## 1. A listing check for founders

The same reading, pointed the other way. Before a founder posts, show them what a candidate cannot tell from the listing.

- "Your listing does not say whether you sponsor." 205 of 273 sampled roles say nothing about work authorization. A founder with no recruiter gets every applicant who guessed.
- "Your pay is in paragraph nine, and the pay field is empty." 80 of 261 roles with an empty pay field had pay in the text.
- "The board labels this junior, and your text asks for a Ph.D."

With the team's private founder-side data, the check could go further than the public text: compare what a founder told the team they want with what the listing actually says, and flag the gap before it costs them a week of unqualified applications. I have not seen that data, so this is a proposal, not a design.

## 2. Repost and age evidence

fine_print makes no claims about reposts or stale roles today, because there is no history to base them on.

- Start recording `first_seen` and `last_seen` per role now, at a rate the API allows. It rate limits at about 2 requests a second, so a full early-career pass (about 11,400 roles) needs to run slowly or be agreed with the team.
- After a few weeks, show "tracking since" on each role. After a few months, a role that closes and reappears with the same text can be shown as such, with both dates.
- Keep the wording to what was observed. "First seen March 3, seen again May 20" and never "ghost job".

## 3. A pay-recovery patch for the salary tool

Only 221 of 11,447 early-career roles (1.9%) have a structured pay band. The description often has one.

- The rules already separate hourly from annual pay and reject funding and benefit amounts. Each recovered band comes with its quote and character offsets, so it can be reviewed in seconds.
- Feed recovered bands to the salary tool as a separate, labeled source ("from the description") and never merge them silently into the posted-pay numbers.
- One likely cause worth checking with the team: Greenhouse returns pay ranges only when its job board API is called with `pay_transparency=true`. If that is the gap, fixing it at the source beats recovering it from text.

## Before any of this

- Re-check the rules on roles they have never seen. Held-out precision was 39 of 44 before the last round of fixes, and those fixes are not yet re-validated.
- Have a person repeat the 50-role hand check. The first pass was done by an AI assistant.

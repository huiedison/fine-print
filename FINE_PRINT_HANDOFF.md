# fine_print handoff for Claude Code

Read RESEARCH.md, DECISIONS.md, PRD.md, and BUILD_PROMPT.md first. Apply this handoff where it revises the original brief. Keep fine_print as the lead idea and aim for a working public submission within 48 hours. Use “See the requirements before you apply” as the headline.

## Validate the product before expanding it

Verify that the Speedrun API filters work and that the detail endpoint supplies usable descriptions. Aim to sample 300 early-career roles across intern, new-grad, and junior labels. Document the sampling frame, deduplication, employer concentration, and any missing descriptions. Report the number of roles and employers represented.

Report these measures independently, with counts, denominators, and dates.

- Roles with an explicit eligibility requirement.
- Roles with an explicit eligibility requirement missing from structured fields.
- Pay-null roles with a recoverable pay band.
- Roles with ambiguous or contradictory requirements.

Use 25% of sampled early-career roles with an explicit eligibility requirement missing from structured fields as a provisional product threshold. Pay recovery does not count toward it. If eligibility coverage is weak and pay recovery holds up, make recovered pay the lead feature of the entry-level finder. If access limits the sample, show the actual coverage and qualify the decision. The four examples in the original research are leads.

## Audit extraction and personal comparisons

Hand-check a random subset, aiming for 50 roles, and keep a held-out set for the final check. Separately test challenging cases covering negation, preferred qualifications, alternative qualifications, boilerplate, conflicting text, and missing profile facts. Report the challenging cases separately from the random sample.

For personal conflicts, report the number of conflict calls reviewed, how many were correct, and how many were wrong. Use 95% precision as a provisional target and 90% as a floor. If there are too few reviewed conflicts to support the claim, or the verdicts are unreliable, ship source quotes and requirement summaries without personal conflict calls.

## Show what the listing says and what the profile can establish

Extract the explicit requirement and a verbatim quote with enough context to preserve exceptions. Then compare it with facts the user supplied. Use “Meets this stated requirement,” “Conflicts with this stated requirement,” or “Needs clarification.” Explain whether clarification comes from silence, ambiguous wording, conflicting text, or missing profile information. Keep comparisons at the requirement level.

Ask only for profile facts relevant to the listing and keep them in the browser. A graduation date alone cannot establish a return to school after an internship. Ask directly when that requirement appears. Keep work authorization, sponsorship, U.S. Person language, and clearance distinct. Display the employer’s stated requirement when the information needed to compare it is missing.

Show “Ph.D. required” alongside the junior label. If company-wide remote language and a role-specific workplace statement appear to conflict, show both and give the role-specific wording its context. Label recovered pay as coming from the description.

## Ship the core experience

Build a live Speedrun paste-a-link flow, a browsable audited sample with timestamps, requirement cards with source quotes, optional profile comparisons, and an evaluation page with measured results and known errors. Include a short About page and demo. Verify the public URL from a clean session early enough to fix hosting issues. Defer the full crawl, scheduled refreshes, MCP, and custom share images until the core flow works.

Check the actual hiring brief. The original build prompt names Product Engineer, while Edison described the target as prompt engineering. If prompt engineering is central, compare model-assisted extraction with the rules baseline on the same held-out examples. Require structured output and verify that every quote occurs verbatim in the source. Compare extraction errors, latency, and cost before deciding whether to use the model.

Use confirmed facts and a real application experience in Edison’s About page. Keep unconfirmed personal details out of the public copy. Demo three real listings covering a stated requirement the example profile meets, a clear conflict, and a case that needs clarification. Label any example profile as such.

Update the research, decision log, PRD, and build brief as findings come in. The final report should include the public URL, what shipped, measured counts and denominators, and remaining limitations.

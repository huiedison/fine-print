# PITCH.md

Draft for Edison to edit and send. Numbers were measured on November 12, 2026 from a 300-role random sample of early-career roles on the speedrun board (273 had text to read). Details are in RESEARCH.md section 8 and on `/audit`.

## Note to the talent team (about 120 words)

Hi speedrun talent team,

I'm Edison, a fourth-year Economics and Statistics student at UBC. I built fine_print on your public API: paste a job link and it quotes the lines that decide whether you can apply.

I read 273 early-career roles from your board. 205 say nothing about work authorization. 84 state an eligibility rule that no filter carries, even after leaving out "must be a student". And 80 of the 261 roles with an empty pay field have pay written in the description.

It uses plain rules, quotes every line word for word, and says "doesn't say" when a listing is silent. The results page shows where it gets things wrong.

[LINK]

I'd love to build this kind of thing with you.

Edison

## 60-second demo script

**0:00** "I tell it three things. Say I'm a student who would need sponsorship, graduates in December 2027, and can work in the U.S. or Canada." Tap the three answers.

**0:10** Scroll to the list. "These are live roles from the speedrun board. It reads each one and marks five areas: clear, blocked, or doesn't say."

**0:20** Point at a blocked card. "This internship is blocked on work authorization. Tap 'Show the lines' and there is the sentence: must be a U.S. Person. The card explains that term covers green card holders too."

**0:32** Same card, Pay. "The board's pay field is empty. The description says 40 to 55 dollars an hour, so it shows that and says where it came from."

**0:40** Point at a card with dashed marks. "This one says nothing about sponsorship. So it says 'doesn't say'. That is not a yes."

**0:47** Tap "Not blocked". "Now I only see the ones worth my time."

**0:52** Paste a link. "Any role on the board works." Open `/audit`. "And every number has what it is out of, the date, and the mistakes the tool made."

## Before sending

- Replace [LINK] with the deployed URL.
- The role title is unresolved (Product Engineer in the build brief, prompt engineering in the handoff). Adjust the last line to match.
- The sample is global and led by large employers (TikTok is 48 of 273). Say "your board", not "your startups".

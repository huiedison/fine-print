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

**0:00** "This is an internship on the speedrun board. The filters say intern, on site, no pay listed."

**0:08** Paste the link. "fine_print reads the listing and pulls out the lines that matter."

**0:15** Scroll to Work authorization. "Must be a U.S. Person. That is an export-control term, and it covers permanent residents too, so it does not mean citizens only. The card says so."

**0:25** Open "Compare with your situation" and tap "Would need sponsorship". "Now it tells me this conflicts with a stated requirement, and shows me the sentence. It never says I can't apply. It says what the listing says."

**0:35** Scroll to Pay. "The pay field is empty, but the description says 40 to 55 dollars an hour. Found in the text, labeled that way."

**0:42** Open the second example. "This one is labeled junior. The text asks for a Ph.D. Both are shown."

**0:48** Open the third. "This one says nothing about sponsorship. So the answer is: doesn't say. That is not a yes."

**0:54** Open `/audit`. "Every number has what it is out of and the date. Including the ones where the tool was wrong."

## Before sending

- Replace [LINK] with the deployed URL.
- The role title is unresolved (Product Engineer in the build brief, prompt engineering in the handoff). Adjust the last line to match.
- The sample is global and led by large employers (TikTok is 48 of 273). Say "your board", not "your startups".

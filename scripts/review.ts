// Prints a review sheet for hand-checking: every finding, plus keyword lines the
// extractor did not quote (possible misses). Reads data/raw (local only).
// Usage: npx tsx scripts/review.ts <ids-file> <n> <seed> [offset]
import { readFileSync, existsSync } from "node:fs";
import { readListing } from "../src/lib/extract/read";
import { segment } from "../src/lib/extract/segment";

const [idsFile, nArg, seedArg, offArg] = process.argv.slice(2);
let a = Number(seedArg ?? 1) >>> 0;
const rand = () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ids = readFileSync(idsFile, "utf8").split("\n").filter(Boolean).sort();
for (let i = ids.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [ids[i], ids[j]] = [ids[j], ids[i]];
}
const KEY = /citizen|u\.?s\.? person|clearance|sponsor|\bvisa|authoriz|ITAR|export control|return(ing)? to (school|univ)|graduat(ing|ion|e (in|by))|enrolled|pursuing|ph\.?d|\d\+? ?years|\$\s?\d/i;
const off = Number(offArg ?? 0);
let shown = 0;
for (const id of ids) {
  if (!existsSync(`data/raw/${id}.json`)) continue;
  const raw = JSON.parse(readFileSync(`data/raw/${id}.json`, "utf8"));
  if (!raw.job.description_text) continue;
  shown++;
  if (shown <= off) continue;
  if (shown > off + Number(nArg)) break;
  const r = readListing(raw.job);
  const b = r.board;
  console.log(`\n#${shown} ${id.slice(0, 8)} | ${b.title.slice(0, 60)} | ${b.company} | ${b.location} | lvl=${b.label_seniority} pay=${b.comp_min ?? "-"} len=${r.text.length}`);
  for (const q of r.requirements) console.log(`  + [${q.kind}/${q.strength}] ${q.summary} :: ${JSON.stringify(q.quote.slice(0, 170))}`);
  for (const c of r.label_conflicts) console.log(`  ! conflict ${c.field}: ${c.board_label} vs ${c.text_says}`);
  const covered = r.requirements.map((q) => [q.start, q.end]);
  for (const s of segment(raw.job.description_text)) {
    if (!KEY.test(s.text)) continue;
    if (covered.some(([x, y]) => s.start < y && s.end > x)) continue;
    console.log(`  ? ${s.boilerplate ? "(boilerplate) " : ""}${JSON.stringify(s.text.slice(0, 170))}`);
  }
}

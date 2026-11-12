// Usage: npx tsx scripts/read-one.ts <path-to-detail.json>...
import { readFileSync } from "node:fs";
import { readListing } from "../src/lib/extract/read";
for (const f of process.argv.slice(2)) {
  const raw = JSON.parse(readFileSync(f, "utf8"));
  const r = readListing(raw.job);
  console.log(`\n=== ${r.board.title} | ${r.board.company} | level=${r.board.label_seniority} wp=${r.board.workplace_type ?? r.board.label_workplace} pay=${r.board.comp_min}`);
  for (const q of r.requirements) console.log(`  [${q.gate}/${q.kind}/${q.strength}] ${q.summary}\n      "${q.quote.replace(/\n/g, "\\n")}"`);
  for (const c of r.label_conflicts) console.log(`  !! label ${c.field}=${c.board_label} vs text: ${c.text_says}`);
  console.log(`  silent: ${r.silent_gates.join(", ")}`);
}

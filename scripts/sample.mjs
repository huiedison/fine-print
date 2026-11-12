#!/usr/bin/env node
// Draws a seeded random sample of early-career roles from the speedrun API
// and caches their detail responses locally (data/raw is gitignored: full
// descriptions are never committed or re-hosted).
//
// Usage: node scripts/sample.mjs [--n 300] [--seed 20261112]
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE = "https://speedrun-talent-network.com/api/v1";
const SOURCE = "fine-print";
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const N = Number(args.n ?? 300);
const SEED = Number(args.seed ?? 20261112);
const LEVELS = ["intern", "new_grad", "junior"];
const PAGE_SIZE = 50;
const DELAY_MS = 500; // about 2 requests a second

// mulberry32: small seeded PRNG so the sample is reproducible
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stats = { requests: 0, retries: 0, status: {}, ms: [] };
async function get(path) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}source=${SOURCE}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const t0 = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { accept: "application/json" } });
    } catch (e) {
      stats.retries++;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    stats.requests++;
    stats.ms.push(Date.now() - t0);
    stats.status[res.status] = (stats.status[res.status] ?? 0) + 1;
    if (res.status === 429 || res.status >= 500) {
      stats.retries++;
      const ra = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await sleep(ra * 1000);
      continue;
    }
    const body = res.status === 404 ? null : await res.json();
    await sleep(DELAY_MS);
    return { status: res.status, body };
  }
  return { status: 0, body: null };
}

function pickIndices(total, k) {
  const set = new Set();
  const cap = Math.min(total, 201 * PAGE_SIZE); // page is capped at 200
  while (set.size < Math.min(k, cap)) set.add(Math.floor(rand() * cap));
  return [...set].sort((a, b) => a - b);
}

await mkdir("data/raw", { recursive: true });
const startedAt = new Date().toISOString();

// 1. Frame: size of each level stratum right now
const frame = {};
for (const lvl of LEVELS) {
  const { body } = await get(`/jobs?lvl=${lvl}&sort=new`);
  frame[lvl] = body.total;
}
const frameTotal = Object.values(frame).reduce((a, b) => a + b, 0);

// 2. Proportional allocation, then random positions inside each stratum
const alloc = {};
let left = N;
LEVELS.forEach((lvl, i) => {
  alloc[lvl] = i === LEVELS.length - 1 ? left : Math.round((N * frame[lvl]) / frameTotal);
  left -= alloc[lvl];
});

const picked = []; // {id, lvl, index}
const seen = new Set();
let listDuplicates = 0;
for (const lvl of LEVELS) {
  const idxs = pickIndices(frame[lvl], alloc[lvl]);
  const byPage = new Map();
  for (const i of idxs) {
    const p = Math.floor(i / PAGE_SIZE);
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(i % PAGE_SIZE);
  }
  for (const [page, offsets] of byPage) {
    const { body } = await get(`/jobs?lvl=${lvl}&sort=new&page=${page}`);
    for (const off of offsets) {
      const job = body?.jobs?.[off];
      if (!job) continue; // list shifted under us; counted as a shortfall
      if (seen.has(job.id)) {
        listDuplicates++;
        continue;
      }
      seen.add(job.id);
      picked.push({ id: job.id, lvl, index: page * PAGE_SIZE + off, list: job });
    }
    process.stderr.write(`\rlist ${lvl} page ${page}   `);
  }
}

// 3. Details
let closed = 0,
  missing = 0,
  noText = 0;
for (const [i, p] of picked.entries()) {
  const file = `data/raw/${p.id}.json`;
  let detail;
  if (existsSync(file)) {
    detail = JSON.parse(await readFile(file, "utf8"));
  } else {
    const { status, body } = await get(`/jobs/${p.id}`);
    if (status !== 200 || !body?.job) {
      missing++;
      p.fetch = `http_${status}`;
      continue;
    }
    detail = { fetched_at: new Date().toISOString(), sample_level: p.lvl, job: body.job };
    await writeFile(file, JSON.stringify(detail));
  }
  if (detail.job.status === "closed") closed++;
  else if (!detail.job.description_text) noText++;
  p.fetch = "ok";
  process.stderr.write(`\rdetail ${i + 1}/${picked.length}   `);
}

stats.ms.sort((a, b) => a - b);
const manifest = {
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  seed: SEED,
  requested: N,
  frame,
  frame_total: frameTotal,
  allocation: alloc,
  drawn: picked.length,
  list_duplicates_skipped: listDuplicates,
  detail_missing: missing,
  detail_closed: closed,
  detail_no_description: noText,
  api: {
    requests: stats.requests,
    retries: stats.retries,
    status_counts: stats.status,
    median_ms: stats.ms[Math.floor(stats.ms.length / 2)],
    p95_ms: stats.ms[Math.floor(stats.ms.length * 0.95)],
    delay_ms: DELAY_MS,
  },
  roles: picked.map(({ id, lvl, index, fetch }) => ({ id, lvl, index, fetch })),
};
await writeFile("data/sample-manifest.json", JSON.stringify(manifest, null, 2));
console.error(`\n${JSON.stringify({ ...manifest, roles: undefined }, null, 2)}`);

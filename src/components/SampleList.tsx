"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GATE_LABEL, type Gate } from "@/lib/extract/types";

export interface SampleRow {
  id: string;
  title: string;
  company: string;
  location: string | null;
  level: string;
  read_at: string;
  stated: string[];
  statements: number;
  pay_in_text: boolean;
}

const FILTERS: { key: string; label: string; test: (r: SampleRow) => boolean }[] = [
  { key: "all", label: "All roles", test: () => true },
  ...(["work_auth", "school", "experience", "place_time", "pay"] as Gate[]).map((g) => ({
    key: g,
    label: GATE_LABEL[g],
    test: (r: SampleRow) => r.stated.includes(g),
  })),
  { key: "silent_auth", label: "Silent on work authorization", test: (r) => !r.stated.includes("work_auth") },
  { key: "nothing", label: "Nothing stated", test: (r) => r.statements === 0 },
];

const PAGE = 30;

export default function SampleList({ rows }: { rows: SampleRow[] }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.title} ${r.company} ${r.location ?? ""}`.toLowerCase().includes(needle));
  }, [rows, q]);
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const list = useMemo(() => searched.filter(active.test), [searched, active]);

  return (
    <div>
      <label className="block text-sm font-semibold">
        Search the sample
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Company, title or place"
          className="mt-2 block min-h-11 w-full rounded-full border border-line bg-card px-4 font-normal placeholder:text-ink-3"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by what the listing states">
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setFilter(f.key);
                setShown(PAGE);
              }}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm ${
                on ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"
              }`}
            >
              {f.label} <span className="font-mono text-xs opacity-80">{searched.filter(f.test).length}</span>
            </button>
          );
        })}
      </div>
      <p className="micro mt-4 text-ink-3" aria-live="polite">
        showing {Math.min(shown, list.length)} of {list.length} · {rows.length} roles read in the sample
      </p>
      {list.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-ink-3 p-4 text-[15px] text-ink-2">
          No sampled role matches that. Clear the search or pick another filter.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.slice(0, shown).map((r) => (
            <li key={r.id}>
              <Link
                href={`/browse?job=${r.id}`}
                className="block rounded-2xl border border-line bg-card p-4 hover:border-ink"
              >
                <span className="micro text-ink-3">
                  {r.company} · {r.location ?? "location not labeled"} · {r.level.replace("_", " ")}
                </span>
                <span className="mt-1 block text-[16px] font-bold leading-snug">{r.title}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {r.statements === 0 ? (
                    <span className="micro rounded-full border border-dashed border-ink-3 px-2 py-1 text-ink-2">
                      ○ nothing stated
                    </span>
                  ) : (
                    r.stated.map((g) => (
                      <span key={g} className="micro rounded-full border border-ink px-2 py-1">
                        ● {GATE_LABEL[g as Gate]}
                        {g === "pay" && r.pay_in_text ? " (in the text)" : ""}
                      </span>
                    ))
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {shown < list.length ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-4 min-h-11 rounded-full border border-ink bg-card px-5 text-sm font-semibold"
        >
          Show {Math.min(PAGE, list.length - shown)} more
        </button>
      ) : null}
    </div>
  );
}

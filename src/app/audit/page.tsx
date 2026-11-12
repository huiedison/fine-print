import type { Metadata } from "next";
import SampleList, { type SampleRow } from "@/components/SampleList";
import { evaluation, MEASURED_ON, MEASURES, parseShare, summary } from "@/lib/audit";
import rows from "../../../data/sample-index.json";

export const metadata: Metadata = {
  title: "How well fine_print reads: measured results",
  description: "Counts, denominators, dates and known errors from a 300-role sample of the speedrun board.",
};

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  const s = parseShare(value);
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <p className="text-[28px] font-black leading-none tracking-[-0.02em]">
        {s.count} <span className="text-[17px] font-semibold text-ink-2">of {s.of}</span>
      </p>
      <p className="micro mt-1 text-ink-3">{s.pct} of roles read</p>
      <p className="mt-2 text-[15px] font-semibold leading-snug">{label}</p>
      {note ? <p className="mt-1 text-sm text-ink-2">{note}</p> : null}
    </li>
  );
}

function Check({ title, correct, total, children }: { title: string; correct: number; total: number; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <h3 className="text-[15px] font-bold">{title}</h3>
      <p className="mt-2 text-[28px] font-black leading-none tracking-[-0.02em]">
        {correct} <span className="text-[17px] font-semibold text-ink-2">of {total} correct</span>
      </p>
      <p className="micro mt-1 text-ink-3">
        {((100 * correct) / total).toFixed(1)}% · {total - correct} wrong
      </p>
      <div className="mt-2 text-sm text-ink-2">{children}</div>
    </li>
  );
}

export default function AuditPage() {
  const e = evaluation;
  const top = summary.top_employers as [string, number][];
  return (
    <div>
      <section className="rounded-[28px] border border-line bg-card p-6 sm:p-9">
        <p className="micro text-ink-3">measured {MEASURED_ON} · speedrun talent network API</p>
        <h1 className="mt-3 text-[36px] font-black lowercase leading-[0.95] tracking-[-0.035em] sm:text-[56px]">
          what the listings say, counted_
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
          I pulled {summary.drawn} early-career roles at random from the speedrun board and ran fine_print on each
          one. Here is what it found, how it was checked, and what it gets wrong.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="sample-h">
        <h2 id="sample-h" className="text-[22px] font-black tracking-[-0.02em]">
          The sample
        </h2>
        <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
          <li>
            <strong className="text-ink">Where it came from.</strong> Every open role the board labels intern, new grad or
            junior: {summary.frame_total.toLocaleString("en-US")} roles on {MEASURED_ON} (
            {summary.frame.intern.toLocaleString("en-US")} intern, {summary.frame.new_grad.toLocaleString("en-US")} new
            grad, {summary.frame.junior.toLocaleString("en-US")} junior). We drew {summary.drawn} in proportion to those
            sizes. The random seed is fixed, so the same draw can be repeated.
          </li>
          <li>
            <strong className="text-ink">What could be read.</strong> {summary.roles_read} of {summary.drawn}.{" "}
            {summary.no_description} had no description text on the board and {summary.closed} were closed. No role was
            drawn twice. {summary.same_company_and_title_duplicates} share a company and title with another sampled
            role, usually the same job in another city.
          </li>
          <li>
            <strong className="text-ink">Who is in it.</strong> {summary.employers} employers. The largest is{" "}
            {top[0][0]} with {parseShare(summary.top_employer_share).count} of {summary.roles_read} roles (
            {parseShare(summary.top_employer_share).pct}). The top five hold {parseShare(summary.top5_employer_share).count}{" "}
            ({parseShare(summary.top5_employer_share).pct}). Many roles are outside the U.S., and most of the largest
            employers are big companies, not startups.
          </li>
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="measures-h">
        <h2 id="measures-h" className="text-[22px] font-black tracking-[-0.02em]">
          Of {summary.roles_read} roles read, how many…
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {MEASURES.map((m) => (
            <Stat key={m.key} value={summary.measures[m.key]} label={m.label} note={m.note} />
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-2">
          By level, roles that state an eligibility requirement: intern {summary.by_level_eligibility.intern}, new grad{" "}
          {summary.by_level_eligibility.new_grad}, junior {summary.by_level_eligibility.junior}. These counts come from
          the rules themselves, so they inherit the error rates below.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="checks-h">
        <h2 id="checks-h" className="text-[22px] font-black tracking-[-0.02em]">
          How the reading was checked
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <Check title={`Random subset: ${e.random_subset.roles} roles`} correct={e.random_subset.correct} total={e.random_subset.statements}>
            Quoted statements, from {e.random_subset.drawn_from}. {e.random_subset.misses_noticed} missed lines were
            noticed. {e.random_subset.label_flags_wrong} of {e.random_subset.label_flags} board-label flags were wrong.
          </Check>
          <Check title={`Held-out set: ${e.held_out.roles} roles`} correct={e.held_out.correct} total={e.held_out.statements}>
            {e.held_out.drawn_from} {e.held_out.misses_noticed} missed lines were noticed. {e.held_out.label_flags_wrong}{" "}
            of {e.held_out.label_flags} board-label flags were wrong.
          </Check>
          <Check title="Personal “conflicts” calls" correct={e.conflict_calls.correct} total={e.conflict_calls.reviewed}>
            {e.conflict_calls.profile} Target {e.conflict_calls.target * 100}%, floor {e.conflict_calls.floor * 100}%.
          </Check>
          <Check title="Hard cases" correct={e.hard_cases.passing} total={e.hard_cases.tests}>
            {e.hard_cases.description}
          </Check>
        </ul>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
          {e.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="errors-h">
        <h2 id="errors-h" className="text-[22px] font-black tracking-[-0.02em]">
          Known errors
        </h2>
        <ul className="mt-3 space-y-2">
          {e.known_errors.map((k) => {
            const open = k.status.startsWith("Open");
            return (
              <li key={k.what} className="rounded-2xl border border-line bg-card p-4">
                <span
                  className={`micro inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                    open ? "border-dashed border-ink-3 text-ink-2" : "border-ink"
                  }`}
                >
                  <span aria-hidden="true">{open ? "○" : "●"}</span>
                  {k.status}
                </span>
                <p className="mt-2 text-[15px]">{k.what}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="browse-h">
        <h2 id="browse-h" className="text-[22px] font-black tracking-[-0.02em]">
          Browse the sample
        </h2>
        <p className="mt-2 text-[15px] text-ink-2">
          Every role in the sample, as read on {MEASURED_ON}. Tap one to read it again live. Some will have closed
          since.
        </p>
        <div className="mt-4">
          <SampleList rows={rows as SampleRow[]} />
        </div>
      </section>
    </div>
  );
}

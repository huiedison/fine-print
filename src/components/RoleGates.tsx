import { SHORT_LABEL, STATE_WORD, type GateResult, type State } from "@/lib/gates";
import { GATE_LABEL, type Reading } from "@/lib/extract/types";

/** Decodes the few HTML entities the board leaves in description text. Display only. */
export function show(text: string) {
  return text
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/\s*\n\s*/g, " · ");
}

// Each state has its own mark and its own word. Nothing relies on color alone.
export const STATE_UI: Record<State, { icon: string; cls: string }> = {
  clear: { icon: "✓", cls: "border-ink bg-ink text-white" },
  blocked: { icon: "✕", cls: "border-2 border-ink bg-card text-ink" },
  unclear: { icon: "?", cls: "border-dashed border-ink-3 bg-transparent text-ink-2" },
  stated: { icon: "i", cls: "border-ink-3 bg-canvas text-ink" },
  silent: { icon: "○", cls: "border-dashed border-ink-3 bg-transparent text-ink-2" },
};

export function Mark({ state }: { state: State }) {
  return (
    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${STATE_UI[state].cls}`} aria-hidden="true">
      {STATE_UI[state].icon}
    </span>
  );
}

export function GateChips({ gates }: { gates: GateResult[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What the listing says, by area">
      {gates.map((g) => (
        <li key={g.gate} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] ${STATE_UI[g.state].cls}`}>
          <span aria-hidden="true" className="font-mono">
            {STATE_UI[g.state].icon}
          </span>
          <span className="font-semibold">{SHORT_LABEL[g.gate]}</span>
          <span className={g.state === "clear" ? "opacity-80" : ""}>{STATE_WORD[g.state]}</span>
        </li>
      ))}
    </ul>
  );
}

export function Quote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <blockquote className="mt-1 border-l-4 border-ink pl-3 text-[15px] leading-relaxed">
      <span className="micro block text-ink-3">{label}</span>
      <mark className="bg-mark px-0.5">{children}</mark>
    </blockquote>
  );
}

/** The requirement details for one role: each area, its state, and the quoted lines. */
export function GateDetails({ reading, gates }: { reading: Reading; gates: GateResult[] }) {
  const terms = reading.requirements.filter((r) => r.gate === "terms");
  const conflicts = reading.label_conflicts;
  return (
    <div className="space-y-5">
      {gates.map((g) => (
        <section key={g.gate}>
          <h4 className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
            <Mark state={g.state} />
            {GATE_LABEL[g.gate]}
            <span className="micro font-normal text-ink-3">{STATE_WORD[g.state]}</span>
          </h4>
          <p className="mt-1 text-sm text-ink-2">{g.because}</p>
          {g.lines.map((l) => {
            const conflict = conflicts.find((c) => c.requirement_index === l.index);
            return (
              <figure key={`${l.r.kind}-${l.r.start}`} className="mt-3">
                <figcaption className="text-sm font-semibold">
                  {g.gate === "pay" ? `Found in the description: ${l.r.summary}` : l.r.summary}
                  {l.r.strength === "preferred" ? <span className="font-normal text-ink-2"> (preferred)</span> : null}
                </figcaption>
                <Quote label="the listing says">{show(l.r.quote)}</Quote>
                {conflict ? (
                  <p className="mt-1 text-sm">
                    <span aria-hidden="true" className="font-mono">
                      ≠{" "}
                    </span>
                    The board labels this role “{conflict.board_label}”.
                  </p>
                ) : null}
                {l.because && l.because !== g.because ? <p className="mt-1 text-sm text-ink-2">{l.because}</p> : null}
                {l.r.note && l.r.kind === "us_person" ? <p className="mt-1 text-sm text-ink-2">{l.r.note}</p> : null}
              </figure>
            );
          })}
        </section>
      ))}
      {terms.length ? (
        <section>
          <h4 className="text-[15px] font-bold">{GATE_LABEL.terms}</h4>
          {terms.map((r) => (
            <figure key={`${r.kind}-${r.start}`} className="mt-3">
              <figcaption className="text-sm font-semibold">{r.summary}</figcaption>
              <Quote label="the listing says">{show(r.quote)}</Quote>
            </figure>
          ))}
        </section>
      ) : null}
      <p className="text-sm text-ink-2">
        Read {new Date(reading.read_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} from the
        speedrun API. fine_print matches patterns and can miss or misread a line.
        {reading.text.truncated ? " The board cuts descriptions at 15,000 characters, so the end of this one was not read." : ""}
      </p>
    </div>
  );
}

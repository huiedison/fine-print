"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { compare, compareReading, REASON_LABEL, VERDICT_LABEL, type Comparison, type Profile, type Verdict } from "@/lib/compare";
import { GATE_LABEL, type Gate, type Reading, type Requirement } from "@/lib/extract/types";

const EXAMPLES = [
  { id: "863accfc", label: "Optical Payload Engineer Intern, Anduril" },
  { id: "2c7b711e", label: "Junior Research Scientist, EliseAI" },
  { id: "1ad47635", label: "Senior Backend Engineer, Sekai" },
];

const PROFILE_KEY = "fine_print.profile.v1";
const SHOWN_GATES: Gate[] = ["work_auth", "school", "experience", "place_time", "pay"];

const KIND_FIELDS: Record<string, (keyof Profile)[]> = {
  us_person: ["workAuth"],
  citizen: ["workAuth"],
  citizen_or_pr: ["workAuth"],
  no_sponsorship: ["workAuth"],
  sponsorship_offered: ["workAuth"],
  work_authorization: ["workAuth"],
  enrolled: ["student", "degree"],
  return_to_school: ["student", "returning"],
  grad_window: ["gradMonth"],
  degree_phd: ["degree", "student"],
  years: ["years"],
};

type State =
  | { phase: "idle" }
  | { phase: "loading"; key: string }
  | { phase: "error"; message: string; detail?: string }
  | { phase: "done"; reading: Reading };

function localKey(input: string): { key: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "Paste a job link from the speedrun talent network first." };
  if (/^https?:\/\//i.test(raw) || raw.includes("/")) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!/(^|\.)speedrun-talent-network\.com$/i.test(u.hostname))
        return { error: "That link is not from speedrun-talent-network.com. fine_print only reads the speedrun board for now." };
      const m = /^\/jobs\/([^/]+)\/?$/.exec(u.pathname);
      if (!m) return { error: "That is a speedrun page, but not a single job. Open a role and copy its link." };
      return { key: m[1] };
    } catch {
      return { error: "That does not look like a link. Copy the address of a role on the speedrun board." };
    }
  }
  return { key: raw };
}

function show(text: string) {
  return text
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/\s*\n\s*/g, " · ");
}

function boardPay(r: Reading): string | null {
  const b = r.board;
  if (b.comp_summary) return b.comp_summary;
  if (b.comp_min == null && b.comp_max == null) return null;
  const f = (n: number) => `$${n.toLocaleString("en-US")}`;
  const per = b.comp_period ?? "year";
  if (b.comp_min != null && b.comp_max != null) return `${f(b.comp_min)} to ${f(b.comp_max)} per ${per}`;
  return `${f((b.comp_min ?? b.comp_max) as number)} per ${per}`;
}

const VERDICT_STYLE: Record<Verdict, { icon: string; cls: string }> = {
  meets: { icon: "✓", cls: "bg-ink text-white border-ink" },
  conflicts: { icon: "✕", cls: "bg-white text-ink border-ink border-2" },
  clarify: { icon: "?", cls: "bg-accent-soft text-ink border-accent border-dashed" },
};

function VerdictChip({ c }: { c: Comparison }) {
  const s = VERDICT_STYLE[c.verdict];
  return (
    <div className="mt-3 rounded-2xl bg-canvas/70 p-3">
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${s.cls}`}>
        <span aria-hidden="true" className="font-mono">
          {s.icon}
        </span>
        {VERDICT_LABEL[c.verdict]}
      </span>
      <p className="mt-2 text-sm text-ink-2">
        {c.because}
        {c.reason ? ` ${REASON_LABEL[c.reason]}` : ""}
      </p>
    </div>
  );
}

const STRENGTH_TEXT: Record<Requirement["strength"], string> = {
  required: "stated as required",
  preferred: "stated as preferred",
  alternative: "one of several options",
  info: "stated",
};

function RequirementCard({ r, c, conflict }: { r: Requirement; c: Comparison | null; conflict?: string }) {
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-[17px] font-bold leading-snug">{r.summary}</h4>
        <span className="micro text-ink-3">{STRENGTH_TEXT[r.strength]}</span>
      </div>
      {conflict ? (
        <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-ink px-3 py-1 text-sm">
          <span aria-hidden="true" className="font-mono">
            ≠
          </span>
          The board labels this role <strong className="font-semibold">“{conflict}”</strong>. The text says otherwise.
        </p>
      ) : null}
      <figure className="mt-3">
        <figcaption className="micro text-ink-3">the listing says</figcaption>
        <blockquote className="mt-1 border-l-4 border-ink pl-3 text-[15px] leading-relaxed">
          <mark className="bg-mark px-0.5">{show(r.quote)}</mark>
          {r.quote.length >= 300 ? "…" : ""}
        </blockquote>
      </figure>
      {r.note ? <p className="mt-2 text-sm text-ink-2">{r.note}</p> : null}
      {c ? <VerdictChip c={c} /> : null}
    </li>
  );
}

function Chips<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { v: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? undefined : o.v)}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-colors ${
                on ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"
              }`}
            >
              {on ? <span aria-hidden="true">✓ </span> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Checker() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [profile, setProfile] = useState<Profile>({});
  const [loadedProfile, setLoadedProfile] = useState(false);
  const inputId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const reqSeq = useRef(0);

  const run = useCallback(async (raw: string, push = true) => {
    const parsed = localKey(raw);
    if ("error" in parsed) {
      setState({ phase: "error", message: parsed.error });
      return;
    }
    const seq = ++reqSeq.current;
    setState({ phase: "loading", key: parsed.key });
    try {
      const res = await fetch(`/api/v1/gates/${encodeURIComponent(parsed.key)}`);
      const body = await res.json();
      if (seq !== reqSeq.current) return;
      if (!res.ok) {
        setState({
          phase: "error",
          message:
            res.status === 404
              ? "We could not find that role on the speedrun board. Check the link and try again."
              : res.status === 400
                ? "That does not look like a speedrun job link. Open a role on the board and copy its address."
                : res.status === 503
                  ? "The speedrun board is busy and asked us to slow down. Your link is fine. Try again in about ten seconds."
                  : "The speedrun board did not answer just now. Nothing is wrong with your link. Try again in a minute.",
        });
        return;
      }
      setState({ phase: "done", reading: body as Reading });
      if (push) {
        const url = new URL(window.location.href);
        url.searchParams.set("job", (body as Reading).board.id.slice(0, 8));
        window.history.replaceState(null, "", url);
      }
      requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: false }));
    } catch {
      if (seq !== reqSeq.current) return;
      setState({ phase: "error", message: "We could not reach fine_print. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROFILE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setProfile(JSON.parse(saved) as Profile);
    } catch {
      /* storage unavailable: the page works without it */
    }
    setLoadedProfile(true);
    const job = new URL(window.location.href).searchParams.get("job");
    if (job) {
      setInput(job);
      void run(job, false);
    }
  }, [run]);

  useEffect(() => {
    if (!loadedProfile) return;
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }, [profile, loadedProfile]);

  const reading = state.phase === "done" ? state.reading : null;
  const comparisons = useMemo(() => (reading ? compareReading(reading, profile) : null), [reading, profile]);
  const fields = useMemo(() => {
    const set = new Set<keyof Profile>();
    if (!reading) return set;
    for (const r of reading.requirements) {
      if (r.strength === "preferred") continue;
      for (const f of KIND_FIELDS[r.kind] ?? []) set.add(f);
    }
    if (reading.text.available) set.add("workAuth");
    return set;
  }, [reading]);
  const profileUsed = Object.values(profile).some((v) => v !== undefined && v !== "");
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <section className="hero-banner rounded-[28px] border border-line p-6 sm:p-9">
        <p className="micro text-ink-2">for students, co-ops and new grads</p>
        <h1 className="mt-3 text-[40px] font-black lowercase leading-[0.95] tracking-[-0.035em] sm:text-[64px]">
          see the requirements before you apply_
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Paste a job link from the speedrun talent network. fine_print reads the listing and quotes the lines about
          work authorization, school status, experience, place and pay. If the listing does not say, we tell you that
          too.
        </p>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void run(input);
          }}
        >
          <label htmlFor={inputId} className="micro text-ink-2">
            speedrun job link
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id={inputId}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://speedrun-talent-network.com/jobs/…"
              className="min-h-12 w-full flex-1 rounded-full border border-ink bg-card px-5 text-base placeholder:text-ink-3"
            />
            <button
              type="submit"
              disabled={state.phase === "loading"}
              className="min-h-12 rounded-full bg-ink px-6 text-base font-semibold text-white disabled:opacity-60"
            >
              {state.phase === "loading" ? "Reading…" : "Read the listing"}
            </button>
          </div>
        </form>
        <div className="mt-4">
          <p className="micro text-ink-2">or try a live listing</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => {
                  setInput(`https://speedrun-talent-network.com/jobs/${ex.id}`);
                  void run(ex.id);
                }}
                className="min-h-11 rounded-full border border-line bg-card/80 px-4 py-2 text-left text-sm hover:border-ink"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-6 outline-none">
        {state.phase === "loading" ? (
          <div role="status" className="rounded-[28px] border border-line bg-card p-6">
            <p className="micro text-ink-3">reading the listing from the speedrun board</p>
            <div className="skeleton mt-4 h-7 w-2/3 rounded-full bg-canvas" />
            <div className="skeleton mt-3 h-4 w-1/3 rounded-full bg-canvas" />
            <div className="skeleton mt-6 h-24 rounded-2xl bg-canvas" />
            <div className="skeleton mt-3 h-24 rounded-2xl bg-canvas" />
          </div>
        ) : null}

        {state.phase === "error" ? (
          <div role="alert" className="rounded-[28px] border-2 border-ink bg-card p-6">
            <p className="micro text-ink-3">could not read that</p>
            <p className="mt-2 text-lg font-semibold">{state.message}</p>
          </div>
        ) : null}

        {reading && comparisons ? (
          <Result reading={reading} profile={profile} set={set} fields={fields} profileUsed={profileUsed} onClear={() => setProfile({})} />
        ) : null}
      </div>
    </div>
  );
}

function Result({
  reading,
  profile,
  set,
  fields,
  profileUsed,
  onClear,
}: {
  reading: Reading;
  profile: Profile;
  set: <K extends keyof Profile>(k: K, v: Profile[K]) => void;
  fields: Set<keyof Profile>;
  profileUsed: boolean;
  onClear: () => void;
}) {
  const b = reading.board;
  const pay = boardPay(reading);
  const conflictByIndex = new Map(reading.label_conflicts.map((c) => [c.requirement_index, c.board_label]));
  const { silence } = compareReading(reading, profile);
  const read = new Date(reading.read_at);
  const terms = reading.requirements.filter((r) => r.gate === "terms");
  const stated = SHOWN_GATES.filter((g) => !reading.silent_gates.includes(g)).length;

  return (
    <article className="rounded-[28px] border border-line bg-card p-5 sm:p-7">
      <p className="micro text-ink-3">
        {b.company} · {b.location ?? "location not labeled"}
      </p>
      <h2 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.02em] sm:text-[34px]">{b.title}</h2>
      <p className="micro mt-2 text-ink-3">
        board labels: level {b.label_seniority ?? b.seniority ?? "none"} · workplace{" "}
        {b.workplace_type ?? b.label_workplace ?? "none"} · pay {pay ? "posted" : "none"}
      </p>

      {b.status === "closed" ? (
        <p className="mt-5 rounded-2xl border-2 border-ink p-4 text-[15px]">
          <strong>This role is closed.</strong> The board no longer serves its description, so there is nothing for
          fine_print to read.
        </p>
      ) : !reading.text.available ? (
        <p className="mt-5 rounded-2xl border-2 border-ink p-4 text-[15px]">
          <strong>The board has no description text for this role.</strong> fine_print cannot read what is not there.
          Open the original listing to see the requirements.
        </p>
      ) : (
        <>
          <p className="mt-5 text-[15px] text-ink-2">
            <strong className="text-ink">
              {stated} of {SHOWN_GATES.length} areas have a stated line.
            </strong>{" "}
            The rest are marked “doesn’t say”, which is not a yes or a no.
          </p>

          {fields.size > 0 ? (
            <details className="mt-5 rounded-2xl border border-line bg-canvas/50 p-4" open={profileUsed}>
              <summary className="cursor-pointer text-[15px] font-semibold">
                Compare with your situation <span className="font-normal text-ink-2">(optional)</span>
              </summary>
              <p className="mt-2 text-sm text-ink-2">
                Only the facts this listing asks about. Your answers stay in this browser and are never sent anywhere.
              </p>
              {fields.has("workAuth") ? (
                <Chips
                  legend="Your U.S. work authorization"
                  value={profile.workAuth}
                  onChange={(v) => set("workAuth", v)}
                  options={[
                    { v: "citizen", label: "U.S. citizen" },
                    { v: "pr", label: "U.S. permanent resident" },
                    { v: "other_no_sponsor", label: "Authorized, no sponsorship needed" },
                    { v: "needs_sponsor", label: "Would need sponsorship" },
                  ]}
                />
              ) : null}
              {fields.has("student") ? (
                <Chips
                  legend="Are you a student right now?"
                  value={profile.student}
                  onChange={(v) => set("student", v)}
                  options={[
                    { v: "enrolled", label: "Currently enrolled" },
                    { v: "graduated", label: "Graduated" },
                  ]}
                />
              ) : null}
              {fields.has("degree") ? (
                <Chips
                  legend="Your degree level (in progress or highest held)"
                  value={profile.degree}
                  onChange={(v) => set("degree", v)}
                  options={[
                    { v: "bachelor", label: "Bachelor’s" },
                    { v: "master", label: "Master’s" },
                    { v: "phd", label: "Ph.D." },
                  ]}
                />
              ) : null}
              {fields.has("returning") ? (
                <Chips
                  legend="Will you return to school after this internship?"
                  value={profile.returning}
                  onChange={(v) => set("returning", v)}
                  options={[
                    { v: "yes", label: "Yes, I will return" },
                    { v: "no", label: "No" },
                  ]}
                />
              ) : null}
              {fields.has("gradMonth") ? (
                <label className="mt-4 block text-sm font-semibold">
                  Your graduation month
                  <input
                    type="month"
                    value={profile.gradMonth ?? ""}
                    onChange={(e) => set("gradMonth", e.target.value || undefined)}
                    className="mt-2 block min-h-11 rounded-full border border-line bg-card px-4 font-normal"
                  />
                </label>
              ) : null}
              {fields.has("years") ? (
                <label className="mt-4 block text-sm font-semibold">
                  Years of full-time experience
                  <input
                    type="number"
                    min={0}
                    max={40}
                    inputMode="numeric"
                    value={profile.years ?? ""}
                    onChange={(e) => set("years", e.target.value === "" ? undefined : Number(e.target.value))}
                    className="mt-2 block min-h-11 w-28 rounded-full border border-line bg-card px-4 font-normal"
                  />
                </label>
              ) : null}
              {profileUsed ? (
                <button type="button" onClick={onClear} className="mt-4 text-sm underline underline-offset-4">
                  Clear my answers
                </button>
              ) : null}
            </details>
          ) : null}

          <div className="mt-6 space-y-6">
            {SHOWN_GATES.map((gate) => {
              const items = reading.requirements.map((r, i) => ({ r, i })).filter((x) => x.r.gate === gate);
              const silent = items.length === 0 && !(gate === "pay" && pay);
              return (
                <section key={gate} aria-labelledby={`gate-${gate}`}>
                  <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                    <h3 id={`gate-${gate}`} className="text-[15px] font-bold">
                      {GATE_LABEL[gate]}
                    </h3>
                    <span
                      className={`micro inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                        silent ? "border-dashed border-ink-3 text-ink-2" : "border-ink bg-ink text-white"
                      }`}
                    >
                      <span aria-hidden="true">{silent ? "○" : "●"}</span>
                      {silent ? "doesn’t say" : gate === "pay" && items.length === 0 ? "posted on the board" : `${items.length} stated`}
                    </span>
                  </div>
                  {gate === "pay" ? (
                    <p className="mt-3 text-[15px]">
                      <span className="micro text-ink-3">board pay field </span>
                      {pay ? <strong>{pay}</strong> : <span className="text-ink-2">empty</span>}
                      {!pay && items.length > 0 ? (
                        <span className="text-ink-2"> · the band below was found in the description, not the pay field</span>
                      ) : null}
                    </p>
                  ) : null}
                  {silent ? (
                    <p className="mt-3 text-[15px] text-ink-2">
                      {gate === "pay"
                        ? "No pay band on the board and none found in the description."
                        : "The listing has no explicit line about this. That is not a yes or a no."}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {items.map(({ r, i }) => (
                        <RequirementCard
                          key={`${r.kind}-${r.start}`}
                          r={gate === "pay" ? { ...r, summary: `Found in the description: ${r.summary}` } : r}
                          c={profileUsed ? compare(r, profile, b.location) : null}
                          conflict={conflictByIndex.get(i)}
                        />
                      ))}
                    </ul>
                  )}
                  {gate === "work_auth" && silence.length > 0
                    ? silence.map((c, i) => (
                        <div key={i} className="mt-1">
                          <VerdictChip c={c} />
                        </div>
                      ))
                    : null}
                </section>
              );
            })}

            {terms.length > 0 ? (
              <section aria-labelledby="gate-terms">
                <h3 id="gate-terms" className="border-b border-line pb-2 text-[15px] font-bold">
                  {GATE_LABEL.terms}
                </h3>
                <ul className="mt-3 space-y-3">
                  {terms.map((r) => (
                    <RequirementCard key={`${r.kind}-${r.start}`} r={r} c={null} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={b.url}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-base font-semibold text-white"
        >
          Open the listing on speedrun ↗
        </a>
        <p className="text-sm text-ink-2">
          Read {read.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at{" "}
          {read.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} from the speedrun API.
          {reading.text.truncated ? " The board caps descriptions at 15,000 characters, so the end of this one was not read." : ""}
        </p>
      </div>

      <p className="mt-6 rounded-2xl bg-accent-soft p-4 text-[15px]">
        Roles on this board come from the speedrun talent network.{" "}
        <a href="https://speedrun-talent-network.com/join" target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-4">
          Join the network
        </a>{" "}
        so founders can find you, too.
      </p>
      <p className="mt-4 text-sm text-ink-2">
        fine_print matches patterns in the listing text, and it can miss or misread a line. Always check the original
        before you decide.
      </p>
    </article>
  );
}

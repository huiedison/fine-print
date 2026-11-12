"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BoardError, keyFromInput, LEVELS, listRoles, readRole, type ListedRole, type RoleList } from "@/lib/board";
import { gateResults, overall, SHORT_LABEL, type Answers, type GateResult, type State } from "@/lib/gates";
import { GATE_LABEL, type Reading } from "@/lib/extract/types";

const ANSWERS_KEY = "fine_print.answers.v2";
const PAGE = 10;

type Loaded = { reading: Reading } | { error: "busy" | "not_found" | "down" };

// One role is read at a time, with a short gap, so a page of listings stays
// well inside the speedrun API's rate limit.
let chain: Promise<unknown> = Promise.resolve();
function inTurn<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => new Promise((r) => setTimeout(r, 350)),
    () => new Promise((r) => setTimeout(r, 350)),
  );
  return run;
}

function show(text: string) {
  return text
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/\s*\n\s*/g, " · ");
}

const STATE_UI: Record<State | "unclear", { icon: string; word: string; cls: string }> = {
  clear: { icon: "✓", word: "clear", cls: "border-ink bg-ink text-white" },
  blocked: { icon: "✕", word: "blocked", cls: "border-2 border-ink bg-card text-ink" },
  silent: { icon: "○", word: "doesn’t say", cls: "border-dashed border-ink-3 bg-transparent text-ink-2" },
  unclear: { icon: "?", word: "unclear", cls: "border-dashed border-ink-3 bg-transparent text-ink-2" },
};

function ui(state: State, unclear: boolean) {
  return STATE_UI[state === "silent" && unclear ? "unclear" : state];
}

function StateChip({ g }: { g: GateResult }) {
  const s = ui(g.state, g.unclear);
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] ${s.cls}`}>
      <span aria-hidden="true" className="font-mono">
        {s.icon}
      </span>
      <span className="font-semibold">{SHORT_LABEL[g.gate]}</span>
      <span className={g.state === "clear" ? "opacity-80" : ""}>{s.word}</span>
    </li>
  );
}

function Legend() {
  return (
    <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-2" aria-label="What the marks mean">
      {(
        [
          ["clear", "nothing stated rules you out"],
          ["blocked", "a stated line rules you out"],
          ["silent", "the listing has no clear line"],
        ] as const
      ).map(([k, text]) => (
        <li key={k} className="inline-flex items-center gap-2">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border font-mono text-xs ${STATE_UI[k].cls}`} aria-hidden="true">
            {STATE_UI[k].icon}
          </span>
          <span>
            <strong className="text-ink">{STATE_UI[k].word}</strong>: {text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pick<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? undefined : o.v)}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm ${on ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}
          >
            {on ? <span aria-hidden="true">✓ </span> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AboutYou({ a, set, clear }: { a: Answers; set: (patch: Partial<Answers>) => void; clear: () => void }) {
  const done = [a.workAuth, a.gradMonth, a.countries?.length || a.inPerson].filter(Boolean).length;
  const toggleCountry = (c: "US" | "CA" | "other") => {
    const cur = a.countries ?? [];
    set({ countries: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] });
  };
  return (
    <section aria-labelledby="you-h" className="mt-6 rounded-[28px] border border-line bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="you-h" className="text-[22px] font-black tracking-[-0.02em]">
          <span className="micro mr-2 rounded-full bg-ink px-2 py-1 text-white">1</span>Three things about you
        </h2>
        <p className="micro text-ink-3" aria-live="polite">
          {done} of 3 answered
        </p>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        Your answers stay in this browser. They are never sent anywhere. Skip any you like.
      </p>

      <fieldset className="mt-5">
        <legend className="text-[15px] font-semibold">Can you work in the U.S.?</legend>
        <Pick
          value={a.workAuth}
          onChange={(v) => set({ workAuth: v })}
          options={[
            { v: "citizen", label: "I’m a U.S. citizen" },
            { v: "pr", label: "I have a green card" },
            { v: "other_no_sponsor", label: "Yes, without sponsorship" },
            { v: "needs_sponsor", label: "I’d need sponsorship" },
          ]}
        />
      </fieldset>

      <div className="mt-5">
        <label htmlFor="grad" className="text-[15px] font-semibold">
          When do you graduate?
        </label>
        <p className="text-sm text-ink-2">Use the month you finished if you already have.</p>
        <input
          id="grad"
          type="month"
          value={a.gradMonth ?? ""}
          onChange={(e) => set({ gradMonth: e.target.value || undefined })}
          className="mt-2 block min-h-11 rounded-full border border-line bg-card px-4"
        />
      </div>

      <fieldset className="mt-5">
        <legend className="text-[15px] font-semibold">Where can you work?</legend>
        <p className="text-sm text-ink-2">Pick every place that works for you.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["US", "United States"],
              ["CA", "Canada"],
              ["other", "Somewhere else"],
            ] as const
          ).map(([v, label]) => {
            const on = a.countries?.includes(v) ?? false;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCountry(v)}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm ${on ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}
              >
                {on ? <span aria-hidden="true">✓ </span> : null}
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[15px] font-semibold">Can you work in person or move for a job?</p>
        <Pick
          value={a.inPerson}
          onChange={(v) => set({ inPerson: v })}
          options={[
            { v: "yes", label: "Yes" },
            { v: "no", label: "No, remote only" },
          ]}
        />
      </fieldset>

      {done > 0 ? (
        <button type="button" onClick={clear} className="mt-5 text-sm underline underline-offset-4">
          Clear my answers
        </button>
      ) : null}
    </section>
  );
}

function RoleCard({
  role,
  loaded,
  answers,
  open,
  onRetry,
}: {
  role: ListedRole;
  loaded: Loaded | undefined;
  answers: Answers;
  open?: boolean;
  onRetry: () => void;
}) {
  const reading = loaded && "reading" in loaded ? loaded.reading : null;
  const results = useMemo(() => (reading ? gateResults(reading, answers) : null), [reading, answers]);
  const terms = reading?.requirements.filter((r) => r.gate === "terms") ?? [];
  const blocked = results?.find((g) => g.state === "blocked");
  const conflicts = reading?.label_conflicts ?? [];

  return (
    <li className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <p className="micro text-ink-3">
        {role.company} · {role.location ?? "location not given"}
      </p>
      <h3 className="mt-1 text-[18px] font-bold leading-snug">{role.title}</h3>

      {!loaded ? (
        <div role="status" className="mt-3">
          <span className="sr-only">Reading this listing</span>
          <div className="skeleton flex gap-2">
            {[72, 64, 88, 56, 48].map((w) => (
              <span key={w} className="h-7 rounded-full bg-canvas" style={{ width: w }} />
            ))}
          </div>
          <p className="micro mt-2 text-ink-3">reading the listing…</p>
        </div>
      ) : "error" in loaded ? (
        <div className="mt-3 rounded-xl border border-dashed border-ink-3 p-3 text-sm">
          {loaded.error === "not_found" ? (
            <p>This role is no longer on the board.</p>
          ) : (
            <>
              <p>
                {loaded.error === "busy"
                  ? "The speedrun board is busy and asked us to slow down."
                  : "The speedrun board did not answer."}{" "}
                This listing has not been read yet.
              </p>
              <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-full border border-ink px-4 text-sm font-semibold">
                Try again
              </button>
            </>
          )}
        </div>
      ) : reading && results ? (
        reading.board.status === "closed" || !reading.text.available ? (
          <p className="mt-3 rounded-xl border border-dashed border-ink-3 p-3 text-sm">
            {reading.board.status === "closed"
              ? "This role is closed, so the board no longer has its text."
              : "The board has no description text for this role, so there is nothing to read."}
          </p>
        ) : (
          <>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What the listing says, by area">
              {results.map((g) => (
                <StateChip key={g.gate} g={g} />
              ))}
            </ul>
            {blocked ? (
              <p className="mt-3 text-[15px]">
                <strong>Blocked on {GATE_LABEL[blocked.gate].toLowerCase()}.</strong> {blocked.because}
              </p>
            ) : null}
            <details className="group mt-3" open={open}>
              <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-ink">
                <span className="group-open:hidden">Show the lines</span>
                <span className="hidden group-open:inline">Hide the lines</span>
              </summary>
              <div className="mt-4 space-y-5">
                {results.map((g) => {
                  const s = ui(g.state, g.unclear);
                  return (
                    <section key={g.gate}>
                      <h4 className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border font-mono text-xs ${s.cls}`} aria-hidden="true">
                          {s.icon}
                        </span>
                        {GATE_LABEL[g.gate]}
                        <span className="micro font-normal text-ink-3">{s.word}</span>
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
                            <blockquote className="mt-1 border-l-4 border-ink pl-3 text-[15px] leading-relaxed">
                              <span className="micro block text-ink-3">the listing says</span>
                              <mark className="bg-mark px-0.5">{show(l.r.quote)}</mark>
                            </blockquote>
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
                  );
                })}
                {terms.length ? (
                  <section>
                    <h4 className="text-[15px] font-bold">{GATE_LABEL.terms}</h4>
                    {terms.map((r) => (
                      <figure key={`${r.kind}-${r.start}`} className="mt-3">
                        <figcaption className="text-sm font-semibold">{r.summary}</figcaption>
                        <blockquote className="mt-1 border-l-4 border-ink pl-3 text-[15px] leading-relaxed">
                          <span className="micro block text-ink-3">the listing says</span>
                          <mark className="bg-mark px-0.5">{show(r.quote)}</mark>
                        </blockquote>
                      </figure>
                    ))}
                  </section>
                ) : null}
                <p className="text-sm text-ink-2">
                  Read {new Date(reading.read_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{" "}
                  from the speedrun API. fine_print matches patterns and can miss or misread a line.
                  {reading.text.truncated ? " The board cuts descriptions at 15,000 characters, so the end of this one was not read." : ""}
                </p>
              </div>
            </details>
          </>
        )
      ) : null}

      <a
        href={role.url}
        target="_blank"
        rel="noopener"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
      >
        Open the listing on speedrun ↗
      </a>
    </li>
  );
}

export default function Finder() {
  const [answers, setAnswers] = useState<Answers>({});
  const [ready, setReady] = useState(false);
  const [levels, setLevels] = useState<string[]>(["intern", "new_grad", "junior"]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<RoleList | null>(null);
  const [roles, setRoles] = useState<ListedRole[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [shown, setShown] = useState(PAGE);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [filter, setFilter] = useState<"all" | "open" | "blocked">("all");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<ListedRole | null>(null);
  const [pinning, setPinning] = useState(false);
  const asked = useRef(new Set<string>());
  const linkId = useId();
  const searchId = useId();

  // answers: load once, then save on change
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ANSWERS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setAnswers(JSON.parse(saved) as Answers);
    } catch {
      /* the page works without storage */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [answers, ready]);

  const read = useCallback((id: string, force = false) => {
    if (asked.current.has(id) && !force) return;
    asked.current.add(id);
    if (force) setLoaded((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id)));
    void inTurn(() => readRole(id)).then(
      (reading) => setLoaded((m) => ({ ...m, [id]: { reading } })),
      (e) => setLoaded((m) => ({ ...m, [id]: { error: e instanceof BoardError ? e.kind : "down" } })),
    );
  }, []);

  // the live list
  useEffect(() => {
    const ctl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingList(true);
    setListError(null);
    listRoles({ levels, q: search, page: 0 }, ctl.signal).then(
      (res) => {
        setList(res);
        setRoles(res.roles);
        setShown(PAGE);
        setLoadingList(false);
      },
      (e) => {
        if ((e as Error).name === "AbortError") return;
        setListError(
          e instanceof BoardError && e.kind === "busy"
            ? "The speedrun board is busy and asked us to slow down. Wait ten seconds and try again."
            : "We could not reach the speedrun board. Check your connection and try again.",
        );
        setLoadingList(false);
      },
    );
    return () => ctl.abort();
  }, [levels, search]);

  const visible = useMemo(() => roles.slice(0, shown), [roles, shown]);
  useEffect(() => {
    // Starts the async read for each role on screen; state is set when each one resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    for (const r of visible) read(r.id);
  }, [visible, read]);

  const more = async () => {
    if (shown + PAGE <= roles.length || !list?.hasMore) {
      setShown((n) => n + PAGE);
      return;
    }
    try {
      const next = await listRoles({ levels, q: search, page: list.page + 1 });
      setList(next);
      setRoles((cur) => [...cur, ...next.roles.filter((r) => !cur.some((c) => c.id === r.id))]);
      setShown((n) => n + PAGE);
    } catch {
      setListError("We could not load more roles just now. Try again in a few seconds.");
    }
  };

  const openLink = useCallback(async (raw: string) => {
    const parsed = keyFromInput(raw);
    if ("error" in parsed) {
      setLinkError(parsed.error);
      return;
    }
    setLinkError(null);
    setPinning(true);
    try {
      const reading = await inTurn(() => readRole(parsed.key));
      const b = reading.board;
      setLoaded((m) => ({ ...m, [b.id]: { reading } }));
      asked.current.add(b.id);
      setPinned({ id: b.id, title: b.title, company: b.company, location: b.location, url: b.url, published_at: b.published_at });
      const url = new URL(window.location.href);
      url.searchParams.set("job", b.id.slice(0, 8));
      window.history.replaceState(null, "", url);
    } catch (e) {
      setLinkError(
        e instanceof BoardError && e.kind === "not_found"
          ? "We could not find that role on the speedrun board. Check the link."
          : "The speedrun board did not answer. Your link is probably fine. Try again in ten seconds.",
      );
    } finally {
      setPinning(false);
    }
  }, []);

  useEffect(() => {
    const job = new URL(window.location.href).searchParams.get("job");
    if (job) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLink(job);
      void openLink(job);
    }
  }, [openLink]);

  const verdicts = useMemo(() => {
    const out: Record<string, State> = {};
    for (const r of visible) {
      const l = loaded[r.id];
      if (l && "reading" in l && l.reading.text.available) out[r.id] = overall(gateResults(l.reading, answers));
    }
    return out;
  }, [visible, loaded, answers]);
  const counts = {
    all: visible.length,
    open: visible.filter((r) => verdicts[r.id] && verdicts[r.id] !== "blocked").length,
    blocked: visible.filter((r) => verdicts[r.id] === "blocked").length,
  };
  const filtered = visible.filter((r) =>
    filter === "all" ? true : filter === "blocked" ? verdicts[r.id] === "blocked" : verdicts[r.id] && verdicts[r.id] !== "blocked",
  );
  const stillReading = visible.filter((r) => !loaded[r.id]).length;
  const answered = !!(answers.workAuth || answers.gradMonth || answers.countries?.length || answers.inPerson);

  return (
    <div>
      <section className="hero-banner rounded-[28px] border border-line p-6 sm:p-9">
        <p className="micro text-ink-2">for students, co-ops and new grads</p>
        <h1 className="mt-3 text-[40px] font-black lowercase leading-[0.95] tracking-[-0.035em] sm:text-[64px]">
          see the requirements before you apply_
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Tell fine_print three things about you. It reads each listing on the speedrun board for the lines that rule
          you in or out, and quotes them.
        </p>
        <Legend />
      </section>

      <AboutYou a={answers} set={(patch) => setAnswers((cur) => ({ ...cur, ...patch }))} clear={() => setAnswers({})} />

      <section aria-labelledby="list-h" className="mt-6">
        <h2 id="list-h" className="px-1 text-[22px] font-black tracking-[-0.02em]">
          <span className="micro mr-2 rounded-full bg-ink px-2 py-1 text-white">2</span>Listings, read for you
        </h2>

        <form
          className="mt-4 rounded-2xl border border-line bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void openLink(link);
          }}
        >
          <label htmlFor={linkId} className="text-[15px] font-semibold">
            Already have a listing? Paste its link.
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id={linkId}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://speedrun-talent-network.com/jobs/…"
              className="min-h-12 w-full flex-1 rounded-full border border-ink bg-card px-5 text-base placeholder:text-ink-3"
            />
            <button type="submit" disabled={pinning} className="min-h-12 rounded-full bg-ink px-6 text-base font-semibold text-white disabled:opacity-60">
              {pinning ? "Reading…" : "Read it"}
            </button>
          </div>
          {linkError ? (
            <p role="alert" className="mt-2 text-sm font-semibold">
              {linkError}
            </p>
          ) : null}
        </form>

        {pinned ? (
          <div className="mt-4">
            <p className="micro px-1 text-ink-3">the listing you pasted</p>
            <ul className="mt-2">
              <RoleCard role={pinned} loaded={loaded[pinned.id]} answers={answers} open onRetry={() => read(pinned.id, true)} />
            </ul>
          </div>
        ) : null}

        <div className="mt-6">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <label htmlFor={searchId} className="sr-only">
              Search early-career roles on the speedrun board
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, company or city"
              className="min-h-12 w-full flex-1 rounded-full border border-line bg-card px-5 text-base placeholder:text-ink-3"
            />
            <button type="submit" className="min-h-12 rounded-full border border-ink bg-card px-6 text-base font-semibold">
              Search
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Level">
            {LEVELS.map((l) => {
              const on = levels.includes(l.key);
              return (
                <button
                  key={l.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setLevels((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== l.key) : cur) : [...cur, l.key]))}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm ${on ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}
                >
                  {on ? <span aria-hidden="true">✓ </span> : null}
                  {l.label}
                  {list?.levelCounts[l.key] != null ? (
                    <span className="ml-1 font-mono text-xs opacity-80">{list.levelCounts[l.key].toLocaleString("en-US")}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {listError ? (
          <div role="alert" className="mt-4 rounded-2xl border-2 border-ink bg-card p-4">
            <p className="font-semibold">{listError}</p>
            <button type="button" onClick={() => setSearch((s) => s + " ")} className="mt-2 min-h-11 rounded-full border border-ink px-4 text-sm font-semibold">
              Try again
            </button>
          </div>
        ) : loadingList ? (
          <ul className="mt-4 space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="skeleton h-28 rounded-2xl border border-line bg-card" />
            ))}
          </ul>
        ) : roles.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-ink-3 p-4 text-[15px] text-ink-2">
            No early-career roles match “{search.trim()}”. Try a shorter search.
          </p>
        ) : (
          <>
            <p className="micro mt-4 px-1 text-ink-3" aria-live="polite">
              {list ? `${list.total.toLocaleString("en-US")} roles on the board` : ""} · showing {visible.length}
              {stillReading ? ` · reading ${stillReading} more` : ""} · live from the speedrun API,{" "}
              {list ? new Date(list.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
            </p>
            {!answered ? (
              <p className="mt-3 rounded-2xl bg-accent-soft p-4 text-[15px]">
                Answer the questions above to see <strong>clear</strong> or <strong>blocked</strong>. Until then, each
                listing shows which areas it has a line about.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter the roles shown">
                {(
                  [
                    ["all", "All shown"],
                    ["open", "Not blocked"],
                    ["blocked", "Blocked"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                    className={`min-h-11 rounded-full border px-4 py-2 text-sm ${filter === k ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}
                  >
                    {label} <span className="font-mono text-xs opacity-80">{counts[k]}</span>
                  </button>
                ))}
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-ink-3 p-4 text-[15px] text-ink-2">
                None of the {visible.length} roles shown fit that filter{stillReading ? " yet. Some are still being read." : "."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {filtered.map((r) => (
                  <RoleCard key={r.id} role={r} loaded={loaded[r.id]} answers={answers} onRetry={() => read(r.id, true)} />
                ))}
              </ul>
            )}
            {shown < roles.length || list?.hasMore ? (
              <button type="button" onClick={() => void more()} className="mt-4 min-h-12 w-full rounded-full bg-ink px-6 text-base font-semibold text-white sm:w-auto">
                Read {PAGE} more
              </button>
            ) : null}
            <p className="mt-6 rounded-2xl bg-card p-4 text-[15px]">
              These roles come from the speedrun talent network.{" "}
              <a href="https://speedrun-talent-network.com/join" target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-4">
                Join the network
              </a>{" "}
              so founders can find you too.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import FactsForm from "@/components/FactsForm";
import { GateChips, GateDetails } from "@/components/RoleGates";
import { BoardError, keyFromInput, LEVELS, listRoles, readRole, toListedRole, type ListedRole, type RoleList } from "@/lib/board";
import type { Reading } from "@/lib/extract/types";
import { GATE_LABEL } from "@/lib/extract/types";
import { gateResults, overall } from "@/lib/gates";
import { factsAnswered, type Facts } from "@/lib/profile";
import { actions, loadSaved, useSession } from "@/lib/profileStore";

const PAGE = 10;

type Loaded = { reading: Reading } | { error: "busy" | "not_found" | "down" };

// One role is read at a time, with a short gap, so a page of listings stays
// well inside the speedrun API's rate limit.
let chain: Promise<unknown> = Promise.resolve();
function inTurn<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  const gap = () => new Promise((r) => setTimeout(r, 350));
  chain = run.then(gap, gap);
  return run;
}

function RoleCard({ role, loaded, facts, open, onRetry }: { role: ListedRole; loaded: Loaded | undefined; facts: Facts; open?: boolean; onRetry: () => void }) {
  const reading = loaded && "reading" in loaded ? loaded.reading : null;
  const results = useMemo(() => (reading ? gateResults(reading, facts) : null), [reading, facts]);
  const blocked = results?.find((g) => g.state === "blocked");

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
                {loaded.error === "busy" ? "The speedrun board is busy and asked us to slow down." : "The speedrun board did not answer."} This listing has not
                been read yet.
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
            <div className="mt-3">
              <GateChips gates={results} />
            </div>
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
              <div className="mt-4">
                <GateDetails reading={reading} gates={results} />
              </div>
            </details>
          </>
        )
      ) : null}

      <a href={role.url} target="_blank" rel="noopener" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
        Open the listing on speedrun ↗
      </a>
    </li>
  );
}

export default function Finder() {
  const session = useSession();
  const facts = session.profile.facts;
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

  useEffect(() => loadSaved(), []);

  const read = useCallback((id: string, force = false) => {
    if (asked.current.has(id) && !force) return;
    asked.current.add(id);
    if (force) setLoaded((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id)));
    void inTurn(() => readRole(id)).then(
      (reading) => setLoaded((m) => ({ ...m, [id]: { reading } })),
      (e) => setLoaded((m) => ({ ...m, [id]: { error: e instanceof BoardError ? e.kind : "down" } })),
    );
  }, []);

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
      setPinned(toListedRole({ ...b }));
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
    const out: Record<string, ReturnType<typeof overall>> = {};
    for (const r of visible) {
      const l = loaded[r.id];
      if (l && "reading" in l && l.reading.text.available) out[r.id] = overall(gateResults(l.reading, facts));
    }
    return out;
  }, [visible, loaded, facts]);
  const counts = {
    all: visible.length,
    open: visible.filter((r) => verdicts[r.id] && verdicts[r.id] !== "blocked").length,
    blocked: visible.filter((r) => verdicts[r.id] === "blocked").length,
  };
  const filtered = visible.filter((r) => (filter === "all" ? true : filter === "blocked" ? verdicts[r.id] === "blocked" : verdicts[r.id] && verdicts[r.id] !== "blocked"));
  const stillReading = visible.filter((r) => !loaded[r.id]).length;
  const answered = factsAnswered(facts) > 0;

  return (
    <div>
      <section className="rounded-[28px] border border-line bg-card p-6 sm:p-9">
        <p className="micro text-ink-3">check a listing · browse the board</p>
        <h1 className="mt-3 text-[36px] font-black lowercase leading-[0.95] tracking-[-0.035em] sm:text-[56px]">read the fine print_</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Paste one listing, or browse live roles. fine_print quotes the lines about work authorization, school, experience, place and pay. For matches
          based on your resume,{" "}
          <Link href="/" className="font-semibold text-accent underline underline-offset-4">
            start here
          </Link>
          .
        </p>
      </section>

      <form
        className="mt-6 rounded-2xl border border-line bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void openLink(link);
        }}
      >
        <label htmlFor={linkId} className="text-[15px] font-semibold">
          Paste a speedrun job link
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
            <RoleCard role={pinned} loaded={loaded[pinned.id]} facts={facts} open onRetry={() => read(pinned.id, true)} />
          </ul>
        </div>
      ) : null}

      <details className="mt-6 rounded-[28px] border border-line bg-card p-5 sm:p-7" open={!answered}>
        <summary className="cursor-pointer text-[18px] font-black tracking-[-0.01em]">
          About you <span className="micro ml-2 font-normal text-ink-3">{factsAnswered(facts)} of 4 answered</span>
        </summary>
        <p className="mt-2 text-sm text-ink-2">
          Used to mark each listing clear or blocked. Your answers stay in this tab unless you choose to save your profile on the{" "}
          <Link href="/" className="underline underline-offset-4">
            matching page
          </Link>
          .
        </p>
        <div className="mt-4">
          <FactsForm facts={facts} set={actions.setFacts} full={false} />
        </div>
      </details>

      <section aria-labelledby="list-h" className="mt-6">
        <h2 id="list-h" className="px-1 text-[22px] font-black tracking-[-0.02em]">
          Live early-career roles
        </h2>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
          }}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
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
                {list?.levelCounts[l.key] != null ? <span className="ml-1 font-mono text-xs opacity-80">{list.levelCounts[l.key].toLocaleString("en-US")}</span> : null}
              </button>
            );
          })}
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
          <p className="mt-4 rounded-2xl border border-dashed border-ink-3 p-4 text-[15px] text-ink-2">No early-career roles match “{search.trim()}”. Try a shorter search.</p>
        ) : (
          <>
            <p className="micro mt-4 px-1 text-ink-3" aria-live="polite">
              {list ? `${list.total.toLocaleString("en-US")} roles on the board` : ""} · showing {visible.length}
              {stillReading ? ` · reading ${stillReading} more` : ""} · live from the speedrun API
            </p>
            {answered ? (
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
            ) : null}
            {filtered.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-ink-3 p-4 text-[15px] text-ink-2">
                None of the {visible.length} roles shown fit that filter{stillReading ? " yet. Some are still being read." : "."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {filtered.map((r) => (
                  <RoleCard key={r.id} role={r} loaded={loaded[r.id]} facts={facts} onRetry={() => read(r.id, true)} />
                ))}
              </ul>
            )}
            {shown < roles.length || list?.hasMore ? (
              <button type="button" onClick={() => void more()} className="mt-4 min-h-12 w-full rounded-full bg-ink px-6 text-base font-semibold text-white sm:w-auto">
                Read {PAGE} more
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FactsForm, { PickMany } from "@/components/FactsForm";
import { GateDetails, Quote, show } from "@/components/RoleGates";
import type { ListedRole } from "@/lib/board";
import { ELIGIBILITY_TEXT, LABEL_TEXT, METRO_NAME, rankMatches, scoreRole, type Match } from "@/lib/match/rank";
import { analyzeAll, BATCH, retrieve, type Outcome, type Retrieved } from "@/lib/match/retrieve";
import { TERMS } from "@/lib/match/taxonomy";
import {
  resumeYearsFullTime,
  type CandidateProfile,
  type DegreeLevel,
  type Engagement,
  type Level,
  type Preference,
  type Preferences,
  type ResumeProfile,
  type SkillClaim,
  type Workplace,
} from "@/lib/profile";
import { actions, loadSaved, useSession } from "@/lib/profileStore";
import { browserParsers, fileToText, LIMITS, pastedToText, ResumeError, RESUME_ERROR_TEXT } from "@/lib/resume/extractText";
import { parseResume } from "@/lib/resume/parse";

const CARD = "rounded-[28px] border border-line bg-card p-5 sm:p-7";
const H2 = "text-[22px] font-black tracking-[-0.02em]";
const H3 = "text-[17px] font-bold";
const HINT = "text-sm text-ink-2";
const BTN = "min-h-12 rounded-full bg-ink px-6 text-base font-semibold text-white disabled:opacity-50";
const BTN2 = "min-h-11 rounded-full border border-ink bg-card px-4 text-sm font-semibold";
const INPUT = "min-h-11 rounded-full border border-line bg-card px-4 text-[15px]";
const LINK = "text-sm font-semibold underline underline-offset-4";

const FUNCTIONS = ["engineering", "product", "design", "data", "operations", "strategy", "business_development", "sales", "marketing", "growth", "customer", "finance", "research", "people", "legal", "hardware_manufacturing"] as const;
const DEGREE_NAME: Record<DegreeLevel, string> = { associate: "Associate", bachelor: "Bachelor’s", master: "Master’s", phd: "Ph.D." };
const STEPS = ["Upload your resume", "Review your profile", "Explore your matches"] as const;

// ------------------------------------------------------------------ step 1

function ResumeStep({ resume, onNext }: { resume: ResumeProfile | null; onNext: () => void }) {
  const [phase, setPhase] = useState<"idle" | "opening" | "reading" | "finding">("idle");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const token = useRef(0);

  const finish = (text: string, fileName: string | null, mine: number) => {
    if (mine !== token.current) return; // replaced or cleared while this one was being read
    actions.setResume(parseResume(text, fileName), text);
    setPhase("idle");
    setPasted("");
    setPasting(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const mine = ++token.current;
    setError(null);
    setName(file.name);
    setPhase("opening");
    try {
      const text = await fileToText(file, {
        pdf: async () => {
          const lib = await browserParsers.pdf();
          if (mine === token.current) setPhase("reading");
          return lib;
        },
        docx: async () => {
          const lib = await browserParsers.docx();
          if (mine === token.current) setPhase("reading");
          return lib;
        },
      });
      if (mine !== token.current) return;
      setPhase("finding");
      finish(text, file.name, mine);
    } catch (e) {
      if (mine !== token.current) return;
      setPhase("idle");
      setError(e instanceof ResumeError ? e.message : RESUME_ERROR_TEXT.unreadable);
    }
  };

  const clear = () => {
    token.current++;
    setName(null);
    setError(null);
    setPhase("idle");
    actions.clearResume();
  };

  const busy = phase !== "idle";
  return (
    <section className={CARD} aria-labelledby="s1">
      <h2 id="s1" className={H2}>
        Upload your resume
      </h2>
      <div className="mt-3 rounded-2xl bg-accent-soft p-4 text-[15px]">
        <p className="font-semibold">What happens to your resume</p>
        <p className="mt-1">
          It is read on this device, in your browser. The file and its text are not uploaded to fine_print or sent to any AI service. They stay in this
          tab’s memory and are gone when you close or reload it, unless you choose to save your profile in the next step.
        </p>
      </div>

      {resume ? (
        <div className="mt-5 rounded-2xl border border-line p-4" data-testid="resume-summary">
          <p className="micro text-ink-3">resume read</p>
          <p className="mt-1 text-[17px] font-bold">{resume.fileName ?? "Pasted text"}</p>
          <p className={`mt-1 ${HINT}`}>
            Found {resume.skills.length} skills, {resume.experience.length} roles, {resume.projects.length} projects and {resume.education.length} education
            entries. You will check all of it next.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`${BTN2} inline-flex cursor-pointer items-center focus-within:outline focus-within:outline-2`}>
              Replace
              <input type="file" accept=".pdf,.docx" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <button type="button" className={BTN2} onClick={clear}>
              Clear resume
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <label className={`${BTN} inline-flex cursor-pointer items-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 ${busy ? "opacity-50" : ""}`}>
            Choose a PDF or Word file
            <input type="file" accept=".pdf,.docx" disabled={busy} className="sr-only" data-testid="resume-file" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          <p className={`mt-2 ${HINT}`}>
            PDF or .docx, up to {LIMITS.maxBytes / 1024 / 1024} MB and {LIMITS.maxPages} pages. Scanned images cannot be read.
          </p>
        </div>
      )}

      <div aria-live="polite" className="mt-3">
        {busy ? (
          <p role="status" className="rounded-2xl border border-line p-4 text-[15px]">
            <span className="font-semibold">{name}</span>
            <span className="skeleton mt-1 block text-ink-2">
              {phase === "opening" ? "Opening the file…" : phase === "reading" ? "Reading the text…" : "Finding skills and experience…"}
            </span>
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-2xl border-2 border-ink p-4 text-[15px]">
            {name ? <span className="font-semibold">{name}: </span> : null}
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <button type="button" className={LINK} aria-expanded={pasting} onClick={() => setPasting((p) => !p)}>
          {pasting ? "Hide the paste box" : "Or paste the text of your resume"}
        </button>
        {pasting ? (
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const mine = ++token.current;
              setError(null);
              setName(null);
              try {
                finish(pastedToText(pasted), null, mine);
              } catch (err) {
                setError(err instanceof ResumeError ? err.message : RESUME_ERROR_TEXT.empty);
              }
            }}
          >
            <label htmlFor="paste" className="text-[15px] font-semibold">
              Resume text
            </label>
            <textarea
              id="paste"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={8}
              maxLength={LIMITS.maxChars}
              className="mt-2 block w-full rounded-2xl border border-line bg-card p-3 font-mono text-sm"
              placeholder="Paste everything, headings included"
            />
            <button type="submit" className={`mt-2 ${BTN2}`}>
              Read this text
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" className={BTN} onClick={onNext} disabled={busy}>
          {resume ? "Review what we found" : "Continue without a resume"}
        </button>
        {!resume ? <p className={HINT}>Without a resume, matches rest on your preferences alone.</p> : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ step 2

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full border border-line bg-card py-1 pl-3 pr-1 text-sm">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-canvas">
        ×
      </button>
    </li>
  );
}

const BASIS: { key: SkillClaim["basis"]; title: string; hint: string }[] = [
  { key: "listed", title: "Named in your skills section", hint: "You wrote these down as skills." },
  { key: "shown", title: "Shown in your described work", hint: "We read these from what you did. They are our reading, so remove any that are wrong." },
  { key: "added", title: "Added by you", hint: "No resume evidence, because you typed these in." },
];

function ResumeReview({ resume }: { resume: ResumeProfile }) {
  const [adding, setAdding] = useState("");
  const edit = (patch: Partial<ResumeProfile>) => actions.editResume({ ...resume, ...patch });
  const addSkill = () => {
    const name = adding.trim().slice(0, 60);
    if (!name) return;
    const term = TERMS.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? TERMS.find((t) => t.kind === "tool" && t.re.test(name));
    const id = term?.id ?? `custom:${name.toLowerCase()}`;
    if (!resume.skills.some((s) => s.id === id)) edit({ skills: [...resume.skills, { id, name: term?.name ?? name, basis: "added", evidence: [] }] });
    setAdding("");
  };
  return (
    <div className="space-y-7">
      <section aria-labelledby="skills-h">
        <h3 id="skills-h" className={H3}>
          Skills
        </h3>
        {BASIS.map((b) => {
          const items = resume.skills.filter((s) => s.basis === b.key);
          if (!items.length) return null;
          return (
            <div key={b.key} className="mt-3" data-testid={`skills-${b.key}`}>
              <p className="text-[15px] font-semibold">{b.title}</p>
              <p className={HINT}>{b.hint}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {items.map((s) => (
                  <Chip key={s.id} label={s.name} onRemove={() => edit({ skills: resume.skills.filter((x) => x.id !== s.id) })} />
                ))}
              </ul>
              {b.key !== "added" ? (
                <details className="mt-2">
                  <summary className={`cursor-pointer ${LINK}`}>Where each one came from</summary>
                  <dl className="mt-2 space-y-3">
                    {items.map((s) => (
                      <div key={s.id}>
                        <dt className="text-sm font-semibold">{s.name}</dt>
                        <dd>
                          {s.evidence.slice(0, 2).map((e) => (
                            <Quote key={e.start} label={e.where ? `your resume · ${e.where}` : "your resume"}>
                              {show(e.quote)}
                            </Quote>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}
            </div>
          );
        })}
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addSkill();
          }}
        >
          <label htmlFor="add-skill" className="sr-only">
            Add a skill
          </label>
          <input id="add-skill" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a skill we missed" className={INPUT} />
          <button type="submit" className={BTN2}>
            Add
          </button>
        </form>
      </section>

      <section aria-labelledby="exp-h">
        <h3 id="exp-h" className={H3}>
          Work experience
        </h3>
        {resume.experience.length === 0 ? <p className={`mt-1 ${HINT}`}>We did not find an experience section with dated roles.</p> : null}
        <ul className="mt-2 space-y-3">
          {resume.experience.map((x, i) => {
            const set = (patch: Partial<typeof x>) => edit({ experience: resume.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
            return (
              <li key={`${x.evidence.start}-${i}`} className="rounded-2xl border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Title
                    <input value={x.title} onChange={(e) => set({ title: e.target.value })} className={`mt-1 block w-full ${INPUT}`} />
                  </label>
                  <label className="text-sm font-semibold">
                    Employer
                    <input value={x.org} onChange={(e) => set({ org: e.target.value })} className={`mt-1 block w-full ${INPUT}`} />
                  </label>
                  <label className="text-sm font-semibold">
                    Start
                    <input type="month" value={x.start ?? ""} onChange={(e) => set({ start: e.target.value || null })} className={`mt-1 block ${INPUT}`} />
                  </label>
                  <label className="text-sm font-semibold">
                    End <span className="font-normal text-ink-2">{x.end === "present" ? "(current)" : ""}</span>
                    <input
                      type="month"
                      value={x.end && x.end !== "present" ? x.end : ""}
                      onChange={(e) => set({ end: e.target.value || null })}
                      className={`mt-1 block ${INPUT}`}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Kind of role
                    <select value={x.kind} onChange={(e) => set({ kind: e.target.value as typeof x.kind })} className={`mt-1 block ${INPUT}`}>
                      <option value="full_time">Full-time</option>
                      <option value="internship">Internship or co-op</option>
                      <option value="part_time">Part-time</option>
                      <option value="other">Activity or volunteering</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={x.end === "present"} onChange={(e) => set({ end: e.target.checked ? "present" : null })} className="h-5 w-5" />I
                    still work here
                  </label>
                </div>
                <p className={`mt-2 ${HINT}`}>
                  {x.bullets.length} {x.bullets.length === 1 ? "line" : "lines"} of described work kept as evidence.
                </p>
                <button type="button" className={`mt-1 ${LINK}`} onClick={() => edit({ experience: resume.experience.filter((_, j) => j !== i) })}>
                  Remove this role
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="proj-h">
        <h3 id="proj-h" className={H3}>
          Projects
        </h3>
        {resume.projects.length === 0 ? <p className={`mt-1 ${HINT}`}>We did not find a projects section.</p> : null}
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {resume.projects.map((p, i) => (
            <Chip key={`${p.evidence.start}-${i}`} label={p.name} onRemove={() => edit({ projects: resume.projects.filter((_, j) => j !== i) })} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="edu-h">
        <h3 id="edu-h" className={H3}>
          Education
        </h3>
        {resume.education.length === 0 ? <p className={`mt-1 ${HINT}`}>We did not find an education section.</p> : null}
        <ul className="mt-2 space-y-3">
          {resume.education.map((x, i) => {
            const set = (patch: Partial<typeof x>) => edit({ education: resume.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
            return (
              <li key={`${x.evidence.start}-${i}`} className="rounded-2xl border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    School
                    <input value={x.school} onChange={(e) => set({ school: e.target.value })} className={`mt-1 block w-full ${INPUT}`} />
                  </label>
                  <label className="text-sm font-semibold">
                    Degree
                    <select value={x.degree ?? ""} onChange={(e) => set({ degree: (e.target.value || null) as DegreeLevel | null })} className={`mt-1 block ${INPUT}`}>
                      <option value="">Not stated</option>
                      {(Object.keys(DEGREE_NAME) as DegreeLevel[]).map((d) => (
                        <option key={d} value={d}>
                          {DEGREE_NAME[d]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={`mt-2 ${HINT}`}>
                  {x.field ? `${x.field}. ` : ""}
                  {x.end ? `${x.expected ? "Expected " : "Finished "}${x.end}.` : "No date found."}
                </p>
                <Quote label="your resume">{show(x.evidence.quote)}</Quote>
                <button type="button" className={`mt-2 ${LINK}`} onClick={() => edit({ education: resume.education.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function MustHave({ pref, onChange, name }: { pref: { required: boolean; values: unknown[] }; onChange: (required: boolean) => void; name: string }) {
  if (!pref.values.length) return null;
  return (
    <label className="mt-2 flex items-center gap-2 text-sm">
      <input type="checkbox" checked={pref.required} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
      <span>
        {name} is a must-have <span className="text-ink-2">(otherwise it is a nice-to-have)</span>
      </span>
    </label>
  );
}

function PrefsForm({ prefs }: { prefs: Preferences }) {
  const [title, setTitle] = useState("");
  const set = (patch: Partial<Preferences>) => actions.setPrefs({ ...prefs, ...patch });
  const pref = <T extends string>(key: "levels" | "workplace" | "engagement" | "metros", patch: Partial<Preference<T>>) => {
    const next = { ...prefs[key], ...patch } as Preference<T>;
    set({ [key]: { ...next, required: next.required && next.values.length > 0 } } as Partial<Preferences>);
  };
  const addTitle = () => {
    const t = title.trim().slice(0, 80);
    if (t && !prefs.titles.some((x) => x.toLowerCase() === t.toLowerCase()) && prefs.titles.length < 6) set({ titles: [...prefs.titles, t] });
    setTitle("");
  };
  const Q = "text-[15px] font-semibold";
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="want-title" className={Q}>
          Job titles you want
        </label>
        <p className={HINT}>These drive the search, even if your past titles are different. Add up to six.</p>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTitle();
          }}
        >
          <input id="want-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. business operations" className={`${INPUT} min-w-0 flex-1`} />
          <button type="submit" className={BTN2}>
            Add title
          </button>
        </form>
        <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="wanted-titles">
          {prefs.titles.map((t) => (
            <Chip key={t} label={t} onRemove={() => set({ titles: prefs.titles.filter((x) => x !== t) })} />
          ))}
        </ul>
      </div>

      <fieldset>
        <legend className={Q}>Or pick functions</legend>
        <PickMany values={prefs.functions} onChange={(v) => set({ functions: v.slice(0, 6) })} options={FUNCTIONS.map((f) => ({ v: f, label: f.replace(/_/g, " ") }))} />
      </fieldset>

      <fieldset>
        <legend className={Q}>Level</legend>
        <PickMany<Level>
          values={prefs.levels.values}
          onChange={(v) => pref("levels", { values: v })}
          options={[
            { v: "intern", label: "Intern" },
            { v: "new_grad", label: "New grad" },
            { v: "junior", label: "Junior" },
            { v: "mid", label: "Mid-level" },
            { v: "senior", label: "Senior" },
          ]}
        />
        <MustHave pref={prefs.levels} onChange={(r) => pref("levels", { required: r })} name="Level" />
      </fieldset>

      <fieldset>
        <legend className={Q}>Internship or full-time</legend>
        <PickMany<Engagement>
          values={prefs.engagement.values}
          onChange={(v) => pref("engagement", { values: v })}
          options={[
            { v: "internship", label: "Internship or co-op" },
            { v: "full_time", label: "Full-time" },
          ]}
        />
        <MustHave pref={prefs.engagement} onChange={(r) => pref("engagement", { required: r })} name="This" />
      </fieldset>

      <fieldset>
        <legend className={Q}>Remote, hybrid or on-site</legend>
        <PickMany<Workplace>
          values={prefs.workplace.values}
          onChange={(v) => pref("workplace", { values: v })}
          options={[
            { v: "remote", label: "Remote" },
            { v: "hybrid", label: "Hybrid" },
            { v: "onsite", label: "On-site" },
          ]}
        />
        <MustHave pref={prefs.workplace} onChange={(r) => pref("workplace", { required: r })} name="This" />
      </fieldset>

      <fieldset>
        <legend className={Q}>Cities you’d like</legend>
        <p className={HINT}>These are the metro areas the board can filter by. Countries you can work in are asked above.</p>
        <PickMany values={prefs.metros.values} onChange={(v) => pref("metros", { values: v.slice(0, 5) })} options={Object.entries(METRO_NAME).map(([v, label]) => ({ v, label }))} />
        <MustHave pref={prefs.metros} onChange={(r) => pref("metros", { required: r })} name="Location" />
      </fieldset>

      <fieldset>
        <legend className={Q}>
          Pay you’re hoping for <span className="font-normal text-ink-2">(optional)</span>
        </legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="pay-min">
            Minimum pay
          </label>
          <input
            id="pay-min"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="At least"
            value={prefs.salary?.min ?? ""}
            onChange={(e) => {
              const min = Number(e.target.value);
              set({ salary: e.target.value && min > 0 ? { currency: "USD", period: "year", required: false, ...prefs.salary, min } : undefined });
            }}
            className={`${INPUT} w-36`}
          />
          <label className="sr-only" htmlFor="pay-cur">
            Currency
          </label>
          <select
            id="pay-cur"
            value={prefs.salary?.currency ?? "USD"}
            disabled={!prefs.salary}
            onChange={(e) => prefs.salary && set({ salary: { ...prefs.salary, currency: e.target.value as "USD" | "CAD" } })}
            className={INPUT}
          >
            <option>USD</option>
            <option>CAD</option>
          </select>
          <label className="sr-only" htmlFor="pay-per">
            Pay period
          </label>
          <select
            id="pay-per"
            value={prefs.salary?.period ?? "year"}
            disabled={!prefs.salary}
            onChange={(e) => prefs.salary && set({ salary: { ...prefs.salary, period: e.target.value as "year" | "hour" | "month" } })}
            className={INPUT}
          >
            <option value="year">per year</option>
            <option value="month">per month</option>
            <option value="hour">per hour</option>
          </select>
        </div>
        {prefs.salary ? (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs.salary.required} onChange={(e) => prefs.salary && set({ salary: { ...prefs.salary, required: e.target.checked } })} className="h-5 w-5" />
            <span>
              Pay is a must-have <span className="text-ink-2">(roles with no posted pay stay in, marked unknown)</span>
            </span>
          </label>
        ) : null}
      </fieldset>
    </div>
  );
}

function ProfileStep({ profile, remember, onNext, onBack }: { profile: CandidateProfile; remember: boolean; onNext: () => void; onBack: () => void }) {
  const { resume, facts, prefs } = profile;
  const shownYears = useMemo(() => resumeYearsFullTime(resume, new Date()), [resume]);
  const edu = resume?.education.find((e) => e.degree);
  const ready = prefs.titles.length > 0 || prefs.functions.length > 0;
  return (
    <div className="space-y-6">
      <section className={CARD} aria-labelledby="s2a">
        <h2 id="s2a" className={H2}>
          What we read from your resume
        </h2>
        <p className={`mt-1 ${HINT}`}>Fix anything that is wrong. Matches use this version, not the file.</p>
        <div className="mt-5">
          {resume ? (
            <ResumeReview resume={resume} />
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-3 p-4 text-[15px]">
              No resume yet.{" "}
              <button type="button" className="font-semibold underline underline-offset-4" onClick={onBack}>
                Go back and add one
              </button>{" "}
              to get reasons grounded in your experience.
            </p>
          )}
        </div>
      </section>

      <section className={CARD} aria-labelledby="s2b">
        <h2 id="s2b" className={H2}>
          Things only you can tell us
        </h2>
        <p className={`mt-1 ${HINT}`}>
          We do not guess these from your resume. Skip any you like: an unanswered question shows up as “not confirmed”, never as a pass or a fail.
        </p>
        {resume && (shownYears > 0 || edu) ? (
          <div className="mt-4 rounded-2xl bg-canvas/70 p-4 text-[15px]" data-testid="suggestions">
            <p className="font-semibold">From your resume, for you to confirm</p>
            {shownYears > 0 ? (
              <p className="mt-2">
                Your full-time roles add up to about {shownYears} {shownYears === 1 ? "year" : "years"}, counting overlapping months once.{" "}
                <button type="button" className="font-semibold underline underline-offset-4" onClick={() => actions.setFacts({ yearsFullTime: shownYears })}>
                  Use {shownYears}
                </button>
              </p>
            ) : null}
            {edu?.degree ? (
              <p className="mt-2">
                It lists a {DEGREE_NAME[edu.degree]} degree{edu.expected ? ", not finished yet" : ""}.{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-4"
                  onClick={() => actions.setFacts({ degree: edu.degree ?? undefined, degreeStatus: edu.expected ? "in_progress" : "completed", ...(edu.end ? { gradMonth: edu.end } : {}) })}
                >
                  Use this
                </button>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-5">
          <FactsForm facts={facts} set={actions.setFacts} full />
        </div>
      </section>

      <section className={CARD} aria-labelledby="s2c">
        <h2 id="s2c" className={H2}>
          What you want
        </h2>
        <div className="mt-5">
          <PrefsForm prefs={prefs} />
        </div>
      </section>

      <section className={CARD}>
        <label className="flex items-start gap-3 text-[15px]">
          <input type="checkbox" checked={remember} onChange={(e) => actions.setRemember(e.target.checked)} className="mt-0.5 h-5 w-5" data-testid="remember" />
          <span>
            <span className="font-semibold">Remember this profile on this device</span>
            <span className={`block ${HINT}`}>
              Saves your reviewed profile, answers and preferences in this browser, including the short resume quotes used as evidence. The resume file and
              its full text are never saved. Leave this off and everything is gone when you close the tab.
            </span>
          </span>
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={BTN} disabled={!ready} onClick={onNext} data-testid="find-matches">
            Find my matches
          </button>
          <button type="button" className={BTN2} onClick={onBack}>
            Back
          </button>
        </div>
        {!ready ? (
          <p className={`mt-2 ${HINT}`} role="status">
            Add at least one job title or function so we know what to search for.
          </p>
        ) : null}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ step 3

function MatchCard({ m }: { m: Match }) {
  const b = m.analysis.reading.board;
  const hold = m.eligibility === "conflict";
  return (
    <li className="rounded-2xl border border-line bg-card p-4 sm:p-5" data-testid="match-card">
      <p className="micro text-ink-3">
        {m.role.company} · {m.role.location ?? "location not given"} · {m.workplace ? (m.workplace === "onsite" ? "on-site" : m.workplace) : "workplace not labeled"}
      </p>
      <h3 className="mt-1 text-[18px] font-bold leading-snug">{m.role.title}</h3>
      <p className="mt-1 text-sm text-ink-2">{m.pay ? `Pay: ${m.pay}` : "Pay: not posted, and none found in the description"}</p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        <li className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${m.label === "strong" || m.label === "good" ? "border-ink bg-ink text-white" : "border-ink-3 bg-canvas"}`} data-testid="label">
          {LABEL_TEXT[m.label]}
        </li>
        <li
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] ${hold ? "border-2 border-ink font-semibold" : m.eligibility === "unknown" ? "border-dashed border-ink-3 text-ink-2" : "border-ink-3"}`}
          data-testid="eligibility"
        >
          <span aria-hidden="true" className="font-mono">
            {hold ? "✕" : m.eligibility === "unknown" ? "?" : "✓"}
          </span>
          {ELIGIBILITY_TEXT[m.eligibility]}
        </li>
        {m.missedMustHaves.length ? <li className="rounded-full border-2 border-ink px-3 py-1 text-[13px] font-semibold">Misses a must-have</li> : null}
      </ul>

      {m.reasons.length ? (
        <ol className="mt-4 space-y-3" data-testid="reasons">
          {m.reasons.map((r, i) => (
            <li key={i}>
              <p className="text-[15px] font-semibold">{r.text}</p>
              <Quote label="the listing says">{show(r.job)}</Quote>
              {r.resume ? <Quote label="your resume says">{show(r.resume)}</Quote> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-[15px] text-ink-2">Nothing in your resume or preferences lines up with this listing in a way we can quote.</p>
      )}

      {hold || m.missedMustHaves.length ? (
        <div className="mt-4 rounded-xl border-2 border-ink p-3 text-[15px]">
          {m.eligibilityNotes.map((n) => (
            <p key={n}>
              <strong>Stated conflict.</strong> {n}
            </p>
          ))}
          {m.missedMustHaves.map((n) => (
            <p key={n}>
              <strong>Must-have missed.</strong> {n}
            </p>
          ))}
        </div>
      ) : null}

      <details className="group mt-3">
        <summary className={`inline-flex cursor-pointer items-center ${BTN2}`}>
          <span className="group-open:hidden">Evidence, gaps and requirements</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
        <div className="mt-4 space-y-6">
          {m.pairs.length ? (
            <section>
              <h4 className="text-[15px] font-bold">Your resume beside the listing</h4>
              <ul className="mt-2 space-y-4">
                {m.pairs.map((p) => (
                  <li key={p.name}>
                    <p className="text-sm font-semibold">
                      {p.name} <span className="font-normal text-ink-2">· {p.strength === "mentioned" ? "described in the listing" : p.strength}</span>
                    </p>
                    <Quote label="the listing says">{show(p.job.quote)}</Quote>
                    {p.resume ? (
                      <Quote label={`your resume says${p.basis === "shown" ? " · read from described work" : ""}`}>{show(p.resume.quote)}</Quote>
                    ) : (
                      <p className="mt-1 text-sm text-ink-2">You added this skill yourself, so there is no resume line to quote.</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h4 className="text-[15px] font-bold">Gaps and open questions</h4>
            {m.gaps.length === 0 && m.uncertainties.length === 0 && m.eligibility === "no_conflict" ? <p className="mt-1 text-sm text-ink-2">None found.</p> : null}
            <ul className="mt-2 space-y-3">
              {m.gaps.map((g) => (
                <li key={`${g.name}-${g.job.start}`}>
                  <p className="text-sm font-semibold">
                    {g.name} <span className="font-normal text-ink-2">· {g.strength} · not evidenced in your resume</span>
                  </p>
                  <Quote label="the listing says">{show(g.job.quote)}</Quote>
                </li>
              ))}
              {m.eligibility === "unknown"
                ? m.eligibilityNotes.map((n) => (
                    <li key={n} className="text-sm">
                      <span className="font-semibold">Eligibility not confirmed.</span> {n}
                    </li>
                  ))
                : null}
              {m.uncertainties.map((u) => (
                <li key={u} className="text-sm text-ink-2">
                  {u}
                </li>
              ))}
            </ul>
            {m.gaps.length ? <p className="mt-2 text-sm text-ink-2">“Not evidenced” means we did not find it in your resume. It does not mean you lack it.</p> : null}
          </section>

          <section>
            <h4 className="text-[15px] font-bold">What the listing requires</h4>
            <div className="mt-2">
              <GateDetails reading={m.analysis.reading} gates={m.gates} />
            </div>
          </section>

          <section>
            <h4 className="text-[15px] font-bold">How this was scored</h4>
            <p className="mt-1 text-sm text-ink-2">
              {m.score} of 16 on our matching rubric: the role you asked for {m.parts.role}/4, required skills backed by your resume {m.parts.required}/4, kinds of
              work your resume shows {m.parts.work}/4, level {m.parts.level}/2, your preferences {m.parts.prefs}/2. This describes overlap with the listing. It is
              not a chance of getting an interview or an offer.
            </p>
          </section>
        </div>
      </details>

      <a href={b.url} target="_blank" rel="noopener" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
        Open the listing on speedrun ↗
      </a>
    </li>
  );
}

type Run = {
  status: "searching" | "analyzing" | "done" | "error";
  broad: boolean;
  retrieved: Retrieved | null;
  outcomes: Record<string, Outcome>;
  attempted: number;
};

function MatchesStep({ profile, onBack }: { profile: CandidateProfile; onBack: () => void }) {
  const [run, setRun] = useState<Run>({ status: "searching", broad: false, retrieved: null, outcomes: {}, attempted: 0 });
  const [filter, setFilter] = useState<"best" | "conflicts" | "all">("best");
  const ctl = useRef<AbortController | null>(null);
  const runId = useRef(0);
  // the search reads the latest preferences without restarting whenever they change
  const prefsRef = useRef(profile.prefs);
  useEffect(() => {
    prefsRef.current = profile.prefs;
  }, [profile.prefs]);

  const analyze = useCallback(async (roles: ListedRole[], id: number, signal: AbortSignal) => {
    setRun((r) => (id === runId.current ? { ...r, status: "analyzing", attempted: r.attempted + roles.filter((x) => !r.outcomes[x.id]).length } : r));
    await analyzeAll(roles, signal, (o) => {
      // a newer search, or a cleared profile, must never be overwritten by this one
      if (id !== runId.current || signal.aborted) return;
      setRun((r) => ({ ...r, outcomes: { ...r.outcomes, [o.role.id]: o } }));
    });
    if (id === runId.current && !signal.aborted) setRun((r) => ({ ...r, status: "done" }));
  }, []);

  const start = useCallback(
    async (broad: boolean) => {
      ctl.current?.abort();
      const c = new AbortController();
      ctl.current = c;
      const id = ++runId.current;
      setRun({ status: "searching", broad, retrieved: null, outcomes: {}, attempted: 0 });
      try {
        const retrieved = await retrieve(prefsRef.current, broad, c.signal);
        if (id !== runId.current || c.signal.aborted) return;
        setRun((r) => ({ ...r, retrieved }));
        await analyze(retrieved.pool.slice(0, BATCH), id, c.signal);
      } catch (e) {
        if (id !== runId.current || c.signal.aborted || (e as Error).name === "AbortError") return;
        setRun((r) => ({ ...r, status: "error" }));
      }
    },
    [analyze],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start(false);
    return () => {
      // Leaving this step, or clearing the profile, invalidates every request in flight.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runId.current++;
      ctl.current?.abort();
    };
  }, [start]);

  const pool = run.retrieved?.pool ?? [];
  const done = Object.values(run.outcomes);
  const ok = done.filter((o): o is Extract<Outcome, { analysis: unknown }> => "analysis" in o);
  const failed = done.filter((o): o is Extract<Outcome, { error: unknown }> => "error" in o && o.error !== "not_found");
  const readable = ok.filter((o) => o.analysis.reading.text.available);
  const matches = useMemo(() => rankMatches(readable.map((o) => scoreRole(profile, o.role, o.analysis))), [readable, profile]);
  const remaining = pool.filter((r) => !run.outcomes[r.id]);
  const busy = run.status === "searching" || run.status === "analyzing";

  const held = (m: Match) => m.eligibility === "conflict" || m.missedMustHaves.length > 0;
  const counts = { best: matches.filter((m) => !held(m)).length, conflicts: matches.filter(held).length, all: matches.length };
  const shown = matches.filter((m) => (filter === "all" ? true : filter === "conflicts" ? held(m) : !held(m)));
  const goodOnes = matches.filter((m) => !held(m) && (m.label === "strong" || m.label === "good")).length;
  const again = (roles: ListedRole[]) => ctl.current && void analyze(roles, runId.current, ctl.current.signal);

  return (
    <section aria-labelledby="s3">
      <div className={CARD}>
        <h2 id="s3" className={H2}>
          Your best matches
        </h2>
        <div aria-live="polite" data-testid="match-status">
          {run.status === "searching" ? (
            <p role="status" className="skeleton mt-2 text-[15px]">
              Searching the speedrun board for {profile.prefs.titles.concat(profile.prefs.functions.map((f) => f.replace(/_/g, " "))).join(", ")}…
            </p>
          ) : run.status === "error" ? (
            <div role="alert" className="mt-3 rounded-2xl border-2 border-ink p-4">
              <p className="font-semibold">The speedrun board did not answer. Nothing is wrong with your profile.</p>
              <button type="button" className={`mt-2 ${BTN2}`} onClick={() => void start(run.broad)}>
                Try again
              </button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-[15px]">
                Retrieved <strong>{pool.length}</strong> {pool.length === 1 ? "role" : "roles"} from {run.retrieved?.searches.length ?? 0}{" "}
                {run.retrieved?.searches.length === 1 ? "search" : "searches"}
                {run.broad ? " (broadened)" : ""}. Analyzed <strong>{readable.length}</strong>
                {busy ? ` so far, reading ${Math.max(0, run.attempted - done.length)} more` : ""}.
              </p>
              <p className={`mt-1 ${HINT}`}>
                These are the best matches among the {readable.length} analyzed, not the whole board.
                {run.retrieved?.searches.map((s) => ` ${s.label}: ${s.failed ? "search failed" : `${s.total.toLocaleString("en-US")} on the board`}.`).join("")}
              </p>
              {ok.length - readable.length > 0 ? <p className={`mt-1 ${HINT}`}>{ok.length - readable.length} had no description text to read.</p> : null}
              {failed.length ? (
                <p className="mt-2 text-[15px]">
                  {failed.length} could not be read because the board was busy. The rest are below.{" "}
                  <button type="button" className="font-semibold underline underline-offset-4" disabled={busy} onClick={() => again(failed.map((f) => f.role))}>
                    Retry those
                  </button>
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {remaining.length ? (
            <button type="button" className={BTN2} disabled={busy} onClick={() => again(remaining.slice(0, BATCH))}>
              Analyze {Math.min(BATCH, remaining.length)} more
            </button>
          ) : null}
          {!run.broad ? (
            <button type="button" className={BTN2} disabled={run.status === "searching"} onClick={() => void start(true)}>
              Broaden the search
            </button>
          ) : null}
          <button type="button" className={BTN2} onClick={onBack}>
            Change my profile
          </button>
        </div>
      </div>

      {run.status !== "searching" && run.status !== "error" ? (
        <>
          {!busy && pool.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-ink-3 p-4 text-[15px]">
              No roles on the board match those titles with your must-haves. Try “Broaden the search”, a shorter title, or turning a must-have into a
              nice-to-have.
            </p>
          ) : null}
          {!busy && pool.length > 0 && goodOnes < 3 ? (
            <p className="mt-4 rounded-2xl bg-accent-soft p-4 text-[15px]" data-testid="few-matches">
              {goodOnes === 0 ? "None" : `Only ${goodOnes}`} of the {readable.length} roles analyzed {goodOnes === 1 ? "is" : "are"} a good or strong match
              without a conflict. You can analyze more, broaden the search, add another title, or loosen a must-have.
            </p>
          ) : null}
          {matches.length ? (
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter matches">
              {(
                [
                  ["best", "No conflicts"],
                  ["conflicts", "Stated conflicts"],
                  ["all", "All analyzed"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  onClick={() => setFilter(k)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm ${filter === k ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}
                  data-testid={`filter-${k}`}
                >
                  {label} <span className="font-mono text-xs opacity-80">{counts[k]}</span>
                </button>
              ))}
            </div>
          ) : null}
          {matches.length > 0 && shown.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-ink-3 p-4 text-[15px] text-ink-2">Nothing under this filter. Try “All analyzed”.</p>
          ) : null}
          <ol className="mt-4 space-y-3">
            {shown.map((m) => (
              <MatchCard key={m.role.id} m={m} />
            ))}
            {busy
              ? [0, 1].map((i) => (
                  <li key={`sk${i}`} className="skeleton h-32 rounded-2xl border border-line bg-card" aria-hidden="true" />
                ))
              : null}
          </ol>
        </>
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------------ the flow

export default function MatchFlow() {
  const session = useSession();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => loadSaved(), []);

  const go = (s: 0 | 1 | 2) => {
    setStep(s);
    requestAnimationFrame(() => top.current?.focus());
  };
  const { profile } = session;
  const hasAnything = !!profile.resume || Object.keys(profile.facts).length > 0 || profile.prefs.titles.length > 0 || profile.prefs.functions.length > 0;
  const canMatch = profile.prefs.titles.length > 0 || profile.prefs.functions.length > 0;

  return (
    <div>
      <section className="hero-banner rounded-[28px] border border-line p-6 sm:p-9">
        <p className="micro text-ink-2">for students, co-ops and new grads</p>
        <h1 className="mt-3 text-[40px] font-black lowercase leading-[0.95] tracking-[-0.035em] sm:text-[64px]">find the roles worth your application_</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Upload your resume and say what you want. fine_print searches live roles on the speedrun board, ranks them against your experience, and shows the
          lines from your resume and from each listing behind every match.
        </p>
        <p className="mt-3 text-[15px]">
          Just want to check one listing?{" "}
          <Link href="/browse" className="font-semibold underline underline-offset-4">
            Paste a link or browse the board
          </Link>
          .
        </p>
      </section>

      <nav aria-label="Steps" className="mt-6">
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((label, i) => {
            const enabled = i < 2 || canMatch;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!enabled}
                  aria-current={step === i ? "step" : undefined}
                  onClick={() => go(i as 0 | 1 | 2)}
                  className={`flex min-h-14 w-full flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left disabled:opacity-50 ${step === i ? "border-ink bg-ink text-white" : "border-line bg-card"}`}
                >
                  <span className="micro">step {i + 1}</span>
                  <span className="text-[13px] font-semibold leading-tight sm:text-[15px]">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={top} tabIndex={-1} className="mt-6 outline-none">
        {step === 0 ? <ResumeStep resume={profile.resume} onNext={() => go(1)} /> : null}
        {step === 1 ? <ProfileStep profile={profile} remember={session.remember} onNext={() => go(2)} onBack={() => go(0)} /> : null}
        {/* keyed by epoch: clearing or replacing the resume remounts this, which cancels every request in flight */}
        {step === 2 ? <MatchesStep key={session.epoch} profile={profile} onBack={() => go(1)} /> : null}
      </div>

      {hasAnything ? (
        <p className="mt-8 text-center">
          <button
            type="button"
            className={LINK}
            data-testid="clear-all"
            onClick={() => {
              actions.clearAll();
              go(0);
            }}
          >
            Clear my resume, profile and matches
          </button>
        </p>
      ) : null}
    </div>
  );
}

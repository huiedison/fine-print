"use client";

import type { Country, Facts } from "@/lib/profile";

const PILL = "min-h-11 rounded-full border px-4 py-2 text-sm";
const ON = "border-ink bg-ink text-white";
const OFF = "border-line bg-card hover:border-ink";

export function Pick<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { v: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  label?: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button key={o.v} type="button" aria-pressed={on} onClick={() => onChange(on ? undefined : o.v)} className={`${PILL} ${on ? ON : OFF}`}>
            {on ? <span aria-hidden="true">✓ </span> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PickMany<T extends string>({
  options,
  values,
  onChange,
  label,
}: {
  options: readonly { v: T; label: string }[];
  values: T[];
  onChange: (v: T[]) => void;
  label?: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = values.includes(o.v);
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((x) => x !== o.v) : [...values, o.v])}
            className={`${PILL} ${on ? ON : OFF}`}
          >
            {on ? <span aria-hidden="true">✓ </span> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const Q = "text-[15px] font-semibold";
const HINT = "text-sm text-ink-2";

/** The questions only the person can answer. Nothing here is filled in from a resume. */
export default function FactsForm({ facts, set, full }: { facts: Facts; set: (patch: Partial<Facts>) => void; full: boolean }) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className={Q}>Can you work in the U.S.?</legend>
        <p className={HINT}>Asked directly. A resume address or school does not tell us.</p>
        <Pick
          value={facts.workAuth}
          onChange={(v) => set({ workAuth: v })}
          options={[
            { v: "citizen", label: "I’m a U.S. citizen" },
            { v: "pr", label: "I have a green card" },
            { v: "other_no_sponsor", label: "Yes, without sponsorship" },
            { v: "needs_sponsor", label: "I’d need sponsorship" },
          ]}
        />
      </fieldset>

      <fieldset>
        <legend className={Q}>Are you enrolled in school right now?</legend>
        <Pick
          value={facts.enrolled}
          onChange={(v) => set({ enrolled: v, ...(v === "yes" ? {} : { returning: undefined }) })}
          options={[
            { v: "yes", label: "Yes" },
            { v: "no", label: "No" },
          ]}
        />
      </fieldset>

      {facts.enrolled === "yes" ? (
        <fieldset>
          <legend className={Q}>After an internship, will you go back to school?</legend>
          <p className={HINT}>Some internships require it.</p>
          <Pick
            value={facts.returning}
            onChange={(v) => set({ returning: v })}
            options={[
              { v: "yes", label: "Yes" },
              { v: "no", label: "No" },
            ]}
          />
        </fieldset>
      ) : null}

      <div>
        <label htmlFor="grad" className={Q}>
          When do you graduate?
        </label>
        <p className={HINT}>Use the month you finished if you already have.</p>
        <input
          id="grad"
          type="month"
          value={facts.gradMonth ?? ""}
          onChange={(e) => set({ gradMonth: e.target.value || undefined })}
          className="mt-2 block min-h-11 rounded-full border border-line bg-card px-4"
        />
      </div>

      {full ? (
        <>
          <fieldset>
            <legend className={Q}>Your highest degree, finished or in progress</legend>
            <Pick
              value={facts.degree}
              onChange={(v) => set({ degree: v })}
              options={[
                { v: "associate", label: "Associate" },
                { v: "bachelor", label: "Bachelor’s" },
                { v: "master", label: "Master’s" },
                { v: "phd", label: "Ph.D." },
              ]}
            />
            {facts.degree ? (
              <Pick
                label="Degree status"
                value={facts.degreeStatus}
                onChange={(v) => set({ degreeStatus: v })}
                options={[
                  { v: "in_progress", label: "In progress" },
                  { v: "completed", label: "Completed" },
                ]}
              />
            ) : null}
          </fieldset>
          <div>
            <label htmlFor="years" className={Q}>
              Years of full-time work
            </label>
            <p className={HINT}>Leave blank if you’d rather not say. Internships don’t count here.</p>
            <input
              id="years"
              type="number"
              min={0}
              max={60}
              step={0.5}
              inputMode="decimal"
              value={facts.yearsFullTime ?? ""}
              onChange={(e) => set({ yearsFullTime: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
              className="mt-2 block min-h-11 w-28 rounded-full border border-line bg-card px-4"
            />
          </div>
        </>
      ) : null}

      <fieldset>
        <legend className={Q}>Which countries can you work in?</legend>
        <p className={HINT}>Pick every one that works for you.</p>
        <PickMany<Country>
          values={facts.countries ?? []}
          onChange={(v) => set({ countries: v.length ? v : undefined })}
          options={[
            { v: "US", label: "United States" },
            { v: "CA", label: "Canada" },
            { v: "other", label: "Somewhere else" },
          ]}
        />
        <p className={`mt-4 ${Q}`}>Can you work in person or move for a job?</p>
        <Pick
          label="In person"
          value={facts.inPerson}
          onChange={(v) => set({ inPerson: v })}
          options={[
            { v: "yes", label: "Yes" },
            { v: "no", label: "No, remote only" },
          ]}
        />
      </fieldset>
    </div>
  );
}

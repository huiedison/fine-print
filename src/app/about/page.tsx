import type { Metadata } from "next";
import Link from "next/link";
import { MEASURED_ON, parseShare, summary } from "@/lib/audit";

export const metadata: Metadata = {
  title: "About fine_print",
  description: "Why Edison Hui built fine_print, and what it does and does not do.",
};

// Shown only in development. Facts here are unconfirmed and must not be published
// until Edison fills them in (assumption A1 in DECISIONS.md).
const DRAFT_NOTES = [
  "A real application story: one listing you spent time on before finding a line that ruled you out. Company can stay unnamed.",
  "Your own work authorization, if you want to say it. Until then the page uses a labeled example profile, not you.",
  "Whether you want the counts below re-run against your real profile.",
  "How you want to be contacted (email or LinkedIn).",
];

export default function AboutPage() {
  const conflict = parseShare(summary.example_profile_roles_with_a_conflict);
  const silent = parseShare(summary.measures.silent_on_work_auth);
  const pay = parseShare(summary.measures.pay_null_with_band_in_text);
  return (
    <article className="rounded-[28px] border border-line bg-card p-6 sm:p-9">
      <p className="micro text-ink-3">about</p>
      <h1 className="mt-3 text-[36px] font-black lowercase leading-[0.95] tracking-[-0.035em] sm:text-[56px]">
        why i built this_
      </h1>
      <div className="mt-6 max-w-xl space-y-4 text-[17px] leading-relaxed">
        <p>
          I&apos;m Edison Hui. I&apos;m a fourth-year Economics and Statistics student at UBC, graduating in December
          2027. I work as an AI integration analyst at BCI, and I co-founded Photon Collective and Assurefi.
        </p>
        <p>
          Applying for internships means reading a lot of listings. The line that decides whether you can apply at all
          is often near the bottom: a citizenship rule, a graduation window, a note that you must return to school
          afterwards. The board&apos;s filters do not carry those lines, so you find them after you have already
          started.
        </p>
        <p>
          fine_print reads the listing and puts those lines at the top, quoted word for word. If a listing says nothing
          about something, it tells you that, and it does not guess.
        </p>
        <h2 className="pt-2 text-[22px] font-black tracking-[-0.02em]">What I measured</h2>
        <p>
          On {MEASURED_ON} I read {summary.roles_read} early-career roles drawn at random from the speedrun board.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>
              {silent.count} of {silent.of}
            </strong>{" "}
            ({silent.pct}) say nothing at all about work authorization.
          </li>
          <li>
            <strong>
              {pay.count} of {pay.of}
            </strong>{" "}
            ({pay.pct}) roles with an empty pay field have pay written in the description.
          </li>
          <li>
            For an example student who would need sponsorship and graduates in December 2027,{" "}
            <strong>
              {conflict.count} of {conflict.of}
            </strong>{" "}
            ({conflict.pct}) roles have at least one stated requirement that profile conflicts with. That is an example
            profile, not a real person.
          </li>
        </ul>
        <p>
          The full counts, how they were checked and where the tool gets it wrong are on the{" "}
          <Link href="/audit" className="font-semibold text-accent underline underline-offset-4">
            measured results page
          </Link>
          .
        </p>
        <h2 className="pt-2 text-[22px] font-black tracking-[-0.02em]">What it will not do</h2>
        <p>
          It does not apply for you, score your fit, read your resume or call any job fake. It is not legal or
          immigration advice. It quotes what employers wrote, and it can miss or misread a line, so read the original
          before you decide.
        </p>
        <p>
          fine_print is unofficial. It reads public listings from the{" "}
          <a
            href="https://speedrun-talent-network.com"
            target="_blank"
            rel="noopener"
            className="font-semibold text-accent underline underline-offset-4"
          >
            speedrun talent network
          </a>
          , which is where you should go to join and apply.
        </p>
      </div>

      {process.env.NODE_ENV !== "production" ? (
        <aside className="mt-8 rounded-2xl border-2 border-dashed border-ink p-4">
          <p className="micro text-ink-3">draft notes · visible in development only</p>
          <p className="mt-2 text-[15px] font-semibold">Edison to confirm or add before this page goes public:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-2">
            {DRAFT_NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </article>
  );
}

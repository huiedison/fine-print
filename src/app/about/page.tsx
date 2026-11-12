import type { Metadata } from "next";
import Link from "next/link";
import { MEASURED_ON, parseShare, summary } from "@/lib/audit";

export const metadata: Metadata = {
  title: "About fine_print",
  description: "Why Edison Hui built fine_print, and what it does and does not do.",
};

const LINK = "font-semibold text-accent underline underline-offset-4";

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
          I&apos;m Edison Hui. I study Economics and Statistics at UBC and graduate in December 2027. I&apos;m a product
          manager at BCI, where I work on AI integrations, and I co-founded Photon Collective.
        </p>
        <p>
          I&apos;ve read a lot of internship listings. The line that decides whether I can apply is usually near the
          bottom: a citizenship rule, a graduation window, a note that you have to go back to school afterwards. The
          board can&apos;t filter on any of that, so I find out after I&apos;ve started the application.
        </p>
        <p>
          fine_print reads the listing first and shows me those lines, quoted word for word. When a listing says
          nothing about something, it says so.
        </p>

        <h2 className="pt-2 text-[22px] font-black tracking-[-0.02em]">What I measured</h2>
        <p>
          On {MEASURED_ON} I pulled {summary.drawn} early-career roles at random from the speedrun board.{" "}
          {summary.roles_read} of them had text to read.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>
              {silent.count} of {silent.of}
            </strong>{" "}
            ({silent.pct}) say nothing about work authorization.
          </li>
          <li>
            <strong>
              {pay.count} of {pay.of}
            </strong>{" "}
            ({pay.pct}) roles with an empty pay field have the pay written in the description.
          </li>
          <li>
            Take an example student who would need sponsorship and graduates in December 2027.{" "}
            <strong>
              {conflict.count} of {conflict.of}
            </strong>{" "}
            ({conflict.pct}) roles have at least one stated requirement that student does not meet.
          </li>
        </ul>
        <p>
          The rest of the numbers, and the mistakes the tool makes, are on the{" "}
          <Link href="/audit" className={LINK}>
            results page
          </Link>
          .
        </p>

        <h2 className="pt-2 text-[22px] font-black tracking-[-0.02em]">What it won&apos;t do</h2>
        <p>
          It won&apos;t apply for you, rewrite your resume or call a job fake. If you upload a resume, it is read in your browser and never sent anywhere. The match labels describe overlap with a listing, not your odds of getting it. It isn&apos;t legal or
          immigration advice. It quotes what the employer wrote and it gets some lines wrong, so read the original
          listing before you decide.
        </p>
        <p>
          fine_print is unofficial. The listings come from the{" "}
          <a href="https://speedrun-talent-network.com" target="_blank" rel="noopener" className={LINK}>
            speedrun talent network
          </a>
          , and that is where you join and apply.
        </p>

        <h2 className="pt-2 text-[22px] font-black tracking-[-0.02em]">Say hi</h2>
        <p>
          I&apos;m on{" "}
          <a href="https://www.linkedin.com/in/edison-h/" target="_blank" rel="noopener" className={LINK}>
            LinkedIn
          </a>{" "}
          and{" "}
          <a href="https://github.com/huiedison" target="_blank" rel="noopener" className={LINK}>
            GitHub
          </a>
          .
        </p>
      </div>
    </article>
  );
}

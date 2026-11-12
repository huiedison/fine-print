import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "fine_print: see the requirements before you apply",
  description:
    "Paste a speedrun talent network job link. fine_print reads the listing and quotes the lines about work authorization, school status, experience, place and pay.",
};

export const viewport: Viewport = { themeColor: "#eceae5" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <header className="sticky top-3 z-40 mx-auto mt-3 w-full max-w-3xl px-4">
          <nav
            aria-label="Main"
            className="flex items-center justify-between rounded-full border border-line bg-card/90 px-4 py-2 shadow-sm backdrop-blur"
          >
            {/* A full reload is intended here: it clears the current result. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="text-[17px] font-extrabold tracking-tight">
              fine_print
            </a>
            <span className="flex items-center gap-1">
              <Link href="/audit" className="micro rounded-full px-3 py-2 hover:bg-canvas">
                results
              </Link>
              <Link href="/about" className="micro rounded-full px-3 py-2 hover:bg-canvas">
                about
              </Link>
            </span>
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-3xl px-4 pb-10 text-sm text-ink-2">
          <p>
            fine_print quotes what a listing says. It is unofficial and not affiliated with a16z speedrun, and it is not
            legal or immigration advice. Always read the original listing.
          </p>
        </footer>
      </body>
    </html>
  );
}

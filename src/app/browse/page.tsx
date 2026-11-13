import type { Metadata } from "next";
import Finder from "@/components/Finder";

export const metadata: Metadata = {
  title: "Check a listing or browse the board: fine_print",
  description: "Paste a speedrun job link, or browse live early-career roles, and see the lines that rule you in or out.",
};

export default function BrowsePage() {
  return <Finder />;
}

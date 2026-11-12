import { evaluation, summary } from "@/lib/audit";

export async function GET() {
  return Response.json(
    {
      measured_on: summary.measured_on,
      extractor_version: summary.extractor_version,
      source: "speedrun talent network API, https://speedrun-talent-network.com/api/v1",
      sample: {
        frame: summary.frame,
        frame_total: summary.frame_total,
        seed: summary.seed,
        drawn: summary.drawn,
        closed: summary.closed,
        no_description: summary.no_description,
        roles_read: summary.roles_read,
        by_level: summary.by_level,
        employers: summary.employers,
        top_employer_share: summary.top_employer_share,
        top5_employer_share: summary.top5_employer_share,
        same_company_and_title_duplicates: summary.same_company_and_title_duplicates,
      },
      measures: summary.measures,
      by_level_eligibility: summary.by_level_eligibility,
      evaluation,
      notes: [
        "Each measure is a string of count/denominator (percent).",
        "Measures come from pattern rules and inherit the error rates in evaluation.",
        "The review was done by an AI assistant and has not yet been re-checked by a person.",
      ],
    },
    { headers: { "access-control-allow-origin": "*", "cache-control": "public, s-maxage=3600" } },
  );
}

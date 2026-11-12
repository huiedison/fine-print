import type { NextRequest } from "next/server";
import { getReading, parseJobInput } from "@/lib/speedrun";

const HEADERS = {
  "access-control-allow-origin": "*",
  "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/v1/gates/[jobId]">) {
  const { jobId } = await ctx.params;
  const parsed = parseJobInput(decodeURIComponent(jobId));
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, message: "Pass a speedrun job id, 8-character id prefix, or canonical slug." },
      { status: 400, headers: HEADERS },
    );
  }
  const result = await getReading(parsed.key);
  if (!result.ok) {
    return Response.json(
      {
        error: result.error,
        message:
          result.error === "not_found"
            ? "No role with that id on the speedrun board."
            : result.error === "rate_limited"
              ? "The speedrun API is rate limiting requests right now. Try again in about ten seconds."
              : "The speedrun API did not answer. Try again in a minute.",
      },
      {
        status: result.error === "not_found" ? 404 : result.error === "rate_limited" ? 503 : 502,
        headers: { ...HEADERS, "cache-control": "no-store", ...(result.error === "rate_limited" ? { "retry-after": "10" } : {}) },
      },
    );
  }
  return Response.json(
    {
      ...result.reading,
      notes: [
        "Quotes are verbatim substrings of the listing's description_text; start and end are character offsets into it.",
        "A gate in silent_gates means the listing does not say. That is not a pass or a fail.",
        "This is a reading of the listing's own words, not legal or immigration advice.",
      ],
    },
    { headers: HEADERS },
  );
}

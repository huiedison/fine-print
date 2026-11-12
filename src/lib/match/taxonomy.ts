// A small, hand-written vocabulary shared by the resume reader and the listing reader.
// "tool" items are named skills (Python, Excel). "work" items are kinds of work that
// transfer between roles (coordinating stakeholders, improving a process). Matching is
// by pattern, so the list is deliberately conservative and will miss things.

export interface Term {
  id: string;
  name: string;
  kind: "tool" | "work";
  re: RegExp;
}

const tool = (name: string, pattern?: string, flags = "i"): Term => ({
  id: `tool:${name.toLowerCase().replace(/[^a-z0-9+#.]+/g, "-")}`,
  name,
  kind: "tool",
  re: new RegExp(pattern ?? `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, flags),
});
const work = (id: string, name: string, pattern: string): Term => ({ id: `work:${id}`, name, kind: "work", re: new RegExp(pattern, "i") });

export const TERMS: Term[] = [
  // languages
  tool("Python"),
  tool("SQL", String.raw`\b(SQL|PostgreSQL|MySQL|Postgres|T-SQL)\b`),
  tool("R", String.raw`(^|[\s,(/])R(?=\s*[,;)/]|\s+(programming|Studio|and\b|\()|\s*$)|\bRStudio\b`, ""),
  tool("Java", String.raw`\bJava\b(?!\s?Script)`),
  tool("JavaScript", String.raw`\b(JavaScript|ES6)\b`),
  tool("TypeScript"),
  tool("C++", String.raw`\bC\+\+`),
  tool("C#", String.raw`\bC#`),
  tool("Go", String.raw`\bGolang\b|\bGo\b(?=\s*[,;)/]|\s+(and|programming)\b)`, ""),
  tool("Rust", String.raw`\bRust\b`, ""),
  tool("Swift", String.raw`\bSwift(UI)?\b`, ""),
  tool("Kotlin"),
  tool("MATLAB"),
  tool("HTML/CSS", String.raw`\b(HTML5?|CSS3?)\b`),
  // frameworks and platforms
  tool("React", String.raw`\bReact(\.js| Native)?\b`),
  tool("Next.js", String.raw`\bNext\.?js\b`),
  tool("Node.js", String.raw`\bNode(\.js)?\b`, ""),
  tool("Django"),
  tool("Flask", String.raw`\b(Flask|FastAPI)\b`),
  tool("AWS", String.raw`\b(AWS|Amazon Web Services|EC2|S3|Lambda)\b`, ""),
  tool("Google Cloud", String.raw`\b(GCP|Google Cloud)\b`),
  tool("Azure", String.raw`\bAzure\b`),
  tool("Docker"),
  tool("Kubernetes", String.raw`\b(Kubernetes|K8s)\b`),
  tool("Git", String.raw`\bGit(Hub|Lab)?\b`),
  tool("Linux", String.raw`\b(Linux|Unix|Bash)\b`),
  tool("REST APIs", String.raw`\b(REST(ful)?|GraphQL)\b|\bAPIs?\b`, ""),
  tool("CI/CD", String.raw`\bCI\s?/\s?CD\b`),
  // data
  tool("Excel", String.raw`\bExcel\b|\bspreadsheets?\b|\bGoogle Sheets\b|\bVLOOKUP\b|\bpivot tables?\b`),
  tool("Tableau", String.raw`\b(Tableau|Power\s?BI|Looker)\b`),
  tool("pandas", String.raw`\b(pandas|NumPy)\b`),
  tool("Spark", String.raw`\b(Spark|Hadoop|Databricks)\b`, ""),
  tool("Snowflake", String.raw`\b(Snowflake|BigQuery|Redshift)\b`),
  tool("Statistics", String.raw`\b(statistic(s|al)|regression|econometrics|hypothesis test(s|ing)?|A/B test(s|ing)?)\b`),
  tool("Stata", String.raw`\b(Stata|SAS|SPSS)\b`, ""),
  tool("Machine learning", String.raw`\bmachine learning\b|\bML\b|\bdeep learning\b|\b(PyTorch|TensorFlow|scikit-learn)\b`, ""),
  tool("LLMs", String.raw`\b(LLMs?|large language models?|prompt engineering|generative AI|GenAI|RAG)\b`),
  // design and product
  tool("Figma", String.raw`\b(Figma|Sketch|Adobe XD)\b`, ""),
  tool("Adobe Creative Suite", String.raw`\b(Photoshop|Illustrator|InDesign|Premiere|After Effects)\b`),
  tool("Jira", String.raw`\b(Jira|Asana|Linear|Trello)\b`, ""),
  tool("Notion", String.raw`\b(Notion|Airtable|Confluence)\b`, ""),
  // go-to-market
  tool("Salesforce", String.raw`\b(Salesforce|HubSpot)\b|\bCRM\b`, ""),
  tool("Sales tools", String.raw`\b(Clay|Apollo|Outreach\.io|Salesloft|ZoomInfo|LinkedIn Sales Navigator)\b`, ""),
  tool("Google Analytics", String.raw`\b(Google Analytics|GA4|Mixpanel|Amplitude)\b`),
  tool("SEO", String.raw`\b(SEO|SEM)\b`, ""),
  tool("Zapier", String.raw`\b(Zapier|Make\.com|n8n)\b`),
  // finance
  tool("Financial modeling", String.raw`\b(financial model(s|ing|ling)?|DCF|valuation|LBO)\b`),
  tool("Accounting", String.raw`\b(accounting|bookkeeping|QuickBooks|GAAP|accounts (payable|receivable))\b`),
  tool("Bloomberg", String.raw`\b(Bloomberg|FactSet|Capital IQ)\b`),
  // hardware
  tool("CAD", String.raw`\b(CAD|SolidWorks|AutoCAD|Fusion 360|CATIA|NX)\b`, ""),
  tool("Embedded systems", String.raw`\b(embedded|firmware|microcontrollers?|RTOS|FPGA|Verilog)\b`),
  tool("PCB design", String.raw`\b(PCBs?|Altium|KiCad|circuit design|schematics?)\b`),
  // kinds of work
  work("stakeholders", "Working with stakeholders", String.raw`\bstakeholders?\b|\bcross[- ]functional(ly)?\b|\bpartner(ed|ing|s)? (closely )?with\b|\bcoordinat(e|ed|es|ing) (with|across|between)\b|\bliais(e|ed|on)\b|\bcollaborat(e|ed|ing) (with|across)\b`),
  work("process", "Improving a process", String.raw`\bstreamlin(e|ed|ing)\b|\bautomat(e|ed|es|ing|ion)\b|\bprocess improvements?\b|\b(improv|optimi[sz]|reduc)(e|ed|es|ing)\b[^.;]{0,60}\b(process(es)?|workflows?|efficiency|turnaround|manual|cycle time|costs?|errors?)\b|\boperational (efficiency|excellence|improvements?)\b|\bworkflows?\b`),
  work("analysis", "Analyzing data", String.raw`\banaly[sz](e|ed|es|ing)\b|\b(data )?analys[ie]s\b|\banalytics\b|\binsights\b|\bdashboards?\b|\bKPIs?\b`),
  work("projects", "Running projects", String.raw`\b(project|program) manag(e|ed|er|ement|ing)\b|\b(led|lead|leading|own(ed|ing)?|manag(e|ed|ing)|driv(e|ing)|drove)\b[^.;]{0,40}\b(projects?|launch(es)?|initiatives?|roadmaps?|timelines?|rollouts?|implementations?)\b|\bend[- ]to[- ]end\b`),
  work("communication", "Writing and presenting", String.raw`\bpresent(ed|ing|ations?)\b|\b(wrote|writing|written)\b|\bdocumentation\b|\bdraft(ed|ing)\b|\bcommunicat(e|ed|ing|ion) (clearly|findings|with)\b|\bcommunication skills\b`),
  work("customers", "Working with customers", String.raw`\b(customers?|clients?)\b[^.;]{0,40}\b(relationships?|onboard|support|success|calls?|meetings?|feedback|needs|requests?|inquiries)\b|\b(support(ed|ing)?|serv(e|ed|ing)|onboard(ed|ing)?|advis(e|ed|ing))\b[^.;]{0,30}\b(customers?|clients?)\b|\bcustomer (success|support|service|experience|facing)\b|\bclient[- ]facing\b|\baccount manag`),
  work("outreach", "Sales and outreach", String.raw`\boutreach\b|\bcold[- ](emails?|calls?|calling)\b|\bprospect(s|ing|ed)?\b|\blead generation\b|\bpipeline\b[^.;]{0,30}\b(sales|deals?|leads?)\b|\b(sales|business) development\b|\bgo[- ]to[- ]market\b|\bGTM\b|\bquota\b|\bclos(e|ed|ing) deals?\b`),
  work("research", "Research", String.raw`\b(market|user|competitive|academic|quantitative|qualitative) research\b|\bresearch(ed|ing)\b|\bliterature reviews?\b|\buser interviews?\b|\bsurveys?\b|\bexperiments?\b`),
  work("leadership", "Leading people", String.raw`\b(led|lead|leading|manag(e|ed|ing)|supervis(e|ed|ing)|mentor(ed|ing)?|train(ed|ing)|coach(ed|ing)?)\b[^.;]{0,30}\b(team|teams|people|members|interns?|students|volunteers|staff|analysts|engineers|reports)\b|\bteam lead\b|\bpeople manag`),
  work("founding", "Starting something from scratch", String.raw`\b(co-?)?found(ed|er|ing)\b|\bfrom scratch\b|\b0[- ]to[- ]1\b|\bzero to one\b|\blaunched\b|\bentrepreneur`),
  work("product", "Product work", String.raw`\bproduct (manag(er|ement|ing)|roadmaps?|requirements|specs?|strategy|discovery|sense)\b|\bPRDs?\b|\buser stories\b|\bprioriti[sz](e|ed|ing|ation)\b|\buser (needs|feedback|research)\b|\bfeature requests?\b`),
  work("building", "Building software", String.raw`\b(built|build|building|develop(ed|ing)?|engineer(ed|ing)?|implement(ed|ing)?|ship(ped|ping)?|deploy(ed|ing)?)\b[^.;]{0,50}\b(apps?|applications?|software|features?|APIs?|services?|tools?|platforms?|pipelines?|systems?|prototypes?|models?|websites?|dashboards?|integrations?)\b|\bfull[- ]stack\b|\bback[- ]?end\b|\bfront[- ]?end\b`),
  work("ai", "Applying AI", String.raw`\b(AI|LLM|machine learning|ML)\b[^.;]{0,40}\b(integrations?|tools?|agents?|models?|workflows?|features?|products?|automation|applications?)\b|\bAI[- ](native|powered|driven|first)\b|\bagents?\b[^.;]{0,20}\b(AI|LLM)\b`),
  work("design", "Design", String.raw`\b(UX|UI|product|visual|graphic|interaction) design\b|\bwirefram(e|es|ing)\b|\b(design|UX|UI|Figma)\b[^.;]{0,30}\bprototyp(e|es|ed|ing)\b|\bdesign systems?\b|\bmockups?\b`),
  work("marketing", "Marketing", String.raw`\bmarketing\b|\bcampaigns?\b|\bsocial media\b|\bbrand(ing)?\b|\bcontent (creation|strategy|calendar)\b|\bgrowth (marketing|experiments?)\b|\bnewsletter`),
  work("operations", "Operations", String.raw`\b(business|sales|revenue|people|day[- ]to[- ]day|daily) operations\b|\boperations (team|management|manager|processes|analyst|work|role)\b|\b(run|ran|running|manag(e|ed|ing)|scal(e|ed|ing))\b[^.;]{0,20}\boperations\b|\blogistics\b|\bsupply chain\b|\binventory\b|\bprocurement\b|\bvendors?\b|\bfulfil+ment\b`),
  work("finance", "Finance work", String.raw`\bforecast(s|ed|ing)?\b|\bbudget(s|ed|ing)?\b|\bP&L\b|\bfinancial (analysis|statements?|reporting|planning)\b|\bFP&A\b|\binvestment (analysis|research|management)\b|\bportfolio (management|analysis)\b|\bdue diligence\b`),
  work("compliance", "Compliance and risk", String.raw`\bcompliance\b|\bregulat(ory|ions?)\b|\baudit(s|ed|ing)?\b|\brisk (management|assessment|analysis)\b|\bKYC\b|\bAML\b`),
  work("testing", "Testing and quality", String.raw`\btest (plans?|cases?|procedures?)\b|\b(wrote|writing|ran|running|develop(ed|ing)?|perform(ed|ing)?)\b[^.;]{0,20}\btests?\b|\bquality assurance\b|\bQA\b|\bvalidation\b|\bdebug(ged|ging)?\b|\btroubleshoot`),
  work("hardware", "Hardware and manufacturing", String.raw`\bmanufactur(e|ed|ing)\b|\bassembl(y|ed|ing)\b|\bmechanical design\b|\bfabricat(e|ed|ion)\b|\bmachining\b|\bprototype hardware\b|\btolerances?\b`),
  work("teaching", "Teaching and training", String.raw`\btutor(ed|ing)?\b|\bteaching assistant\b|\btaught\b|\binstruct(ed|or|ing)\b|\bworkshops?\b`),
  work("recruiting", "Recruiting", String.raw`\brecruit(ed|er|ing|ment)\b|\bsourc(ed|ing) candidates\b|\binterview(ed|ing) candidates\b|\btalent acquisition\b`),
];

export const TERM_BY_ID = new Map(TERMS.map((t) => [t.id, t]));

/** Every vocabulary term found in the text, with the position of the first match. */
export function termsIn(text: string): { term: Term; index: number }[] {
  const out: { term: Term; index: number }[] = [];
  for (const term of TERMS) {
    const m = term.re.exec(text);
    if (m) out.push({ term, index: m.index });
  }
  return out;
}

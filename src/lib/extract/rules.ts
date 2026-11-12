import type { Sentence } from "./segment";
import type { Gate, Requirement, Strength } from "./types";

/** What a rule hands back. The engine turns it into a Requirement with offsets. */
export interface Hit {
  kind: string;
  summary: string;
  strength?: Strength;
  value?: Requirement["value"];
  note?: string;
  /** Include the adjacent heading in the quote (for "US Hourly Range\n$40 - $55"). */
  withHeading?: boolean;
}

export interface Rule {
  id: string;
  gate: Gate;
  match: (s: Sentence, ctx: RuleContext) => Hit | null;
}

export interface RuleContext {
  isInternLike: boolean;
}

const PREFERRED_INLINE =
  /\b(preferred|a plus|is a plus|are a plus|nice[- ]to[- ]have|bonus|ideally|desired|desirable|not required|optional|a strong plus|huge plus|big plus)\b/i;
const NEGATED_REQ = /\b(not|isn['’]t|aren['’]t|no)\s+(a\s+)?(required|requirement|necessary|needed)\b|\bnot required\b/i;
const QUESTION = /\?\s*$/;

export function strengthOf(s: Sentence): Strength {
  if (PREFERRED_INLINE.test(s.text)) return "preferred";
  if (s.section === "preferred") return "preferred";
  return "required";
}

const US = String.raw`(?:U\.?\s?S\.?(?:A\.?)?|United States|American)`;

// ---------- work authorization ----------

const RE_US_PERSON = new RegExp(String.raw`\b${US}[\s-]+Persons?\b`, "i");
const RE_CITIZEN = new RegExp(String.raw`\b${US}[\s-]+citizen(?:s|ship)?\b`, "i");
const RE_PR = /\b(permanent residen(t|ts|cy|ce)|green[- ]card|permanent (work )?authori[sz]ation)\b/i;
const RE_PROTECTED = /\b(refugee|asylee|asylum|protected individual)/i;
const RE_CLEARANCE = /\b(security clearance|secret clearance|top secret|TS\/SCI|\bclearance\b)/i;
const RE_CLEARANCE_CTX = /\b(secret|TS\/SCI|security|DoD|DOD|government|public trust|U\.?S\.?)\b/i;
const RE_SPONSOR = /\bsponsor(ship|s|ing|ed)?\b/i;
const RE_SPONSOR_VISA_CTX = /\b(visas?|work authori[sz]ation|employment authori[sz]ation|immigration|H-?1B|OPT|CPT|work permit|employment)\b/i;
const RE_SPONSOR_NEG =
  /\b(not|unable|cannot|can['’]?t|won['’]?t|will not|do(es)? not|don['’]?t|doesn['’]?t|no|without|isn['’]?t|aren['’]?t|ineligible)\b[^.;]{0,120}\bsponsor|\bsponsor(ship)?\b[^.;]{0,60}\b(is|are)?\s*(not|un)\s*(available|offered|provided|supported|possible)/i;
const RE_SPONSOR_POS =
  /\b(we|will|can|able to|happy to|do|does|may)\s+(also\s+)?(sponsor|offer|provide|support)\b[^.;]{0,40}\b(visa|sponsorship|H-?1B|work authori[sz]ation|immigration)|\b(visa\s+)?sponsorship\b[^.;]{0,30}\b(is\s+)?(available|offered|provided|supported)\b|\bwe sponsor\b|\boffers?\s+(visa\s+)?sponsorship\b/i;
const RE_WORK_AUTH =
  /\b(legally\s+)?(authori[sz]ed|eligible|eligibility|right|authori[sz]ation|permitted|entitled)\s+to\s+work\s+in\s+(the\s+)?(U\.?S\.?A?\.?|United States|Canada|UK|U\.K\.|United Kingdom|EU|Europe|Germany|France|Ireland|India|Australia|Singapore|Philippines|Japan|Mexico|Netherlands|Spain|Switzerland|Hong Kong|China)(?![a-z])/i;
const RE_ITAR = /\b(ITAR|EAR\b|export[- ]control(led|s)?|International Traffic in Arms)/;

/** Country a work-authorization sentence is about, when it names one. */
function countryIn(text: string): string | null {
  if (/\b(U\.?S\.?A?\.?|United States)\b/.test(text)) return "US";
  const m = /\b(Canada|UK|U\.K\.|United Kingdom|Philippines|India|Germany|France|Ireland|Australia|Singapore|Japan|Mexico|Brazil|Netherlands|Spain|Italy|Poland|Israel|China|Switzerland|Sweden)\b/.exec(text);
  return m ? m[1] : null;
}

const workAuth: Rule[] = [
  {
    id: "auth.us_person",
    gate: "work_auth",
    match: (s) => {
      if (!RE_US_PERSON.test(s.text) || NEGATED_REQ.test(s.text)) return null;
      if (/\b(non[- ]U\.?S\.? persons?|except|licen[sc]e)\b/i.test(s.text) && !/\bmust be (a )?U\.?S\.? Person/i.test(s.text)) return null;
      return {
        kind: "us_person",
        summary: "U.S. Person status required",
        strength: strengthOf(s),
        note: "“U.S. Person” is an export-control term. It covers U.S. citizens, lawful permanent residents, and certain protected individuals such as refugees and asylees. It does not mean citizens only.",
      };
    },
  },
  {
    id: "auth.citizenship",
    gate: "work_auth",
    match: (s) => {
      if (!RE_CITIZEN.test(s.text) || NEGATED_REQ.test(s.text) || QUESTION.test(s.text)) return null;
      if (RE_US_PERSON.test(s.text)) return null; // the U.S. Person rule owns this sentence
      if (/\b(except|other than|apply to individuals|who are (\(a\) )?not|licen[sc]e)\b/i.test(s.text)) {
        return {
          kind: "export_control",
          summary: "Export-control rules apply to this role",
          strength: "info",
          note: "The listing says an export licence may be needed for people who are not U.S. citizens, permanent residents or protected individuals. It does not state a flat bar.",
        };
      }
      // needs a requirement cue so that passing mentions do not fire
      if (
        !/\b(must|require[ds]?|requirement|only|need(s|ed)? to|have to|limited to|restricted to|eligib|due to|open to|applicants?|candidates?|proof)\b/i.test(
          s.text,
        ) &&
        s.section !== "required"
      )
        return null;
      const withPr = RE_PR.test(s.text);
      if (RE_PROTECTED.test(s.text)) {
        return {
          kind: "us_person",
          summary: "U.S. citizen, permanent resident, or protected status (refugee or asylee) required",
          strength: strengthOf(s),
          note: "This list matches the export-control definition of a “U.S. Person”: citizens, lawful permanent residents, and certain protected individuals.",
        };
      }
      return {
        kind: withPr ? "citizen_or_pr" : "citizen",
        summary: withPr ? "U.S. citizenship or permanent residency required" : "U.S. citizenship required",
        strength: strengthOf(s),
      };
    },
  },
  {
    id: "auth.clearance",
    gate: "work_auth",
    match: (s) => {
      if (!RE_CLEARANCE.test(s.text) || QUESTION.test(s.text)) return null;
      if (!RE_CLEARANCE_CTX.test(s.text)) return null;
      if (/\b(ground|height|overhead|customs)\s+clearance\b/i.test(s.text)) return null;
      if (!/\b(eligib|obtain|maintain|require[ds]?|must|active|current|ability|able|hold|possess|willing|subject to|needed)\b/i.test(s.text)) return null;
      const active = /\b(active|current|existing|hold|possess|maintain an active|must have)\b[^.;]{0,60}\bclearance/i.test(s.text);
      // "eligible to obtain ... an active clearance" is eligibility; "active clearance ... and eligibility for crossover" is not
      const iActive = s.text.search(/\b(active|current)\b/i);
      const iElig = s.text.search(/\b(eligib|ability to obtain|able to obtain|obtain)/i);
      const holdsNow = active && (iElig < 0 || (iActive >= 0 && iActive < iElig));
      const maybe = /\bmay be required\b|\bdepending on\b|\bsome (roles|positions|programs)\b/i.test(s.text);
      const strength = maybe ? "info" : strengthOf(s);
      return {
        kind: holdsNow ? "clearance_active" : "clearance_eligible",
        summary:
          strength === "info"
            ? "Security clearance may be required"
            : holdsNow
              ? "Active U.S. security clearance required"
              : "Must be eligible for a U.S. security clearance",
        strength,
        note: "Clearance eligibility is a separate requirement from work authorization. fine_print reports it and does not judge it.",
      };
    },
  },
  {
    id: "auth.no_sponsorship",
    gate: "work_auth",
    match: (s) => {
      if (!RE_SPONSOR.test(s.text) || QUESTION.test(s.text)) return null;
      if (!RE_SPONSOR_NEG.test(s.text)) return null;
      if (!RE_SPONSOR_VISA_CTX.test(s.text) && !/\bsponsorship\b/i.test(s.text)) return null;
      const country = countryIn(s.text);
      const h1bOnly = /\bnew H-?1B\b/i.test(s.text);
      return {
        kind: "no_sponsorship",
        summary: h1bOnly ? "No new H-1B sponsorship for this role" : "No visa sponsorship for this role",
        strength: "required",
        value: { country, h1b_only: h1bOnly },
      };
    },
  },
  {
    id: "auth.sponsorship_offered",
    gate: "work_auth",
    match: (s) => {
      if (!RE_SPONSOR.test(s.text) || QUESTION.test(s.text)) return null;
      if (RE_SPONSOR_NEG.test(s.text) || !RE_SPONSOR_POS.test(s.text)) return null;
      if (!RE_SPONSOR_VISA_CTX.test(s.text) && !/\bsponsorship\b/i.test(s.text)) return null;
      const hedged = /\b(may|case[- ]by[- ]case|certain|some|select|exceptional)\b/i.test(s.text);
      return {
        kind: "sponsorship_offered",
        summary: hedged ? "Visa sponsorship may be available" : "Visa sponsorship is available",
        strength: "info",
        value: { hedged },
      };
    },
  },
  {
    id: "auth.work_authorization",
    gate: "work_auth",
    match: (s) => {
      const m = RE_WORK_AUTH.exec(s.text);
      if (!m || QUESTION.test(s.text)) return null;
      if (RE_SPONSOR_NEG.test(s.text)) return null; // owned by no_sponsorship
      const where = m[4].replace(/\.$/, "");
      const us = /^(U\.?S|United States)/i.test(where);
      return {
        kind: "work_authorization",
        summary: `Must be authorized to work in ${us ? "the U.S." : where}`,
        strength: strengthOf(s),
        value: { country: us ? "US" : where },
        note: "The listing does not say whether sponsorship is offered.",
      };
    },
  },
  {
    id: "auth.export_control",
    gate: "work_auth",
    match: (s) => {
      if (!RE_ITAR.test(s.text)) return null;
      if (RE_US_PERSON.test(s.text) || RE_CITIZEN.test(s.text)) return null;
      if (/\bUK\b|United Kingdom/.test(s.text)) return null;
      if (!/\b(must|require[ds]?|subject to|comply|compliance|restricted|eligib|access)\b/i.test(s.text)) return null;
      if (/\b(experience|knowledge|familiar|understanding)\b[^.;]{0,40}\b(ITAR|EAR|export)/i.test(s.text)) return null;
      return {
        kind: "export_control",
        summary: "Export-control rules apply to this role",
        strength: "info",
        note: "Export-control rules often limit a role to U.S. Persons. This sentence does not say so outright.",
      };
    },
  },
];

// ---------- school status ----------

const DEGREE_WORDS = String.raw`(?:bachelor|master|ph\.?\s?d|doctora|undergraduate|graduate|degree|B\.?S\.?|M\.?S\.?|B\.?A\.?|MBA|JD|university|college|program|student)`;
const RE_ENROLLED = new RegExp(
  String.raw`\b(currently\s+)?(enrolled|pursuing|working towards?|studying|in pursuit of|matriculated)\b[^.;]{0,90}${DEGREE_WORDS}|\bcurrent(ly)?\s+(a\s+)?(student|undergraduate|graduate student|sophomore|junior|senior)\b|\b(rising|current)\s+(sophomores?|juniors?|seniors?)\b`,
  "i",
);
const RE_RETURN = /\breturn(ing)?\s+to\s+(school|university|college|campus|(your|their|a)\s+(studies|program|degree|academic))|\bcontinu(e|ing)\s+(your|their)?\s*(academic\s+)?(studies|education|enrollment)\b[^.;]{0,60}\b(after|following|at the end)/i;
const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12, winter: 1, spring: 5, summer: 8, fall: 12, autumn: 12,
};
const RE_GRAD = /\b(graduating|graduation|(will|to|expect(ed|ing)? to|plan(s|ning)? (to|on)) graduat(e|ing)|graduates? (in|by|between|before|after|no (earlier|later))|degree (completion|conferral)|class of)\b/i;
const RE_DATE_TOKEN =
  /\b(?:(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|winter|spring|summer|fall|autumn)\.?\s+(?:of\s+)?)?(20[2-3]\d)\b/gi;

export function degreeLevels(t: string): string[] {
  const out: string[] = [];
  if (/\b(bachelor|undergraduate|B\.?S\.?c?\b|B\.?A\.?\b|BS\/|sophomore|junior|senior)/i.test(t)) out.push("bachelor");
  if (/\b(master|M\.?S\.?c?\b|M\.?Eng|MBA|graduate student|graduate degree|\/MS\b)/i.test(t)) out.push("master");
  if (/\b(ph\.?\s?d|doctora)/i.test(t)) out.push("phd");
  return out;
}

const school: Rule[] = [
  {
    id: "school.enrolled",
    gate: "school",
    match: (s, ctx) => {
      if (!RE_ENROLLED.test(s.text) || QUESTION.test(s.text)) return null;
      if (/\b(you will|you['’]ll)\s+(be\s+)?(pursuing|completing|working)\b/i.test(s.text)) return null;
      if (/\b(don['’]t|do not|not|aren['’]t|needn['’]t|no need)\b[^.;]{0,60}\b(enrolled|pursuing|working towards?|studying)\b/i.test(s.text)) return null;
      // outside internships this phrasing is usually an alternative ("degree or currently pursuing")
      const levels = degreeLevels(s.text);
      const alt = /\b(or equivalent|or recent(ly)? graduat|recent(ly)? graduat(es?|ed)|or have (recently )?(completed|graduated)|have (recently )?(completed|earned|obtained)|completed or)\b/i.test(s.text);
      if (!ctx.isInternLike && !/\b(must|required|currently enrolled)\b/i.test(s.text)) return null;
      const names = levels.map((l) => (l === "phd" ? "Ph.D." : l === "master" ? "master's" : "bachelor's"));
      return {
        kind: "enrolled",
        summary: alt
          ? "Current students or recent graduates"
          : names.length
            ? `Must be a current student (${names.join(" or ")})`
            : "Must be a current student",
        strength: alt ? "alternative" : strengthOf(s),
        value: { levels },
      };
    },
  },
  {
    id: "school.return_to_school",
    gate: "school",
    match: (s) => {
      if (!RE_RETURN.test(s.text) || QUESTION.test(s.text)) return null;
      return {
        kind: "return_to_school",
        summary: "Must return to school after the internship",
        strength: strengthOf(s),
      };
    },
  },
  {
    id: "school.grad_window",
    gate: "school",
    match: (s) => {
      if (!RE_GRAD.test(s.text) || QUESTION.test(s.text)) return null;
      // dates are encoded as year * 100 + month; month 0 means only a year was given
      const dates: number[] = [];
      let vague = /\b(as of|ceremony|quarter|Q[1-4])\b/i.test(s.text) || /[éèêàçû]/.test(s.text);
      for (const m of s.text.matchAll(RE_DATE_TOKEN)) {
        const word = m[1]?.toLowerCase();
        if (word === "winter") vague = true; // winter can mean either end of a year
        dates.push(Number(m[2]) * 100 + (word ? MONTHS[word] : 0));
      }
      if (!dates.length) return null;
      if (/\b(we|company|founded|batch|YC|Y Combinator)\b[^.;]{0,30}\bgraduat/i.test(s.text)) return null;
      const lo = Math.min(...dates);
      const hi = Math.max(...dates);
      const fmt = (d: number, end: boolean) => {
        const y = Math.floor(d / 100);
        const mo = d % 100 || (end ? 12 : 1);
        return `${y}-${String(mo).padStart(2, "0")}`;
      };
      const yearsOnly = dates.every((d) => d % 100 === 0);
      if (/20\d\d\s+or\b|\bor\s+(a\s+)?(recent\s+)?([a-z]+\s+)?20\d\d/i.test(s.text) && !yearsOnly) vague = true;
      const single = dates.length === 1;
      const afterOnly = single && /\b(after|no earlier than|on or after|or later)\b/i.test(s.text);
      const beforeOnly = single && /\b(by|before|no later than|on or before|prior to|or earlier)\b/i.test(s.text);
      return {
        kind: "grad_window",
        summary: "States a graduation window",
        strength: strengthOf(s),
        value: {
          from: beforeOnly ? null : fmt(lo, false),
          to: afterOnly ? null : fmt(hi, true),
          clean: !vague,
        },
      };
    },
  },
];

// ---------- experience and degree floor ----------

const RE_YEARS =
  /(?<![\d$.,])(\d{1,2})\s*(\+|plus)?\s*(?:(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*)?(?:years?|yrs?)\b(?!\s*(ago|old|of age))/i;
const RE_PHD = /\b(ph\.?\s?d\.?|doctorate|doctoral degree)(?![a-z])/i;
const RE_PHD_ALT =
  /\b(bachelor|master|B\.?S\.?\b|M\.?S\.?\b|B\.?A\.?\b|BS\/|MS\/|undergraduate|Pharm\.?\s?D|\bM\.?D\b|\bJ\.?D\b|or equivalent|equivalent (practical |industry |research |work )?experience|or (related|relevant|comparable|commensurate) (work |industry |professional |research )?experience)/i;

const experience: Rule[] = [
  {
    id: "exp.years",
    gate: "experience",
    match: (s): Hit | null => {
      const m = RE_YEARS.exec(s.text);
      if (!m || QUESTION.test(s.text)) return null;
      if (!/\b(experience|experienced|background|track record|working|work(ed)?|industry|professional|hands[- ]on|in (a|an) |as (a|an) |building|developing|managing|leading|writing|designing)\b/i.test(s.text)) return null;
      // company history, tenure perks, age rules and programme lengths are not experience floors
      if (
        /\b(over the (last|past|next)|in the (last|past|next)|for (over|more than|nearly|the past|the last)|founded|since \d{4}|vesting|vest|cliff|every \d|anniversar|at least 18|year[- ]old|warranty|contract|program(me)?\b[^.;]{0,20}\byears?|within \d|after \d|first \d|next \d|in business|our \d|[\d]+ years of (history|growth|operation))/i.test(
          s.text,
        )
      )
        return null;
      if (/\b(we|we['’]ve|company|team|firm|founders?)\s+(has|have|had|brings?|with)\b[^.;]{0,40}\d+\+?\s*years/i.test(s.text)) return null;
      const min = Number(m[1]);
      const max = m[3] ? Number(m[3]) : null;
      if (min > 25) return null;
      if (/\b(employees|associates|team members|people) have (stayed|been)|\bstayed for\b|\btenure\b/i.test(s.text)) return null;
      if (/\b(apprenticeships?|years? of (stud(y|ies)|coursework|college|school|university|undergraduate)|completed (at least )?\d+ years)\b/i.test(s.text)) return null;
      if (min === 0 && max) {
        return { kind: "years_max", summary: `Aimed at people with 0 to ${max} years of experience`, strength: "info", value: { max } };
      }
      const upTo = /\b(up to|less than|under|fewer than|no more than|0\s*(-|–|to)\s*\d)\b/i.test(s.text.slice(0, m.index + m[0].length));
      if (upTo && !max) {
        return {
          kind: "years_max",
          summary: `Aimed at people with up to ${min} years of experience`,
          strength: "info",
          value: { max: min },
        };
      }
      const soft = /\b(or (an )?equivalent|typically|in lieu of|or (related|relevant|comparable) (education|training))\b/i.test(s.text);
      return {
        kind: "years",
        summary: max ? `${min} to ${max} years of experience` : `${min}+ years of experience`,
        strength: strengthOf(s) === "preferred" ? "preferred" : soft ? "alternative" : "required",
        value: { min, max },
      };
    },
  },
  {
    id: "exp.phd",
    gate: "experience",
    match: (s, ctx) => {
      if (!RE_PHD.test(s.text) || QUESTION.test(s.text)) return null;
      // "pursuing a Ph.D." on an internship is an enrollment statement, handled by school.enrolled
      if (/\b(pursuing|enrolled|candidate|student|working towards?|completing)\b/i.test(s.text) && ctx.isInternLike) return null;
      // company copy ("our team of PhDs") is not a requirement
      if (/\b(our|team of|led by|founded by|alongside|work with|join)\b[^.;]{0,40}\bph\.?\s?d/i.test(s.text) && s.section !== "required") return null;
      // founder and team bios are written in the third person
      if (/\b(his|her|he|she|earned|co-?founders?|founded|CEO|CTO|our team)\b/i.test(s.text)) return null;
      if (!/\b(require[ds]?|must|degree|holds?|have|completed|graduate|preferred|plus|bonus|ideally|background)\b|\bin [A-Z]/.test(s.text) && s.section === "neutral") return null;
      const st = strengthOf(s);
      const alt = RE_PHD_ALT.test(s.text);
      return {
        kind: "degree_phd",
        summary:
          st === "preferred" ? "Ph.D. preferred" : alt ? "Ph.D. listed as one of several accepted options" : "Ph.D. required",
        strength: st === "preferred" ? "preferred" : alt ? "alternative" : "required",
      };
    },
  },
];

// ---------- place and time ----------

const RE_DAYS = /\b(\d|one|two|three|four|five)\s*(?:(?:-|–|—|to|or)\s*(\d|one|two|three|four|five)\s*)?days?\s*(?:a|per|\/|each|every|in the|in|on[- ]site|onsite)\s*(?:week|office)?/i;
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const RE_OFFICE = /\b(in[- ]person|in[- ]office|on[- ]?site|office|HQ|headquarters)\b/i;
const RE_REMOTE = /\b(remote[- ]first|fully[- ]remote|100%\s+remote|remote[- ]friendly|(role|position|job|internship|opportunity) is (fully |100% )?remote|remote (role|position|opportunity|internship)|work from anywhere)\b/i;
const RE_ONSITE_ROLE =
  /\b((role|position|job|internship|opportunity)\s+(is|will be)\s+(a\s+)?(fully\s+|100%\s+)?(on[- ]?site|in[- ]person|in[- ]office|hybrid)|(on[- ]?site|in[- ]person|in[- ]office|hybrid)\s+(role|position|internship|opportunity)|work(ing)? (in[- ]person|on[- ]?site|from (our|the) [^.;]{0,30}office)|(must|required to|expected to|need to|able to|ability to)\b[^.;]{0,50}\b(in[- ]person|on[- ]?site|in[- ]office|in the office|in our [^.;]{0,30}office))\b/i;
const RE_TERM = /\b(\d{1,2})\s*(?:(?:-|–|—|to)\s*(\d{1,2})\s*)?[- ]?(weeks?|months?)\b/i;
const RE_SEASON = /\b(summer|fall|autumn|winter|spring)\s+(?:of\s+)?(20[2-3]\d)\b/i;
const RE_RELOCATE = /\b(must|required to|willing(ness)? to|able to|need to|expected to)\s+relocat/i;

const placeTime: Rule[] = [
  {
    id: "place.office_days",
    gate: "place_time",
    match: (s) => {
      const m = RE_DAYS.exec(s.text);
      if (!m || !RE_OFFICE.test(s.text)) return null;
      if (/\b(PTO|vacation|holidays?|sick|leave|off)\b/i.test(s.text)) return null;
      if (/\b(home office|from home|work(ing)? remotely|remote days?|WFH)\b/i.test(s.text)) {
        return { kind: "home_days", summary: "Some days a week from home are mentioned", strength: "info" };
      }
      const n = (x: string) => NUM[x.toLowerCase()] ?? Number(x);
      const lo = n(m[1]);
      const hi = m[2] ? n(m[2]) : null;
      if (lo < 1 || lo > 7) return null;
      return {
        kind: "office_days",
        summary: hi ? `In office ${lo} to ${hi} days a week` : `In office ${lo} ${lo === 1 ? "day" : "days"} a week`,
        strength: "required",
        value: { min: lo, max: hi },
      };
    },
  },
  {
    id: "place.remote",
    gate: "place_time",
    match: (s) => {
      if (!RE_REMOTE.test(s.text)) return null;
      if (/\b(depending on|from in-office|to fully remote|or remote|remote or)\b/i.test(s.text)) return null;
      if (/\b(not|isn['’]t|no)\s+(a\s+)?(remote|eligible for remote)|\bnot\b[^.;]{0,20}\bremote/i.test(s.text)) {
        return { kind: "not_remote", summary: "Not a remote role", strength: "required" };
      }
      const companyWide = /\b(we are|we['’]re|company|across all|all positions|our team is|as a (remote|distributed))\b/i.test(s.text) &&
        !/\b(this|the)\s+(role|position|job|internship)\b/i.test(s.text);
      return {
        kind: "remote",
        summary: companyWide ? "Company describes itself as remote" : "Role described as remote",
        strength: "info",
        value: { scope: companyWide ? "company" : "role" },
        note: companyWide
          ? "This is a statement about the whole company, not this role. A role-specific location line, if there is one, takes priority."
          : undefined,
      };
    },
  },
  {
    id: "place.onsite",
    gate: "place_time",
    match: (s) => {
      if (!RE_ONSITE_ROLE.test(s.text)) return null;
      if (RE_DAYS.test(s.text)) return null; // office_days owns it
      if (RE_TERM.test(s.text) && /\bintern/i.test(s.text)) return null; // term rule owns it
      const hybrid = /\bhybrid\b/i.test(s.text);
      return {
        kind: hybrid ? "hybrid" : "onsite",
        summary: hybrid ? "Hybrid role" : "In-person work required",
        strength: strengthOf(s) === "preferred" ? "preferred" : "required",
      };
    },
  },
  {
    id: "time.term",
    gate: "place_time",
    match: (s, ctx) => {
      const season = RE_SEASON.exec(s.text);
      const term = RE_TERM.exec(s.text);
      const internish = /\b(intern(ship)?|co-?op|program|term|placement|fellowship)\b/i.test(s.text);
      if (!internish && !(ctx.isInternLike && season && /\b(start|available|availability|begin|join|dates?)\b/i.test(s.text))) return null;
      if (!season && !term) return null;
      if (term && !season && !/\b(intern(ship)?|co-?op|term|placement|fellowship)\b/i.test(s.text)) return null;
      if (term && /\b(parental|leave|notice|vesting|sabbatical|PTO|vacation|paid time)\b/i.test(s.text)) return null;
      const inPerson = /\b(in[- ]person|on[- ]?site)\b/i.test(s.text);
      const parts: string[] = [];
      if (term) parts.push(`${term[1]}${term[2] ? ` to ${term[2]}` : ""} ${term[3].replace(/s$/, "")}${term[2] || term[1] !== "1" ? "s" : ""}`);
      if (season) parts.push(`${season[1].toLowerCase()} ${season[2]}`);
      return {
        kind: "term",
        summary: `${inPerson ? "In-person term" : "Term"}: ${parts.join(", ")}`,
        strength: "info",
        value: { season: season ? `${season[1].toLowerCase()} ${season[2]}` : null, in_person: inPerson },
      };
    },
  },
  {
    id: "place.relocate",
    gate: "place_time",
    match: (s) => {
      if (!RE_RELOCATE.test(s.text)) return null;
      return { kind: "relocate", summary: "Relocation expected", strength: strengthOf(s) };
    },
  },
];

// ---------- pay found in the text ----------

const MONEY = String.raw`\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*([kK])?`;
const SEP = String.raw`\s*(?:USD|CAD)?\s*(?:-|–|—|&mdash;|&ndash;|&#8211;|&#8212;|to|and)\s*(?:USD|CAD)?\s*`;
const RE_RANGE = new RegExp(`${MONEY}(?:\\s*(?:\\/|per|an?)\\s*(?:hour|hr|year|yr|month|week))?${SEP}\\$?\\s?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)\\s*([kK])?`, "i");
const RE_SALARY_FLOOR = new RegExp(`\\b(?:base |annual(?:ized)? |starting |minimum )+(?:base )?(?:salary|pay|compensation)\\b[^.;$]{0,60}${MONEY}`, "i");
const RE_SINGLE = new RegExp(`${MONEY}\\s*(?:USD|CAD)?\\s*(?:\\/|per|an|a|each)\\s*(hour|hr|month|mo|week|wk|year|yr|annum)\\b`, "i");
const RE_PAY_CUE = /\b(salary|salaries|pay|paid|compensation|base|hourly|wage|rate|OTE|on[- ]target|stipend|earn|range|annual(ly|ized)?|per hour|\/\s?h(ou)?r)\b/i;
const RE_NOT_PAY =
  /\b(raised|funding|valuation|valued|revenue|ARR|GMV|million|billion|\$\d+(\.\d+)?\s?[MB]\b|customers|budget|reimburs|401|allowance|credit|sign[- ]on|signing|referral|learning|wellness|gym|lunch|meal|commuter|equipment|home office|transactions|assets|AUM|processed|saved|grant|prize|scholarship|tuition|relocation (bonus|stipend|package|assistance))/i;

function num(v: string, k?: string) {
  const n = Number(v.replace(/,/g, ""));
  return k ? n * 1000 : n;
}

function period(text: string, heading: string, lo: number, hi: number, explicit?: string): string | null {
  const t = `${heading} ${text}`;
  if (explicit) {
    const e = explicit.toLowerCase();
    if (e.startsWith("h")) return "hour";
    if (e.startsWith("m")) return "month";
    if (e.startsWith("w")) return "week";
    return "year";
  }
  if (/\b(hourly|per hour|an hour|\/\s?h(ou)?r|\bhr\b)/i.test(t)) return "hour";
  if (/\b(monthly|per month|a month|\/\s?mo(nth)?)\b/i.test(t)) return "month";
  if (/\b(weekly|per week|a week|\/\s?w(ee)?k)\b/i.test(t)) return "week";
  if (/\b(annual|annually|per year|a year|yearly|salary|base|OTE|\/\s?yr)\b/i.test(t) && hi >= 10000) return "year";
  if (hi >= 20000) return "year";
  if (lo >= 10 && hi <= 150) return "hour";
  return null;
}

const pay: Rule[] = [
  {
    id: "pay.range_in_text",
    gate: "pay",
    match: (s) => {
      const m = RE_RANGE.exec(s.text);
      if (!m) return null;
      const head = s.heading?.text ?? "";
      const cueInSentence = RE_PAY_CUE.test(s.text);
      const cueInHeading = RE_PAY_CUE.test(head);
      if (!cueInSentence && !cueInHeading) return null;
      let lo = num(m[1], m[2]);
      const hi = num(m[3], m[4]);
      if (!m[2] && m[4] && lo < 1000) lo *= 1000; // "$120-150k"
      if (hi < lo) return null;
      // "$20 - $30 million" is a funding figure whatever else the sentence says
      if (/^\s*(million|billion|mm\b|[MB]\b|bn\b)/i.test(s.text.slice(m.index + m[0].length))) return null;
      // funding, perks and benefit amounts are not pay bands
      const local = s.text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 40);
      if (RE_NOT_PAY.test(local) && !/\b(salary|base pay|base salary|hourly|pay range|compensation range|wage)\b/i.test(local)) return null;
      const per = period(s.text, head, lo, hi);
      if (!per) return null;
      if (per === "year" && (lo < 15000 || hi > 2000000)) return null;
      if (per === "hour" && (lo < 7 || hi > 500)) return null;
      const currency = /\bCAD\b|C\$/.test(s.text) ? "CAD" : /£/.test(s.text) ? "GBP" : "USD";
      const f = (n: number) => `$${n.toLocaleString("en-US")}`;
      return {
        kind: "pay_range",
        summary: `${f(lo)} to ${f(hi)} per ${per}`,
        strength: "info",
        value: { min: lo, max: hi, period: per, currency },
        withHeading: !cueInSentence && cueInHeading,
      };
    },
  },
  {
    id: "pay.single_in_text",
    gate: "pay",
    match: (s) => {
      if (RE_RANGE.test(s.text)) return null;
      const floor = RE_SALARY_FLOOR.exec(s.text);
      if (floor) {
        const v = num(floor[1], floor[2]);
        if (v >= 15000 && v <= 2000000 && !/^\s*(million|billion|[MB]\b)/i.test(s.text.slice(floor.index + floor[0].length))) {
          return {
            kind: "pay_single",
            summary: `$${v.toLocaleString("en-US")} per year`,
            strength: "info",
            value: { min: v, max: v, period: "year", currency: "USD" },
          };
        }
      }
      const m = RE_SINGLE.exec(s.text);
      if (!m) return null;
      const local = s.text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 40);
      if (RE_NOT_PAY.test(local) && !/\b(salary|base pay|hourly|pay|wage|compensation)\b/i.test(local)) return null;
      const v = num(m[1], m[2]);
      const per = period(s.text, "", v, v, m[3]);
      if (!per) return null;
      if (per === "hour" && (v < 7 || v > 500)) return null;
      if (per === "year" && v < 15000) return null;
      if (per === "month" && (v < 500 || v > 30000)) return null;
      if (per === "week" && (v < 200 || v > 10000)) return null;
      return {
        kind: "pay_single",
        summary: `$${v.toLocaleString("en-US")} per ${per}`,
        strength: "info",
        value: { min: v, max: v, period: per, currency: "USD" },
      };
    },
  },
];

// ---------- other terms ----------

const terms: Rule[] = [
  {
    id: "terms.trial",
    gate: "terms",
    match: (s) => {
      if (!/\b(trial period|work trial|paid trial|trial (week|day|project)|probation(ary)? period)\b/i.test(s.text)) return null;
      if (/\bfree trial\b/i.test(s.text)) return null;
      return { kind: "trial", summary: "Trial or probation period before full employment", strength: "info" };
    },
  },
  {
    id: "terms.contract_to_hire",
    gate: "terms",
    match: (s) => {
      if (!/\b(contract[- ]to[- ]hire|temp[- ]to[- ](perm|hire)|contract[- ]to[- ]perm)\b/i.test(s.text)) return null;
      return { kind: "contract_to_hire", summary: "Contract-to-hire arrangement", strength: "info" };
    },
  },
  {
    id: "terms.transcripts",
    gate: "terms",
    match: (s) => {
      if (!/\btranscripts?\b/i.test(s.text)) return null;
      if (/\b(transcription|meeting transcripts?|call transcripts?|audio|RNA|transcriptom)/i.test(s.text)) return null;
      if (!/\b(request|require|submit|provide|upload|include|attach|send|application)\b/i.test(s.text)) return null;
      return { kind: "transcripts", summary: "Transcripts requested with the application", strength: "info" };
    },
  },
];

export const RULES: Rule[] = [...workAuth, ...school, ...experience, ...placeTime, ...pay, ...terms];

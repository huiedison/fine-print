export type Country = "US" | "CA" | "other";

const CANADA =
  /\b(Canada|CAN|Ontario|Quebec|Québec|British Columbia|Alberta|Manitoba|Nova Scotia|Toronto|Vancouver|Montreal|Montréal|Ottawa|Calgary|Edmonton|Waterloo|Kitchener|Mississauga|Red Deer|Winnipeg|Halifax|Saint-Laurent)\b|,\s?(ON|BC|QC|AB)\b/;

const ELSEWHERE =
  /\b(United Kingdom|UK|GB|GBR|England|Scotland|Wales|London|Bristol|Manchester|Edinburgh|Ireland|IRL|Dublin|Limerick|Germany|DEU|Berlin|Munich|France|Paris|Rennes|Netherlands|Amsterdam|Eindhoven|Belgium|Brussels|Luxembourg|Spain|ESP|Madrid|Barcelona|Italy|Milan|Milano|Poland|Krakow|Warsaw|Poznań|Denmark|Copenhagen|Sweden|Stockholm|Switzerland|Zurich|Zürich|Turkey|Istanbul|ISTANBUL|Israel|Tel Aviv|India|Bangalore|Bengaluru|Hyderabad|Mumbai|Pune|Chennai|Cheyyar|Singapore|Japan|Tokyo|China|Shanghai|Beijing|Shenzhen|Hong Kong|HKG|Taiwan|Hsinchu|Korea|Seoul|Philippines|Manila|Malaysia|MYS|Penang|Kuala Lumpur|Indonesia|IDN|Jakarta|JAKARTA|Thailand|Bangkok|Vietnam|Ho Chi Minh|Australia|AUS|Sydney|Melbourne|New Zealand|Mexico|MEX|Mexico City|Matehuala|Apodaca|Brazil|São Paulo|Argentina|South Africa|ZAF|Cape Town|UAE|Dubai|Saudi|SAU|Jeddah|Riyadh)\b/;

const US_STATE =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const US_NAMES =
  /\b(United States|USA|U\.S\.|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|San Francisco|Los Angeles|San Jose|San Diego|Seattle|Boston|Austin|Chicago|Denver|Atlanta|Miami|Houston|Dallas|Raleigh|Palo Alto|Mountain View|Sunnyvale|Menlo Park|Costa Mesa|Irvine|Brooklyn|Pittsburgh|Philadelphia|Detroit|Portland|Nashville|Phoenix|Salt Lake City)\b/;
const US_ABBR = new RegExp(`(,\\s?|\\s-\\s|^|-)(${US_STATE})(\\b|$)|^(${US_STATE})\\s-\\s|\\bUS\\b|^US-`);

/** Best guess at the country a board location string is in. Null when it cannot tell
 *  ("4 Locations", a building name, a blank). Unknown is never treated as a match or a miss. */
export function countryOf(location: string | null | undefined): Country | null {
  if (!location) return null;
  const loc = location.trim();
  if (!loc || /^\d+ Locations$/i.test(loc)) return null;
  if (CANADA.test(loc)) return "CA";
  // A named place is checked before two-letter codes: "Bangalore, IN" is India, "Aurora, IN" is Indiana.
  if (US_NAMES.test(loc)) return "US";
  if (ELSEWHERE.test(loc) || /^IN\s-\s/.test(loc)) return "other";
  if (US_ABBR.test(loc)) return "US";
  return null;
}

export const COUNTRY_NAME: Record<Country, string> = {
  US: "the United States",
  CA: "Canada",
  other: "another country",
};

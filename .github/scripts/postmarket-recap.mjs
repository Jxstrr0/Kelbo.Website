// After-close report card for Kelbo.Website
// Runs in GitHub Actions after the US close. Reads today's pre-market brief
// (briefs/YYYY-MM-DD.md, never changed here), asks Claude with web search
// how MU really traded, and grades the brief's gap call and key levels.
// Writes report-cards/YYYY-MM.json (that month's cards, newest first) and
// report-cards/index.json (the running totals briefs.html shows).
// Needs ANTHROPIC_API_KEY in the environment.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";

const MODEL = "claude-sonnet-5-5"; // smaller and cheaper than the brief's model
const MAX_SEARCHES = 8; // web searches a grade may run ($10 per 1,000)
const MAX_FETCHES = 4; // whole pages it may open and read
// List prices in US dollars per million tokens, for the cost line in the
// run log. Cache reads are the cheap re-reads; writes cost 1.25x.
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5, search: 0.01 };
const MARKER = "===CARD===";
const BRIEFS_DIR = "briefs";
const CARDS_DIR = "report-cards";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY. Add it under repo Settings > Secrets and variables > Actions.");
  process.exit(1);
}

// Today in Saskatchewan (no daylight saving). The brief uses the same date.
const now = new Date();
const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina" }).format(now);
const longDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Regina", weekday: "long", year: "numeric", month: "long", day: "numeric",
}).format(now);

/* ---------- Is the US stock market open today? ----------
   The NYSE's full-day holidays, worked out from the calendar so nothing
   needs updating each year. A holiday on a Saturday is taken the Friday
   before, on a Sunday the Monday after (except New Year's Day on a
   Saturday, which isn't moved back into December). */
function easterSunday(year) {
  // The "anonymous Gregorian" method: gives month (3 or 4) and day.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function marketHolidays(year) {
  const ymd = (d) => d.toISOString().slice(0, 10);
  const date = (m, d) => new Date(Date.UTC(year, m - 1, d));
  // The nth weekday of a month (weekday 0 = Sunday); n = -1 for the last.
  const nth = (m, weekday, n) => {
    if (n > 0) {
      const first = date(m, 1);
      return date(m, 1 + ((weekday - first.getUTCDay() + 7) % 7) + 7 * (n - 1));
    }
    const last = new Date(Date.UTC(year, m, 0));
    return new Date(Date.UTC(year, m - 1, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7)));
  };
  const observed = (d, newYears = false) => {
    const w = d.getUTCDay();
    if (w === 6) return newYears ? null : new Date(d.getTime() - 864e5);
    if (w === 0) return new Date(d.getTime() + 864e5);
    return d;
  };
  const goodFriday = new Date(easterSunday(year).getTime() - 2 * 864e5);
  return [
    observed(date(1, 1), true), // New Year's Day
    nth(1, 1, 3), // Martin Luther King Jr. Day: 3rd Monday of January
    nth(2, 1, 3), // Washington's Birthday: 3rd Monday of February
    goodFriday,
    nth(5, 1, -1), // Memorial Day: last Monday of May
    observed(date(6, 19)), // Juneteenth
    observed(date(7, 4)), // Independence Day
    nth(9, 1, 1), // Labor Day: 1st Monday of September
    nth(11, 4, 4), // Thanksgiving: 4th Thursday of November
    observed(date(12, 25)), // Christmas
  ].filter(Boolean).map(ymd);
}
const weekday = new Date(isoDate + "T12:00:00Z").getUTCDay();
if (weekday === 0 || weekday === 6) {
  console.log(`${isoDate} is a weekend. Nothing to grade.`);
  process.exit(0);
}
if (marketHolidays(Number(isoDate.slice(0, 4))).includes(isoDate)) {
  console.log(`${isoDate} is a US market holiday. Nothing to grade.`);
  process.exit(0);
}

/* ---------- Today's brief ---------- */
let brief;
try {
  brief = await readFile(`${BRIEFS_DIR}/${isoDate}.md`, "utf8");
} catch {
  console.log(`No brief for ${isoDate}, so there's nothing to grade.`);
  process.exit(0);
}
brief = brief.split(/^## Sources\s*$/m)[0].trim(); // its sources aren't needed

const month = isoDate.slice(0, 7);
const monthPath = `${CARDS_DIR}/${month}.json`;
let monthCards = {};
try {
  monthCards = JSON.parse(await readFile(monthPath, "utf8"));
} catch { /* first card this month */ }
if (monthCards[isoDate] && process.env.FORCE !== "1") {
  console.log(`${isoDate} already has a report card. Tick "redo today's grade" (FORCE=1) to grade it again.`);
  process.exit(0);
}

/* ---------- Ask Claude ---------- */
const SYSTEM = `You grade a pre-market trading brief after the US market has closed. The brief was written this morning, before the open, for a part-time day trader in Saskatoon who mostly trades MU (Micron). Your job is to check it against what really happened today, honestly. A wrong call graded as wrong is useful; a flattering grade is not.

You have up to ${MAX_SEARCHES} web searches and ${MAX_FETCHES} page reads (web_fetch opens a full page from any site). Find, for MU today:
- the previous session's close (the price the gap is measured from),
- today's opening price (the 9:30 ET regular-session open),
- today's regular-session high and low,
- today's 4:00 pm ET close.
A daily price history page or a quote page usually has all of these at once: fetch one rather than searching for each number. Use a second source to cross-check the open and close if the first one looks odd.

Grading rules.
Gap call (the brief's "**Gap call:**" line). The gap is (open − previous close) ÷ previous close, in percent. Treat anything within ±0.5% as flat.
- "hit": the direction was right (or the call was flat and the gap was flat) and the size was inside the brief's range, or within 1 percentage point of it.
- "partial": the direction was right but the size was off by more than 1 point, or the call was flat and the gap was 0.5% to 1%.
- "miss": the direction was wrong, or the call was flat and the gap was bigger than 1%.
- "unknown": you couldn't confirm the open or the previous close.
Key levels (every support and resistance price in the brief's "**Key levels**" part of the MU section, at most 8). Use the regular-session high, low and close:
- "held": the price came within 0.5% of the level (or poked through it) but closed back on the expected side (above a support, below a resistance).
- "broke": the price closed beyond the level (below a support, above a resistance).
- "untested": the day's range never came within 0.5% of the level.
- "unknown": you couldn't confirm the high, low or close.

Rules:
- Never guess or estimate a price. If you can't confirm a number from a source you found today, use null for it and say "couldn't confirm" in the text.
- Prices are US dollars per share, as plain numbers (884.74, not "$884.74").
- Keep every text field short and plain: one sentence at most.

When you are done, output the line ${MARKER} and then one JSON object, with nothing after it, in exactly this shape:
{
  "summary": "<one sentence: how the brief did today>",
  "gap": { "call": "<what the brief called, in a few words>", "result": "<what MU actually did at the open>", "grade": "hit|partial|miss|unknown" },
  "mu": { "prev_close": <number or null>, "open": <number or null>, "high": <number or null>, "low": <number or null>, "close": <number or null> },
  "levels": [ { "level": "<the level as the brief named it, e.g. Support $861.59 (Friday's low)>", "result": "<what the price did around it>", "grade": "held|broke|untested|unknown" } ],
  "sources": [ { "title": "<page title>", "url": "<the exact URL from your search results or a page you fetched>" } ]
}`;

const tools = [
  { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: MAX_FETCHES },
];

// withTools = false sends the request with search and page reads off.
async function callClaude(messages, withTools = true, attempt = 1) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    // max_tokens covers the model's thinking as well as the card. The cache
    // markers bill the re-reads of everything found so far at a tenth of
    // the price (see the brief's script for the longer explanation).
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
      cache_control: { type: "ephemeral" },
      ...(withTools && { tools }),
    }),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = 15000 * attempt;
    console.log(`API returned ${res.status}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
    return callClaude(messages, withTools, attempt + 1);
  }
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

const messages = [{
  role: "user",
  content: `Today is ${longDate} (Saskatchewan date). The US market has closed for the day. Grade this morning's brief.\n\n<brief>\n${brief}\n</brief>`,
}];
const allBlocks = [];
const usage = { input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0, searches: 0, fetches: 0 };
const addUsage = (u = {}) => {
  usage.input_tokens += u.input_tokens ?? 0;
  usage.output_tokens += u.output_tokens ?? 0;
  usage.cache_read += u.cache_read_input_tokens ?? 0;
  usage.cache_write += u.cache_creation_input_tokens ?? 0;
  usage.searches += u.server_tool_use?.web_search_requests ?? 0;
  usage.fetches += u.server_tool_use?.web_fetch_requests ?? 0;
};

// Server-side search can pause long turns; continue up to 5 times.
for (let i = 0; i < 6; i++) {
  const data = await callClaude(messages);
  allBlocks.push(...data.content);
  addUsage(data.usage);
  if (data.stop_reason === "max_tokens") console.warn("Hit max_tokens: the card may be cut short.");
  if (data.stop_reason !== "pause_turn") break;
  messages.push({ role: "assistant", content: data.content });
}

const textOf = (blocks) => blocks.filter((b) => b.type === "text").map((b) => b.text).join("");

// The JSON after the marker (or the first {...} if the marker is missing).
function parseCard(text) {
  const at = text.lastIndexOf(MARKER);
  let s = (at >= 0 ? text.slice(at + MARKER.length) : text).trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

let raw = parseCard(textOf(allBlocks));
if (!raw) {
  // Ask once for the same findings in the format, with search off.
  console.warn("The answer wasn't valid JSON; asking for it again in the format.");
  const fix = await callClaude([
    messages[0],
    { role: "assistant", content: textOf(allBlocks) || "(no answer)" },
    { role: "user", content: `Give that grade again as the JSON object from your instructions, after the line ${MARKER}. Keep the same facts; use null for anything you didn't confirm.` },
  ], false);
  addUsage(fix.usage);
  raw = parseCard(textOf(fix.content));
}
if (!raw) throw new Error("Claude didn't return a report card in the expected format.");

/* ---------- Check and tidy what came back ----------
   Anything not in the expected shape is dropped or becomes "unknown", so
   the page never shows a made-up value. */
const text = (v, max = 220) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const price = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);
const oneOf = (v, list) => (list.includes(v) ? v : "unknown");
const pct = (from, to) => (from && to ? Math.round(((to - from) / from) * 10000) / 100 : null);

const mu = {
  prev_close: price(raw.mu?.prev_close),
  open: price(raw.mu?.open),
  high: price(raw.mu?.high),
  low: price(raw.mu?.low),
  close: price(raw.mu?.close),
};
mu.open_pct = pct(mu.prev_close, mu.open); // the gap
mu.close_pct = pct(mu.prev_close, mu.close); // the day's move

// Only links that really came back from this run's searches and page reads.
const normUrl = (u) => {
  try {
    const x = new URL(u);
    return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + x.search).toLowerCase();
  } catch { return ""; }
};
const seenUrls = new Set();
for (const block of allBlocks) {
  if (block.type === "text") {
    for (const c of block.citations ?? []) if (c.url) seenUrls.add(normUrl(c.url));
    continue;
  }
  for (const m of JSON.stringify(block).matchAll(/https?:\/\/[^\s"'<>\\)\]]+/g)) seenUrls.add(normUrl(m[0]));
}
seenUrls.delete("");
const sources = [];
for (const s of Array.isArray(raw.sources) ? raw.sources : []) {
  const url = text(s?.url, 500);
  if (!/^https:\/\//.test(url)) continue;
  if (!seenUrls.has(normUrl(url))) {
    console.warn(`Dropped a source this run never saw: ${url}`);
    continue;
  }
  if (!sources.some((x) => x.url === url)) sources.push({ title: text(s.title, 140) || url, url });
}

const card = {
  date: isoDate,
  time: new Date().toISOString(),
  summary: text(raw.summary, 300),
  gap: {
    call: text(raw.gap?.call),
    result: text(raw.gap?.result),
    // A gap can't be graded without both prices, whatever the model said.
    grade: mu.open_pct === null ? "unknown" : oneOf(raw.gap?.grade, ["hit", "partial", "miss"]),
  },
  mu,
  levels: (Array.isArray(raw.levels) ? raw.levels : []).slice(0, 8).map((l) => ({
    level: text(l?.level, 120),
    result: text(l?.result),
    grade: oneOf(l?.grade, ["held", "broke", "untested"]),
  })).filter((l) => l.level),
  sources: sources.slice(0, 6),
};

/* ---------- Save ---------- */
await mkdir(CARDS_DIR, { recursive: true });
monthCards[isoDate] = card;
const sorted = Object.fromEntries(Object.entries(monthCards).sort(([a], [b]) => (a < b ? 1 : -1)));
await writeFile(monthPath, JSON.stringify(sorted, null, 2) + "\n");

// The running totals, added up again from every month file each time so
// a redone grade never counts twice.
const totals = { days: 0, gap: { hit: 0, partial: 0, miss: 0, unknown: 0 }, levels: { held: 0, broke: 0, untested: 0, unknown: 0 } };
const months = (await readdir(CARDS_DIR)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 7)).sort().reverse();
for (const m of months) {
  const cards = JSON.parse(await readFile(`${CARDS_DIR}/${m}.json`, "utf8"));
  for (const c of Object.values(cards)) {
    totals.days++;
    totals.gap[c.gap?.grade in totals.gap ? c.gap.grade : "unknown"]++;
    for (const l of c.levels ?? []) totals.levels[l.grade in totals.levels ? l.grade : "unknown"]++;
  }
}
await writeFile(`${CARDS_DIR}/index.json`, JSON.stringify({ latest: isoDate, ...totals, months }, null, 2) + "\n");

console.log(`Graded ${isoDate}: gap ${card.gap.grade}; levels ${card.levels.map((l) => l.grade).join(", ") || "none"}`);
console.log(`MU: prev close ${mu.prev_close ?? "?"}, open ${mu.open ?? "?"} (${mu.open_pct ?? "?"}%), close ${mu.close ?? "?"} (${mu.close_pct ?? "?"}%)`);
console.log(`Tokens: ${usage.input_tokens} in, ${usage.cache_read} cache reads, ${usage.cache_write} cache writes, ${usage.output_tokens} out`);
console.log(`Searches: ${usage.searches} of ${MAX_SEARCHES}; pages read: ${usage.fetches} of ${MAX_FETCHES}`);
// An estimate at list prices; the Anthropic console has the real bill.
const cost = (usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output +
  usage.cache_read * PRICE.cacheRead + usage.cache_write * PRICE.cacheWrite) / 1e6 + usage.searches * PRICE.search;
console.log(`Estimated cost: US$${cost.toFixed(2)}`);

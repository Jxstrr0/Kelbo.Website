// After-close report card for Kelbo.Website
// Runs in GitHub Actions after the US close. Reads today's pre-market brief
// (briefs/YYYY-MM-DD.md, never changed here), asks Claude with web search
// how MU and the SOX (PHLX Semiconductor Index) really traded, and grades
// the brief's gap call and key levels for each. Briefs from before the SOX
// section was added get an MU-only card.
// Writes report-cards/YYYY-MM.json (that month's cards, newest first) and
// report-cards/index.json (the running totals briefs.html shows).
// Needs ANTHROPIC_API_KEY in the environment.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { costNote } from "./claude.mjs";
import { marketHolidays } from "./market-days.mjs";

const MODEL = "claude-opus-5-5"; // the same model as the brief (Sonnet 5.5 until Nov 2026)
const MAX_SEARCHES = 18; // web searches a grade may run ($10 per 1,000)
const MAX_FETCHES = 15; // whole pages it may open and read
// List prices in US dollars per million tokens, for the cost line in the
// run log. Cache reads are the cheap re-reads; writes cost 1.25x.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, search: 0.01 };
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
   The holiday list lives in market-days.mjs (the journal robots use it too). */
const weekday = new Date(isoDate + "T12:00:00Z").getUTCDay();
if (weekday === 0 || weekday === 6) {
  console.log(`${isoDate} is a weekend. Nothing to grade.`);
  process.exit(0);
}
if (marketHolidays(Number(isoDate.slice(0, 4))).includes(isoDate)) {
  console.log(`${isoDate} is a US market holiday. Nothing to grade.`);
  process.exit(0);
}

/* ---------- Has the market closed yet? ----------
   The grade needs the day's final prices, so a run before the 4:00 pm
   New York close stops here without asking Claude (it costs nothing).
   Saskatchewan doesn't change its clocks but New York does, so that's
   3:00 pm Saskatoon from November to March and 2:00 pm the rest of the
   year. Ticking "redo today's grade" doesn't skip this check. On the few
   half days (1:00 pm close) it still waits for 4:00 pm, which is fine. */
const nyClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23",
}).formatToParts(now);
const nyHour = Number(nyClock.find((part) => part.type === "hour").value);
const nyMinute = Number(nyClock.find((part) => part.type === "minute").value);
// Late at night New York reaches tomorrow before Saskatoon does; that's after the close too.
const nyDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
if (nyDate === isoDate && nyHour * 60 + nyMinute < 16 * 60) {
  console.log("The US market hasn't closed yet (4:00 pm New York time). Run this again after the close.");
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
// Briefs since November 2026 have a SOX section with its own calls.
const hasSox = /^## SOX\s*$/m.test(brief);

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
const SYSTEM = `You grade a pre-market trading brief after the US market has closed. The brief was written this morning, before the open, for a part-time day trader in Saskatoon who mostly trades MU (Micron)${hasSox ? " and watches the SOX (PHLX Semiconductor Index) as closely" : ""}. Your job is to check it against what really happened today, honestly. A wrong call graded as wrong is useful; a flattering grade is not.

You have up to ${MAX_SEARCHES} web searches and ${MAX_FETCHES} page reads (web_fetch opens a full page from any site). Find, for MU${hasSox ? " and for the SOX index (the index itself, ^SOX, in points; not the SOXX or SMH ETFs)" : ""} today:
- the previous session's close (the price the gap is measured from),
- today's opening price (the 9:30 ET regular-session open),
- today's regular-session high and low,
- today's 4:00 pm ET close.
For the gap call, call_low_pct and call_high_pct are the brief's predicted range ("Up about 2–3%" is 2 and 3; "down 1%" is -1 and -1; a flat call is 0 and 0; null if the brief gave no size). For a level like "$902.50–$906.54", low is 902.5 and high is 906.54; for one price, low and high are the same.
A daily price history page or a quote page usually has all of these at once: fetch one rather than searching for each number. Use a second source to cross-check the open and close if the first one looks odd.

Grading rules.
Gap call (the "**Gap call:**" line${hasSox ? " in the MU section, and separately the one in the SOX section" : ""}). The gap is (open − previous close) ÷ previous close, in percent. Treat anything within ±0.5% as flat.
- "hit": the direction was right (or the call was flat and the gap was flat) and the size was inside the brief's range, or within 1 percentage point of it.
- "partial": the direction was right but the size was off by more than 1 point, or the call was flat and the gap was 0.5% to 1%.
- "miss": the direction was wrong, or the call was flat and the gap was bigger than 1%.
- "unknown": you couldn't confirm the open or the previous close.
Key levels (every support and resistance price in the "**Key levels**" part of the brief's MU section, at most 8${hasSox ? ", and separately the SOX section's, at most 8" : ""}). Use the regular-session high, low and close:
- "held": the price came within 0.5% of the level (or poked through it) but closed back on the expected side (above a support, below a resistance).
- "broke": the price closed beyond the level (below a support, above a resistance).
- "untested": the day's range never came within 0.5% of the level.
- "unknown": you couldn't confirm the high, low or close.

Rules:
- Never guess or estimate a price. If you can't confirm a number from a source you found today, use null for it and say "couldn't confirm" in the text.
- MU prices are US dollars per share, as plain numbers (884.74, not "$884.74").${hasSox ? " SOX values are index points, also plain numbers (7123.45)." : ""}
- Keep every text field short and plain: one sentence at most.
- Also copy the brief's own numbers into the fields below (call_low_pct, call_high_pct, kind, low, high). The script redoes the grade arithmetic from them and your prices, so copy them exactly as the brief gave them.

When you are done, output the line ${MARKER} and then one JSON object, with nothing after it, in exactly this shape:
{
  "summary": "<one sentence: how the brief did today${hasSox ? " on MU and the SOX" : ""}>",
  "gap": { "call": "<what the brief called, in a few words>", "call_low_pct": <the low end of the brief's predicted gap in percent, negative for down, or null>, "call_high_pct": <the high end, or null>, "result": "<what MU actually did at the open>", "grade": "hit|partial|miss|unknown" },
  "mu": { "prev_close": <number or null>, "open": <number or null>, "high": <number or null>, "low": <number or null>, "close": <number or null> },
  "levels": [ { "level": "<the level as the brief named it, e.g. Support $861.59 (Friday's low)>", "kind": "support|resistance", "low": <the level's price, or the bottom of its range>, "high": <the same price, or the top of its range>, "result": "<what the price did around it>", "grade": "held|broke|untested|unknown" } ],${hasSox ? `
  "sox": {
    "gap": <the same shape as "gap" above, for the SOX section's gap call>,
    "index": <the same shape as "mu" above, in index points>,
    "levels": <the same shape as "levels" above, for the SOX section's key levels>
  },` : ""}
  "sources": [ { "title": "<page title>", "url": "<the exact URL from your search results or a page you fetched>" } ]
}`;

const tools = [
  { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: MAX_FETCHES },
];

// withTools = false sends the request with search and page reads off.
async function callClaude(messages, withTools = true, attempt = 1) {
  const retry = async (why) => {
    const wait = 15000 * attempt;
    console.log(`${why}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
    return callClaude(messages, withTools, attempt + 1);
  };
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    // max_tokens covers the model's thinking as well as the card. The cache
    // markers bill the re-reads of everything found so far at a tenth of
    // the price (see the brief's script for the longer explanation).
    // effort "high" is written out so it stays high even if the model's
    // default ever changes. Opus thinks at more length than Sonnet did, so
    // max_tokens has room to spare.
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 32000,
      output_config: { effort: "high" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
      cache_control: { type: "ephemeral" },
      ...(withTools && { tools }),
    }),
    });
  } catch (err) {
    // The connection itself failed (a network blip): try again too.
    if (attempt < 4) return retry(`Couldn't reach the API (${err.message})`);
    throw err;
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 4) return retry(`API returned ${res.status}`);
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

// The day's prices for one ticker, with the gap and the day's move.
function dayPrices(r) {
  const day = {
    prev_close: price(r?.prev_close),
    open: price(r?.open),
    high: price(r?.high),
    low: price(r?.low),
    close: price(r?.close),
  };
  day.open_pct = pct(day.prev_close, day.open); // the gap
  day.close_pct = pct(day.prev_close, day.close); // the day's move
  return day;
}
const mu = dayPrices(raw.mu);

/* ---------- Redo the grade arithmetic ----------
   Claude finds the prices and copies the brief's numbers; the sums are
   done here, by the same rules as in SYSTEM, so a slip in the model's
   maths can't change a grade. When a number is missing, Claude's own
   grade is kept. Any time the two disagree, the run log says so. */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const FLAT = 0.5; // a gap within ±0.5% counts as flat
const NEAR = 0.5; // a level within 0.5% of the day's range was tested

function gapGrade(lowPct, highPct, gap) {
  if (gap === null || lowPct === null || highPct === null) return null;
  const [lo, hi] = lowPct <= highPct ? [lowPct, highPct] : [highPct, lowPct];
  const mid = (lo + hi) / 2;
  const callDir = Math.abs(mid) <= FLAT ? 0 : Math.sign(mid);
  if (callDir === 0) return Math.abs(gap) <= FLAT ? "hit" : Math.abs(gap) <= 1 ? "partial" : "miss";
  const gapDir = Math.abs(gap) <= FLAT ? 0 : Math.sign(gap);
  if (gapDir !== callDir) return "miss";
  const off = gap >= lo && gap <= hi ? 0 : Math.min(Math.abs(gap - lo), Math.abs(gap - hi));
  return off <= 1 ? "hit" : "partial";
}

function levelGrade(kind, low, high, day) {
  if (!["support", "resistance"].includes(kind) || !price(low) || !price(high)) return null;
  if (!day.high || !day.low || !day.close) return null;
  const [lo, hi] = low <= high ? [low, high] : [high, low];
  // How close the day's range came to the level (0 if it touched it).
  const gapToLevel = day.low > hi ? day.low - hi : day.high < lo ? lo - day.high : 0;
  if (gapToLevel > (lo * NEAR) / 100) return "untested";
  const broke = kind === "support" ? day.close < lo : day.close > hi;
  return broke ? "broke" : "held";
}

// Grades one ticker's gap call and key levels from Claude's answer and
// that ticker's prices. `name` labels the run log lines.
function gradeTicker(name, rawGap, rawLevels, day) {
  const modelGap = oneOf(rawGap?.grade, ["hit", "partial", "miss"]);
  const checkedGap = gapGrade(num(rawGap?.call_low_pct), num(rawGap?.call_high_pct), day.open_pct);
  if (checkedGap && checkedGap !== modelGap) console.warn(`${name} gap: Claude said ${modelGap}, the arithmetic says ${checkedGap}. Using ${checkedGap}.`);
  const gap = {
    call: text(rawGap?.call),
    result: text(rawGap?.result),
    // A gap can't be graded without both prices, whatever the model said.
    grade: day.open_pct === null ? "unknown" : checkedGap ?? modelGap,
  };
  const levels = (Array.isArray(rawLevels) ? rawLevels : []).slice(0, 8).map((l) => {
    const said = oneOf(l?.grade, ["held", "broke", "untested"]);
    const checked = levelGrade(l?.kind, l?.low, l?.high, day);
    if (checked && checked !== said) console.warn(`${name} ${text(l?.level, 60)}: Claude said ${said}, the arithmetic says ${checked}. Using ${checked}.`);
    // Without the day's high, low and close no level can be graded.
    const grade = !day.high || !day.low || !day.close ? "unknown" : checked ?? said;
    return { level: text(l?.level, 120), result: text(l?.result), grade };
  }).filter((l) => l.level);
  return { gap, levels };
}

const muGrades = gradeTicker("MU", raw.gap, raw.levels, mu);
// The SOX part only when the brief had a SOX section and Claude answered it.
let sox = null;
if (hasSox && raw.sox && typeof raw.sox === "object") {
  const index = dayPrices(raw.sox.index);
  sox = { ...gradeTicker("SOX", raw.sox.gap, raw.sox.levels, index), index };
} else if (hasSox) {
  console.warn("The brief had a SOX section but Claude returned no SOX grades.");
}

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
  gap: muGrades.gap,
  mu,
  levels: muGrades.levels,
  ...(sox ? { sox } : {}),
  sources: sources.slice(0, 6),
};

/* ---------- Save ---------- */
await mkdir(CARDS_DIR, { recursive: true });
monthCards[isoDate] = card;
const sorted = Object.fromEntries(Object.entries(monthCards).sort(([a], [b]) => (a < b ? 1 : -1)));
await writeFile(monthPath, JSON.stringify(sorted, null, 2) + "\n");

// The running totals, added up again from every month file each time so
// a redone grade never counts twice.
const tally = () => ({ gap: { hit: 0, partial: 0, miss: 0, unknown: 0 }, levels: { held: 0, broke: 0, untested: 0, unknown: 0 } });
const add = (t, part) => {
  t.gap[part.gap?.grade in t.gap ? part.gap.grade : "unknown"]++;
  for (const l of part.levels ?? []) t.levels[l.grade in t.levels ? l.grade : "unknown"]++;
};
// gap and levels are MU's (the top-level names predate the SOX); sox has
// its own, counting only the days that graded it.
const totals = { days: 0, ...tally(), sox: { days: 0, ...tally() } };
const months = (await readdir(CARDS_DIR)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 7)).sort().reverse();
const counts = {}; // "2026-11" -> how many cards that month (for the page's folds)
for (const m of months) {
  const cards = JSON.parse(await readFile(`${CARDS_DIR}/${m}.json`, "utf8"));
  counts[m] = Object.keys(cards).length;
  for (const c of Object.values(cards)) {
    totals.days++;
    add(totals, c);
    if (c.sox) {
      totals.sox.days++;
      add(totals.sox, c.sox);
    }
  }
}
await writeFile(`${CARDS_DIR}/index.json`, JSON.stringify({ latest: isoDate, ...totals, months, counts }, null, 2) + "\n");

console.log(`Graded ${isoDate}: MU gap ${card.gap.grade}; levels ${card.levels.map((l) => l.grade).join(", ") || "none"}`);
if (sox) console.log(`SOX gap ${sox.gap.grade}; levels ${sox.levels.map((l) => l.grade).join(", ") || "none"}`);
const dayLine = (name, d) => `${name}: prev close ${d.prev_close ?? "?"}, open ${d.open ?? "?"} (${d.open_pct ?? "?"}%), close ${d.close ?? "?"} (${d.close_pct ?? "?"}%)`;
console.log(dayLine("MU", mu));
if (sox) console.log(dayLine("SOX", sox.index));
console.log(`Tokens: ${usage.input_tokens} in, ${usage.cache_read} cache reads, ${usage.cache_write} cache writes, ${usage.output_tokens} out`);
console.log(`Searches: ${usage.searches} of ${MAX_SEARCHES}; pages read: ${usage.fetches} of ${MAX_FETCHES}`);
// An estimate at list prices; the Anthropic console has the real bill.
const cost = (usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output +
  usage.cache_read * PRICE.cacheRead + usage.cache_write * PRICE.cacheWrite) / 1e6 + usage.searches * PRICE.search;
console.log(`Estimated cost: US$${cost.toFixed(2)}`);
costNote(cost, `${usage.searches} searches, ${usage.fetches} pages read`);

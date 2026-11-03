// =====================================================================
// THE FORECASTER: the journal's weekly forecast
// ---------------------------------------------------------------------
// Runs on Sunday (journal-forecast.yml). Asks Claude, with web search,
// for next week's market forecast in the same shape as Kelbo's own
// journal entries (summary, view, sectors, calls with a "wrong if",
// scenarios, levels, schedule, plan), and adds it to the top of
// journal.json. The calls go in ungraded; the Scorekeeper
// (journal-grade.mjs) grades them after Friday's close.
//
// It never touches older entries, trades or options.json. A week that
// already has an entry is skipped before any call, unless FORCE=1.
// DRY_RUN=1 prints the entry and saves nothing.
// Needs ANTHROPIC_API_KEY in the environment.
// =====================================================================

import { readFile, writeFile } from "node:fs/promises";
import { askClaudeWeb, logWebCost, seenSources, readJson, setOutput, skDate, DRY_RUN } from "./claude.mjs";
import { isMarketDay, addDays } from "./market-days.mjs";

const MODEL = "claude-opus-5-5"; // the bigger model, like the brief
const EFFORT = "high";
const MAX_SEARCHES = 25; // web searches it may run ($10 per 1,000)
const MAX_FETCHES = 12; // whole pages it may open and read
const MARKER = "===ENTRY===";
const FILE = "journal.json";
const FORCE = process.env.FORCE === "1";

/* ---------- Which week ---------- */
// On a Saturday or Sunday it's the coming week; on a weekday (a run by
// hand) it's the week already under way.
const today = skDate();
const dow = new Date(today + "T12:00:00Z").getUTCDay(); // 0 = Sunday
const monday = dow === 6 ? addDays(today, 2) : dow === 0 ? addDays(today, 1) : addDays(today, 1 - dow);
const days = [0, 1, 2, 3, 4].map((n) => addDays(monday, n)).filter(isMarketDay);
if (!days.length) {
  console.log(`The week of ${monday} has no market days. Nothing to forecast.`);
  process.exit(0);
}
const first = days[0];
const last = days[days.length - 1];
// The close every weekly call is measured from: the last market day before the week.
let base = addDays(first, -1);
while (!isMarketDay(base)) base = addDays(base, -1);

const nice = (ymd, opts) =>
  new Date(ymd + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
const short = (ymd) => nice(ymd, { month: "short", day: "numeric" }); // "Nov 9"
const long = (ymd) => nice(ymd, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/* ---------- The journal so far ---------- */
const raw = await readFile(FILE, "utf8");
const journal = JSON.parse(raw); // broken JSON stops here, before any call
if (!Array.isArray(journal)) throw new Error(`${FILE} should be a list of entries.`);
if (journal.some((e) => e && e.date === first && e.by !== "forecaster")) {
  console.log(`Kelbo already wrote an entry for ${first}; leaving that week to him. No call made.`);
  process.exit(0);
}
if (journal.some((e) => e && e.date === first) && !FORCE) {
  console.log(`The journal already has an entry for ${first}. Tick "Write this week's forecast again" (FORCE=1) to replace the robot's one.`);
  process.exit(0);
}
// The two newest entries, so the new one can follow on from them and use
// their grades and lessons. Trades and sources are left out.
const recent = journal
  .filter((e) => e && e.date !== first)
  .slice(0, 2)
  .map(({ trades, sources, gradeSources, ...rest }) => rest);

/* ---------- Ask Claude ---------- */
const SYSTEM = `You write the weekly forecast in a trading journal. The journal belongs to Kelbo, a part-time trader in Saskatoon who mostly trades MU (Micron) and short-dated options, and the page speaks in his first person ("I think", "my lean"). Your entry sits next to entries he wrote himself, so match them: plain, short sentences, specific numbers, no hype, no em-dashes.

You have up to ${MAX_SEARCHES} web searches and ${MAX_FETCHES} page reads (web_fetch opens a full page from any site). Research before writing:
1. Last week: the S&P 500, Nasdaq, Dow and Russell 2000 weekly moves and closes, the leading and lagging sectors (with their sector ETFs), the VIX, the 10-year yield, oil (Brent or WTI) and MU's weekly move and close.
2. This week's calendar: economic data with consensus where available, Fed speakers or a meeting, Treasury auctions, and the big earnings reports (dates, before or after the close, the options-implied move when you can find it).
3. The setup: key support and resistance levels for the S&P 500 and MU (moving averages, recent highs and lows), and what the news flow is pointing at.

Then write the entry.

The calls are the most important part. They are graded after the close on ${long(last)} against real prices, so every call must be checkable from closing prices or settles:
- Write 4 to 6 calls. At least one is about MU.
- Each call has a "wrongIf" that names the exact test, with the dates. Weekly calls are measured from the ${long(base)} close to the ${long(last)} close (write the dates out, e.g. "XLK finishes the week (${short(last)} close vs ${short(base)} close) ahead of XLE").
- Prefer rankings (one thing beats another over the week) and thresholds (holds above or stays under a level on every close) over exact price targets. Avoid calls that hinge on one exact number being hit.
- Each call must be something that could really fail. No call should be a near-certainty.
- If the earlier entries have lessons or graded calls, learn from them (say so briefly in the view when it matters).

Rules:
- Use only figures from sources found in this run. Never guess a number. If you can't confirm something, leave it out.
- "note" says, in one or two sentences, where the numbers came from and how fresh they are (e.g. "Closes are from Friday; futures were read Sunday afternoon").
- "view" is three or four short paragraphs separated by a blank line (\\n\\n): where things stand, what this week hinges on, and my lean.
- "summary" is the TLDR: two to four sentences, first person.
- Scenario odds are whole numbers that add up to 100.
- "trend" in a sector row is "up" or "down".
- "plan" is up to 5 short trading rules for the week, written as plain lines.

When you are done, output the line ${MARKER} and then one JSON object, with nothing after it, in exactly this shape:
{
  "bias": "Bullish|Bearish|Neutral",
  "summary": "<TLDR>",
  "view": "<paragraphs>",
  "note": "<where the numbers came from>",
  "sectors": [ { "sector": "<name>", "etf": "<ticker(s) or empty>", "direction": "<Leading, Lagging, Bouncing, ...>", "trend": "up|down", "why": "<one short line>" } ],
  "calls": [ { "call": "<the call>", "wrongIf": "<the exact test, with dates>" } ],
  "scenarios": [ { "odds": <number>, "name": "<Base: ...|Bull: ...|Bear: ...>", "text": "<two sentences>" } ],
  "levels": [ { "symbol": "<SPX, MU, ...>", "resistance": "<levels>", "support": "<levels>", "tell": "<what a break would mean>" } ],
  "schedule": [ { "when": "<Mon, Tue after close, ...>", "what": "<what's on>" } ],
  "plan": [ "<rule>" ],
  "sources": [ { "title": "<page title>", "url": "<the exact URL from your search results or a page you fetched>" } ]
}`;

const USER = `Today is ${long(today)} (Saskatchewan date). Write the forecast for the week of ${long(monday)}. The market is open ${days.map(short).join(", ")}${days.length < 5 ? " (the other weekday is a US market holiday)" : ""}. Weekly calls are measured from the ${short(base)} close to the ${short(last)} close.

The two newest journal entries, for context (newest first):
<recent>
${JSON.stringify(recent, null, 1)}
</recent>`;

const { text, blocks, usage } = await askClaudeWeb({
  model: MODEL,
  effort: EFFORT,
  system: SYSTEM,
  user: USER,
  maxSearches: MAX_SEARCHES,
  maxFetches: MAX_FETCHES,
  check: (t) => readJson(t, MARKER) !== null,
  fix: `Give that forecast again as the JSON object from your instructions, after the line ${MARKER}. Keep the same facts and numbers.`,
});
logWebCost(MODEL, usage, MAX_SEARCHES, MAX_FETCHES);

const answer = readJson(text, MARKER);
if (!answer) throw new Error("Claude didn't return the entry in the expected format.");

/* ---------- Check and tidy what came back ----------
   Anything not in the expected shape is dropped, so the page never shows
   a broken row. Em-dashes become commas (the journal doesn't use them). */
const clean = (v, max = 400) =>
  typeof v === "string"
    ? v.replace(/\s*—\s*/g, ", ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
    : "";
const rows = (v, max) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object").slice(0, max) : []);

const calls = rows(answer.calls, 6)
  .map((c) => ({ call: clean(c.call, 240), wrongIf: clean(c.wrongIf, 300), grade: null }))
  .filter((c) => c.call && c.wrongIf);
if (calls.length < 3) throw new Error(`Only ${calls.length} usable calls came back; at least 3 are needed. Nothing saved.`);

const scenarios = rows(answer.scenarios, 4)
  .map((s) => ({ odds: Math.round(Number(s.odds)), name: clean(s.name, 80), text: clean(s.text, 500) }))
  .filter((s) => s.name && Number.isFinite(s.odds) && s.odds >= 0 && s.odds <= 100);
const oddsTotal = scenarios.reduce((sum, s) => sum + s.odds, 0);
if (scenarios.length && oddsTotal !== 100) console.warn(`Scenario odds add up to ${oddsTotal}, not 100.`);

const sources = seenSources(blocks, answer.sources, 12);
const stamp = `Written by the Forecaster robot on ${short(today)} from that day's web searches.`;

const entry = {
  date: first,
  title: `Forecast for the week of ${short(monday)}`,
  bias: ["Bullish", "Bearish", "Neutral"].includes(answer.bias) ? answer.bias : "Neutral",
  gradeBy: last,
  summary: clean(answer.summary, 900),
  view: clean(answer.view, 4000),
  note: [clean(answer.note, 500), stamp].filter(Boolean).join(" "),
  sectors: rows(answer.sectors, 8)
    .map((s) => ({
      sector: clean(s.sector, 40),
      ...(clean(s.etf, 30) && { etf: clean(s.etf, 30) }),
      direction: clean(s.direction, 40),
      trend: s.trend === "up" ? "up" : "down",
      why: clean(s.why, 200),
    }))
    .filter((s) => s.sector),
  calls,
  scenarios,
  levels: rows(answer.levels, 6)
    .map((l) => ({ symbol: clean(l.symbol, 20), resistance: clean(l.resistance, 120), support: clean(l.support, 120), tell: clean(l.tell, 200) }))
    .filter((l) => l.symbol),
  schedule: rows(answer.schedule, 12)
    .map((s) => ({ when: clean(s.when, 30), what: clean(s.what, 300) }))
    .filter((s) => s.when && s.what),
  plan: (Array.isArray(answer.plan) ? answer.plan : []).map((p) => clean(p, 200)).filter(Boolean).slice(0, 5),
  trades: [],
  sources,
  by: "forecaster",
};
if (!entry.summary || !entry.view) throw new Error("The summary or the view came back empty. Nothing saved.");

if (DRY_RUN) {
  console.log("Dry run: this entry would go at the top of journal.json:");
  console.log(JSON.stringify(entry, null, 2));
  process.exit(0);
}

// A redo (FORCE) replaces only the robot's own entry for that week.
const kept = journal.filter((e) => !(e && e.date === first && e.by === "forecaster"));
if (kept.some((e) => e && e.date === first)) {
  console.log(`Kelbo already wrote an entry for ${first}; leaving it alone.`);
  process.exit(0);
}
kept.unshift(entry);
kept.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
await writeFile(FILE, JSON.stringify(kept, null, 2) + "\n");
setOutput("written", "true");
console.log(`Added "${entry.title}" (${entry.bias}) with ${calls.length} calls, graded after ${last}.`);

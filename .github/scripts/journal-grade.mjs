// =====================================================================
// THE SCOREKEEPER: grades the journal's weekly calls
// ---------------------------------------------------------------------
// Runs on Sunday around noon (journal-grade.yml), as a half-price batch. Finds the newest
// journal entry whose "gradeBy" day has closed and that still has
// ungraded calls, asks Claude, with web search, what really happened,
// and fills in each call's grade (hit / partial / miss) with a one-line
// "result", then the entry's recap, AI coach note and lesson.
//
// It only ever adds: a grade already there is never changed (unless
// FORCE=1), and trades, the forecast text and options.json are never
// touched. A call whose prices it can't confirm stays ungraded, so it
// never counts in the record on a guess.
// DRY_RUN=1 prints the grades and saves nothing.
// Needs ANTHROPIC_API_KEY in the environment.
// =====================================================================

import { readFile, writeFile } from "node:fs/promises";
import { askClaudeWeb, logWebCost, seenSources, readJson, setOutput, skDate, pullLatest, DRY_RUN } from "./claude.mjs";
import { addDays } from "./market-days.mjs";

const MODEL = "claude-opus-5-5"; // the bigger model, like the Forecaster (Sonnet 5.5 until Nov 9, 2026)
const EFFORT = "high";
const MAX_SEARCHES = 20; // web searches it may run ($10 per 1,000)
const MAX_FETCHES = 15; // whole pages it may open and read
const MARKER = "===GRADES===";
const FILE = "journal.json";
const LOOK_BACK_DAYS = 21; // older ungraded entries are left for Kelbo
const FORCE = process.env.FORCE === "1";
const GRADES = ["hit", "partial", "miss"];

/* ---------- Has the market closed? ---------- */
const now = new Date();
const today = skDate(now);
const nyDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
const nyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23",
}).formatToParts(now);
const nyMinutes = Number(nyParts.find((p) => p.type === "hour").value) * 60 + Number(nyParts.find((p) => p.type === "minute").value);
// A gradeBy day counts as closed once it's past, or it's today after 4:00 pm New York time.
const closed = (ymd) => ymd < today || (ymd === today && (nyDate > today || nyMinutes >= 16 * 60));

/* ---------- Which entry ---------- */
const journal = JSON.parse(await readFile(FILE, "utf8")); // broken JSON stops here, before any call
if (!Array.isArray(journal)) throw new Error(`${FILE} should be a list of entries.`);
const isGraded = (c) => GRADES.includes(String(c?.grade || "").toLowerCase());
const entry = journal.find(
  (e) =>
    e && typeof e.gradeBy === "string" && Array.isArray(e.calls) && e.calls.length &&
    closed(e.gradeBy) && e.gradeBy >= addDays(today, -LOOK_BACK_DAYS) &&
    (FORCE || e.calls.some((c) => !isGraded(c)))
);
if (!entry) {
  console.log("No entry is waiting for grades (its gradeBy day hasn't closed yet, or every call is graded). No call made.");
  process.exit(0);
}
const open = entry.calls.map((c, i) => ({ n: i + 1, call: c.call, wrongIf: c.wrongIf, graded: isGraded(c) }));
const todo = open.filter((c) => FORCE || !c.graded);
console.log(`Grading "${entry.title || entry.date}": ${todo.length} of ${open.length} calls.`);

/* ---------- Ask Claude ---------- */
const SYSTEM = `You grade the calls in a weekly trading-journal forecast after the week is over. The journal belongs to Kelbo, a part-time trader in Saskatoon. Grade honestly: a wrong call marked wrong is useful; a flattering grade is not.

You have up to ${MAX_SEARCHES} web searches and ${MAX_FETCHES} page reads (web_fetch opens a full page from any site). For each call, find the real closing prices or settles its "wrongIf" names (a daily price history page usually has a whole week at once: fetch one rather than searching for each number). Cross-check any number that looks odd with a second source.

Grades:
- "hit": the call came true and its wrongIf didn't happen.
- "partial": the call was mostly right but missed a part of it (for example, the direction was right but a threshold was crossed on one day, or one half of a two-part call failed).
- "miss": the wrongIf happened.
- "unknown": you couldn't confirm the prices the test needs. Never guess.

Then write:
- "result" for each call: one short sentence with the real numbers that decided it.
- "recap": what actually happened this week, two or three short paragraphs separated by a blank line (\\n\\n), with real closes, ending with the score ("2 hits, 1 partial, 2 misses").
- "ai": the AI coach's note on the forecast, two short paragraphs. Judge the calls and the reasoning, not the person: never write "you" or "your" (write "the energy call was a coin flip", not "your energy call"). Say what worked, what didn't and why.
- "lesson": one or two sentences, one thing to keep doing or fix in next week's forecast.
Plain, short sentences, no em-dashes. Use only figures from sources found in this run.

When you are done, output the line ${MARKER} and then one JSON object, with nothing after it, in exactly this shape:
{
  "calls": [ { "n": <the call's number>, "grade": "hit|partial|miss|unknown", "result": "<one sentence>" } ],
  "recap": "<paragraphs>",
  "ai": "<paragraphs>",
  "lesson": "<one or two sentences>",
  "sources": [ { "title": "<page title>", "url": "<the exact URL from your search results or a page you fetched>" } ]
}`;

const { trades, sources, gradeSources, ai, recap, lesson, ...forecast } = entry;
const USER = `Today is ${today} (Saskatchewan date). The week this forecast covers ended with the ${entry.gradeBy} close. Grade calls ${todo.map((c) => c.n).join(", ")}.

<forecast>
${JSON.stringify({ ...forecast, calls: open.map(({ graded, ...c }) => c) }, null, 1)}
</forecast>`;

const res = await askClaudeWeb({
  model: MODEL,
  effort: EFFORT,
  system: SYSTEM,
  user: USER,
  maxTokens: 24000,
  maxSearches: MAX_SEARCHES,
  maxFetches: MAX_FETCHES,
  check: (t) => readJson(t, MARKER) !== null,
  fix: `Give those grades again as the JSON object from your instructions, after the line ${MARKER}. Keep the same facts; use "unknown" for anything you didn't confirm.`,
  // Sent as a batch (half price): the grades only need to be in by Sunday night.
  batch: { name: "scorekeeper", key: entry.date },
});
logWebCost(MODEL, res.usage, MAX_SEARCHES, MAX_FETCHES);
const answer = readJson(res.text, MARKER);
if (!answer) throw new Error("Claude didn't return the grades in the expected format.");

/* ---------- Check and fill in ---------- */
const clean = (v, max = 400) =>
  typeof v === "string"
    ? v.replace(/\s*—\s*/g, ", ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
    : "";

const updated = structuredClone(entry);
let filled = 0;
for (const g of Array.isArray(answer.calls) ? answer.calls : []) {
  const i = Number(g?.n) - 1;
  const call = updated.calls[i];
  if (!call || !todo.some((c) => c.n === i + 1)) continue;
  const grade = String(g.grade || "").toLowerCase();
  if (!GRADES.includes(grade)) {
    console.warn(`Call ${i + 1}: couldn't confirm, left ungraded.`);
    continue;
  }
  call.grade = grade;
  const result = clean(g.result, 260);
  if (result) call.result = result;
  filled++;
}
const stillOpen = updated.calls.filter((c) => !isGraded(c)).length;

// The recap, coach note and lesson only go in once every call is graded,
// so they never describe a half-finished week.
if (!stillOpen) {
  const coach = clean(answer.ai, 1600);
  if (/\byou(r|rs)?\b/i.test(coach)) console.warn("The coach note says \"you\" somewhere; it should judge the calls, not the person.");
  if (FORCE || !updated.recap) updated.recap = clean(answer.recap, 3000) || updated.recap;
  if (FORCE || !updated.ai) updated.ai = coach || updated.ai;
  if (FORCE || !updated.lesson) updated.lesson = clean(answer.lesson, 500) || updated.lesson;
}
const found = seenSources(res.blocks, answer.sources, 10);
if (found.length) updated.gradeSources = found;
updated.graded = { by: "scorekeeper", at: now.toISOString() };

console.log(`Filled ${filled} grades: ${updated.calls.map((c, i) => `${i + 1} ${c.grade || "open"}`).join(", ")}.`);
if (stillOpen) console.log(`${stillOpen} call(s) still ungraded; the recap waits until they're done.`);
if (!filled && !FORCE) {
  console.log("Nothing new to save.");
  process.exit(0);
}

if (DRY_RUN) {
  console.log("Dry run: the entry would become:");
  console.log(JSON.stringify(updated, null, 2));
  process.exit(0);
}
// The batch can take a while, so write onto the newest journal.json in
// case another robot (the Forecaster) saved to it in the meantime.
pullLatest();
const latest = JSON.parse(await readFile(FILE, "utf8"));
const at = latest.findIndex((e) => e && e.date === entry.date && e.title === entry.title);
if (at < 0) throw new Error(`The entry for ${entry.date} isn't in journal.json any more. Nothing saved.`);
latest[at] = updated;
await writeFile(FILE, JSON.stringify(latest, null, 2) + "\n");
setOutput("written", "true");

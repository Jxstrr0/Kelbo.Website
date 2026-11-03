// =====================================================================
// WHAT THE BRIEF IS WORKING ON (weekly lessons from the report cards)
// ---------------------------------------------------------------------
// Once a week this reads every after-close report card from the last 28
// days, the briefs they graded, the running totals and last week's
// lessons, and asks Claude (one call, no web search) for 3 to 5 lessons
// about HOW the brief works: its sizing, its levels, its confidence.
// Never market predictions.
//
// It writes lessons/latest.json and a dated copy lessons/YYYY-MM-DD.json.
// The next morning's brief (premarket-brief.mjs) reads latest.json while
// it's under 14 days old, and briefs.html lists the lessons on the After
// close tab. The report cards and briefs are only read here, never changed.
//
// Guardrails:
//   - Fewer than MIN_CARDS graded cards in the window: no call, nothing written.
//   - The answer is checked: each lesson needs an instruction, a status
//     (new, kept, retired) and evidence naming real card dates. Anything
//     that fails is dropped, and at most MAX_ACTIVE stay active.
//
// Run with:  node .github/scripts/brief-lessons.mjs
// DRY_RUN=1 prints the lessons without writing any files.
// =====================================================================

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { askClaude, logCost, readJson, skDate, DRY_RUN } from "./claude.mjs";

const MODEL = "claude-opus-5-5";
const WINDOW_DAYS = 28; // how far back to read report cards
const MIN_CARDS = 5; // fewer graded cards than this and it waits a week
const MAX_ACTIVE = 5; // most lessons the brief is asked to follow at once
const MARKER = "===LESSONS===";
const CARDS_DIR = "report-cards";
const BRIEFS_DIR = "briefs";
const LESSONS_DIR = "lessons";
const STATUSES = ["new", "kept", "retired"];
const GRADED = ["hit", "partial", "miss"]; // a gap call that really got a grade

const today = skDate();
const dayMs = 864e5;
const from = new Date(Date.parse(today + "T12:00:00Z") - (WINDOW_DAYS - 1) * dayMs).toISOString().slice(0, 10);

/* ---------- The report cards in the window ---------- */
const cards = {};
for (const name of (await readdir(CARDS_DIR).catch(() => [])).filter((f) => /^\d{4}-\d{2}\.json$/.test(f))) {
  if (name.slice(0, 7) < from.slice(0, 7)) continue; // a month wholly before the window
  let month;
  try {
    month = JSON.parse(await readFile(`${CARDS_DIR}/${name}`, "utf8"));
  } catch {
    console.warn(`Couldn't read ${CARDS_DIR}/${name}; skipping it.`);
    continue;
  }
  for (const [date, card] of Object.entries(month)) {
    if (date >= from && date <= today && card && typeof card === "object") cards[date] = card;
  }
}
const dates = Object.keys(cards).sort();
const graded = dates.filter((d) => GRADED.includes(cards[d].gap?.grade));
console.log(`Window ${from} to ${today}: ${dates.length} report card(s), ${graded.length} with a graded gap call.`);
if (graded.length < MIN_CARDS) {
  console.log(`Skipped: lessons need at least ${MIN_CARDS} graded report cards in the last ${WINDOW_DAYS} days. No call made, nothing written.`);
  process.exit(0);
}

/* ---------- The briefs they graded, totals, last lessons ---------- */
const briefs = [];
for (const date of dates) {
  try {
    const text = await readFile(`${BRIEFS_DIR}/${date}.md`, "utf8");
    briefs.push(`<brief date="${date}">\n${text.split(/^## Sources\s*$/m)[0].trim()}\n</brief>`);
  } catch {
    briefs.push(`<brief date="${date}">(This brief is no longer in the archive.)</brief>`);
  }
}
let totals = null;
try {
  totals = JSON.parse(await readFile(`${CARDS_DIR}/index.json`, "utf8"));
} catch { /* the page works without it */ }
let previous = null;
try {
  previous = JSON.parse(await readFile(`${LESSONS_DIR}/latest.json`, "utf8"));
} catch { /* first week */ }
const previousActive = (previous?.lessons || []).filter((l) => l && l.status !== "retired");

// The cards without their sources and timestamps (not needed for lessons).
const cardText = dates
  .map((d) => {
    const { sources, time, ...rest } = cards[d];
    return JSON.stringify({ ...rest, date: d });
  })
  .join("\n");

/* ---------- Ask Claude ---------- */
const SYSTEM = `You coach the writer of a daily pre-market trading brief. The brief is written each weekday morning before the US open for a part-time day trader in Saskatoon who mostly trades MU (Micron). Each brief gives a gap call (direction and size for MU's open) and key support and resistance levels. After the close, a report card grades it: the gap call as hit, partial or miss, and each level as held, broke, untested or unknown.

Your job: read the report cards, the briefs they graded, the running totals and last week's lessons, and write 3 to 5 lessons about the brief's PROCESS and calibration. Good lessons are about how the brief works, for example:
- the gap sizes it calls are too big or too small compared with the real opens,
- supports or resistances are listed too close to the price, or too far to ever be tested,
- it gets overconfident after a big up or down day,
- it leans on one kind of source or level too much.

Rules:
- Never predict the market or say where MU is going. No price targets, no prices at all.
- Never change, redo or question a grade. The report cards are final; take every grade as given.
- Every lesson must come from patterns you can point to in these cards. Name the card dates that show it, and a count, like "5 of 7 gap calls too big". Only use dates from the cards you were given.
- "text" is one plain sentence, written as an instruction the brief writer can follow tomorrow morning.
- Status: "new" for a lesson that wasn't in last week's list, "kept" for one that still applies (you may tighten the wording), "retired" for last week's lesson that recent cards show is fixed. Retire a lesson only when the newest cards show the problem is gone, and say so in its evidence.
- At most ${MAX_ACTIVE} lessons may be new or kept. Fewer, sharper lessons beat more.

Output the line ${MARKER} and then only this JSON, nothing after it:
{"lessons": [{"text": "...", "evidence": {"count": "5 of 7 gap calls too big", "dates": ["YYYY-MM-DD", "..."]}, "status": "new"}]}`;

const lastWeek = previousActive.length
  ? previousActive.map((l) => `- ${l.text} (evidence: ${l.evidence?.count || "none given"})`).join("\n")
  : "(None. This is the first week.)";

const user = `Today is ${today}. Window: ${from} to ${today}, ${dates.length} report cards (${graded.length} with a graded gap call).

Running totals for every card so far (report-cards/index.json):
${totals ? JSON.stringify({ days: totals.days, gap: totals.gap, levels: totals.levels }) : "(not available)"}

Last week's active lessons:
${lastWeek}

The report cards, one per line, oldest first:
<report_cards>
${cardText}
</report_cards>

The briefs those cards graded (sources removed):
${briefs.join("\n\n")}

Write this week's lessons.`;

const { text, usage } = await askClaude({ model: MODEL, system: SYSTEM, user, maxTokens: 16000 });

/* ---------- Check the answer ---------- */
const answer = readJson(text, MARKER);
if (!answer || !Array.isArray(answer.lessons)) {
  logCost(MODEL, usage);
  console.error("Claude's answer wasn't the expected JSON, so nothing was written. The answer was:\n" + text.slice(-2000));
  process.exit(1);
}

const realDates = new Set(dates);
const oldTexts = new Set(previousActive.map((l) => String(l.text).toLowerCase()));
const lessons = [];
let active = 0;
for (const [i, raw] of answer.lessons.entries()) {
  const label = `Lesson ${i + 1}`;
  const textOk = typeof raw?.text === "string" ? raw.text.replace(/\s+/g, " ").trim() : "";
  if (textOk.length < 10 || textOk.length > 300) { console.warn(`${label} dropped: its text is missing or too long.`); continue; }
  // A dollar figure means a price, and lessons never carry prices.
  if (/\$\s?\d/.test(textOk)) { console.warn(`${label} dropped: it names a price ("${textOk}").`); continue; }
  let status = STATUSES.includes(raw.status) ? raw.status : null;
  if (!status) { console.warn(`${label} dropped: status "${raw.status}" isn't new, kept or retired.`); continue; }
  if (status === "kept" && !previousActive.length) status = "new"; // nothing to keep yet
  const count = typeof raw.evidence?.count === "string" ? raw.evidence.count.trim().slice(0, 160) : "";
  const all = Array.isArray(raw.evidence?.dates) ? raw.evidence.dates.map(String) : [];
  const good = [...new Set(all.filter((d) => realDates.has(d)))].sort();
  const bad = all.filter((d) => !realDates.has(d));
  if (bad.length) console.warn(`${label}: dropped evidence dates that aren't report cards: ${bad.join(", ")}`);
  if (!count || !good.length) { console.warn(`${label} dropped: its evidence needs a count and at least one real card date.`); continue; }
  if (status !== "retired") {
    if (active >= MAX_ACTIVE) { console.warn(`${label} dropped: already ${MAX_ACTIVE} active lessons.`); continue; }
    active++;
  }
  lessons.push({ text: textOk, evidence: { count, dates: good }, status });
}
const retiredByModel = lessons.filter((l) => l.status === "retired").length;
console.log(`Kept ${lessons.length} of ${answer.lessons.length} lessons (${active} active, ${retiredByModel} retired). Last week had ${oldTexts.size} active.`);

const out = { updated: new Date().toISOString(), window: { from, to: today }, cards: graded.length, lessons };
console.log(JSON.stringify(out, null, 2));
logCost(MODEL, usage);

if (!active) {
  console.error("No usable active lessons came back, so last week's file stays as it was.");
  process.exit(1);
}
if (DRY_RUN) {
  console.log("Dry run: nothing written.");
  process.exit(0);
}
await mkdir(LESSONS_DIR, { recursive: true });
const json = JSON.stringify(out, null, 2) + "\n";
await writeFile(`${LESSONS_DIR}/latest.json`, json);
await writeFile(`${LESSONS_DIR}/${today}.json`, json);
console.log(`Wrote ${LESSONS_DIR}/latest.json and ${LESSONS_DIR}/${today}.json.`);

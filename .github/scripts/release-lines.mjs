// =====================================================================
// PLAYER-FRIENDLY "WHAT'S NEW" LINES
// ---------------------------------------------------------------------
// Each game's card shows "v1.4 · <what changed>". The deploy fills that
// in from the game's newest GitHub Release (sync-releases.mjs), and
// release titles are often written for coders ("fix sim tick drift").
//
// Every 6 hours this checks each game's newest release. Any release that
// release-lines.json doesn't have yet (keyed "<repo>@<tag>", for example
// "350Chev@v1.2.0") goes to Claude in ONE call for all of them, to be
// rewritten as a single line for players: 90 characters at most, no
// version number, only what the title and notes say. Nothing new: no call.
//
// release-lines.json holds { "350Chev@v1.2.0": { "line", "title", "at" } }:
// the line, the original release title, and when it was written. Kelbo can
// edit any "line" by hand; this script never changes an entry that exists.
//
// Run with:  node .github/scripts/release-lines.mjs
// DRY_RUN=1 prints the new lines without changing release-lines.json.
// =====================================================================

import { readFile, writeFile } from "node:fs/promises";
import { askClaude, logCost, readJson, setOutput, DRY_RUN } from "./claude.mjs";

const MODEL = "claude-sonnet-5-5";
const FILE = "release-lines.json";
const MAX_LINE = 90;
const NOTES_CHARS = 2000; // release notes are cut to about this long
const MARKER = "===LINES===";

// The saved lines. Missing is fine (first run); broken JSON stops here, so
// a hand edit with a typo is never overwritten.
let saved = {};
try {
  saved = JSON.parse(await readFile(FILE, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") {
    console.error(`${FILE} isn't valid JSON (${e.message}). Fix it and run again; nothing was changed.`);
    process.exit(1);
  }
}
if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
  console.error(`${FILE} should be an object ({ ... }). Nothing was changed.`);
  process.exit(1);
}

const headers = { Accept: "application/vnd.github+json", "User-Agent": "longlight-release-lines" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

/* ---------- Which games have a release with no line yet? ---------- */
// Hidden projects ("hidden": true) are off the site, so they're skipped.
// SKIP_REPOS are games whose card keeps its plain release title: no paid
// call for them (Kelbo, 2026-11-11, to keep the robot's bill where it was).
const SKIP_REPOS = new Set(["SeasonTicket", "Lombard", "FrontierLab", "RedSkies"]);
const projects = JSON.parse(await readFile("projects.json", "utf8")).filter((p) => !p.hidden);
const fresh = []; // { key, game, title, notes }
for (const p of projects) {
  const m = (p.code || "").match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!m) continue;
  const name = m[2].replace(/\.git$/, "");
  if (SKIP_REPOS.has(name)) { console.log(`${p.title}: on the skip list, keeps its release title.`); continue; }
  let release;
  try {
    const res = await fetch(`https://api.github.com/repos/${m[1]}/${name}/releases/latest`, { headers });
    if (res.status === 404) { console.log(`${p.title}: no releases yet.`); continue; }
    if (!res.ok) { console.warn(`${p.title}: couldn't reach GitHub (${res.status}), skipped.`); continue; }
    release = await res.json();
  } catch (e) {
    console.warn(`${p.title}: couldn't reach GitHub (${e.message}), skipped.`);
    continue;
  }
  const tag = release.tag_name || "";
  // sync-releases.mjs only uses tags that are version numbers, so skip the rest.
  if (!/^\d/.test(tag.replace(/^v/i, ""))) { console.log(`${p.title}: tag "${tag}" isn't a version, skipped.`); continue; }
  const key = `${name}@${tag}`;
  if (saved[key]) { console.log(`${p.title}: ${key} already has a line.`); continue; }
  const notes = String(release.body || "").replace(/<!--[\s\S]*?-->/g, "").trim();
  fresh.push({ key, game: p.title, title: release.name || tag, notes: notes.length > NOTES_CHARS ? notes.slice(0, NOTES_CHARS) + " …" : notes });
  console.log(`${p.title}: ${key} is new ("${release.name || tag}").`);
}

if (!fresh.length) {
  console.log("No new releases without a line. No call made.");
  setOutput("added", 0);
  process.exit(0);
}

/* ---------- Ask Claude, once for all of them ---------- */
const SYSTEM = `You write the one-line "What's new" note players see on a game's card on the Longlight Interactive website, a small indie studio's site of free browser games.

For each game release you get its release title and notes. Rewrite each as ONE line for players.

Rules:
- ${MAX_LINE} characters at most. One sentence, ending with a full stop.
- No version numbers, no tag names.
- Only what the title and notes say. Never invent a feature or a number. If the notes are thin, keep the line modest.
- No developer jargon: no "refactor", "fix bug in", "tick", "PR", "merge", file or function names. Say what a player will see or feel.
- Example: release title "fix sim tick drift" becomes "Races no longer slow down late in a season."

Output the line ${MARKER} and then only this JSON, one entry per release key, nothing after it:
{"lines": {"<key>": "<line>"}}`;

const user = `The new releases:
${JSON.stringify(fresh, null, 1)}

Write one line for each key.`;

const { text, usage } = await askClaude({ model: MODEL, system: SYSTEM, user, maxTokens: 8000 });
const answer = readJson(text, MARKER);
if (!answer || typeof answer.lines !== "object" || !answer.lines) {
  logCost(MODEL, usage);
  console.error("Claude's answer wasn't the expected JSON, so nothing was written. The answer was:\n" + text.slice(-2000));
  process.exit(1);
}

/* ---------- Check each line, then save the good ones ---------- */
const added = {};
for (const r of fresh) {
  const line = typeof answer.lines[r.key] === "string" ? answer.lines[r.key].replace(/\s+/g, " ").trim() : "";
  if (!line) { console.warn(`${r.key}: no line came back; the card keeps the release title for now.`); continue; }
  if (line.length > MAX_LINE) { console.warn(`${r.key}: "${line}" is over ${MAX_LINE} characters, dropped.`); continue; }
  if (/\bv?\d+\.\d+/i.test(line)) { console.warn(`${r.key}: "${line}" has a version number, dropped.`); continue; }
  added[r.key] = { line, title: r.title, at: new Date().toISOString() };
  console.log(`${r.key}: "${r.title}"  →  "${line}"`);
}
logCost(MODEL, usage);
const count = Object.keys(added).length;
setOutput("added", DRY_RUN ? 0 : count);
if (!count) {
  console.log("No usable lines this time; nothing written.");
  process.exit(0);
}
if (DRY_RUN) {
  console.log("Dry run: release-lines.json not changed.");
  process.exit(0);
}
// Existing entries first and untouched; only new keys are added.
await writeFile(FILE, JSON.stringify({ ...saved, ...Object.fromEntries(Object.entries(added).filter(([k]) => !saved[k])) }, null, 2) + "\n");
console.log(`Added ${count} line(s) to ${FILE}.`);

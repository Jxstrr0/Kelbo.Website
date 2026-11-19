// =====================================================================
// SYNC GAME RELEASES
// ---------------------------------------------------------------------
// Fills in each game's "version" and "latest" on the live site from the
// newest GitHub Release in that game's own repo, so shipping a game
// updates the site without anyone touching projects.json.
//
// How it decides, for every project with a GitHub "code" link:
//   - No releases yet: leaves projects.json exactly as written.
//   - The release is the same version or newer: uses the release.
//       version = the tag without the "v", padded to four numbers
//                 (tag v1.2.0  ->  "1.2.0.0")
//       latest  = the player-friendly line for that exact release from
//                 release-lines.json (written by release-lines.mjs), or
//                 if there isn't one, the release title minus any
//                 version at the front ("v1.2.0 - Night mode" -> "Night mode")
//   - projects.json has a NEWER version than the newest release (you
//     bumped it by hand but didn't publish a release): keeps the hand
//     version and prints a reminder.
//
// It only changes the copy of the site being deployed (the folder you
// pass in, normally _site). The projects.json in the repo is never
// edited, so this never makes commits.
//
// Run it with:  node .github/scripts/sync-releases.mjs _site
// GITHUB_TOKEN is optional locally; in Actions it's provided for free.
// =====================================================================

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] || ".";
const FILE = join(ROOT, "projects.json");
const projects = JSON.parse(readFileSync(FILE, "utf8"));

const headers = { Accept: "application/vnd.github+json", "User-Agent": "longlight-site-sync" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

// "1.10.2" vs "1.9" -> compares number by number, so 1.10 > 1.9.
function compare(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Every Longlight game uses four numbers, Major.Minor.Patch.Build, so an
// older or shorter tag is padded with zeros: "1.5" -> "1.5.0.0".
function fourPart(v) {
  const parts = String(v).split(".");
  while (parts.length < 4) parts.push("0");
  return parts.join(".");
}

// A release's words come from another repo, so they are tidied before they
// go on a card and into the feed. Out come: control characters (XML has no
// way to write them, so a single one would break feed.xml), the invisible
// marks that flip or hide text, and halves of a broken emoji. What is left
// is put on one line and cut to a card's length.
const MAX_LATEST = 140;
function tidy(text) {
  const clean = (typeof text === "string" ? text : "")
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFFFE\uFFFF]/g, " ")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const letters = Array.from(clean); // whole characters, so an emoji is never cut in half
  return letters.length > MAX_LATEST ? letters.slice(0, MAX_LATEST - 1).join("").trimEnd() + "…" : clean;
}

// A real day ("2026-11-19"), not after tomorrow: the feed sorts and dates by it.
function realDay(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(text)) return "";
  const day = text.slice(0, 10);
  const at = Date.parse(day + "T12:00:00Z");
  if (Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== day || at > Date.now() + 36 * 3600 * 1000) return "";
  return day;
}

// Takes the version tag off the front of a release title.
function cleanTitle(title, tag) {
  return (typeof title === "string" ? title : "")
    .replace(/\s+/g, " ") // one line: it is shown on a card and printed in the run log
    .replace(new RegExp(`^\\s*${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    .replace(/^\s*v?\d+(\.\d+)*\s*/i, "")
    .replace(/^[\s\-–—:·|]+/, "")
    .trim();
}

// Player-friendly lines written by release-lines.mjs, keyed "<repo>@<tag>"
// (Kelbo may have edited some by hand). Missing or broken: use the
// release titles, as before.
let lines = {};
try {
  const parsed = JSON.parse(readFileSync(join(ROOT, "release-lines.json"), "utf8"));
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) lines = parsed;
} catch { /* no lines yet */ }

const report = [];
let changed = 0;

for (const p of projects) {
  const m = (p.code || "").match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!m) continue;
  const repo = `${m[1]}/${m[2].replace(/\.git$/, "")}`;

  let release;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
    if (res.status === 404) { report.push(`- ${p.title}: no releases yet, kept projects.json as written`); continue; }
    if (!res.ok) { report.push(`- ${p.title}: couldn't reach GitHub (${res.status}), kept projects.json as written`); continue; }
    release = await res.json();
  } catch (e) {
    report.push(`- ${p.title}: couldn't reach GitHub (${e.message}), kept projects.json as written`);
    continue;
  }

  // GitHub answers with an object; anything else has no tag to read.
  const tag = release && typeof release.tag_name === "string" ? release.tag_name : "";
  const bare = tag.replace(/^v/i, "");
  // A version is one to four short numbers with dots between ("1.2",
  // "1.76.87.2") and nothing else. It is written into pages and the feed,
  // so a tag with letters or symbols in it is never used. (The tag is
  // tidied and shortened before it is printed, as it is someone's text.)
  if (!/^\d{1,6}(\.\d{1,6}){0,3}$/.test(bare)) { report.push(`- ${p.title}: newest release tag ${JSON.stringify(tidy(tag).slice(0, 40))} isn't a version number, skipped`); continue; }
  const version = fourPart(bare);

  if (p.version && compare(p.version, version) > 0) {
    report.push(`- ${p.title}: ⚠️ projects.json says ${p.version} but the newest release is ${tag}. Publish a release for ${p.version} so they match.`);
    continue;
  }

  const own = lines[`${m[2].replace(/\.git$/, "")}@${tag}`]?.line;
  // A release title is often a commit summary that starts lowercase, so the
  // fallback gets a capital first letter to read as a sentence on the card.
  const fallback = tidy(cleanTitle(release.name, tag));
  const title = typeof own === "string" && tidy(own)
    ? tidy(own)
    : fallback && fallback.charAt(0).toUpperCase() + fallback.slice(1);
  const before = `${p.version} · ${p.latest}`;
  const versionMoved = compare(version, p.version || "0") !== 0;
  p.version = version;
  // The day the release went out, for the feed (make-feed.mjs). Only in
  // the deploy copy, like everything else this script fills in.
  if (realDay(release.published_at)) p.released = realDay(release.published_at);
  if (title) p.latest = title;
  // New version but the release has no title: blank "latest" rather than
  // show the old version's description next to the new number.
  else if (versionMoved) p.latest = "";
  const after = `${p.version} · ${p.latest}`;

  if (before !== after) { changed++; report.push(`- ${p.title}: ${before}  →  ${after}  (from ${tag})`); }
  else report.push(`- ${p.title}: already up to date (${tag})`);
}

writeFileSync(FILE, JSON.stringify(projects, null, 2) + "\n");

const summary = `## Game releases\n${changed ? `Updated ${changed} game${changed > 1 ? "s" : ""} from their newest release.` : "No version changes."}\n\n${report.join("\n")}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

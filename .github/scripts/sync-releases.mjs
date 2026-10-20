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
//       version = the tag without the "v"   (tag v1.2.0  ->  "1.2.0")
//       latest  = the release title, minus any version at the front
//                 ("v1.2.0 - Night mode"  ->  "Night mode")
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

// Takes the version tag off the front of a release title.
function cleanTitle(title, tag) {
  return String(title || "")
    .replace(new RegExp(`^\\s*${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    .replace(/^\s*v?\d+(\.\d+)*\s*/i, "")
    .replace(/^[\s\-–—:·|]+/, "")
    .trim();
}

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

  const tag = release.tag_name || "";
  const version = tag.replace(/^v/i, "");
  if (!/^\d/.test(version)) { report.push(`- ${p.title}: newest release tag "${tag}" isn't a version number, skipped`); continue; }

  if (p.version && compare(p.version, version) > 0) {
    report.push(`- ${p.title}: ⚠️ projects.json says ${p.version} but the newest release is ${tag}. Publish a release for ${p.version} so they match.`);
    continue;
  }

  const title = cleanTitle(release.name, tag);
  const before = `${p.version} · ${p.latest}`;
  const versionMoved = compare(version, p.version || "0") !== 0;
  p.version = version;
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

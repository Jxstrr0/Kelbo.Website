// =====================================================================
// SITE CHECK
// ---------------------------------------------------------------------
// Looks over the site for the mistakes that would break it once live:
// a JSON file that won't load, a JavaScript file with a typo in it, a
// picture or page that a link points at but doesn't exist.
//
// It runs by itself on every pull request (site-check.yml) and again
// right before every deploy (deploy.yml). If it finds an ERROR, the
// check goes red and the deploy stops, so the live site keeps showing
// the last version that worked. WARNINGS are things worth a look that
// won't break anything; they never turn the check red.
//
// Run it yourself with:  node .github/scripts/check-site.mjs
// (or pass a folder:      node .github/scripts/check-site.mjs _site)
// No npm packages needed. Plain Node only.
// =====================================================================

import { readFileSync, existsSync, readdirSync, statSync, appendFileSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.argv[2] || ".";
const errors = [];
const warnings = [];

// Same problem found twice (say, a link repeated in a page) is reported once.
const add = (list) => (file, msg) => { if (!list.some((x) => x.file === file && x.msg === msg)) list.push({ file, msg }); };
const error = add(errors);
const warn = add(warnings);

// Every file in the site, skipping Git's own folders and the deploy copy.
function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if ([".git", ".github", "_site", "node_modules"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const files = listFiles(ROOT);
const rel = (f) => relative(ROOT, f);
const exists = (p) => existsSync(join(ROOT, p));

// ---------------------------------------------------------------------
// 1. Every JSON file must load. One missing comma here can blank a page.
// ---------------------------------------------------------------------
const json = {};
for (const f of files.filter((f) => extname(f) === ".json" || f.endsWith(".webmanifest"))) {
  try {
    json[rel(f)] = JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    error(rel(f), `This file isn't valid JSON, so the page that reads it will break. (${e.message})`);
  }
}

// ---------------------------------------------------------------------
// 2. Every JavaScript file must at least read correctly (no typos that
//    stop it running). `node --check` reads the file without running it.
// ---------------------------------------------------------------------
for (const f of files.filter((f) => extname(f) === ".js")) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    const detail = (e.stderr || "").toString().split("\n").slice(0, 5).join(" ").trim();
    error(rel(f), `This JavaScript file has a mistake that would stop it running. ${detail}`);
  }
}

// ---------------------------------------------------------------------
// 3. projects.json: every project has what the site needs to show it.
// ---------------------------------------------------------------------
// Keep in step with STATUSES at the top of main.js (those get a progress bar).
const KNOWN_STATUS = [
  "Complete", "Released", "Live", "Polishing",
  "In development", "Prototype", "Concept",
];
// Names used before October 2026. main.js still understands them, but
// the check nudges you to the new one.
const OLD_STATUS = {
  "Finished - Final Form": "Complete", "Finished - For Now": "Released",
  "Ongoing": "Live", "Mostly done": "Polishing", "Building": "In development",
  "Early stages": "Prototype", "Planned": "Concept",
};
const KNOWN_CATEGORY = ["Game", "Trading", "AI"];
const projects = json["projects.json"];

if (projects !== undefined) {
  if (!Array.isArray(projects)) {
    error("projects.json", "Should be a list (starting with [ ) of projects.");
  } else {
    const seen = new Set();
    projects.forEach((p, i) => {
      const name = p && p.title ? `"${p.title}"` : `project #${i + 1}`;
      for (const key of ["title", "status", "category", "summary"]) {
        if (typeof p[key] !== "string" || !p[key].trim()) error("projects.json", `${name} is missing its "${key}".`);
      }
      for (const key of ["version", "latest"]) {
        if (p[key] !== undefined && typeof p[key] !== "string") error("projects.json", `${name}: "${key}" should be text in quotes.`);
      }
      if (typeof p.version === "string" && /^v/i.test(p.version)) warn("projects.json", `${name}: write the version without the "v" ("${p.version.slice(1)}"), the site adds it.`);
      if (p.featured !== undefined && typeof p.featured !== "boolean") error("projects.json", `${name}: "featured" should be true or false (no quotes).`);
      if (p.title) {
        if (seen.has(p.title)) error("projects.json", `${name} is listed twice.`);
        seen.add(p.title);
      }
      if (OLD_STATUS[p.status]) warn("projects.json", `${name} uses the old status "${p.status}". It still works, but the new name is "${OLD_STATUS[p.status]}".`);
      else if (p.status && !KNOWN_STATUS.includes(p.status)) warn("projects.json", `${name} has the status "${p.status}", which the site hasn't seen before. Fine if it's on purpose.`);
      if (p.category && !KNOWN_CATEGORY.includes(p.category)) warn("projects.json", `${name} has the category "${p.category}", so it won't appear on the Games, Trading or AI pages.`);
      if (p.image && !exists(p.image)) error("projects.json", `${name}: the cover image "${p.image}" doesn't exist.`);
      if (p.link && !/^https?:\/\//.test(p.link) && !exists(p.link.split(/[?#]/)[0])) error("projects.json", `${name}: the link "${p.link}" points at a file that doesn't exist.`);
      if (p.shots !== undefined) {
        if (!Array.isArray(p.shots)) error("projects.json", `${name}: "shots" should be a list.`);
        else p.shots.forEach((s, j) => {
          if (!s || !s.src) error("projects.json", `${name}: screenshot #${j + 1} has no "src".`);
          else if (!exists(s.src)) error("projects.json", `${name}: the screenshot "${s.src}" doesn't exist.`);
          if (s && !s.alt) warn("projects.json", `${name}: screenshot #${j + 1} has no "alt" text (screen readers read this out).`);
        });
      }
    });
  }
}

// ---------------------------------------------------------------------
// 4. now.json: the "Now building" strip. Catch it going out of date.
// ---------------------------------------------------------------------
const now = json["now.json"];
if (now !== undefined) {
  if (!Array.isArray(now.items)) error("now.json", 'Needs an "items" list.');
  else {
    now.items.forEach((it, i) => {
      if (!it || !it.text) error("now.json", `Item #${i + 1} has no "text".`);
    });
    // An item pointing at a game that projects.json says is finished.
    if (Array.isArray(projects)) {
      for (const it of now.items) {
        const p = projects.find((p) => p.link && it && it.link === p.link);
        if (p && /^(Complete|Released|Finished)/.test(p.status)) warn("now.json", `"Now building" still lists "${it.text}", but projects.json marks ${p.title} as "${p.status}".`);
      }
    }
  }
  if (now.updated) {
    const days = Math.floor((Date.now() - new Date(now.updated)) / 86400000);
    if (days > 21) warn("now.json", `The "Now building" strip was last updated ${days} days ago.`);
  }
}

// ---------------------------------------------------------------------
// 5. Every local link and picture in the HTML pages must exist.
//    (Web addresses like https://... are skipped; this only checks
//    files inside the site.)
// ---------------------------------------------------------------------
const SKIP = /^(https?:|\/\/|mailto:|tel:|data:|javascript:|#|\{|\$)/;
for (const f of files.filter((f) => extname(f) === ".html")) {
  const html = readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const base = dirname(f);
  for (const m of html.matchAll(/\s(?:src|href)\s*=\s*"([^"]*)"/g)) {
    const url = m[1].trim();
    if (!url || SKIP.test(url)) continue;
    const path = url.split(/[?#]/)[0];
    if (!path || path === "./" || path.endsWith("/")) {
      const folder = join(base, path || ".");
      if (!existsSync(join(folder, "index.html"))) error(rel(f), `Links to "${url}", but there's no index.html there.`);
      continue;
    }
    if (!existsSync(join(base, path))) error(rel(f), `Links to "${url}", which doesn't exist.`);
  }
}

// ---------------------------------------------------------------------
// 6. The offline helper's list of files (sw.js) must all exist,
//    and every page should be in the sitemap so search engines find it.
// ---------------------------------------------------------------------
if (exists("sw.js")) {
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const core = sw.match(/const CORE\s*=\s*\[([\s\S]*?)\]/);
  if (core) {
    for (const m of core[1].matchAll(/"([^"]+)"/g)) {
      const p = m[1];
      if (p === "./") continue;
      if (!exists(p)) warn("sw.js", `The offline list includes "${p}", which doesn't exist (it just won't be saved for offline).`);
    }
  }
}
if (exists("sitemap.xml")) {
  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const pages = files.filter((f) => dirname(f) === ROOT && extname(f) === ".html").map(rel);
  for (const page of pages) {
    if (["404.html", "index.html", "game.html"].includes(page)) continue;
    if (!sitemap.includes(page)) warn("sitemap.xml", `${page} isn't in the sitemap.`);
  }
}

// ---------------------------------------------------------------------
// Report. In GitHub, errors and warnings also show up as notes on the
// files themselves, and as a plain-English summary on the run's page.
// ---------------------------------------------------------------------
const inActions = !!process.env.GITHUB_ACTIONS;
for (const { file, msg } of errors) console.log(inActions ? `::error file=${file}::${msg}` : `ERROR    ${file}: ${msg}`);
for (const { file, msg } of warnings) console.log(inActions ? `::warning file=${file}::${msg}` : `WARNING  ${file}: ${msg}`);

const line = (x) => `- **${x.file}**: ${x.msg}`;
const summary = [
  errors.length ? `## ❌ Site check found ${errors.length} problem${errors.length > 1 ? "s" : ""}` : "## ✅ Site check passed",
  "",
  errors.length ? "These would break the live site, so they need fixing before this goes live:\n" + errors.map(line).join("\n") : "Nothing that would break the site.",
  "",
  warnings.length ? `### Worth a look (won't block anything)\n` + warnings.map(line).join("\n") : "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);

// =====================================================================
// SITE CHECK
// ---------------------------------------------------------------------
// Looks over the site for the mistakes that would break it once live:
// a JSON file that won't load, a JavaScript file with a typo in it, a
// picture or page that a link points at but doesn't exist. It also scans
// for private things that must never be published (emails, phone and
// account numbers, keys, dollar amounts in the trading data).
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
const KNOWN_CATEGORY = ["Game", "Trading", "Tool"];
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
      // Games use four numbers, Major.Minor.Patch.Build ("1.6.0.0").
      if (p.category === "Game" && typeof p.version === "string" && p.version.trim() && !/^v?\d+\.\d+\.\d+\.\d+$/i.test(p.version.trim())) warn("projects.json", `${name}: game versions use four numbers, Major.Minor.Patch.Build (like "1.6.0.0"), not "${p.version}".`);
      if (typeof p.version === "string" && /^v/i.test(p.version)) warn("projects.json", `${name}: write the version without the "v" ("${p.version.slice(1)}"), the site adds it.`);
      if (p.featured !== undefined && typeof p.featured !== "boolean") error("projects.json", `${name}: "featured" should be true or false (no quotes).`);
      if (p.title) {
        if (seen.has(p.title)) error("projects.json", `${name} is listed twice.`);
        seen.add(p.title);
      }
      if (OLD_STATUS[p.status]) warn("projects.json", `${name} uses the old status "${p.status}". It still works, but the new name is "${OLD_STATUS[p.status]}".`);
      else if (p.status && !KNOWN_STATUS.includes(p.status)) warn("projects.json", `${name} has the status "${p.status}", which the site hasn't seen before. Fine if it's on purpose.`);
      if (p.category && !KNOWN_CATEGORY.includes(p.category)) warn("projects.json", `${name} has the category "${p.category}", so it won't appear on the Games, Trading or Tools pages.`);
      if (p.image && !exists(p.image)) error("projects.json", `${name}: the cover image "${p.image}" doesn't exist.`);
      // Each picture should have a double-size twin ("name@2x.jpg") for sharp
      // phone screens. The site falls back to the small one, so only a warning.
      const twin = (src) => String(src).replace(/(\.[a-z]+)$/i, "@2x$1");
      if (p.image && exists(p.image) && !exists(twin(p.image))) warn("projects.json", `${name}: no sharp version "${twin(p.image)}" (1280x960) of the cover, so big phones show the small one stretched.`);
      if (p.link && !/^https?:\/\//.test(p.link) && !exists(p.link.split(/[?#]/)[0])) error("projects.json", `${name}: the link "${p.link}" points at a file that doesn't exist.`);
      // The card clip plays on the game's cover (640x480, the cover's shape).
      if (p.cardClip !== undefined) {
        if (typeof p.cardClip !== "string" || !/\.mp4$/i.test(p.cardClip)) error("projects.json", `${name}: "cardClip" should be the path of an .mp4 file.`);
        else if (!exists(p.cardClip)) error("projects.json", `${name}: the card clip "${p.cardClip}" doesn't exist.`);
        else if (statSync(join(ROOT, p.cardClip)).size > 400 * 1024) warn("projects.json", `${name}: the card clip "${p.cardClip}" is over 400 KB, heavy for a phone on mobile data.`);
      }
      // A game's short clip: an .mp4 with a same-named .jpg still beside it,
      // small enough for a phone on mobile data.
      if (p.clip !== undefined) {
        if (typeof p.clip !== "string" || !/\.mp4$/i.test(p.clip)) error("projects.json", `${name}: "clip" should be the path of an .mp4 file.`);
        else if (!exists(p.clip)) error("projects.json", `${name}: the clip "${p.clip}" doesn't exist.`);
        else {
          if (!exists(p.clip.replace(/\.mp4$/i, ".jpg"))) error("projects.json", `${name}: the clip needs a still picture beside it ("${p.clip.replace(/\.mp4$/i, ".jpg")}").`);
          if (statSync(join(ROOT, p.clip)).size > 400 * 1024) warn("projects.json", `${name}: the clip "${p.clip}" is over 400 KB, heavy for a phone on mobile data.`);
        }
      }
      if (p.shots !== undefined) {
        if (!Array.isArray(p.shots)) error("projects.json", `${name}: "shots" should be a list.`);
        else p.shots.forEach((s, j) => {
          if (!s || !s.src) error("projects.json", `${name}: screenshot #${j + 1} has no "src".`);
          else if (!exists(s.src)) error("projects.json", `${name}: the screenshot "${s.src}" doesn't exist.`);
          else if (!exists(twin(s.src))) warn("projects.json", `${name}: no sharp version "${twin(s.src)}" (double size) of screenshot #${j + 1}.`);
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
// 4b. devlog.json: the devlog posts, newest first.
// ---------------------------------------------------------------------
const devlog = json["devlog.json"];
if (devlog !== undefined) {
  if (!Array.isArray(devlog.posts)) error("devlog.json", 'Needs a "posts" list.');
  else {
    const titles = Array.isArray(projects) ? projects.map((p) => p.title) : [];
    let last = "9999-99-99";
    devlog.posts.forEach((post, i) => {
      const name = post && post.title ? `"${post.title}"` : `post #${i + 1}`;
      if (!post || !post.title) error("devlog.json", `Post #${i + 1} has no "title".`);
      if (!post || !post.body) error("devlog.json", `${name} has no "body".`);
      if (!post || !/^\d{4}-\d{2}-\d{2}$/.test(post.date || "")) error("devlog.json", `${name}: "date" should look like 2026-10-24.`);
      else {
        if (post.date > last) warn("devlog.json", `${name} is out of order. Newest posts go at the top.`);
        last = post.date;
      }
      if (post && post.game && !titles.includes(post.game)) warn("devlog.json", `${name} is about "${post.game}", which isn't a title in projects.json, so it won't show on a game page.`);
    });
  }
}

// ---------------------------------------------------------------------
// 4c. lessons/latest.json: the brief's weekly lessons (brief-lessons.mjs).
//     Missing is fine: the robot writes it once there are enough report cards.
// ---------------------------------------------------------------------
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const lessonFile = json["lessons/latest.json"];
if (lessonFile === undefined) {
  if (!exists("lessons/latest.json")) warn("lessons/latest.json", "No lessons yet. The Coach writes them on Sundays once there are 5 graded report cards; until then the After close tab just doesn't show them.");
} else if (!lessonFile || typeof lessonFile !== "object") {
  error("lessons/latest.json", "Should be an object ({ ... }).");
} else {
  if (typeof lessonFile.updated !== "string" || isNaN(Date.parse(lessonFile.updated))) error("lessons/latest.json", '"updated" should be a date and time.');
  if (!lessonFile.window || !YMD.test(lessonFile.window.from || "") || !YMD.test(lessonFile.window.to || "")) error("lessons/latest.json", '"window" needs "from" and "to" dates like 2026-11-07.');
  if (!Number.isFinite(lessonFile.cards)) error("lessons/latest.json", '"cards" should be a number.');
  if (!Array.isArray(lessonFile.lessons)) error("lessons/latest.json", 'Needs a "lessons" list.');
  else lessonFile.lessons.forEach((l, i) => {
    const name = `Lesson #${i + 1}`;
    if (!l || typeof l.text !== "string" || !l.text.trim()) error("lessons/latest.json", `${name} has no "text".`);
    if (!l || !["new", "kept", "retired"].includes(l.status)) error("lessons/latest.json", `${name}: "status" should be new, kept or retired.`);
    if (!l || !l.evidence || typeof l.evidence.count !== "string" || !Array.isArray(l.evidence.dates) || !l.evidence.dates.every((d) => YMD.test(d))) {
      error("lessons/latest.json", `${name}: "evidence" needs a "count" and a list of "dates" like 2026-11-07.`);
    }
  });
}

// ---------------------------------------------------------------------
// 4d. release-lines.json: player-friendly "What's new" lines for game
//     releases (release-lines.mjs), keyed "<repo>@<tag>".
// ---------------------------------------------------------------------
const releaseLines = json["release-lines.json"];
if (releaseLines === undefined) {
  if (!exists("release-lines.json")) warn("release-lines.json", "Missing. The cards will use the release titles until the Release Writer writes it.");
} else if (!releaseLines || typeof releaseLines !== "object" || Array.isArray(releaseLines)) {
  error("release-lines.json", "Should be an object ({ ... }), one entry per release.");
} else {
  for (const [key, entry] of Object.entries(releaseLines)) {
    if (!/^[^@\s]+@\S+$/.test(key)) error("release-lines.json", `"${key}" should look like "350Chev@v1.2.0" (the repo, @, the release tag).`);
    if (!entry || typeof entry.line !== "string" || !entry.line.trim()) { error("release-lines.json", `"${key}" has no "line".`); continue; }
    if (entry.line.length > 90) warn("release-lines.json", `"${key}": the line is ${entry.line.length} characters, over 90, so it may wrap on phones.`);
    if (typeof entry.title !== "string") error("release-lines.json", `"${key}": "title" (the original release title) should be text.`);
    if (typeof entry.at !== "string" || isNaN(Date.parse(entry.at))) error("release-lines.json", `"${key}": "at" should be a date and time.`);
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
// 7. Every page shares the same header. The menu is copied into each
//    page by hand, so an edit to one page can leave the others behind.
//    The top-level pages' menus must match index.html's (ignoring which
//    item is marked as the page you're on). And the logo's shared parts
//    (the letters and the glow, kept once per page in the footer's
//    <defs>) must be on every page that uses them, or the logo goes blank.
// ---------------------------------------------------------------------
const navOf = (html) => {
  const m = html.match(/<ul class="nav">([\s\S]*?)<\/ul>/);
  return m ? m[1].replace(/\s+aria-current="page"/g, "").replace(/\s+/g, " ").trim() : null;
};
const homeNav = exists("index.html") ? navOf(readFileSync(join(ROOT, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "")) : null;
for (const f of files.filter((f) => extname(f) === ".html")) {
  const html = readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  if (homeNav && dirname(f) === ROOT) {
    const nav = navOf(html);
    if (!nav) warn(rel(f), "This page has no menu (<ul class=\"nav\">), unlike index.html.");
    else if (nav !== homeNav) warn(rel(f), "This page's menu doesn't match index.html's. Copy the menu from index.html so every page shows the same links.");
  }
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/(?:<use[^>]*\shref="#|url\(#)([^")]+)/g)) {
    if (!ids.has(m[1])) error(rel(f), `The logo uses "#${m[1]}", but nothing on this page has that id, so part of the logo won't show. Copy the footer's <defs> block from index.html.`);
  }
}

// ---------------------------------------------------------------------
// 8. Privacy scan. The site is public, so nothing personal or financial
//    may slip into it. This catches the machine-recognisable kinds:
//    email addresses, phone numbers, long account-like numbers, key-shaped
//    strings, and dollar amounts or contract/share counts in the trading
//    data (that record is percentages and per-contract prices only).
//    It can't recognise a name or a story, so read the diff too
//    (CLAUDE.md, "Privacy"). Pictures, fonts and sounds are skipped.
// ---------------------------------------------------------------------
const TEXT_EXT = [".html", ".css", ".js", ".json", ".md", ".txt", ".xml", ".webmanifest", ".svg"];
// Fake addresses used as examples in the editing guide, and GitHub's no-reply ones.
const EMAIL_OK = /@(example\.com|users\.noreply\.github\.com)$/;
const PRIVACY = [
  // Picture names like "cover@2x.jpg" look like emails to a loose pattern, so the part before @ must have 2+ characters and the end must be a real-looking domain.
  { re: /\b[a-z0-9._%+-]{2,}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ca|net|org|io|me|dev|co|games)\b/gi, what: "an email address", ok: (s) => EMAIL_OK.test(s) },
  { re: /(?<!\d)(?:\+?1[ .-]?)?\(?\b[2-9]\d{2}\)?[ .-]\d{3}[ .-]\d{4}\b(?!\d)/g, what: "a phone number" },
  // Not numbers inside a web address (/2026110212345), an id (user+123) or a version.
  { re: /(?<![\w.\-/+=:])\d{9,}(?![\w.\-/+=:])/g, what: "a long number that could be an account or card number" },
  { re: /\b(?:sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, what: "something shaped like an API key or token" },
];
// The trading record: percentages only, never money or position sizes.
// Stock price levels ("MU over $230") are fine; a dollar amount next to a
// money word (made, lost, profit, account, risked...) is not.
const TRADING_FILES = ["journal.json", "options.json"];
const MONEY_WORDS = "made|lost|profit(?:s|ed)?|loss(?:es)?|gain(?:s|ed)?|risk(?:ed|ing)?|account|balance|portfolio|deposit(?:s|ed)?|withdr[a-z]+|position|size[ds]?|p&l|pnl|net|earn(?:ed|ings)?|return(?:ed|s)?|income|savings|capital|equity|bankroll";
const MONEY = [
  { re: new RegExp(`\\b(?:${MONEY_WORDS})\\b[^.;\\n]{0,30}?(?:US|C|CA)?\\$\\s?\\d[\\d,]*(?:\\.\\d+)?\\s?[kKmM]?\\b`, "gi"), what: "a dollar amount of money (not a price level)" },
  { re: new RegExp(`(?:US|C|CA)?\\$\\s?\\d[\\d,]*(?:\\.\\d+)?\\s?[kKmM]?\\s+(?:in\\s+)?(?:${MONEY_WORDS}|per\\s+trade|a\\s+(?:day|week|month|year))\\b`, "gi"), what: "a dollar amount of money (not a price level)" },
  { re: /\b\d+\s*(?:contracts?|shares|lots?)\b/gi, what: "a number of contracts or shares" },
  { re: /\b(?:account|portfolio|net liq(?:uidation)?)\s+(?:size|value|balance)\b/gi, what: "an account size or balance" },
];
for (const f of files.filter((f) => TEXT_EXT.includes(extname(f)))) {
  const text = readFileSync(f, "utf8");
  const checks = TRADING_FILES.includes(rel(f)) ? [...PRIVACY, ...MONEY] : PRIVACY;
  for (const { re, what, ok } of checks) {
    for (const m of text.matchAll(re)) {
      if (ok && ok(m[0])) continue;
      if (f.endsWith(".svg") && /^\d+$/.test(m[0])) continue; // long numbers in drawings are coordinates
      error(rel(f), `Looks like ${what} ("${m[0]}"). The site is public, so this can't go live. If it's a false alarm, reword it or widen the check in check-site.mjs.`);
    }
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

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
import { join, dirname, relative, extname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { inlineScriptHashes, scriptSrc } from "./csp-hashes.mjs";

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
// The notes, robots and workflows in .github are public too (the whole repo
// is), so the privacy scan and the script check read them as well.
function listAll(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if ([".git", "_site", "node_modules"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listAll(full));
    else out.push(full);
  }
  return out;
}
const allFiles = listAll(ROOT);
const inGithub = (f) => relative(ROOT, f).split(/[\\/]/)[0] === ".github";
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
for (const f of allFiles.filter((f) => extname(f) === ".js" || (inGithub(f) && [".mjs", ".cjs"].includes(extname(f))))) {
  try {
    // resolve() gives the full path ("/home/.../main.js"), so a file whose
    // name starts with "-" can never be read by Node as one of its options.
    execFileSync(process.execPath, ["--check", resolve(f)], { stdio: "pipe" });
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
      // A version is written into pages and the feed, so it may only be numbers and dots.
      if (typeof p.version === "string" && p.version.trim() && !/^v?\d+(\.\d+)*$/i.test(p.version.trim())) error("projects.json", `${name}: the version may only hold numbers and dots (like "1.6.0.0").`);
      if (typeof p.version === "string" && /^v/i.test(p.version)) warn("projects.json", `${name}: write the version without the "v" ("${p.version.slice(1)}"), the site adds it.`);
      if (p.hidden !== undefined && typeof p.hidden !== "boolean") error("projects.json", `${name}: "hidden" should be true or false (no quotes).`);
      if (p.featured !== undefined && typeof p.featured !== "boolean") error("projects.json", `${name}: "featured" should be true or false (no quotes).`);
      // "shortTitle": the home page's phone Play button ("Play PEW"), so keep it short
      if (p.shortTitle !== undefined && (typeof p.shortTitle !== "string" || !p.shortTitle.trim() || p.shortTitle.length > 12)) error("projects.json", `${name}: "shortTitle" should be a short name in quotes (12 letters at most).`);
      // "tagline": the one short line on the home page's game cards
      if (p.tagline !== undefined && (typeof p.tagline !== "string" || !p.tagline.trim() || p.tagline.length > 80)) error("projects.json", `${name}: "tagline" should be one short line in quotes (80 characters at most).`);
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
      // Painted key art for the game page (640x480 JPG with an @2x twin).
      if (p.art !== undefined) {
        if (typeof p.art !== "string" || !/\.jpg$/i.test(p.art)) error("projects.json", `${name}: "art" should be the path of a .jpg file.`);
        else if (!exists(p.art)) error("projects.json", `${name}: the art "${p.art}" doesn't exist.`);
        else if (!exists(p.art.replace(/\.jpg$/i, "@2x.jpg"))) warn("projects.json", `${name}: the art has no @2x twin.`);
      }
      // A cinematic loop for the game page: an .mp4 with a same-named .jpg still.
      if (p.film !== undefined) {
        if (typeof p.film !== "string" || !/\.mp4$/i.test(p.film)) error("projects.json", `${name}: "film" should be the path of an .mp4 file.`);
        else if (!exists(p.film)) error("projects.json", `${name}: the film "${p.film}" doesn't exist.`);
        else {
          if (!exists(p.film.replace(/\.mp4$/i, ".jpg"))) error("projects.json", `${name}: the film needs a still picture beside it ("${p.film.replace(/\.mp4$/i, ".jpg")}").`);
          if (statSync(join(ROOT, p.film)).size > 1.2 * 1024 * 1024) warn("projects.json", `${name}: the film "${p.film}" is over 1.2 MB.`);
        }
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
      // "guide": the How to play card on a game page (start, tips, mistake).
      if (p.guide !== undefined) {
        const g = p.guide;
        const textList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim());
        if (!g || typeof g !== "object" || Array.isArray(g)) error("projects.json", `${name}: "guide" should be an object with start, tips and mistake.`);
        else {
          if (g.start !== undefined && !textList(g.start)) error("projects.json", `${name}: guide "start" should be a list of steps (text).`);
          if (g.tips !== undefined && !textList(g.tips)) error("projects.json", `${name}: guide "tips" should be a list of tips (text).`);
          if (g.mistake !== undefined && (typeof g.mistake !== "string" || !g.mistake.trim())) error("projects.json", `${name}: guide "mistake" should be text.`);
          for (const k of Object.keys(g)) if (!["start", "tips", "mistake"].includes(k)) warn("projects.json", `${name}: guide has an unknown part "${k}" that the page won't show.`);
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
      // A link must be a web address or a file on the site (never "javascript:" and the like).
      // (game-<name>.html pages are made by the deploy, so they aren't files in the repo.)
      const file = String((it && it.link) || "").split(/[?#]/)[0];
      if (it && it.link && !/^https:\/\//.test(String(it.link)) && !/^game-[a-z0-9-]+\.html$/.test(file) && !exists(file)) {
        error("now.json", `Item #${i + 1}: the link "${it.link}" isn't a web address (https://...) or a file on the site.`);
      }
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
// Made by the deploy (make-feed.mjs), so never in the repo itself.
const DEPLOY_MADE = new Set(["feed.xml"]);
for (const f of files.filter((f) => extname(f) === ".html")) {
  // Scripts written into the page are left out: `x.href = y` there is code, not a link.
  const html = readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (tag) => tag.slice(0, tag.indexOf(">") + 1) + "</script>");
  const base = dirname(f);
  // src, href and poster, written with double quotes, single quotes or none;
  // and every picture named in a srcset ("small.jpg 1x, sharp.jpg 2x").
  const found = [];
  for (const m of html.matchAll(/\s(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) found.push(m[1] ?? m[2] ?? m[3]);
  for (const m of html.matchAll(/\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) for (const part of (m[1] ?? m[2]).split(",")) found.push(part.trim().split(/\s+/)[0]);
  for (const raw of found) {
    const url = (raw || "").trim();
    if (/^javascript:/i.test(url)) { error(rel(f), `A link's address starts with "javascript:". The security tag blocks those, so the link would do nothing.`); continue; }
    if (/^http:\/\//i.test(url)) warn(rel(f), `Links to "${url}" over plain http://. Use https:// if the site has it.`);
    // "/games.html" works at longlight.games but breaks under the old /Kelbo.Website/ address.
    if (/^\/(?!\/)/.test(url)) { error(rel(f), `Links to "${url}", which starts with "/". Links inside the site are relative (no leading slash).`); continue; }
    if (!url || SKIP.test(url)) continue;
    const path = url.split(/[?#]/)[0];
    if (!path || path === "./" || path.endsWith("/")) {
      const folder = join(base, path || ".");
      if (!existsSync(join(folder, "index.html"))) error(rel(f), `Links to "${url}", but there's no index.html there.`);
      continue;
    }
    if (!existsSync(join(base, path)) && !DEPLOY_MADE.has(path)) error(rel(f), `Links to "${url}", which doesn't exist.`);
  }
}
// Pictures and fonts named in the stylesheets (url(...)).
for (const f of files.filter((f) => extname(f) === ".css")) {
  const css = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/g)) {
    const url = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!url || SKIP.test(url) || /^var\(/.test(url)) continue;
    if (!existsSync(join(dirname(f), url.split(/[?#]/)[0]))) error(rel(f), `The stylesheet names "${url}", which doesn't exist.`);
  }
}
// The home-screen icons the web manifest names.
for (const [name, man] of Object.entries(json).filter(([n]) => n.endsWith(".webmanifest"))) {
  for (const icon of [...(Array.isArray(man.icons) ? man.icons : []), ...(Array.isArray(man.screenshots) ? man.screenshots : [])]) {
    const src = String((icon && icon.src) || "").split(/[?#]/)[0];
    if (src && !SKIP.test(src) && !existsSync(join(ROOT, dirname(name), src))) error(name, `Names the picture "${icon.src}", which doesn't exist.`);
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
  // ...and every address the sitemap lists is a real page (game-<name>.html and the feed are made by the deploy).
  for (const m of sitemap.matchAll(/<loc>\s*https:\/\/longlight\.games\/([^<\s]*)\s*<\/loc>/g)) {
    const page = m[1].split(/[?#]/)[0];
    if (page && !/^game-[a-z0-9-]+\.html$/.test(page) && !DEPLOY_MADE.has(page) && !exists(page.endsWith("/") ? page + "index.html" : page)) error("sitemap.xml", `Lists "${page}", which doesn't exist.`);
  }
  // A new top-level page should also be saved for offline.
  if (exists("sw.js")) {
    const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
    const core = (sw.match(/const CORE\s*=\s*\[([\s\S]*?)\]/) || ["", ""])[1];
    for (const page of pages) if (page !== "404.html" && !core.includes(`"${page}"`)) warn("sw.js", `${page} isn't in the offline list (CORE), so it won't open without a connection.`);
  }
}
if (exists("robots.txt") && /^\s*Disallow:\s*\/\s*$/im.test(readFileSync(join(ROOT, "robots.txt"), "utf8"))) error("robots.txt", `"Disallow: /" tells every search engine to stay out of the whole site.`);
// Wiping all of a visitor's saved settings is never right (badges, theme, the journal's own notes).
for (const f of files.filter((f) => extname(f) === ".js")) {
  if (/localStorage\s*\.\s*clear\s*\(/.test(readFileSync(f, "utf8"))) error(rel(f), "Calls localStorage.clear(), which wipes everything the site has saved for a visitor. Remove the one key instead.");
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
// 7b. Page basics. A title, one link-preview picture version across the
//     site, alt text, nothing the security tag would silently block.
// ---------------------------------------------------------------------
const attrOf = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return m ? (m[1] ?? m[2] ?? m[3]) : null; };
const ogVersion = (html) => { const m = html.match(/<meta property="og:image" content="([^"]*)"/); return m ? m[1] : null; };
const homeOg = exists("index.html") ? ogVersion(readFileSync(join(ROOT, "index.html"), "utf8")) : null;
for (const f of files.filter((f) => extname(f) === ".html")) {
  const html = readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const top = dirname(f) === ROOT;
  if (top && !/<title>\s*[^<\s][^<]*<\/title>/.test(html)) error(rel(f), "This page has no <title>, so browser tabs and search results show nothing for it.");
  const og = ogVersion(html);
  if (top && homeOg && og && og !== homeOg) error(rel(f), `The link preview picture here is "${og}", but index.html uses "${homeOg}". Every page uses the same one (bump ?v= on all of them together).`);
  if (og) { const file = og.replace(/^https:\/\/longlight\.games\//, "").split(/[?#]/)[0]; if (!/^https?:/.test(file) && !exists(file)) error(rel(f), `The link preview picture "${file}" doesn't exist.`); }
  const canon = html.match(/<link rel="canonical" href="([^"]*)"/);
  if (canon && !canon[1].startsWith("https://longlight.games/")) error(rel(f), `The canonical address is "${canon[1]}". It should start with https://longlight.games/.`);
  const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  for (const m of body.matchAll(/<img\b[^>]*>/g)) if (attrOf(m[0], "alt") === null) warn(rel(f), `A picture has no alt text (${(attrOf(m[0], "src") || "no src").slice(0, 60)}). Screen readers need it; use alt="" for pure decoration.`);
  // onclick="..." and friends: the security tag refuses to run them, so the button would do nothing.
  for (const m of body.matchAll(/<[a-z][^>]*?\s(on[a-z]+)\s*=\s*["'][^>]*>/gi)) { error(rel(f), `A tag has ${m[1]}="..." written into the page. The security tag blocks that, so it would do nothing. Put the code in a .js file.`); break; }
  // Scripts, frames and forms that point at another site must be on the security tag's list.
  const tag = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/) || ["", ""])[1];
  const allowed = (dir, url) => {
    const part = tag.split(";").map((x) => x.trim()).find((x) => x.startsWith(dir + " ")) || "";
    let host; try { host = new URL(url).host; } catch { return true; }
    return part.split(/\s+/).some((src) => src === `https://${host}` || (src.startsWith("https://*.") && host.endsWith(src.slice(9))));
  };
  for (const [re, dir, what] of [[/<script\b[^>]*>/g, "script-src", "script"], [/<iframe\b[^>]*>/g, "frame-src", "frame"], [/<form\b[^>]*>/g, "form-action", "form"]]) {
    for (const m of html.matchAll(re)) {
      const url = attrOf(m[0], what === "form" ? "action" : "src");
      if (url && /^(https?:)?\/\//.test(url) && !allowed(dir, url.replace(/^\/\//, "https://"))) error(rel(f), `A ${what} points at "${url.slice(0, 80)}", which isn't on this page's security tag (${dir}). The browser would block it. Only add a host there after talking it through with Kelbo.`);
    }
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
const TEXT_EXT = [".html", ".css", ".js", ".json", ".md", ".txt", ".xml", ".webmanifest", ".svg", ".mjs", ".cjs", ".ts", ".yml", ".yaml", ".csv", ".tsv", ".sh", ".toml", ".ini", ".cfg", ".env"];
// Pictures, sound, video and fonts: not read as text. (Photos get their own check below.)
const BINARY_EXT = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".ico", ".mp4", ".webm", ".mp3", ".ogg", ".wav", ".woff", ".woff2", ".pdf", ".zip", ".glb"];
// A file is read as text if its ending says so, or it has no known ending
// and holds no zero bytes (NOTES, .env, a new kind of data file).
const isText = (f) => {
  const ext = extname(f).toLowerCase();
  if (TEXT_EXT.includes(ext)) return true;
  if (BINARY_EXT.includes(ext) || statSync(f).size > 2 * 1024 * 1024) return false;
  return !readFileSync(f).subarray(0, 8000).includes(0);
};
// The Web Analytics token at the foot of each page is public by design. Any
// other 32-character id (a Cloudflare account or zone id looks like this) is not.
const BEACON = new Set(allFiles.filter((f) => extname(f) === ".html").flatMap((f) => [...readFileSync(f, "utf8").matchAll(/data-cf-beacon='\{"token":\s*"([0-9a-f]{32})"/g)].map((m) => m[1])));
// Fake addresses used as examples in the editing guide, and GitHub's no-reply ones.
// The contact form's own sender address (in the Worker's code) is the one real address allowed.
const EMAIL_OK = /@(example\.com|users\.noreply\.github\.com)$|^form@longlight\.games$/;
// File names like "cover@2x.jpg" and "350Chev@v1.2.0.json" have an @ too. A
// match that ends in one of these file endings is a file, not an address.
const FILE_END = /\.(?:jpe?g|png|webp|avif|gif|svg|ico|mp4|webm|mp3|ogg|wav|woff2?|json|m?js|css|html?|md|txt|xml|webmanifest)$/i;
const PRIVACY = [
  // Any address, whatever it ends in (.com, .ca, .edu, .uk ...): the part
  // before @ has 2+ characters and the ending is 2+ letters. File names
  // with an @ in them are let through by FILE_END above.
  { re: /(?<![a-z0-9._%+-])[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}\b/gi, what: "an email address", ok: (s) => EMAIL_OK.test(s) || FILE_END.test(s) },
  // The same address in disguise: the @ and the dots spelled out in brackets, or the @ written as a code.
  { re: /\b[a-z0-9._+-]{2,}(?:\s*[\[(]\s*at\s*[\])]\s*|&#0*64;|&#x0*40;|&commat;|%40)[a-z0-9-]+(?:(?:\.|\s*[\[(]\s*dot\s*[\])]\s*)[a-z0-9-]+)*(?:\.|\s*[\[(]\s*dot\s*[\])]\s*)[a-z]{2,24}\b/gi, what: "an email address in disguise", ok: (s) => /(?:example\.com|users\.noreply\.github\.com)$/i.test(s.replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, ".")) },
  // Separators: space, dot, slash, or any kind of dash.
  { re: /(?<!\d)(?:\+?1[ .\u2010-\u2015-]?)?\(?\b[2-9]\d{2}\)?[ .\/\u2010-\u2015-]\d{3}[ .\/\u2010-\u2015-]\d{4}\b(?!\d)/g, what: "a phone number" },
  { re: /\btel:\+?[\d().\s-]{7,}|(?<![\w.])\+1[2-9]\d{9}\b/gi, what: "a phone number" },
  // Card numbers written in fours.
  { re: /(?<![\d.,-])\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}(?![\d.,-])/g, what: "a long number that could be an account or card number" },
  // Not numbers inside a web address (/2026110212345), an id (user+123) or a version.
  { re: /(?<![\w.\-/+=:])\d{9,}(?![\w.\-/+=:])/g, what: "a long number that could be an account or card number" },
  { re: /\b(?:sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|[sr]k_(?:live|test)_[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{30,}|glpat-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/g, what: "something shaped like an API key or token" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, what: "a private key" },
  { re: /(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/g, what: "a 32-character id (Cloudflare account and zone ids look like this)", ok: (s) => BEACON.has(s) },
];
// "I made $450", "we risked $200", "my 12 contracts": Kelbo's own money or
// size, wherever it is written. (News about a company's profit is fine.)
const MINE = [
  { re: /\b(?:I|I've|I'm|we|my|our)\b[^.;\n$]{0,40}?(?:US|C|CA)?\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?\b(?=[^.;\n]{0,24}\b(?:profit|loss|gain|risk|on (?:it|this|that|the trade))\b)|\bI\s+(?:made|lost|risked|netted|earned|deposited|withdrew)\b[^.;\n$]{0,24}?(?:US|C|CA)?\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?\b/g, what: "a dollar amount of Kelbo's own money" },
  { re: /\b(?:I|we)\s+(?:bought|sold|hold|held|own|have|had|added|trimmed|closed|opened)\b[^.;\n]{0,20}?\b\d+\s*(?:contracts?|shares|lots?)\b|\bmy\s+\d+\s*(?:contracts?|shares|lots?)\b/gi, what: "a number of contracts or shares" },
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
for (const f of allFiles.filter(isText)) {
  const text = readFileSync(f, "utf8");
  // The check's own tools hold the patterns and made-up examples; they are scanned for real keys and addresses only.
  const checks = TRADING_FILES.includes(rel(f)) ? [...PRIVACY, ...MONEY, ...MINE] : inGithub(f) ? PRIVACY : [...PRIVACY, ...MINE];
  for (const { re, what, ok } of checks) {
    for (const m of text.matchAll(re)) {
      if (ok && ok(m[0])) continue;
      if (f.endsWith(".svg") && /^[\d -]+$/.test(m[0])) continue; // long numbers in drawings are coordinates
      error(rel(f), `Looks like ${what} ("${m[0]}"). The site is public, so this can't go live. If it's a false alarm, reword it or widen the check in check-site.mjs.`);
    }
  }
}

// A .env file is where keys are kept on a computer. It never belongs in the repo.
for (const f of allFiles) if (/^\.env(\.|$)/.test(f.split(/[\\/]/).pop())) error(rel(f), "A .env file is where keys and passwords are kept. It can't be in a public repo.");
// Photos can carry where they were taken. A JPEG with GPS data can't go live.
for (const f of allFiles.filter((f) => /\.jpe?g$/i.test(f))) {
  const b = readFileSync(f).subarray(0, 256 * 1024);
  const at = b.indexOf("Exif\0\0", 0, "latin1");
  if (at < 0) continue;
  const t = at + 6, le = b.toString("latin1", t, t + 2) === "II";
  const u16 = (o) => (o + 2 <= b.length ? (le ? b.readUInt16LE(o) : b.readUInt16BE(o)) : 0), u32 = (o) => (o + 4 <= b.length ? (le ? b.readUInt32LE(o) : b.readUInt32BE(o)) : 0);
  const ifd = t + u32(t + 4), n = u16(ifd);
  for (let i = 0; i < Math.min(n, 200); i++) if (u16(ifd + 2 + i * 12) === 0x8825) { error(rel(f), "This photo carries GPS data (where it was taken). Export it again without location, or strip its metadata."); break; }
}

// ---------------------------------------------------------------------
// Workflows. The robot key stays out of the deploy and the check, every job
// that uses it runs in the "robots" environment, and no workflow gets
// write access to everything.
// ---------------------------------------------------------------------
for (const f of allFiles.filter((f) => inGithub(f) && /workflows[\\/][^\\/]+\.ya?ml$/.test(f))) {
  const yml = readFileSync(f, "utf8").replace(/^\s*#.*$/gm, "");
  const name = f.split(/[\\/]/).pop();
  if (/permissions:\s*write-all/.test(yml)) error(rel(f), `"permissions: write-all" gives this workflow write access to everything. List only what it needs.`);
  if (/\bpull_request_target\b/.test(yml)) error(rel(f), `"pull_request_target" runs a stranger's pull request with this repo's secrets in reach. Use "pull_request".`);
  const usesKey = /secrets\.LL_ROBOT_KEY/.test(yml);
  if (usesKey && ["deploy.yml", "site-check.yml"].includes(name)) error(rel(f), "The robot key (LL_ROBOT_KEY) is used here. The deploy and the Site check stay key-free.");
  else if (usesKey && !/^\s*environment:\s*robots\s*$/m.test(yml)) error(rel(f), `This workflow uses the robot key but has no "environment: robots" line, so the key's lock to main wouldn't apply.`);
}

// ---------------------------------------------------------------------
// Security tag: every page has one, it doesn't allow just any inline
// script, and it lists the fingerprint of each inline script the page has
// (otherwise the browser silently refuses to run that script).
// ---------------------------------------------------------------------
const SCRIPT_HOSTS = ["https://static.cloudflareinsights.com", "https://challenges.cloudflare.com"];
const HOME_TAG = exists("index.html") ? (readFileSync(join(ROOT, "index.html"), "utf8").match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/) || ["", ""])[1] : "";
for (const f of files.filter((f) => extname(f) === ".html")) {
  const html = readFileSync(f, "utf8");
  const rule = scriptSrc(html);
  if (!rule) { error(rel(f), "This page has no Content-Security-Policy tag. Copy the one from index.html, right after the viewport line."); continue; }
  if (rule.includes("'unsafe-inline'")) error(rel(f), "The security tag's script-src allows 'unsafe-inline', which lets any injected script run. Run: node .github/scripts/csp-hashes.mjs");
  if (rule.includes("'unsafe-eval'")) error(rel(f), "The security tag's script-src allows 'unsafe-eval', which lets text be run as code.");
  // Scripts may come from the site itself and these two Cloudflare hosts (visit counts, the contact form's check). Nothing else.
  for (const src of rule.split(/\s+/).slice(1)) {
    if (src === "'self'" || /^'sha256-[A-Za-z0-9+/=]+'$/.test(src) || SCRIPT_HOSTS.includes(src)) continue;
    error(rel(f), `The security tag's script-src lists "${src}". Scripts may only come from the site itself, ${SCRIPT_HOSTS.join(" and ")}. To add a host on purpose, add it to SCRIPT_HOSTS in check-site.mjs too.`);
  }
  // Every other part of the tag: no "*" (anywhere), and the same on every page as on index.html
  // (game.html may also frame the games' own addresses for "Play here").
  const whole = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/) || ["", ""])[1];
  const parts = (t) => t.split(";").map((x) => x.trim()).filter((x) => x && !x.startsWith("script-src "));
  for (const part of parts(whole)) if (/(^|\s)(\*|https?:|http:\/\/\S+)(\s|$)/.test(part)) error(rel(f), `The security tag's "${part.split(" ")[0]}" allows any site (or plain http). Name the exact https:// hosts instead.`);
  if (HOME_TAG && dirname(f) === ROOT) {
    const mine = parts(whole).map((x) => (rel(f) === "game.html" ? x.replace(" https://*.longlight.games", "") : x)).join("; ");
    if (mine !== parts(HOME_TAG).join("; ")) error(rel(f), "This page's security tag differs from index.html's (beyond the script fingerprints). Every page carries the same tag; copy it from index.html.");
  }
  for (const hash of inlineScriptHashes(html)) {
    if (!rule.includes(`'${hash}'`)) error(rel(f), `A script written into this page changed (or is new), so the browser would block it. Run: node .github/scripts/csp-hashes.mjs (it needs '${hash}' in script-src).`);
  }
}

// Each page has one description tag, and nothing inside it that looks like
// the start of another tag. (make-game-pages.mjs once wrote a second
// '<meta name="description"' inside a game page's description.)
for (const f of files.filter((f) => extname(f) === ".html")) {
  const html = readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const count = (html.match(/<meta name="description"/g) || []).length;
  if (count > 1) error(rel(f), `This page has ${count} description tags (<meta name="description" ...>) where there should be one, so its link preview text is broken.`);
}

// The security contact file must be there and not about to run out.
if (!exists(".well-known/security.txt")) {
  error(".well-known/security.txt", "The security contact file is missing.");
} else {
  const expires = readFileSync(join(ROOT, ".well-known/security.txt"), "utf8").match(/^Expires:\s*(\S+)/m);
  const daysLeft = expires ? (Date.parse(expires[1]) - Date.now()) / 86400000 : NaN;
  if (!(daysLeft > 0)) error(".well-known/security.txt", "The Expires date is missing or has passed. Set it to about a year from now.");
  else if (daysLeft < 45) warn(".well-known/security.txt", `The Expires date is ${Math.round(daysLeft)} days away. Set it to about a year from now.`);
}

// ---------------------------------------------------------------------
// Links in the briefs. briefs/*.md is written by a robot from what it
// read on the web, and the brief page turns [words](https://...) into a
// link. An address has no business holding < > or a quote: that is what
// an attempt to break out of the link looks like, so it never gets saved.
// ---------------------------------------------------------------------
for (const f of files.filter((f) => extname(f) === ".md" && rel(f).split(/[\\/]/)[0] === "briefs")) {
  for (const m of readFileSync(f, "utf8").matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)) {
    if (/[<>"'`]/.test(m[1])) { error(rel(f), "A link's address holds a <, a > or a quote mark. Web addresses write those as % codes (%3C, %3E, %22, %27); a plain one is not a real link."); break; }
  }
}

// ---------------------------------------------------------------------
// The feed. feed.xml is made by the deploy (make-feed.mjs), so this part
// only runs on the deploy copy. A feed reader throws the whole feed away
// if the file isn't well-formed XML, so it is read here the strict way:
// no characters XML forbids, every "&" a proper code, every tag closed
// in order.
// ---------------------------------------------------------------------
function feedProblem(xml) {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/.test(xml)) return "it holds a control character, which XML does not allow";
  const body = xml.replace(/^\uFEFF?<\?xml[^?]*\?>\s*/, "");
  const open = [];
  let at = 0;
  const text = (t) => (/</.test(t) ? "a stray \"<\"" : /&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(t) ? "an \"&\" that isn't written as a code" : "");
  for (const m of body.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g)) {
    const between = text(body.slice(at, m.index));
    if (between) return `${between} before <${m[1]}${m[2]}>`;
    at = m.index + m[0].length;
    for (const a of m[3].matchAll(/="([^"]*)"/g)) if (text(a[1])) return `${text(a[1])} inside <${m[2]}>`;
    if (m[1]) { if (open.pop() !== m[2]) return `</${m[2]}> closes a tag that isn't open`; }
    else if (!m[4]) open.push(m[2]);
  }
  if (text(body.slice(at)) || body.slice(at).trim()) return "there is text after the last tag";
  if (open.length) return `<${open.pop()}> is never closed`;
  if (!/^<rss[\s>]/.test(body)) return "it doesn't start with <rss>";
  return "";
}
if (exists("feed.xml")) {
  const problem = feedProblem(readFileSync(join(ROOT, "feed.xml"), "utf8"));
  if (problem) error("feed.xml", `The feed isn't well-formed XML, so feed readers would show nothing: ${problem}.`);
}

// ---------------------------------------------------------------------
// Report. In GitHub, errors and warnings also show up as notes on the
// files themselves, and as a plain-English summary on the run's page.
// ---------------------------------------------------------------------
const inActions = !!process.env.GITHUB_ACTIONS;
// A message can quote text from a file (a title, a link). It is kept on
// one line, because GitHub treats any log line that starts with "::" as a
// command to itself.
const flat = (s) => String(s).replace(/[\r\n]+/g, " ");
for (const { file, msg } of errors) console.log(inActions ? `::error file=${flat(file)}::${flat(msg)}` : `ERROR    ${file}: ${flat(msg)}`);
for (const { file, msg } of warnings) console.log(inActions ? `::warning file=${flat(file)}::${flat(msg)}` : `WARNING  ${file}: ${flat(msg)}`);

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

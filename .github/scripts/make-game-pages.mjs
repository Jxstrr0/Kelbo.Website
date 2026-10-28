// =====================================================================
// MAKE GAME PAGES
// ---------------------------------------------------------------------
// Gives every game its own page with its own link preview, so a shared
// link to Frontier Lab shows Frontier Lab's cover and summary instead of
// the general studio card.
//
// Why a script: link-preview crawlers (Messages, Discord, X...) don't run
// JavaScript, so game.html?g=frontier-lab can only ever show the studio
// card. This copies game.html once per game, as game-<slug>.html, with
// the title, description, picture and address written into the <head>.
// The page body is unchanged; main.js fills it in exactly as on
// game.html (the slug is in data-game on the game box).
//
// Like sync-releases.mjs it only writes into the deploy copy (_site), so
// the repo never holds these files and adding a game still needs no HTML
// edit. It also adds the pages to _site/sitemap.xml.
//
// Run it with:  node .github/scripts/make-game-pages.mjs _site
// Plain Node, no packages.
// =====================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] || ".";
const SITE = "https://jxstrr0.github.io/Kelbo.Website/";
const projects = JSON.parse(readFileSync(join(ROOT, "projects.json"), "utf8"));
const template = readFileSync(join(ROOT, "game.html"), "utf8");

// Same as projectSlug in main.js: "Prairie Engine Works" -> "prairie-engine-works".
const slug = (title) => String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Text going into HTML: & < > " must be written as codes.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Swap one piece of the template. If game.html changes so a piece can't
// be found, stop with a clear message rather than publish a half-made page.
function swap(html, pattern, replacement, what) {
  if (!pattern.test(html)) throw new Error(`make-game-pages: couldn't find ${what} in game.html. Update this script to match.`);
  return html.replace(pattern, replacement);
}

const made = [];
for (const p of projects) {
  if (String(p.category || "").trim().toLowerCase() !== "game" || !p.title) continue;
  const s = slug(p.title);
  const file = `game-${s}.html`;
  const title = esc(`${p.title} · Longlight Interactive`);
  const about = esc(p.summary || "A Longlight Interactive browser game.");
  const url = SITE + file;

  let html = template;
  html = swap(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, "the <title>");
  html = swap(html, /(<meta name="description" content=")[^"]*/, `$1${about}`, "the description");
  html = swap(html, /(<meta property="og:title" content=")[^"]*/, `$1${title}`, "og:title");
  html = swap(html, /(<meta property="og:description" content=")[^"]*/, `$1${about}`, "og:description");
  html = swap(html, /(<meta property="og:url" content=")[^"]*/, `$1${url}`, "og:url");
  html = swap(html, /(<link rel="canonical" href=")[^"]*/, `$1${url}`, "the canonical link");
  html = swap(html, /(<h1 data-game-title>)[^<]*/, `$1${esc(p.title)}`, "the <h1>");
  html = swap(html, /data-projects="game"/, `data-projects="game" data-game="${s}"`, "the game box");
  // The cover (640x480) replaces the studio picture. No cover: keep the studio card.
  if (p.image) {
    html = swap(html, /(<meta property="og:image" content=")[^"]*/, `$1${SITE}${esc(p.image)}`, "og:image");
    html = swap(html, /(<meta property="og:image:width" content=")[^"]*/, "$1640", "og:image:width");
    html = swap(html, /(<meta property="og:image:height" content=")[^"]*/, "$1480", "og:image:height");
    html = swap(html, /(<meta property="og:image:alt" content=")[^"]*/, `$1${esc("Cover of " + p.title)}`, "og:image:alt");
  }
  writeFileSync(join(ROOT, file), html);
  made.push(file);
}

// Add the pages to the sitemap so search engines find them.
const mapFile = join(ROOT, "sitemap.xml");
let map = readFileSync(mapFile, "utf8");
const lines = made.filter((f) => !map.includes(f)).map((f) => `  <url><loc>${SITE}${f}</loc></url>\n`).join("");
map = swap(map, /<\/urlset>/, `${lines}</urlset>`, "</urlset>");
writeFileSync(mapFile, map);

console.log(`Made ${made.length} game page(s): ${made.join(", ")}`);

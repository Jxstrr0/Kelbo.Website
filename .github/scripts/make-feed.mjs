// =====================================================================
// MAKE FEED
// ---------------------------------------------------------------------
// Writes feed.xml, an RSS feed people can follow in a feed reader (or
// that a games site can watch) to hear about Longlight news without
// checking the site:
//   - every devlog post (devlog.json), linked to its card on devlog.html;
//   - each game's newest release (the version and "latest" line that
//     sync-releases.mjs filled in), linked to that game's own page.
// Hidden projects, and devlog posts about them, are left out, like
// everywhere else on the site.
//
// Like sync-releases.mjs and make-game-pages.mjs it only writes into the
// deploy copy (_site), so the repo never holds feed.xml. Run it after
// those two:  node .github/scripts/make-feed.mjs _site
// Plain Node, no packages.
// =====================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] || ".";
const SITE = "https://longlight.games/";
const MAX_ITEMS = 40;

const projects = JSON.parse(readFileSync(join(ROOT, "projects.json"), "utf8")).filter((p) => !p.hidden);
const allProjects = JSON.parse(readFileSync(join(ROOT, "projects.json"), "utf8"));
const hiddenTitles = new Set(allProjects.filter((p) => p.hidden).map((p) => p.title));
// A devlog post about a hidden game ("game" names it) is left out too.
const posts = (JSON.parse(readFileSync(join(ROOT, "devlog.json"), "utf8")).posts || []).filter((post) => !hiddenTitles.has(post.game));

// Same as projectSlug in main.js: "Prairie Engine Works" -> "prairie-engine-works".
const slug = (title) => String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Text going into XML: & < > " ' must be written as codes.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
// "2026-11-12" -> "Thu, 12 Nov 2026 12:00:00 GMT" (noon, so no time zone tips it into another day).
const rssDate = (day) => new Date(day + "T12:00:00Z").toUTCString();

const items = [];

for (const post of posts) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date || "") || !post.title) continue;
  const link = `${SITE}devlog.html#${post.date}-${slug(post.title)}`;
  const body = String(post.body || "").split(/\n\s*\n/).map((para) => `<p>${esc(para.trim())}</p>`).join("");
  items.push({ day: post.date, title: post.title, link, guid: link, category: post.game || "Devlog", body });
}

for (const p of projects) {
  if (!p.released || !p.version) continue;
  const page = `${SITE}game-${slug(p.title)}.html`;
  const title = `${p.title} ${p.version}` + (p.latest ? `: ${p.latest}` : "");
  const body = `<p>${esc(p.latest || "A new version is out.")}</p>` + (p.link ? `<p><a href="${esc(p.link)}">Play ${esc(p.title)}</a></p>` : "");
  items.push({ day: p.released, title, link: page, guid: `${page}#v${p.version}`, category: p.title, body });
}

// Newest first; on the same day, devlog posts before releases (stable sort keeps file order).
items.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
const kept = items.slice(0, MAX_ITEMS);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Longlight Interactive</title>
  <link>${SITE}</link>
  <description>New games, updates and devlog posts from Longlight Interactive, a small studio making free browser games.</description>
  <language>en</language>
  <atom:link href="${SITE}feed.xml" rel="self" type="application/rss+xml"/>
  <image><url>${SITE}assets/icon-192.png</url><title>Longlight Interactive</title><link>${SITE}</link></image>
${kept[0] ? `  <lastBuildDate>${rssDate(kept[0].day)}</lastBuildDate>\n` : ""}${kept.map((i) => `  <item>
    <title>${esc(i.title)}</title>
    <link>${esc(i.link)}</link>
    <guid isPermaLink="false">${esc(i.guid)}</guid>
    <pubDate>${rssDate(i.day)}</pubDate>
    <category>${esc(i.category)}</category>
    <description>${esc(i.body)}</description>
  </item>`).join("\n")}
</channel>
</rss>
`;

writeFileSync(join(ROOT, "feed.xml"), xml);
console.log(`feed.xml: ${kept.length} items (${posts.length} devlog posts, ${projects.filter((p) => p.released).length} game releases with a date).`);

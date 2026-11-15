// =====================================================================
// Inline script fingerprints for the security tag
// =====================================================================
// Every page's Content-Security-Policy tag lists a fingerprint ("sha256-...")
// for each small script written straight into the page (the theme setter,
// the 404 page's address fixer, the game page's cover hop). The browser
// refuses to run any inline script whose fingerprint isn't on the list, so
// a script someone managed to inject would be blocked.
//
// Changing even one letter inside one of those <script> blocks changes its
// fingerprint. After such an edit, run:
//
//     node .github/scripts/csp-hashes.mjs
//
// It rewrites the list in every page. The Site check fails (and names the
// missing fingerprint) if a page and its list ever disagree.
//
// No npm packages needed. Plain Node only.
// =====================================================================

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// The fingerprint of every inline script in a page that the browser would
// run. Scripts with a src are files (covered by 'self' or a listed host);
// JSON blocks are data and never run.
export function inlineScriptHashes(html) {
  const out = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || "";
    if (/\ssrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*["']application\/(ld\+)?json["']/.test(attrs)) continue;
    out.push("sha256-" + createHash("sha256").update(m[2]).digest("base64"));
  }
  return out;
}

// The script-src part of a page's security tag ("" if there is none).
export function scriptSrc(html) {
  const tag = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
  const part = tag && tag[1].split(";").map((s) => s.trim()).find((s) => s.startsWith("script-src "));
  return part || "";
}

// Run directly: rewrite the list in every page at the top of the site.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pages = readdirSync(".").filter((f) => f.endsWith(".html"));
  // One shared list, so every page carries the same tag.
  const all = [...new Set(pages.flatMap((f) => inlineScriptHashes(readFileSync(f, "utf8"))))].sort();
  const list = all.map((h) => `'${h}'`).join(" ");
  for (const f of pages) {
    const html = readFileSync(f, "utf8");
    const old = scriptSrc(html);
    if (!old) { console.log(`${f}: no security tag found, skipped`); continue; }
    const hosts = old.split(/\s+/).filter((w) => w.startsWith("https://")).join(" ");
    const next = `script-src 'self' ${list}${hosts ? " " + hosts : ""}`;
    if (next !== old) { writeFileSync(f, html.replace(old, next)); console.log(`${f}: updated`); }
  }
  console.log(`${all.length} inline script fingerprint(s) across ${pages.length} pages.`);
}

// =====================================================================
// DEVLOG DRAFTER (weekly)
// ---------------------------------------------------------------------
// Once a week this looks at every game in projects.json that has a GitHub
// "code" link, collects the last 7 days of merged pull requests and any
// releases from that game's repo, and asks Claude (one call, no web
// search) to draft 0 to 4 devlog posts, at most one per game, written as
// Longlight to players.
//
// The same call also rewrites the "Now building" strip on the home page
// (now.json): 1 to 3 short lines naming the games that had work this
// week, each linking to the game. It costs nothing extra, since Claude
// is already reading the week's changes. If no line comes back, or they
// match what's there, now.json stays as it is.
//
// It puts the drafts at the top of devlog.json. The workflow
// (devlog-draft.yml) then opens a pull request for Kelbo to read, fix and
// merge, or close. It is never merged automatically.
//
// No game with activity this week: no call, nothing written (the strip
// keeps its old lines).
//
// Run with:  node .github/scripts/devlog-draft.mjs
// GITHUB_TOKEN reads the game repos (Actions provides it for free).
// DRY_RUN=1 prints the drafts without changing devlog.json.
// =====================================================================

import { readFile, writeFile } from "node:fs/promises";
import { askClaude, logCost, readJson, setOutput, skDate, DRY_RUN } from "./claude.mjs";

const MODEL = "claude-sonnet-5-5";
const DAYS = 7; // how far back to look
const MAX_POSTS = 4;
const BODY_CHARS = 1500; // each PR description is cut to about this long
const MARKER = "===POSTS===";
const MAX_NOW = 3; // lines in the "Now building" strip
const NOW_CHARS = 70; // each line stays about this short

const today = skDate();
const since = new Date(Date.now() - DAYS * 864e5);
const projects = JSON.parse(await readFile("projects.json", "utf8"));
const devlog = JSON.parse(await readFile("devlog.json", "utf8"));
// A missing or broken now.json just means the strip starts fresh.
const nowFile = await readFile("now.json", "utf8").then(JSON.parse).catch(() => ({ items: [] }));
const titles = projects.map((p) => p.title);

const headers = { Accept: "application/vnd.github+json", "User-Agent": "longlight-devlog-draft" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
async function github(path) {
  const res = await fetch(`https://api.github.com/repos/${path}`, { headers });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub said ${res.status} for ${path}`);
  return res.json();
}

// Strips the bits of a PR description that only matter to coders: the
// Claude Code footer, session links and HTML comments.
const tidy = (s) =>
  String(s || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^.*(Generated with \[Claude Code\]|claude\.ai\/code\/session).*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + " …" : s);

/* ---------- What happened in each game this week ---------- */
const activity = []; // { game, repo, prs: [...], releases: [...] }
const people = new Set(); // GitHub logins, so no post names anyone
for (const p of projects) {
  const m = (p.code || "").match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!m) continue;
  const repo = `${m[1]}/${m[2].replace(/\.git$/, "")}`;
  people.add(m[1].toLowerCase());
  let prs = [];
  let releases = [];
  try {
    // Closed PRs, most recently updated first; stop once they're older than the week.
    for (let page = 1; page <= 3; page++) {
      const batch = await github(`${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50&page=${page}`);
      for (const pr of batch) {
        if (pr.merged_at && new Date(pr.merged_at) >= since) {
          prs.push({ title: pr.title, body: cut(tidy(pr.body), BODY_CHARS), url: pr.html_url, merged: pr.merged_at.slice(0, 10) });
          if (pr.user?.login) people.add(pr.user.login.toLowerCase());
        }
      }
      if (batch.length < 50 || new Date(batch[batch.length - 1].updated_at) < since) break;
    }
    releases = (await github(`${repo}/releases?per_page=20`))
      .filter((r) => !r.draft && r.published_at && new Date(r.published_at) >= since)
      .map((r) => ({ tag: r.tag_name, title: r.name || r.tag_name, notes: cut(tidy(r.body), BODY_CHARS), url: r.html_url }));
  } catch (e) {
    console.warn(`${p.title}: couldn't read ${repo} (${e.message}), skipping it.`);
    continue;
  }
  if (!prs.length && !releases.length) {
    console.log(`${p.title}: nothing merged or released this week.`);
    continue;
  }
  prs.reverse(); // oldest first reads like a story
  console.log(`${p.title}: ${prs.length} merged PR(s), ${releases.length} release(s).`);
  activity.push({ game: p.title, repo, prs, releases });
}

if (!activity.length) {
  console.log("No game had merged pull requests or releases in the last 7 days. No call made, nothing written.");
  setOutput("posts", 0);
  setOutput("now", "false");
  process.exit(0);
}

/* ---------- Ask Claude ---------- */
const SYSTEM = `You draft devlog posts for Longlight Interactive, a small indie studio that makes free browser games. The devlog is read by players, not programmers.

You get this week's merged pull requests and releases for each game that had any, plus the newest devlog posts already published (for the voice, and so you don't repeat them).

Write 0 to ${MAX_POSTS} posts, at most one per game. Skip a game when its changes are only behind-the-scenes work players won't notice (tests, build tools, docs, refactors), or when the newest posts already covered them.

Rules:
- Write as Longlight ("we" is fine; never "I"), to players. Plain, friendly and specific. Short paragraphs.
- Report only changes that really happened, as shown in the pull requests and releases. Never invent features, numbers or plans.
- No code jargon (no "refactor", "PR", "merge", "commit", "bug fix in module X", file names or function names). Say what a player will see or feel.
- No pull request numbers, no version numbers unless a release names one, no personal names or usernames.
- "title": short, under 70 characters, naming the game or the change.
- "body": 1 to 3 short paragraphs separated by a blank line (\\n\\n), under 900 characters in all.
- "game": the game's title copied exactly as given.
- "date": ${today}.

Output the line ${MARKER} and then only this JSON, nothing after it:
{"posts": [{"date": "${today}", "title": "...", "body": "...", "game": "..."}]}
If nothing is worth a post, use "posts": [].

Also write the "Now building" strip for the studio's home page: 1 to ${MAX_NOW} short lines saying what is being worked on right now, one per game, only for games with activity this week, the busiest first. Each line is the game's title, a comma, then a few plain words about the work (for example "Frontier Lab, polishing the whole AI lab"). Under ${NOW_CHARS} characters, no full stop at the end, same rules as the posts (nothing invented, no jargon). Unlike posts, behind-the-scenes work can count here if it was the week's main work. Put them in the same JSON:
{"posts": [...], "now": [{"game": "...", "text": "..."}]}`;

const recent = (devlog.posts || []).slice(0, 5);
const user = `Today is ${today}. This week's activity, game by game:

${activity.map((a) => `<game title="${a.game}">\n${JSON.stringify({ merged_pull_requests: a.prs.map(({ url, ...rest }) => rest), releases: a.releases.map(({ url, ...rest }) => rest) }, null, 1)}\n</game>`).join("\n\n")}

The "Now building" strip as it is now:
<now_building>
${JSON.stringify(nowFile.items || [], null, 1)}
</now_building>

The newest devlog posts already published:
<recent_posts>
${JSON.stringify(recent, null, 1)}
</recent_posts>

Draft this week's posts and the "Now building" lines.`;

// Sent as a batch (half price): Kelbo reads the draft whenever he gets to
// it. A slow batch saves its place and the 5:15 pm run picks it up.
const { text, usage } = await askClaude({ model: MODEL, system: SYSTEM, user, maxTokens: 16000, batch: { name: "devlog-writer", key: today } });
const answer = readJson(text, MARKER);
if (!answer || !Array.isArray(answer.posts)) {
  logCost(MODEL, usage);
  console.error("Claude's answer wasn't the expected JSON, so nothing was written. The answer was:\n" + text.slice(-2000));
  process.exit(1);
}

/* ---------- Check every post ---------- */
const active = new Set(activity.map((a) => a.game));
const used = new Set();
const posts = [];
for (const [i, raw] of answer.posts.entries()) {
  const label = `Post ${i + 1}`;
  const title = typeof raw?.title === "string" ? raw.title.replace(/\s+/g, " ").trim() : "";
  const body = typeof raw?.body === "string" ? raw.body.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim() : "";
  const game = typeof raw?.game === "string" ? raw.game : "";
  if (!titles.includes(game)) { console.warn(`${label} dropped: "${game}" isn't a title in projects.json.`); continue; }
  if (!active.has(game)) { console.warn(`${label} dropped: ${game} had no activity this week.`); continue; }
  if (used.has(game)) { console.warn(`${label} dropped: already have a post for ${game}.`); continue; }
  if (title.length < 3 || title.length > 90) { console.warn(`${label} dropped: the title is missing or too long.`); continue; }
  if (body.length < 40 || body.length > 1500) { console.warn(`${label} dropped: the body is missing or too long.`); continue; }
  const words = `${title}\n${body}`;
  if (/#\d+|\bpull request\b|\bPR\b/i.test(words)) { console.warn(`${label} dropped: it mentions a pull request.`); continue; }
  const named = [...people].find((login) => new RegExp(`\\b${login.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(words));
  if (named) { console.warn(`${label} dropped: it names "${named}".`); continue; }
  if (raw.date && raw.date !== today) console.warn(`${label}: date "${raw.date}" changed to ${today}.`);
  used.add(game);
  posts.push({ date: today, title, game, body });
  if (posts.length === MAX_POSTS) break;
}
console.log(`Kept ${posts.length} of ${answer.posts.length} drafted post(s).`);

/* ---------- Check the "Now building" lines ---------- */
const nowItems = [];
for (const [i, raw] of (Array.isArray(answer.now) ? answer.now : []).entries()) {
  const label = `Now line ${i + 1}`;
  const game = typeof raw?.game === "string" ? raw.game : "";
  const text = typeof raw?.text === "string" ? raw.text.replace(/\s+/g, " ").trim().replace(/\.$/, "") : "";
  if (!active.has(game)) { console.warn(`${label} dropped: "${game}" had no activity this week.`); continue; }
  if (nowItems.some((it) => it.game === game)) { console.warn(`${label} dropped: already have a line for ${game}.`); continue; }
  if (text.length < 5 || text.length > NOW_CHARS + 20) { console.warn(`${label} dropped: missing or too long.`); continue; }
  if (/#\d+|\bpull request\b|\bPR\b/i.test(text)) { console.warn(`${label} dropped: it mentions a pull request.`); continue; }
  nowItems.push({ game, text });
  if (nowItems.length === MAX_NOW) break;
}
// Each line links to the game itself (its "link" in projects.json), if it has one.
const newNow = nowItems.map(({ game, text }) => {
  const link = projects.find((p) => p.title === game)?.link;
  return link ? { text, link } : { text };
});
const nowChanged = newNow.length > 0 && JSON.stringify(newNow) !== JSON.stringify(nowFile.items || []);
if (nowChanged) console.log("\n--- Now building ---\n" + newNow.map((it) => `- ${it.text}`).join("\n"));
else console.log(newNow.length ? "\nNow building: same as before, not changed." : "\nNow building: no usable lines, not changed.");
for (const post of posts) console.log(`\n--- ${post.game}: ${post.title} ---\n${post.body}`);
logCost(MODEL, usage);
setOutput("posts", DRY_RUN ? 0 : posts.length);
setOutput("now", !DRY_RUN && nowChanged ? "true" : "false");

if (!posts.length && !nowChanged) {
  console.log("Nothing to add this week.");
  process.exit(0);
}
if (DRY_RUN) {
  console.log("\nDry run: devlog.json and now.json not changed.");
  process.exit(0);
}

if (posts.length) {
  devlog.posts = [...posts, ...(devlog.posts || [])];
  await writeFile("devlog.json", JSON.stringify(devlog, null, 2) + "\n");
}
if (nowChanged) await writeFile("now.json", JSON.stringify({ updated: today, items: newNow }, null, 2) + "\n");

// The pull request's description: each post with the links it came from.
const week = new Intl.DateTimeFormat("en-US", { timeZone: "America/Regina", month: "long", day: "numeric", year: "numeric" }).format(since);
const lines = [
  `Draft devlog posts and "Now building" lines from the last 7 days of game updates, written by the Devlog Writer (\`devlog-draft.yml\`). **Not merged automatically.**`,
  "",
  "Read them on the Files tab. To fix wording, edit `devlog.json` or `now.json` on this branch (pencil icon), then merge. To drop a post, delete it from the file. To skip the week, close this pull request.",
  "",
];
if (nowChanged) {
  lines.push("### Now building (home page strip)", "", ...newNow.map((it) => `- ${it.text}`), "");
}
if (!posts.length) lines.push("No devlog posts this week, only the strip.", "");
for (const post of posts) {
  const a = activity.find((x) => x.game === post.game);
  lines.push(`### ${post.game}: ${post.title}`, "", post.body.split("\n\n").map((p) => `> ${p}`).join("\n>\n"), "", "Sources:");
  for (const pr of a.prs) lines.push(`- [${pr.title.replace(/[\[\]]/g, "")}](${pr.url}) (merged ${pr.merged})`);
  for (const r of a.releases) lines.push(`- Release [${r.title.replace(/[\[\]]/g, "")}](${r.url})`);
  lines.push("");
}
const bodyFile = `${process.env.RUNNER_TEMP || "."}/devlog-draft-pr.md`;
await writeFile(bodyFile, lines.join("\n"));
setOutput("week", week);
setOutput("body_file", bodyFile);
console.log(`\nAdded ${posts.length} post(s) to the top of devlog.json. PR description in ${bodyFile}.`);

// Pre-market brief generator for Kelbo.Website
// Runs in GitHub Actions. Calls Claude with web search, writes briefs/YYYY-MM-DD.md
// and adds it to the archive index (brief-index.mjs, which also keeps the
// folder under its size limit). Needs ANTHROPIC_API_KEY in the environment.

import { readFile, readdir, writeFile, mkdir, access } from "node:fs/promises";
import { updateIndex, BRIEFS_DIR } from "./brief-index.mjs";
import { costNote } from "./claude.mjs";
import { request } from "node:https";

const MODEL = "claude-fable-5-1"; // the top model (Opus 5.5 at xhigh until Nov 9, 2026)
const EFFORT = "high";
const MAX_SEARCHES = 35; // web searches a brief may run ($10 per 1,000)
const MAX_FETCHES = 25; // whole pages it may open and read (any site)
// Fable 5.1 list prices in US dollars per million tokens, for the spending
// cap and the cost line in the run log. Cache reads are the cheap re-reads;
// writes cost 1.25x.
const PRICE = { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5, search: 0.01 };
// The spending cap for one brief, in US dollars (Kelbo, 2026-11-09: about
// $5 to $6 at most). The API has no dollar limit of its own, so the script
// keeps a running total from the token counts each reply reports:
//   - past WRAP_UP_AT, no more research: Claude is told to write the brief
//     from what it has found so far;
//   - each reply's length (max_tokens) is cut so its writing can't push the
//     total past HARD_CAP, and nothing more is sent once the total reaches it.
// Search results read part way through one reply can't be stopped, so a
// brief can land a little over HARD_CAP, never far over. A normal brief
// (about $3.50 to $5) never gets near either line.
const WRAP_UP_AT = 4;
const HARD_CAP = 6;
const MAX_REPLY = 48000; // the longest reply allowed, thinking included
const MIN_REPLY = 8000; // enough room to write the brief itself
const MARKER = "===BRIEF===";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY. Add it under repo Settings > Secrets and variables > Actions.");
  process.exit(1);
}

// Dates in Saskatchewan time (no daylight saving)
const now = new Date();
const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina" }).format(now);
const longDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Regina", weekday: "long", year: "numeric", month: "long", day: "numeric",
}).format(now);

// Hours Saskatchewan is behind ET today (1 in winter, 2 during US daylight time)
const hourIn = (tz) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
const skBehindEt = (hourIn("America/New_York") - hourIn("America/Regina") + 24) % 24;

const briefPath = `${BRIEFS_DIR}/${isoDate}.md`;

// Skip if today's brief already exists (unless FORCE=1)
try {
  await access(briefPath);
  if (process.env.FORCE !== "1") {
    console.log(`${briefPath} already exists. Set FORCE=1 to overwrite.`);
    process.exit(0);
  }
} catch { /* file doesn't exist yet, carry on */ }

const SYSTEM = `You write a pre-market trading brief for a part-time day trader in Saskatoon, Saskatchewan. He trades US stocks in whole shares, mostly MU (Micron), and follows the AI hardware and infrastructure complex. It is early morning before the US open.

Watchlist:
- Primary: MU
- Chips: NVDA, AMD, AVGO, TSM
- Memory and storage: SNDK, WDC, STX
- Neocloud and infrastructure: CRWV, NBIS, ORCL, IREN
- Power and networking: VRT, ANET
- Overnight read-through: Samsung Electronics, SK Hynix, TSMC (Taipei), Kioxia; S&P 500 and Nasdaq 100 futures

Use web search to get today's information: overnight news, Asian session moves, US futures, pre-market moves, analyst actions, scheduled economic data and earnings. Prefer sources from the last 24 hours.

Research plan. You have up to ${MAX_SEARCHES} searches and ${MAX_FETCHES} page reads (web_fetch opens a full page from any site). Spend them roughly like this:
- US futures and macro news: 3 searches
- Asia (Korea, Taiwan, Japan, the memory names): 3 searches
- MU (overnight or pre-market quote, news, analyst actions, the levels): 6 searches
- Calendar (economic data today, watchlist earnings dates this week): 2 searches
- The watchlist with what's left, names with real news first
Use web_fetch when a snippet lacks the number, time or date you need: open the quote page, the earnings calendar or the article itself instead of saying you couldn't confirm it. Don't fetch a page only to re-check what a snippet already says.

The user message includes the previous brief, if there is one. Use it to say what has changed since rather than repeating its news, and for the "Last call" line: what that brief's MU gap call said and how MU actually traded since (the open or the close, with the move in percent).

First check whether US stock markets are open today. If they are closed (weekend or holiday), still use every heading below: say the market is closed and when it reopens under Overnight and Asia, give MU's last close and any news under its heading with the gap call "Market closed", keep the Watchlist, and give the next session's calendar.

Rules:
- Prices move. Give every price with its approximate time in ET. Mark key levels as estimates drawn from reported data (prior close, recent highs and lows, pre-market range). Never present a level as certain.
- Give the gap expectation as a direction and rough size, with the reasoning.
- Times for scheduled events: give ET and Saskatchewan time (today Saskatchewan time is ET minus ${skBehindEt} hour${skBehindEt === 1 ? "" : "s"}, so the 9:30 ET open is ${9 - skBehindEt}:30 SK).
- Be direct and specific. No hype, no filler, no financial-advice disclaimers beyond the levels note.
- If you can't find something, say so in a few words rather than guessing.

When you are done researching, output the line ${MARKER} and then the brief in exactly this Markdown format, with nothing after it. Use these headings word for word, in this order, every day: the "# " headline, the "TLDR:" line, then ## Overnight and Asia, ## MU, ## Watchlist, ## Calendar, ## Sources. Never rename, add or drop a heading; put extra notes inside the nearest section.

# <headline: the single most important thing for today, under 12 words>
TLDR: <one sentence summary>

## Overnight and Asia
<3 to 5 bullets: futures, Asian memory and chip names, major macro news>

## MU
**Last call:** <the previous brief's gap call and what MU actually did; "No previous brief" if there isn't one>
**Gap call:** <direction, rough size, why>
**Pre-market:** <price and time if found>
**Key levels (estimates):** <support and resistance with what each is based on>
**News:** <bullets>
**Bull case for the open:** <1 to 2 sentences>
**Bear case for the open:** <1 to 2 sentences>

## Watchlist
<one bullet per ticker: **TICKER** then one line. Put names with real news first and start their line with "News:". Skip none.>

## Calendar
<bullets: economic data and earnings today, with ET and SK times. Mention watchlist earnings this week too.>

## Sources
<5 to 12 bullets, each "- [page title](https://full-url)", for the pages this brief relies on most. Copy each URL exactly as it appeared in your search results; never make one up or shorten it.>`;

// Search and page reading both run on Anthropic's side. Neither is limited
// to certain sites. Both filter what they find with a little code before
// it reaches the model, which keeps the token count down.
const tools = [
  { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: MAX_FETCHES },
];

// Sends one request to the Messages API and returns {status, text}.
// The reply is streamed (server-sent events): a brief with 35 searches can
// take 10 minutes or more, and a connection that sits silent that long gets
// cut off on the way (it did on 2026-11-05 and 11-06, about 4.5 minutes in,
// four tries in a row). Streaming keeps bytes flowing the whole time.
// buildMessage puts the events back together into the same message object a
// normal reply would give, so the rest of the script doesn't change.
const TIMEOUT_MS = 20 * 60 * 1000;
// How many times to send a request whose connection drops (see callClaude).
// Just once: on Fable a second try costs about as much as a whole brief
// and would break the spending cap. The 7:15 back-up run gets another go.
const NETWORK_TRIES = 1;
function post(body) {
  return new Promise((resolve, reject) => {
    const req = request("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        // An error before streaming starts comes back as plain JSON.
        if (res.statusCode < 200 || res.statusCode >= 300) return resolve({ status: res.statusCode, text });
        try {
          resolve(buildMessage(text));
        } catch (err) {
          reject(err);
        }
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error(`no reply in ${TIMEOUT_MS / 60000} minutes`)));
    req.on("error", reject);
    req.end(body);
  });
}

// Turns the streamed events back into one message: {content, stop_reason,
// usage}. An "error" event part way (for example "overloaded") becomes a
// 529 so callClaude retries it like any other busy reply.
function buildMessage(stream) {
  let msg = null;
  const json = {};
  for (const chunk of stream.split(/\r?\n\r?\n/)) {
    const line = chunk.split(/\r?\n/).find((l) => l.startsWith("data:"));
    if (!line) continue;
    const ev = JSON.parse(line.slice(5));
    if (ev.type === "message_start") msg = ev.message;
    // midStream: the research so far is already paid for, so callClaude
    // treats it like a dropped connection, not a free busy reply.
    else if (ev.type === "error") return { status: 529, midStream: true, text: JSON.stringify(ev) };
    else if (ev.type === "content_block_start") msg.content[ev.index] = ev.content_block;
    else if (ev.type === "content_block_delta") {
      const b = msg.content[ev.index];
      const d = ev.delta;
      if (d.type === "text_delta") b.text += d.text;
      else if (d.type === "thinking_delta") b.thinking += d.thinking;
      else if (d.type === "signature_delta") b.signature = (b.signature || "") + d.signature;
      else if (d.type === "citations_delta") (b.citations ||= []).push(d.citation);
      else if (d.type === "input_json_delta") json[ev.index] = (json[ev.index] || "") + d.partial_json;
    } else if (ev.type === "content_block_stop") {
      if (json[ev.index] !== undefined) msg.content[ev.index].input = json[ev.index] ? JSON.parse(json[ev.index]) : {};
    } else if (ev.type === "message_delta") {
      Object.assign(msg, ev.delta);
      msg.usage = { ...msg.usage, ...ev.usage };
    }
  }
  if (!msg || !msg.stop_reason) throw new Error("the streamed reply ended early");
  return { status: 200, text: JSON.stringify(msg) };
}

// withTools = false sends the request with web search turned off.
// maxTokens: this reply's length limit (see roomLeft below).
async function callClaude(messages, { withTools = true, maxTokens = MAX_REPLY } = {}, attempt = 1) {
  let res;
  try {
    res = await post(JSON.stringify({
    // max_tokens covers the model's thinking as well as the brief itself, so
    // leave it roomy: a tight cap cuts the brief off mid-sentence. It's
    // only a ceiling; the brief is billed for what it really writes.
    // effort "high": Fable's default, written out so it stays high. Fable
    // always thinks (there is no thinking setting to send).
    // cache_control: every step of the research re-reads everything found so
    // far. Caching bills those re-reads at a twentieth of the price. The
    // marker on the instructions keeps them cached; the top-level one moves
    // along the conversation as it grows.
      model: MODEL,
      stream: true,
      max_tokens: maxTokens,
      output_config: { effort: EFFORT },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
      cache_control: { type: "ephemeral" },
      ...(withTools && { tools }),
    }));
  } catch (err) {
    // A dropped connection: try once more, then give up. A connection
    // usually drops partway through the research, after most of the
    // searches are already paid for, so each extra try costs about as much
    // as a whole brief (on 2026-11-06, four dropped tries cost $8.83 and
    // saved nothing). The 7:15 back-up run gets another go.
    if (attempt >= NETWORK_TRIES) throw err;
    console.log(`Network error (${err.message}), retrying in ${15 * attempt}s`);
    await new Promise((r) => setTimeout(r, 15000 * attempt));
    return callClaude(messages, { withTools, maxTokens }, attempt + 1);
  }
  if (res.midStream && attempt < NETWORK_TRIES) {
    console.log("The reply broke off part way; trying once more.");
    return callClaude(messages, { withTools, maxTokens }, attempt + 1);
  }
  if (!res.midStream && (res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = 15000 * attempt;
    console.log(`API returned ${res.status}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
    return callClaude(messages, { withTools, maxTokens }, attempt + 1);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`API error ${res.status}: ${res.text}`);
  }
  return JSON.parse(res.text);
}

// The newest brief before today's, without its Sources list, so the model
// can check its last gap call and say what has changed since.
let previous = "";
try {
  const older = (await readdir(BRIEFS_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f < `${isoDate}.md`).sort();
  if (older.length) {
    const name = older[older.length - 1];
    const body = (await readFile(`${BRIEFS_DIR}/${name}`, "utf8")).split(/^## Sources\s*$/m)[0].trim();
    previous = `\n\nThe previous brief (${name.slice(0, 10)}):\n<previous_brief>\n${body}\n</previous_brief>`;
  }
} catch { /* no briefs folder yet */ }

// This week's lessons from the report cards (brief-lessons.mjs), if the
// file is under 14 days old. They go in this user message, not in SYSTEM,
// so the cached instructions stay the same every day.
let lessons = "";
let lessonCount = 0;
try {
  const file = JSON.parse(await readFile("lessons/latest.json", "utf8"));
  const age = Date.now() - Date.parse(file.updated);
  const active = (file.lessons || []).filter((l) => l && l.status !== "retired" && typeof l.text === "string");
  if (age >= 0 && age < 14 * 864e5 && active.length) {
    lessonCount = active.length;
    lessons = "\n\nLessons from your recent report cards — apply them:\n" +
      active.map((l) => `- ${l.text}${l.evidence?.count ? ` (${l.evidence.count})` : ""}`).join("\n");
  }
} catch { /* no lessons yet: carry on without them */ }
console.log(`Lessons used: ${lessonCount}`);

const messages = [{
  role: "user",
  content: `Today is ${longDate} (Saskatchewan date). Write today's pre-market brief.${previous || "\n\nThere is no previous brief."}${lessons}`,
}];
const allBlocks = [];
const usage = { input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0, searches: 0, fetches: 0 };
const addUsage = (u = {}) => {
  usage.input_tokens += u.input_tokens ?? 0;
  usage.output_tokens += u.output_tokens ?? 0;
  usage.cache_read += u.cache_read_input_tokens ?? 0;
  usage.cache_write += u.cache_creation_input_tokens ?? 0;
  usage.searches += u.server_tool_use?.web_search_requests ?? 0;
  usage.fetches += u.server_tool_use?.web_fetch_requests ?? 0;
};
// The running total in US dollars, at list prices.
const spent = () => (usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output +
  usage.cache_read * PRICE.cacheRead + usage.cache_write * PRICE.cacheWrite) / 1e6 + usage.searches * PRICE.search;
// The longest next reply that keeps the total under HARD_CAP, leaving
// 50 cents for the text it reads.
const roomLeft = () => Math.max(MIN_REPLY, Math.min(MAX_REPLY, Math.floor((HARD_CAP - spent() - 0.5) / (PRICE.output / 1e6))));

// Server-side web search can pause long turns; continue up to 5 times,
// inside the spending cap (see WRAP_UP_AT and HARD_CAP at the top).
let wrappedUp = false;
let stoppedAtCap = false;
let lastRound = 0; // what the latest reply cost, to guess the next one
for (let i = 0; i < 6; i++) {
  const before = spent();
  let data;
  try {
    data = await callClaude(messages, { maxTokens: roomLeft() });
  } catch (err) {
    // The wrap-up request is the only one with a message of ours after a
    // paused turn. If the API turns it down (not billed), keep what's here.
    if (!wrappedUp) throw err;
    console.warn(`The wrap-up request failed (${err.message}); using what's written so far.`);
    break;
  }
  allBlocks.push(...data.content);
  addUsage(data.usage);
  lastRound = spent() - before;
  if (data.stop_reason === "refusal") throw new Error("Claude declined to write today's brief (stop reason: refusal).");
  if (data.stop_reason === "max_tokens") console.warn("Hit max_tokens: the brief may be cut short.");
  if (data.stop_reason !== "pause_turn") break;
  messages.push({ role: "assistant", content: data.content });
  if (spent() >= HARD_CAP) {
    stoppedAtCap = true;
    console.warn(`Spent about US$${spent().toFixed(2)}: at the US$${HARD_CAP} cap, so nothing more is sent.`);
    break;
  }
  // Wrap up past WRAP_UP_AT, or sooner if another round like the last one
  // would go past HARD_CAP.
  if ((spent() >= WRAP_UP_AT || spent() + lastRound >= HARD_CAP) && !wrappedUp) {
    wrappedUp = true;
    console.log(`Spent about US$${spent().toFixed(2)} on research; asking for the brief now.`);
    messages.push({ role: "user", content: `That's the research budget used up. Don't search or open any more pages: write today's brief now from what you've found, in the exact format from your instructions, starting with ${MARKER}.` });
  }
}

// Join text blocks, collect cited sources
let text = "";
const sources = new Map();
for (const block of allBlocks) {
  if (block.type !== "text") continue;
  text += block.text;
  for (const c of block.citations ?? []) {
    if (c.url && !sources.has(c.url)) sources.set(c.url, c.title || c.url);
  }
}

// Every web address that came back from the searches this run, so the
// Sources list can only hold pages the model really saw. Search results can
// arrive in different block types, so this just scans them all for links.
const seenUrls = new Set();
const normUrl = (u) => {
  try {
    const x = new URL(u);
    return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + x.search).toLowerCase();
  } catch { return ""; }
};
for (const block of allBlocks) {
  if (block.type === "text") continue;
  for (const m of JSON.stringify(block).matchAll(/https?:\/\/[^\s"'<>\\)\]]+/g)) seenUrls.add(normUrl(m[0]));
}
seenUrls.delete("");
console.log(`Blocks: ${Object.entries(allBlocks.reduce((n, b) => (n[b.type] = (n[b.type] || 0) + 1, n), {})).map(([k, v]) => `${k} ${v}`).join(", ")}; ${seenUrls.size} links seen in search results, ${sources.size} cited.`);

const markerAt = text.lastIndexOf(MARKER);
let brief = (markerAt >= 0 ? text.slice(markerAt + MARKER.length) : text).trim();
if (!brief.startsWith("#")) {
  const h = brief.indexOf("\n# ");
  if (h >= 0) brief = brief.slice(h + 1).trim();
}
if (!brief) throw new Error("Claude returned no brief text.");
// Stopped at the cap before the brief was written: don't save research notes
// as if they were a brief. The run goes red and the 7:15 back-up tries again.
if (stoppedAtCap && markerAt < 0) throw new Error(`Reached the US$${HARD_CAP} spending cap before the brief was written; nothing saved.`);

// The page expects the same headings every day. If any are missing, ask
// once for the same brief rewritten in the format (no new searching).
const REQUIRED = ["## Overnight and Asia", "## MU", "## Watchlist", "## Calendar"];
const missing = () => [
  ...(/^#\s+\S/m.test(brief) ? [] : ["# headline"]),
  ...(/^TLDR:/m.test(brief) ? [] : ["TLDR:"]),
  ...REQUIRED.filter((h) => !new RegExp(`^${h}\\s*$`, "m").test(brief)),
];
if (missing().length && spent() >= HARD_CAP) {
  console.warn(`Brief is missing ${missing().join(", ")}, but the spending cap is reached; saving it as is.`);
} else if (missing().length) {
  console.warn(`Brief is missing ${missing().join(", ")}; asking for a reformat.`);
  const fix = await callClaude([
    messages[0],
    { role: "assistant", content: brief },
    { role: "user", content: `Rewrite that brief in the exact format from your instructions, using every heading word for word: # headline, TLDR:, ${REQUIRED.join(", ")}. Keep the same facts. Output ${MARKER} first.` },
  ], { withTools: false, maxTokens: roomLeft() });
  addUsage(fix.usage);
  const fixed = fix.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const at = fixed.lastIndexOf(MARKER);
  const retry = (at >= 0 ? fixed.slice(at + MARKER.length) : fixed).trim();
  if (retry.startsWith("#")) brief = retry;
  if (missing().length) console.warn(`Still missing ${missing().join(", ")}; saving it as is.`);
}

const headline = (brief.match(/^#\s+(.+)$/m)?.[1] ?? "Pre-market brief").trim();
const tldr = (brief.match(/^TLDR:\s*(.+)$/m)?.[1] ?? "").trim();

// Sources: the model's own list (only links the searches really returned),
// then any inline citations, without repeats, at most 15.
const srcAt = brief.search(/^## Sources\s*$/m);
if (srcAt >= 0) {
  const listed = brief.slice(srcAt);
  brief = brief.slice(0, srcAt).trimEnd();
  const picked = new Map();
  for (const m of listed.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    if (seenUrls.has(normUrl(m[2]))) picked.set(m[2], m[1]);
    else console.warn(`Dropped a source the searches never returned: ${m[2]}`);
  }
  for (const [url, title] of sources) picked.set(url, title);
  sources.clear();
  for (const [url, title] of picked) sources.set(url, title);
}
if (sources.size) {
  brief += "\n\n## Sources\n" + [...sources].slice(0, 15)
    .map(([url, title]) => `- [${title.replace(/[\[\]]/g, "")}](${url})`).join("\n");
} else {
  console.warn("No sources to list this time.");
}
brief += `\n\n<small>Generated ${new Date().toISOString()} by ${MODEL}. Levels are estimates from web reports, not live quotes.</small>\n`;

await mkdir(BRIEFS_DIR, { recursive: true });
await writeFile(briefPath, brief);

// Add it to the archive (briefs/index.json, briefs/months/, briefs/latest.json)
// and trim the folder to size: see brief-index.mjs.
// time: when this brief went out, so the site can flag it as new for an hour.
await updateIndex({ date: isoDate, time: new Date().toISOString(), headline, tldr });

console.log(`Wrote ${briefPath}: ${headline}`);
console.log(`Tokens: ${usage.input_tokens} in, ${usage.cache_read} cache reads, ${usage.cache_write} cache writes, ${usage.output_tokens} out`);
console.log(`Searches: ${usage.searches} of ${MAX_SEARCHES}; pages read: ${usage.fetches} of ${MAX_FETCHES}`);
// An estimate at list prices; the Anthropic console has the real bill.
const cost = spent();
console.log(`Estimated cost: US$${cost.toFixed(2)} (${MODEL}, cap US$${HARD_CAP})`);
costNote(cost, `${MODEL}, ${usage.searches} searches, ${usage.fetches} pages read`);

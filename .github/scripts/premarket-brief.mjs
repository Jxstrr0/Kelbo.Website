// Pre-market brief generator for Kelbo.Website
// Runs in GitHub Actions. Calls Claude with web search, writes briefs/YYYY-MM-DD.md
// and updates briefs/index.json. Needs ANTHROPIC_API_KEY in the environment.

import { readFile, writeFile, mkdir, access } from "node:fs/promises";

const MODEL = "claude-opus-5-5";
const MAX_SEARCHES = 20;
const BRIEFS_DIR = "briefs";
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
const indexPath = `${BRIEFS_DIR}/index.json`;

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
- Overnight read-through: Samsung Electronics, SK Hynix, TSMC (Taipei), Kioxia; S&P 500 and Nasdaq 100 futures; the semiconductor index

Use web search to get today's information: overnight news, Asian session moves, US futures, pre-market moves, analyst actions, scheduled economic data and earnings. Prefer sources from the last 24 hours. You have up to ${MAX_SEARCHES} searches: cover futures, Asia, MU, the watchlist and the calendar before going deeper on any one.

First check whether US stock markets are open today. If they are closed (weekend or holiday), still use every heading below: say the market is closed and when it reopens under Overnight and Asia, give MU's last close and any news under MU with the gap call "Market closed", keep the Watchlist, and give the next session's calendar.

Rules:
- Prices move. Give every price with its approximate time in ET. Mark key levels as estimates drawn from reported data (prior close, recent highs and lows, pre-market range). Never present a level as certain.
- Give the gap expectation as a direction and rough size, with the reasoning.
- Times for scheduled events: give ET and Saskatchewan time (today Saskatchewan time is ET minus ${skBehindEt} hour${skBehindEt === 1 ? "" : "s"}, so the 9:30 ET open is ${9 - skBehindEt}:30 SK).
- Be direct and specific. No hype, no filler, no financial-advice disclaimers beyond the levels note.
- If you can't find something, say so in a few words rather than guessing.

When you are done researching, output the line ${MARKER} and then the brief in exactly this Markdown format, with nothing after it. Use these headings word for word, in this order, every day: the "# " headline, the "TLDR:" line, then ## Overnight and Asia, ## MU, ## Watchlist, ## Calendar. Never rename, add or drop a heading; put extra notes inside the nearest section.

# <headline: the single most important thing for today, under 12 words>
TLDR: <one sentence summary>

## Overnight and Asia
<3 to 5 bullets: futures, Asian memory and chip names, major macro news>

## MU
**Gap call:** <direction, rough size, why>
**Pre-market:** <price and time if found>
**Key levels (estimates):** <support and resistance with what each is based on>
**News:** <bullets>
**Bull case for the open:** <1 to 2 sentences>
**Bear case for the open:** <1 to 2 sentences>

## Watchlist
<one bullet per ticker: **TICKER** then one line. Put names with real news first and start their line with "News:". Skip none.>

## Calendar
<bullets: economic data and earnings today, with ET and SK times. Mention watchlist earnings this week too.>`;

const tools = [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES }];

// withTools = false sends the request with web search turned off.
async function callClaude(messages, withTools = true, attempt = 1) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    // max_tokens covers the model's thinking as well as the brief itself, so
    // leave it roomy: a tight cap cuts the brief off mid-sentence.
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, system: SYSTEM, messages, ...(withTools && { tools }) }),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = 15000 * attempt;
    console.log(`API returned ${res.status}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
    return callClaude(messages, withTools, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const messages = [{ role: "user", content: `Today is ${longDate} (Saskatchewan date). Write today's pre-market brief.` }];
const allBlocks = [];
let usage = { input_tokens: 0, output_tokens: 0 };

// Server-side web search can pause long turns; continue up to 5 times.
for (let i = 0; i < 6; i++) {
  const data = await callClaude(messages);
  allBlocks.push(...data.content);
  usage.input_tokens += data.usage?.input_tokens ?? 0;
  usage.output_tokens += data.usage?.output_tokens ?? 0;
  if (data.stop_reason === "max_tokens") console.warn("Hit max_tokens: the brief may be cut short.");
  if (data.stop_reason !== "pause_turn") break;
  messages.push({ role: "assistant", content: data.content });
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

const markerAt = text.lastIndexOf(MARKER);
let brief = (markerAt >= 0 ? text.slice(markerAt + MARKER.length) : text).trim();
if (!brief.startsWith("#")) {
  const h = brief.indexOf("\n# ");
  if (h >= 0) brief = brief.slice(h + 1).trim();
}
if (!brief) throw new Error("Claude returned no brief text.");

// The page expects the same headings every day. If any are missing, ask
// once for the same brief rewritten in the format (no new searching).
const REQUIRED = ["## Overnight and Asia", "## MU", "## Watchlist", "## Calendar"];
const missing = () => [
  ...(/^#\s+\S/m.test(brief) ? [] : ["# headline"]),
  ...(/^TLDR:/m.test(brief) ? [] : ["TLDR:"]),
  ...REQUIRED.filter((h) => !new RegExp(`^${h}\\s*$`, "m").test(brief)),
];
if (missing().length) {
  console.warn(`Brief is missing ${missing().join(", ")}; asking for a reformat.`);
  const fix = await callClaude([
    messages[0],
    { role: "assistant", content: brief },
    { role: "user", content: `Rewrite that brief in the exact format from your instructions, using every heading word for word: # headline, TLDR:, ${REQUIRED.join(", ")}. Keep the same facts. Output ${MARKER} first.` },
  ], false);
  usage.input_tokens += fix.usage?.input_tokens ?? 0;
  usage.output_tokens += fix.usage?.output_tokens ?? 0;
  const fixed = fix.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const at = fixed.lastIndexOf(MARKER);
  const retry = (at >= 0 ? fixed.slice(at + MARKER.length) : fixed).trim();
  if (retry.startsWith("#")) brief = retry;
  if (missing().length) console.warn(`Still missing ${missing().join(", ")}; saving it as is.`);
}

const headline = (brief.match(/^#\s+(.+)$/m)?.[1] ?? "Pre-market brief").trim();
const tldr = (brief.match(/^TLDR:\s*(.+)$/m)?.[1] ?? "").trim();

if (sources.size) {
  brief += "\n\n## Sources\n" + [...sources].slice(0, 15)
    .map(([url, title]) => `- [${title.replace(/[\[\]]/g, "")}](${url})`).join("\n");
}
brief += `\n\n<small>Generated ${new Date().toISOString()} by ${MODEL}. Levels are estimates from web reports, not live quotes.</small>\n`;

await mkdir(BRIEFS_DIR, { recursive: true });
await writeFile(briefPath, brief);

let index = [];
try { index = JSON.parse(await readFile(indexPath, "utf8")); } catch { /* new index */ }
index = [{ date: isoDate, headline, tldr }, ...index.filter((e) => e.date !== isoDate)];
await writeFile(indexPath, JSON.stringify(index, null, 2) + "\n");

console.log(`Wrote ${briefPath}: ${headline}`);
console.log(`Tokens: ${usage.input_tokens} in, ${usage.output_tokens} out`);

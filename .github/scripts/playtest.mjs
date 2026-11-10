// First-time player tester (one-off): Claude plays a Longlight game on a pretend phone and
// writes down where a newcomer gets confused, stuck or delighted.
// Run by .github/workflows/playtest.yml, which installs a browser on the runner first
// (PW_DIR points at it; nothing is installed in this repo).
//
//   node .github/scripts/playtest.mjs pew|scrapline|lombard [--dry] [--moves 70] [--budget 4]
//
// --dry      no API calls: just loads the game on the phone and saves a screenshot (free)
// --moves    hard cap on how many actions Claude may take
// --budget   hard cap in US dollars, worked out from the token counts the API reports
//
// The key comes from the ANTHROPIC_API_KEY secret; it is never printed. The log shows only move
// counts and cost: the notes and screenshots go into out/<game>/, uploaded as the run's artifact.
import { createRequire } from "module";
const { chromium, devices } = createRequire((process.env.PW_DIR || process.cwd()) + "/")("playwright");
import fs from "fs";
import path from "path";

const GAMES = {
  pew: {
    url: "https://pew.longlight.games/",
    name: "Prairie Engine Works",
    // Nov 10 run: Kelbo asked for a drag race this time (the earlier runs did the Career loop).
    goal: "Get an engine into a drag race at the drag strip and see it through to the result. Use whichever mode gets you there (Career or Test cell). Read the result: your time, your speed, and whether you won. If you have moves left, change something on the engine and run a second pass to try to beat your first time.",
  },
  scrapline: {
    url: "https://scrapline.longlight.games/",
    name: "Scrapline",
    goal: "Start a Career. Get a robot ready, fight your first career event (drive it yourself), and close a week.",
  },
  lombard: {
    url: "https://lombard.longlight.games/",
    name: "Lombard",
    // Nov 10 run: Kelbo asked for Lombard on its own, its first play-test.
    goal: "Start a new game and run the pawn shop through your first customers: look over what each one brings in, decide whether it is real, haggle, and make or refuse a deal. Get to the end of your first day if you can, and say how the money came out.",
  },
};

const args = process.argv.slice(2);
const gameId = args[0];
const game = GAMES[gameId];
if (!game) { console.error("usage: node playtest.mjs pew|scrapline|lombard [--dry] [--moves N] [--budget USD]"); process.exit(1); }
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : Number(args[i + 1]); };
const DRY = args.includes("--dry");
const MAX_MOVES = flag("--moves", 70);
const BUDGET = flag("--budget", 4);

// Claude Fable 5.2 on high effort (Kelbo's pick for this rerun; the Nov 8 runs used Fable 5.1). List prices, US$ per million tokens.
// Thinking is always on for this model, so there is no thinking setting; effort sets how hard it thinks.
const MODEL = "claude-fable-5-2";
const EFFORT = "high";
const PRICE = { input: 8, output: 40, cacheWrite: 10, cacheRead: 0.2 };

const OUT = path.join(process.cwd(), "playtest-out", gameId);
fs.mkdirSync(OUT, { recursive: true });

// ---------- the pretend phone ----------
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });   // 412×915, touch, fresh storage = brand-new player
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);   // raw browser input, for real finger swipes (see the drag tool below)
const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
page.on("pageerror", e => consoleErrors.push(String(e).slice(0, 300)));

await page.goto(game.url, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(8000);   // let the loading bar finish and the 3D view settle

let shotN = 0;
async function shot(label) {
  const buf = await page.screenshot({ scale: "css" });   // 412 px wide: cheap to send, still readable
  const file = `${String(++shotN).padStart(3, "0")}-${label}.png`;
  fs.writeFileSync(path.join(OUT, file), buf);
  return { buf, file };
}

if (DRY) {
  const s = await shot("loaded");
  console.log(`dry run: saved ${s.file}; console errors: ${consoleErrors.length}`);
  await browser.close();
  process.exit(0);
}

// ---------- what Claude can do on the phone ----------
const tools = [
  { name: "tap", description: "Tap the screen at a point (CSS pixels in the latest screenshot, 412 wide).",
    input_schema: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] } },
  { name: "drag", description: "Put a finger down, slide it to another point, and optionally hold it there before lifting. Use for scrolling (drag up to scroll down), sliders, or holding a drive stick.",
    input_schema: { type: "object", properties: { x1: { type: "number" }, y1: { type: "number" }, x2: { type: "number" }, y2: { type: "number" }, hold_seconds: { type: "number", description: "0 to 6" } }, required: ["x1", "y1", "x2", "y2"] } },
  { name: "type_text", description: "Type text into whatever field has focus.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "wait", description: "Do nothing for a few seconds (1 to 10), then look again.",
    input_schema: { type: "object", properties: { seconds: { type: "number" } }, required: ["seconds"] } },
  { name: "note", description: "Write down a finding about what you see right now. Use it often, the moment you feel it.",
    input_schema: { type: "object", properties: {
      kind: { type: "string", enum: ["confusing", "stuck", "bug", "liked", "idea"] },
      text: { type: "string", description: "One or two plain sentences, as a player would say it." } }, required: ["kind", "text"] } },
  { name: "finish", description: "End the session with your overall verdict. Call this when you reach the goal, give up, or are told you are out of moves.",
    input_schema: { type: "object", properties: {
      reached: { type: "string", description: "How far you got towards the goal." },
      first_impression: { type: "string" },
      top_problems: { type: "array", items: { type: "string" }, description: "The 3 to 5 things most likely to make a new player quit, worst first." },
      best_bits: { type: "array", items: { type: "string" } },
      would_keep_playing: { type: "string", description: "Yes or no, and why, in a sentence or two." } },
      required: ["reached", "first_impression", "top_problems", "best_bits", "would_keep_playing"] } },
];

const system = `You are play-testing a free phone game called ${game.name} as a complete newcomer. You have never seen it, read nothing about it, and only know what the screen shows you.
You are on a phone held upright. Each action returns a fresh screenshot (412×915 CSS pixels); coordinates are in that space.
Your goal: ${game.goal}
Play like a curious, reasonably patient first-time player. Read what the game shows you. Don't look for exploits.
The game keeps running in real time while you think, so in live moments (a race or a fight) things will have moved on by your next look. That's a limit of this test, not the game's fault: judge how clear the controls and screens are, not your own reaction speed.
Use the note tool the moment something confuses you, blocks you, looks broken, or pleases you. Be specific: name the button or screen. These notes are the point of the test.
If you are stuck for about 5 moves, note it and try something else. You have at most ${MAX_MOVES} actions. When you reach the goal, give up, or are told you are out of moves, call finish.`;

// One Messages API call, the same plain fetch the other robots use (claude.mjs). Retries once on a
// busy or failed server, never more.
async function callClaude(body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) { await new Promise(r => setTimeout(r, 20000)); continue; }
    throw new Error(`Claude API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
const notes = [];
let finalReport = null, spent = 0, moves = 0;
const usageTotals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

function addUsage(u) {
  const i = u.input_tokens || 0, o = u.output_tokens || 0, w = u.cache_creation_input_tokens || 0, r = u.cache_read_input_tokens || 0;
  usageTotals.input += i; usageTotals.output += o; usageTotals.cacheWrite += w; usageTotals.cacheRead += r;
  spent += (i * PRICE.input + o * PRICE.output + w * PRICE.cacheWrite + r * PRICE.cacheRead) / 1e6;
}

const imageBlock = buf => ({ type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } });
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

async function runTool(name, input) {
  if (name === "note") {
    const s = await shot("note-" + input.kind);
    notes.push({ move: moves, kind: input.kind, text: input.text, shot: s.file });
    return [{ type: "text", text: "Noted." }];
  }
  if (name === "finish") { finalReport = input; return [{ type: "text", text: "Thanks, session over." }]; }
  moves++;
  const errsBefore = consoleErrors.length;
  if (name === "tap") await page.touchscreen.tap(clamp(input.x, 0, 411), clamp(input.y, 0, 914));
  else if (name === "drag") {
    // A real finger swipe (touch events), not a mouse drag: a mouse drag can't scroll a
    // panel on a phone page, which made the first run think scrolling was broken.
    const x1 = clamp(input.x1, 0, 411), y1 = clamp(input.y1, 0, 914), x2 = clamp(input.x2, 0, 411), y2 = clamp(input.y2, 0, 914);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    await touch("touchStart", x1, y1);
    for (let s = 1; s <= 12; s++) { await touch("touchMove", x1 + (x2 - x1) * s / 12, y1 + (y2 - y1) * s / 12); await page.waitForTimeout(16); }
    await page.waitForTimeout(clamp(input.hold_seconds, 0, 6) * 1000);   // finger stays down (a drive stick)
    await touch("touchEnd");
  }
  else if (name === "type_text") await page.keyboard.type(String(input.text).slice(0, 200));
  else if (name === "wait") await page.waitForTimeout(clamp(input.seconds, 1, 10) * 1000);
  await page.waitForTimeout(900);   // let the screen react
  const s = await shot(`m${moves}-${name}`);
  const out = [imageBlock(s.buf)];
  const newErrs = consoleErrors.slice(errsBefore);
  if (newErrs.length) out.push({ type: "text", text: "The browser console logged errors just now:\n" + newErrs.join("\n") });
  out.push({ type: "text", text: `Move ${moves} of ${MAX_MOVES}.` });
  return out;
}

const first = await shot("start");
const messages = [{ role: "user", content: [imageBlock(first.buf), { type: "text", text: "The game has just loaded. Off you go." }] }];

while (!finalReport) {
  const outOfMoves = moves >= MAX_MOVES || spent >= BUDGET * 0.9;
  const res = await callClaude({
    model: MODEL, max_tokens: 16000, output_config: { effort: EFFORT }, system, tools, messages,
    cache_control: { type: "ephemeral" },   // re-reading the earlier turns from cache costs a twentieth of fresh input
  });
  addUsage(res.usage);
  messages.push({ role: "assistant", content: res.content });
  const uses = res.content.filter(b => b.type === "tool_use");
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") { console.log("stopped: " + res.stop_reason); break; }
  if (!uses.length) {
    if (outOfMoves) break;
    messages.push({ role: "user", content: [{ type: "text", text: "Please keep playing using the tools, or call finish." }] });
    continue;
  }
  const results = [];
  for (const u of uses) {
    const blocked = outOfMoves && !["note", "finish"].includes(u.name);
    const content = blocked ? [{ type: "text", text: "Out of moves. Call finish now." }] : await runTool(u.name, u.input);
    results.push({ type: "tool_result", tool_use_id: u.id, content });
  }
  if (moves >= MAX_MOVES || spent >= BUDGET * 0.9) results.push({ type: "text", text: "You are out of moves. Add any last notes, then call finish." });
  messages.push({ role: "user", content: results });
  console.log(`move ${moves}/${MAX_MOVES}, about US$${spent.toFixed(2)} so far`);
  if (spent >= BUDGET) { console.log("budget reached: stopping"); break; }
}

await browser.close();
const report = { game: game.name, url: game.url, model: MODEL, effort: EFFORT, moves, costUSD: Number(spent.toFixed(2)), usage: usageTotals,
  consoleErrors: [...new Set(consoleErrors)].slice(0, 30), notes, final: finalReport };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`done: ${moves} moves, about US$${spent.toFixed(2)}, ${notes.length} notes -> ${path.join(OUT, "report.json")}`);

// Playtest group report (one-off): reads every playtest-out/<game>-p<n>/report.json the
// Playtester wrote and asks Claude Fable 5.2 (high effort) for one compiled report:
// what goes wrong across several games, then each game's top fixes.
// Run by .github/workflows/playtest.yml after all the players finish.
//
//   node .github/scripts/playtest-report.mjs [--dry]
//
// --dry   no API call: just counts the reports and writes the prompt it would send (free)
//
// The log shows only counts and cost. The report goes to playtest-out/report.md, in the
// run's artifact, never into the log.
import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry");
const MODEL = "claude-fable-5-2";
const EFFORT = "high";
const PRICE = { input: 8, output: 40 };   // US$ per million tokens, list prices
const OUT = path.join(process.cwd(), "playtest-out");

// Gather the players' reports. Screenshots stay out: the notes already name the screens.
const reports = [];
for (const dir of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
  const f = path.join(OUT, dir, "report.json");
  if (!fs.existsSync(f)) continue;
  const r = JSON.parse(fs.readFileSync(f, "utf8"));
  delete r.usage;
  r.notes = (r.notes || []).map(({ shot, ...n }) => ({ ...n, screenshot: `${dir}/${shot}` }));
  reports.push(r);
}
console.log(`${reports.length} player reports found`);
if (!reports.length) process.exit(DRY ? 0 : 1);   // a dry run writes no player reports

const prompt = `Below are ${reports.length} first-time playtest reports for the games of Longlight Interactive, a one-person indie studio making free phone-first browser games. Each game was played by two separate newcomers on a phone (player 1 careful, player 2 quick and impatient), each with a goal and a move cap. Each report has the player's notes (kind: confusing, stuck, bug, liked, idea, with the move number and a screenshot file name), browser console errors, and a final verdict.

Write one compiled report in Markdown for the studio's owner, a beginner-plus coder who reads on a phone. Plain words, short paragraphs, no jargon.

1. **The headline**: five lines at most. Which games a newcomer would keep playing, and the single biggest problem across the studio.
2. **Across the games**: problems that show up in more than one game (onboarding, text size, buttons, saving, controls...). Name the games each one hits.
3. **Game by game**, one section each, in this order: Lombard, Scrapline, Prairie Engine Works, Ink, Escapement, Frontier Lab, The Whip. For each: how far each player got, where the two players agreed and where they differed, real bugs (with console errors if any), the top 3 to 5 fixes worst first (each with the screenshot file name that shows it), and what to keep.
4. **Quick wins**: up to ten small fixes, each under an hour of work, with the game named.

Only report what the players saw. Don't invent features or numbers. Where a note may be the test's own limit (the game runs in real time while the player thinks), say so.

Reports:
${JSON.stringify(reports, null, 1)}`;

if (DRY) {
  fs.writeFileSync(path.join(OUT, "report-prompt.txt"), prompt);
  console.log(`dry run: prompt is about ${Math.round(prompt.length / 4)} tokens; nothing sent`);
  process.exit(0);
}

// Streamed, since a long answer at high effort could outlast a plain request.
// Retries once on a busy or failed server, never more.
async function callClaude(body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ ...body, stream: true }),
    });
    if (!res.ok) {
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) { await new Promise(r => setTimeout(r, 20000)); continue; }
      throw new Error(`Claude API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    let text = "", buf = "", stop = null;
    const usage = { input: 0, output: 0 };
    const dec = new TextDecoder();
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const ev = JSON.parse(line.slice(5));
        if (ev.type === "message_start") usage.input = ev.message.usage.input_tokens || 0;
        else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") text += ev.delta.text;
        else if (ev.type === "message_delta") { usage.output = ev.usage.output_tokens || 0; stop = ev.delta.stop_reason; }
        else if (ev.type === "error") throw new Error("Claude stream error: " + (ev.error?.type || "unknown"));
      }
    }
    return { text, usage, stop };
  }
}

const { text, usage, stop } = await callClaude({
  model: MODEL, max_tokens: 32000, output_config: { effort: EFFORT },
  messages: [{ role: "user", content: prompt }],
});
const cost = (usage.input * PRICE.input + usage.output * PRICE.output) / 1e6;
fs.writeFileSync(path.join(OUT, "report.md"), text);
console.log(`report written (${stop}): about US$${cost.toFixed(2)}`);

// =====================================================================
// ONE CALL TO CLAUDE (shared by the weekly robots)
// ---------------------------------------------------------------------
// brief-lessons.mjs, devlog-draft.mjs and release-lines.mjs each ask
// Claude one question with no web search. This file holds the parts they
// share, copied from the brief's script (premarket-brief.mjs):
//   - plain Node fetch to the Anthropic Messages API (no packages),
//   - output_config.effort,
//   - prompt caching (a marker on the instructions plus a top-level one),
//   - retries when the API is busy (429), has a hiccup (5xx) or can't be
//     reached at all (a network blip): up to 4 tries, waiting longer each time,
//   - the token and estimated-cost lines in the run log.
// The key comes from the ANTHROPIC_API_KEY repository secret, which the
// workflow passes in. It is never written in this repo.
// =====================================================================

import { appendFileSync } from "node:fs";

// List prices in US dollars per million tokens, for the cost line in the
// run log (the Anthropic console has the real bill). Cache reads are the
// cheap re-reads; cache writes cost 1.25x.
export const PRICES = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

// Today's date in Saskatchewan (no daylight saving), like "2026-11-07".
export const skDate = (when = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina" }).format(when);

// Asks Claude once. Returns { text, usage, stop }.
export async function askClaude({ model, system, user, maxTokens = 16000, effort = "high" }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Add it under repo Settings > Secrets and variables > Actions.");
  }
  const body = JSON.stringify({
    model,
    // max_tokens covers the model's thinking as well as its answer, so it's
    // roomy. It's only a ceiling: a call is billed for what it really writes.
    max_tokens: maxTokens,
    output_config: { effort },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    cache_control: { type: "ephemeral" },
  });

  for (let attempt = 1; ; attempt++) {
    let res;
    let why;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
      });
      if (res.status === 429 || res.status >= 500) why = `API returned ${res.status}`;
    } catch (err) {
      // The connection itself failed (a network blip).
      why = `Couldn't reach the API (${err.message})`;
    }
    if (why && attempt < 4) {
      const wait = 15000 * attempt;
      console.log(`${why}, retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res) throw new Error(why);
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.stop_reason === "max_tokens") console.warn("Hit max_tokens: the answer may be cut short.");
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text, usage: data.usage || {}, stop: data.stop_reason };
  }
}

// Prints the token count and the estimated cost, like the brief does.
export function logCost(model, u = {}) {
  const p = PRICES[model];
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  console.log(`Tokens: ${input} in, ${read} cache reads, ${write} cache writes, ${output} out`);
  const cost = (input * p.input + output * p.output + read * p.cacheRead + write * p.cacheWrite) / 1e6;
  console.log(`Estimated cost: US$${cost.toFixed(2)} (${model})`);
  costNote(cost, `${model}${DRY_RUN ? ", dry run" : ""}`);
}

// Pins the cost to the run as a GitHub note (shown on the run's page in the
// Actions tab). Notes on a public repo can be read without logging in, which
// is how the Robot Cost Log picks up each run's cost. Outside GitHub (a local
// run) it prints nothing extra.
export function costNote(cost, details = "") {
  if (!process.env.GITHUB_ACTIONS) return;
  const text = `US$${cost.toFixed(2)}${details ? ` · ${details}` : ""}`.replace(/[\r\n%]/g, " ");
  console.log(`::notice title=Cost::${text}`);
}

// Pulls the JSON answer out of the reply: everything after the marker line,
// from the first "{" to the last "}". Returns null if it won't parse.
export function readJson(text, marker) {
  const at = text.lastIndexOf(marker);
  const tail = at >= 0 ? text.slice(at + marker.length) : text;
  const start = tail.indexOf("{");
  const end = tail.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(tail.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Writes "name=value" for later workflow steps to read (GitHub only).
export function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

// DRY_RUN=1: print what would be saved and change nothing.
export const DRY_RUN = process.env.DRY_RUN === "1";

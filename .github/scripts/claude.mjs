// =====================================================================
// ONE CALL TO CLAUDE (shared by the weekly robots)
// ---------------------------------------------------------------------
// brief-lessons.mjs, devlog-draft.mjs and release-lines.mjs each ask
// Claude one question with no web search (askClaude). The two journal
// robots (journal-forecast.mjs, journal-grade.mjs) use askClaudeWeb at the
// bottom, with web search on. This file holds the parts they all
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

/* =====================================================================
   WITH WEB SEARCH (the Forecaster and the Scorekeeper)
   ---------------------------------------------------------------------
   The same call, with Claude's server-side web search and page reads
   turned on, like the brief and the Grader use. Anthropic runs the
   searches, so there's still no other key. A long search can come back
   with "pause_turn"; the loop sends it back to carry on, up to 5 times.
   Searches cost US$10 per 1,000 on top of the tokens.
   ===================================================================== */
const SEARCH_PRICE = 0.01; // US$ per web search

// One request, with the same 4 tries as askClaude.
async function send(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Add it under repo Settings > Secrets and variables > Actions.");
  }
  for (let attempt = 1; ; attempt++) {
    let res;
    let why;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) why = `API returned ${res.status}`;
    } catch (err) {
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
    return res.json();
  }
}

// Asks Claude with search on. Returns { text, blocks, usage }; usage adds
// up every round: input, output, cacheRead, cacheWrite, searches, fetches.
// If check(text) says the answer isn't usable, "fix" is sent once as a
// follow-up with search off, asking for the same facts in the format.
export async function askClaudeWeb({ model, system, user, maxTokens = 32000, effort = "high", maxSearches, maxFetches, check, fix }) {
  const base = {
    model,
    // max_tokens covers thinking as well as the answer. It's only a ceiling.
    max_tokens: maxTokens,
    output_config: { effort },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    cache_control: { type: "ephemeral" },
  };
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: maxSearches },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxFetches },
  ];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, fetches: 0 };
  const add = (u = {}) => {
    usage.input += u.input_tokens ?? 0;
    usage.output += u.output_tokens ?? 0;
    usage.cacheRead += u.cache_read_input_tokens ?? 0;
    usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    usage.searches += u.server_tool_use?.web_search_requests ?? 0;
    usage.fetches += u.server_tool_use?.web_fetch_requests ?? 0;
  };
  const textOf = (list) => list.filter((b) => b.type === "text").map((b) => b.text).join("");

  const messages = [{ role: "user", content: user }];
  const blocks = [];
  for (let i = 0; i < 6; i++) {
    const data = await send({ ...base, tools, messages });
    blocks.push(...(data.content || []));
    add(data.usage);
    if (data.stop_reason === "max_tokens") console.warn("Hit max_tokens: the answer may be cut short.");
    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }
  let text = textOf(blocks);
  if (check && fix && !check(text)) {
    console.warn("The answer wasn't in the expected format; asking once more with search off.");
    const data = await send({
      ...base,
      messages: [messages[0], { role: "assistant", content: text || "(no answer)" }, { role: "user", content: fix }],
    });
    add(data.usage);
    text = textOf(data.content || []);
  }
  return { text, blocks, usage };
}

// Prints the tokens, searches and estimated cost, and pins the cost note.
export function logWebCost(model, u, maxSearches, maxFetches) {
  const p = PRICES[model];
  console.log(`Tokens: ${u.input} in, ${u.cacheRead} cache reads, ${u.cacheWrite} cache writes, ${u.output} out`);
  console.log(`Searches: ${u.searches} of ${maxSearches}; pages read: ${u.fetches} of ${maxFetches}`);
  const cost = (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e6 +
    u.searches * SEARCH_PRICE;
  console.log(`Estimated cost: US$${cost.toFixed(2)} (${model})`);
  costNote(cost, `${model}, ${u.searches} searches, ${u.fetches} pages read${DRY_RUN ? ", dry run" : ""}`);
}

// Keeps only the sources whose links really came back from this run's
// searches and page reads, so a made-up link never reaches the site.
// list is [{ title, url }] from Claude's answer; at most `max` are kept.
export function seenSources(blocks, list, max = 12) {
  const norm = (u) => {
    try {
      const x = new URL(u);
      return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + x.search).toLowerCase();
    } catch {
      return "";
    }
  };
  const seen = new Set();
  for (const block of blocks) {
    if (block.type === "text") {
      for (const c of block.citations ?? []) if (c.url) seen.add(norm(c.url));
      continue;
    }
    for (const m of JSON.stringify(block).matchAll(/https?:\/\/[^\s"'<>\\)\]]+/g)) seen.add(norm(m[0]));
  }
  seen.delete("");
  const kept = [];
  for (const s of Array.isArray(list) ? list : []) {
    const url = typeof s?.url === "string" ? s.url.trim() : "";
    if (!/^https:\/\//.test(url) || url.length > 500) continue;
    if (!seen.has(norm(url))) {
      console.warn(`Dropped a source this run never saw: ${url}`);
      continue;
    }
    if (kept.some((k) => k.url === url)) continue;
    const title = typeof s.title === "string" && s.title.trim() ? s.title.replace(/\s+/g, " ").trim().slice(0, 140) : url;
    kept.push({ title, url });
    if (kept.length >= max) break;
  }
  return kept;
}

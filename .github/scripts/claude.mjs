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

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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
// With batch: { name, key } it goes through the Batches API at half price
// (see "BATCHES" further down) and the run waits for the answer.
export async function askClaude({ model, system, user, maxTokens = 16000, effort = "high", batch }) {
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
  const answer = (data) => {
    if (data.stop_reason === "max_tokens") console.warn("Hit max_tokens: the answer may be cut short.");
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text, usage: { ...(data.usage || {}), batch: Boolean(batch) }, stop: data.stop_reason };
  };
  if (batch) {
    const state = loadBatchState(batch, { rounds: 0, batchId: null });
    const data = await sendBatch(JSON.parse(body), batch, state);
    clearBatchState(batch);
    return answer(data);
  }

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
    return answer(await res.json());
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
  // A batch pays half for the tokens.
  const cost = ((input * p.input + output * p.output + read * p.cacheRead + write * p.cacheWrite) / 1e6) * (u.batch ? 0.5 : 1);
  console.log(`Estimated cost: US$${cost.toFixed(2)} (${model}${u.batch ? ", batch price" : ""})`);
  costNote(cost, `${model}${u.batch ? ", batch" : ""}${DRY_RUN ? ", dry run" : ""}`);
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
// With batch: { name, key } the requests go through the Batches API at
// half price (see "BATCHES" below) instead of straight to Claude.
export async function askClaudeWeb({ model, system, user, maxTokens = 32000, effort = "high", maxSearches, maxFetches, check, fix, batch }) {
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
  const textOf = (list) => list.filter((b) => b.type === "text").map((b) => b.text).join("");

  // Everything the asking has done so far. With a batch it's saved to a
  // file if the run has to stop waiting, so the next run carries on from it.
  const fresh = {
    step: "search", // "search" rounds, then maybe one "fix" round, then "done"
    rounds: 0,
    messages: [{ role: "user", content: user }],
    blocks: [],
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, fetches: 0, batch: Boolean(batch) },
    batchId: null,
  };
  const state = batch ? loadBatchState(batch, fresh) : fresh;
  const add = (u = {}) => {
    state.usage.input += u.input_tokens ?? 0;
    state.usage.output += u.output_tokens ?? 0;
    state.usage.cacheRead += u.cache_read_input_tokens ?? 0;
    state.usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    state.usage.searches += u.server_tool_use?.web_search_requests ?? 0;
    state.usage.fetches += u.server_tool_use?.web_fetch_requests ?? 0;
  };
  const ask = (body) => (batch ? sendBatch(body, batch, state) : send(body));

  while (state.step === "search") {
    const data = await ask({ ...base, tools, messages: state.messages });
    state.blocks.push(...(data.content || []));
    add(data.usage);
    state.rounds++;
    if (data.stop_reason === "max_tokens") console.warn("Hit max_tokens: the answer may be cut short.");
    if (data.stop_reason === "pause_turn" && state.rounds < 6) {
      // A long search paused partway: send it back to carry on.
      state.messages.push({ role: "assistant", content: data.content });
      continue;
    }
    state.step = check && fix && !check(textOf(state.blocks)) ? "fix" : "done";
    if (state.step === "fix") {
      console.warn("The answer wasn't in the expected format; asking once more with search off.");
      state.messages = [
        state.messages[0],
        { role: "assistant", content: textOf(state.blocks) || "(no answer)" },
        { role: "user", content: fix },
      ];
    }
  }
  let text = textOf(state.blocks);
  if (state.step === "fix") {
    const data = await ask({ ...base, messages: state.messages });
    add(data.usage);
    text = textOf(data.content || []);
  }
  if (batch) clearBatchState(batch);
  return { text, blocks: state.blocks, usage: state.usage };
}

/* =====================================================================
   BATCHES (half price, for robots nobody is waiting on)
   ---------------------------------------------------------------------
   The Coach, the Forecaster and the Scorekeeper send their requests to the Message
   Batches API instead. Anthropic answers when it has room, usually within
   an hour (24 hours at most), and charges half for the tokens. Web search
   and page reads work the same. The run checks back every minute.

   A GitHub run can only last 6 hours, so if the answer still isn't back
   after BATCH_WAIT_MIN minutes, the run saves where it got to in
   .github/batches/<robot>.json (just the batch's id and the rounds so far:
   no key, nothing private), commits that and stops. The robot's next run
   finds the file and picks the same batch up, so nothing is paid twice.
   The file is deleted once the answer is in. .github is never published.
   ===================================================================== */
const BATCH_WAIT_MIN = Number(process.env.BATCH_WAIT_MIN) || 320; // the job's own limit is 350
const BATCH_CHECK_MS = Number(process.env.BATCH_CHECK_MS) || 60_000; // how often to ask "is it done yet?"
const STARTED = Date.now();
const batchFile = (b) => `.github/batches/${b.name}.json`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The saved progress from an earlier run, if it was for this same job
// (the key is the week, so last week's leftovers are thrown away).
function loadBatchState(b, fresh) {
  if (!existsSync(batchFile(b))) return fresh;
  try {
    const saved = JSON.parse(readFileSync(batchFile(b), "utf8"));
    if (saved.key === b.key && saved.state) {
      console.log(`Picking up where an earlier run left off (batch ${saved.state.batchId || "not sent yet"}).`);
      return saved.state;
    }
    console.log(`Throwing away a saved batch for ${saved.key}; this run is for ${b.key}.`);
  } catch {
    console.warn(`${batchFile(b)} wouldn't read; starting fresh.`);
  }
  clearBatchState(b);
  return fresh;
}

function clearBatchState(b) {
  if (!DRY_RUN && existsSync(batchFile(b))) rmSync(batchFile(b));
}

// Saves the progress and ends the run cleanly; the workflow commits the file.
function saveAndStop(b, state) {
  if (DRY_RUN) {
    console.log(`Dry run: the batch (${state.batchId}) still isn't back after ${BATCH_WAIT_MIN} minutes. Nothing saved.`);
    process.exit(0);
  }
  mkdirSync(".github/batches", { recursive: true });
  writeFileSync(batchFile(b), JSON.stringify({ key: b.key, savedAt: new Date().toISOString(), state }) + "\n");
  console.log(`The batch (${state.batchId}) isn't back yet after ${BATCH_WAIT_MIN} minutes. Saved it for the next run.`);
  setOutput("waiting", "true");
  process.exit(0);
}

// One GET or POST to the Batches API, with the same 4 tries as send().
async function batchApi(url, body) {
  for (let attempt = 1; ; attempt++) {
    let res;
    let why;
    try {
      res = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429 || res.status >= 500) why = `Batches API returned ${res.status}`;
    } catch (err) {
      why = `Couldn't reach the Batches API (${err.message})`;
    }
    if (why && attempt < 4) {
      await sleep(15000 * attempt);
      continue;
    }
    if (!res) throw new Error(why);
    if (!res.ok) throw new Error(`Batches API error ${res.status}: ${await res.text()}`);
    return res;
  }
}

// Sends one request as a batch of one (or picks up the saved one), waits
// for it, and returns the reply exactly like send() would.
async function sendBatch(body, b, state) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY. Add it under repo Settings > Secrets and variables > Actions.");
  }
  const API = "https://api.anthropic.com/v1/messages/batches";
  for (;;) {
    if (!state.batchId) {
      const res = await batchApi(API, { requests: [{ custom_id: `${b.name}-${state.rounds + 1}`, params: body }] });
      state.batchId = (await res.json()).id;
      console.log(`Sent batch ${state.batchId}; checking back every minute.`);
    }
    let info;
    for (let n = 0; ; n++) {
      info = await (await batchApi(`${API}/${state.batchId}`)).json();
      if (info.processing_status === "ended") break;
      if (Date.now() - STARTED > BATCH_WAIT_MIN * 60_000) saveAndStop(b, state);
      if (n && n % 10 === 0) console.log(`Still waiting on the batch (${n} minutes).`);
      await sleep(BATCH_CHECK_MS);
    }
    const lines = (await (await batchApi(info.results_url)).text()).split("\n").filter(Boolean);
    const result = lines.map((l) => JSON.parse(l))[0]?.result;
    state.batchId = null; // this one is used up
    if (result?.type === "succeeded") return result.message;
    if (result?.type === "expired" || result?.type === "canceled") {
      // Not billed. Send it again (the next pass of this loop).
      console.warn(`The batch ${result.type} before Claude got to it; sending it again.`);
      continue;
    }
    throw new Error(`The batch request failed: ${JSON.stringify(result?.error ?? result)}`);
  }
}

// Brings the checkout up to date with main (another robot may have saved
// to journal.json while this one was waiting), so the robot writes onto
// the newest copy. Only on GitHub; a local run leaves git alone.
export function pullLatest() {
  if (!process.env.GITHUB_ACTIONS) return;
  try {
    execFileSync("git", ["pull", "--ff-only", "--quiet"], { stdio: "inherit" });
  } catch (err) {
    console.warn(`Couldn't update the checkout (${err.message}); the commit step will try again.`);
  }
}

// Prints the tokens, searches and estimated cost, and pins the cost note.
export function logWebCost(model, u, maxSearches, maxFetches) {
  const p = PRICES[model];
  console.log(`Tokens: ${u.input} in, ${u.cacheRead} cache reads, ${u.cacheWrite} cache writes, ${u.output} out`);
  console.log(`Searches: ${u.searches} of ${maxSearches}; pages read: ${u.fetches} of ${maxFetches}`);
  // A batch pays half for the tokens; searches cost the same either way.
  const tokenShare = u.batch ? 0.5 : 1;
  const cost = ((u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e6) * tokenShare +
    u.searches * SEARCH_PRICE;
  console.log(`Estimated cost: US$${cost.toFixed(2)} (${model}${u.batch ? ", batch price" : ""})`);
  costNote(cost, `${model}${u.batch ? ", batch" : ""}, ${u.searches} searches, ${u.fetches} pages read${DRY_RUN ? ", dry run" : ""}`);
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

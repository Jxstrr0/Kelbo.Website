/* ==========================================================================
   journal.js — the AI Trading Journal page (journal.html).
   --------------------------------------------------------------------------
   Reads journal.json and options.json and shows:
     1. the record: how the calls graded out, and how the trades did
     2. every options trade, newest first (options.json)
     3. every entry, newest first (journal.json)

   To add an entry, edit journal.json (see "The trading journal" in
   README.md). Every part of an entry is optional except the date:
     date       "2026-10-14"
     title      short headline
     bias       "Bullish", "Bearish", or "Neutral"
     gradeBy    "2026-10-16": when the calls get graded
     summary    the TLDR, shown in a box at the top
     view       my take. A blank line (\n\n) starts a new paragraph
     note       small print under the view (where the numbers came from)
     sectors    [{ sector, etf, direction, trend: "up" or "down", why }]
     calls      [{ call, wrongIf, grade: "hit", "partial", "miss" or null }]
     scenarios  [{ odds: 50, name, text }]
     levels     [{ symbol, resistance, support, tell }]
     schedule   [{ when, what }]
     plan       ["one rule per line", ...]
     trades     [{ symbol, side, result, note }]
     recap      what actually happened, written after grading
     ai         the AI coach's notes
     lesson     one thing to keep doing or fix
   A trade's "result" is its gain or loss in percent: 1.2 means +1.2%,
   -0.8 means -0.8%. Leave it out (or use null) while the trade is open.
   A call with no grade yet doesn't count in the record. The newest entry's
   graded calls also show as a one-line "Week of Oct 14" tally at the top.

   options.json holds the options trades (see "Options trades" in
   README.md):
     updated    "2026-10-14": the last time the list was brought up to date
     since      "2026-09-15": the first trade
     systems    { "V2": "what V2 means", ... }: shown as filter buttons
     ai         the AI coach's notes on the options record
     trades     [{ opened, closed, symbol, strike, type: "call" or "put",
                   expiry, paid, sold, system, note }]
   "paid" and "sold" are the option's price per share. The return is
   worked out from them: (sold - paid) / paid. Leave "sold" and "closed"
   out while a trade is still open.

   Uses el() and reveal() from main.js, which loads first.
   ========================================================================== */

// Turn a number into "+1.2%" / "-0.8%".
function signedPercent(n) {
  const fixed = Math.abs(n).toFixed(Math.abs(n) < 10 ? 1 : 0);
  return (n > 0 ? "+" : n < 0 ? "−" : "") + fixed + "%";
}

// "2026-10-14" -> "Oct 14, 2026" (in the visitor's own date style).
function formatDay(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd || "");
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// A trade counts as closed once it has a number in "result".
function isClosed(trade) {
  return typeof trade.result === "number" && Number.isFinite(trade.result);
}

// A list from an entry, or [] if it's missing or not a list.
function listOf(entry, key) {
  return Array.isArray(entry[key]) ? entry[key].filter(Boolean) : [];
}

// Call grades, and what each is worth in the score.
const GRADES = {
  hit: { label: "Hit", points: 1 },
  partial: { label: "Partial", points: 0.5 },
  miss: { label: "Miss", points: 0 },
};

function gradeOf(call) {
  return GRADES[String(call.grade || "").toLowerCase()] ? String(call.grade).toLowerCase() : null;
}

/* ---------- Options trades: the maths ---------- */

// An options trade's return in percent, or null while it's still open.
function optionReturn(trade) {
  const paid = Number(trade.paid);
  const sold = Number(trade.sold);
  if (trade.sold == null || !Number.isFinite(sold) || !(paid > 0)) return null;
  return ((sold - paid) / paid) * 100;
}

// Win, loss, or scratch (sold for what it cost).
function outcomeOf(result) {
  if (Math.abs(result) < 0.01) return "flat";
  return result > 0 ? "win" : "loss";
}

// Wins, losses, scratches and the average return for a list of trades.
function tally(trades) {
  const results = trades.map(optionReturn).filter((r) => r !== null);
  const count = (kind) => results.filter((r) => outcomeOf(r) === kind).length;
  const wins = count("win");
  const losses = count("loss");
  return {
    closed: results.length,
    open: trades.length - results.length,
    wins,
    losses,
    scratches: count("flat"),
    average: results.reduce((sum, r) => sum + r, 0) / (results.length || 1),
    // Win rate counts a scratch as "not a win", the same as the ledger.
    winRate: results.length ? Math.round((wins / results.length) * 100) + "%" : "–",
    winRateNoScratch: wins + losses ? Math.round((wins / (wins + losses)) * 100) + "%" : "–",
  };
}

// A result as "+42%" / "−9.6%" / "0%".
function resultText(result) {
  return outcomeOf(result) === "flat" ? "0%" : signedPercent(result);
}

/* ---------- The record ---------- */

// One group of big numbers, with a heading and small print underneath.
// Each stat is [label, value] or [label, value, smaller line under the value].
function statGroup(parent, title, stats, notes, pair) {
  parent.append(el("h3", "record__label", title));
  const list = el("dl", pair ? "record record--pair" : "record");
  stats.forEach(([label, value, sub]) => {
    const group = el("div");
    group.append(el("dt", null, label), el("dd", null, value));
    if (sub) group.append(el("dd", "record__sub", sub));
    list.append(group);
  });
  parent.append(list);
  if (notes.length) parent.append(el("p", "record__note", notes.join(" ")));
}

// One glance at the newest entry's graded calls: "Week of Oct 14: 3 Hits,
// 1 Partial, 3 Misses". Only graded calls count, so nothing shows until
// Kelbo reports a grade. The entries are newest first.
function renderWeek(box, entries) {
  const entry = entries.find((e) => listOf(e, "calls").some(gradeOf));
  if (!entry) return;
  const calls = listOf(entry, "calls");
  const graded = calls.filter(gradeOf);
  const line = el("p", "week");
  line.append(el("span", "week__when", "Week of " + shortDay(entry.date)));
  Object.keys(GRADES).forEach((key) => {
    const n = graded.filter((c) => gradeOf(c) === key).length;
    if (!n) return;
    // "1 Hit", "3 Hits", "2 Misses": the word is always there, so colour is never the only clue.
    const label = GRADES[key].label + (n === 1 ? "" : key === "miss" ? "es" : "s");
    line.append(el("span", "call__grade call__grade--" + key, n + " " + label));
  });
  if (graded.length < calls.length) {
    line.append(el("span", "week__open", `${graded.length} of ${calls.length} graded`));
  }
  box.append(line);
}

function renderRecord(entries, options) {
  const box = document.querySelector("[data-record]");
  box.replaceChildren();
  renderWeek(box, entries);

  // Calls: hits count 1, partials count half.
  const calls = entries.flatMap((e) => listOf(e, "calls"));
  const graded = calls.filter(gradeOf);
  const points = graded.reduce((sum, c) => sum + GRADES[gradeOf(c)].points, 0);
  if (calls.length) {
    statGroup(
      box,
      "Calls",
      [
        ["Calls graded", `${graded.length} of ${calls.length}`],
        ["Call score", graded.length ? Math.round((points / graded.length) * 100) + "%" : "–"],
      ],
      ["Call score counts a hit as 1 and a partial as half."],
      true
    );
  }

  // Options trades, from options.json
  const optionTrades = options ? listOf(options, "trades") : [];
  if (optionTrades.length) {
    const t = tally(optionTrades);
    const notes = [
      `${t.wins} wins, ${t.losses} losses, ${t.scratches} ${t.scratches === 1 ? "scratch" : "scratches"} (sold for what it cost).`,
      "The big win rate leaves scratches out; the smaller one under it counts them as not a win.",
      "Returns are on the premium paid.",
    ];
    if (t.open) notes.push(`${t.open} open ${t.open === 1 ? "trade" : "trades"} not counted yet.`);
    statGroup(
      box,
      "Options trades",
      [
        ["Closed trades", String(t.closed)],
        ["Win rate", t.winRateNoScratch, `${t.winRate} with scratches`],
        ["Avg return", t.closed ? signedPercent(t.average) : "–"],
        ["W–L–S", `${t.wins}–${t.losses}–${t.scratches}`],
      ],
      notes
    );
  }

  // Trades logged inside entries (results already in percent)
  const trades = entries.flatMap((e) => listOf(e, "trades"));
  if (trades.length) {
    const closed = trades.filter(isClosed);
    const wins = closed.filter((t) => t.result > 0).length;
    const losses = closed.filter((t) => t.result < 0).length;
    const average = closed.reduce((sum, t) => sum + t.result, 0) / (closed.length || 1);
    const notes = [];
    if (closed.length) notes.push(`${wins}–${losses} on closed trades, ${signedPercent(average)} on average.`);
    const open = trades.length - closed.length;
    if (open) notes.push(`${open} open ${open === 1 ? "trade" : "trades"} not counted yet.`);
    statGroup(
      box,
      "Trades in entries",
      [
        ["Closed trades", String(closed.length)],
        ["Win rate", closed.length ? Math.round((wins / closed.length) * 100) + "%" : "–"],
      ],
      notes,
      true
    );
  }

  if (!box.children.length) box.append(el("p", "record__note", "Nothing to count yet."));
}

/* ---------- Options trades: the list ---------- */

// "2026-10-14" -> "Oct 14" (no year, for the trade list).
function shortDay(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd || "");
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// An option price: 0.8 -> "0.80", 0.425 -> "0.425".
function premium(n) {
  const value = Number(n);
  return value.toFixed(Math.round(value * 1000) % 10 ? 3 : 2);
}

// One trade in the list.
function renderOptionTrade(trade) {
  const result = optionReturn(trade);
  const item = el("li", "trade");

  const head = el("p", "trade__head");
  const type = String(trade.type || "").toLowerCase();
  head.append(el("span", "trade__symbol", `${trade.symbol} ${trade.strike} ${type}`.trim()));
  if (trade.system) head.append(el("span", "trade__tag", trade.system));
  head.append(
    result === null
      ? el("span", "trade__result trade__result--open", "Open")
      : el("span", `trade__result trade__result--${outcomeOf(result)}`, resultText(result))
  );
  item.append(head);

  // When, and the prices
  let when;
  if (result === null) when = `Opened ${shortDay(trade.opened)}`;
  else if (trade.opened === trade.closed) when = `${shortDay(trade.closed)}, same day`;
  else when = `${shortDay(trade.opened)} to ${shortDay(trade.closed)}`;
  const prices = [`paid ${premium(trade.paid)}`];
  if (result !== null) prices.push(`sold ${premium(trade.sold)}`);
  const expiry = trade.expiry ? `${shortDay(trade.expiry)} expiry · ` : "";
  item.append(el("p", "trade__meta", `${expiry}${when} · ${prices.join(", ")}`));

  if (trade.note) item.append(el("p", "trade__note", trade.note));
  return item;
}

// A bar for each trade's return, oldest on the left.
function renderBars(trades) {
  const closed = trades.filter((t) => optionReturn(t) !== null);
  const box = document.querySelector("[data-options-chart]");
  box.replaceChildren();
  if (closed.length < 2) return;

  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };

  const results = closed.map(optionReturn);
  const biggest = Math.max(...results.map(Math.abs), 1);
  const t = tally(closed);
  const svg = svgEl("svg", {
    class: "bars__svg",
    viewBox: `0 0 ${closed.length * 10} 100`,
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": `Return on each trade, oldest to newest: ${t.wins} gains, ${t.losses} losses, ${t.scratches} scratches.`,
  });
  results.forEach((r, i) => {
    // Gains go up from the middle line, losses go down. Scratches get a sliver.
    const height = Math.max((Math.abs(r) / biggest) * 48, 1.5);
    const bar = svgEl("rect", {
      class: `bars__bar bars__bar--${outcomeOf(r)}`,
      x: i * 10 + 1.5,
      y: r > 0 ? 50 - height : outcomeOf(r) === "flat" ? 50 - height / 2 : 50,
      width: 7,
      height,
    });
    const tip = svgEl("title", {});
    const c = closed[i];
    tip.textContent = `${c.symbol} ${c.strike} ${c.type}: ${resultText(r)}`;
    bar.append(tip);
    svg.append(bar);
  });
  svg.append(svgEl("line", { class: "bars__zero", x1: 0, x2: closed.length * 10, y1: 50, y2: 50, "vector-effect": "non-scaling-stroke" }));

  const figure = el("figure", "bars");
  figure.append(svg, el("figcaption", "bars__caption", "Return on each trade, oldest on the left"));
  box.append(figure);
}

// A line that adds up each closed trade's return in order, so the slope
// shows the trend. It adds percentages, so it's a shape to read and not an
// account balance. Built only from the trades in options.json.
function renderTrend(trades) {
  const closed = trades.filter((t) => optionReturn(t) !== null);
  const box = document.querySelector("[data-options-chart]");
  if (closed.length < 3) return;

  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };

  // Running total after each trade, starting from zero.
  let total = 0;
  const totals = [0, ...closed.map((t) => (total += optionReturn(t)))];
  const low = Math.min(...totals, 0);
  const high = Math.max(...totals, 0);
  const span = high - low || 1;
  const x = (i) => (i / (totals.length - 1)) * 100;
  const y = (v) => 6 + (1 - (v - low) / span) * 88;

  const svg = svgEl("svg", {
    class: "trend__svg",
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": `Running total of trade returns, oldest to newest. It ends at ${signedPercent(total)} after ${closed.length} trades.`,
  });
  svg.append(
    svgEl("line", { class: "trend__zero", x1: 0, x2: 100, y1: y(0), y2: y(0), "vector-effect": "non-scaling-stroke" }),
    svgEl("polyline", {
      class: "trend__line",
      points: totals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" "),
      "vector-effect": "non-scaling-stroke",
    })
  );

  const figure = el("figure", "bars trend");
  figure.append(
    svg,
    el(
      "figcaption",
      "bars__caption",
      `Running total of every trade's return, oldest on the left. It ends at ${signedPercent(total)} after ${closed.length} trades. Percentages add up here, so read the slope and not the number.`
    )
  );
  box.append(figure);
}

// How many trades show before the rest fold away.
const RECENT_TRADES = 6;

function renderOptionList(trades, systemLabel) {
  // Newest first: open trades on top, then by the day they closed.
  const sorted = trades
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const dayA = a.t.closed || "9999";
      const dayB = b.t.closed || "9999";
      return dayB.localeCompare(dayA) || b.i - a.i;
    })
    .map((x) => x.t);

  const box = document.querySelector("[data-options-list]");
  box.replaceChildren();
  if (!sorted.length) {
    box.append(el("p", "project-list__note", "No trades here yet."));
    return;
  }
  const recent = el("ul", "trades");
  sorted.slice(0, RECENT_TRADES).forEach((t) => recent.append(renderOptionTrade(t)));
  box.append(recent);

  const older = sorted.slice(RECENT_TRADES);
  if (older.length) {
    const fold = el("details", "fold options__older");
    fold.append(el("summary", "fold__title", `Show ${older.length} older ${systemLabel}trades`));
    const list = el("ul", "trades");
    older.forEach((t) => list.append(renderOptionTrade(t)));
    fold.append(list);
    box.append(fold);
  }
}

function renderOptions(options) {
  const trades = listOf(options, "trades");
  const systems = options.systems && typeof options.systems === "object" ? options.systems : {};

  // The line under the heading
  const intro = [];
  intro.push("Real-money calls and puts I bought" + (options.since ? `, since ${formatDay(options.since)}.` : "."));
  intro.push("Returns are on the premium I paid, from fill to fill.");
  if (options.updated) intro.push(`Updated ${formatDay(options.updated)}.`);
  const systemNames = Object.keys(systems);
  if (systemNames.length) {
    intro.push(systemNames.map((name) => `${name} is ${systems[name]}.`).join(" "));
  }
  document.querySelector("[data-options-intro]").textContent = intro.join(" ");

  function show(choice) {
    const shown = choice === "all" ? trades : trades.filter((t) => t.system === choice);
    const t = tally(shown);
    const count = [`${shown.length} ${shown.length === 1 ? "trade" : "trades"}`];
    if (t.closed) count.push(`${t.wins}–${t.losses}–${t.scratches}`, `${signedPercent(t.average)} on average`);
    document.querySelector("[data-options-count]").textContent = count.join(" · ");
    renderBars(shown);
    renderTrend(shown);
    renderOptionList(shown, choice === "all" ? "" : choice + " ");
  }

  // Filter buttons, only if there's more than one system to pick from
  const filtersEl = document.querySelector("[data-options-filters]");
  filtersEl.replaceChildren();
  const used = systemNames.filter((name) => trades.some((t) => t.system === name));
  if (used.length > 1) {
    ["all", ...used].forEach((choice) => {
      const button = el("button", null, choice === "all" ? "All" : choice);
      button.type = "button";
      button.setAttribute("aria-pressed", String(choice === "all"));
      button.addEventListener("click", () => {
        filtersEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        show(choice);
      });
      filtersEl.append(button);
    });
  }
  show("all");

  // What the AI coach said about the options record
  const coachBox = document.querySelector("[data-options-coach]");
  coachBox.replaceChildren();
  if (options.ai) {
    const coach = el("div", "coach options__coach");
    coach.append(el("p", "coach__label", "AI coach"));
    addParagraphs(coach, options.ai, "coach__text");
    coachBox.append(coach);
  }
}

// Split text on blank lines and add each part as a paragraph.
function addParagraphs(parent, text, className) {
  String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((p) => parent.append(el("p", className, p)));
}

// A small heading inside an entry.
function subhead(parent, text) {
  parent.append(el("h4", "entry__sub", text));
}

// A tap-to-open section, for the longer reference parts.
function foldout(parent, text) {
  const box = el("details", "fold");
  box.append(el("summary", "fold__title", text));
  parent.append(box);
  return box;
}

/* ---------- One entry ---------- */
function renderEntry(entry) {
  const item = el("li", "entry");

  // Date and market lean
  const top = el("p", "entry__top");
  if (entry.date) {
    const time = el("time", "entry__date", formatDay(entry.date));
    time.dateTime = entry.date;
    top.append(time);
  }
  const bias = String(entry.bias || "").trim();
  if (bias) top.append(el("span", "entry__bias entry__bias--" + bias.toLowerCase(), bias));
  item.append(top);

  if (entry.title) item.append(el("h3", "entry__title", entry.title));

  // TLDR box
  if (entry.summary) {
    const box = el("div", "tldr");
    box.append(el("p", "tldr__label", "TLDR"));
    addParagraphs(box, entry.summary, "tldr__text");
    item.append(box);
  }

  if (entry.view) {
    subhead(item, "Where things stand");
    addParagraphs(item, entry.view, "entry__view");
  }
  if (entry.note) item.append(el("p", "entry__note", entry.note));

  // Calls, each with what would prove it wrong and its grade
  const calls = listOf(entry, "calls");
  if (calls.length) {
    subhead(item, "My calls");
    if (entry.gradeBy && calls.some((c) => !gradeOf(c))) {
      item.append(el("p", "entry__note", "Graded after the close on " + formatDay(entry.gradeBy) + "."));
    }
    const list = el("ol", "calls");
    calls.forEach((c) => {
      const row = el("li", "call");
      const grade = gradeOf(c);
      const head = el("p", "call__head");
      head.append(el("span", "call__text", c.call || ""));
      head.append(
        el("span", "call__grade call__grade--" + (grade || "open"), grade ? GRADES[grade].label : "Not graded")
      );
      row.append(head);
      if (c.wrongIf) row.append(el("p", "call__wrong", "Wrong if: " + c.wrongIf));
      list.append(row);
    });
    item.append(list);
  }

  // Scenarios with their odds
  const scenarios = listOf(entry, "scenarios");
  if (scenarios.length) {
    subhead(item, "Scenarios");
    const list = el("ul", "scenarios");
    scenarios.forEach((sc) => {
      const row = el("li", "scenario");
      row.append(el("span", "scenario__odds", Number.isFinite(sc.odds) ? sc.odds + "%" : ""));
      const body = el("div");
      body.append(el("p", "scenario__name", sc.name || ""));
      if (sc.text) body.append(el("p", "scenario__text", sc.text));
      row.append(body);
      list.append(row);
    });
    item.append(list);
  }

  // How I'm trading it
  const plan = listOf(entry, "plan");
  if (plan.length) {
    subhead(item, "How I'm trading it");
    const list = el("ul", "plan");
    plan.forEach((rule) => list.append(el("li", null, rule)));
    item.append(list);
  }

  // Reference parts fold away so the entry stays short on a phone
  const levels = listOf(entry, "levels");
  if (levels.length) {
    const box = foldout(item, "Levels I'm watching");
    levels.forEach((lv) => {
      const card = el("div", "level");
      card.append(el("p", "level__symbol", lv.symbol || ""));
      const dl = el("dl", "level__rows");
      [
        ["Resistance", lv.resistance],
        ["Support", lv.support],
        ["Tell", lv.tell],
      ].forEach(([label, value]) => {
        if (value) dl.append(el("dt", null, label), el("dd", null, value));
      });
      card.append(dl);
      box.append(card);
    });
  }

  const sectors = listOf(entry, "sectors");
  if (sectors.length) {
    const box = foldout(item, "Sector board");
    const list = el("ul", "sectors");
    sectors.forEach((sc) => {
      const row = el("li", "sector");
      const head = el("p", "sector__head");
      head.append(el("span", "sector__name", sc.sector || ""));
      if (sc.etf) head.append(el("span", "sector__etf", sc.etf));
      const trend = sc.trend === "up" ? "up" : sc.trend === "down" ? "down" : "";
      head.append(el("span", "sector__dir" + (trend ? " sector__dir--" + trend : ""), sc.direction || ""));
      row.append(head);
      if (sc.why) row.append(el("p", "sector__why", sc.why));
      list.append(row);
    });
    box.append(list);
  }

  const schedule = listOf(entry, "schedule");
  if (schedule.length) {
    const box = foldout(item, "Schedule (Saskatchewan time)");
    const dl = el("dl", "schedule");
    schedule.forEach((ev) => dl.append(el("dt", null, ev.when || ""), el("dd", null, ev.what || "")));
    box.append(dl);
  }

  // Trades
  const trades = listOf(entry, "trades");
  if (trades.length) {
    subhead(item, "Trades");
    const list = el("ul", "trades");
    trades.forEach((t) => {
      const row = el("li", "trade");
      const head = el("p", "trade__head");
      head.append(el("span", "trade__symbol", t.symbol || "?"));
      if (t.side) head.append(el("span", "trade__side", t.side));

      let resultText = "Open";
      let resultClass = "trade__result--open";
      if (isClosed(t)) {
        resultText = signedPercent(t.result);
        resultClass = t.result > 0 ? "trade__result--win" : t.result < 0 ? "trade__result--loss" : "";
      }
      head.append(el("span", "trade__result " + resultClass, resultText));
      row.append(head);
      if (t.note) row.append(el("p", "trade__note", t.note));
      list.append(row);
    });
    item.append(list);
  }

  if (entry.recap) {
    subhead(item, "What happened");
    addParagraphs(item, entry.recap, "entry__view");
  }

  // What the AI coach said
  if (entry.ai) {
    const coach = el("div", "coach");
    coach.append(el("p", "coach__label", "AI coach"));
    addParagraphs(coach, entry.ai, "coach__text");
    item.append(coach);
  }

  if (entry.lesson) {
    const lesson = el("p", "entry__lesson");
    lesson.append(el("strong", null, "Lesson: "), document.createTextNode(entry.lesson));
    item.append(lesson);
  }

  return item;
}

/* ---------- Start here ---------- */
// Fetch a JSON file. Returns null (and logs why) if it can't be read,
// which is most likely a typo in the file (a missing comma or quote).
async function loadJSON(file) {
  try {
    const response = await fetch(file, { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  } catch (err) {
    console.error(`Couldn't load ${file}:`, err);
    return null;
  }
}

async function initJournal() {
  const listEl = document.querySelector("[data-entries]");
  const [journal, options] = await Promise.all([loadJSON("journal.json"), loadJSON("options.json")]);

  // Options trades
  const optionsOK = options && typeof options === "object" && !Array.isArray(options);
  if (optionsOK) {
    renderOptions(options);
  } else {
    document.querySelector("[data-options-list]").replaceChildren(
      el("p", "project-list__note", "The trades couldn't load right now. Please try again later.")
    );
  }

  if (!Array.isArray(journal)) {
    if (journal) console.error("journal.json should be a list [ ... ]");
    listEl.replaceChildren(
      el("li", "project-list__note", "The journal couldn't load right now. Please try again later.")
    );
    renderRecord([], optionsOK ? options : null);
    return;
  }

  const entries = journal.filter((e) => e && typeof e === "object");
  renderRecord(entries, optionsOK ? options : null);

  // Newest first. Entries with the same date keep their file order.
  const sorted = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => String(b.e.date || "").localeCompare(String(a.e.date || "")) || a.i - b.i)
    .map((x) => x.e);

  listEl.replaceChildren();
  if (sorted.length === 0) {
    listEl.append(el("li", "project-list__note", "First entry coming soon."));
    return;
  }
  sorted.forEach((entry) => {
    const item = renderEntry(entry);
    listEl.append(item);
    reveal(item);
  });
}

initJournal();

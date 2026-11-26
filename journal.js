/* ==========================================================================
   journal.js — the AI Trading Journal page (journal.html).
   --------------------------------------------------------------------------
   Reads journal.json and options.json and shows:
     1. the record: how the calls graded out, and how the trades did
     2. every MU ticket, newest first (options.json)
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
     sources    [{ title, url }]: where a robot forecast's numbers came from
     by         "forecaster" on entries the Forecaster robot wrote
   The Scorekeeper robot also adds a "result" line to each call it grades,
   plus gradeSources and graded { by, at }.
   A trade's "result" is its gain or loss in percent: 1.2 means +1.2%,
   -0.8 means -0.8%. Leave it out (or use null) while the trade is open.
   A call with no grade yet doesn't count in the record. The newest entry's
   graded calls also show as a one-line "Week of Oct 14" tally at the top.

   options.json holds the MU tickets (see "MU tickets" in README.md).
   The file kept its old name so links and the offline copy still work:
     updated    "2026-11-25": the last time the list was brought up to date
     since      "2026-11-09": when the rules were adopted
     symbol     "MU"
     system     "V2.9": the rules' version, shown as a tag on each ticket
     about      one line on how the rules work (follows "How V2.9 works: ")
     skipped    small print: days the rules skipped, and why
     earlier    small print: anything from before the rules were adopted
     ai         the AI coach's notes on the tickets ("" for none)
     tickets    [{ date, side: "long" or "short", boxLow, boxHigh,
                   trigger: "9:50", triggerClose, entry, stop, risk,
                   exit, exitHow: "at the 3:30 PM time stop", r,
                   vix, smh: true or false }]
   Prices are MU's share price (New York time for the clock times).
   "r" is the result in R: the move from entry to exit divided by the
   risk (entry to stop), so 2.1 means +2.10R and -1 means a full stop-out.
   Leave "exit" and "r" out while a ticket is still open.

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

/* ---------- MU tickets: the maths ---------- */

// A ticket's result in R, or null while it's still open.
function ticketR(ticket) {
  const r = Number(ticket.r);
  return ticket.r == null || !Number.isFinite(r) ? null : r;
}

// Win, loss, or scratch (closed right where it started).
function outcomeOf(result) {
  if (Math.abs(result) < 0.005) return "flat";
  return result > 0 ? "win" : "loss";
}

// Turn a number of R into "+2.10R" / "−1.00R".
function signedR(n) {
  return (n > 0.004 ? "+" : n < -0.004 ? "−" : "") + Math.abs(n).toFixed(2) + "R";
}

// Wins, losses and R for a list of tickets.
function tally(tickets) {
  const results = tickets.map(ticketR).filter((r) => r !== null);
  const count = (kind) => results.filter((r) => outcomeOf(r) === kind).length;
  const wins = count("win");
  const total = results.reduce((sum, r) => sum + r, 0);
  return {
    closed: results.length,
    open: tickets.length - results.length,
    wins,
    losses: count("loss"),
    scratches: count("flat"),
    total,
    average: total / (results.length || 1),
    winRate: results.length ? Math.round((wins / results.length) * 100) + "%" : "–",
  };
}

// "W–L", with scratches only when there are some.
function recordText(t) {
  return t.scratches ? `${t.wins}–${t.losses}–${t.scratches}` : `${t.wins}–${t.losses}`;
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

  // MU tickets, from options.json
  const tickets = options ? listOf(options, "tickets") : [];
  if (tickets.length) {
    const t = tally(tickets);
    const notes = [
      `${t.wins} ${t.wins === 1 ? "win" : "wins"}, ${t.losses} ${t.losses === 1 ? "loss" : "losses"}.`,
      "R is each ticket's move divided by its risk (entry to stop), so −1R is a full stop-out.",
    ];
    if (t.open) notes.push(`${t.open} open ${t.open === 1 ? "ticket" : "tickets"} not counted yet.`);
    statGroup(
      box,
      `${options.symbol || "MU"} tickets` + (options.system ? ` (${options.system})` : ""),
      [
        ["Closed tickets", String(t.closed)],
        ["Win rate", t.winRate],
        ["Total", t.closed ? signedR(t.total) : "–", t.closed ? `${signedR(t.average)} per ticket` : ""],
        ["W–L", recordText(t)],
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

/* ---------- MU tickets: the list ---------- */

// "2026-10-14" -> "Oct 14" (no year, for the ticket list).
function shortDay(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd || "");
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// A share price with two decimals: 731.2 -> "731.20".
function price(n) {
  const value = Number(n);
  return Number.isFinite(value) ? value.toFixed(2) : "–";
}

// One ticket in the list:
//   MU long  [V2.9]                      +2.10R
//   Nov 11 · box 763.05–779.49 · trigger 9:50 (close 779.99)
//   entry 779.99, stop 763.05 (risk 16.94) · exit 815.53 at the 3:30 PM time stop
//   VIX 19.46 · SMH agrees: no
function renderTicket(ticket, symbol, system) {
  const result = ticketR(ticket);
  const item = el("li", "trade");

  const head = el("p", "trade__head");
  head.append(el("span", "trade__symbol", `${symbol} ${String(ticket.side || "").toLowerCase()}`.trim()));
  if (system) head.append(el("span", "trade__tag", system));
  head.append(
    result === null
      ? el("span", "trade__result trade__result--open", "Open")
      : el("span", `trade__result trade__result--${outcomeOf(result)}`, signedR(result))
  );
  item.append(head);

  const setup = [shortDay(ticket.date)];
  if (ticket.boxLow != null) setup.push(`box ${price(ticket.boxLow)}–${price(ticket.boxHigh)}`);
  if (ticket.trigger) setup.push(`trigger ${ticket.trigger}` + (ticket.triggerClose != null ? ` (close ${price(ticket.triggerClose)})` : ""));
  item.append(el("p", "trade__meta", setup.join(" · ")));

  const fills = [`entry ${price(ticket.entry)}, stop ${price(ticket.stop)}` + (ticket.risk != null ? ` (risk ${price(ticket.risk)})` : "")];
  if (result !== null && ticket.exit != null) fills.push(`exit ${price(ticket.exit)}` + (ticket.exitHow ? ` ${ticket.exitHow}` : ""));
  item.append(el("p", "trade__meta", fills.join(" · ")));

  const context = [];
  if (ticket.vix != null) context.push(`VIX ${price(ticket.vix)}`);
  if (typeof ticket.smh === "boolean") context.push(`SMH agrees: ${ticket.smh ? "yes" : "no"}`);
  if (context.length) item.append(el("p", "trade__meta", context.join(" · ")));

  if (ticket.note) item.append(el("p", "trade__note", ticket.note));
  return item;
}

// A bar for each ticket's R, oldest on the left.
function renderBars(tickets, symbol) {
  const closed = tickets.filter((t) => ticketR(t) !== null);
  const box = document.querySelector("[data-options-chart]");
  box.replaceChildren();
  if (closed.length < 2) return;

  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };

  const results = closed.map(ticketR);
  const biggest = Math.max(...results.map(Math.abs), 1);
  const t = tally(closed);
  const svg = svgEl("svg", {
    class: "bars__svg",
    viewBox: `0 0 ${closed.length * 10} 100`,
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": `Result of each ticket in R, oldest to newest: ${t.wins} wins, ${t.losses} losses.`,
  });
  results.forEach((r, i) => {
    // Wins go up from the middle line, losses go down. A scratch gets a sliver.
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
    tip.textContent = `${shortDay(c.date)} ${symbol} ${c.side}: ${signedR(r)}`;
    bar.append(tip);
    svg.append(bar);
  });
  svg.append(svgEl("line", { class: "bars__zero", x1: 0, x2: closed.length * 10, y1: 50, y2: 50, "vector-effect": "non-scaling-stroke" }));

  const figure = el("figure", "bars");
  figure.append(svg, el("figcaption", "bars__caption", "Each ticket in R, oldest on the left"));
  box.append(figure);
}

// A line that adds up each closed ticket's R in order, so the slope shows
// the trend. R does add up, so the last point is the running total.
function renderTrend(tickets) {
  const closed = tickets.filter((t) => ticketR(t) !== null);
  const box = document.querySelector("[data-options-chart]");
  if (closed.length < 3) return;

  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };

  // Running total after each ticket, starting from zero.
  let total = 0;
  const totals = [0, ...closed.map((t) => (total += ticketR(t)))];
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
    "aria-label": `Running total in R, oldest to newest. It ends at ${signedR(total)} after ${closed.length} tickets.`,
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
    el("figcaption", "bars__caption", `Running total in R, oldest on the left. It ends at ${signedR(total)} after ${closed.length} tickets.`)
  );
  box.append(figure);
}

// How many tickets show before the rest fold away.
const RECENT_TRADES = 6;

function renderTicketList(tickets, symbol, system) {
  // Newest first: open tickets on top, then by date.
  const sorted = tickets
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const openA = ticketR(a.t) === null ? 1 : 0;
      const openB = ticketR(b.t) === null ? 1 : 0;
      return openB - openA || String(b.t.date || "").localeCompare(String(a.t.date || "")) || b.i - a.i;
    })
    .map((x) => x.t);

  const box = document.querySelector("[data-options-list]");
  box.replaceChildren();
  if (!sorted.length) {
    box.append(el("p", "project-list__note", "No tickets here yet."));
    return;
  }
  const recent = el("ul", "trades");
  sorted.slice(0, RECENT_TRADES).forEach((t) => recent.append(renderTicket(t, symbol, system)));
  box.append(recent);

  const older = sorted.slice(RECENT_TRADES);
  if (older.length) {
    const fold = el("details", "fold options__older");
    fold.append(el("summary", "fold__title", `Show ${older.length} older tickets`));
    const list = el("ul", "trades");
    older.forEach((t) => list.append(renderTicket(t, symbol, system)));
    fold.append(list);
    box.append(fold);
  }
}

function renderOptions(options) {
  const tickets = listOf(options, "tickets");
  const symbol = String(options.symbol || "MU");
  const system = String(options.system || "");

  // The heading and the line under it
  const heading = document.getElementById("options-heading");
  if (heading) heading.textContent = `${symbol} tickets`;
  const intro = [];
  intro.push(`Every ticket my ${symbol} rules${system ? " (" + system + ")" : ""} placed` + (options.since ? ` since I adopted them on ${formatDay(options.since)}.` : "."));
  if (options.about) intro.push(`How ${system || "they"} ${system ? "works" : "work"}: ${options.about}.`);
  intro.push("Results are in R: the move from entry to exit divided by the risk from entry to stop, scored on 5-minute bars. Prices are the share price, times are New York time.");
  if (options.updated) intro.push(`Updated ${formatDay(options.updated)}.`);
  document.querySelector("[data-options-intro]").textContent = intro.join(" ");

  const t = tally(tickets);
  const count = [`${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"}`];
  if (t.closed) count.push(recordText(t), `${signedR(t.total)} in all`, `${signedR(t.average)} per ticket`);
  document.querySelector("[data-options-count]").textContent = count.join(" · ");
  document.querySelector("[data-options-filters]").replaceChildren();

  renderBars(tickets, symbol);
  renderTrend(tickets);
  renderTicketList(tickets, symbol, system);

  // Small print, then what the AI coach said (if anything)
  const coachBox = document.querySelector("[data-options-coach]");
  coachBox.replaceChildren();
  if (options.skipped) coachBox.append(el("p", "record__note", String(options.skipped)));
  if (options.earlier) coachBox.append(el("p", "record__note", String(options.earlier)));
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
      // What really happened, filled in by the Scorekeeper robot with the grade.
      if (grade && c.result) row.append(el("p", "call__wrong", "What happened: " + c.result));
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

  // Where the robots' numbers came from (the forecast's sources, then the
  // grading's). Only https links, shown as plain text links.
  const links = [...listOf(entry, "sources"), ...listOf(entry, "gradeSources")].filter(
    (s, i, all) => /^https:\/\//.test(String(s.url || "")) && all.findIndex((x) => x.url === s.url) === i
  );
  if (links.length) {
    const box = foldout(item, `Sources (${links.length})`);
    const list = el("ul", "entry__sources");
    links.forEach((s) => {
      const link = el("a", null, s.title || s.url);
      link.href = s.url;
      link.rel = "noopener";
      const row = el("li");
      row.append(link);
      const site = siteLabel(s.url); // the site it goes to (main.js)
      if (site) row.append(" ", site);
      list.append(row);
    });
    box.append(list);
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

  // MU tickets (options.json)
  const optionsOK = options && typeof options === "object" && !Array.isArray(options);
  if (optionsOK) {
    renderOptions(options);
  } else {
    document.querySelector("[data-options-list]").replaceChildren(
      el("p", "project-list__note", "The tickets couldn't load right now. Please try again later.")
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

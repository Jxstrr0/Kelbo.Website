/* ==========================================================================
   journal.js — the AI Trading Journal page (journal.html).
   --------------------------------------------------------------------------
   Reads journal.json and shows:
     1. the record: how the calls graded out, and how the trades did
     2. every entry, newest first

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
   A call with no grade yet doesn't count in the record.

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

/* ---------- The record ---------- */
function renderRecord(entries) {
  // Calls: hits count 1, partials count half.
  const calls = entries.flatMap((e) => listOf(e, "calls"));
  const graded = calls.filter(gradeOf);
  const points = graded.reduce((sum, c) => sum + GRADES[gradeOf(c)].points, 0);

  // Trades
  const trades = entries.flatMap((e) => listOf(e, "trades"));
  const closed = trades.filter(isClosed);
  const wins = closed.filter((t) => t.result > 0).length;
  const losses = closed.filter((t) => t.result < 0).length;
  const average = closed.reduce((sum, t) => sum + t.result, 0) / (closed.length || 1);

  const stats = [
    ["Calls graded", `${graded.length} of ${calls.length}`],
    ["Call score", graded.length ? Math.round((points / graded.length) * 100) + "%" : "–"],
    ["Closed trades", String(closed.length)],
    ["Win rate", closed.length ? Math.round((wins / closed.length) * 100) + "%" : "–"],
  ];

  const statsEl = document.querySelector("[data-record]");
  statsEl.replaceChildren();
  stats.forEach(([label, value]) => {
    const group = el("div");
    group.append(el("dt", null, label), el("dd", null, value));
    statsEl.append(group);
  });

  // The small print under the numbers
  const notes = [];
  if (closed.length) {
    notes.push(`${wins}–${losses} on closed trades, ${signedPercent(average)} on average.`);
  }
  const open = trades.length - closed.length;
  if (open) notes.push(`${open} open ${open === 1 ? "trade" : "trades"} not counted yet.`);
  if (calls.length) notes.push("Call score counts a hit as 1 and a partial as half.");
  document.querySelector("[data-open-trades]").textContent = notes.join(" ");
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
async function initJournal() {
  const listEl = document.querySelector("[data-entries]");
  let entries;
  try {
    const response = await fetch("journal.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    entries = await response.json();
    if (!Array.isArray(entries)) throw new Error("journal.json should be a list [ ... ]");
  } catch (err) {
    // Most likely a typo in journal.json (a missing comma or quote).
    console.error("Couldn't load journal.json:", err);
    listEl.replaceChildren(
      el("li", "project-list__note", "The journal couldn't load right now. Please try again later.")
    );
    return;
  }

  entries = entries.filter((e) => e && typeof e === "object");
  renderRecord(entries);

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

/* ==========================================================================
   journal.js — the AI Trading Journal page (journal.html).
   --------------------------------------------------------------------------
   Reads journal.json and shows:
     1. the record: closed trades, win rate, average result, open trades
     2. every entry, newest first

   To add an entry, edit journal.json (see "The trading journal" in
   README.md for a copy-paste block). Each entry looks like this:
     {
       "date":   "2026-10-14",
       "title":  "Short headline for the entry",
       "bias":   "Bullish", "Bearish", or "Neutral" (or "" for none)
       "view":   "My take on the market. A blank line (\n\n) starts a new paragraph.",
       "trades": [
         { "symbol": "SPY", "side": "Long", "result": 1.2, "note": "Why I took it" }
       ],
       "ai":     "What the AI coach said about this entry (or "")",
       "lesson": "One thing to keep doing or fix (or "")"
     }
   "result" is the trade's gain or loss in percent: 1.2 means +1.2%,
   -0.8 means -0.8%. Leave it out (or use null) while the trade is open.

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

/* ---------- The record ---------- */
function renderRecord(entries) {
  const trades = entries.flatMap((e) => (Array.isArray(e.trades) ? e.trades : []));
  const closed = trades.filter(isClosed);
  const wins = closed.filter((t) => t.result > 0).length;
  const losses = closed.filter((t) => t.result < 0).length;
  const average = closed.reduce((sum, t) => sum + t.result, 0) / (closed.length || 1);

  const stats = [
    ["Closed trades", String(closed.length)],
    ["Win rate", closed.length ? Math.round((wins / closed.length) * 100) + "%" : "–"],
    ["Avg per trade", closed.length ? signedPercent(average) : "–"],
    ["Wins – losses", closed.length ? `${wins}–${losses}` : "–"],
  ];

  const statsEl = document.querySelector("[data-record]");
  statsEl.replaceChildren();
  stats.forEach(([label, value]) => {
    const group = el("div");
    group.append(el("dt", null, label), el("dd", null, value));
    statsEl.append(group);
  });

  const open = trades.length - closed.length;
  document.querySelector("[data-open-trades]").textContent =
    open === 0 ? "" : `Plus ${open} open ${open === 1 ? "trade" : "trades"} not counted yet.`;
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

  // The view: a blank line in the text starts a new paragraph.
  String(entry.view || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((p) => item.append(el("p", "entry__view", p)));

  // Trades
  const trades = Array.isArray(entry.trades) ? entry.trades : [];
  if (trades.length) {
    const list = el("ul", "trades");
    list.setAttribute("aria-label", "Trades");
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

  // What the AI coach said
  if (entry.ai) {
    const coach = el("div", "coach");
    coach.append(el("p", "coach__label", "AI coach"));
    String(entry.ai)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => coach.append(el("p", "coach__text", p)));
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

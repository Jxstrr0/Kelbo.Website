/* ==========================================================================
   scan.js — the weekly scan on the Agent Fleet page (agent-fleet.html).
   --------------------------------------------------------------------------
   Reads scan.json and shows the latest scan. A Claude routine on Kelbo's
   Claude plan rewrites scan.json every Saturday morning (see "The weekly
   scan" in README.md), so there's no API key anywhere. It can also be
   edited by hand. Every part is optional:
     week       "2026-10-16": the Friday the week ended. Empty = no scan yet
     updated    "2026-10-17": the day the scan was written
     summary    two or three sentences on the week
     indexes    [{ name: "S&P 500", change: 1.2 }]: the week's % move
     up         [{ symbol, name, change: 12.3, why }]: biggest gainers
     down       [{ symbol, name, change: -9.8, why }]: biggest losers
     earnings   [{ when: "Tue Oct 20", what: "Netflix (NFLX), after the close" }]
     economy    [{ when: "Fri Oct 23", what: "Consumer sentiment" }]
     sources    [{ name, url }]: where the numbers came from

   Uses el() and reveal() from main.js, which loads first.
   ========================================================================== */

// "2026-10-16" -> "Oct 16, 2026" (in the visitor's own date style).
function scanDay(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd || "");
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// 12.34 -> "+12.3%", -0.8 -> "−0.8%".
function scanPercent(n) {
  const fixed = Math.abs(n).toFixed(1);
  return (n > 0 ? "+" : n < 0 ? "−" : "") + fixed + "%";
}

// A list from the scan, or [] if it's missing or not a list.
function scanList(scan, key) {
  return Array.isArray(scan[key]) ? scan[key].filter(Boolean) : [];
}

// A small heading inside the scan.
function scanHeading(parent, text) {
  parent.append(el("h3", "entry__sub", text));
}

// Gainers or losers: symbol and name, the % move on the right, then why.
function scanMovers(parent, title, movers) {
  if (!movers.length) return;
  scanHeading(parent, title);
  const list = el("ul", "trades");
  movers.forEach((m) => {
    const item = el("li", "trade");
    const head = el("p", "trade__head");
    head.append(el("span", "trade__symbol", m.symbol || ""));
    if (m.name) head.append(el("span", "trade__side", m.name));
    const change = Number(m.change);
    if (Number.isFinite(change)) {
      const kind = change > 0 ? "win" : change < 0 ? "loss" : "flat";
      head.append(el("span", "trade__result trade__result--" + kind, scanPercent(change)));
    }
    item.append(head);
    if (m.why) item.append(el("p", "trade__note", m.why));
    list.append(item);
  });
  parent.append(list);
}

// The coming week: a "when" column and a "what" column.
function scanSchedule(parent, title, rows) {
  if (!rows.length) return;
  scanHeading(parent, title);
  const dl = el("dl", "schedule");
  rows.forEach((row) => dl.append(el("dt", null, row.when || ""), el("dd", null, row.what || "")));
  parent.append(dl);
}

function renderScan(box, scan) {
  box.replaceChildren();

  // No scan yet: say when the first one lands.
  if (!scan.week) {
    box.append(el("p", "project-list__note", "The first scan lands Saturday morning."));
    return;
  }

  const top = el("p", "entry__note");
  top.textContent =
    "Week ending " + scanDay(scan.week) + (scan.updated ? " · written " + scanDay(scan.updated) : "");
  box.append(top);

  if (scan.summary) {
    const tldr = el("div", "tldr");
    tldr.append(el("p", "tldr__label", "THE WEEK"), el("p", "tldr__text", scan.summary));
    box.append(tldr);
  }

  const indexes = scanList(scan, "indexes").filter((i) => Number.isFinite(Number(i.change)));
  if (indexes.length) {
    scanHeading(box, "The market");
    const dl = el("dl", "schedule");
    indexes.forEach((i) => dl.append(el("dt", null, i.name || ""), el("dd", null, scanPercent(Number(i.change)))));
    box.append(dl);
  }

  scanMovers(box, "Biggest gainers", scanList(scan, "up"));
  scanMovers(box, "Biggest losers", scanList(scan, "down"));
  scanSchedule(box, "Earnings next week", scanList(scan, "earnings"));
  scanSchedule(box, "Economic reports next week", scanList(scan, "economy"));

  // Where the numbers came from, as links.
  const sources = scanList(scan, "sources").filter((s) => s.url);
  const small = el("p", "entry__note");
  small.append("Gathered by Claude from public market news. Not advice, and worth double-checking before acting on.");
  if (sources.length) {
    small.append(" Sources: ");
    sources.forEach((s, i) => {
      const a = el("a", null, s.name || s.url);
      a.href = s.url;
      a.rel = "noopener";
      small.append(a, i < sources.length - 1 ? ", " : ".");
    });
  }
  box.append(small);
}

async function initScan() {
  const box = document.querySelector("[data-scan]");
  if (!box) return;
  try {
    const response = await fetch("scan.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("scan.json: " + response.status);
    const scan = await response.json();
    renderScan(box, scan && typeof scan === "object" ? scan : {});
  } catch (err) {
    console.error(err);
    box.replaceChildren(el("p", "project-list__note", "The weekly scan couldn't load right now. Please try again later."));
  }
}

initScan();

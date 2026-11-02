/* ==========================================================================
   briefs.js — the pre-market brief page (briefs.html).
   --------------------------------------------------------------------------
   Every weekday morning a GitHub Action (.github/workflows/premarket-brief.yml)
   runs .github/scripts/premarket-brief.mjs, which asks Claude for the day's
   brief and writes these files:
     briefs/YYYY-MM-DD.md   the brief itself, in Markdown
     briefs/index.json      { latest: { date, time, headline, tldr },
                              months: [{ month: "2026-11", count }, ...] }
                            newest first (time = when it went out; main.js
                            flags it as new for an hour, see setUpBriefAlert)
     briefs/months/YYYY-MM.json  that month's [{ date, time, headline, tldr }]
                            (written by .github/scripts/brief-index.mjs)
   This file reads them and shows the latest brief, a strip of the US trading
   day in Saskatoon time, and the archive. Tapping a past brief puts its date
   in the address (#2026-11-02) so it can be shared or bookmarked.

   The Markdown is turned into HTML here, by hand (no library): headings,
   bullets, numbered lists, bold, italics, links and simple tables. Every
   line is escaped first, so nothing inside a brief can run as code.

   Uses el() from main.js, which loads first.
   ========================================================================== */

const BRIEFS_DIR = "briefs/";
const SK_ZONE = "America/Regina"; // Saskatoon: no daylight saving
const ET_ZONE = "America/New_York"; // the US markets

/* ---------- Dates ---------- */

// Today in Saskatoon, as "2026-11-02".
function skToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SK_ZONE }).format(new Date());
}

// "2026-11-02" -> "Monday, November 2" (opts pick the parts).
function briefDate(ymd, opts) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd || "");
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

/* ---------- Markdown to HTML ---------- */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The bits inside a line: `code`, **bold**, *italics*, [links](https://...).
// The text is escaped first, so the only tags that come out are these.
function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  // Only real web links become links; anything else stays as text.
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
  );
  return s;
}

// The whole brief, line by line.
function renderMarkdown(markdown) {
  const out = [];
  let para = []; // lines of the paragraph being built
  let list = null; // { tag: "ul" | "ol", items: [] }
  let table = null; // { rows: [[cell, ...], ...] }

  const flushPara = () => {
    // Lines that follow each other with no blank line stay on separate
    // lines (the brief uses that for its "**Gap call:** ..." block).
    if (para.length) out.push("<p>" + para.map(inline).join("<br>") + "</p>");
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>` + list.items.map((i) => `<li>${inline(i)}</li>`).join("") + `</${list.tag}>`);
    list = null;
  };
  const flushTable = () => {
    if (table && table.rows.length) {
      const [head, ...body] = table.rows;
      const cells = (row, tag) => row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("");
      out.push(
        '<div class="brief__table"><table><thead><tr>' + cells(head, "th") + "</tr></thead><tbody>" +
          body.map((r) => "<tr>" + cells(r, "td") + "</tr>").join("") +
          "</tbody></table></div>"
      );
    }
    table = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
  };

  for (const raw of String(markdown).replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    let m;

    if (!line.trim()) {
      flushAll();
      continue;
    }
    // # headline, ## section, ### sub-section. The page's own h1 is
    // "Pre-market brief", so the brief's headings start at h2.
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushAll();
      const level = Math.min(m[1].length + 1, 4);
      const text = m[2].replace(/\s+#+$/, "").trim();
      let cls = "";
      if (m[1].length === 1) cls = ' class="brief__headline"';
      else if (/^sources$/i.test(text)) cls = ' class="brief__sources"';
      out.push(`<h${level}${cls}>${inline(text)}</h${level}>`);
      continue;
    }
    if ((m = line.match(/^TLDR:\s*(.*)$/i))) {
      flushAll();
      out.push(`<p class="brief__tldr">${inline(m[1])}</p>`);
      continue;
    }
    // The "Generated ... by ..." line the script adds at the end.
    if ((m = line.match(/^<small>([\s\S]*)<\/small>$/i))) {
      flushAll();
      out.push(`<p class="brief__stamp">${inline(m[1].replace(/<[^>]*>/g, ""))}</p>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushAll();
      out.push("<hr>");
      continue;
    }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara();
      flushTable();
      if (!list || list.tag !== "ul") {
        flushList();
        list = { tag: "ul", items: [] };
      }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      flushTable();
      if (!list || list.tag !== "ol") {
        flushList();
        list = { tag: "ol", items: [] };
      }
      list.items.push(m[1]);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara();
      flushList();
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // the |---|---| row
      if (!table) table = { rows: [] };
      table.rows.push(cells);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      flushAll();
      out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`);
      continue;
    }
    // An indented line right after a bullet belongs to that bullet.
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += " " + line.trim();
      continue;
    }
    flushList();
    flushTable();
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}

/* ---------- The trading day strip ---------- */

// Minutes since midnight and the short weekday, in a time zone.
function zoneParts(date, zone) {
  const parts = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .forEach((p) => {
      parts[p.type] = p.value;
    });
  return { min: (Number(parts.hour) % 24) * 60 + Number(parts.minute), weekday: parts.weekday };
}

// How many hours Saskatoon is behind New York right now: 1 in winter, 2
// while the US is on daylight time (Saskatchewan never changes its clocks).
function skBehindEt(date) {
  const diff = zoneParts(date, ET_ZONE).min - zoneParts(date, SK_ZONE).min;
  return Math.round((((diff % 1440) + 1440) % 1440) / 60);
}

// Minutes since midnight ET -> "7:30 am" Saskatoon time.
function skClock(etMin, behind) {
  const t = (((etMin - behind * 60) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// 95 -> "1 h 35 min", 40 -> "40 min".
function minutesLeft(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

function drawSession() {
  const box = document.querySelector("[data-session]");
  if (!box) return;
  const START = 4 * 60; // pre-market opens 4:00 am ET
  const OPEN = 9 * 60 + 30; // 9:30 am ET
  const CLOSE = 16 * 60; // 4:00 pm ET
  const END = 20 * 60; // after-hours ends 8:00 pm ET
  const pct = (min) => ((min - START) / (END - START)) * 100;

  const now = new Date();
  const behind = skBehindEt(now);
  const sk = (etMin) => skClock(etMin, behind);

  const rth = box.querySelector(".session__rth");
  rth.style.left = pct(OPEN) + "%";
  rth.style.width = pct(CLOSE) - pct(OPEN) + "%";

  const tick = (name, text) => {
    const node = box.querySelector(`[data-tick="${name}"]`);
    if (node) node.textContent = text;
  };
  tick("pre", `Pre ${sk(START)}`);
  tick("open", `Open ${sk(OPEN)}`);
  tick("close", `Close ${sk(CLOSE)}`);
  tick("end", sk(END));

  const { min, weekday } = zoneParts(now, ET_ZONE);
  const tradingDay = !["Sat", "Sun"].includes(weekday);
  const mark = box.querySelector(".session__now");
  mark.hidden = !(tradingDay && min >= START && min <= END);
  if (!mark.hidden) mark.style.left = pct(min) + "%";

  let status;
  if (!tradingDay) status = "Weekend. Markets reopen Monday, and the next brief lands around 6:35 am.";
  else if (min < START) status = `Pre-market starts at ${sk(START)} my time. The open is ${sk(OPEN)}.`;
  else if (min < OPEN) status = `Opens in ${minutesLeft(OPEN - min)}, at ${sk(OPEN)} my time.`;
  else if (min < CLOSE) status = `Market open. Closes in ${minutesLeft(CLOSE - min)}, at ${sk(CLOSE)}.`;
  else if (min < END) status = `Closed for the day at ${sk(CLOSE)}. After-hours trading runs until ${sk(END)}.`;
  else status = `Closed for the day. ${weekday === "Fri" ? "Monday's" : "Tomorrow's"} brief lands around 6:35 am.`;
  box.querySelector("[data-session-status]").textContent = status;
}

/* ---------- The briefs ---------- */

let latest = null; // the newest brief's entry, from briefs/index.json
let months = []; // [{ month: "2026-11", count }], newest first
const monthLists = new Map(); // "2026-11" -> promise of that month's entries

const isEntry = (e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date);

async function loadBriefFile(name) {
  const response = await fetch(BRIEFS_DIR + name, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Couldn't load ${name} (${response.status})`);
  return response.text();
}

function setNotice(text, buttonText, onClick) {
  const notice = document.querySelector("[data-brief-notice]");
  notice.textContent = "";
  notice.hidden = !text;
  if (!text) return;
  notice.append(el("span", "", text));
  if (buttonText) {
    const button = el("button", "", buttonText);
    button.type = "button";
    button.addEventListener("click", onClick);
    notice.append(button);
  }
}

async function showBrief(date, scroll) {
  const article = document.querySelector("[data-brief]");

  const dateLine = document.querySelector("[data-brief-date]");
  dateLine.textContent = briefDate(date, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  // Fresh off the press (within the hour): a flashing "New" pill with the
  // time it went out. briefIsNew() is in main.js.
  if (date === latest.date && briefIsNew(latest)) {
    const posted = new Intl.DateTimeFormat("en-US", { timeZone: SK_ZONE, hour: "numeric", minute: "2-digit" })
      .format(new Date(latest.time)).toLowerCase();
    dateLine.append(" ", el("span", "brief-new", "New · posted " + posted));
  }

  if (date !== latest.date) {
    setNotice("This is an older brief.", "Back to the latest", () => {
      history.pushState(null, "", location.pathname);
      showBrief(latest.date, true);
    });
  } else if (date !== skToday()) {
    setNotice("No brief yet today. This is the latest one.");
  } else {
    setNotice("");
  }

  article.textContent = "";
  article.append(el("p", "project-list__note", "Loading…"));
  try {
    // renderMarkdown escapes everything first, so this HTML is only ever
    // the tags it makes itself.
    article.innerHTML = renderMarkdown(await loadBriefFile(date + ".md"));
  } catch (error) {
    article.textContent = "";
    article.append(el("p", "project-list__note", "This brief couldn't load. Pull down to refresh and try again."));
  }
  openMonth(date.slice(0, 7), date);

  if (scroll) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("brief-heading").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}

/* ---------- The archive: years, then months ----------
   briefs/index.json only lists the months (and the latest brief), so the
   page stays small however many years of briefs pile up. Each month is a
   fold; opening one loads briefs/months/YYYY-MM.json, once. The newest year
   and month start open. */

function loadMonth(month) {
  if (!monthLists.has(month)) {
    const list = loadBriefFile(`months/${month}.json`)
      .then((text) => {
        const data = JSON.parse(text);
        return Array.isArray(data) ? data.filter(isEntry) : [];
      })
      .catch(() => {
        monthLists.delete(month); // try again next time it's opened
        return null;
      });
    monthLists.set(month, list);
  }
  return monthLists.get(month);
}

// "2026-11" -> "November"
function monthName(month) {
  return briefDate(month + "-15", { month: "long" });
}

const briefCount = (n) => `${n} brief${n === 1 ? "" : "s"}`;

function drawArchive() {
  const box = document.querySelector("[data-archive]");
  box.textContent = "";
  const years = new Map(); // "2026" -> [{ month, count }]
  months.forEach((m) => {
    const year = m.month.slice(0, 4);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(m);
  });

  let first = true;
  years.forEach((list, year) => {
    const yearBox = el("details", "archive__year");
    yearBox.open = first;
    yearBox.dataset.year = year;
    const yearLine = el("summary", "archive__fold archive__fold--year");
    yearLine.append(el("span", "archive__label", year));
    yearLine.append(el("span", "archive__count", briefCount(list.reduce((n, m) => n + m.count, 0))));
    yearBox.append(yearLine);

    list.forEach((m) => {
      const monthBox = el("details", "archive__month");
      monthBox.dataset.month = m.month;
      const monthLine = el("summary", "archive__fold");
      monthLine.append(el("span", "archive__label", monthName(m.month)));
      monthLine.append(el("span", "archive__count", briefCount(m.count)));
      monthBox.append(monthLine, el("ul", "archive"));
      monthBox.addEventListener("toggle", () => {
        if (monthBox.open) fillMonth(monthBox);
      });
      monthBox.open = first; // fires toggle, which fills it
      first = false;
      yearBox.append(monthBox);
    });
    box.append(yearBox);
  });
}

// Puts a month's briefs into its fold (once) and marks the one on show.
async function fillMonth(monthBox) {
  const list = monthBox.querySelector(".archive");
  if (monthBox.dataset.filled) return markCurrent();
  monthBox.dataset.filled = "loading";
  list.textContent = "";
  list.append(el("li", "project-list__note archive__note", "Loading…"));
  const entries = await loadMonth(monthBox.dataset.month);
  list.textContent = "";
  if (!entries) {
    delete monthBox.dataset.filled;
    list.append(el("li", "project-list__note archive__note", "This month couldn't load. Close it and open it again to retry."));
    return;
  }
  entries.forEach((entry) => {
    const item = el("li");
    const button = el("button", "archive__row");
    button.type = "button";
    button.dataset.date = entry.date;
    button.append(el("span", "archive__date", briefDate(entry.date, { month: "short", day: "numeric" })));
    button.append(el("span", "archive__headline", entry.headline || "Pre-market brief"));
    if (entry.tldr) button.append(el("span", "archive__tldr", entry.tldr));
    button.addEventListener("click", () => {
      history.pushState(null, "", "#" + entry.date);
      showBrief(entry.date, true);
    });
    item.append(button);
    list.append(item);
  });
  monthBox.dataset.filled = "yes";
  markCurrent();
}

let shownDate = "";

function markCurrent() {
  document.querySelectorAll(".archive__row").forEach((row) => {
    row.setAttribute("aria-current", row.dataset.date === shownDate ? "true" : "false");
  });
}

// Opens the fold for the brief on show (and its year), so it's easy to
// find, then marks it.
function openMonth(month, date) {
  shownDate = date;
  const monthBox = document.querySelector(`.archive__month[data-month="${month}"]`);
  if (monthBox) {
    monthBox.closest(".archive__year").open = true;
    if (!monthBox.open) monthBox.open = true; // its toggle fills and marks
  }
  markCurrent();
}

// #2026-11-02 in the address picks that brief; otherwise the latest.
async function showFromHash() {
  const wanted = location.hash.slice(1);
  let date = latest.date;
  if (wanted !== date && isEntry({ date: wanted }) && months.some((m) => m.month === wanted.slice(0, 7))) {
    const entries = await loadMonth(wanted.slice(0, 7));
    if (entries && entries.some((e) => e.date === wanted)) date = wanted;
  }
  showBrief(date, false);
}

async function setUpBriefs() {
  drawSession();
  setInterval(drawSession, 60 * 1000);

  window.addEventListener("popstate", () => {
    if (latest) showFromHash();
  });

  try {
    const index = JSON.parse(await loadBriefFile("index.json"));
    if (index && isEntry(index.latest) && Array.isArray(index.months)) {
      latest = index.latest;
      months = index.months.filter((m) => m && /^\d{4}-\d{2}$/.test(m.month) && m.count > 0);
    }
  } catch (error) {
    latest = null;
  }

  if (!latest) {
    document.querySelector("[data-brief-date]").textContent = briefDate(skToday(), {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const article = document.querySelector("[data-brief]");
    article.textContent = "";
    article.append(
      el("p", "project-list__note", "No briefs yet. The first one lands around 6:35 am Saskatoon time on the next weekday.")
    );
    document.querySelector("[data-archive]").append(el("p", "project-list__note", "Past briefs will collect here."));
    return;
  }
  drawArchive();
  showFromHash();
}

setUpBriefs();

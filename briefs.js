/* ==========================================================================
   briefs.js — the pre-market brief and after-close report card page
   (briefs.html).
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

   After the close, a second Action (.github/workflows/postmarket-recap.yml)
   grades the day's brief into report-cards/YYYY-MM.json ({ "2026-11-02":
   card, ... }) and report-cards/index.json (running totals, the months
   and how many cards each holds). The page shows the two runs as tabs:
   "Pre-market" (the brief, with a one-line "How it did" pointer once it's
   graded) and "After close" (the report card and the running score). Each
   tab has its own archive at the bottom; see "The two tabs" below.

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

/* ---------- The two tabs ----------
   "Pre-market" (the morning brief) and "After close" (the report card).
   The address keeps track of what's on show, so it can be shared:
     (nothing)          the latest brief
     #2026-11-02        that day's brief
     #after             the latest report card
     #after-2026-11-02  that day's report card */

const tabs = [...document.querySelectorAll("[data-tab]")];
let tab = "pre";

function showTab(name, focus) {
  tab = name;
  tabs.forEach((button) => {
    const on = button.dataset.tab === name;
    button.setAttribute("aria-selected", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
    document.getElementById(button.getAttribute("aria-controls")).hidden = !on;
    if (on && focus) button.focus();
  });
}

// The address for what each tab is showing right now.
function tabHash(name) {
  if (name === "post") return shownCard && shownCard !== cardIndex?.latest ? "#after-" + shownCard : "#after";
  return shownDate && latest && shownDate !== latest.date ? "#" + shownDate : location.pathname;
}

function pickTab(name, focus) {
  if (name === tab) return;
  showTab(name, focus);
  history.replaceState(null, "", tabHash(name));
}

function setUpTabs() {
  tabs.forEach((button, i) => {
    button.addEventListener("click", () => pickTab(button.dataset.tab));
    // Left and right arrows move between tabs, like any tab list.
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      pickTab(next.dataset.tab, true);
    });
  });
}

function readHash() {
  const hash = location.hash.slice(1);
  const after = /^after(?:-(\d{4}-\d{2}-\d{2}))?$/.exec(hash);
  if (after) return { tab: "post", date: after[1] || "" };
  return { tab: "pre", date: /^\d{4}-\d{2}-\d{2}$/.test(hash) ? hash : "" };
}

function scrollToTabs() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("brief-heading").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

// The "This is an older ..." line, with an optional button.
function setNotice(notice, text, buttonText, onClick) {
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

const longDate = (ymd) => briefDate(ymd, { weekday: "long", month: "long", day: "numeric" });
const skTime = (iso) =>
  new Intl.DateTimeFormat("en-US", { timeZone: SK_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso)).toLowerCase();

/* ---------- The archive folds: years, then months ----------
   Used by both tabs. The index files only list the months, so the page
   stays small however many years pile up. Each month is a fold; opening
   one loads that month's list, once. The newest year and month start
   open. "a" is what the tab needs:
     box       the [data-archive] element
     months    [{ month: "2026-11", count }], newest first
     word      (n) => "3 briefs"
     load      (month) => promise of [{ date, title, note }] (null = failed)
     pick      (date) => show that one
     current   () => the date on show */

function monthName(month) {
  return briefDate(month + "-15", { month: "long" }); // "2026-11" -> "November"
}

function drawArchive(a) {
  a.box.textContent = "";
  const years = new Map(); // "2026" -> [{ month, count }]
  a.months.forEach((m) => {
    const year = m.month.slice(0, 4);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(m);
  });

  let first = true;
  years.forEach((list, year) => {
    const yearBox = el("details", "archive__year");
    yearBox.open = first;
    const yearLine = el("summary", "archive__fold archive__fold--year");
    yearLine.append(el("span", "archive__label", year));
    yearLine.append(el("span", "archive__count", a.word(list.reduce((n, m) => n + m.count, 0))));
    yearBox.append(yearLine);

    list.forEach((m) => {
      const monthBox = el("details", "archive__month");
      monthBox.dataset.month = m.month;
      const monthLine = el("summary", "archive__fold");
      monthLine.append(el("span", "archive__label", monthName(m.month)));
      monthLine.append(el("span", "archive__count", a.word(m.count)));
      monthBox.append(monthLine, el("ul", "archive"));
      monthBox.addEventListener("toggle", () => {
        if (monthBox.open) fillMonth(a, monthBox);
      });
      monthBox.open = first; // fires toggle, which fills it
      first = false;
      yearBox.append(monthBox);
    });
    a.box.append(yearBox);
  });
}

// Puts a month's rows into its fold (once) and marks the one on show.
async function fillMonth(a, monthBox) {
  const list = monthBox.querySelector(".archive");
  if (monthBox.dataset.filled) return markCurrent(a);
  monthBox.dataset.filled = "loading";
  list.textContent = "";
  list.append(el("li", "project-list__note archive__note", "Loading…"));
  const entries = await a.load(monthBox.dataset.month);
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
    const title = el("span", "archive__headline");
    title.append(...[].concat(entry.title));
    button.append(title);
    if (entry.note) button.append(el("span", "archive__tldr", entry.note));
    button.addEventListener("click", () => {
      a.pick(entry.date);
      scrollToTabs();
    });
    item.append(button);
    list.append(item);
  });
  monthBox.dataset.filled = "yes";
  markCurrent(a);
}

function markCurrent(a) {
  a.box.querySelectorAll(".archive__row").forEach((row) => {
    row.setAttribute("aria-current", row.dataset.date === a.current() ? "true" : "false");
  });
}

// Opens the fold for the one on show (and its year), then marks it.
function openMonth(a, date) {
  const monthBox = a.box.querySelector(`.archive__month[data-month="${date.slice(0, 7)}"]`);
  if (monthBox) {
    monthBox.closest(".archive__year").open = true;
    if (!monthBox.open) monthBox.open = true; // its toggle fills and marks
  }
  markCurrent(a);
}

/* ---------- Tab 1: the pre-market brief ---------- */

let latest = null; // the newest brief's entry, from briefs/index.json
let shownDate = ""; // the brief on show
const monthLists = new Map(); // "2026-11" -> promise of that month's entries

const isEntry = (e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date);

async function loadBriefFile(name) {
  const response = await fetch(BRIEFS_DIR + name, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Couldn't load ${name} (${response.status})`);
  return response.text();
}

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

// The brief's archive entry for a date (headline, tldr), or null.
async function briefEntry(date) {
  const entries = await loadMonth(date.slice(0, 7));
  return (entries && entries.find((e) => e.date === date)) || null;
}

const preArchive = {
  box: document.querySelector('[data-archive="pre"]'),
  months: [],
  word: (n) => `${n} brief${n === 1 ? "" : "s"}`,
  load: async (month) => {
    const entries = await loadMonth(month);
    return entries && entries.map((e) => ({ date: e.date, title: e.headline || "Pre-market brief", note: e.tldr }));
  },
  pick: (date) => {
    history.pushState(null, "", date === latest.date ? location.pathname : "#" + date);
    showBrief(date);
  },
  current: () => shownDate,
};

async function showBrief(date) {
  shownDate = date;
  const article = document.querySelector("[data-brief]");
  const dateLine = document.querySelector("[data-brief-date]");
  dateLine.textContent = longDate(date);
  // Fresh off the press (within the hour): a flashing "New" pill with the
  // time it went out. briefIsNew() is in main.js.
  if (date === latest.date && briefIsNew(latest)) {
    dateLine.append(" ", el("span", "brief-new", "New · posted " + skTime(latest.time)));
  }

  const notice = document.querySelector("[data-brief-notice]");
  if (date !== latest.date) {
    setNotice(notice, "This is an older brief.", "Back to the latest", () => preArchive.pick(latest.date));
  } else if (date !== skToday()) {
    setNotice(notice, "No brief yet today. This is the latest one.");
  } else {
    setNotice(notice, "");
  }

  article.textContent = "";
  article.append(el("p", "project-list__note", "Loading…"));
  try {
    // renderMarkdown escapes everything first, so this HTML is only ever
    // the tags it makes itself.
    article.innerHTML = renderMarkdown(await loadBriefFile(date + ".md"));
    groupParts(article);
    markNew(date, article); // tags what's new since the brief before; finishes on its own
  } catch (error) {
    article.textContent = "";
    article.append(el("p", "project-list__note", "This brief couldn't load. Pull down to refresh and try again."));
  }
  addCardLink(date, article);
  openMonth(preArchive, date);
}

/* ---------- Dressing the brief ----------
   The Morning Writer always writes the same headings (see the top of
   premarket-brief.mjs), so after the Markdown is turned into HTML these
   functions sort it into colour-coded cards:
     the lead      headline, TLDR, "How it did" and the section buttons
     MU            clay (the headline ticker), moved to the front
     Overnight     purple (the night sky)
     Watchlist     lilac
     Calendar      slate (ivory after dark)
     Sources       folded shut, quiet
   The colours themselves are in briefs.css ("The brief's sections").
   Everything here only moves and labels HTML that renderMarkdown already
   made (and escaped), so nothing new from the brief can sneak in. A
   heading it doesn't know still gets a plain card, so an older brief
   (11-05 and 11-06 had a SOX section) or a renamed heading never breaks. */

// "## Overnight and Asia" -> "overnight". Unknown headings -> "other".
const PART_NAMES = [
  [/^mu\b/i, "mu"],
  [/^sox\b/i, "sox"],
  [/^overnight/i, "overnight"],
  [/^watchlist/i, "watchlist"],
  [/^calendar/i, "calendar"],
  [/^sources$/i, "sources"],
];

// The short name on each section button.
const PART_SHORT = { overnight: "Overnight", watchlist: "Watchlist", calendar: "Calendar", sources: "Sources" };

function partName(heading) {
  const hit = PART_NAMES.find(([test]) => test.test(heading.trim()));
  return hit ? hit[1] : "other";
}

// Wraps each "## section" heading and everything under it (up to the next
// one, or the stamp) in a <section class="brief__part">, then dresses it.
function groupParts(article) {
  let part = null;
  const parts = [];
  for (const node of [...article.children]) {
    if (node.tagName === "H3") {
      const name = partName(node.textContent);
      part = el("section", "brief__part brief__part--" + name);
      part.dataset.part = name;
      part.id = "brief-part-" + parts.length;
      node.before(part);
      parts.push(part);
    } else if (node.classList.contains("brief__stamp")) {
      part = null;
    }
    if (part) part.append(node);
  }
  if (!parts.length) return; // not a brief we recognise: leave it as it is

  // The lead card: everything before the first section.
  const lead = el("div", "brief__lead");
  while (article.firstElementChild && article.firstElementChild !== parts[0]) lead.append(article.firstElementChild);
  parts[0].before(lead);

  // MU (and the old SOX) first: the gap call is what the brief is for.
  const front = parts.filter((p) => p.dataset.part === "mu" || p.dataset.part === "sox");
  for (const p of front.reverse()) lead.after(p);

  for (const p of parts) {
    const name = p.dataset.part;
    if (name === "mu" || name === "sox") dressCalls(p);
    if (name === "overnight") dressLeads(p);
    if (name === "watchlist") dressWatchlist(p);
    if (name === "calendar") dressCalendar(p);
    if (name === "sources") foldSources(p);
  }
  markChanges(article);
  const all = [...article.querySelectorAll(".brief__part")];
  addFolds(all);
  addJumps(lead, all);
}

// The MU section: "**Gap call:** ..." lines become labelled boxes, in the
// order a reader wants them (the call first, last session's check last).
// Lines with no blank line between them arrive as one <p> split by <br>.
const CALL_FIELDS = [
  [/^gap call/i, "gap"],
  [/^pre-?market/i, "pre"],
  [/^key levels/i, "levels"],
  [/^ladder/i, "ladder"],
  [/^drivers/i, "drivers"],
  [/^bull/i, "bull"],
  [/^bear/i, "bear"],
  [/^news/i, "news"],
  [/^last call/i, "last"],
];
const CALL_ORDER = ["gap", "ladder", "pre", "levels", "drivers", "bull", "bear", "news", "last"];
const CALL_LABELS = { last: "Last session's call", ladder: "Price ladder" }; // friendlier names

function dressCalls(part) {
  const fields = [];
  let field = null;
  for (const node of [...part.children]) {
    if (node.tagName === "H3") continue;
    if (node.tagName === "P") {
      for (const bit of node.innerHTML.split("<br>")) {
        const m = bit.match(/^<strong>([^<]+?):<\/strong>\s*([\s\S]*)$/);
        if (m) {
          const hit = CALL_FIELDS.find(([test]) => test.test(m[1]));
          const kind = hit ? hit[1] : "other";
          field = el("div", "brief__field brief__field--" + kind);
          field.dataset.field = kind;
          field.append(el("p", "brief__label", CALL_LABELS[kind] || m[1]));
          if (m[2].trim()) {
            const value = el("p", "brief__value");
            value.innerHTML = m[2]; // already-escaped HTML from renderMarkdown
            field.append(value);
          }
          fields.push(field);
        } else if (field && bit.trim()) {
          const value = el("p", "brief__value");
          value.innerHTML = bit;
          field.append(value);
        }
      }
      if (field) node.remove();
    } else if (field) {
      field.append(node); // a list under "Key levels:" or "News:"
    }
  }
  if (!fields.length) return;

  // Key levels: tint resistance and support so the ladder reads at a glance.
  for (const f of fields.filter((f) => f.dataset.field === "levels")) {
    for (const li of f.querySelectorAll("li")) {
      const text = li.textContent.trim();
      if (/^(next\s+)?resistance/i.test(text)) li.classList.add("brief__level--res");
      else if (/^(next\s+)?support/i.test(text)) li.classList.add("brief__level--sup");
      boldLead(li);
    }
  }
  // The gap call's confidence becomes a small pill.
  for (const f of fields.filter((f) => f.dataset.field === "gap")) {
    for (const value of f.querySelectorAll(".brief__value")) {
      value.innerHTML = value.innerHTML.replace(
        /\b(Low|Medium|Moderate|High) confidence\b/,
        (all, level) => `<span class="brief__conf brief__conf--${level.toLowerCase()}">${all}</span>`
      );
    }
  }

  // The "Ladder:" line (numbers only) becomes a drawing; if it can't be
  // read, the line is dropped, since the same numbers are in the boxes.
  for (const f of fields.filter((f) => f.dataset.field === "ladder")) {
    if (drawLadder(f)) continue;
    fields.splice(fields.indexOf(f), 1);
    f.remove();
  }

  fields.sort((a, b) => CALL_ORDER.indexOf(a.dataset.field) - CALL_ORDER.indexOf(b.dataset.field));
  const box = el("div", "brief__fields");
  for (const f of fields) box.append(f);
  // Bull and bear side by side (stacked on a phone).
  const bull = fields.find((f) => f.dataset.field === "bull");
  const bear = fields.find((f) => f.dataset.field === "bear");
  if (bull && bear) {
    const pair = el("div", "brief__pair");
    bull.before(pair);
    pair.append(bull, bear);
  }
  part.append(box);
}

// "Resistance at about $690–$695: Friday's close ..." -> the part before
// the first colon in bold. Only plain text at the start of the line.
function boldLead(li) {
  const first = li.firstChild;
  if (!first || first.nodeType !== Node.TEXT_NODE) return;
  const at = first.nodeValue.indexOf(":");
  if (at < 1 || at > 60) return;
  const strong = el("strong", "", first.nodeValue.slice(0, at + 1));
  first.nodeValue = first.nodeValue.slice(at + 1);
  li.insertBefore(strong, first);
}

// The price ladder: the "**Ladder:**" line the Morning Writer adds under
// Key levels, numbers only, drawn as a price scale (high at the top).
//   prior 690.00 | pre 685.00 | call 675-690 | support 676.00, 656.39 | resistance 690-695, 708.35
// A price can be a range ("690-695"); "n/a" means it wasn't found.
// Returns { prior, pre, call, support, resistance }, each a list of
// { lo, hi, text }, or null if there's too little to draw.
const LADDER_KINDS = ["prior", "pre", "call", "support", "resistance"];

function parseLadder(line) {
  const out = {};
  let count = 0;
  for (const piece of line.split("|")) {
    const m = piece.trim().match(/^(prior|pre|call|support|resistance)\b\s*(.*)$/i);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    out[kind] = [];
    for (const bit of m[2].split(",")) {
      const r = bit.replace(/[$\s]/g, "").match(/^(\d+(?:\.\d+)?)(?:[-–—](\d+(?:\.\d+)?))?$/);
      if (!r) continue; // "n/a", or anything that isn't a price
      const a = Number(r[1]);
      const b = r[2] ? Number(r[2]) : a;
      out[kind].push({ lo: Math.min(a, b), hi: Math.max(a, b), text: r[2] ? `$${r[1]}–$${r[2]}` : "$" + r[1] });
      count++;
    }
  }
  return count >= 2 ? out : null;
}

// What each kind of mark is called on the drawing.
const LADDER_NAMES = {
  resistance: "Resistance",
  call: "Gap call",
  pre: "Pre-market",
  prior: "Last close",
  support: "Support",
};

function drawLadder(field) {
  const raw = [...field.querySelectorAll(".brief__value")].map((v) => v.textContent).join(" ");
  const data = parseLadder(raw);
  if (!data) return false;

  const marks = [];
  for (const kind of LADDER_KINDS) for (const v of data[kind] || []) marks.push({ kind, ...v });
  let top = Math.max(...marks.map((m) => m.hi));
  let bottom = Math.min(...marks.map((m) => m.lo));
  const pad = Math.max((top - bottom) * 0.08, top * 0.004);
  top += pad;
  bottom -= pad;

  const ROW = 24; // px between labels, so they never overlap
  const height = Math.max(200, marks.length * ROW + 24);
  const y = (price) => ((top - price) / (top - bottom)) * height;

  const plot = el("div", "ladder__plot");
  plot.style.height = height + "px";
  plot.setAttribute("aria-hidden", "true");

  // Lines and bands on the rail, at their true heights.
  for (const m of marks) {
    const line = el("span", `ladder__mark ladder__mark--${m.kind}`);
    line.style.top = y(m.hi) + "px";
    if (m.hi > m.lo) {
      line.classList.add("ladder__mark--range");
      line.style.height = y(m.lo) - y(m.hi) + "px";
    }
    plot.append(line);
  }

  // Labels beside the rail, top to bottom, nudged apart where prices sit
  // close together: first push each one down clear of the one above, then
  // pull them back up from the bottom if the last one ran off the end.
  const tags = marks
    .map((m) => ({ m, at: (y(m.hi) + y(m.lo)) / 2 }))
    .sort((a, b) => a.at - b.at || LADDER_KINDS.indexOf(b.m.kind) - LADDER_KINDS.indexOf(a.m.kind));
  let above = ROW / 2 - ROW;
  for (const t of tags) above = t.at = Math.max(t.at, above + ROW);
  let below = height - ROW / 2 + ROW;
  for (const t of [...tags].reverse()) below = t.at = Math.min(t.at, below - ROW);
  for (const t of tags) {
    const tag = el("span", `ladder__tag ladder__tag--${t.m.kind}`);
    tag.style.top = t.at + "px";
    tag.append(el("strong", "", t.m.text), " " + LADDER_NAMES[t.m.kind]);
    plot.append(tag);
  }

  // The same, in words, for screen readers.
  const words = tags.map((t) => `${LADDER_NAMES[t.m.kind]} ${t.m.text}`).join(", ");
  const figure = el("figure", "ladder");
  figure.setAttribute("role", "img");
  figure.setAttribute("aria-label", "MU price ladder, high to low: " + words);
  figure.append(plot);

  for (const v of field.querySelectorAll(".brief__value")) v.remove();
  field.append(figure);
  return true;
}

// Overnight and Asia: "**Korea:** ..." -> the bold start becomes a small
// label on its own line above the item.
function dressLeads(part) {
  for (const li of part.querySelectorAll("li")) {
    const first = li.firstChild;
    if (first && first.nodeName === "STRONG") {
      first.classList.add("brief__kicker");
      first.textContent = first.textContent.replace(/:\s*$/, "");
      if (li.childNodes[1]?.nodeType === Node.TEXT_NODE) li.childNodes[1].nodeValue = li.childNodes[1].nodeValue.replace(/^:\s*/, "");
    }
  }
}

// Watchlist: since 2026-11-10 each line has two number columns,
//   **NVDA** | close 186.64 +2.8% | pre 177.04 -5.1% | News: ...
// which become a row: ticker chip, last close, pre-market, and the line
// under them. Names with news today get a "News" tag. The column headings
// are buttons that sort the list (tap again to flip it; "Ticker" puts the
// brief's own order back). Older briefs have no "|" columns, so they keep
// plain ticker chips.
const WATCH_COLS = [
  ["close", "Last close"],
  ["pre", "Pre-market"],
];

// "close 186.64 +2.8%" -> { price: "$186.64", change: "+2.8%", pct: 2.8 }
function watchCell(text) {
  const change = text.match(/[+−-]\d[\d,]*(?:\.\d+)?%/);
  const price = text.replace(change ? change[0] : "", "").match(/\d[\d,]*(?:\.\d+)?/);
  return {
    price: price ? "$" + price[0] : "",
    change: change ? change[0] : "",
    pct: change ? Number(change[0].replace("−", "-").replace(/[,%]/g, "")) : null,
  };
}

function dressWatchlist(part) {
  const list = part.querySelector("ul");
  let rows = 0;
  [...part.querySelectorAll("li")].forEach((li, i) => {
    const first = li.firstChild;
    if (!first || first.nodeName !== "STRONG" || first.textContent.length > 8) return;
    li.classList.add("brief__ticker");
    li.dataset.order = i;
    first.classList.add("brief__symbol");
    const body = el("span", "brief__about");
    while (first.nextSibling) body.append(first.nextSibling);
    li.append(body);

    // The "|" columns. The cells are HTML renderMarkdown already escaped.
    const cells = body.innerHTML.split(/\s*\|\s*/);
    const found = {};
    const rest = [];
    for (const cell of cells) {
      const m = cell.match(/^(close|pre)\b\s*(.*)$/i);
      if (m && !found[m[1].toLowerCase()]) found[m[1].toLowerCase()] = watchCell(m[2]);
      else if (cell.trim()) rest.push(cell);
    }
    if (found.close || found.pre) {
      rows++;
      li.classList.add("brief__ticker--row");
      body.innerHTML = rest.join(" | ");
      for (const [key, label] of WATCH_COLS) {
        const cell = found[key] || watchCell("");
        const num = el("span", "brief__num brief__num--" + key);
        num.setAttribute("aria-label", `${label}: ${[cell.price, cell.change].join(" ").trim() || "not found"}`);
        if (cell.change) num.append(el("span", "brief__pct", cell.change));
        num.append(el("small", "", cell.price || (cell.change ? "" : "—")));
        li.dataset[key] = cell.pct ?? "";
        body.before(num);
      }
    }

    const lead = body.firstChild;
    if (lead && lead.nodeType === Node.TEXT_NODE && /^\s*News:\s*/.test(lead.nodeValue)) {
      lead.nodeValue = lead.nodeValue.replace(/^\s*News:\s*/, "");
      body.prepend(el("span", "brief__tag", "News"), " ");
      li.classList.add("brief__ticker--news");
    }
  });
  if (rows && list) addWatchSort(part, list);
}

// The heading row over the watchlist: Ticker · Last close · Pre-market.
function addWatchSort(part, list) {
  const head = el("div", "brief__watchhead");
  const buttons = [];
  let sortKey = "order";
  let down = true; // biggest gain first

  const sortBy = (key) => {
    down = key === sortKey && key !== "order" ? !down : true;
    sortKey = key;
    const value = (li) => {
      const raw = li.dataset[key];
      return raw === "" || raw === undefined ? null : Number(raw);
    };
    const items = [...list.children].sort((a, b) => {
      if (key === "order") return value(a) - value(b);
      const va = value(a);
      const vb = value(b);
      if (va === null || vb === null) return (va === null) - (vb === null); // missing last
      return down ? vb - va : va - vb;
    });
    list.append(...items);
    for (const b of buttons) {
      const on = b.dataset.key === sortKey;
      b.setAttribute("aria-pressed", on);
      b.querySelector(".brief__arrow").textContent = on && key !== "order" ? (down ? " ▼" : " ▲") : "";
    }
  };

  for (const [key, label] of [["order", "Ticker"], ...WATCH_COLS]) {
    const button = el("button", "brief__sort", label);
    button.type = "button";
    button.dataset.key = key;
    button.title = key === "order" ? "Back to the brief's order" : `Sort by ${label.toLowerCase()} change`;
    button.append(el("span", "brief__arrow", ""));
    button.addEventListener("click", () => sortBy(key));
    buttons.push(button);
    head.append(button);
  }
  buttons[0].setAttribute("aria-pressed", "true");
  list.before(head);
}

// Calendar: day lines ("**Today (Mon, Nov 9):**") become headers, and
// "8:40 ET (7:40 SK): ..." lines get the times in their own column,
// Saskatoon time first (big) with New York time under it. Times in the
// middle of a line ("4:00 ET (3:00 SK)") are turned round the same way.
const ET_SK = /(\d{1,2}:\d{2}(?:\s?[AP]M)?\s?ET)\s*\((\d{1,2}:\d{2}(?:\s?[AP]M)?\s?SK)\)/gi;

function dressCalendar(part) {
  for (const li of part.querySelectorAll("li")) {
    const first = li.firstChild;
    if (first && first.nodeName === "STRONG" && /:\s*$/.test(first.textContent)) {
      li.classList.add("brief__day");
      if (/^today/i.test(first.textContent)) li.classList.add("brief__day--today");
      if (li.childNodes.length === 1) li.classList.add("brief__day--alone");
    }
    const m = li.innerHTML.match(/^(\d{1,2}:\d{2}(?:\s?[AP]M)?\s?ET)\s*\(([^)<]{1,20})\):\s*/i);
    if (m && !li.classList.contains("brief__day")) {
      li.classList.add("brief__slot");
      const rest = li.innerHTML.slice(m[0].length).replace(ET_SK, "$2 ($1)");
      li.innerHTML =
        `<span class="brief__when">${m[2]}<small>${m[1]}</small></span>` + `<span class="brief__what">${rest}</span>`;
    } else {
      swapTimes(li);
    }
  }
}

// Turns "4:00 ET (3:00 SK)" round in a line's own text only, never in a
// list nested under it (those lines get their own turn).
function swapTimes(li) {
  const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentNode.closest("li") === li) node.nodeValue = node.nodeValue.replace(ET_SK, "$2 ($1)");
  }
}

// Sources: folded shut, with how many there are.
function foldSources(part) {
  const list = part.querySelector("ul, ol");
  const heading = part.querySelector("h3");
  if (!list || !heading) return;
  const fold = el("details", "brief__fold");
  const summary = el("summary", "", heading.textContent + " ");
  summary.append(el("span", "brief__count", String(list.children.length)));
  fold.append(summary, list);
  heading.replaceWith(fold);
}

// Signed changes ("+0.63%", "−5.1%") in purple for up and clay for down,
// the same colours as the report card's grades. The sign stays, so the
// colour is only a helper. Walks the text, never the tags.
function markChanges(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentNode.closest("a, summary, .brief__symbol")) continue;
    if (/[+−-]\d[\d,.]*%/.test(node.nodeValue)) found.push(node);
  }
  const pattern = /(^|[\s(\/])([+−-]\d[\d,]*(?:\.\d+)?%)/g;
  for (const node of found) {
    const text = node.nodeValue;
    const bits = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(pattern)) {
      const start = m.index + m[1].length;
      bits.append(text.slice(last, start));
      const up = m[2][0] === "+";
      bits.append(el("span", "brief__chg brief__chg--" + (up ? "up" : "down"), m[2]));
      last = start + m[2].length;
    }
    if (!last) continue;
    bits.append(text.slice(last));
    node.replaceWith(bits);
  }
}

// A row of buttons in the lead card that scroll to each section. Buttons,
// not #links, because the address already says which brief is showing.
function addJumps(lead, parts) {
  const nav = el("nav", "brief__jumps");
  nav.setAttribute("aria-label", "Sections of this brief");
  for (const part of parts) {
    const heading = part.querySelector("h3, summary");
    if (!heading) continue;
    const name = part.dataset.part;
    const label = PART_SHORT[name] || heading.firstChild.textContent.trim();
    const button = el("button", "brief__jump brief__jump--" + name, label);
    button.type = "button";
    button.addEventListener("click", () => {
      const fold = part.querySelector("details");
      if (fold) fold.open = true;
      if (part.classList.contains("brief__part--folded")) {
        setFolded(part, false);
        saveFold(name, false);
      }
      part.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" }); // REDUCE_MOTION: main.js
    });
    nav.append(button);
  }
  lead.append(nav);
}

// Folding: tap a section's heading to fold it shut. The page remembers
// which sections are folded on this phone (localStorage "kelbo.briefFolds",
// { overnight: true, sources: false, ... }), so a section Kelbo never reads
// stays out of the way on the next brief too. Sources starts folded.
const FOLDS_KEY = "kelbo.briefFolds";

function readFolds() {
  try {
    return JSON.parse(localStorage.getItem(FOLDS_KEY)) || {};
  } catch (error) {
    return {}; // private browsing or a bad value: nothing remembered
  }
}

function saveFold(name, folded) {
  const folds = readFolds();
  folds[name] = folded;
  try {
    localStorage.setItem(FOLDS_KEY, JSON.stringify(folds));
  } catch (error) {
    /* storage full or blocked: it just won't be remembered */
  }
}

function setFolded(part, folded) {
  part.classList.toggle("brief__part--folded", folded);
  part.querySelector(".brief__toggle")?.setAttribute("aria-expanded", String(!folded));
}

function addFolds(parts) {
  const folds = readFolds();
  for (const part of parts) {
    const name = part.dataset.part;
    const fold = part.querySelector(":scope > details"); // Sources
    if (fold) {
      if (folds[name] === false) fold.open = true;
      fold.addEventListener("toggle", () => saveFold(name, !fold.open));
      continue;
    }
    const heading = part.querySelector(":scope > h3");
    if (!heading) continue;
    const button = el("button", "brief__toggle");
    button.type = "button";
    button.append(...heading.childNodes, el("span", "brief__chevron", ""));
    heading.append(button);
    button.addEventListener("click", () => {
      const folded = !part.classList.contains("brief__part--folded");
      setFolded(part, folded);
      saveFold(name, folded);
    });
    setFolded(part, folds[name] === true);
  }
}

/* ---------- "New" since the last brief ----------
   Compares this brief with the one before it and tags the lines that
   weren't in it: Overnight items, MU news, and watchlist names with news.
   A line counts as old if most of its words (4+ letters, numbers left out,
   since prices change every day anyway) were in one line of the last
   brief. Rough, but it only adds a tag, and it never hides anything. */
const SAME_SHARE = 0.45; // below this share of old words, a line is new
const COMMON = new Set(
  "about after also been before from have into more over said says since still than that their them then there they this were what when which while will with would".split(" ")
);

function wordSet(text) {
  return new Set((text.toLowerCase().match(/[a-z][a-z'’]{3,}/g) || []).filter((w) => !COMMON.has(w)));
}

// The share of a line's words that one of the old lines also had (the best one).
function seenShare(words, oldLines) {
  let best = 0;
  for (const old of oldLines) {
    let hits = 0;
    for (const w of words) if (old.has(w)) hits++;
    best = Math.max(best, hits / words.size);
  }
  return best;
}

// The date of the brief before this one, looking back up to two months.
async function briefBefore(date) {
  const day = new Date(date + "T12:00:00");
  for (let back = 0; back < 3; back++) {
    const d = new Date(day.getFullYear(), day.getMonth() - back, 1);
    const entries = await loadMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    const earlier = (entries || []).map((e) => e.date).filter((x) => x < date).sort();
    if (earlier.length) return earlier[earlier.length - 1];
  }
  return null;
}

function tagNew(li) {
  const tag = el("span", "brief__new", "New");
  const kicker = li.querySelector(".brief__kicker");
  if (kicker) kicker.append(" ", tag);
  else (li.querySelector(".brief__about") || li).prepend(tag, " ");
}

async function markNew(date, article) {
  const before = await briefBefore(date);
  if (!before) return;
  const old = document.createElement("div");
  try {
    old.innerHTML = renderMarkdown(await loadBriefFile(before + ".md")); // escaped, as above
  } catch (error) {
    return; // no tags is fine
  }
  if (shownDate !== date || !article.isConnected) return; // moved on meanwhile
  const oldLines = [...old.querySelectorAll("li")].map((li) => li.textContent);
  const oldSets = oldLines.map(wordSet);
  const oldTicker = new Map(); // "NVDA" -> that ticker's line last time
  for (const line of oldLines) {
    const m = line.match(/^([A-Z]{2,5})\s/);
    if (m && !oldTicker.has(m[1])) oldTicker.set(m[1], line);
  }

  let count = 0;
  for (const li of article.querySelectorAll(".brief__part--overnight li, .brief__field--news li")) {
    const words = wordSet(li.textContent);
    if (words.size < 4 || /\bno (new|update|change)/i.test(li.textContent)) continue;
    // The futures and last-close lines are new numbers every day: no tag.
    if (/futures|close/i.test(li.querySelector(".brief__kicker")?.textContent || "")) continue;
    if (seenShare(words, oldSets) < SAME_SHARE) {
      tagNew(li);
      count++;
    }
  }
  for (const li of article.querySelectorAll(".brief__ticker--news")) {
    const symbol = li.querySelector(".brief__symbol").textContent.trim();
    const last = oldTicker.get(symbol);
    const words = wordSet(li.querySelector(".brief__about").textContent);
    if (!last || !/\bNews:/.test(last) || seenShare(words, [wordSet(last)]) < SAME_SHARE) {
      tagNew(li);
      count++;
    }
  }

  const lead = article.querySelector(".brief__lead");
  if (!count || !lead) return;
  const note = el("p", "brief__newnote");
  note.append(el("span", "brief__new", "New"), ` ${count} item${count === 1 ? "" : "s"} that weren't in the last brief (${briefDate(before, { weekday: "short", month: "short", day: "numeric" })}).`);
  const jumps = lead.querySelector(".brief__jumps");
  if (jumps) jumps.before(note);
  else lead.append(note);
}

// A one-line pointer under the brief's TLDR to its report card on the
// other tab ("How it did: gap call Right · See the report card"), or
// the "graded after the close" note on today's brief.
async function addCardLink(date, article) {
  const cards = await loadCards(date.slice(0, 7));
  if (shownDate !== date || !article.isConnected) return; // moved on meanwhile
  article.querySelector(".report-link")?.remove();
  const card = cards && cards[date];
  const line = el("p", "report-link");
  if (card) {
    line.append(el("strong", "", "How it did:"), " MU gap call ", gradePill(card.gap?.grade), " ");
    if (card.sox) line.append("SOX gap call ", gradePill(card.sox.gap?.grade), " ");
    const button = el("button", "report-link__go", "See the report card");
    button.type = "button";
    button.addEventListener("click", () => {
      showCard(date);
      showTab("post");
      history.pushState(null, "", tabHash("post"));
    });
    line.append(button);
  } else {
    // Only today's weekday brief is still waiting for its grade.
    const day = new Date(date + "T12:00:00").getDay();
    if (date !== skToday() || day === 0 || day === 6) return;
    line.append("Graded after the close, around 4:10 pm Saskatoon time, on the After close tab.");
  }
  const tldr = article.querySelector(".brief__tldr");
  if (tldr) tldr.after(line);
  else article.prepend(line);
}

/* ---------- Tab 2: the after-close report card ----------
   Written after each close by .github/scripts/postmarket-recap.mjs. Every
   value is put on the page as text (never as HTML), and links only if
   they're https web addresses. */

const CARDS_DIR = "report-cards/";
const cardMonths = new Map(); // "2026-11" -> promise of { date: card }
let cardIndex = null; // report-cards/index.json
let shownCard = ""; // the report card on show

function loadCards(month) {
  if (!cardMonths.has(month)) {
    const cards = fetch(`${CARDS_DIR}${month}.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => {
        cardMonths.delete(month); // try again next time
        return null;
      });
    cardMonths.set(month, cards);
  }
  return cardMonths.get(month);
}

const GRADE_WORDS = {
  hit: "Right",
  partial: "Partly",
  miss: "Wrong",
  held: "Held",
  broke: "Broke",
  untested: "Not reached",
  unknown: "Couldn't confirm",
};

function gradePill(grade) {
  const g = GRADE_WORDS[grade] ? grade : "unknown";
  return el("span", `grade grade--${g}`, GRADE_WORDS[g]);
}

// 884.7 -> "$884.70"; 1.234 -> "+1.23%"
const money = (n) => (Number.isFinite(n) ? "$" + n.toFixed(2) : "couldn't confirm");
// Index points for the SOX: "7,123.45", no dollar sign.
const points = (n) =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "couldn't confirm";
const change = (n) => (Number.isFinite(n) ? `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}%` : "");

function cardRow(box, label, ...content) {
  const row = el("div", "report-card__row");
  const dd = el("dd");
  dd.append(...content);
  row.append(el("dt", "", label), dd);
  box.append(row);
}

const postArchive = {
  box: document.querySelector('[data-archive="post"]'),
  months: [],
  word: (n) => `${n} report card${n === 1 ? "" : "s"}`,
  load: async (month) => {
    const cards = await loadCards(month);
    if (!cards) return null;
    return Object.keys(cards)
      .filter((date) => isEntry({ date }))
      .sort()
      .reverse()
      .map((date) => {
        const c = cards[date];
        // Cards from before the SOX section grade MU only.
        const title = c.sox
          ? ["MU ", gradePill(c.gap?.grade), " SOX ", gradePill(c.sox.gap?.grade)]
          : [gradePill(c.gap?.grade), " Gap call"];
        return { date, title, note: c.summary };
      });
  },
  pick: (date) => {
    history.pushState(null, "", date === cardIndex.latest ? "#after" : "#after-" + date);
    showCard(date);
  },
  current: () => shownCard,
};

async function showCard(date) {
  shownCard = date;
  const article = document.querySelector("[data-card]");
  document.querySelector("[data-card-date]").textContent = longDate(date);
  const notice = document.querySelector("[data-card-notice]");
  if (date !== cardIndex.latest) {
    setNotice(notice, "This is an older report card.", "Back to the latest", () => postArchive.pick(cardIndex.latest));
  } else if (date !== skToday() && latest && latest.date === skToday()) {
    setNotice(notice, "Today's brief is graded after the close, around 4:10 pm Saskatoon time. This is the latest card.");
  } else {
    setNotice(notice, "");
  }

  article.textContent = "";
  article.append(el("p", "project-list__note", "Loading…"));
  const [cards, entry] = await Promise.all([loadCards(date.slice(0, 7)), briefEntry(date)]);
  if (shownCard !== date) return; // moved on meanwhile
  const card = cards && cards[date];
  article.textContent = "";
  openMonth(postArchive, date);
  if (!card) {
    article.append(el("p", "project-list__note", "This report card couldn't load. Pull down to refresh and try again."));
    return;
  }

  // Which brief it grades, with a way back to it on the other tab.
  const heading = el("h2", "brief__headline", "How the brief did");
  const from = el("p", "report-card__from");
  if (entry && entry.headline) from.append("That morning's call: ", el("strong", "", entry.headline), " ");
  const back = el("button", "report-link__go", "Read that brief");
  back.type = "button";
  back.addEventListener("click", () => {
    showBrief(date);
    showTab("pre");
    history.pushState(null, "", tabHash("pre"));
  });
  from.append(back);
  article.append(heading, from);

  const box = el("section", "report-card");
  box.setAttribute("aria-label", "The grades");
  if (card.summary) box.append(el("p", "report-card__summary", card.summary));
  const rows = el("dl", "report-card__rows");

  // One ticker's rows: its gap call, how it traded, its key levels.
  // `fmt` writes its prices (dollars for MU, index points for the SOX).
  const tickerRows = (name, gap = {}, day = {}, levels, fmt) => {
    const gapText = el("span", "", [gap.call && `Called: ${gap.call}.`, gap.result].filter(Boolean).join(" "));
    cardRow(rows, `${name} gap call`, gradePill(gap.grade), " ", gapText);
    const dayText = [
      `Opened ${fmt(day.open)}${day.open_pct != null ? ` (${change(day.open_pct)})` : ""}`,
      `closed ${fmt(day.close)}${day.close_pct != null ? ` (${change(day.close_pct)})` : ""}`,
    ].join(", ");
    cardRow(rows, name, el("span", "", `${dayText}, from ${fmt(day.prev_close)} the session before.`));
    if (Array.isArray(levels) && levels.length) {
      const list = el("ul", "report-card__levels");
      levels.forEach((l) => {
        const item = el("li");
        item.append(gradePill(l.grade), " ", el("strong", "", l.level || ""));
        if (l.result) item.append(" ", el("span", "", l.result));
        list.append(item);
      });
      cardRow(rows, `${name} levels`, list);
    }
  };
  tickerRows("MU", card.gap, card.mu, card.levels, money);
  // Cards from before November 5, 2026 have no SOX part.
  if (card.sox) tickerRows("SOX", card.sox.gap, card.sox.index, card.sox.levels, points);
  box.append(rows);

  const links = (card.sources || []).filter((s) => s && /^https:\/\//.test(s.url));
  if (links.length) {
    const p = el("p", "report-card__sources", "Checked against: ");
    links.forEach((s, i) => {
      const a = el("a", "", s.title || s.url);
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      p.append(i ? ", " : "", a);
    });
    box.append(p);
  }
  if (card.time) {
    box.append(el("p", "report-card__stamp", `Graded after the close at ${skTime(card.time)}, from web reports. Prices it couldn't confirm say so.`));
  }
  article.append(box);
}

// "Report card, 10 graded days: Gap call 7 right · 2 partly · 1 wrong,
// Key levels 12 held · 6 broke." Left hidden until there's a score.
function showTally(data) {
  const line = document.querySelector("[data-report-tally]");
  if (!line || !data || !(data.days > 0)) return;
  const n = (v) => (Number.isFinite(v) ? v : 0);
  const part = (label, items) => {
    const group = el("span", "report-tally__group");
    group.append(el("span", "report-tally__label", label));
    items.filter(([, count]) => count > 0).forEach(([grade, count]) => {
      group.append(" ", el("span", `grade grade--${grade}`, `${count} ${GRADE_WORDS[grade].toLowerCase()}`));
    });
    return group;
  };
  // MU's totals are data.gap and data.levels; the SOX's are data.sox
  // (only the days since it was added, so it says how many).
  const ticker = (name, t, days) => {
    const gap = t.gap || {};
    const levels = t.levels || {};
    line.append(" ", part(`${name} gap call${days ? ` (${days} day${days === 1 ? "" : "s"})` : ""}`,
      [["hit", n(gap.hit)], ["partial", n(gap.partial)], ["miss", n(gap.miss)]]));
    if (n(levels.held) + n(levels.broke) > 0) {
      line.append(" ", part(`${name} levels`, [["held", n(levels.held)], ["broke", n(levels.broke)]]));
    }
  };
  line.textContent = "";
  line.append(el("strong", "", `Report card, ${data.days} graded day${data.days === 1 ? "" : "s"}:`));
  ticker("MU", data, 0);
  if (data.sox && data.sox.days > 0) ticker("SOX", data.sox, data.sox.days);
  line.hidden = false;
}

/* ---------- What the brief is working on ----------
   lessons/latest.json, written each Sunday by brief-lessons.mjs from the
   report cards: { updated, window: {from, to}, cards, lessons: [{ text,
   evidence: {count, dates}, status }] }. The fold lists the lessons that
   aren't retired, as text. No file, or nothing active: it stays hidden. */
async function setUpLessons() {
  const box = document.querySelector("[data-lessons]");
  if (!box) return;
  let data;
  try {
    const response = await fetch("lessons/latest.json", { cache: "no-cache" });
    data = response.ok ? await response.json() : null;
  } catch (error) {
    data = null;
  }
  const active = (data && Array.isArray(data.lessons) ? data.lessons : []).filter(
    (l) => l && l.status !== "retired" && typeof l.text === "string" && l.text
  );
  if (!active.length) return;
  const list = box.querySelector("[data-lessons-list]");
  list.textContent = "";
  active.forEach((l) => {
    const item = el("li", "lessons__item");
    item.append(el("span", "lessons__text", l.text));
    if (l.status === "new") item.prepend(el("span", "lessons__new", "New"), " ");
    const ev = l.evidence || {};
    const dates = (Array.isArray(ev.dates) ? ev.dates : []).filter((d) => isEntry({ date: d }));
    const when = dates.map((d) => briefDate(d, { month: "short", day: "numeric" })).join(", ");
    const proof = [ev.count, when && `(${when})`].filter(Boolean).join(" ");
    if (proof) item.append(el("span", "lessons__evidence", proof));
    list.append(item);
  });
  box.querySelector("[data-lessons-count]").textContent = String(active.length);
  const note = [];
  if (Number.isFinite(data.cards)) note.push(`From ${data.cards} graded report card${data.cards === 1 ? "" : "s"}`);
  if (data.window && isEntry({ date: data.window.from }) && isEntry({ date: data.window.to })) {
    note.push(`${briefDate(data.window.from, { month: "short", day: "numeric" })} to ${briefDate(data.window.to, { month: "short", day: "numeric" })}`);
  }
  box.querySelector("[data-lessons-note]").textContent =
    (note.length ? note.join(", ") + ". " : "") + "The morning brief reads these before it writes. Updated Sundays.";
  box.hidden = false;
}

async function setUpCards() {
  try {
    const response = await fetch(CARDS_DIR + "index.json", { cache: "no-cache" });
    const data = response.ok ? await response.json() : null;
    if (data && isEntry({ date: data.latest }) && Array.isArray(data.months)) cardIndex = data;
  } catch (error) {
    cardIndex = null;
  }
  if (!cardIndex) {
    const article = document.querySelector("[data-card]");
    article.textContent = "";
    article.append(
      el("p", "project-list__note", "No report cards yet. Each weekday brief is graded after the close, around 4:10 pm Saskatoon time.")
    );
    postArchive.box.append(el("p", "project-list__note", "Past report cards will collect here."));
    return;
  }
  showTally(cardIndex);
  const counts = cardIndex.counts || {};
  postArchive.months = cardIndex.months
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .map((month) => ({ month, count: Number.isFinite(counts[month]) ? counts[month] : 0 }));
  drawArchive(postArchive);
}

/* ---------- Starting up ---------- */

// Shows whatever the address asks for (see "The two tabs").
async function showFromHash() {
  const want = readHash();
  showTab(want.tab);
  if (want.tab === "post") {
    if (!cardIndex) return;
    let date = cardIndex.latest;
    if (want.date && want.date !== date) {
      const cards = await loadCards(want.date.slice(0, 7));
      if (cards && cards[want.date]) date = want.date;
    }
    if (date !== shownCard) showCard(date);
  } else {
    if (!latest) return;
    let date = latest.date;
    if (want.date && want.date !== date && (await briefEntry(want.date))) date = want.date;
    if (date !== shownDate) showBrief(date);
  }
}

async function setUpBriefs() {
  drawSession();
  setInterval(drawSession, 60 * 1000);
  setUpTabs();
  window.addEventListener("popstate", showFromHash);

  try {
    const index = JSON.parse(await loadBriefFile("index.json"));
    if (index && isEntry(index.latest) && Array.isArray(index.months)) {
      latest = index.latest;
      preArchive.months = index.months.filter((m) => m && /^\d{4}-\d{2}$/.test(m.month) && m.count > 0);
    }
  } catch (error) {
    latest = null;
  }
  setUpLessons(); // the weekly lessons fold; quietly stays hidden if missing
  await setUpCards();

  if (!latest) {
    document.querySelector("[data-brief-date]").textContent = longDate(skToday());
    const article = document.querySelector("[data-brief]");
    article.textContent = "";
    article.append(
      el("p", "project-list__note", "No briefs yet. The first one lands around 6:35 am Saskatoon time on the next weekday.")
    );
    preArchive.box.append(el("p", "project-list__note", "Past briefs will collect here."));
  } else {
    drawArchive(preArchive);
  }

  // Both tabs start filled, so switching is instant: the one the address
  // asks for, and the latest of the other.
  await showFromHash();
  if (latest && !shownDate) showBrief(latest.date);
  if (cardIndex && !shownCard) showCard(cardIndex.latest);
}

setUpBriefs();

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
  } catch (error) {
    article.textContent = "";
    article.append(el("p", "project-list__note", "This brief couldn't load. Pull down to refresh and try again."));
  }
  addCardLink(date, article);
  openMonth(preArchive, date);
}

// Wraps each "## section" heading and everything under it (up to the next
// one, or the stamp) in a <section class="brief__part">, so wide screens
// can set the sections side by side in a grid (briefs.css). Phones see no
// difference. The Sources section gets brief__part--sources (full width).
function groupParts(article) {
  let part = null;
  for (const node of [...article.children]) {
    if (node.tagName === "H3") {
      part = el("section", "brief__part");
      if (node.classList.contains("brief__sources")) part.classList.add("brief__part--sources");
      node.before(part);
    } else if (node.classList.contains("brief__stamp")) {
      part = null;
    }
    if (part) part.append(node);
  }
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
    line.append(el("strong", "", "How it did:"), " gap call ", gradePill(card.gap?.grade), " ");
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
      .map((date) => ({ date, title: [gradePill(cards[date].gap?.grade), " Gap call"], note: cards[date].summary }));
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

  const gap = card.gap || {};
  const gapText = el("span", "", [gap.call && `Called: ${gap.call}.`, gap.result].filter(Boolean).join(" "));
  cardRow(rows, "Gap call", gradePill(gap.grade), " ", gapText);

  const mu = card.mu || {};
  const muText = [
    `Opened ${money(mu.open)}${mu.open_pct != null ? ` (${change(mu.open_pct)})` : ""}`,
    `closed ${money(mu.close)}${mu.close_pct != null ? ` (${change(mu.close_pct)})` : ""}`,
  ].join(", ");
  cardRow(rows, "MU", el("span", "", `${muText}, from ${money(mu.prev_close)} the session before.`));

  if (Array.isArray(card.levels) && card.levels.length) {
    const list = el("ul", "report-card__levels");
    card.levels.forEach((l) => {
      const item = el("li");
      item.append(gradePill(l.grade), " ", el("strong", "", l.level || ""));
      if (l.result) item.append(" ", el("span", "", l.result));
      list.append(item);
    });
    cardRow(rows, "Key levels", list);
  }
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
  const gap = data.gap || {};
  const levels = data.levels || {};
  line.textContent = "";
  line.append(el("strong", "", `Report card, ${data.days} graded day${data.days === 1 ? "" : "s"}:`), " ");
  line.append(part("Gap call", [["hit", n(gap.hit)], ["partial", n(gap.partial)], ["miss", n(gap.miss)]]));
  if (n(levels.held) + n(levels.broke) > 0) {
    line.append(" ", part("Key levels", [["held", n(levels.held)], ["broke", n(levels.broke)]]));
  }
  line.hidden = false;
}

/* ---------- What the brief is working on ----------
   lessons/latest.json, written each Saturday by brief-lessons.mjs from the
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
    (note.length ? note.join(", ") + ". " : "") + "The morning brief reads these before it writes. Updated Saturdays.";
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

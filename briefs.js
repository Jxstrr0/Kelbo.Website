/* ==========================================================================
   briefs.js — the pre-market brief page (briefs.html).
   --------------------------------------------------------------------------
   Every weekday morning a GitHub Action (.github/workflows/premarket-brief.yml)
   runs .github/scripts/premarket-brief.mjs, which asks Claude for the day's
   brief and writes two files:
     briefs/YYYY-MM-DD.md   the brief itself, in Markdown
     briefs/index.json      [{ date, headline, tldr }, ...], newest first
   This file reads them and shows the latest brief, a strip of the US trading
   day in Saskatoon time, and the archive. Tapping a past brief puts its date
   in the address (#2026-11-02) so it can be shared or bookmarked.

   The Markdown is turned into HTML here, by hand (no library): headings,
   bullets, numbered lists, bold, italics, links and simple tables. Every
   line is escaped first, so nothing inside a brief can run as code.

   Uses el() from main.js, which loads first.
   ========================================================================== */

const BRIEFS_DIR = "briefs/";
const ARCHIVE_PAGE = 20; // archive rows shown before "Show older briefs"
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
  if (!tradingDay) status = "Weekend. Markets reopen Monday, and the next brief lands around 7 am.";
  else if (min < START) status = `Pre-market starts at ${sk(START)} my time. The open is ${sk(OPEN)}.`;
  else if (min < OPEN) status = `Opens in ${minutesLeft(OPEN - min)}, at ${sk(OPEN)} my time.`;
  else if (min < CLOSE) status = `Market open. Closes in ${minutesLeft(CLOSE - min)}, at ${sk(CLOSE)}.`;
  else if (min < END) status = `Closed for the day at ${sk(CLOSE)}. After-hours trading runs until ${sk(END)}.`;
  else status = `Closed for the day. ${weekday === "Fri" ? "Monday's" : "Tomorrow's"} brief lands around 7 am.`;
  box.querySelector("[data-session-status]").textContent = status;
}

/* ---------- The briefs ---------- */

let briefIndex = []; // from briefs/index.json, newest first
let archiveShown = ARCHIVE_PAGE;

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
  const latest = briefIndex[0] && briefIndex[0].date;

  document.querySelector("[data-brief-date]").textContent = briefDate(date, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (date !== latest) {
    setNotice("This is an older brief.", "Back to the latest", () => {
      history.pushState(null, "", location.pathname);
      showBrief(latest, true);
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
  drawArchive(date);

  if (scroll) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("brief-heading").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}

function drawArchive(current) {
  const list = document.querySelector("[data-archive]");
  const more = document.querySelector("[data-archive-more]");
  list.textContent = "";
  briefIndex.slice(0, archiveShown).forEach((entry) => {
    const item = el("li");
    const button = el("button", "archive__row");
    button.type = "button";
    button.setAttribute("aria-current", entry.date === current ? "true" : "false");
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
  more.hidden = briefIndex.length <= archiveShown;
}

// #2026-11-02 in the address picks that brief; otherwise the latest.
function showFromHash() {
  const wanted = location.hash.slice(1);
  const hit = briefIndex.find((entry) => entry.date === wanted);
  showBrief(hit ? hit.date : briefIndex[0].date, false);
}

async function setUpBriefs() {
  drawSession();
  setInterval(drawSession, 60 * 1000);

  const more = document.querySelector("[data-archive-more]");
  more.addEventListener("click", () => {
    archiveShown += ARCHIVE_PAGE;
    const wanted = location.hash.slice(1);
    drawArchive(briefIndex.some((e) => e.date === wanted) ? wanted : briefIndex[0].date);
  });
  window.addEventListener("popstate", () => {
    if (briefIndex.length) showFromHash();
  });

  try {
    const index = JSON.parse(await loadBriefFile("index.json"));
    briefIndex = Array.isArray(index) ? index.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) : [];
  } catch (error) {
    briefIndex = [];
  }

  if (!briefIndex.length) {
    document.querySelector("[data-brief-date]").textContent = briefDate(skToday(), {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const article = document.querySelector("[data-brief]");
    article.textContent = "";
    article.append(
      el("p", "project-list__note", "No briefs yet. The first one lands around 7 am Saskatoon time on the next weekday.")
    );
    const list = document.querySelector("[data-archive]");
    list.append(el("li", "project-list__note", "Past briefs will collect here."));
    return;
  }
  showFromHash();
}

setUpBriefs();

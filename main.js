/* ==========================================================================
   main.js — shows projects from projects.json on the page, and runs the
   live horizon (the sun in the hero follows the real sun over Saskatoon).
   --------------------------------------------------------------------------
   You shouldn't need to edit this file to add or change a project.
   Just edit projects.json. This script:
     1. loads projects.json
     2. on the home page, shows projects marked "featured": true (max 4)
        as big cards
     3. on the projects page, shows every project with filter buttons
     4. on the Games, Trading, and AI pages, shows every project in that
        "category"
     5. on the home page tiles, shows how many projects each section has
     6. fades things in smoothly as you scroll (see "Scroll reveal")
     7. slides cards around smoothly when you filter (see "Smooth filtering")
     8. runs the live horizon: the sun in the hero sits where the real sun
        is over Saskatoon, and the site goes dark at real sunset
     9. remembers the last game you opened and offers "Continue?"
    10. lights up "Market open" on the Trading tile during NYSE hours
    11. warms the sky toward clay in the 20 minutes before sunset
    12. fills the "Now building" strip on the home page from now.json
    13. stretches the hero's ray with the season, and shows a badge on the
        longest and shortest days of the year

   To preview a time of day, add ?at= to the address, e.g.
   index.html?at=noon, ?at=sunset, ?at=night, or ?at=2026-06-21T22:30
   ========================================================================== */

// Status labels, from "done" down to "just an idea". Projects are
// sorted in this order, furthest along first.
// "spot" is how full the progress bar is, from 0 to 100.
// To add a new status, add a line here.
// "For Now" means done but may get more updates; "Final Form" means
// it's complete and won't change.
const STATUSES = [
  { label: "Finished - Final Form", spot: 100 },
  { label: "Finished - For Now", spot: 100 },
  { label: "Mostly done", spot: 78 },
  { label: "Building", spot: 50 },
  { label: "Early stages", spot: 32 },
  { label: "Planned", spot: 18 },
];

const MAX_FEATURED = 4;

// True if the visitor's device is set to "reduce motion".
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Find the status entry for a project (ignores upper/lower case).
// Unknown statuses still show, with an empty progress bar.
function findStatus(statusText) {
  const wanted = String(statusText || "").trim().toLowerCase();
  return (
    STATUSES.find((s) => s.label.toLowerCase() === wanted) || {
      label: statusText || "Unknown",
      spot: 0,
    }
  );
}

// Small helper: make an element with a class and optional text.
// Using textContent (not innerHTML) means text from projects.json
// is always shown as plain text, never run as code.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// True if a project's category matches (ignores upper/lower case).
function inCategory(project, category) {
  return (
    String(project.category || "").trim().toLowerCase() ===
    String(category || "").trim().toLowerCase()
  );
}

function isGame(project) {
  return inCategory(project, "Game");
}

// "Trading OS" -> "TO". Shown on covers that don't have a screenshot.
function initials(title) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// Build the card for one project.
function renderProject(project) {
  const status = findStatus(project.status);
  const title = project.title || "Untitled";
  const item = el("li", "project");
  item.dataset.key = title; // lets smooth filtering spot the same card again

  // Cover: the "image" screenshot if there is one, otherwise a coloured
  // tile with the project's initials. Tapping the cover opens the link
  // too, but it's hidden from keyboards and screen readers because the
  // button below already does the same thing.
  const cover = el(project.link ? "a" : "div", "project__cover");
  cover.dataset.cat = String(project.category || "").trim().toLowerCase();
  if (project.link) {
    cover.href = project.link;
    cover.tabIndex = -1;
    cover.setAttribute("aria-hidden", "true");
  }
  if (project.image) {
    const img = el("img");
    img.src = project.image;
    img.alt = ""; // decoration: the title is right below
    img.width = 640;
    img.height = 480;
    img.loading = "lazy";
    cover.append(img);
  } else {
    cover.append(el("span", "project__initials", initials(title)));
  }
  item.append(cover);

  const body = el("div", "project__body");
  body.append(el("h3", "project__title", title));

  // Status pill + category
  const meta = el("p", "project__meta");
  meta.append(el("span", "project__status", status.label));
  if (project.category) meta.append(el("span", "project__category", project.category));
  body.append(meta);

  if (project.summary) {
    body.append(el("p", "project__summary", project.summary));
  }

  // Version note: "v1.4 · Added night mode". Both parts are optional
  // ("version" and "latest" in projects.json); leave them "" to show nothing.
  const version = String(project.version || "").trim().replace(/^v/i, "");
  const latest = String(project.latest || "").trim();
  if (version || latest) {
    const note = el("p", "project__version");
    if (version) note.append(el("strong", null, "v" + version));
    if (version && latest) note.append(" · ");
    if (latest) note.append(latest);
    body.append(note);
  }

  // The progress bar. It's decoration only (the status is already
  // written in text above), so screen readers skip it.
  const field = el("div", "field is-waiting");
  field.setAttribute("aria-hidden", "true");
  field.style.setProperty("--progress", status.spot);
  field.append(el("span", "field__drive"), el("span", "field__ball"));
  body.append(field);

  // Links: "link" is where to try the project ("Play it" for games),
  // "code" is where its code lives on GitHub. Both are optional.
  const links = el("p", "project__links");
  if (project.link) {
    // Games get a big clay "Play it" button; everything else a plain link.
    const link = isGame(project)
      ? el("a", "button button--play", "Play it")
      : el("a", "project__link", "Take a look →");
    link.href = project.link;
    // The arrow is decoration; give screen readers a clear name.
    link.setAttribute("aria-label", (isGame(project) ? "Play " : "Take a look at ") + title);
    links.append(link);
  }
  if (project.code) {
    const code = el("a", "project__link", "See the code →");
    code.href = project.code;
    code.setAttribute("aria-label", "See the code for " + title);
    links.append(code);
  }
  if (links.children.length) body.append(links);

  item.append(body);
  return item;
}

// Put a list of projects into a <ul>, replacing what was there.
// Cards fade in as they scroll into view, unless "animateCard" is
// given, in which case that does the animating instead.
function fillList(listEl, projects, emptyMessage, animateCard) {
  listEl.replaceChildren();
  if (projects.length === 0) {
    listEl.append(el("li", "project-list__note", emptyMessage));
    return;
  }
  projects.forEach((p, i) => {
    const card = renderProject(p);
    card.style.setProperty("--i", i % 4); // stagger each row of cards
    listEl.append(card);
    if (animateCard) animateCard(card);
    else reveal(card);
  });
}

/* ---------- Scroll reveal ----------
   Cards and sections start slightly faded and low, then slide up into
   place as they scroll into view. A card's progress bar fills at the
   same moment. Skipped entirely if "reduce motion" is on, or in old
   browsers, so content is never hidden by accident. */
const revealObserver =
  !REDUCE_MOTION && "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            showNow(entry.target);
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px" }
      )
    : null;

function showNow(node) {
  node.classList.add("is-in");
  // Start the progress bar filling. Wait two frames so the browser
  // draws it empty first, then animates to the right spot.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      node.querySelectorAll(".field.is-waiting").forEach((f) => f.classList.remove("is-waiting"));
    });
  });
}

function reveal(node) {
  if (!revealObserver) {
    showNow(node);
    return;
  }
  node.classList.add("reveal");
  revealObserver.observe(node);
}

/* ---------- Smooth filtering ----------
   When a filter button is tapped, cards that are leaving fade out, cards
   that stay glide to their new spots, and new cards rise in. This is the
   "FLIP" trick: note where each card was, rebuild the list, then animate
   each card from its old spot to its new one. */
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)"; // same curve as --ease in style.css

async function refilter(listEl, projects, emptyMessage, isStillCurrent) {
  const staying = new Set(projects.map((p) => p.title || "Untitled"));
  const oldCards = [...listEl.querySelectorAll(".project")];
  const oldSpots = new Map(oldCards.map((c) => [c.dataset.key, c.getBoundingClientRect()]));

  // 1. Fade out the cards that are leaving, and wait for them.
  const leaving = oldCards.filter((c) => !staying.has(c.dataset.key));
  await Promise.all(
    leaving.map(
      (c) =>
        c.animate(
          [{ opacity: 1 }, { opacity: 0, transform: "scale(0.94)" }],
          { duration: 180, easing: "ease-in", fill: "forwards" }
        ).finished
    )
  ).catch(() => {});

  // A quicker second tap already took over, so stop here.
  if (!isStillCurrent()) return;

  // 2. Rebuild the list. 3. Move every card from where it was.
  let newcomers = 0;
  fillList(listEl, projects, emptyMessage, (card) => {
    const oldSpot = oldSpots.get(card.dataset.key);
    if (!oldSpot) {
      // New card: rise in, one after another, then fill its bar.
      card.animate(
        [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }],
        { duration: 500, delay: newcomers++ * 70, easing: EASE, fill: "backwards" }
      );
      showNow(card);
      return;
    }
    // Same card as before: its bar is already full, so skip the fill.
    card.querySelectorAll(".field").forEach((f) => f.classList.remove("is-waiting"));
    const newSpot = card.getBoundingClientRect();
    const dx = oldSpot.left - newSpot.left;
    const dy = oldSpot.top - newSpot.top;
    if (dx || dy) {
      card.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 450, easing: EASE }
      );
    }
  });
}

// Where a status sits in the STATUSES list (unknown ones go last).
function statusRank(statusText) {
  const rank = STATUSES.indexOf(findStatus(statusText));
  return rank === -1 ? STATUSES.length : rank;
}

// Sort projects so the furthest-along come first (in STATUSES order).
// Projects with the same status keep the order they have in projects.json.
function sortByProgress(projects) {
  return projects
    .map((p, i) => ({ p, i }))
    .sort((a, b) => statusRank(a.p.status) - statusRank(b.p.status) || a.i - b.i)
    .map((x) => x.p);
}

// Home page: featured projects only.
function setUpFeatured(listEl, projects) {
  const featured = projects.filter((p) => p.featured === true).slice(0, MAX_FEATURED);
  fillList(listEl, featured, "No featured projects yet.");
}

// Section pages (Games, Trading, AI): every project in one category,
// furthest-along first. The category comes from data-category in the HTML.
function setUpCategory(listEl, projects) {
  const category = listEl.dataset.category;
  const inThis = projects.filter((p) => inCategory(p, category));
  fillList(listEl, sortByProgress(inThis), "Nothing here yet. Check back soon.");
}

// Home page tiles: "4 projects" under each section name.
function fillCategoryCounts(projects) {
  document.querySelectorAll("[data-category-count]").forEach((node) => {
    const n = projects.filter((p) => inCategory(p, node.dataset.categoryCount)).length;
    node.textContent = n === 1 ? "1 project" : n + " projects";
  });
}

// Projects page: all projects plus filter buttons.
function setUpAll(listEl, projects) {
  const filtersEl = document.querySelector("[data-filters]");
  const countEl = document.querySelector("[data-count]");
  const sorted = sortByProgress(projects);

  // One button for "All", then one per status that has projects
  // (in the STATUSES order, then any unknown statuses).
  const labels = [];
  sorted.forEach((p) => {
    const label = findStatus(p.status).label;
    if (!labels.includes(label)) labels.push(label);
  });
  const options = ["All"].concat(labels);

  // Counts taps, so a quick second tap can cancel the first one's animation.
  let taps = 0;

  // "smooth" is true when a button was tapped (not on first load).
  function show(choice, smooth) {
    const shown =
      choice === "All" ? sorted : sorted.filter((p) => findStatus(p.status).label === choice);
    const tap = ++taps;
    if (smooth && !REDUCE_MOTION && "animate" in Element.prototype) {
      refilter(listEl, shown, "Nothing here yet.", () => tap === taps);
    } else {
      fillList(listEl, shown, "Nothing here yet.");
    }

    if (filtersEl) {
      filtersEl.querySelectorAll("button").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.status === choice));
      });
    }
    if (countEl) {
      const noun = shown.length === 1 ? "project" : "projects";
      countEl.textContent =
        choice === "All"
          ? `Showing all ${shown.length} ${noun}.`
          : `Showing ${shown.length} ${noun} marked "${choice}".`;
    }
  }

  if (filtersEl) {
    options.forEach((choice) => {
      const count =
        choice === "All"
          ? sorted.length
          : sorted.filter((p) => findStatus(p.status).label === choice).length;
      const btn = el("button", null, `${choice} (${count})`);
      btn.type = "button";
      btn.dataset.status = choice;
      btn.addEventListener("click", () => show(choice, true));
      filtersEl.append(btn);
    });
  }

  show("All");
}

// Contact form on the home page. Sends the message to Web3Forms in the
// background so the visitor stays on the page, then says whether it worked.
// Without JavaScript the form still posts normally.
function setUpContactForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  const status = form.querySelector("[data-contact-status]");
  const button = form.querySelector('button[type="submit"]');

  function say(text, kind) {
    status.textContent = text;
    status.className = "contact-form__status" + (kind ? " is-" + kind : "");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    say("Sending…");
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "HTTP " + response.status);
      form.reset();
      say("Sent. Thanks for reaching out!", "sent");
    } catch (err) {
      console.error("Contact form didn't send:", err);
      say("That didn't send. Please try again in a minute.", "error");
    } finally {
      button.disabled = false;
    }
  });
}


/* ======================================================================
   LIVE HORIZON
   ----------------------------------------------------------------------
   The sun in the hero is the real sun over Saskatoon. Every minute we
   work out how high it is (its "altitude", in degrees above the horizon)
   and where it is in its day, then move the sun and its ray to match.
   When the real sun sets, the whole site switches to the dark theme.

   The maths is the standard low-precision solar position (good to about
   a quarter of a degree, which is more than enough for a logo). No
   internet service is involved, so it works offline and never breaks.
   ====================================================================== */

const YXE = { lat: 52.1332, lon: -106.67, tz: "America/Regina" }; // Saskatoon. SK has no DST.
const SUNRISE_ALT = -0.833; // the sun's top edge touches the horizon (with refraction)
const TWILIGHT_MS = 20 * 60000; // the sky starts warming 20 minutes before sunset
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// Where the sun is in the sky at a moment in time: its declination (how far
// north of the equator it sits, which sets the season) and its hour angle
// (how far past noon it is), both in radians.
function sunPosition(date) {
  const n = date.getTime() / 86400000 - 10957.5; // days since 1 Jan 2000, noon UTC
  const g = (357.529 + 0.98560028 * n) * D2R; // mean anomaly
  const q = 280.459 + 0.98564736 * n; // mean longitude (deg)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R; // ecliptic longitude
  const e = (23.439 - 0.00000036 * n) * D2R; // tilt of the Earth
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)); // right ascension
  const dec = Math.asin(Math.sin(e) * Math.sin(L)); // declination
  const gmst = 18.697374558 + 24.06570982441908 * n; // sidereal time, hours
  const lst = (gmst * 15 + YXE.lon) * D2R; // local sidereal time
  return { dec, ha: lst - ra };
}

// Altitude of the sun above the horizon, in degrees, at a moment in time.
function sunAltitude(date) {
  const { dec, ha } = sunPosition(date);
  const lat = YXE.lat * D2R;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) * R2D;
}

/* ---------- Seasons ----------
   Saskatoon's days run from about 7h 40m of light in December to 16h 45m
   in June. "season" is where today sits between those: 0 on the shortest
   day, 1 on the longest. The hero's ray reaches further in summer. */
const SHORTEST_DAY_MS = 7.65 * 3600000;
const LONGEST_DAY_MS = 16.75 * 3600000;

function seasonOf(day) {
  if (!day.rise || !day.set) return 0.5;
  const share = (day.set - day.rise - SHORTEST_DAY_MS) / (LONGEST_DAY_MS - SHORTEST_DAY_MS);
  return Math.max(0, Math.min(1, share));
}

// "longest" on the longest day of the year (the June solstice), "shortest"
// on the shortest (December), otherwise "". The solstice is the day the
// sun sits furthest north (June) or south (December) at local noon, so we
// check the days around it and see if today wins.
function solsticeToday(date) {
  const p = localParts(date);
  if (p.m !== 6 && p.m !== 12) return "";
  const sign = p.m === 6 ? 1 : -1; // June wants the biggest, December the smallest
  let winner = null, best = -Infinity;
  for (let d = 17; d <= 25; d++) {
    const dec = sign * sunPosition(new Date(Date.UTC(p.y, p.m - 1, d, 19))).dec; // 19:00 UTC = 1 PM Saskatoon
    if (dec > best) { best = dec; winner = d; }
  }
  if (winner !== p.d) return "";
  return p.m === 6 ? "longest" : "shortest";
}

// Parts of a moment in Saskatoon time: { y, m, d, h, min, weekday }.
function localParts(date, tz) {
  const parts = {};
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || YXE.tz,
    hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", weekday: "short",
  })
    .formatToParts(date)
    .forEach((p) => { parts[p.type] = p.value; });
  return {
    y: +parts.year, m: +parts.month, d: +parts.day,
    h: +parts.hour % 24, min: +parts.minute, weekday: parts.weekday,
  };
}

// "6:41 PM" in Saskatoon time.
function clock(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: YXE.tz, hour: "numeric", minute: "2-digit" })
    .format(date)
    .replace(/\s?([ap])\.m\./i, " $1m")
    .toUpperCase()
    .replace(/\s+/g, " ");
}

// "5h 38m"
function hoursMins(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// Sunrise, sunset and the highest point for the Saskatoon day that
// contains "date". Scans the day a minute at a time (1440 cheap sums),
// which is simpler and sturdier than the closed-form version.
const dayCache = {};
function sunDay(date) {
  const p = localParts(date);
  const key = `${p.y}-${p.m}-${p.d}`;
  if (dayCache[key]) return dayCache[key];

  const start = Date.UTC(p.y, p.m - 1, p.d, 6, 0, 0); // local midnight = 06:00 UTC (UTC-6)
  let rise = null, set = null, peakAlt = -90, peakAt = start, prev = sunAltitude(new Date(start));
  for (let i = 1; i <= 1440; i++) {
    const t = start + i * 60000;
    const alt = sunAltitude(new Date(t));
    if (prev < SUNRISE_ALT && alt >= SUNRISE_ALT && rise === null) rise = t;
    if (prev >= SUNRISE_ALT && alt < SUNRISE_ALT && rise !== null && set === null) set = t;
    if (alt > peakAlt) { peakAlt = alt; peakAt = t; }
    prev = alt;
  }
  const info = { start, end: start + 86400000, rise, set, peakAlt, peakAt };
  dayCache[key] = info;
  return info;
}

// Lets you preview a time of day: ?at=noon, ?at=sunset, ?at=night,
// ?at=sunrise, or ?at=2026-06-21T22:30 (Saskatoon time).
function previewClock() {
  const at = new URLSearchParams(location.search).get("at");
  if (!at) return () => new Date();
  const today = sunDay(new Date());
  let fixed;
  if (at === "noon") fixed = today.peakAt;
  else if (at === "sunset") fixed = (today.set || today.start) - 4 * 60000;
  else if (at === "sunrise") fixed = (today.rise || today.start) + 4 * 60000;
  else if (at === "night") fixed = today.start + 23 * 3600000;
  else if (at === "dusk") fixed = (today.set || today.start) + 25 * 60000;
  else {
    const parsed = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(at) ? at : at + "-06:00");
    fixed = Number.isNaN(parsed) ? Date.now() : parsed;
  }
  const offset = fixed - Date.now();
  return () => new Date(Date.now() + offset);
}

const now = previewClock();

/* ---------- Theme ----------
   "auto" follows the sun. The ☀/☾ button cycles auto → light → dark and
   remembers the choice on this phone. */
const THEME_KEY = "kelbo.theme";

function themeChoice() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch (e) {
    return "auto";
  }
}

function applyTheme(isDay) {
  const choice = themeChoice();
  const theme = choice === "auto" ? (isDay ? "light" : "dark") : choice;
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#141413" : "#7B3FC4";
  return theme;
}

const THEME_ICONS = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 14a6 6 0 0 1 12 0"/><path d="M3 14h18"/><path d="M12 3v2M5.6 6.6l1.4 1.4M18.4 6.6 17 8"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};
const THEME_LABELS = { auto: "Theme: follows the sun", light: "Theme: light", dark: "Theme: dark" };

function setUpThemeToggle(refresh) {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;
  const paint = () => {
    const c = themeChoice();
    btn.innerHTML = THEME_ICONS[c];
    btn.setAttribute("aria-label", THEME_LABELS[c]);
    btn.title = THEME_LABELS[c];
  };
  btn.addEventListener("click", () => {
    const next = { auto: "light", light: "dark", dark: "auto" }[themeChoice()];
    try {
      if (next === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
    paint();
    refresh();
  });
  paint();
}

/* ---------- Moving the sun ---------- */

// Puts the sun (and its ray) where the real sun is at moment "t", and
// the moon in the night sky.
function placeSun(scene, t) {
  const alt = sunAltitude(t);
  const day = sunDay(t);
  const season = seasonOf(day);
  // Where the sun is in its day, left to right. Between sunrise and
  // sunset it crosses from 6% to 70% of the width; through the night
  // it drifts back under the ground, ready to rise again.
  let x;
  if (day.rise && day.set && t >= day.rise && t <= day.set) {
    x = 0.06 + 0.64 * ((t - day.rise) / (day.set - day.rise));
  } else if (day.set && t > day.set) {
    const nightLen = day.end + 7 * 3600000 - day.set; // roughly until tomorrow's sunrise
    x = 0.70 - 0.64 * Math.min(1, (t - day.set) / nightLen);
  } else {
    x = 0.06;
  }
  // Height, as a share of today's highest point. Negative = set.
  let y = 0.92 * (alt / Math.max(10, day.peakAlt)); // 0.92 keeps the noon sun off the top edge
  if (alt < 0) y = Math.max(-1, alt / 10);
  scene.style.setProperty("--sun-x", x.toFixed(3));
  scene.style.setProperty("--sun-alt", Math.min(1, y).toFixed(3));
  // The ray follows the sun's height, and reaches further in summer:
  // full length on the longest day, a bit under half on the shortest.
  const reach = 0.45 + 0.55 * season;
  scene.style.setProperty("--ray", (Math.max(0, Math.min(1, y)) * reach).toFixed(3));
  // --sun-low: 0 when the sun is high, 1 near the horizon. style.css
  // makes the glow bigger and warmer as it climbs to 1.
  const low = 1 - Math.min(1, Math.max(0, y) / 0.6);
  scene.style.setProperty("--sun-low", low.toFixed(3));
  // --sun-show fades the glow and halo out as the sun sinks out of sight.
  scene.style.setProperty("--sun-show", Math.max(0, Math.min(1, (y + 0.6) * 3)).toFixed(3));
  // The light on the ground fades in as the sun clears the horizon,
  // strongest when the sun is low.
  scene.style.setProperty("--glint-sun", (glint(y) * (0.55 + 0.45 * low)).toFixed(3));
  placeMoon(scene, t);
  placeStars(scene, t);
}

/* ---------- The stars ----------
   The real night sky over Saskatoon: the brightest named stars, each
   placed where it really is right now. The horizon faces south, so east
   is on the left edge, south in the middle and west on the right edge,
   and the higher a star is, the higher it sits in the sky strip. They
   turn slowly across the sky through the night (and race round during
   the opening spin). Each row is [right ascension, declination,
   brightness, name]: where the star sits on the sky's own map (degrees)
   and how bright it is (smaller = brighter, under 1 is very bright).
   Stars that never rise over Saskatoon are left out. */
const STARS = [
  [101.29, -16.72, -1.4, "Sirius"], [213.92, 19.18, -0.1, "Arcturus"], [279.23, 38.78, 0.0, "Vega"],
  [79.17, 46.0, 0.1, "Capella"], [78.63, -8.2, 0.2, "Rigel"], [114.83, 5.22, 0.4, "Procyon"],
  [88.79, 7.41, 0.5, "Betelgeuse"], [297.7, 8.87, 0.8, "Altair"], [68.98, 16.51, 0.9, "Aldebaran"],
  [201.3, -11.16, 1.0, "Spica"], [247.35, -26.43, 1.1, "Antares"], [310.36, 45.28, 1.2, "Deneb"],
  [344.41, -29.62, 1.2, "Fomalhaut"], [344.41, -29.62, 1.2, "Formalhaut"], [116.33, 28.03, 1.2, "Pollux"],
  [152.09, 11.97, 1.4, "Regulus"], [104.66, -28.97, 1.5, "Adara"], [104.66, -28.97, 1.5, "Adhara"],
  [81.28, 6.35, 1.6, "Bellatrix"], [113.65, 31.89, 1.6, "Castor"], [81.57, 28.61, 1.6, "Elnath"],
  [263.4, -37.1, 1.6, "Shaula"], [84.05, -1.2, 1.7, "Alnilam"], [85.19, -1.94, 1.7, "Alnitak"],
  [193.51, 55.96, 1.8, "Alioth"], [165.93, 61.75, 1.8, "Dubhe"], [276.04, -34.38, 1.8, "Kaus Australis"],
  [51.08, 49.86, 1.8, "Mirfak"], [107.1, -26.39, 1.8, "Wezen"], [206.89, 49.31, 1.9, "Alcaid"],
  [99.43, 16.4, 1.9, "Alhena"], [206.89, 49.31, 1.9, "Alkaid"], [89.88, 44.95, 1.9, "Menkalinan"],
  [154.99, 19.84, 2.0, "Algieba"], [141.9, -8.66, 2.0, "Alphard"], [10.9, -17.99, 2.0, "Diphda"],
  [31.79, 23.46, 2.0, "Hamal"], [95.67, -17.96, 2.0, "Mirzam"], [283.82, -26.3, 2.0, "Nunki"],
  [37.95, 89.26, 2.0, "Polaris"], [47.04, 40.96, 2.1, "Algol"], [30.97, 42.33, 2.1, "Almach"],
  [2.1, 29.09, 2.1, "Alpheratz"], [177.26, 14.57, 2.1, "Denebola"], [222.68, 74.16, 2.1, "Kochab"],
  [211.67, -36.37, 2.1, "Menkent"], [17.43, 35.62, 2.1, "Mirach"], [263.73, 12.56, 2.1, "Rasalhague"],
  [86.94, -9.67, 2.1, "Saiph"], [2.1, 29.09, 2.1, "Sirrah"], [233.67, 26.71, 2.2, "Alphecca"],
  [269.15, 51.49, 2.2, "Eltanin"], [269.15, 51.49, 2.2, "Etamin"], [83.0, -0.3, 2.2, "Mintaka"],
  [200.98, 54.93, 2.2, "Mizar"], [305.56, 40.26, 2.2, "Sadr"], [10.13, 56.54, 2.2, "Schedar"],
  [2.29, 59.15, 2.3, "Caph"], [165.46, 56.38, 2.3, "Merak"], [326.05, 9.88, 2.4, "Enif"],
  [221.25, 27.07, 2.4, "Izar"], [178.46, 53.69, 2.4, "Phecda"], [257.59, -15.72, 2.4, "Sabik"],
  [345.94, 28.08, 2.4, "Scheat"], [319.64, 62.59, 2.5, "Alderamin"], [346.19, 15.21, 2.5, "Markab"],
  [45.57, 4.09, 2.5, "Menkar"], [83.18, -17.82, 2.6, "Arneb"], [183.95, -17.54, 2.6, "Gienah Corvi"],
  [183.95, -17.54, 2.6, "Gienah"], [236.07, 6.43, 2.6, "Unukalhai"], [296.56, 10.61, 2.7, "Tarazed"],
  [3.31, 15.18, 2.8, "Algenib"], [265.87, 4.57, 2.8, "Cebalrai"], [82.06, -20.76, 2.8, "Nihal"],
  [258.66, 14.39, 2.8, "Rasalgethi"], [222.72, -16.04, 2.8, "Zubenelgenubi"], [56.87, 24.11, 2.9, "Alcyone"],
  [195.54, 10.96, 2.9, "Vindemiatrix"], [292.68, 27.96, 3.0, "Albereo"], [292.68, 27.96, 3.0, "Albireo"],
  [182.53, -22.62, 3.0, "Minkar"], [331.45, -0.32, 3.0, "Sadalmelik"], [59.51, -13.51, 3.0, "Zaurak"],
  [322.16, 70.56, 3.2, "Alfirk"], [284.74, 32.69, 3.2, "Sulafat"], [183.86, 57.03, 3.3, "Megrez"],
  [282.52, 33.36, 3.5, "Sheliak"], [57.29, 24.05, 3.6, "Atlas"], [298.83, 6.41, 3.7, "Alshain"],
  [56.22, 24.11, 3.7, "Electra"], [211.1, 64.38, 3.7, "Thuban"], [56.46, 24.37, 3.9, "Maia"],
  [201.31, 54.99, 4.0, "Alcor"], [56.58, 23.95, 4.1, "Merope"], [56.3, 24.47, 4.3, "Taygeta"],
];
const STAR_TOP_ALT = 80; // a star this high (degrees) touches the top of the strip

// Faint lines joining the stars of well-known constellations, as pairs of
// names from STARS. A line only shows while both its stars are up in the
// southern sky. Only the big home-page sky gets them.
const CONSTELLATION_LINES = [
  // Orion: shoulders, belt, knees
  ["Betelgeuse", "Bellatrix"], ["Betelgeuse", "Alnitak"], ["Bellatrix", "Mintaka"],
  ["Mintaka", "Alnilam"], ["Alnilam", "Alnitak"], ["Alnitak", "Saiph"], ["Mintaka", "Rigel"],
  // Canis Major, the big dog with Sirius
  ["Mirzam", "Sirius"], ["Sirius", "Wezen"], ["Wezen", "Adhara"],
  // Gemini, the twins
  ["Castor", "Pollux"], ["Pollux", "Alhena"],
  // Taurus, the bull's horn
  ["Aldebaran", "Elnath"],
  // Leo, the lion
  ["Regulus", "Algieba"], ["Algieba", "Denebola"], ["Denebola", "Regulus"],
  // The Summer Triangle
  ["Vega", "Deneb"], ["Deneb", "Altair"], ["Altair", "Vega"],
  // Cygnus, the swan's neck
  ["Deneb", "Sadr"], ["Sadr", "Albireo"],
  // Aquila, the eagle
  ["Tarazed", "Altair"], ["Altair", "Alshain"],
  // The Great Square of Pegasus, and Andromeda off its corner
  ["Alpheratz", "Scheat"], ["Scheat", "Markab"], ["Markab", "Algenib"], ["Algenib", "Alpheratz"],
  ["Alpheratz", "Mirach"], ["Mirach", "Almach"],
];

/* ---------- The planets ----------
   Mercury, Venus, Mars, Jupiter and Saturn, worked out from their orbits
   (NASA JPL's simple orbit numbers, good to about a tenth of a degree
   between 1800 and 2050). Each planet's spot on the sky's map changes
   night to night as it and the Earth go round the sun, then it's placed
   just like a star. Planets shine steadily, so they don't twinkle.
   Each "orbit" is [a, e, tilt, L, perihelion, node], each as a pair
   (value in 2000, change per century): size, stretch and tilt of the
   orbit, where the planet is along it, and which way it points. */
const PLANETS = [
  { name: "Mercury", size: "4px", orbit: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081] },
  { name: "Venus", size: "7px", orbit: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418] },
  { name: "Mars", size: "5px", orbit: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343] },
  { name: "Jupiter", size: "6.5px", orbit: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106] },
  { name: "Saturn", size: "5px", orbit: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794] },
];
const EARTH_ORBIT = [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0];

// Where a planet is around the sun at T (centuries since 2000), as x/y/z
// in AU (x/y = the plane of the Earth's orbit).
function orbitXYZ(orbit, T) {
  const [a0, a1, e0, e1, i0, i1, L0, L1, p0, p1, o0, o1] = orbit;
  const a = a0 + a1 * T, e = e0 + e1 * T, tilt = (i0 + i1 * T) * D2R;
  const L = L0 + L1 * T, peri = p0 + p1 * T, node = (o0 + o1 * T) * D2R;
  const w = peri * D2R - node;
  const M = (((((L - peri) % 360) + 540) % 360) - 180) * D2R; // how far round since its closest point
  // Kepler's equation, solved by a few rounds of guessing better
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 5; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(node), sn = Math.sin(node);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  return [
    (cw * cn - sw * sn * ct) * xp + (-sw * cn - cw * sn * ct) * yp,
    (cw * sn + sw * cn * ct) * xp + (-sw * sn + cw * cn * ct) * yp,
    sw * st * xp + cw * st * yp,
  ];
}

// A planet's spot on the sky's map (right ascension, declination, in
// degrees) as seen from Earth at a moment in time.
function planetRaDec(orbit, date) {
  const T = (date.getTime() / 86400000 - 10957.5) / 36525;
  const p = orbitXYZ(orbit, T), earth = orbitXYZ(EARTH_ORBIT, T);
  const x = p[0] - earth[0], y = p[1] - earth[1], z = p[2] - earth[2];
  const tilt = 23.43928 * D2R; // the Earth's tilt
  const ye = y * Math.cos(tilt) - z * Math.sin(tilt), ze = y * Math.sin(tilt) + z * Math.cos(tilt);
  return [Math.atan2(ye, x) * R2D, Math.atan2(ze, Math.hypot(x, ye)) * R2D];
}

// The star dots, sized by brightness. The short page-head skies only get
// the brighter ones so they don't look crowded, and no constellation lines.
function makeStars(box, limit, withLines) {
  box.stars = STARS.filter((s) => s[2] <= limit).map((s) => {
    const dot = document.createElement("i");
    const mag = s[2];
    dot.style.setProperty("--s", mag < 0.5 ? "6px" : mag < 1.5 ? "4.5px" : mag < 2.5 ? "3.4px" : "2.4px");
    if (mag < 1.5) dot.className = "star--bright";
    return { star: s, dot };
  });
  // Planets go on top of the stars, steady and a bit bigger, with their
  // name beside them on the big home sky.
  box.planets = PLANETS.map((planet) => {
    const dot = document.createElement("b");
    dot.className = `planet planet--${planet.name.toLowerCase()}`;
    dot.style.setProperty("--s", planet.size);
    if (withLines) {
      const label = document.createElement("span");
      label.textContent = planet.name;
      dot.append(label);
    }
    return { planet, dot };
  });
  box.lines = [];
  const parts = [...box.stars.map((s) => s.dot), ...box.planets.map((p) => p.dot)];
  if (withLines) {
    // One SVG behind the dots, stretched over the sky so its 0..100
    // units match the dots' left/top percentages.
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "horizon__lines");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    const byName = new Map(box.stars.map((s) => [s.star[3], s]));
    for (const [a, b] of CONSTELLATION_LINES) {
      const line = document.createElementNS(svgNS, "line");
      svg.append(line);
      box.lines.push({ a: byName.get(a), b: byName.get(b), line });
    }
    parts.unshift(svg);
  }
  box.replaceChildren(...parts);
}

// Puts every star where it really is at moment "t".
function placeStars(scene, t) {
  const box = scene.querySelector(".horizon__stars");
  if (!box) return;
  if (!box.stars) {
    const small = scene.closest(".page-head");
    makeStars(box, small ? 2 : 4.5, !small);
  }
  const n = t.getTime() / 86400000 - 10957.5;
  const lst = ((18.697374558 + 24.06570982441908 * n) * 15 + YXE.lon) * D2R; // which way the sky faces now
  const la = YXE.lat * D2R;
  // Puts one dot at the spot ra/dec (degrees) on the sky's map, or hides it.
  const place = (entry, raDeg, decDeg) => {
    const ra = raDeg * D2R, dec = decDeg * D2R, ha = lst - ra;
    const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) * R2D;
    // Compass direction: 90 = east, 180 = south, 270 = west
    let az = Math.atan2(-Math.sin(ha) * Math.cos(dec), Math.cos(la) * Math.sin(dec) - Math.sin(la) * Math.cos(dec) * Math.cos(ha)) * R2D;
    az = (az + 360) % 360;
    entry.up = !(alt < 2 || az < 90 || az > 270);
    entry.dot.hidden = !entry.up; // below the horizon, or behind us in the north
    if (!entry.up) return;
    entry.x = ((az - 90) / 180) * 100;
    entry.y = (1 - Math.min(alt, STAR_TOP_ALT) / STAR_TOP_ALT) * 100;
    entry.dot.style.left = `${entry.x.toFixed(2)}%`;
    entry.dot.style.top = `${entry.y.toFixed(2)}%`;
  };
  for (const entry of box.stars) place(entry, entry.star[0], entry.star[1]);
  for (const entry of box.planets) {
    place(entry, ...planetRaDec(entry.planet.orbit, t));
    entry.dot.classList.toggle("planet--flip", entry.x > 85); // name on the left near the right edge
  }
  for (const { a, b, line } of box.lines) {
    const show = a && b && a.up && b.up;
    line.style.display = show ? "" : "none";
    if (!show) continue;
    line.setAttribute("x1", a.x.toFixed(2));
    line.setAttribute("y1", a.y.toFixed(2));
    line.setAttribute("x2", b.x.toFixed(2));
    line.setAttribute("y2", b.y.toFixed(2));
  }
}

/* ---------- The moon ----------
   The real moon over Saskatoon, worked out from the date like the sun (no
   internet): its phase (the shape) and its height in the sky. Like the
   real moon it rises on the left, crosses, and sets on the right on its
   own schedule, so some days it's up in the daytime sky and some nights
   it isn't up at all. */
const MOONRISE_ALT = -0.833; // its top edge touches the horizon (close enough, same as the sun)

// Where the moon is in its month: 0 = new, 0.25 = first quarter (right
// half lit), 0.5 = full, 0.75 = last quarter (left half lit). It's the
// angle between the moon and the sun as seen from Earth, from short
// formulas that are good to a few hours.
function moonPhase(date) {
  const n = date.getTime() / 86400000 - 10957.5; // days since 1 Jan 2000, noon UTC
  const Mm = (134.963 + 13.064993 * n) * D2R; // the moon's mean anomaly
  const moonLon = 218.316 + 13.176396 * n + 6.289 * Math.sin(Mm);
  const g = (357.529 + 0.98560028 * n) * D2R;
  const sunLon = 280.459 + 0.98564736 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return ((((moonLon - sunLon) % 360) + 360) % 360) / 360;
}

// How much of the moon is lit, 0 (new) to 1 (full).
function moonLit(phase) {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

// "Waxing crescent", "Full", ... for the readout under the horizon.
const MOON_NAMES = ["New", "Waxing crescent", "First quarter", "Waxing gibbous", "Full", "Waning gibbous", "Last quarter", "Waning crescent"];
function moonName(phase) {
  return MOON_NAMES[Math.round(phase * 8) % 8];
}

// The lit part of the moon as an SVG path, on a circle of radius 1. It
// runs down the lit edge of the disc, then back up the line between
// light and dark (an ellipse that's thin near the quarters).
// Waxing moons are lit on the right, waning on the left (as seen from
// Saskatoon, and anywhere north of the tropics).
function moonPath(phase) {
  const waxing = phase < 0.5;
  const lit = moonLit(phase);
  const rx = Math.abs(1 - 2 * lit).toFixed(3); // how wide the light/dark line bows
  const outer = waxing ? 1 : 0; // down the right side, or the left
  const bowsRight = lit < 0.5 ? waxing : !waxing; // a crescent bows toward its lit side
  const inner = bowsRight ? 0 : 1;
  return `M0 -1A1 1 0 0 ${outer} 0 1A${rx} 1 0 0 ${inner} 0 -1Z`;
}

// Height of the moon above the horizon, in degrees, as seen from
// Saskatoon. Short formulas for where the moon is against the stars
// (good to a fraction of a degree), then the same sky maths as the sun.
function moonAltitude(date) {
  const n = date.getTime() / 86400000 - 10957.5; // days since 1 Jan 2000, noon UTC
  const L = 218.316 + 13.176396 * n; // mean longitude
  const M = (134.963 + 13.064993 * n) * D2R; // mean anomaly
  const F = (93.272 + 13.22935 * n) * D2R; // distance from its node
  const Dm = (297.85 + 12.190749 * n) * D2R; // distance from the sun
  const Ms = (357.529 + 0.98560028 * n) * D2R; // the sun's mean anomaly
  const lon = (L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * Dm - M) + 0.658 * Math.sin(2 * Dm)
    + 0.214 * Math.sin(2 * M) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F)) * D2R;
  const lat = (5.128 * Math.sin(F) + 0.281 * Math.sin(M + F) + 0.278 * Math.sin(M - F)
    + 0.173 * Math.sin(2 * Dm - F)) * D2R;
  const e = (23.439 - 0.00000036 * n) * D2R; // tilt of the Earth
  const ra = Math.atan2(Math.sin(lon) * Math.cos(e) - Math.tan(lat) * Math.sin(e), Math.cos(lon));
  const dec = Math.asin(Math.sin(lat) * Math.cos(e) + Math.cos(lat) * Math.sin(e) * Math.sin(lon));
  const gmst = 18.697374558 + 24.06570982441908 * n; // sidereal time, hours
  const ha = (gmst * 15 + YXE.lon) * D2R - ra;
  const la = YXE.lat * D2R;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) * R2D;
  return alt - 0.95 * Math.cos(alt * D2R); // the moon is close, so it sits a bit lower from the ground
}

// The moon's current stretch above (or below) the horizon: when it last
// crossed the horizon (prev), when it next will (next), whether it's up,
// and how high it gets this time. Found by stepping 10 minutes at a time
// and narrowing to the minute. Kept until "t" leaves the stretch.
let moonSpan = null;
function moonSpanAt(t) {
  const ms = t.getTime();
  if (moonSpan && ms >= moonSpan.prev && ms < moonSpan.next) return moonSpan;
  const STEP = 10 * 60000, LIMIT = 30 * 3600000;
  const isUp = (when) => moonAltitude(new Date(when)) >= MOONRISE_ALT;
  const up = isUp(ms);
  // dir -1 looks back, +1 looks ahead
  function crossing(dir) {
    let same = ms;
    for (let k = STEP; k <= LIMIT; k += STEP) {
      const other = ms + dir * k;
      if (isUp(other) !== up) {
        let a = same, b = other; // narrow it down to the minute
        while (Math.abs(b - a) > 60000) {
          const mid = (a + b) / 2;
          if (isUp(mid) === up) a = mid; else b = mid;
        }
        return b;
      }
      same = other;
    }
    return ms + dir * LIMIT;
  }
  const prev = crossing(-1);
  const next = crossing(1);
  let peak = 0;
  if (up) {
    for (let s2 = prev; s2 <= next; s2 += STEP) peak = Math.max(peak, moonAltitude(new Date(s2)));
  }
  moonSpan = { prev, next, up, peak };
  return moonSpan;
}

// Draws the phase into the moon (only when the shape has changed).
function drawMoon(scene, phase) {
  const moon = scene.querySelector(".horizon__moon");
  if (!moon) return;
  const d = moonPath(phase);
  if (moon.dataset.path === d) return;
  moon.dataset.path = d;
  moon.innerHTML = `<svg viewBox="-1 -1 2 2" aria-hidden="true"><circle class="moon__dark" r="1"/><path class="moon__lit" d="${d}"/></svg>`;
}

// Puts the moon where the real moon is at moment "t", the same way as the
// sun: left to right across its time above the horizon, and as high as
// it is compared with its highest point this time round. Below the
// horizon it drifts back under the ground, ready to rise again.
function placeMoon(scene, t) {
  const phase = moonPhase(t);
  drawMoon(scene, phase);
  const span = moonSpanAt(t);
  const alt = moonAltitude(t);
  const f = Math.min(1, Math.max(0, (t - span.prev) / (span.next - span.prev)));
  const x = span.up ? 0.06 + 0.64 * f : 0.70 - 0.64 * f;
  let y = 0.92 * (alt / Math.max(10, span.peak));
  if (alt < 0) y = Math.max(-1, alt / 10);
  // "night" runs 0 by day to 1 at night: the moon comes into its own as
  // the sun gets low (from 6 degrees up) and is fully out once the sun
  // is 2 degrees under, then the same in reverse at dawn. So the two
  // share the sky for a little while around sunset and sunrise.
  const night = Math.max(0, Math.min(1, (6 - sunAltitude(t)) / 8));
  // By day the moon is still there when it's up, like the real one, just
  // pale and faint against the bright sky. A thin crescent near the sun
  // all but disappears; from about half lit it's as clear as it gets.
  const day = 0.32 * Math.max(0, Math.min(1, (moonLit(phase) - 0.04) / 0.3));
  const show = day + (1 - day) * night;
  scene.style.setProperty("--moon-x", x.toFixed(3));
  scene.style.setProperty("--moon-alt", Math.min(1, y).toFixed(3));
  scene.style.setProperty("--moon-show", show.toFixed(3));
  scene.style.setProperty("--moon-day", (1 - night).toFixed(3)); // style.css: paler, no glow
  scene.style.setProperty("--glint-moon", (glint(y) * 0.6 * night).toFixed(3));
}

// How strong the light on the ground is for a sun or moon at height y:
// 0 once it has sunk below the horizon, full just above it.
function glint(y) {
  return Math.max(0, Math.min(1, (y + 0.15) * 6));
}

/* ---------- The opening spin ----------
   When someone opens the site or refreshes, the sun runs through a whole
   day in a few seconds (rise, cross the sky, set, slip back under the
   ground) and lands where the real sun is right now. It plays on the
   first page of a visit and on every refresh, not on every link tapped.
   Skipped when "reduce motion" is on. */
const SPIN_MS = 4500; // how long the whole day takes to play
const SPIN_KEY = "kelbo.sunSpun"; // set once the spin has played this visit
let spinning = false; // true while the spin or a swipe is moving the sun instead of the clock
let skyRun = 0; // bumped whenever a new spin or swipe takes over, so the old one stops
let swiping = false; // true from the start of a swipe until the sky is back at "now"

function shouldSpin() {
  if (REDUCE_MOTION) return false;
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    const refreshed = nav && nav.type === "reload";
    const seen = sessionStorage.getItem(SPIN_KEY);
    sessionStorage.setItem(SPIN_KEY, "1");
    return refreshed || !seen;
  } catch (e) {
    return true; // storage blocked: just play it
  }
}

function spinSun(scene) {
  spinning = true;
  scene.classList.add("horizon--spin"); // turns off the slow CSS easing while it plays
  const run = ++skyRun;
  const start = performance.now();
  function frame(ms) {
    if (run !== skyRun) return; // a swipe took over
    const p = Math.min(1, (ms - start) / SPIN_MS);
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // gentle start and finish
    // Play back the last 24 hours, so it starts and ends at "now".
    placeSun(scene, new Date(now().getTime() - 86400000 * (1 - eased)));
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      spinning = false;
      scene.classList.remove("horizon--spin");
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- Swiping through time ----------
   On a phone, sliding a finger left or right along the horizon winds the
   sky backward or forward: the sun, moon, stars and planets all move to
   where they'd be at that time, and the page goes dark after sunset like
   it really would. The readout shows the time you're looking at. Let go
   and it all slides back to right now. Only touch, so a mouse can still
   select text; up-and-down swipes still scroll the page. */
const SWIPE_HOURS = 16; // hours per full width: about how fast the sun crosses
const SWIPE_MAX_HOURS = 36; // how far either way a swipe can go
const SWIPE_START_PX = 10; // sideways movement before it counts as a swipe
const SWIPE_BACK_MS = 900; // how long the slide back to "now" takes

function setUpSwipe(scene, paint) {
  let shown = 0; // how far from now the sky is showing, in ms
  let drag = null; // { id, x, y, from, live } while a finger is down
  let queued = false;

  // Draw at most once a frame, however fast the finger moves.
  function draw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint(new Date(now().getTime() + shown), shown);
    });
  }

  function slideBack() {
    const run = ++skyRun;
    const from = shown;
    const start = performance.now();
    function frame(ms) {
      if (run !== skyRun) return; // a new swipe took over
      const p = REDUCE_MOTION ? 1 : Math.min(1, (ms - start) / SWIPE_BACK_MS);
      shown = from * Math.pow(1 - p, 3); // fast at first, easing into place
      if (p < 1) {
        paint(new Date(now().getTime() + shown), shown);
        requestAnimationFrame(frame);
      } else {
        shown = 0;
        swiping = spinning = false;
        scene.classList.remove("horizon--spin");
        paint(now(), null);
      }
    }
    requestAnimationFrame(frame);
  }

  scene.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: shown, live: false };
  });

  scene.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.live) {
      if (Math.abs(dy) > SWIPE_START_PX && Math.abs(dy) > Math.abs(dx)) {
        drag = null; // scrolling the page, not swiping
        return;
      }
      if (Math.abs(dx) < SWIPE_START_PX) return;
      // It's a swipe: stop the opening spin or slide back, and take over.
      drag.live = true;
      drag.x = e.clientX;
      ++skyRun;
      swiping = spinning = true;
      scene.classList.add("horizon--spin");
      try {
        scene.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    // Finger right = later in the day, the way the sun travels.
    const width = scene.clientWidth || 1;
    const max = SWIPE_MAX_HOURS * 3600000;
    const ms = drag.from + ((e.clientX - drag.x) / width) * SWIPE_HOURS * 3600000;
    shown = Math.max(-max, Math.min(max, ms));
    draw();
  });

  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasLive = drag.live;
    drag = null;
    if (wasLive) slideBack();
  }
  scene.addEventListener("pointerup", end);
  scene.addEventListener("pointercancel", end);
}

// While swiping: "Tomorrow 2:15 AM" and how far from now that is.
function swipeLine(t, ahead) {
  const a = localParts(t);
  const b = localParts(now());
  const days = Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
  const word = { "-1": "Yesterday", 0: "Today", 1: "Tomorrow" }[days] || a.weekday;
  return [`${word} ${clock(t)}`, `${ahead < 0 ? "−" : "+"}${hoursMins(Math.abs(ahead))} · let go to return`];
}

// The night readout: "Waxing crescent moon over Saskatoon" while the
// moon is up, or when it rises if it's down.
function moonLine(t) {
  const name = moonName(moonPhase(t));
  const span = moonSpanAt(t);
  return span.up ? `${name} moon over Saskatoon` : `${name} moon rises ${clock(new Date(span.next))}`;
}

function setUpHorizon() {
  const scene = document.querySelector("[data-horizon]");
  const readout = document.querySelector("[data-horizon-readout]");
  const badge = document.querySelector("[data-horizon-badge]");

  // Draws the sky, theme and readout for moment "t". "ahead" is how far
  // a swipe has moved it from now in ms, or null when it's live.
  function paint(t, ahead) {
    const swiped = ahead != null;
    const alt = sunAltitude(t);
    const day = sunDay(t);
    const isDay = alt >= SUNRISE_ALT;
    const season = seasonOf(day);
    applyTheme(isDay);
    document.documentElement.style.setProperty("--season", season.toFixed(3));

    // The badge for the longest and shortest days of the year.
    if (badge) {
      const which = solsticeToday(t);
      if (which && day.rise && day.set) {
        // The daylight part is a separate span so phones can hide it
        // (see .horizon__badge-extra in style.css).
        badge.replaceChildren(
          `${which === "longest" ? "Longest" : "Shortest"} day of the year`,
          el("span", "horizon__badge-extra", ` · ${hoursMins(day.set - day.rise)} of light`)
        );
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    // Twilight warming: over the last 20 minutes before sunset, --warm
    // climbs from 0 to 1 and style.css blends the sky toward clay.
    const toSet = day.set ? day.set - t : Infinity;
    const warm = isDay && toSet > 0 && toSet < TWILIGHT_MS ? 1 - toSet / TWILIGHT_MS : 0;
    document.documentElement.style.setProperty("--warm", warm.toFixed(3));

    // While the opening spin is playing, it moves the sun instead.
    if (scene && (!spinning || swiped)) placeSun(scene, t);

    if (readout) {
      const left = readout.children[0];
      const right = readout.children[1];
      if (swiped) {
        [left.textContent, right.textContent] = swipeLine(t, ahead);
      } else if (isDay && day.set) {
        left.textContent = "Sun's up over Saskatoon";
        right.textContent = `Sets ${clock(new Date(day.set))} · ${hoursMins(day.set - t)} of light left`;
      } else if (!isDay && day.rise && t < day.rise) {
        // Night: tonight's moon, and when the sun comes back
        left.textContent = moonLine(t);
        right.textContent = `Sun's up at ${clock(new Date(day.rise))}`;
      } else {
        // After sunset: tomorrow's sunrise
        const tomorrow = sunDay(new Date(day.end + 60000));
        left.textContent = moonLine(t);
        right.textContent = tomorrow.rise ? `Sun's back at ${clock(new Date(tomorrow.rise))}` : "Sun's back tomorrow";
      }
    }
  }

  // The once-a-minute update; a swipe in progress keeps the sky instead.
  function tick() {
    if (!swiping) paint(now(), null);
  }

  if (scene && shouldSpin()) spinSun(scene);
  if (scene) setUpSwipe(scene, paint);
  tick();
  setUpThemeToggle(tick);
  setInterval(tick, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
}

/* ======================================================================
   MEMORY CARD ("Continue?")
   ----------------------------------------------------------------------
   When you tap Play on a game, the phone remembers which one. Next time
   you open the home page it offers to pick up where you left off.
   Everything stays in the browser; nothing is sent anywhere.
   ====================================================================== */
const LAST_KEY = "kelbo.lastPlayed";
const VISITS_KEY = "kelbo.visits";

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch (e) {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function agoText(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return "a while ago";
}

function rememberPlays() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.button--play");
    if (!link) return;
    const card = link.closest(".project");
    const titleEl = card && card.querySelector(".project__title");
    const img = card && card.querySelector(".project__cover img");
    const previous = readJSON(LAST_KEY);
    writeJSON(LAST_KEY, {
      title: titleEl ? titleEl.textContent : (link.dataset.title || (previous && previous.title) || "a game"),
      link: link.href,
      image: img ? img.getAttribute("src") : (link.dataset.image || (previous && previous.image) || ""),
      at: Date.now(),
    });
  });
}

function setUpContinue() {
  const box = document.querySelector("[data-continue]");
  if (!box) return;

  // Count visits (once per browser session, so reloads don't count).
  let visits = Number(readJSON(VISITS_KEY)) || 0;
  try {
    if (!sessionStorage.getItem("kelbo.counted")) {
      visits += 1;
      writeJSON(VISITS_KEY, visits);
      sessionStorage.setItem("kelbo.counted", "1");
    }
  } catch (e) {}

  const last = readJSON(LAST_KEY);
  if (!last || !last.link) return;

  box.querySelector("[data-continue-title]").textContent = last.title;
  box.querySelector("[data-continue-when]").textContent = `Last played ${agoText(Date.now() - last.at)}`;
  box.querySelector("[data-continue-visit]").textContent = visits > 1 ? `· visit #${visits}` : "";
  const cover = box.querySelector("[data-continue-cover]");
  if (last.image) cover.src = last.image;
  else cover.remove();
  const link = box.querySelector("[data-continue-link]");
  link.href = last.link;
  link.dataset.title = last.title;
  link.dataset.image = last.image || "";
  link.setAttribute("aria-label", "Continue " + last.title);
  box.querySelector("[data-continue-clear]").addEventListener("click", () => {
    writeJSON(LAST_KEY, null);
    box.hidden = true;
    box.classList.remove("is-on");
  });
  box.hidden = false;
  box.classList.add("is-on");
}

/* ---------- "Now building" strip ----------
   What's on the bench this week, from now.json: a short list of items
   (each can have a "link") and an "updated" date. The strip stays hidden
   if the file is missing or has no items. */
function daysAgoText(ms) {
  const days = Math.round(ms / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return "a while ago";
}

async function setUpNow() {
  const box = document.querySelector("[data-now]");
  if (!box) return;
  let data;
  try {
    const response = await fetch("now.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    data = await response.json();
  } catch (err) {
    // Most likely a typo in now.json. The strip just stays hidden.
    console.error("Couldn't load now.json:", err);
    return;
  }
  const items = Array.isArray(data.items) ? data.items.filter((it) => it && it.text) : [];
  if (items.length === 0) return;

  const list = box.querySelector("[data-now-list]");
  items.forEach((it) => {
    const item = el("li", "now__item");
    if (it.link) {
      const link = el("a", null, it.text);
      link.href = it.link;
      item.append(link);
    } else {
      item.textContent = it.text;
    }
    list.append(item);
  });

  // "Updated 3 days ago". The date in now.json is a plain "2026-10-15",
  // read as midday in Saskatoon so it never lands on the wrong day.
  const updated = box.querySelector("[data-now-updated]");
  const when = Date.parse(String(data.updated || "") + "T12:00:00-06:00");
  if (updated && !Number.isNaN(when)) updated.textContent = "Updated " + daysAgoText(Date.now() - when);

  box.hidden = false;
  reveal(box);
}

/* ---------- Market light on the Trading tile ----------
   NYSE hours: 9:30 to 4:00 New York time, Monday to Friday. (Holidays
   aren't checked, so a few days a year it'll say "open" when it isn't.) */
function setUpMarketLight() {
  const node = document.querySelector("[data-market]");
  if (!node) return;
  function tick() {
    const p = localParts(now(), "America/New_York");
    const mins = p.h * 60 + p.min;
    const weekday = !["Sat", "Sun"].includes(p.weekday);
    const open = weekday && mins >= 9 * 60 + 30 && mins < 16 * 60;
    node.textContent = open ? "Market open" : "Market closed";
    node.classList.toggle("is-open", open);
  }
  tick();
  setInterval(tick, 60000);
}

// Start here once the page has loaded.
async function init() {
  setUpHorizon();
  rememberPlays();
  setUpContinue();
  setUpMarketLight();
  setUpContactForm();
  setUpNow();

  // Keep the footer year current.
  document.querySelectorAll("[data-year]").forEach((n) => {
    n.textContent = new Date().getFullYear();
  });

  // Fade in the mode tiles and the sections below the hero.
  document.querySelectorAll(".tiles > li").forEach((tile, i) => {
    tile.style.setProperty("--i", i);
    reveal(tile);
  });
  document.querySelectorAll("[data-reveal]").forEach((node) => reveal(node));

  const lists = document.querySelectorAll("[data-projects]");
  if (lists.length === 0) return;

  let projects;
  try {
    const response = await fetch("projects.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    projects = await response.json();
    if (!Array.isArray(projects)) throw new Error("projects.json should be a list [ ... ]");
  } catch (err) {
    // Most likely a typo in projects.json (a missing comma or quote).
    console.error("Couldn't load projects.json:", err);
    lists.forEach((listEl) => {
      listEl.replaceChildren(
        el("li", "project-list__note", "Projects couldn't load right now. Please try again later.")
      );
    });
    return;
  }

  fillCategoryCounts(projects);
  lists.forEach((listEl) => {
    if (listEl.dataset.projects === "featured") setUpFeatured(listEl, projects);
    else if (listEl.dataset.projects === "category") setUpCategory(listEl, projects);
    else setUpAll(listEl, projects);
  });
}

init();

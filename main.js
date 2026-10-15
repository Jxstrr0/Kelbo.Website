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

   To preview a time of day, add ?at= to the address, e.g.
   index.html?at=noon, ?at=sunset, ?at=night, or ?at=2026-06-21T22:30
   ========================================================================== */

// Status labels, in order from "just an idea" to "done".
// "spot" is how full the progress bar is, from 0 to 100.
// To add a new status, add a line here.
const STATUSES = [
  { label: "Shipped", spot: 100 },
  { label: "Mostly done", spot: 78 },
  { label: "Building", spot: 50 },
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

// Sort projects so the furthest-along come first. Projects with the
// same status keep the order they have in projects.json.
function sortByProgress(projects) {
  return projects
    .map((p, i) => ({ p, i }))
    .sort((a, b) => findStatus(b.p.status).spot - findStatus(a.p.status).spot || a.i - b.i)
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

// Altitude of the sun above the horizon, in degrees, at a moment in time.
function sunAltitude(date) {
  const n = date.getTime() / 86400000 - 10957.5; // days since 1 Jan 2000, noon UTC
  const g = (357.529 + 0.98560028 * n) * D2R; // mean anomaly
  const q = 280.459 + 0.98564736 * n; // mean longitude (deg)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R; // ecliptic longitude
  const e = (23.439 - 0.00000036 * n) * D2R; // tilt of the Earth
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)); // right ascension
  const dec = Math.asin(Math.sin(e) * Math.sin(L)); // declination
  const gmst = 18.697374558 + 24.06570982441908 * n; // sidereal time, hours
  const lst = (gmst * 15 + YXE.lon) * D2R; // local sidereal time
  const ha = lst - ra; // hour angle
  const lat = YXE.lat * D2R;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) * R2D;
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
function setUpHorizon() {
  const scene = document.querySelector("[data-horizon]");
  const readout = document.querySelector("[data-horizon-readout]");

  function tick() {
    const t = now();
    const alt = sunAltitude(t);
    const day = sunDay(t);
    const isDay = alt >= SUNRISE_ALT;
    applyTheme(isDay);

    // Twilight warming: over the last 20 minutes before sunset, --warm
    // climbs from 0 to 1 and style.css blends the sky toward clay.
    const toSet = day.set ? day.set - t : Infinity;
    const warm = isDay && toSet > 0 && toSet < TWILIGHT_MS ? 1 - toSet / TWILIGHT_MS : 0;
    document.documentElement.style.setProperty("--warm", warm.toFixed(3));

    if (scene) {
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
      scene.style.setProperty("--ray", Math.max(0, Math.min(1, y)).toFixed(3));
    }

    if (readout) {
      const left = readout.children[0];
      const right = readout.children[1];
      if (isDay && day.set) {
        left.textContent = "Sun's up over Saskatoon";
        right.textContent = `Sets ${clock(new Date(day.set))} · ${hoursMins(day.set - t)} of light left`;
      } else if (!isDay && day.rise && t < day.rise) {
        left.textContent = "Sun's down in Saskatoon";
        right.textContent = `Up at ${clock(new Date(day.rise))}`;
      } else {
        // After sunset: tomorrow's sunrise
        const tomorrow = sunDay(new Date(day.end + 60000));
        left.textContent = "Sun's down in Saskatoon";
        right.textContent = tomorrow.rise ? `Back at ${clock(new Date(tomorrow.rise))}` : "Back tomorrow";
      }
    }
  }

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

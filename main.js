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

const YXE = { lat: 52.1332, lon: -106.67, tz: "America/Regina", elev: 486, home: true }; // Saskatoon. SK has no DST.

/* ---------- Your sky ----------
   A visitor can tap "See your sky" (in the home page hero) to see their
   own sun, moon, stars and weather instead of Saskatoon's. Their phone
   asks permission, and the spot is rounded to about 10 km and kept only
   on their device (localStorage "kelbo.sky"); the weather check sends that
   rounded spot to Open-Meteo. Everything sky-related reads YXE, so this
   just swaps its numbers before anything else runs. "Back to Saskatoon"
   clears it. The calendar extras (geese, fireflies, the usual winter
   snow) stay Saskatoon-only. */
const SKY_KEY = "kelbo.sky";
try {
  const mine = JSON.parse(localStorage.getItem(SKY_KEY));
  if (mine && Number.isFinite(mine.lat) && Number.isFinite(mine.lon)) {
    Object.assign(YXE, {
      lat: mine.lat, lon: mine.lon, elev: 0, home: false,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
  }
} catch (e) {}

// "over Saskatoon", or "over you" in your own sky
function overHere() {
  return YXE.home ? "over Saskatoon" : "over you";
}
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
  return { dec, ha: lst - ra, ra, lst, g };
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
// Day length (ms) at this latitude when the sun sits at declination dec
// (degrees): +23.44 is the June solstice, -23.44 December.
function dayLengthFor(dec) {
  const la = YXE.lat * D2R, d = dec * D2R;
  const c = (Math.sin(SUNRISE_ALT * D2R) - Math.sin(la) * Math.sin(d)) / (Math.cos(la) * Math.cos(d));
  return ((2 * Math.acos(Math.max(-1, Math.min(1, c))) * R2D) / 15) * 3600000;
}
// Saskatoon's are measured; anywhere else they're worked out.
const SHORTEST_DAY_MS = YXE.home ? 7.65 * 3600000 : Math.min(dayLengthFor(23.44), dayLengthFor(-23.44));
const LONGEST_DAY_MS = YXE.home ? 16.75 * 3600000 : Math.max(dayLengthFor(23.44), dayLengthFor(-23.44)) + 1;

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
  return (p.m === 6) === YXE.lat >= 0 ? "longest" : "shortest"; // flipped south of the equator
}

// The moment local midnight starts on day y-m-d in the sky's time zone
// (06:00 UTC for Saskatoon). Works out the zone's offset from UTC that
// day, so places with daylight saving time work too.
function zoneMidnight(y, m, d) {
  const guess = Date.UTC(y, m - 1, d);
  const offset = (at) => {
    const p = localParts(new Date(at));
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(at / 60000) * 60000;
  };
  const first = guess - offset(guess);
  return guess - offset(first);
}

// Parts of a moment in Saskatoon time: { y, m, d, h, min, weekday }.
const partsFormats = {}; // one formatter per time zone, made once (they're slow to make)
function localParts(date, tz) {
  const zone = tz || YXE.tz;
  const parts = {};
  partsFormats[zone] = partsFormats[zone] || new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", weekday: "short",
  });
  partsFormats[zone]
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

// "2m 51s", for small gaps like how much shorter today is than yesterday
function minsSecs(ms) {
  const secs = Math.round(Math.abs(ms) / 1000);
  const m = Math.floor(secs / 60);
  return m ? `${m}m ${secs % 60}s` : `${secs}s`;
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

  const start = zoneMidnight(p.y, p.m, p.d); // local midnight
  let rise = null, set = null, peakAlt = -90, peakAt = start, prev = sunAltitude(new Date(start));
  for (let i = 1; i <= 1440; i++) {
    const t = start + i * 60000;
    const alt = sunAltitude(new Date(t));
    if (prev < SUNRISE_ALT && alt >= SUNRISE_ALT && rise === null) rise = t;
    if (prev >= SUNRISE_ALT && alt < SUNRISE_ALT && rise !== null && set === null) set = t;
    if (alt > peakAlt) { peakAlt = alt; peakAt = t; }
    prev = alt;
  }
  // The minute steps are fine for clock times, but comparing one day with
  // the next needs the seconds too, so narrow each crossing down to a
  // second for the day length ("2m 51s shorter than yesterday").
  const exact = (t) => {
    let a = t - 60000, b = t;
    while (b - a > 1000) {
      const mid = (a + b) / 2;
      if ((sunAltitude(new Date(mid)) >= SUNRISE_ALT) === (sunAltitude(new Date(b)) >= SUNRISE_ALT)) b = mid; else a = mid;
    }
    return b;
  };
  const length = rise && set ? exact(set) - exact(rise) : null;
  const info = { start, end: start + 86400000, rise, set, peakAlt, peakAt, length };
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
    // Saskatoon time (UTC-6), or the phone's own time in your own sky
    const zone = YXE.home ? "-06:00" : "";
    const parsed = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(at) ? at : at + zone);
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
  placeEclipse(scene, t);
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
  [344.41, -29.62, 1.2, "Fomalhaut"], [116.33, 28.03, 1.2, "Pollux"], [152.09, 11.97, 1.4, "Regulus"],
  [104.66, -28.97, 1.5, "Adhara"], [81.28, 6.35, 1.6, "Bellatrix"], [113.65, 31.89, 1.6, "Castor"], [81.57, 28.61, 1.6, "Elnath"],
  [263.4, -37.1, 1.6, "Shaula"], [84.05, -1.2, 1.7, "Alnilam"], [85.19, -1.94, 1.7, "Alnitak"],
  [193.51, 55.96, 1.8, "Alioth"], [165.93, 61.75, 1.8, "Dubhe"], [276.04, -34.38, 1.8, "Kaus Australis"],
  [51.08, 49.86, 1.8, "Mirfak"], [107.1, -26.39, 1.8, "Wezen"], [99.43, 16.4, 1.9, "Alhena"], [206.89, 49.31, 1.9, "Alkaid"], [89.88, 44.95, 1.9, "Menkalinan"],
  [154.99, 19.84, 2.0, "Algieba"], [141.9, -8.66, 2.0, "Alphard"], [10.9, -17.99, 2.0, "Diphda"],
  [31.79, 23.46, 2.0, "Hamal"], [95.67, -17.96, 2.0, "Mirzam"], [283.82, -26.3, 2.0, "Nunki"],
  [37.95, 89.26, 2.0, "Polaris"], [47.04, 40.96, 2.1, "Algol"], [30.97, 42.33, 2.1, "Almach"],
  [2.1, 29.09, 2.1, "Alpheratz"], [177.26, 14.57, 2.1, "Denebola"], [222.68, 74.16, 2.1, "Kochab"],
  [211.67, -36.37, 2.1, "Menkent"], [17.43, 35.62, 2.1, "Mirach"], [263.73, 12.56, 2.1, "Rasalhague"],
  [86.94, -9.67, 2.1, "Saiph"], [233.67, 26.71, 2.2, "Alphecca"],
  [269.15, 51.49, 2.2, "Eltanin"], [83.0, -0.3, 2.2, "Mintaka"],
  [200.98, 54.93, 2.2, "Mizar"], [305.56, 40.26, 2.2, "Sadr"], [10.13, 56.54, 2.2, "Schedar"],
  [2.29, 59.15, 2.3, "Caph"], [165.46, 56.38, 2.3, "Merak"], [326.05, 9.88, 2.4, "Enif"],
  [221.25, 27.07, 2.4, "Izar"], [178.46, 53.69, 2.4, "Phecda"], [257.59, -15.72, 2.4, "Sabik"],
  [345.94, 28.08, 2.4, "Scheat"], [319.64, 62.59, 2.5, "Alderamin"], [346.19, 15.21, 2.5, "Markab"],
  [45.57, 4.09, 2.5, "Menkar"], [83.18, -17.82, 2.6, "Arneb"], [183.95, -17.54, 2.6, "Gienah"], [236.07, 6.43, 2.6, "Unukalhai"], [296.56, 10.61, 2.7, "Tarazed"],
  [3.31, 15.18, 2.8, "Algenib"], [265.87, 4.57, 2.8, "Cebalrai"], [82.06, -20.76, 2.8, "Nihal"],
  [258.66, 14.39, 2.8, "Rasalgethi"], [222.72, -16.04, 2.8, "Zubenelgenubi"], [56.87, 24.11, 2.9, "Alcyone"],
  [195.54, 10.96, 2.9, "Vindemiatrix"], [292.68, 27.96, 3.0, "Albireo"],
  [182.53, -22.62, 3.0, "Minkar"], [331.45, -0.32, 3.0, "Sadalmelik"], [59.51, -13.51, 3.0, "Zaurak"],
  [322.16, 70.56, 3.2, "Alfirk"], [284.74, 32.69, 3.2, "Sulafat"], [183.86, 57.03, 3.3, "Megrez"],
  [282.52, 33.36, 3.5, "Sheliak"], [57.29, 24.05, 3.6, "Atlas"], [298.83, 6.41, 3.7, "Alshain"],
  [56.22, 24.11, 3.7, "Electra"], [211.1, 64.38, 3.7, "Thuban"], [56.46, 24.37, 3.9, "Maia"],
  [201.31, 54.99, 4.0, "Alcor"], [56.58, 23.95, 4.1, "Merope"], [56.3, 24.47, 4.3, "Taygeta"],
];
const STAR_TOP_ALT = 80; // a star this high (degrees) touches the top of the strip

// Roughly how far away each star is, in light years (so how long its
// light has been travelling). Tapping a star shows it. Far stars are
// only known to within about a tenth, so those read "about".
const STAR_LY = {
  Sirius: 8.6, Arcturus: 37, Vega: 25, Capella: 43, Rigel: 860, Procyon: 11.5, Betelgeuse: 550,
  Altair: 17, Aldebaran: 65, Spica: 250, Antares: 550, Deneb: 2600, Fomalhaut: 25, Pollux: 34,
  Regulus: 79, Adhara: 430, Bellatrix: 250, Castor: 51, Elnath: 134, Shaula: 570, Alnilam: 2000,
  Alnitak: 1260, Alioth: 83, Dubhe: 123, "Kaus Australis": 143, Mirfak: 510, Wezen: 1600,
  Alhena: 109, Alkaid: 104, Menkalinan: 81, Algieba: 130, Alphard: 177, Diphda: 96, Hamal: 66,
  Mirzam: 490, Nunki: 228, Polaris: 430, Algol: 90, Almach: 350, Alpheratz: 97, Denebola: 36,
  Kochab: 131, Menkent: 59, Mirach: 197, Rasalhague: 49, Saiph: 650, Alphecca: 75, Eltanin: 154,
  Mintaka: 1200, Mizar: 83, Sadr: 1800, Schedar: 228, Caph: 55, Merak: 79, Enif: 690, Izar: 202,
  Phecda: 83, Sabik: 88, Scheat: 196, Alderamin: 49, Markab: 133, Menkar: 250, Arneb: 2200,
  Gienah: 154, Unukalhai: 74, Tarazed: 395, Algenib: 390, Cebalrai: 82, Nihal: 160,
  Rasalgethi: 360, Zubenelgenubi: 75, Alcyone: 440, Vindemiatrix: 110, Albireo: 430, Minkar: 300,
  Sadalmelik: 520, Zaurak: 220, Alfirk: 690, Sulafat: 620, Megrez: 81, Sheliak: 960, Atlas: 440,
  Alshain: 45, Electra: 440, Thuban: 300, Maia: 440, Alcor: 82, Merope: 440, Taygeta: 440,
};

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

// Where the moon is against the stars at moment "date", as seen from the
// middle of the Earth: right ascension and declination (radians), plus
// its parallax (degrees, how much it shifts depending on where on Earth
// you stand; bigger when it's closer). The biggest terms of the moon's
// wobbles, good to about a twentieth of a degree.
function moonRaDec(date) {
  const n = date.getTime() / 86400000 - 10957.5; // days since 1 Jan 2000, noon UTC
  const L = 218.316 + 13.176396 * n; // mean longitude
  const M = (134.963 + 13.064993 * n) * D2R; // mean anomaly
  const F = (93.272 + 13.22935 * n) * D2R; // distance from its node
  const Dm = (297.85 + 12.190749 * n) * D2R; // distance from the sun
  const Ms = (357.529 + 0.98560028 * n) * D2R; // the sun's mean anomaly
  const lon = (L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * Dm - M) + 0.658 * Math.sin(2 * Dm)
    + 0.214 * Math.sin(2 * M) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F)
    + 0.059 * Math.sin(2 * Dm - 2 * M) + 0.057 * Math.sin(2 * Dm - Ms - M) + 0.053 * Math.sin(2 * Dm + M)
    + 0.046 * Math.sin(2 * Dm - Ms) - 0.041 * Math.sin(Ms - M) - 0.035 * Math.sin(Dm)
    - 0.031 * Math.sin(Ms + M)) * D2R;
  const lat = (5.128 * Math.sin(F) + 0.281 * Math.sin(M + F) + 0.278 * Math.sin(M - F)
    + 0.173 * Math.sin(2 * Dm - F) + 0.055 * Math.sin(2 * Dm - M + F) + 0.046 * Math.sin(2 * Dm - M - F)
    + 0.033 * Math.sin(2 * Dm + F) + 0.017 * Math.sin(2 * M + F)) * D2R;
  const parallax = 0.9508 + 0.0518 * Math.cos(M) + 0.0095 * Math.cos(2 * Dm - M)
    + 0.0078 * Math.cos(2 * Dm) + 0.0028 * Math.cos(2 * M);
  const e = (23.439 - 0.00000036 * n) * D2R; // tilt of the Earth
  const ra = Math.atan2(Math.sin(lon) * Math.cos(e) - Math.tan(lat) * Math.sin(e), Math.cos(lon));
  const dec = Math.asin(Math.sin(lat) * Math.cos(e) + Math.cos(lat) * Math.sin(e) * Math.sin(lon));
  return { ra, dec, parallax };
}

// Height of the moon above the horizon, in degrees, as seen from
// Saskatoon: where it is against the stars, then the same sky maths as
// the sun.
function moonAltitude(date) {
  const { ra, dec } = moonRaDec(date);
  const n = date.getTime() / 86400000 - 10957.5;
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
  // The last circle is the Earth's shadow in a lunar eclipse, kept inside
  // the moon's disc (placeEclipse moves it; r="0" hides it otherwise).
  moon.innerHTML = `<svg viewBox="-1 -1 2 2" aria-hidden="true"><defs><clipPath id="moon-clip"><circle r="1"/></clipPath></defs>`
    + `<circle class="moon__dark" r="1"/><path class="moon__lit" d="${d}"/>`
    + `<circle class="moon__shadow" r="0" clip-path="url(#moon-clip)"/></svg>`;
}

// Draws an eclipse at moment t: the Earth's shadow on the moon, or the
// moon's bite out of the sun (a sky-coloured disc inside the sun).
function placeEclipse(scene, t) {
  const e = visibleEclipse(t);
  const lunar = e && e.kind === "lunar" ? e : null;
  const solar = e && e.kind === "solar" ? e : null;
  const shade = scene.querySelector(".moon__shadow");
  if (shade) {
    shade.setAttribute("cx", lunar ? lunar.x.toFixed(3) : 0);
    shade.setAttribute("cy", lunar ? lunar.y.toFixed(3) : 0);
    shade.setAttribute("r", lunar ? lunar.r.toFixed(3) : 0);
  }
  scene.style.setProperty("--eclipse", lunar ? lunar.share.toFixed(3) : 0); // style.css dims the glow
  const sun = scene.querySelector(".horizon__sun");
  if (!sun) return;
  let bite = sun.querySelector(".sun__bite");
  if (solar && !bite) {
    const disc = el("span", "sun__disc");
    bite = el("i", "sun__bite");
    disc.append(bite);
    sun.append(disc);
  }
  if (!bite) return;
  bite.hidden = !solar;
  if (!solar) return;
  bite.style.setProperty("--bx", solar.x.toFixed(3));
  bite.style.setProperty("--by", solar.y.toFixed(3));
  bite.style.setProperty("--br", solar.r.toFixed(3));
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

/* ---------- Shooting stars ----------
   Every so often on a dark night a meteor streaks across the sky. Most
   nights that's one every half a minute or so, from any direction. On
   the nights of the big meteor showers there are many more, and they fly
   out from the shower's real spot in the sky (its "radiant"), just like
   the real ones: the higher that spot is, the more of them. Tap one to
   make a wish. Off for "reduce motion", during the spin and swipes, and
   by day. */
const METEOR_EVERY_S = 30; // a stray meteor on an ordinary night, on average (seconds)

// The yearly meteor showers: name, peak (month, day: the morning after
// the best night), where they fly out of (ra, dec in degrees), how many
// an hour at best under a perfect sky (zhr), and how many days either
// side of the peak they're worth watching (days, the rate halves about
// every "days / 2"). Peak dates shift by a day or so year to year.
const SHOWERS = [
  { name: "Quadrantids", m: 1, d: 4, ra: 230, dec: 49, zhr: 110, days: 2 },
  { name: "Lyrids", m: 4, d: 22, ra: 271, dec: 34, zhr: 18, days: 4 },
  { name: "Eta Aquariids", m: 5, d: 6, ra: 338, dec: -1, zhr: 50, days: 10 },
  { name: "Perseids", m: 8, d: 13, ra: 48, dec: 58, zhr: 100, days: 10 },
  { name: "Draconids", m: 10, d: 8, ra: 262, dec: 54, zhr: 10, days: 2 },
  { name: "Orionids", m: 10, d: 21, ra: 95, dec: 16, zhr: 20, days: 8 },
  { name: "Leonids", m: 11, d: 17, ra: 152, dec: 22, zhr: 15, days: 5 },
  { name: "Geminids", m: 12, d: 14, ra: 112, dec: 33, zhr: 150, days: 6 },
  { name: "Ursids", m: 12, d: 22, ra: 217, dec: 76, zhr: 10, days: 2 },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Where a spot on the sky's map (ra, dec in degrees) is from Saskatoon at
// moment t: alt (degrees up) and az (compass, 90 east, 180 south).
function altAz(raDeg, decDeg, t) {
  const n = t.getTime() / 86400000 - 10957.5;
  const ha = ((18.697374558 + 24.06570982441908 * n) * 15 + YXE.lon - raDeg) * D2R;
  const dec = decDeg * D2R, la = YXE.lat * D2R;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) * R2D;
  const az = Math.atan2(-Math.sin(ha) * Math.cos(dec), Math.cos(la) * Math.sin(dec) - Math.sin(la) * Math.cos(dec) * Math.cos(ha)) * R2D;
  return { alt, az: (az + 360) % 360 };
}

// The shower going on at moment t, if any: { shower, days } where days
// is how far from the peak (negative = before it). Peaks are at 6 AM
// Saskatoon time on the peak date, the end of the best night.
function showerAt(t) {
  const p = localParts(t);
  let best = null;
  for (const shower of SHOWERS) {
    for (const y of [p.y - 1, p.y, p.y + 1]) { // the Quadrantids straddle New Year
      const days = (t - (zoneMidnight(y, shower.m, shower.d) + 6 * 3600000)) / 86400000; // 6 AM local
      if (Math.abs(days) <= shower.days && (!best || Math.abs(days) < Math.abs(best.days))) best = { shower, days };
    }
  }
  return best;
}

// The night readout's shower line: "Orionids peak tonight" on the night
// itself, "Orionids active · peak Oct 21" in the days around it.
function showerLine(t) {
  const now = showerAt(t);
  if (!now) return "";
  const { shower, days } = now;
  if (days > -1 && days < 0.25) return `${shower.name} peak tonight`;
  if (days >= 0.25 && days < 1) return `${shower.name} peaked last night`;
  return `${shower.name} active · peak ${MONTHS[shower.m - 1]} ${shower.d}`;
}

// How many meteors a second to show at moment t, and the shower (if
// any) they belong to. Stray ones all night; shower ones by how close to
// the peak it is and how high its radiant is.
function meteorRate(t) {
  const rates = [{ rate: 1 / METEOR_EVERY_S, shower: null }];
  const now = showerAt(t);
  if (now) {
    const up = Math.sin(Math.max(0, altAz(now.shower.ra, now.shower.dec, t).alt) * D2R);
    const strength = Math.pow(0.5, Math.abs(now.days) / (now.shower.days / 2));
    rates.push({ rate: (now.shower.zhr * strength * up) / 500, shower: now.shower }); // 100 an hour = one every 5 s
  }
  return rates;
}

const meteorsFlying = []; // recent meteors, for tap-to-wish

function setUpMeteors(scene, timeNow) {
  if (REDUCE_MOTION) return;
  const sky = document.createElement("div");
  sky.className = "horizon__meteors";
  scene.querySelector(".horizon__stars").after(sky);

  function launch(t, shower) {
    const w = sky.clientWidth, h = sky.clientHeight;
    if (!w || !h) return;
    const small = h < 140; // the short page-head skies
    // Start somewhere in the upper part of the sky
    const x = w * (0.08 + 0.84 * Math.random());
    const y = h * (0.06 + 0.5 * Math.random());
    let angle;
    if (shower) {
      // Fly straight away from the radiant, placed like a star (it may be
      // off the strip to the left or right, or above it)
      const { alt, az } = altAz(shower.ra, shower.dec, t);
      const rx = ((az - 90) / 180) * w;
      const ry = (1 - alt / STAR_TOP_ALT) * h;
      angle = Math.atan2(y - ry, x - rx);
    } else {
      angle = (0.12 + 0.76 * Math.random()) * Math.PI; // any way, as long as it's falling
    }
    const len = (small ? 40 : 70) + Math.random() * (small ? 40 : 80); // the tail
    const travel = len * (1.2 + Math.random());
    const dur = 500 + Math.random() * 500;
    const dx = Math.cos(angle) * travel, dy = Math.sin(angle) * travel;
    const m = document.createElement("i");
    m.className = "meteor";
    m.style.width = `${len}px`;
    m.style.left = `${x - len}px`;
    m.style.top = `${y}px`;
    sky.append(m);
    const turn = `rotate(${angle}rad)`;
    m.animate(
      [
        { transform: `translate(0, 0) ${turn} scaleX(0.2)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: `translate(${dx}px, ${dy}px) ${turn} scaleX(1)`, opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(0.3, 0, 0.7, 1)" }
    ).onfinish = () => m.remove();
    // Remember it for a moment so a tap near its path counts as a wish
    const born = performance.now();
    meteorsFlying.push({ born, dur, x, y, dx, dy, sky });
    while (meteorsFlying.length && born - meteorsFlying[0].born > 3000) meteorsFlying.shift();
  }

  // Every half second, roll the dice for each kind of meteor.
  setInterval(() => {
    if (document.hidden || spinning) return;
    const t = timeNow();
    // Needs a properly dark sky, the dark theme (so the stars are out) and
    // a break in the clouds
    if (sunAltitude(t) > -8 || document.documentElement.dataset.theme !== "dark") return;
    if (weather && weather.cloud >= 85) return;
    for (const { rate, shower } of meteorRate(t)) {
      if (Math.random() < rate * 0.5) launch(t, shower);
    }
  }, 500);
}

// Did a tap at (px, py) on the page catch a meteor? It counts if it's
// near where one flew in the last moment (a generous target, they're quick).
function caughtMeteor(px, py) {
  const at = performance.now();
  return meteorsFlying.some((m) => {
    if (at - m.born > m.dur + 900) return false;
    const box = m.sky.getBoundingClientRect();
    const ax = box.left + m.x, ay = box.top + m.y;
    // Distance from the tap to the meteor's path
    const len2 = m.dx * m.dx + m.dy * m.dy;
    const k = Math.max(-0.6, Math.min(1, ((px - ax) * m.dx + (py - ay) * m.dy) / len2));
    return Math.hypot(px - (ax + k * m.dx), py - (ay + k * m.dy)) < 48;
  });
}

/* ---------- Tap the sky ----------
   Tapping (or clicking) a star, planet, the moon or the sun shows its
   name and a fact about it in a little label: how long its light took to
   reach us, how far it is, how much of the moon is lit. Catching a
   shooting star makes a wish (counted on this device only). */
const WISHES_KEY = "kelbo.wishes";
const LIGHT_KM_S = 299792.458;
const AU_KM = 149597870.7;

// The sun's distance today in AU (it's closest in early January).
function sunDistanceAU(t) {
  const g = (357.529 + 0.98560028 * (t.getTime() / 86400000 - 10957.5)) * D2R;
  return 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
}

// A planet's distance from Earth in AU at moment t.
function planetDistanceAU(orbit, t) {
  const T = (t.getTime() / 86400000 - 10957.5) / 36525;
  const [px, py, pz] = orbitXYZ(orbit, T);
  const [ex, ey, ez] = orbitXYZ(EARTH_ORBIT, T);
  return Math.hypot(px - ex, py - ey, pz - ez);
}

// "8m 19s" / "43 min" / "1h 12m" for how long light takes
function lightTime(seconds) {
  if (seconds < 3600) return seconds < 600 ? minsSecs(seconds * 1000) : `${Math.round(seconds / 60)} min`;
  return hoursMins(seconds * 1000);
}

function millionKm(au) {
  return `${Math.round((au * AU_KM) / 1e6).toLocaleString("en-CA")} million km`;
}

// What the label says for a star (by name).
function starFact(name, t) {
  const ly = STAR_LY[name];
  if (!ly) return "";
  if (ly < 150) return `This light left it in ${localParts(t).y - Math.round(ly)}`;
  const years = ly < 1000 ? Math.round(ly / 10) * 10 : Math.round(ly / 100) * 100;
  return `This light left it ${years.toLocaleString("en-CA")} years ago`;
}

// Hides the tap label (when a swipe or hold starts moving the sky).
function hideTip(scene) {
  const tip = scene.querySelector(".horizon__tip");
  if (tip) tip.hidden = true;
}

function setUpSkyTaps(scene, timeNow) {
  const tip = document.createElement("p");
  tip.className = "horizon__tip";
  tip.hidden = true;
  scene.append(tip);
  let hideTimer = 0;

  // Shows the label just above a spot (x, y on the page) that's r big,
  // or just below it if there's no room above inside the sky.
  function show(x, y, r, title, detail) {
    const box = scene.getBoundingClientRect();
    tip.replaceChildren(el("strong", "", title), el("span", "", detail));
    tip.hidden = false;
    const half = tip.offsetWidth / 2;
    const left = Math.max(half, Math.min(box.width - half, x - box.left)); // kept inside the sky's width
    const below = y - r - box.top < tip.offsetHeight + 10;
    tip.classList.toggle("horizon__tip--below", below);
    tip.style.left = `${left}px`;
    tip.style.top = `${y - box.top + (below ? r : -r)}px`;
    tip.classList.remove("is-new");
    void tip.offsetWidth;
    tip.classList.add("is-new");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { tip.hidden = true; }, 4500);
  }

  function wish(x, y) {
    let count = 1;
    try {
      count = (parseInt(localStorage.getItem(WISHES_KEY), 10) || 0) + 1;
      localStorage.setItem(WISHES_KEY, String(count));
    } catch (e) {}
    show(x, y, 0, "Wish made", count === 1 ? "Your first one on this device" : `That's ${count} on this device`);
  }

  // Everything that could be tapped right now, with where it is on screen.
  function targets(t) {
    const list = [];
    const centre = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    };
    const sun = scene.querySelector(".horizon__sun");
    if (sun && sunAltitude(t) > -1) {
      const au = sunDistanceAU(t);
      list.push({ ...centre(sun), title: "The Sun", detail: `Light takes ${lightTime((au * AU_KM) / LIGHT_KM_S)} to get here` });
    }
    const moon = scene.querySelector(".horizon__moon");
    if (moon && moonSpanAt(t).up && parseFloat(getComputedStyle(scene).getPropertyValue("--moon-show")) > 0.15) {
      const phase = moonPhase(t);
      const span = moonSpanAt(t);
      list.push({ ...centre(moon), title: `${moonName(phase)} moon`, detail: `${Math.round(moonLit(phase) * 100)}% lit · sets ${clock(new Date(span.next))}` });
    }
    const box = scene.querySelector(".horizon__stars");
    if (box && box.stars && document.documentElement.dataset.theme === "dark") {
      for (const p of box.planets) {
        if (!p.up) continue;
        const au = planetDistanceAU(p.planet.orbit, t);
        list.push({ ...centre(p.dot), r: 6, title: p.planet.name, detail: `${millionKm(au)} · light takes ${lightTime((au * AU_KM) / LIGHT_KM_S)}` });
      }
      for (const s of box.stars) {
        if (!s.up) continue;
        const fact = starFact(s.star[3], t);
        list.push({ ...centre(s.dot), r: 3, title: s.star[3], detail: fact });
      }
    }
    return list;
  }

  scene.addEventListener("click", (e) => {
    if (performance.now() - lastSkyDrag < 400) return; // the end of a swipe or hold
    const t = timeNow();
    if (caughtMeteor(e.clientX, e.clientY)) return wish(e.clientX, e.clientY);
    // The nearest thing within reach of the finger (planets and the
    // sun and moon win ties, so they're easy to hit among the stars)
    let best = null, bestGap = 26;
    for (const item of targets(t)) {
      const gap = Math.max(0, Math.hypot(e.clientX - item.x, e.clientY - item.y) - item.r);
      if (gap < bestGap) { best = item; bestGap = gap; }
    }
    if (best) show(best.x, best.y, best.r, best.title, best.detail);
    else tip.hidden = true;
  });
}

/* ---------- Real weather and the northern lights ----------
   The only parts of the sky that use the internet, both free with no
   key: Open-Meteo for Saskatoon's weather right now (clouds drift past,
   rain or snow falls, lightning in a thunderstorm, fog low down, snow
   on the ground while there's real snow lying), and NOAA's space
   weather feed for the northern lights (soft lilac curtains at the top
   of the night sky when they're likely this far south). Each is checked
   at most every 15 or 20 minutes and kept on the phone in between. If
   either can't be reached the sky just carries on without it.
   Preview with ?weather=clear|cloudy|overcast|rain|snow|storm|fog and
   ?kp=6 (any number 0..9). */
const WEATHER_KEY = "kelbo.weather";
const WEATHER_MS = 15 * 60000;
const KP_KEY = "kelbo.kp";
const KP_MS = 20 * 60000;
let weather = null; // { code, cloud, temp, snow } once known
let kp = null; // the latest Kp index (0..9) once known

// What Open-Meteo's weather codes mean, in words for the readout
const WEATHER_WORDS = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers",
  81: "Rain showers", 82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

// Made-up weather for ?weather= previews: [code, cloud cover %, snow on the ground]
const WEATHER_PREVIEWS = {
  clear: [0, 0, false], cloudy: [2, 55, false], overcast: [3, 100, false], rain: [63, 100, false],
  snow: [73, 100, true], storm: [95, 100, false], fog: [45, 100, false],
};

// "rain", "snow", "storm", "fog" or "" for a weather code
function weatherKind(code) {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  return "";
}

// Fetches JSON, keeping what "pick" takes from it on the phone for maxAge
// so every page and refresh doesn't ask again.
async function cachedFetch(key, maxAge, url, pick) {
  try {
    const kept = JSON.parse(localStorage.getItem(key));
    if (kept && Date.now() - kept.at < maxAge) return kept.data;
  } catch (e) {}
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const data = pick(await res.json());
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch (e) {}
  return data;
}

function loadWeather() {
  const q = new URLSearchParams(location.search);
  const preview = WEATHER_PREVIEWS[q.get("weather")];
  if (preview) {
    weather = { code: preview[0], cloud: preview[1], temp: null, snow: preview[2] };
    return Promise.resolve();
  }
  if (q.has("at")) return Promise.resolve(); // a preview of another time: today's weather wouldn't fit
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${YXE.lat}&longitude=${YXE.lon}`
    + "&current=temperature_2m,weather_code,cloud_cover,snow_depth";
  return cachedFetch(`${WEATHER_KEY}:${YXE.lat},${YXE.lon}`, WEATHER_MS, url, (d) => ({
    code: d.current.weather_code,
    cloud: d.current.cloud_cover,
    temp: d.current.temperature_2m,
    snow: d.current.snow_depth > 0,
  }))
    .then((w) => { weather = w; })
    .catch(() => {});
}

function loadKp() {
  const q = new URLSearchParams(location.search);
  if (q.has("kp")) {
    kp = parseFloat(q.get("kp")) || 0;
    return Promise.resolve();
  }
  if (q.has("at")) return Promise.resolve();
  return cachedFetch(KP_KEY, KP_MS, "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json", (list) => {
    // The feed restarts at 0 for the first minutes of each 3-hour block,
    // so take the highest reading of the last half hour.
    const recent = list.slice(-30).map((row) => row.estimated_kp).filter(Number.isFinite);
    return recent.length ? Math.max(...recent) : null;
  })
    .then((k) => { kp = k; })
    .catch(() => {});
}

// "Light snow · −4°C" for the readout, or "" if the weather isn't known.
function weatherLine() {
  if (!weather) return "";
  const words = WEATHER_WORDS[weather.code] || "";
  if (weather.temp == null) return words;
  const temp = Math.round(weather.temp);
  return `${words} · ${temp < 0 ? "−" : ""}${Math.abs(temp)}°C`;
}

// How strong the northern lights look at moment t, 0..1. Saskatoon sits
// near the southern edge of where they're usually seen: they start to
// show around Kp 4 and fill the sky in a big storm. They need a dark,
// clear sky.
function auroraStrength(t) {
  const need = auroraKp();
  if (kp == null || kp < need || sunAltitude(t) > -10) return 0;
  if (weather && weather.cloud >= 85) return 0;
  return Math.min(1, 0.35 + (kp - need) * 0.25);
}

// The Kp the lights need to show here (4 for Saskatoon). The lights
// circle the Earth's magnetic poles and reach about 2° further from them
// for every step of Kp, so it's worked out from the magnetic latitude
// (distance from the magnetic north pole, near 80.7° N 72.7° W).
function auroraKp() {
  const la = YXE.lat * D2R, pole = 80.7 * D2R;
  const mag = Math.asin(Math.sin(la) * Math.sin(pole) + Math.cos(la) * Math.cos(pole) * Math.cos((YXE.lon + 72.7) * D2R)) * R2D;
  return (66.5 - Math.abs(mag)) / 2 + 0.75;
}

function auroraLine(t) {
  if (!auroraStrength(t)) return "";
  const name = YXE.lat >= 0 ? "Northern" : "Southern";
  return `${name} lights ${kp >= auroraKp() + 1 ? "likely" : "possible"} · Kp ${Math.round(kp * 10) / 10}`;
}

// Snow lying on the ground: the real snow depth when the weather is
// known, otherwise the usual Saskatoon winter (late November to late March).
function snowOnGround(t) {
  if (weather) return weather.snow;
  if (!YXE.home) return false; // the calendar guess only fits Saskatoon
  const p = localParts(t);
  const day = p.m * 100 + p.d;
  return day >= 1125 || day <= 325;
}

// Builds the weather layers once, then paintWeather switches them.
function setUpWeather(scene) {
  const sky = scene.querySelector(".horizon__stars");
  const layer = (cls, before) => {
    const node = el("div", cls);
    if (before) sky.before(node); else sky.after(node);
    return node;
  };
  scene.aurora = layer("horizon__aurora", true);
  scene.clouds = layer("horizon__clouds");
  scene.precip = layer("horizon__precip");
  scene.snowline = el("div", "horizon__snowline");
  scene.querySelector(".horizon__ground").after(scene.snowline);
  const refresh = () => Promise.all([loadWeather(), loadKp()]).then(() => { scene.weatherCode = null; });
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, WEATHER_MS);
  // Lightning in a thunderstorm: a quick flash every 5 to 20 seconds
  if (!REDUCE_MOTION) {
    (function flash() {
      setTimeout(() => {
        if (scene.classList.contains("horizon--storm") && !document.hidden) {
          scene.classList.remove("horizon--flash");
          void scene.offsetWidth;
          scene.classList.add("horizon--flash");
        }
        flash();
      }, 5000 + Math.random() * 15000);
    })();
  }
}

// Shows the weather, snow and northern lights for moment t.
function paintWeather(scene, t) {
  if (!scene.clouds) return;
  scene.classList.toggle("horizon--snowy", snowOnGround(t));
  scene.style.setProperty("--aurora", auroraStrength(t).toFixed(2));
  const code = weather ? weather.code : -1;
  const cloud = weather ? weather.cloud : 0;
  if (scene.weatherCode === `${code}/${cloud}`) return; // nothing new
  scene.weatherCode = `${code}/${cloud}`;
  const kind = weather ? weatherKind(code) : "";
  for (const k of ["rain", "snow", "storm", "fog"]) {
    scene.classList.toggle(`horizon--${k}`, kind === k || (k === "rain" && kind === "storm"));
  }
  scene.classList.toggle("horizon--overcast", cloud >= 85);
  // A few clouds for every 20% of cover, each a different size, height
  // and speed, starting spread across the sky.
  const count = cloud < 15 ? 0 : Math.min(6, Math.round(cloud / 17));
  const size = scene.closest(".page-head") ? 0.6 : 1; // smaller on the short page-head skies
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const c = el("i", "cloud");
    const slow = 140 + Math.random() * 120; // seconds to cross
    c.style.setProperty("--h", `${((14 + Math.random() * 18) * size).toFixed(0)}px`);
    c.style.top = `${(4 + Math.random() * 50).toFixed(0)}%`;
    c.style.left = `${((i + Math.random() * 0.6) / count * 100).toFixed(0)}%`;
    c.style.animationDuration = `${slow.toFixed(0)}s`;
    c.style.animationDelay = `${(-slow * ((i + 0.5) / count)).toFixed(0)}s`; // already partway across
    clouds.push(c);
  }
  scene.clouds.replaceChildren(...clouds);
}

/* ---------- Prairie seasons ----------
   Things that come with the time of year, from the calendar (no
   internet): Canada geese flying over in V's in the fall (heading south)
   and spring (back north), and fireflies blinking low over the ground on
   summer nights. Off for "reduce motion". */
const GEESE_EVERY_S = 40; // a flock every 40 seconds on average, in season

// Is it goose season (mid September to mid November, and late March to
// early May), and light enough for them to be flying?
function geeseTime(t) {
  const p = localParts(t);
  const day = p.m * 100 + p.d;
  const season = (day >= 910 && day <= 1115) || (day >= 320 && day <= 510);
  return YXE.home && season && sunAltitude(t) > -6;
}

// Fireflies: mid June to early August, after dark, when it isn't raining.
function firefliesTime(t) {
  const p = localParts(t);
  const day = p.m * 100 + p.d;
  const wet = weather && ["rain", "storm", "snow"].includes(weatherKind(weather.code));
  return YXE.home && day >= 615 && day <= 805 && sunAltitude(t) < -4 && !wet;
}

function setUpCritters(scene, timeNow) {
  if (REDUCE_MOTION) return;
  const box = el("div", "horizon__critters");
  scene.querySelector(".horizon__stars").after(box);

  // One V of geese across the sky. The V points the way they're flying.
  function flock() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const small = h < 140;
    const birds = 5 + Math.floor(Math.random() * 8);
    const gap = small ? 7 : 10;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "geese");
    const span = Math.ceil(birds / 2) * gap + 10;
    svg.setAttribute("viewBox", `${-span} ${-span * 0.7} ${span + 8} ${span * 1.4}`);
    svg.style.width = `${span + 8}px`;
    for (let i = 0; i < birds; i++) {
      // Leader at the point, the rest alternating down the two arms
      const rank = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("transform", `translate(${-rank * gap} ${side * rank * gap * 0.6})`);
      const bird = document.createElementNS(svgNS, "path"); // two wings, flapping (style.css)
      bird.setAttribute("d", "M-4 -1.6Q-2 -1.2 0 0Q2 -1.2 4 -1.6");
      bird.style.animationDelay = `${(-Math.random()).toFixed(2)}s`;
      g.append(bird);
      svg.append(g);
    }
    const left = Math.random() < 0.5; // flying toward the left, or the right
    if (left) svg.style.transform = "scaleX(-1)";
    const y = h * (0.12 + Math.random() * 0.4);
    svg.style.top = `${y}px`;
    box.append(svg);
    const across = w + span * 2;
    const dur = (small ? 9000 : 14000) + Math.random() * 6000;
    const dir = left ? -1 : 1;
    const x0 = left ? w + span : -span - 8;
    svg.animate(
      [
        { translate: `${x0}px 0` },
        { translate: `${x0 + dir * across * 0.5}px ${-6 - Math.random() * 10}px` },
        { translate: `${x0 + dir * across}px ${-4}px` },
      ],
      { duration: dur, easing: "linear" }
    ).onfinish = () => svg.remove();
  }

  // Fireflies are made once and kept while it's their time
  let flies = null;
  function fireflies(on) {
    if (on && !flies) {
      flies = Array.from({ length: 12 }, () => {
        const f = el("i", "firefly");
        f.style.left = `${(3 + Math.random() * 94).toFixed(1)}%`;
        f.style.top = `${(72 + Math.random() * 24).toFixed(1)}%`;
        f.style.animationDuration = `${(2.5 + Math.random() * 3).toFixed(2)}s, ${(6 + Math.random() * 6).toFixed(2)}s`;
        f.style.animationDelay = `${(-Math.random() * 6).toFixed(2)}s, ${(-Math.random() * 6).toFixed(2)}s`;
        return f;
      });
      box.append(...flies);
    } else if (!on && flies) {
      flies.forEach((f) => f.remove());
      flies = null;
    }
  }

  setInterval(() => {
    if (document.hidden) return;
    const t = timeNow();
    fireflies(firefliesTime(t));
    if (!spinning && geeseTime(t) && Math.random() < 1 / GEESE_EVERY_S) flock();
  }, 1000);
}

/* ---------- Eclipses ----------
   Worked out from the same sun and moon positions as everything else (no
   internet). In a lunar eclipse the Earth's shadow creeps across the moon
   and, when it's total, turns it a deep copper red. In a solar eclipse
   the moon takes a bite out of the sun, as seen from Saskatoon (the
   moon's spot is adjusted for where Saskatoon is on the Earth, which
   moves it by up to a degree). The readout says so while it's on, and
   on the day ahead ("Lunar eclipse tonight · 2:31 AM"). Try
   ?at=2026-03-03T05:30 (total lunar) or ?at=2024-04-08T13:20 (partial
   solar). */

// Angle between two spots on the sky (ra, dec in radians), in degrees.
function skyGap(ra1, dec1, ra2, dec2) {
  const a = Math.sin((dec2 - dec1) / 2) ** 2 + Math.cos(dec1) * Math.cos(dec2) * Math.sin((ra2 - ra1) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a))) * R2D;
}

// Where one spot sits from another in Saskatoon's sky, in degrees:
// x to the right (west, as the sky faces south) and y down.
function skyOffset(from, to, lst) {
  const la = YXE.lat * D2R;
  const altAzOf = ({ ra, dec }) => {
    const ha = lst - ra;
    const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
    const az = Math.atan2(-Math.sin(ha) * Math.cos(dec), Math.cos(la) * Math.sin(dec) - Math.sin(la) * Math.cos(dec) * Math.cos(ha));
    return { alt, az };
  };
  const a = altAzOf(from), b = altAzOf(to);
  let daz = b.az - a.az;
  daz = Math.atan2(Math.sin(daz), Math.cos(daz)); // the short way round
  return { x: daz * Math.cos(a.alt) * R2D, y: -(b.alt - a.alt) * R2D };
}

// How much of a disc of radius r is covered by one of radius R whose
// centre is d away (all in the same units), 0..1.
function covered(r, R, d) {
  if (d >= r + R) return 0;
  if (d <= Math.abs(R - r)) return R >= r ? 1 : (R * R) / (r * r);
  const a = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r));
  const b = R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R));
  const c = 0.5 * Math.sqrt((-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R));
  return (a + b - c) / (Math.PI * r * r);
}

// The eclipse going on at moment t, if one is: { kind: "lunar" or
// "solar", total, share (how much is covered, 0..1), x, y, r } where x,
// y is where the shadow (or the moon's disc) is from the middle of the
// moon (or sun), and r its size, both measured in moon (or sun) radii.
// Lunar ones count from when the dark part of the shadow (the umbra)
// touches the moon; the faint outer shadow is too subtle to see.
function eclipseAt(t) {
  const sun = sunPosition(t);
  const moon = moonRaDec(t);
  const sunR = 0.2666 / sunDistanceAU(t); // the sun's radius on the sky, degrees
  // Lunar: the Earth's shadow points straight away from the sun
  const moonR = 0.2725 * moon.parallax;
  const shadow = { ra: sun.ra + Math.PI, dec: -sun.dec };
  const umbra = 1.02 * (moon.parallax + 0.00244 - sunR); // its dark middle, degrees
  const lunarGap = skyGap(moon.ra, moon.dec, shadow.ra, shadow.dec);
  if (lunarGap < umbra + moonR) {
    const off = skyOffset(moon, shadow, sun.lst);
    const share = covered(moonR, umbra, lunarGap);
    return { kind: "lunar", total: share >= 0.999, share, x: off.x / moonR, y: off.y / moonR, r: umbra / moonR };
  }
  // Solar: shift the moon to where it looks from Saskatoon (486 m up)
  const la = YXE.lat * D2R;
  const u = Math.atan(0.99664719 * Math.tan(la));
  const rhoSin = 0.99664719 * Math.sin(u) + (YXE.elev / 6378140) * Math.sin(la);
  const rhoCos = Math.cos(u) + (YXE.elev / 6378140) * Math.cos(la);
  const sp = Math.sin(moon.parallax * D2R);
  const H = sun.lst - moon.ra;
  const dRa = Math.atan2(-rhoCos * sp * Math.sin(H), Math.cos(moon.dec) - rhoCos * sp * Math.cos(H));
  const here = {
    ra: moon.ra + dRa,
    dec: Math.atan2((Math.sin(moon.dec) - rhoSin * sp) * Math.cos(dRa), Math.cos(moon.dec) - rhoCos * sp * Math.cos(H)),
  };
  const moonHereR = moonR * (1 + Math.sin(sunAltitude(t) * D2R) * 0.0167); // a touch bigger when high (closer)
  const solarGap = skyGap(sun.ra, sun.dec, here.ra, here.dec);
  if (solarGap < sunR + moonHereR) {
    const off = skyOffset(sun, here, sun.lst);
    const share = covered(sunR, moonHereR, solarGap);
    return { kind: "solar", total: share >= 0.999, share, x: off.x / sunR, y: off.y / sunR, r: moonHereR / sunR };
  }
  return null;
}

// Only the eclipses Saskatoon can see: the moon (or sun) has to be up.
function visibleEclipse(t) {
  const e = eclipseAt(t);
  if (!e) return null;
  if (e.kind === "lunar" && moonAltitude(t) < MOONRISE_ALT) return null;
  if (e.kind === "solar" && sunAltitude(t) < SUNRISE_ALT) return null;
  return e;
}

// The next visible eclipse in the 20 hours from t, checked every 5
// minutes and kept for half an hour: { kind, total, at } (at = its peak).
let eclipseAhead = null;
function nextEclipse(t) {
  const slot = Math.floor(t / 1800000);
  if (eclipseAhead && eclipseAhead.slot === slot) return eclipseAhead.found;
  let found = null;
  for (let k = 0; k <= 240; k++) {
    const when = new Date(slot * 1800000 + k * 300000);
    const e = visibleEclipse(when);
    if (e && (!found || e.share > found.share)) found = { kind: e.kind, total: e.total, share: e.share, at: when.getTime() };
    else if (found && !e) break; // it's over
  }
  eclipseAhead = { slot, found };
  return found;
}

// "Total lunar eclipse · 100%" while one is on, "Solar eclipse today ·
// 11:21 AM" when one is coming up in the next 20 hours, otherwise "".
function eclipseLine(t) {
  const e = visibleEclipse(t);
  const name = (x) => `${x.total ? "Total" : "Partial"} ${x.kind} eclipse`;
  if (e) return `${name(e)} · ${Math.round(e.share * 100)}% ${e.kind === "lunar" ? "in shadow" : "covered"}`;
  const next = nextEclipse(t);
  if (!next || next.at <= t) return "";
  const sameDay = localParts(new Date(next.at)).d === localParts(t).d;
  const when = next.kind === "lunar" ? "tonight" : sameDay ? "today" : "tomorrow";
  return `${next.kind === "lunar" ? "Lunar" : "Solar"} eclipse ${when} · ${clock(new Date(next.at))}`;
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
let lastSkyDrag = 0; // when the last swipe or hold let go, so its tap doesn't count

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
   it really would. The readout shows the time you're looking at. Flick it
   and it keeps spinning a moment, slowing to a stop. Then it waits a couple of seconds (so you can grab it again and keep
   fiddling), then slides back to right now. Only touch, so a mouse can still
   select text; up-and-down swipes still scroll the page. */
const SWIPE_HOURS = 10; // hours per full width (bigger = faster)
const SWIPE_MAX_HOURS = 36; // how far either way a swipe can go
const SWIPE_START_PX = 10; // sideways movement before it counts as a swipe
const SWIPE_HOLD_MS = 2000; // how long it waits after you let go before heading back
const SWIPE_BACK_MS = 1800; // how long the slide back to "now" takes
const SWIPE_GLIDE_MS = 550; // how long a flick keeps coasting (bigger = longer glide)
const HOLD_START_MS = 450; // press and hold this long (without moving) to wind on to sunset or sunrise
const HOLD_RUN_MS = 2600; // how long winding on takes

// Where holding the sky winds to: just after the next sunset (into dusk,
// so the stars come out) by day, or just after the next sunrise at night.
function nextTurn(t) {
  const day = sunDay(t);
  if (sunAltitude(t) >= SUNRISE_ALT && day.set && day.set > t) return day.set + 35 * 60000;
  if (day.rise && day.rise > t) return day.rise + 25 * 60000;
  const tomorrow = sunDay(new Date(day.end + 60000));
  return (tomorrow.rise || day.end + 8 * 3600000) + 25 * 60000;
}

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

  // After a flick, keeps the sky moving at the finger's speed and lets it
  // slow down like a spun wheel, then hands over to slideBack. `speed` is
  // in px per ms. A new swipe bumps skyRun, which stops the glide.
  function glide(speed) {
    const run = ++skyRun;
    const width = scene.clientWidth || 1;
    const max = SWIPE_MAX_HOURS * 3600000;
    let last = null;
    if (REDUCE_MOTION || Math.abs(speed) < 0.05) return slideBack();
    requestAnimationFrame(frame);
    function frame(ms) {
      if (run !== skyRun) return; // a new swipe took over
      const dt = last === null ? 16 : Math.min(50, ms - last);
      last = ms;
      shown += (speed * dt / width) * SWIPE_HOURS * 3600000;
      speed *= Math.exp(-dt / SWIPE_GLIDE_MS); // friction
      const atEdge = Math.abs(shown) >= max;
      shown = Math.max(-max, Math.min(max, shown));
      paint(new Date(now().getTime() + shown), shown);
      if (atEdge || Math.abs(speed) < 0.02) slideBack();
      else requestAnimationFrame(frame);
    }
  }

  // Holds still for SWIPE_HOLD_MS, then eases back to now. A new swipe
  // during either part bumps skyRun, which cancels this one.
  function slideBack() {
    const run = ++skyRun;
    const from = shown;
    let start = null;
    setTimeout(() => {
      if (run === skyRun) requestAnimationFrame(frame);
    }, SWIPE_HOLD_MS);
    function frame(ms) {
      if (run !== skyRun) return; // a new swipe took over
      if (start === null) start = ms;
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
  }

  // Press and hold (finger or mouse) without moving: after HOLD_START_MS
  // the sky winds on to the next sunset, or sunrise at night, and stays
  // there while held. Letting go hands over to slideBack like a swipe.
  let hold = null; // { id, x, y, timer, live } while pressed
  function startHold() {
    hideTip(scene);
    hold.live = true;
    drag = null; // a hold, so the finger moving now won't start a swipe
    const run = ++skyRun;
    swiping = spinning = true;
    scene.classList.add("horizon--spin");
    try {
      scene.setPointerCapture(hold.id);
    } catch (err) {}
    const max = SWIPE_MAX_HOURS * 3600000;
    const from = shown;
    const base = now().getTime();
    const to = Math.max(-max, Math.min(max, nextTurn(new Date(base + shown)) - base));
    let start = null;
    requestAnimationFrame(function frame(ms) {
      if (run !== skyRun) return; // let go, or a swipe took over
      if (start === null) start = ms;
      const p = REDUCE_MOTION ? 1 : Math.min(1, (ms - start) / HOLD_RUN_MS);
      shown = from + (to - from) * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
      paint(new Date(now().getTime() + shown), shown);
      if (p < 1) requestAnimationFrame(frame);
    });
  }
  function endHold(e) {
    if (!hold || e.pointerId !== hold.id) return;
    clearTimeout(hold.timer);
    if (hold.live) {
      lastSkyDrag = performance.now();
      slideBack();
    }
    hold = null;
  }
  scene.addEventListener("pointerdown", (e) => {
    if (hold || e.button > 0) return;
    hold = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false };
    hold.timer = setTimeout(startHold, HOLD_START_MS);
  });
  scene.addEventListener("pointermove", (e) => {
    if (!hold || hold.live || e.pointerId !== hold.id) return;
    if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > SWIPE_START_PX) {
      clearTimeout(hold.timer); // it's a swipe or a scroll, not a hold
      hold = null;
    }
  });
  scene.addEventListener("pointerup", endHold);
  scene.addEventListener("pointercancel", endHold);
  scene.addEventListener("contextmenu", (e) => e.preventDefault()); // no long-press menu

  scene.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: 0, live: false, trail: [] };
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
      hideTip(scene);
      drag.live = true;
      drag.x = e.clientX;
      drag.from = shown; // pick up wherever the sky is, even mid slide back
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
    // Remember the last ~100 ms of finger positions to measure flick speed.
    drag.trail.push({ x: e.clientX, t: e.timeStamp });
    while (drag.trail.length > 2 && e.timeStamp - drag.trail[0].t > 100) drag.trail.shift();
    draw();
  });

  // How fast the finger was moving as it let go, in px per ms (0 if it
  // had stopped before lifting off).
  function flickSpeed(d, t) {
    const a = d.trail[0];
    const b = d.trail[d.trail.length - 1];
    if (!a || a === b || t - b.t > 80) return 0;
    return (b.x - a.x) / Math.max(1, b.t - a.t);
  }

  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const was = drag;
    drag = null;
    if (!was.live) return;
    lastSkyDrag = performance.now();
    glide(e.type === "pointerup" ? flickSpeed(was, e.timeStamp) : 0);
  }
  scene.addEventListener("pointerup", end);
  scene.addEventListener("pointercancel", end);

  // The moment the sky is showing (now, or wherever a swipe left it)
  return () => new Date(now().getTime() + shown);
}

// While swiping: "Tomorrow 2:15 AM" and how far from now that is.
function swipeLine(t, ahead) {
  const a = localParts(t);
  const b = localParts(now());
  const days = Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
  const word = { "-1": "Yesterday", 0: "Today", 1: "Tomorrow" }[days] || a.weekday;
  return [`${word} ${clock(t)}`, `${ahead < 0 ? "−" : "+"}${hoursMins(Math.abs(ahead))} · back to now soon`];
}

// The night readout: "Waxing crescent moon over Saskatoon" while the
// moon is up, or when it rises if it's down.
function moonLine(t) {
  const name = moonName(moonPhase(t));
  const span = moonSpanAt(t);
  return span.up ? `${name} moon ${overHere()}` : `${name} moon rises ${clock(new Date(span.next))}`;
}

/* ---------- Extra readout lines ----------
   The left side of the readout takes turns with a second fact every
   READOUT_TURN_MS: by day how today's length compares with yesterday's,
   and around sunrise and sunset how long golden hour (sun between 4°
   under and 6° up, the warm light photographers love) or blue hour (4°
   to 6° under, the deep blue just after) has left. */
const READOUT_TURN_MS = 6000;

// Which "hour" the light is in at sun height alt (degrees), or "".
function lightName(alt) {
  if (alt >= -4 && alt < 6) return "Golden";
  if (alt >= -6 && alt < -4) return "Blue";
  return "";
}

// "Golden hour · 24m left", or "" outside golden and blue hour.
function lightHourLine(t) {
  const name = lightName(sunAltitude(t));
  if (!name) return "";
  // Step ahead a minute at a time until it changes (never more than a
  // few hours, even in June when the sun skims under the horizon).
  let end = t.getTime() + 60000;
  for (let i = 0; i < 300 && lightName(sunAltitude(new Date(end))) === name; i++) end += 60000;
  return `${name} hour · ${hoursMins(end - t)} left`;
}

// "2m 51s shorter than yesterday". For three weeks after the shortest
// day of the year it's the good news instead.
function dayLengthLine(t) {
  const today = sunDay(t);
  const yesterday = sunDay(new Date(today.start - 3600000));
  if (!today.length || !yesterday.length) return "";
  const diff = today.length - yesterday.length;
  const p = localParts(t);
  const afterShortest = YXE.lat >= 0
    ? (p.m === 12 && p.d >= 21) || (p.m === 1 && p.d <= 11)
    : (p.m === 6 && p.d >= 21) || (p.m === 7 && p.d <= 11); // south of the equator it's June
  if (afterShortest && diff > 0) return "Days are getting longer again";
  if (Math.abs(diff) < 1000) return "Same length as yesterday";
  return `${minsSecs(diff)} ${diff < 0 ? "shorter" : "longer"} than yesterday`;
}

// Picks this turn's line from a list (empty ones skipped).
function takeTurns(lines) {
  const list = lines.filter(Boolean);
  return list[Math.floor(Date.now() / READOUT_TURN_MS) % list.length] || "";
}

// Swaps a readout line's text, fading the new one in (style.css,
// .is-new) unless it's being moved every frame by a swipe.
function setLine(node, text, quiet) {
  if (node.textContent === text) return;
  node.textContent = text;
  if (quiet) return;
  node.classList.remove("is-new");
  void node.offsetWidth; // restart the fade
  node.classList.add("is-new");
}

// The "See your sky" / "Back to Saskatoon" switch in the home hero.
function setUpSkySwitch() {
  const btn = document.querySelector("[data-sky-switch]");
  const place = document.querySelector("[data-sky-place]");
  if (!btn) return;
  if (!YXE.home) {
    if (place) place.textContent = "Your sky";
    btn.textContent = "Back to Saskatoon";
    btn.hidden = false;
    btn.addEventListener("click", () => {
      try {
        localStorage.removeItem(SKY_KEY);
      } catch (e) {}
      location.reload();
    });
    return;
  }
  if (!navigator.geolocation) return; // nothing to ask, so no button
  btn.hidden = false;
  btn.addEventListener("click", () => {
    btn.textContent = "Finding you…";
    btn.disabled = true;
    const giveUp = (text) => {
      btn.textContent = text;
      setTimeout(() => {
        btn.textContent = "See your sky";
        btn.disabled = false;
      }, 3000);
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to a tenth of a degree (about 10 km): plenty for the sky
        const round = (x) => Math.round(x * 10) / 10;
        try {
          localStorage.setItem(SKY_KEY, JSON.stringify({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) }));
          location.reload();
        } catch (e) {
          giveUp("Couldn't save it");
        }
      },
      () => giveUp("Couldn't find you"),
      { maximumAge: 3600000, timeout: 15000 }
    );
  });
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
    if (scene) paintWeather(scene, t);

    if (readout) {
      const left = readout.children[0];
      const right = readout.children[1];
      let l, r;
      if (swiped) {
        [l, r] = swipeLine(t, ahead);
      } else if (isDay && day.set) {
        l = takeTurns([eclipseLine(t), lightHourLine(t) || `Sun's up ${overHere()}`, dayLengthLine(t), weatherLine()]);
        r = `Sets ${clock(new Date(day.set))} · ${hoursMins(day.set - t)} of light left`;
      } else if (!isDay && day.rise && t < day.rise) {
        // Night: tonight's moon, and when the sun comes back
        l = takeTurns([eclipseLine(t), moonLine(t), lightHourLine(t), showerLine(t), auroraLine(t), weatherLine()]);
        r = `Sun's up at ${clock(new Date(day.rise))}`;
      } else {
        // After sunset: tomorrow's sunrise
        const tomorrow = sunDay(new Date(day.end + 60000));
        l = takeTurns([eclipseLine(t), moonLine(t), lightHourLine(t), showerLine(t), auroraLine(t), weatherLine()]);
        r = tomorrow.rise ? `Sun's back at ${clock(new Date(tomorrow.rise))}` : "Sun's back tomorrow";
      }
      setLine(left, l, swiped);
      setLine(right, r, true);
    }
  }

  // The regular update (every few seconds, so the readout can take
  // turns); a swipe in progress keeps the sky instead.
  function tick() {
    if (!swiping) paint(now(), null);
  }

  if (scene && shouldSpin()) spinSun(scene);
  if (scene) {
    const shownTime = setUpSwipe(scene, paint);
    setUpWeather(scene);
    setUpMeteors(scene, now);
    setUpCritters(scene, shownTime);
    setUpSkyTaps(scene, shownTime);
  }
  tick();
  setUpThemeToggle(tick);
  setInterval(tick, READOUT_TURN_MS);
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
  setUpSkySwitch();
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

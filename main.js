/* ==========================================================================
   main.js — shows projects from projects.json on the page.
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
    // Games get a big pink "Play it" button; everything else a plain link.
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

// Start here once the page has loaded.
async function init() {
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

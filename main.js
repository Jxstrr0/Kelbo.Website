/* ==========================================================================
   main.js — shows projects from projects.json on the page.
   --------------------------------------------------------------------------
   You shouldn't need to edit this file to add or change a project.
   Just edit projects.json. This script:
     1. loads projects.json
     2. on the home page, shows projects marked "featured": true (max 3)
     3. on the projects page, shows every project with filter buttons
     4. on the Games, Trading, and AI pages, shows every project in that
        "category"
     5. on the home page tiles, shows how many projects each section has
   ========================================================================== */

// Status labels, in order from "just an idea" to "done".
// "spot" is where the ball sits on the little field, from 0 (start)
// to 100 (end zone). To add a new status, add a line here.
const STATUSES = [
  { label: "Shipped", spot: 95 },
  { label: "Mostly done", spot: 72 },
  { label: "Building", spot: 45 },
  { label: "Planned", spot: 15 },
];

const MAX_FEATURED = 3;

// Find the status entry for a project (ignores upper/lower case).
// Unknown statuses still show, with the ball at the start line.
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

// Build the list item for one project.
function renderProject(project) {
  const status = findStatus(project.status);
  const item = el("li", "project");

  // Title + status/category line
  const top = el("div", "project__top");
  top.append(el("h3", "project__title", project.title || "Untitled"));
  const meta = el("p", "project__meta");
  meta.append(el("span", "project__status", status.label));
  if (project.category) meta.append(el("span", "project__category", project.category));
  top.append(meta);
  item.append(top);

  if (project.summary) {
    item.append(el("p", "project__summary", project.summary));
  }

  // Links: "link" is where to try the project ("Play it" for games),
  // "code" is where its code lives on GitHub. Both are optional.
  const title = project.title || "this project";
  const links = el("p", "project__links");
  if (project.link) {
    // Games get a big "Play it" button; everything else a plain link.
    const link = isGame(project)
      ? el("a", "project__link project__link--play", "Play it")
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
  if (links.children.length) item.append(links);

  // The status field. It's decoration only (the status is already
  // written in text above), so screen readers skip it.
  const field = el("div", "field is-waiting");
  field.setAttribute("aria-hidden", "true");
  field.style.setProperty("--progress", status.spot);
  field.append(el("span", "field__drive"), el("span", "field__ball"));
  item.append(field);

  return item;
}

// Put a list of projects into a <ul>, replacing what was there.
function fillList(listEl, projects, emptyMessage) {
  listEl.replaceChildren();
  if (projects.length === 0) {
    listEl.append(el("li", "project-list__note", emptyMessage));
    return;
  }
  projects.forEach((p) => listEl.append(renderProject(p)));

  // Let the browser draw the ball at the start line first, then
  // remove "is-waiting" so it slides to its spot (skipped if the
  // visitor prefers reduced motion; see style.css).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      listEl.querySelectorAll(".field.is-waiting").forEach((f) => f.classList.remove("is-waiting"));
    });
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

  function show(choice) {
    const shown =
      choice === "All" ? sorted : sorted.filter((p) => findStatus(p.status).label === choice);
    fillList(listEl, shown, "Nothing here yet.");

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
      btn.addEventListener("click", () => show(choice));
      filtersEl.append(btn);
    });
  }

  show("All");
}

// Start here once the page has loaded.
async function init() {
  // Keep the footer year current.
  document.querySelectorAll("[data-year]").forEach((n) => {
    n.textContent = new Date().getFullYear();
  });

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

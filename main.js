/* ==========================================================================
   main.js — shows projects from projects.json on the page, and runs the
   live horizon (the sun in the hero follows the real sun over Saskatoon).
   --------------------------------------------------------------------------
   You shouldn't need to edit this file to add or change a project.
   Just edit projects.json. This script:
     1. loads projects.json
     2. on the home page, shows every game in one sideways row
     3. on the projects page, shows every project with filter buttons
     4. on the Games, Trading, and Tools pages, shows every project in that
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
    14. fills game.html (one game's own page, game.html?g=the-whip) from
        projects.json
    15. plays a game's recorded clip on its cover while the card is on
        screen, and grows a tapped cover into the game page's cover
    16. runs the scroll sun down the right edge, the character sheet's
        boot-up and quest log on about.html, and the logo secret

   To preview a time of day, add ?at= to the address, e.g.
   index.html?at=noon, ?at=sunset, ?at=night, or ?at=2026-06-21T22:30
   ========================================================================== */

// Status labels, from "done" down to "just an idea". The Projects page's
// filter buttons run in this order, furthest along first.
// "spot" is how full the progress bar is, from 0 to 100.
// "stage" picks the colour of the pill and bar (see .project__status in
// style.css): "out" = finished (solid clay), "live" = keeps getting
// updates (clay outline), "dev" = being built (purple), "idea" = not
// started yet (lilac outline).
// "old" lists names used before October 2026, so they still work.
// To add a new status, add a line here (and in .github/scripts/check-site.mjs).
//   Complete: done and won't change.
//   Released: out, but may still get updates.
//   Live: keeps running with regular updates (like the trading journal).
const STATUSES = [
  { label: "Complete", spot: 100, stage: "out", old: ["Finished - Final Form"] },
  { label: "Released", spot: 100, stage: "out", old: ["Finished - For Now"] },
  { label: "Live", spot: 100, stage: "live", old: ["Ongoing"] },
  { label: "Polishing", spot: 78, stage: "dev", old: ["Mostly done"] },
  { label: "In development", spot: 50, stage: "dev", old: ["Building"] },
  { label: "Prototype", spot: 32, stage: "dev", old: ["Early stages"] },
  { label: "Concept", spot: 18, stage: "idea", old: ["Planned"] },
];

// True if the visitor's device is set to "reduce motion".
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Find the status entry for a project (ignores upper/lower case).
// Unknown statuses still show, with an empty progress bar.
function findStatus(statusText) {
  const wanted = String(statusText || "").trim().toLowerCase();
  return (
    STATUSES.find(
      (s) => s.label.toLowerCase() === wanted || s.old.some((o) => o.toLowerCase() === wanted)
    ) || {
      label: statusText || "Unknown",
      spot: 0,
      stage: "",
    }
  );
}

// The coloured status pill. data-stage picks its colour in style.css.
function statusPill(status) {
  const pill = el("span", "project__status", status.label);
  pill.dataset.stage = status.stage;
  return pill;
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
// Sharp pictures on high-density screens. Every cover and screenshot has a
// twin at double size beside it, named with "@2x" ("frontier-lab.jpg" ->
// "frontier-lab@2x.jpg"). This sets both: ordinary screens load the small
// one, phones like a big iPhone (3 real pixels per CSS pixel) load the big
// one, so pictures aren't stretched and blurry there. The shape is the same,
// so nothing moves. If a twin is missing, it falls back to the small file.
function twin(src) {
  return String(src || "").replace(/(\.[a-z]+)$/i, "@2x$1");
}
function setPicture(img, src) {
  img.src = src;
  if (!src || /@2x\./.test(src)) return;
  img.srcset = src + " 1x, " + twin(src) + " 2x";
  img.addEventListener("error", function fallBack() {
    img.removeEventListener("error", fallBack);
    img.srcset = src; // just the small one, at its real size
  });
}

function initials(title) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// "Prairie Engine Works" -> "prairie-engine-works". A game's own page is
// game-<this>.html (see gamePage), so it needs no extra file when a project is added.
function projectSlug(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A game's own page. The deploy makes game-<slug>.html for every game (a
// copy of game.html with that game's link preview, see
// .github/scripts/make-game-pages.mjs), so shared links show the game's
// cover. game.html?g=<slug> still works too, and 404.html sends a
// game-<slug>.html that doesn't exist yet to it.
function gamePage(title) {
  return "game-" + projectSlug(title) + ".html";
}

// Build the card for one project.
// True for a game with a link: every Longlight game runs in the browser,
// so its card can promise "Plays in your browser".
function playsInBrowser(project) {
  return isGame(project) && Boolean(project.link);
}

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
    setPicture(img, project.image);
    img.alt = ""; // decoration: the title is right below
    img.width = 640;
    img.height = 480;
    img.loading = "lazy";
    cover.append(img);
    // A game with a card clip ("cardClip" in projects.json, the same
    // shape as the cover and starting on the very same picture) plays it
    // on its cover while the card is on screen (see "Moving covers").
    // Without one, the tall game-page clip ("clip") stands in.
    const cardClip = project.cardClip || project.clip;
    if (cardClip) watchClip(cover, cardClip);
  } else {
    cover.append(el("span", "project__initials", initials(title)));
  }
  item.append(cover);

  const body = el("div", "project__body");
  body.append(el("h3", "project__title", title));

  // Status pill + category
  const meta = el("p", "project__meta");
  meta.append(statusPill(status));
  if (project.category) meta.append(el("span", "project__category", project.category));
  if (playsInBrowser(project)) meta.append(el("span", "project__instant", "Plays in your browser"));
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
  field.dataset.stage = status.stage;
  field.append(el("span", "field__drive"), el("span", "field__ball"));
  body.append(field);

  // Links: "link" is where to try the project ("Play it" for games),
  // "code" is where its code lives on GitHub. Both are optional.
  // Tapping the card opens the main link (project__main, see style.css):
  // a game's own info page, or "Take a look" for everything else. The
  // "Play it" button still goes straight to the game.
  const links = el("p", "project__links");
  if (project.link) {
    // Games get a big clay "Play it" button; everything else a plain link.
    const link = isGame(project)
      ? el("a", "button button--play", "Play it")
      : el("a", "project__link project__main", "Take a look →");
    link.href = project.link;
    // The arrow is decoration; give screen readers a clear name that starts
    // with the words on the button (so "tap Play it" works by voice too).
    link.setAttribute("aria-label", (isGame(project) ? "Play it: " : "Take a look at ") + title);
    links.append(link);
  }
  if (isGame(project)) {
    const more = el("a", "project__link project__main", "About this game →");
    more.href = gamePage(title);
    more.setAttribute("aria-label", "About this game: " + title);
    links.append(more);
  }
  if (project.code) {
    const code = el("a", "project__link", "See the code →");
    code.href = project.code;
    code.setAttribute("aria-label", "See the code for " + title);
    links.append(code);
  }
  if (links.children.length) body.append(links);

  // Screenshots: "shots" in projects.json is a list of { src, alt }. They
  // sit in a closed "Screenshots (4)" drawer so the cards stay short; the
  // pictures only download once the drawer is opened (loading="lazy").
  // The home page hides this with CSS, since it shows the short cards.
  if (Array.isArray(project.shots) && project.shots.length) {
    const drawer = el("details", "shots");
    drawer.append(el("summary", null, "Screenshots (" + project.shots.length + ")"));
    const strip = el("div", "shots__strip");
    strip.tabIndex = 0; // so keyboard users can scroll the strip with the arrow keys
    strip.setAttribute("role", "region");
    strip.setAttribute("aria-label", title + " screenshots");
    project.shots.forEach((shot) => {
      const img = el("img");
      setPicture(img, shot.src);
      img.alt = shot.alt || "";
      img.loading = "lazy";
      img.decoding = "async";
      strip.append(img);
    });
    drawer.append(strip);
    body.append(drawer);
  }

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

/* ---------- Moving covers ----------
   A game with a short recorded clip plays it, silently and on a loop, in
   place of its cover picture while most of the card is on screen, and
   stops when it scrolls away. The card clip ("cardClip", 640x480, 30
   frames a second, six to eight seconds) opens on the cover picture
   itself and its end melts back into its start, so the picture simply
   comes to life. The clip (100 to 400 KB) is only downloaded
   the first time its card comes into view. Skipped with "reduce motion",
   and when the phone has Data Saver on. */
const SAVE_DATA = Boolean(navigator.connection && navigator.connection.saveData);
const clipObserver =
  !REDUCE_MOTION && !SAVE_DATA && "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.intersectionRatio >= 0.6) playClip(entry.target);
            else pauseClip(entry.target);
          });
        },
        { threshold: [0, 0.6] }
      )
    : null;

function watchClip(cover, src) {
  if (!clipObserver) return;
  cover.dataset.clip = src;
  clipObserver.observe(cover);
}

function playClip(cover) {
  let video = cover.querySelector("video");
  if (!video) {
    video = el("video", "project__clip");
    // Phones only let a video start by itself if it's silent and inline
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.disablePictureInPicture = true;
    video.tabIndex = -1;
    video.setAttribute("aria-hidden", "true"); // decoration, like the cover picture
    // Fade it in over the picture once it's really moving
    video.addEventListener("playing", () => cover.classList.add("is-playing"));
    video.src = cover.dataset.clip;
    cover.append(video);
  }
  const started = video.play();
  if (started && started.catch) started.catch(() => {}); // refused: the picture stays
}

function pauseClip(cover) {
  const video = cover.querySelector("video");
  if (video) video.pause();
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
// Only the Projects page's filter buttons use this now; the lists
// themselves show projects.json order (Kelbo's own ranking).
function sortByProgress(projects) {
  return projects
    .map((p, i) => ({ p, i }))
    .sort((a, b) => statusRank(a.p.status) - statusRank(b.p.status) || a.i - b.i)
    .map((x) => x.p);
}

// A game's own page (game.html?g=the-whip): the cover, the story, every
// screenshot open in a strip, the buttons, and links to the other games.
// Everything comes from projects.json. Optional "story" in a project is a
// longer write-up; a blank line (\n\n) starts a new paragraph.
function setUpGame(box, projects) {
  const games = projects.filter(isGame);
  // game-<slug>.html says which game in data-game; game.html?g=<slug> in the address.
  const wanted = box.dataset.game || new URLSearchParams(location.search).get("g") || "";
  const project = games.find((p) => projectSlug(p.title) === projectSlug(wanted));
  const heading = document.querySelector("[data-game-title]");

  if (!project) {
    if (heading) heading.textContent = "Game not found";
    box.replaceChildren(
      el("p", "game__note", "That game isn't in the list. It may have moved or been renamed.")
    );
    const back = el("a", "button button--ghost", "See all games");
    back.href = "games.html";
    box.append(back);
    return;
  }

  const title = project.title || "Untitled";
  const status = findStatus(project.status);
  if (heading) heading.textContent = title;
  document.title = title + " · Longlight Interactive";
  // Handy for game.html?g=; link-preview crawlers don't run scripts, so
  // only the game-<slug>.html copies show the game's own card when shared.
  const setMeta = (sel, value) => {
    const node = document.querySelector(sel);
    if (node && value) node.setAttribute("content", value);
  };
  setMeta('meta[name="description"]', project.summary);
  setMeta('meta[property="og:title"]', title + " · Longlight Interactive");
  setMeta('meta[property="og:description"]', project.summary);

  box.replaceChildren();
  const top = el("div", "game__top");

  // Cover (a coloured tile with initials if there's no picture)
  const cover = el("div", "project__cover game__cover");
  cover.dataset.cat = String(project.category || "").trim().toLowerCase();
  // "art" (assets/art/, 640x480 + @2x) is painted key art: it leads the
  // game page, while the cards keep the live-game cover and its clip.
  const coverSrc = project.art || project.image;
  if (coverSrc) {
    const img = el("img");
    setPicture(img, coverSrc);
    img.alt = (project.art ? "Key art for " : "Cover of ") + title;
    img.width = 640;
    img.height = 480;
    cover.append(img);
  } else {
    cover.append(el("span", "project__initials", initials(title)));
  }
  top.append(cover);

  const info = el("div", "game__info");
  const meta = el("p", "project__meta");
  meta.append(statusPill(status));
  if (project.category) meta.append(el("span", "project__category", project.category));
  if (playsInBrowser(project)) meta.append(el("span", "project__instant", "Plays in your browser, no download"));
  info.append(meta);
  if (project.summary) info.append(el("p", "game__summary", project.summary));

  const version = String(project.version || "").trim().replace(/^v/i, "");
  const latest = String(project.latest || "").trim();
  if (version || latest) {
    const note = el("p", "project__version");
    if (version) note.append(el("strong", null, "v" + version));
    if (version && latest) note.append(" · ");
    if (latest) note.append(latest);
    info.append(note);
  }

  const field = el("div", "field is-waiting");
  field.setAttribute("aria-hidden", "true");
  field.style.setProperty("--progress", status.spot);
  field.dataset.stage = status.stage;
  field.append(el("span", "field__drive"), el("span", "field__ball"));
  info.append(field);

  const links = el("p", "project__links");
  if (project.link) {
    const play = el("a", "button button--play", "Play it");
    play.href = project.link;
    play.setAttribute("aria-label", "Play it: " + title);
    play.dataset.title = title;
    play.dataset.image = project.image || "";
    links.append(play);
    // "Play here" opens the game inside this page (see openPlayer).
    const here = el("button", "button button--ghost button--here", "Play here");
    here.type = "button";
    here.setAttribute("aria-label", "Play here: " + title + ", on this page");
    here.addEventListener("click", () => openPlayer(project, here));
    links.append(here);
  }
  if (project.code) {
    const code = el("a", "project__link", "See the code →");
    code.href = project.code;
    code.setAttribute("aria-label", "See the code for " + title);
    links.append(code);
  }
  if (links.children.length) info.append(links);
  top.append(info);
  box.append(top);

  // The longer write-up, if projects.json has a "story" for this game
  const story = String(project.story || "").trim();
  if (story) {
    const section = el("section", "game__story");
    section.append(el("h2", null, "The story"));
    story.split(/\n\s*\n/).forEach((para) => section.append(el("p", null, para.trim())));
    box.append(section);
  }

  // A short silent clip of the game ("clip" in projects.json, an .mp4 in
  // assets/clips/ with a same-named .jpg still beside it). Nothing but the
  // still downloads until the visitor presses play (preload="none").
  if (project.clip) {
    const section = el("section", "game__clip");
    section.append(el("h2", null, "See it move"));
    const video = el("video");
    video.src = project.clip;
    video.poster = String(project.clip).replace(/\.mp4$/i, ".jpg");
    video.preload = "none";
    video.controls = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.width = 360;
    video.height = 720;
    video.setAttribute("aria-label", "A short silent clip of " + title);
    section.append(video, el("p", "game__clip-note", "A short silent clip, recorded from the game on a phone-sized screen."));
    box.append(section);
  }

  // A cinematic loop ("film" in projects.json, an .mp4 in assets/films/ with
  // a same-named .jpg still). It is painted art, not gameplay, and says so.
  // Like the clip, only the still downloads until play is pressed.
  if (project.film) {
    const section = el("section", "game__film");
    section.append(el("h2", null, "Cinematic"));
    const video = el("video");
    video.src = project.film;
    video.poster = String(project.film).replace(/\.mp4$/i, ".jpg");
    video.preload = "none";
    video.controls = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.width = 1280;
    video.height = 720;
    video.setAttribute("aria-label", "A short silent cinematic of " + title + ", not gameplay");
    section.append(video, el("p", "game__clip-note", "A cinematic, not gameplay: a short silent mood piece for the game."));
    box.append(section);
  }

  // Every screenshot, open in a swipe strip
  if (Array.isArray(project.shots) && project.shots.length) {
    const section = el("section", "game__shots");
    section.append(el("h2", null, "Screenshots"));
    const strip = el("div", "shots__strip");
    strip.tabIndex = 0;
    strip.setAttribute("role", "region");
    strip.setAttribute("aria-label", title + " screenshots");
    project.shots.forEach((shot) => {
      const img = el("img");
      setPicture(img, shot.src);
      img.alt = shot.alt || "";
      img.loading = "lazy";
      img.decoding = "async";
      strip.append(img);
    });
    section.append(strip);
    box.append(section);
  }

  // The other games, as plain links
  const others = games.filter((g) => g !== project);
  let moreSection = null;
  if (others.length) {
    const section = el("section", "game__more");
    section.append(el("h2", null, "More Longlight games"));
    const list = el("ul", "game__more-list");
    others.forEach((g) => {
      const item = el("li");
      const link = el("a", null, g.title);
      link.href = gamePage(g.title);
      item.append(link);
      list.append(item);
    });
    section.append(list);
    box.append(section);
    moreSection = section;
  }

  // Devlog posts about this game go just above "More Longlight games".
  addGameDevlog(box, title, moreSection);
}

/* ----------------------------------------------------------------------
   DEVLOG
   ----------------------------------------------------------------------
   Posts live in devlog.json: {"posts": [...]}, newest first. Each post
   has a "date" (2026-10-24), a "title", a "body" (a blank line starts a
   new paragraph) and, if it's about one game, that game's "game" title
   from projects.json. devlog.html shows them all; a game's page shows
   the ones about it.
   ---------------------------------------------------------------------- */
let devlogPosts = null;
async function loadDevlog() {
  if (!devlogPosts) {
    devlogPosts = fetch("devlog.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((data) => (Array.isArray(data.posts) ? data.posts : []))
      .catch((err) => {
        console.error("Couldn't load devlog.json:", err);
        return [];
      });
  }
  return devlogPosts;
}

// "2026-10-24" -> "October 24, 2026" (read as a calendar date, so the
// visitor's time zone can't shift it a day).
function devlogDate(date) {
  const [y, m, d] = String(date).split("-").map(Number);
  if (!y || !m || !d) return String(date || "");
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

// The address of one post on devlog.html, e.g. devlog.html#2026-10-23-red-skies-1-5-save-codes
function devlogId(post) {
  return post.date + "-" + projectSlug(post.title);
}

function renderPost(post, games) {
  const item = el("li", "post");
  item.id = devlogId(post);
  const head = el("p", "post__meta");
  const time = el("time", null, devlogDate(post.date));
  time.dateTime = post.date;
  head.append(time);
  const game = post.game && games.find((g) => g.title === post.game);
  if (game) {
    head.append(" · ");
    const link = el("a", null, game.title);
    link.href = gamePage(game.title);
    head.append(link);
  }
  item.append(head, el("h2", "post__title", post.title || "Update"));
  String(post.body || "")
    .split(/\n\s*\n/)
    .filter((para) => para.trim())
    .forEach((para) => item.append(el("p", null, para.trim())));
  return item;
}

async function setUpDevlog() {
  const list = document.querySelector("[data-devlog]");
  if (!list) return;
  let posts = await loadDevlog();
  let games = [];
  let hiddenTitles = new Set();
  try {
    const response = await fetch("projects.json", { cache: "no-cache" });
    if (response.ok) {
      const all = await response.json();
      games = all.filter((p) => isGame(p) && !p.hidden);
      // A post about a hidden game ("game" names it) stays off the page
      // until that game is un-hidden; devlog.json keeps every post.
      hiddenTitles = new Set(all.filter((p) => p.hidden).map((p) => p.title));
    }
  } catch (e) {}
  posts = posts.filter((post) => !hiddenTitles.has(post.game));
  list.replaceChildren();
  if (posts.length === 0) {
    list.append(el("li", "project-list__note", "No posts yet. Check back soon."));
    return;
  }
  posts.forEach((post) => {
    const item = renderPost(post, games);
    list.append(item);
    reveal(item);
  });
  // Opened from a link to one post: bring it into view now that it exists.
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }
}

// On a game's page: the devlog posts about that game, as dated links.
async function addGameDevlog(box, title, before) {
  const posts = (await loadDevlog()).filter((post) => post.game === title);
  if (posts.length === 0) return;
  const section = el("section", "game__devlog");
  section.append(el("h2", null, "From the devlog"));
  const list = el("ul", "game__devlog-list");
  posts.forEach((post) => {
    const item = el("li");
    const time = el("time", null, devlogDate(post.date));
    time.dateTime = post.date;
    const link = el("a", null, post.title);
    link.href = "devlog.html#" + devlogId(post);
    item.append(time, link);
    list.append(item);
  });
  section.append(list);
  if (before && before.parentNode === box) box.insertBefore(section, before);
  else box.append(section);
}

/* ----------------------------------------------------------------------
   PLAY HERE
   ----------------------------------------------------------------------
   "Play here" on a game's page opens the game in a frame that covers the
   whole screen, with a bar on top: the game's name, Full screen (where
   the phone allows it; iPhones don't for pages), Open in a new tab, and
   Close. The phone's Back button closes it too, because opening it adds
   a step to the history. Closing it stops the game (the frame is removed).
   ---------------------------------------------------------------------- */
function openPlayer(project, opener) {
  if (document.querySelector(".player")) return;
  const title = project.title || "Game";

  // Remember it for the home page's "Continue?" card, like Play it does.
  writeJSON(LAST_KEY, { title, link: project.link, image: project.image || "", at: Date.now() });
  notePlayed(title);

  const player = el("div", "player");
  player.setAttribute("role", "dialog");
  player.setAttribute("aria-modal", "true");
  player.setAttribute("aria-label", title);

  const bar = el("div", "player__bar");
  bar.append(el("p", "player__title", title));
  const tools = el("div", "player__tools");

  const frame = el("iframe", "player__frame");
  frame.src = project.link;
  frame.title = title;
  frame.allow = "fullscreen; autoplay; gamepad; screen-wake-lock";

  if (player.requestFullscreen) {
    const full = el("button", "player__tool", "Full screen");
    full.type = "button";
    full.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else player.requestFullscreen().catch(() => {});
    });
    tools.append(full);
  }
  const tab = el("a", "player__tool", "New tab");
  tab.href = project.link;
  tab.target = "_blank";
  tab.rel = "noopener";
  tab.setAttribute("aria-label", "Open " + title + " in a new tab");
  const close = el("button", "player__tool player__close", "Close");
  close.type = "button";
  close.setAttribute("aria-label", "Close " + title);
  tools.append(tab, close);
  bar.append(tools);
  player.append(bar, frame);

  // Tidy up: remove the frame (which stops the game and its sound), give
  // the page its scroll back, and put focus back on the button.
  let open = true;
  const shut = () => {
    if (!open) return;
    open = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    player.remove();
    document.documentElement.classList.remove("has-player");
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("popstate", onBack);
    if (opener) opener.focus();
  };
  const onKey = (event) => {
    if (event.key === "Escape" && !document.fullscreenElement) history.back();
  };
  const onBack = () => shut();
  close.addEventListener("click", () => history.back());

  history.pushState({ player: true }, "");
  window.addEventListener("popstate", onBack);
  document.addEventListener("keydown", onKey);
  document.documentElement.classList.add("has-player");
  document.body.append(player);
  frame.focus();
}

// Home page "Pick a game": every game in one sideways row of small
// cards, in projects.json order. The cards are the normal ones
// (renderProject); style.css (.project-list--row) hides the long parts.
// The row scrolls by swipe, trackpad or arrow keys; on wider screens two
// arrow buttons under it move it a screenful at a time.
function setUpGameRow(listEl, projects) {
  const games = projects.filter(isGame);
  fillList(listEl, games, "No games yet.");
  if (!games.length) return;

  // The whole row fades in together when it scrolls into view. Left to
  // themselves the cards off to the side would wait, then rise in one by
  // one during a swipe, which made the row jiggle.
  if (revealObserver) {
    const cards = [...listEl.children];
    cards.forEach((card) => revealObserver.unobserve(card));
    const rowObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        cards.forEach(showNow);
        rowObserver.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    rowObserver.observe(listEl);
  }

  // Keyboard users can focus the row and scroll it with the arrow keys.
  listEl.tabIndex = 0;
  listEl.setAttribute("aria-label", games.length + " games. Swipe sideways to see them all");

  const nav = document.querySelector("[data-row-nav]");
  if (!nav) return;
  const prev = nav.querySelector("[data-row-prev]");
  const next = nav.querySelector("[data-row-next]");
  const count = nav.querySelector("[data-row-count]");
  if (count) count.textContent = games.length + " games";
  nav.hidden = false;

  const step = (dir) => {
    listEl.scrollBy({ left: dir * listEl.clientWidth * 0.8, behavior: REDUCE_MOTION ? "auto" : "smooth" });
  };
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));

  // Grey out an arrow when the row is already at that end.
  const update = () => {
    const max = listEl.scrollWidth - listEl.clientWidth;
    prev.disabled = listEl.scrollLeft <= 2;
    next.disabled = listEl.scrollLeft >= max - 2;
  };
  listEl.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

// Section pages (Games, Trading, Tools): every project in one category, in
// projects.json order (Kelbo's ranking, top to bottom). The category comes
// from data-category in the HTML.
function setUpCategory(listEl, projects) {
  const category = listEl.dataset.category;
  const inThis = projects.filter((p) => inCategory(p, category));
  fillList(listEl, inThis, "Nothing here yet. Check back soon.");
}

// What's new page: every project that has a "version" or a "latest" line,
// in the same order as projects.json. Nothing to edit here: change the
// version and latest in projects.json and this page follows.
function setUpNews(listEl, projects) {
  const rows = projects.filter(
    (p) => String(p.version || "").trim() || String(p.latest || "").trim()
  );
  listEl.replaceChildren();
  if (rows.length === 0) {
    listEl.append(el("li", "project-list__note", "Nothing to report yet. Check back soon."));
    return;
  }
  rows.forEach((p, i) => {
    const row = renderNews(p);
    row.style.setProperty("--i", i % 4);
    listEl.append(row);
    reveal(row);
  });
}

// Press kit (press.html): every game with its cover, summary, version,
// links, and each picture as a file to open or save. Also fills in the
// game count in the fact sheet. Order is projects.json's, like Games.
function setUpPress(listEl, projects) {
  const games = projects.filter(isGame);
  const count = document.querySelector("[data-press-count]");
  if (count) count.textContent = games.length + " browser game" + (games.length === 1 ? "" : "s");
  listEl.replaceChildren();
  if (games.length === 0) {
    listEl.append(el("li", "project-list__note", "No games yet. Check back soon."));
    return;
  }
  games.forEach((project) => {
    const title = project.title || "Untitled";
    const item = el("li", "press-game");

    if (project.image) {
      const cover = el("a", "press-game__cover");
      cover.href = project.image;
      const img = el("img");
      setPicture(img, project.image);
      img.alt = "Cover of " + title;
      img.width = 640;
      img.height = 480;
      img.loading = "lazy";
      cover.append(img);
      item.append(cover);
    }

    const body = el("div", "press-game__body");
    body.append(el("h3", "press-game__title", title));
    const meta = el("p", "project__meta");
    meta.append(statusPill(findStatus(project.status)));
    const version = String(project.version || "").trim().replace(/^v/i, "");
    if (version) meta.append(el("span", "project__category", "v" + version));
    body.append(meta);
    if (project.summary) body.append(el("p", "press-game__summary", project.summary));

    const links = el("p", "project__links");
    const page = el("a", "project__link", "Game page →");
    page.href = gamePage(title);
    page.setAttribute("aria-label", title + " game page");
    links.append(page);
    if (project.link) {
      const play = el("a", "project__link", "Play it →");
      play.href = project.link;
      play.setAttribute("aria-label", "Play it: " + title);
      links.append(play);
    }
    body.append(links);

    // Every screenshot as a small picture that opens the full file.
    if (Array.isArray(project.shots) && project.shots.length) {
      const shots = el("ul", "press-game__shots");
      shots.setAttribute("aria-label", title + " screenshots");
      project.shots.forEach((shot, i) => {
        const li = el("li");
        const a = el("a");
        a.href = shot.src;
        const img = el("img");
        setPicture(img, shot.src);
        img.alt = shot.alt || title + " screenshot " + (i + 1);
        img.loading = "lazy";
        img.decoding = "async";
        a.append(img);
        li.append(a);
        shots.append(li);
      });
      body.append(shots);
    }
    item.append(body);
    listEl.append(item);
    reveal(item);
  });
}

// One row on the What's new page: small cover, name, "v1.4 · Added night
// mode", and the same Play / code links as the project card.
function renderNews(project) {
  const title = project.title || "Untitled";
  const status = findStatus(project.status);
  const version = String(project.version || "").trim().replace(/^v/i, "");
  const latest = String(project.latest || "").trim();

  const row = el("li", "news");
  const cover = el("div", "news__cover");
  cover.dataset.cat = String(project.category || "").trim().toLowerCase();
  if (project.image) {
    const img = el("img");
    setPicture(img, project.image);
    img.alt = ""; // decoration: the title is right beside it
    img.width = 640;
    img.height = 480;
    img.loading = "lazy";
    cover.append(img);
  } else {
    cover.append(el("span", "project__initials", initials(title)));
  }
  row.append(cover);

  const body = el("div", "news__body");
  body.append(el("h2", "news__title", title));
  const line = el("p", "news__line");
  if (version) line.append(el("strong", null, "v" + version));
  if (version && latest) line.append(" · ");
  if (latest) line.append(latest);
  body.append(line);
  body.append(el("p", "news__status", status.label));

  const links = el("p", "project__links");
  if (project.link) {
    // A game row opens its info page when tapped; "Play it" goes to the game.
    const link = el("a", (isGame(project) ? "button button--play" : "project__link project__main"),
      isGame(project) ? "Play it" : "Take a look →");
    link.href = project.link;
    link.setAttribute("aria-label", (isGame(project) ? "Play it: " : "Take a look at ") + title);
    links.append(link);
  }
  if (isGame(project)) {
    const more = el("a", "project__link project__main", "About this game →");
    more.href = gamePage(title);
    more.setAttribute("aria-label", "About this game: " + title);
    links.append(more);
  }
  if (project.code) {
    const code = el("a", "project__link", "See the code →");
    code.href = project.code;
    code.setAttribute("aria-label", "See the code for " + title);
    links.append(code);
  }
  if (links.children.length) body.append(links);
  row.append(body);
  return row;
}

// Home page tiles: "4 projects" under each section name.
function fillCategoryCounts(projects) {
  document.querySelectorAll("[data-category-count]").forEach((node) => {
    // "*" counts everything (the All tile)
    const which = node.dataset.categoryCount;
    const n = which === "*" ? projects.length : projects.filter((p) => inCategory(p, which)).length;
    node.textContent = n === 0 ? "Coming soon" : n === 1 ? "1 project" : n + " projects";
  });
}

// Projects page: all projects plus filter buttons.
function setUpAll(listEl, projects) {
  const filtersEl = document.querySelector("[data-filters]");
  const countEl = document.querySelector("[data-count]");
  // Cards stay in projects.json order; only the filter buttons run in
  // STATUSES order.
  const sorted = projects;

  // One button for "All", then one per status that has projects
  // (in the STATUSES order, then any unknown statuses).
  const labels = [];
  sortByProgress(projects).forEach((p) => {
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

// Contact form on the home page. Sends the message to the contact Worker in the
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
      if (!response.ok || !result.success) {
        const problem = new Error(result.message || "HTTP " + response.status);
        problem.fromServer = Boolean(result.message);
        throw problem;
      }
      form.reset();
      say("Sent. Thanks for reaching out!", "sent");
    } catch (err) {
      console.error("Contact form didn't send:", err);
      // The Worker's own words when it has them (e.g. "tick the check").
      say(err && err.fromServer ? err.message : "That didn't send. Please try again in a minute.", "error");
    } finally {
      button.disabled = false;
      // Each Turnstile pass works once, so get a fresh one for the next try.
      if (window.turnstile) window.turnstile.reset();
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
   on their device (localStorage "kelbo.sky"); the weather and air quality
   checks send that rounded spot to Open-Meteo. Everything sky-related reads YXE, so this
   just swaps its numbers before anything else runs. "Back to Saskatoon"
   clears it. The calendar extras (geese, fireflies, autumn leaves,
   crocuses, wheat and the usual winter snow) stay Saskatoon-only. */
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
  // Look every 5 minutes first, then minute by minute only inside the
  // 5 minutes where the sun crosses the horizon and around its highest
  // point. Same answers as checking all 1,440 minutes, in about a fifth
  // of the work (a new day used to cost a dropped frame in the spin).
  const STEP = 5;
  const altAt = (i) => sunAltitude(new Date(start + i * 60000)); // i = minutes after midnight
  let rise = null, set = null, top = -90, topI = STEP, prev = altAt(0);
  for (let i = STEP; i <= 1440; i += STEP) {
    const alt = altAt(i);
    const up = prev < SUNRISE_ALT && alt >= SUNRISE_ALT && rise === null;
    const down = prev >= SUNRISE_ALT && alt < SUNRISE_ALT && rise !== null && set === null;
    if (up || down) {
      // The first minute in this stretch that is on the new side
      let m = i - STEP + 1;
      while (m < i && (altAt(m) >= SUNRISE_ALT) !== up) m++;
      if (up) rise = start + m * 60000; else set = start + m * 60000;
    }
    if (alt > top) { top = alt; topI = i; }
    prev = alt;
  }
  let peakAlt = -90, peakAt = start;
  for (let i = Math.max(1, topI - STEP); i <= Math.min(1440, topI + STEP); i++) {
    const alt = altAt(i);
    if (alt > peakAlt) { peakAlt = alt; peakAt = start + i * 60000; }
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

// How high something sits in the sky picture: 0.92 at its highest point
// (which keeps it off the top edge), 0 on the horizon, -1 well under the
// ground. Below the horizon it carries on at the speed it was falling
// and then picks up, so it sinks through the line smoothly and is still
// fully out of sight (-1) by 10 degrees under, however low its day is.
function skyHeight(alt, peak) {
  const k = 0.92 / Math.max(10, peak); // height per degree above the horizon
  if (alt >= 0) return k * alt;
  if (alt <= -10) return -1;
  return k * alt - ((1 - 10 * k) / 100) * alt * alt;
}

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
  } else {
    // Night runs from one sunset to the next sunrise, which are on
    // different days either side of midnight, so look both up. That
    // keeps the drift back in one piece, with no jump at midnight.
    const before = day.rise && t < day.rise; // after midnight, before sunrise
    const from = before ? sunDay(new Date(day.start - 60000)).set : day.set;
    const to = before ? day.rise : sunDay(new Date(day.end + 60000)).rise;
    x = from && to && to > from ? 0.70 - 0.64 * Math.max(0, Math.min(1, (t - from) / (to - from))) : 0.06;
  }
  // Height, as a share of today's highest point. Negative = set.
  const y = skyHeight(alt, day.peakAlt);
  skyVar(scene, "--sun-x", x.toFixed(3));
  skyVar(scene, "--sun-alt", Math.min(1, y).toFixed(3));
  // The ray follows the sun's height, and reaches further in summer:
  // full length on the longest day, a bit under half on the shortest.
  const reach = 0.45 + 0.55 * season;
  skyVar(scene, "--ray", (Math.max(0, Math.min(1, y)) * reach).toFixed(3));
  // --sun-low: 0 when the sun is high, 1 near the horizon. style.css
  // makes the glow bigger and warmer as it climbs to 1.
  const low = 1 - Math.min(1, Math.max(0, y) / 0.6);
  skyVar(scene, "--sun-low", low.toFixed(3));
  // --sun-show fades the glow and halo out as the sun sinks out of sight.
  skyVar(scene, "--sun-show", Math.max(0, Math.min(1, (y + 0.6) * 3)).toFixed(3));
  // The light on the ground fades in as the sun clears the horizon,
  // strongest when the sun is low.
  skyVar(scene, "--glint-sun", (glint(y) * (0.55 + 0.45 * low)).toFixed(3));
  placeLowSun(scene, t, alt, day);
  // The logo's sun follows the real one a little: up to LOGO_DIP units
  // lower near sunrise and sunset (and all night), right up at noon. The
  // line in front of it hides the part that drops below. It follows
  // swipes and the opening spin too.
  const dip = LOGO_DIP * (1 - Math.max(0, Math.min(1, y / 0.92)));
  setLogoDip(`${dip.toFixed(2)}px`);
  placeOptics(scene, t, x);
  placeShadow(scene, t);
  placeMoon(scene, t);
  placeEclipse(scene, t);
  placeStars(scene, t);
  placeIss(scene, t);
  placeDayVenus(scene, t);
}

/* ---------- The sun near the horizon ----------
   A low sun looks squashed: the air bends the light from its bottom edge
   up more than from its top, so it's flatter top to bottom, and it
   wobbles in the moving air. --sun-flat (0..1) is how much, from
   LOW_SUN_DEG above the horizon down to just under it. In the last few
   minutes before it sets (RIM_DEG and below), its edge ripples too
   (horizon--rim). style.css does the shapes; the wobble and ripple are
   motion only. */
const LOGO_DIP = 3; // logo units; the line in front of the sun is 3.5 to 4 thick
const LOW_SUN_DEG = 4;
const RIM_DEG = 1.5;

/* ---------- The sky's numbers ----------
   placeSun and friends hand style.css a couple of dozen numbers (--sun-x,
   --moon-alt, --ray ...). They used to be set on the whole scene, and a
   custom property is inherited, so every change made the browser work
   out the style of every element in the sky again (hundreds of them, 60
   times a second in the opening spin): that was the stutter. Now each
   number goes only onto the few elements whose CSS reads it, and only
   when it has changed. A new number needs a line here. */
const SKY_VAR_USERS = {
  "--sun-x": ".horizon__sun, .horizon__ray, .horizon__glint--sun, .horizon__pillar, .horizon__sundogs",
  "--sun-alt": ".horizon__sun, .horizon__ray, .horizon__pillar, .horizon__sundogs",
  "--ray": ".horizon__ray",
  "--sun-low": ".horizon__sun",
  "--sun-show": ".horizon__sun",
  "--sun-flat": ".horizon__sun",
  "--glint-sun": ".horizon__glint--sun",
  "--eclipse": ".horizon__moon",
  "--moon-x": ".horizon__moon, .horizon__glint--moon",
  "--moon-alt": ".horizon__moon",
  "--moon-show": ".horizon__moon",
  "--moon-day": ".horizon__moon",
  "--glint-moon": ".horizon__glint--moon",
  "--sundogs": ".horizon__sundogs",
  "--pillar": ".horizon__pillar",
  "--belt": ".horizon__belt",
  "--belt-x": ".horizon__belt",
  "--belt-rise": ".horizon__belt",
  "--rainbow": ".horizon__rainbow",
  "--bow-x": ".horizon__rainbow",
  "--bow-d": ".horizon__rainbow",
  "--land-shadow": ".horizon__shadow",
};

function skyVar(scene, name, value) {
  const vars = scene.skyVars || (scene.skyVars = {});
  value = String(value);
  if (vars[name] === value) return;
  vars[name] = value;
  for (const node of scene.querySelectorAll(SKY_VAR_USERS[name])) node.style.setProperty(name, value);
}

// The last value given for one of the numbers above ("" if none yet)
function skyVarOf(scene, name) {
  return (scene.skyVars && scene.skyVars[name]) || "";
}

// Hand every number out again: for elements added to the scene after
// some numbers were already set (the sun dogs, the elevator's shadow)
function skyVarsAgain(scene) {
  const vars = scene.skyVars;
  scene.skyVars = {};
  for (const name in vars) skyVar(scene, name, vars[name]);
}

// The logo's sun, the same way: only the logo's own three shapes
let logoDip = "", logoParts = null;
function setLogoDip(value) {
  if (value === logoDip) return;
  logoDip = value;
  if (!logoParts) logoParts = document.querySelectorAll(".logo__sun, .logo__halo, .logo__glow");
  for (const node of logoParts) node.style.setProperty("--logo-dip", value);
}

function placeLowSun(scene, t, alt, day) {
  const flat = alt > LOW_SUN_DEG || alt < -1.2 ? 0 : Math.min(1, (LOW_SUN_DEG - alt) / LOW_SUN_DEG);
  skyVar(scene, "--sun-flat", flat.toFixed(3));
  scene.classList.toggle("horizon--low-sun", flat > 0);
  const setting = day.set && t <= day.set && t > (day.rise || 0) + (day.set - (day.rise || 0)) / 2;
  scene.classList.toggle("horizon--rim", Boolean(setting) && alt < RIM_DEG && alt > -1.2);
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
  // Every dot starts in the top left corner; placeStars slides it to its
  // spot with "translate" (see there for why)
  if (DOTS_BY_TRANSLATE) for (const dot of parts) dot.style.left = dot.style.top = "0";
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

// Which way the sky strip faces (compass degrees, 180 = south). The
// compass (see "Tilt and compass" below) turns it to match the phone.
let skyFacing = 180;

// Where compass direction az sits across the sky strip: 0 at the left
// edge, 1 at the right, outside 0..1 when it's off the strip.
function skyX(az) {
  const off = ((((az - skyFacing) % 360) + 540) % 360) - 180; // -180..180, 0 = straight ahead
  return (off + 90) / 180;
}

// Picks a side for each planet's name so two names never sit on top of
// each other when planets are close together. Each name tries the right
// of its dot first, then the left, below and above, and takes the first
// spot that is on screen and clear of the names and dots already placed.
const NAME_SIDES = ["", "planet--flip", "planet--below", "planet--above"];
function placePlanetNames(box) {
  const w = box.clientWidth, h = box.clientHeight;
  const shown = box.planets.filter((p) => p.up && p.dot.firstElementChild);
  if (!w || !shown.length) return;
  const GAP = 6, PAD = 2; // px: dot to name, and breathing room between names
  const hit = (a, b) => a.l < b.r + PAD && b.l < a.r + PAD && a.t < b.b + PAD && b.t < a.b + PAD;
  // Every dot is in the way from the start, so a name never covers a planet
  const taken = shown.map((p) => {
    const x = (p.x / 100) * w, y = (p.y / 100) * h;
    return { l: x - 4, r: x + 4, t: y - 4, b: y + 4, of: p };
  });
  for (const p of shown) {
    const label = p.dot.firstElementChild;
    if (!p.nameW) { p.nameW = label.offsetWidth; p.nameH = label.offsetHeight; } // the words never change
    const x = (p.x / 100) * w, y = (p.y / 100) * h, lw = p.nameW, lh = p.nameH;
    const spots = [
      { l: x + GAP, r: x + GAP + lw, t: y - lh / 2, b: y + lh / 2 }, // right
      { l: x - GAP - lw, r: x - GAP, t: y - lh / 2, b: y + lh / 2 }, // left
      { l: x - lw / 2, r: x + lw / 2, t: y + GAP, b: y + GAP + lh }, // below
      { l: x - lw / 2, r: x + lw / 2, t: y - GAP - lh, b: y - GAP }, // above
    ];
    const fits = (s) => s.l >= 0 && s.r <= w && s.t >= 0 && !taken.some((o) => o.of !== p && hit(s, o));
    let pick = spots.findIndex(fits);
    if (pick < 0) pick = p.x > 85 ? 1 : 0; // nowhere is clear: fall back to the old rule
    NAME_SIDES.forEach((side, i) => side && p.dot.classList.toggle(side, i === pick));
    taken.push({ ...spots[pick], of: null });
  }
}

// Puts every star where it really is at moment "t".
//
// This runs on every frame of the opening spin and of a swipe, so it is
// kept cheap while the sky is moving ("spinning"):
//  - dots are moved with "translate" in pixels, which the browser can do
//    without laying the page out again (left/top made it redo the layout
//    for every star, every frame);
//  - in the light theme the stars can't be seen, so nothing is written;
//  - planet names and constellation lines are hidden, then fitted once
//    and faded back in when the sky has stood still for a moment.
// "settled" is that catch-up call.
const STARS_SETTLE_MS = 160; // how long the sky must stand still before names and lines come back
const DOTS_BY_TRANSLATE = typeof CSS !== "undefined" && CSS.supports && CSS.supports("translate", "1px 1px");
function placeStars(scene, t, settled) {
  const box = scene.querySelector(".horizon__stars");
  if (!box) return;
  if (!box.stars) {
    const small = scene.closest(".page-head");
    makeStars(box, small ? 2 : 4.5, !small);
    // The dots sit at pixel spots, so a new window size needs a new placing
    window.addEventListener("resize", () => {
      box.w = 0;
      if (box.lastT) placeStars(scene, box.lastT, true);
    });
  }
  box.lastT = t;
  const moving = spinning && !settled;
  const dark = document.documentElement.dataset.theme === "dark";
  const write = !moving || dark; // nobody can see them move in daylight
  if (write && !box.w) { box.w = box.clientWidth; box.h = box.clientHeight; }
  const w = box.w, h = box.h;
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
    const across = skyX(az);
    entry.up = !(alt < 2 || across < 0 || across > 1);
    if (entry.up) {
      entry.x = across * 100;
      entry.y = (1 - Math.min(alt, STAR_TOP_ALT) / STAR_TOP_ALT) * 100;
    }
    if (!write) return;
    if (entry.shown !== entry.up) { // below the horizon, or behind us
      entry.shown = entry.up;
      entry.dot.hidden = !entry.up;
    }
    if (!entry.up) return;
    if (DOTS_BY_TRANSLATE && w) {
      entry.dot.style.translate = `${((entry.x / 100) * w).toFixed(1)}px ${((entry.y / 100) * h).toFixed(1)}px`;
    } else {
      entry.dot.style.left = `${entry.x.toFixed(2)}%`;
      entry.dot.style.top = `${entry.y.toFixed(2)}%`;
    }
  };
  for (const entry of box.stars) place(entry, entry.star[0], entry.star[1]);
  for (const entry of box.planets) place(entry, ...planetRaDec(entry.planet.orbit, t));
  clearTimeout(box.settle);
  if (moving) {
    box.classList.add("horizon__stars--moving");
    box.settle = setTimeout(() => placeStars(scene, box.lastT, true), STARS_SETTLE_MS);
    return;
  }
  placePlanetNames(box);
  for (const { a, b, line } of box.lines) {
    const show = a && b && a.up && b.up;
    line.style.display = show ? "" : "none";
    if (!show) continue;
    line.setAttribute("x1", a.x.toFixed(2));
    line.setAttribute("y1", a.y.toFixed(2));
    line.setAttribute("x2", b.x.toFixed(2));
    line.setAttribute("y2", b.y.toFixed(2));
  }
  box.classList.remove("horizon__stars--moving");
}

/* ---------- The space station ----------
   The International Space Station, where it really is. Its orbit comes
   from CelesTrak (the station's latest "orbital elements", fetched at
   most every ISS_MS and kept on the phone); everything else is worked
   out here. SGP4 is the standard way to turn those elements into a
   position, written out below in its near-Earth form (the station is
   low, so the deep-space parts aren't needed). It's checked against the
   satellite.js library to within a kilometre.

   You can only see the station when it's lit by the sun but the ground
   under it is dark: after dusk or before dawn (sun 6° below the horizon
   or more). So the dot only shows then, and only above the horizon in
   the direction the sky strip faces. ?critter=iss shows a pretend pass
   any time. */
const ISS_KEY = "kelbo.iss";
const ISS_MS = 6 * 3600000; // CelesTrak asks for no more than one fetch every 2 hours
const ISS_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json";
const ISS_STALE_MS = 4 * 86400000; // elements older (or newer) than this are too far off to use
const ISS_DARK_SUN = -6; // the sun must be this far below the horizon to see it
const ISS_SHOW_ALT = 2; // degrees: lower than this it's lost in the haze, like the stars
const ISS_PASS_ALT = 10; // degrees: a pass counts from this height
const ISS_WEEK_ALT = 25; // degrees: passes that climb at least this high make Sky this week
let issOrbit = null; // the ready-to-run orbit, once it's loaded
let issLoading = null;

// The Earth, as SGP4 measures it (the WGS-72 model the elements are made for)
const SGP_RE = 6378.135; // km
const SGP_XKE = 60 / Math.sqrt((SGP_RE ** 3) / 398600.8); // sqrt(GM) in Earth radii per minute
const SGP_J2 = 0.001082616, SGP_J3 = -0.00000253881, SGP_J4 = -0.00000165597;

// Gets the orbit ready from CelesTrak's numbers (degrees, revolutions a
// day). Returns null if they look wrong. The steps and names follow the
// standard published SGP4 (Vallado, "Revisiting Spacetrack Report #3").
function sgp4Init(e) {
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const epoch = Date.parse(String(e.EPOCH || "") + (/[zZ+]/.test(String(e.EPOCH).slice(10)) ? "" : "Z"));
  const ecco = num(e.ECCENTRICITY), inclo = num(e.INCLINATION) * D2R, nodeo = num(e.RA_OF_ASC_NODE) * D2R;
  const argpo = num(e.ARG_OF_PERICENTER) * D2R, mo = num(e.MEAN_ANOMALY) * D2R;
  const noKozai = (num(e.MEAN_MOTION) * 2 * Math.PI) / 1440; // radians a minute
  const bstar = num(e.BSTAR);
  if (![epoch, ecco, inclo, nodeo, argpo, mo, noKozai, bstar].every(Number.isFinite) || ecco >= 1 || noKozai <= 0) return null;
  if ((2 * Math.PI) / noKozai >= 225) return null; // a deep-space orbit: not the station

  const x2o3 = 2 / 3;
  const eccsq = ecco * ecco, omeosq = 1 - eccsq, rteosq = Math.sqrt(omeosq);
  const cosio = Math.cos(inclo), cosio2 = cosio * cosio, sinio = Math.sin(inclo);
  // The mean motion the elements give is "Kozai"; SGP4 wants it "Brouwer".
  const ak = (SGP_XKE / noKozai) ** x2o3;
  const d1 = (0.75 * SGP_J2 * (3 * cosio2 - 1)) / (rteosq * omeosq);
  let del = d1 / (ak * ak);
  const adel = ak * (1 - del * del - del * (1 / 3 + (134 * del * del) / 81));
  del = d1 / (adel * adel);
  const no = noKozai / (1 + del);
  const ao = (SGP_XKE / no) ** x2o3;
  const po = ao * omeosq, posq = po * po, rp = ao * (1 - ecco);
  const con42 = 1 - 5 * cosio2, con41 = -con42 - 2 * cosio2;

  // Drag: how thick the air is at the orbit's lowest point
  const isimp = rp < 220 / SGP_RE + 1; // very low orbits use a simpler drag model
  let sfour = 78 / SGP_RE + 1, qzms24 = ((120 - 78) / SGP_RE) ** 4;
  const perige = (rp - 1) * SGP_RE;
  if (perige < 156) {
    sfour = perige < 98 ? 20 : perige - 78;
    qzms24 = ((120 - sfour) / SGP_RE) ** 4;
    sfour = sfour / SGP_RE + 1;
  }
  const pinvsq = 1 / posq, tsi = 1 / (ao - sfour);
  const eta = ao * ecco * tsi, etasq = eta * eta, eeta = ecco * eta;
  const psisq = Math.abs(1 - etasq);
  const coef = qzms24 * tsi ** 4, coef1 = coef / psisq ** 3.5;
  const cc2 = coef1 * no * (ao * (1 + 1.5 * etasq + eeta * (4 + etasq))
    + ((0.375 * SGP_J2 * tsi) / psisq) * con41 * (8 + 3 * etasq * (8 + etasq)));
  const cc1 = bstar * cc2;
  const j3oj2 = SGP_J3 / SGP_J2;
  const cc3 = ecco > 1e-4 ? (-2 * coef * tsi * j3oj2 * no * sinio) / ecco : 0;
  const x1mth2 = 1 - cosio2;
  const cc4 = 2 * no * coef1 * ao * omeosq * (eta * (2 + 0.5 * etasq) + ecco * (0.5 + 2 * etasq)
    - ((SGP_J2 * tsi) / (ao * psisq)) * (-3 * con41 * (1 - 2 * eeta + etasq * (1.5 - 0.5 * eeta))
    + 0.75 * x1mth2 * (2 * etasq - eeta * (1 + etasq)) * Math.cos(2 * argpo)));
  const cc5 = 2 * coef1 * ao * omeosq * (1 + 2.75 * (etasq + eeta) + eeta * etasq);
  const cosio4 = cosio2 * cosio2;
  const temp1 = 1.5 * SGP_J2 * pinvsq * no, temp2 = 0.5 * temp1 * SGP_J2 * pinvsq;
  const temp3 = -0.46875 * SGP_J4 * pinvsq * pinvsq * no;
  // How fast the orbit turns: the mean anomaly, the low point and the node
  const mdot = no + 0.5 * temp1 * rteosq * con41 + 0.0625 * temp2 * rteosq * (13 - 78 * cosio2 + 137 * cosio4);
  const argpdot = -0.5 * temp1 * con42 + 0.0625 * temp2 * (7 - 114 * cosio2 + 395 * cosio4) + temp3 * (3 - 36 * cosio2 + 49 * cosio4);
  const xhdot1 = -temp1 * cosio;
  const nodedot = xhdot1 + (0.5 * temp2 * (4 - 19 * cosio2) + 2 * temp3 * (3 - 7 * cosio2)) * cosio;
  const rec = {
    epoch, ecco, inclo, nodeo, argpo, mo, no, bstar, isimp, eta, con41, x1mth2,
    mdot, argpdot, nodedot, cc1, cc4, cc5,
    omgcof: bstar * cc3 * Math.cos(argpo),
    xmcof: ecco > 1e-4 ? (-x2o3 * coef * bstar) / eeta : 0,
    nodecf: 3.5 * omeosq * xhdot1 * cc1,
    t2cof: 1.5 * cc1,
    xlcof: (-0.25 * j3oj2 * sinio * (3 + 5 * cosio)) / (Math.abs(cosio + 1) > 1.5e-12 ? 1 + cosio : 1.5e-12),
    aycof: -0.5 * j3oj2 * sinio,
    delmo: (1 + eta * Math.cos(mo)) ** 3,
    sinmao: Math.sin(mo),
    x7thm1: 7 * cosio2 - 1,
    d2: 0, d3: 0, d4: 0, t3cof: 0, t4cof: 0, t5cof: 0,
  };
  if (!isimp) {
    const cc1sq = cc1 * cc1;
    rec.d2 = 4 * ao * tsi * cc1sq;
    const temp = (rec.d2 * tsi * cc1) / 3;
    rec.d3 = (17 * ao + sfour) * temp;
    rec.d4 = 0.5 * temp * ao * tsi * (221 * ao + 31 * sfour) * cc1;
    rec.t3cof = rec.d2 + 2 * cc1sq;
    rec.t4cof = 0.25 * (3 * rec.d3 + cc1 * (12 * rec.d2 + 10 * cc1sq));
    rec.t5cof = 0.2 * (3 * rec.d4 + 12 * cc1 * rec.d3 + 6 * rec.d2 * rec.d2 + 15 * cc1sq * (2 * rec.d2 + cc1sq));
  }
  return rec;
}

// Where the station is at moment "date": x, y, z in km from the middle of
// the Earth, in the frame SGP4 uses (TEME: z through the North Pole, x
// toward the spring equinox). null if the maths breaks down.
function sgp4At(rec, date) {
  const TAU = 2 * Math.PI;
  const t = (date.getTime() - rec.epoch) / 60000; // minutes since the elements were made
  const xmdf = rec.mo + rec.mdot * t;
  const argpdf = rec.argpo + rec.argpdot * t;
  const nodedf = rec.nodeo + rec.nodedot * t;
  let argpm = argpdf, mm = xmdf;
  const t2 = t * t;
  let nodem = nodedf + rec.nodecf * t2;
  let tempa = 1 - rec.cc1 * t, tempe = rec.bstar * rec.cc4 * t, templ = rec.t2cof * t2;
  if (!rec.isimp) {
    const delomg = rec.omgcof * t;
    const delm = rec.xmcof * ((1 + rec.eta * Math.cos(xmdf)) ** 3 - rec.delmo);
    mm = xmdf + delomg + delm;
    argpm = argpdf - delomg - delm;
    const t3 = t2 * t, t4 = t3 * t;
    tempa -= rec.d2 * t2 + rec.d3 * t3 + rec.d4 * t4;
    tempe += rec.bstar * rec.cc5 * (Math.sin(mm) - rec.sinmao);
    templ += rec.t3cof * t3 + t4 * (rec.t4cof + t * rec.t5cof);
  }
  const am = (SGP_XKE / rec.no) ** (2 / 3) * tempa * tempa;
  const nm = SGP_XKE / am ** 1.5;
  const em = Math.max(1e-6, rec.ecco - tempe);
  if (!(am > 0.95) || em >= 1) return null; // it would have come down by now
  mm += rec.no * templ;
  const xlm = mm + argpm + nodem;
  nodem %= TAU;
  argpm %= TAU;
  mm = (xlm - argpm - nodem) % TAU;

  // Long-period wobbles
  const axnl = em * Math.cos(argpm);
  let temp = 1 / (am * (1 - em * em));
  const aynl = em * Math.sin(argpm) + temp * rec.aycof;
  const xl = mm + argpm + nodem + temp * rec.xlcof * axnl;

  // Kepler's equation, a few rounds of better guesses
  const u = (xl - nodem) % TAU;
  let eo1 = u, tem5 = 1, sineo1 = 0, coseo1 = 1;
  for (let k = 0; k < 10 && Math.abs(tem5) >= 1e-12; k++) {
    sineo1 = Math.sin(eo1);
    coseo1 = Math.cos(eo1);
    tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / (1 - coseo1 * axnl - sineo1 * aynl);
    tem5 = Math.max(-0.95, Math.min(0.95, tem5));
    eo1 += tem5;
  }

  // Short-period wobbles, then the position
  const ecose = axnl * coseo1 + aynl * sineo1;
  const esine = axnl * sineo1 - aynl * coseo1;
  const el2 = axnl * axnl + aynl * aynl;
  const pl = am * (1 - el2);
  if (pl < 0) return null;
  const rl = am * (1 - ecose);
  const betal = Math.sqrt(1 - el2);
  temp = esine / (1 + betal);
  const sinu = (am / rl) * (sineo1 - aynl - axnl * temp);
  const cosu = (am / rl) * (coseo1 - axnl + aynl * temp);
  let su = Math.atan2(sinu, cosu);
  const sin2u = (cosu + cosu) * sinu, cos2u = 1 - 2 * sinu * sinu;
  temp = 1 / pl;
  const temp1 = 0.5 * SGP_J2 * temp, temp2 = temp1 * temp;
  const cosip = Math.cos(rec.inclo), sinip = Math.sin(rec.inclo);
  const mrt = rl * (1 - 1.5 * temp2 * betal * rec.con41) + 0.5 * temp1 * rec.x1mth2 * cos2u;
  su -= 0.25 * temp2 * rec.x7thm1 * sin2u;
  const xnode = nodem + 1.5 * temp2 * cosip * sin2u;
  const xinc = rec.inclo + 1.5 * temp2 * cosip * sinip * cos2u;
  if (mrt < 1) return null; // underground: the elements are no good
  const sinsu = Math.sin(su), cossu = Math.cos(su);
  const snod = Math.sin(xnode), cnod = Math.cos(xnode);
  const sini = Math.sin(xinc), cosi = Math.cos(xinc);
  const r = mrt * SGP_RE;
  return [
    r * (-snod * cosi * sinsu + cnod * cossu),
    r * (cnod * cosi * sinsu + snod * cossu),
    r * (sini * sinsu),
  ];
}

// The station as seen from here at moment "t": its height in the sky
// (alt) and compass direction (az, 180 = south) in degrees, how far away
// and how high up it is (km), and whether sunlight is on it. null with no
// usable orbit.
function issLook(t) {
  if (!issOrbit || Math.abs(t - issOrbit.epoch) > ISS_STALE_MS) return null;
  const p = sgp4At(issOrbit, t);
  if (!p) return null;
  // Turn the frame with the Earth (sidereal time), so x/y/z are fixed to the ground
  const n = t.getTime() / 86400000 - 10957.5;
  const gmst = ((18.697374558 + 24.06570982441908 * n) * 15) * D2R;
  const cg = Math.cos(gmst), sg = Math.sin(gmst);
  const gx = cg * p[0] + sg * p[1], gy = -sg * p[0] + cg * p[1], gz = p[2];
  // Where we're standing, on the real (slightly squashed) Earth
  const lat = YXE.lat * D2R, lon = YXE.lon * D2R;
  const f = 1 / 298.257223563, e2 = f * (2 - f), a = 6378.137, h = (YXE.elev || 0) / 1000;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const ox = (N + h) * Math.cos(lat) * Math.cos(lon), oy = (N + h) * Math.cos(lat) * Math.sin(lon);
  const oz = (N * (1 - e2) + h) * Math.sin(lat);
  const rx = gx - ox, ry = gy - oy, rz = gz - oz;
  const range = Math.hypot(rx, ry, rz);
  const south = Math.sin(lat) * Math.cos(lon) * rx + Math.sin(lat) * Math.sin(lon) * ry - Math.cos(lat) * rz;
  const east = -Math.sin(lon) * rx + Math.cos(lon) * ry;
  const up = Math.cos(lat) * Math.cos(lon) * rx + Math.cos(lat) * Math.sin(lon) * ry + Math.sin(lat) * rz;
  const alt = Math.asin(up / range) * R2D;
  const az = (Math.atan2(east, -south) * R2D + 360) % 360;
  // In the Earth's shadow? (a cylinder behind the Earth, away from the sun)
  const { ra, dec } = sunPosition(t);
  const sx = Math.cos(dec) * Math.cos(ra), sy = Math.cos(dec) * Math.sin(ra), sz = Math.sin(dec);
  const along = p[0] * sx + p[1] * sy + p[2] * sz;
  const r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
  const sunlit = along > 0 || Math.sqrt(Math.max(0, r2 - along * along)) > 6371;
  return { alt, az, range, height: Math.sqrt(r2) - 6371, sunlit };
}

// Can it be seen right now? Up, lit by the sun, and the sky dark enough.
function issSeen(look, t) {
  return Boolean(look && look.alt >= ISS_SHOW_ALT && look.sunlit && sunAltitude(t) <= ISS_DARK_SUN);
}

// Fetches the orbit once (kept on the phone for ISS_MS). Never throws.
function loadIss() {
  if (!issLoading) {
    issLoading = cachedFetch(ISS_KEY, ISS_MS, ISS_URL, (list) => {
      const e = Array.isArray(list) ? list[0] : list;
      const keep = ["EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY", "BSTAR"];
      return Object.fromEntries(keep.map((k) => [k, e && e[k]]));
    })
      .then((elements) => { issOrbit = sgp4Init(elements); })
      .catch(() => { issOrbit = null; });
  }
  return issLoading;
}

// The pretend pass for ?critter=iss: low in the west-southwest, up
// through the south, down in the east-southeast, every 40 seconds (it
// stays put mid-pass with "reduce motion").
function issPreview() {
  const s = REDUCE_MOTION ? 0.5 : ((Date.now() / 1000) % 40) / 40;
  return { alt: 8 + 50 * Math.sin(Math.PI * s), az: 245 - 130 * s, range: 700, height: 420, sunlit: true, preview: true };
}

// Puts the station's dot where it is at moment "t" (from placeSun), or
// hides it. While it's crossing the live sky, it re-places itself every
// second (every 5 with "reduce motion", without gliding) until it's gone.
function placeIss(scene, t) {
  if (!scene.iss) {
    const box = el("div", "horizon__iss");
    const dot = el("b", "iss");
    if (!scene.closest(".page-head")) dot.append(el("span", "", "ISS")); // named on the big home sky
    box.append(dot);
    (scene.querySelector(".horizon__stars") || scene.firstElementChild).after(box);
    scene.iss = { box, dot, look: null, timer: 0 };
  }
  const it = scene.iss;
  const preview = CRITTER === "iss";
  const look = preview ? issPreview() : issLook(t);
  const across = look ? skyX(look.az) : -1;
  const seen = (preview || issSeen(look, t)) && across >= 0 && across <= 1;
  it.look = seen ? look : null;
  const live = Math.abs(t - Date.now()) < 5000 && !swiping;
  it.dot.classList.toggle("iss--glide", live && !REDUCE_MOTION && !it.dot.hidden);
  it.dot.hidden = !seen;
  if (seen) {
    it.dot.style.left = `${(across * 100).toFixed(2)}%`;
    it.dot.style.top = `${((1 - Math.min(look.alt, STAR_TOP_ALT) / STAR_TOP_ALT) * 100).toFixed(2)}%`;
  }
  clearTimeout(it.timer);
  if (seen && live) it.timer = setTimeout(() => placeIss(scene, new Date()), REDUCE_MOTION ? 5000 : 1000);
}

// Venus by day (see dayVenus): a faint ivory pinprick at its real spot,
// in its own layer because the stars' layer is hidden by day. It only
// shows in the light theme; after dark the planets layer has it.
// ?critter=venus shows it any time, at a made-up spot.
function placeDayVenus(scene, t) {
  if (!scene.dayVenus) {
    const box = el("div", "horizon__day-venus");
    const dot = el("b", "day-venus planet"); // .planet: its name label looks like the night planets'
    if (!scene.closest(".page-head")) dot.append(el("span", "", "Venus"));
    box.append(dot);
    (scene.iss ? scene.iss.box : scene.querySelector(".horizon__stars")).after(box);
    scene.dayVenus = { dot, look: null };
  }
  const look = CRITTER === "venus" ? { alt: 40, az: 150, gap: 35, preview: true } : dayVenus(t);
  const across = look ? skyX(look.az) : -1;
  const seen = Boolean(look) && across >= 0 && across <= 1;
  scene.dayVenus.look = seen ? look : null;
  scene.dayVenus.dot.hidden = !seen;
  if (!seen) return;
  scene.dayVenus.dot.style.left = `${(across * 100).toFixed(2)}%`;
  scene.dayVenus.dot.style.top = `${((1 - Math.min(look.alt, STAR_TOP_ALT) / STAR_TOP_ALT) * 100).toFixed(2)}%`;
  scene.dayVenus.dot.classList.toggle("planet--flip", across > 0.85);
}

// "Space station overhead · look southwest" for the readout while it's up.
function issLine(t) {
  const look = issLook(t);
  return issSeen(look, t) ? `Space station passing over · look ${compassName(look.az)}` : "";
}

// The station's visible passes between start and end (ms): when each
// starts and ends, how high it climbs and which way it goes. Checked
// every 30 seconds.
function issPasses(start, end) {
  const passes = [];
  if (!issOrbit) return passes;
  let pass = null;
  for (let at = start; at <= end; at += 30000) {
    const t = new Date(at);
    const look = issLook(t);
    const ok = look && look.alt >= ISS_PASS_ALT && look.sunlit && sunAltitude(t) <= ISS_DARK_SUN;
    if (ok) {
      if (!pass) pass = { start: at, from: look.az, peak: look.alt };
      pass.end = at;
      pass.to = look.az;
      pass.peak = Math.max(pass.peak, look.alt);
    } else if (pass) {
      passes.push(pass);
      pass = null;
    }
  }
  if (pass) passes.push(pass);
  return passes;
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
  skyVar(scene, "--eclipse", lunar ? lunar.share.toFixed(3) : 0); // style.css dims the glow
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
  const y = skyHeight(alt, span.peak);
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
  skyVar(scene, "--moon-x", x.toFixed(3));
  skyVar(scene, "--moon-alt", Math.min(1, y).toFixed(3));
  skyVar(scene, "--moon-show", show.toFixed(3));
  skyVar(scene, "--moon-day", (1 - night).toFixed(3)); // style.css: paler, no glow
  skyVar(scene, "--glint-moon", (glint(y) * 0.6 * night).toFixed(3));
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
      const rx = skyX(az) * w;
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

  // A burst of n meteors over `over` ms (for the parade), dark or not.
  scene.meteorBurst = (n, over) => {
    for (let i = 0; i < n; i++) setTimeout(() => launch(timeNow(), null), Math.random() * over);
  };

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
// A rare twist on a wish: about one in twelve says it already came true
// and sends up a heart. Preview it every time with ?wish=true.
const WISH_TRUE_CHANCE = 1 / 12;
const WISH_TRUE = new URLSearchParams(location.search).get("wish") === "true";

// One heart shape (in a 16 x 16 box) for every heart in the sky: the Home
// Base window, the rare wish and Valentine's Day all draw this one.
const HEART_PATH = "M8 14.5C2.5 10.2 1 7.6 1 5.2C1 3.1 2.6 1.5 4.6 1.5C6 1.5 7.2 2.2 8 3.4C8.8 2.2 10 1.5 11.4 1.5C13.4 1.5 15 3.1 15 5.2C15 7.6 13.5 10.2 8 14.5Z";

// A small lilac heart that floats up from a spot (x, y on the page) and
// fades away. Not with "reduce motion".
function floatHeart(scene, x, y) {
  if (REDUCE_MOTION || typeof Element.prototype.animate !== "function") return;
  const box = scene.getBoundingClientRect();
  const heart = svgNode("svg", { class: "horizon__heart", viewBox: "0 0 16 16", "aria-hidden": "true" });
  heart.append(svgNode("path", { d: HEART_PATH }));
  heart.style.left = `${(x - box.left - 5).toFixed(1)}px`;
  heart.style.top = `${(y - box.top - 5).toFixed(1)}px`;
  scene.append(heart);
  const sway = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4);
  heart.animate(
    [{ transform: "translate(0, 0) scale(0.5)", opacity: 0 },
     { transform: `translate(${(sway / 2).toFixed(1)}px, -10px) scale(1)`, opacity: 1, offset: 0.2 },
     { transform: `translate(${sway.toFixed(1)}px, -40px) scale(1.1)`, opacity: 0 }],
    { duration: 1800, easing: "ease-out" }
  ).onfinish = () => heart.remove();
}
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

/* Tapping the sun sends a soft clay lens flare across the sky: a long
   streak through the sun and a few faint rings along a line from the sun
   through the middle of the sky, like light bouncing inside a camera
   lens. It fades out in a second or so. Only while the sun is up, and
   not with "reduce motion". */
function sunFlare(scene, sun, t) {
  if (REDUCE_MOTION || sunAltitude(t) < 0 || typeof Element.prototype.animate !== "function") return;
  const box = scene.getBoundingClientRect();
  const x = sun.x - box.left, y = sun.y - box.top;
  const flare = el("div", "sun-flare");
  flare.setAttribute("aria-hidden", "true");
  const streak = el("i", "sun-flare__streak");
  streak.style.left = `${x}px`;
  streak.style.top = `${y}px`;
  flare.append(streak);
  // Rings along the line from the sun through the middle and beyond
  const mx = box.width / 2, my = box.height * 0.45;
  [[0.55, 0.5], [1.25, 0.3], [1.7, 0.8], [2.2, 0.45]].forEach(([k, size]) => {
    const ring = el("i", "sun-flare__ring");
    const d = sun.r * 2 * size;
    ring.style.width = ring.style.height = `${d.toFixed(1)}px`;
    ring.style.left = `${(x + (mx - x) * k - d / 2).toFixed(1)}px`;
    ring.style.top = `${(y + (my - y) * k - d / 2).toFixed(1)}px`;
    flare.append(ring);
  });
  scene.append(flare);
  streak.animate(
    [{ transform: "translate(-50%, -50%) scaleX(0.1)", opacity: 0 },
     { transform: "translate(-50%, -50%) scaleX(1)", opacity: 0.85, offset: 0.25 },
     { transform: "translate(-50%, -50%) scaleX(1.15)", opacity: 0 }],
    { duration: 1400, easing: "ease-out" }
  );
  flare.querySelectorAll(".sun-flare__ring").forEach((ring, i) => {
    ring.animate(
      [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)", offset: 0.3 }, { opacity: 0, transform: "scale(1.1)" }],
      { duration: 1300, delay: 60 * i, easing: "ease-out", fill: "backwards" }
    );
  });
  setTimeout(() => flare.remove(), 1700);
}

function setUpSkyTaps(scene, timeNow) {
  const tip = document.createElement("p");
  tip.className = "horizon__tip";
  tip.hidden = true;
  scene.append(tip);
  let hideTimer = 0;

  // Shows the label just above a spot (x, y on the page) that's r big,
  // or just below it if there's no room above. Room is measured inside the
  // hero or page head, because those cut off anything past their edges
  // (a page-head sky is short, so its sun sits right on the bottom edge).
  function show(x, y, r, title, detail) {
    const box = scene.getBoundingClientRect();
    const frame = (scene.closest(".hero, .page-head") || scene).getBoundingClientRect();
    tip.replaceChildren(el("strong", "", title), el("span", "", detail));
    tip.hidden = false;
    const half = tip.offsetWidth / 2;
    const left = Math.max(half, Math.min(box.width - half, x - box.left)); // kept inside the sky's width
    const need = tip.offsetHeight + 10;
    const below = y - r - frame.top < need && frame.bottom - (y + r) >= need;
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
    const badge = WISH_BADGES.find(([n]) => n === count && n > 1);
    if (badge) show(x, y, 0, `Badge: ${badge[1]}`, `${count} wishes on this device`);
    else if (count > 1 && (WISH_TRUE || Math.random() < WISH_TRUE_CHANCE)) {
      // The rare one (never the first wish, never a milestone)
      show(x, y, 0, "Wish granted", "This one already came true");
      floatHeart(scene, x, y);
    } else show(x, y, 0, "Wish made", count === 1 ? "Your first one on this device" : `That's ${count} on this device`);
    showWishes(document.querySelector("[data-wishes]"));
    checkBadges();
  }

  // Everything that could be tapped right now, with where it is on screen.
  function targets(t) {
    const list = [];
    const centre = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    };
    // A secret, after dark on the home page: the elevator's top window is
    // lit, and tapping it sends up a heart. Listed before the elevator so
    // a tap on the window picks this and not "Grain elevator".
    if (scene.homeLight && document.documentElement.dataset.theme === "dark" && document.querySelector("[data-badges]")
      && scene.elevator.getBoundingClientRect().width) {
      const at = centre(scene.homeLight);
      list.push({
        ...at, r: 10, title: "Home base", detail: "Full HP restored",
        onTap: () => { floatHeart(scene, at.x, at.y); buzz(30); spot("home"); },
      });
    }
    if (scene.elevator && scene.elevator.getBoundingClientRect().width) {
      list.push({ ...centre(scene.elevator), title: "Grain elevator", detail: elevatorFact(t) });
    }
    if (scene.windmill && scene.windmill.getBoundingClientRect().width) {
      list.push({ ...centre(scene.windmill), title: "Windmill", detail: windmillFact() });
    }
    const pumpkin = scene.querySelector(".horizon__pumpkin");
    if (pumpkin && pumpkin.getBoundingClientRect().width) {
      list.push({ ...centre(pumpkin), r: 8, title: "Jack-o'-lantern", detail: "Happy Halloween from Longlight" });
    }
    if (scene.depot && scene.depot.getBoundingClientRect().width) {
      list.push({ ...centre(scene.depot), title: "Longlight Station", detail: scene.trainRunning ? "A freight train is rolling through" : "A freight train rolls through every few minutes" });
    }
    const sun = scene.querySelector(".horizon__sun");
    if (sun && sunAltitude(t) > -1) {
      const au = sunDistanceAU(t);
      list.push({ ...centre(sun), title: "The Sun", detail: `Light takes ${lightTime((au * AU_KM) / LIGHT_KM_S)} to get here` });
    }
    const moon = scene.querySelector(".horizon__moon");
    if (moon && moonSpanAt(t).up && parseFloat(skyVarOf(scene, "--moon-show")) > 0.15) {
      const phase = moonPhase(t);
      const span = moonSpanAt(t);
      list.push({ ...centre(moon), title: `${moonName(phase)} moon`, detail: `${Math.round(moonLit(phase) * 100)}% lit · sets ${clock(new Date(span.next))}` });
    }
    if (scene.dayVenus && scene.dayVenus.look && document.documentElement.dataset.theme !== "dark") {
      const v = scene.dayVenus.look;
      list.push({
        ...centre(scene.dayVenus.dot), r: 6, title: "Venus, in daylight",
        detail: v.preview ? "Pretend spot · it really is bright enough to see by day" : `${Math.round(v.gap)}° from the Sun · hide the Sun behind a roof edge, then look here`,
      });
    }
    // Birds and balloons that say what they are (setUpCritters keeps the list)
    for (const c of scene.tapCritters || []) {
      if (c.node.isConnected) list.push({ ...centre(c.node), r: c.r || Math.max(8, centre(c.node).r), title: c.title, detail: typeof c.detail === "function" ? c.detail() : c.detail, onTap: c.onTap });
    }
    if (scene.iss && scene.iss.look) {
      const look = scene.iss.look;
      list.push({
        ...centre(scene.iss.dot), r: 7, title: "International Space Station",
        detail: look.preview
          ? "Pretend pass · 420 km up · 28,000 km/h"
          : `${Math.round(look.height)} km up, ${Math.round(look.range).toLocaleString()} km away · 28,000 km/h`,
      });
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

  // Tapping a cloud puffs it apart: it breaks into round puffs that
  // drift off and fade, and the cloud starts over from the left edge a
  // while later. By day only (clouds are barely there at night), and
  // not with "reduce motion".
  function puffCloud(px, py) {
    if (REDUCE_MOTION || !scene.clouds || document.documentElement.dataset.theme === "dark") return false;
    const hit = Array.from(scene.clouds.querySelectorAll(".cloud")).find((c) => {
      const r = c.getBoundingClientRect();
      // a little extra all round, and above for the bumps on top
      return px >= r.left - 6 && px <= r.right + 6 && py >= r.top - r.height * 0.8 && py <= r.bottom + 6;
    });
    if (!hit) return false;
    const r = hit.getBoundingClientRect();
    const layer = scene.clouds.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const puff = el("i", "cloud-puff");
      const size = r.height * (0.7 + Math.random() * 0.5);
      puff.style.width = puff.style.height = `${size.toFixed(1)}px`;
      puff.style.left = `${(r.left - layer.left + ((i + 0.5) / 5) * r.width - size / 2).toFixed(1)}px`;
      puff.style.top = `${(r.top - layer.top + r.height / 2 - size / 2 - (i % 2) * r.height * 0.35).toFixed(1)}px`;
      scene.clouds.append(puff);
      const dx = ((i + 0.5) / 5 - 0.5) * r.width * 1.3 + (Math.random() - 0.5) * 20;
      const dy = -r.height * (0.2 + Math.random() * 0.9);
      puff.animate(
        [{ transform: "translate(0, 0) scale(1)", opacity: 1 }, { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(1.2 + Math.random() * 0.5).toFixed(2)})`, opacity: 0 }],
        { duration: 1300 + Math.random() * 700, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }
      ).onfinish = () => puff.remove();
    }
    // Start the cloud's drift over, from just off the left edge
    hit.style.animationName = "none";
    void hit.offsetWidth;
    hit.style.animationDelay = "0s";
    hit.style.animationName = "";
    return true;
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
    // In a thunderstorm, tapping the sky calls down a bolt of lightning
    // where you tapped, and a moment later the thunder: the gap between
    // the two says how far away it was (3 seconds for every kilometre).
    if (bestGap > 0 && scene.classList.contains("horizon--storm") && !REDUCE_MOTION) {
      tip.hidden = true;
      const gap = 1 + Math.floor(Math.random() * 6);
      strike(scene, e.clientX);
      const x = e.clientX, y = e.clientY;
      setTimeout(() => {
        buzz([90, 40, 160, 60, 80]);
        show(x, y, 0, "Boom", `Thunder ${gap} s after the flash: about ${(gap / 3).toFixed(1)} km away`);
      }, gap * 1000);
      return;
    }
    // A tap right on the sun or moon still names it, even behind a cloud
    if (bestGap > 0 && puffCloud(e.clientX, e.clientY)) {
      tip.hidden = true;
      return;
    }
    // Seven quick taps on the sun start the secret parade
    if (best && best.title === "The Sun") {
      sunFlare(scene, best, t);
      const at = performance.now();
      sunTaps = sunTaps.filter((s) => at - s < 5000).concat(at);
      if (sunTaps.length >= PARADE_TAPS) {
        sunTaps = [];
        return startParade(scene, (title, detail) => show(best.x, best.y, best.r, title, detail));
      }
      if (sunTaps.length >= 4) return show(best.x, best.y, best.r, "The Sun", `Keep going… ${PARADE_TAPS - sunTaps.length} more`);
    }
    if (best && best.onTap) best.onTap(); // the train and the stock car count toward badges
    if (best) show(best.x, best.y, best.r, best.title, best.detail);
    else tip.hidden = true;
  });

  // Typing "longlight" anywhere on the page (not in a form) starts it too
  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-9);
    if (typed === "longlight") {
      typed = "";
      const box = scene.getBoundingClientRect();
      startParade(scene, (title, detail) => show(box.left + box.width / 2, box.top + box.height * 0.4, 0, title, detail));
    }
  });
}

/* ---------- The secret parade ----------
   Tap the sun seven times in a row (or type "longlight" on a keyboard)
   and everything comes out at once: geese, a jet, the train, a hawk, a
   kite, pelicans, a balloon, snow buntings, bats, tumbleweeds, leaves,
   shooting stars, the northern lights and fireworks. It earns the hidden Parade marshal badge. */
const PARADE_TAPS = 7;
const PARADE_KEY = "kelbo.parade";
let sunTaps = [];

function startParade(scene, say) {
  writeJSON(PARADE_KEY, Date.now());
  if (!scene.parade) {
    // No critters with "reduce motion": the badge still counts
    say("Parade!", "It's off while your phone asks for less motion, but the badge is yours");
  } else {
    say("Parade!", "Everything in the sky, all at once");
    scene.parade();
  }
  checkBadges();
}

// A short buzz on phones that can (Android; iPhones don't let websites
// vibrate). Only after the visitor has tapped the page, which phones require.
function buzz(pattern) {
  if (!navigator.vibrate || REDUCE_MOTION) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate(pattern);
  } catch (e) {}
}

// A bolt of lightning from the clouds down to the horizon at page x
// (anywhere across the sky if x is missing), with the sky flash.
function strike(scene, x) {
  const layer = scene.bolts;
  if (!layer) return;
  const box = layer.getBoundingClientRect();
  const w = box.width, h = scene.querySelector(".horizon__stars").clientHeight;
  if (!w || !h) return;
  const bx = x == null ? w * (0.1 + Math.random() * 0.8) : x - box.left;
  // A jagged path from the top of the sky to the ground, with one fork
  let px = bx + (Math.random() - 0.5) * 40, py = 0;
  let d = `M${px.toFixed(1)} 0`, fork = "";
  const steps = 9;
  for (let i = 1; i <= steps; i++) {
    px += (Math.random() - 0.5) * 22;
    py = (h * i) / steps;
    if (i === steps) px = bx;
    d += `L${px.toFixed(1)} ${py.toFixed(1)}`;
    if (i === 3) fork = `M${px.toFixed(1)} ${py.toFixed(1)}l${((Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16)).toFixed(1)} ${(h * 0.18).toFixed(1)}l${((Math.random() - 0.5) * 12).toFixed(1)} ${(h * 0.12).toFixed(1)}`;
  }
  const svg = svgNode("svg", { class: "bolt", viewBox: `0 0 ${w.toFixed(0)} ${h.toFixed(0)}`, width: w.toFixed(0), height: h.toFixed(0) });
  svg.append(svgNode("path", { d: d + fork }));
  layer.append(svg);
  svg.animate([{ opacity: 1 }, { opacity: 0.2, offset: 0.25 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration: 650, easing: "ease-out" })
    .onfinish = () => svg.remove();
  scene.classList.remove("horizon--flash");
  void scene.offsetWidth;
  scene.classList.add("horizon--flash");
  buzz(40);
}

/* ---------- Real weather and the northern lights ----------
   The only parts of the sky that use the internet, all free with no
   key: Open-Meteo for Saskatoon's weather right now (clouds drift past,
   rain or snow falls, lightning in a thunderstorm, fog low down, snow
   on the ground while there's real snow lying), and NOAA's space
   weather feed for the northern lights (soft lilac curtains at the top
   of the night sky when they're likely this far south). Each is checked
   at most every 15 or 20 minutes and kept on the phone in between. If
   any can't be reached the sky just carries on without it.
   Open-Meteo's free air quality feed adds the smoke in the air (for a
   smoky red sun), and the weather also brings high cloud, wind,
   dampness and recent rain for the day sky below (sun dogs, rainbows,
   heat shimmer, contrails, leaves in the wind, a hawk or a kite).
   Winter ground: frost glitter on the snow on a clear, bitter morning,
   and snow blowing along the ground on a windy day.
   Preview with ?weather=clear|cloudy|overcast|rain|snow|storm|fog,
   ?weather=sundogs|smoke|rainbow|hot|windy|frost|drift and ?kp=6 (any
   number 0..9). Frost wants a morning time too: &at=2026-12-15T09:30 */
const WEATHER_KEY = "kelbo.weather";
const WEATHER_MS = 15 * 60000;
const KP_KEY = "kelbo.kp";
const KP_MS = 20 * 60000;
const AIR_KEY = "kelbo.air";
let weather = null; // { code, cloud, temp, snow, high, wind, windFrom, damp, wet } once known
let kp = null; // the latest Kp index (0..9) once known
let pm25 = null; // smoke and dust in the air (PM2.5, µg/m³) once known

// What Open-Meteo's weather codes mean, in words for the readout
const WEATHER_WORDS = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers",
  81: "Rain showers", 82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

// Made-up weather for ?weather= previews: [code, cloud cover %, snow on
// the ground, and anything else to set: temp (°C), high (high cloud %),
// wind (km/h), windFrom (degrees, 270 = from the west), damp (humidity
// %), wet (rain in the last couple of hours) or pm (smoke, PM2.5)]
const WEATHER_PREVIEWS = {
  clear: [0, 0, false], cloudy: [2, 55, false], overcast: [3, 100, false], rain: [63, 100, false],
  snow: [73, 100, true], storm: [95, 100, false], fog: [45, 100, false],
  sundogs: [1, 30, true, { temp: -24, high: 40, damp: 80 }], smoke: [0, 5, false, { temp: 24, pm: 120 }],
  rainbow: [2, 45, false, { temp: 17, wet: true }], hot: [0, 5, false, { temp: 33, damp: 30 }],
  windy: [1, 25, false, { temp: 16, wind: 38, windFrom: 290 }],
  frost: [0, 5, true, { temp: -22 }], drift: [1, 25, true, { temp: -12, wind: 42, windFrom: 290 }],
  calm: [0, 5, false, { temp: 18, wind: 0, windFrom: 290 }],
  pillar: [0, 10, true, { temp: -27, high: 15, damp: 80 }], warm: [1, 10, false, { temp: 26, wind: 8, windFrom: 290 }],
};

// The ?weather= preview asked for, or null
function weatherPreview() {
  const name = new URLSearchParams(location.search).get("weather");
  return Object.prototype.hasOwnProperty.call(WEATHER_PREVIEWS, name) ? WEATHER_PREVIEWS[name] : null;
}

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
  const preview = weatherPreview();
  if (preview) {
    const more = preview[3] || {};
    weather = Object.assign({ code: preview[0], cloud: preview[1], snow: preview[2], temp: null, wet: false }, more);
    pm25 = Number.isFinite(more.pm) ? more.pm : null;
    return Promise.resolve();
  }
  if (new URLSearchParams(location.search).has("at")) return Promise.resolve(); // a preview of another time: today's weather wouldn't fit
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${YXE.lat}&longitude=${YXE.lon}`
    + "&current=temperature_2m,weather_code,cloud_cover,cloud_cover_high,snow_depth,wind_speed_10m,"
    + "wind_direction_10m,relative_humidity_2m,precipitation&hourly=precipitation&past_hours=2&forecast_hours=1";
  return cachedFetch(`${WEATHER_KEY}:${YXE.lat},${YXE.lon}`, WEATHER_MS, url, (d) => ({
    code: d.current.weather_code,
    cloud: d.current.cloud_cover,
    temp: d.current.temperature_2m,
    snow: d.current.snow_depth > 0,
    high: d.current.cloud_cover_high,
    wind: d.current.wind_speed_10m,
    windFrom: d.current.wind_direction_10m,
    damp: d.current.relative_humidity_2m,
    // Any rain in the last couple of hours (for rainbows)
    wet: d.current.precipitation > 0 || ((d.hourly && d.hourly.precipitation) || []).some((mm) => mm > 0),
  }))
    .then((w) => { weather = w; })
    .catch(() => {});
}

// The smoke in the air: PM2.5, the fine particles that wildfire smoke is
// mostly made of. Clean prairie air is under 10; a smoky day is 30 to
// well over 100.
function loadAir() {
  if (weatherPreview() || new URLSearchParams(location.search).has("at")) return Promise.resolve(); // previews bring their own
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${YXE.lat}&longitude=${YXE.lon}&current=pm2_5`;
  return cachedFetch(`${AIR_KEY}:${YXE.lat},${YXE.lon}`, WEATHER_MS, url, (d) => d.current.pm2_5)
    .then((pm) => { pm25 = Number.isFinite(pm) ? pm : null; })
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

/* ---------- Forecasts for Sky this week, and weather warnings ----------
   Three more free calls with no key, each kept on the phone between
   checks and skipped quietly if they can't be reached:
   - NOAA's 3-day aurora forecast (Kp in 3-hour blocks), so Sky this
     week can say which nights the northern lights might reach here.
   - Open-Meteo's hourly cloud forecast for the week, so each thing to
     look at in Sky this week says whether the sky should be clear.
   - Environment Canada's weather alerts (blizzard, extreme cold, fog...)
     for the spot under the sky, shown as a pill on the home sky that
     opens their forecast page. Their feed covers Canada only.
   Previews: ?kpcast=5 (every block), ?clouds=10 (every hour, 0..100),
   ?alert=warning|watch|advisory. They work with ?at= too; without a
   preview, ?at= skips these, since today's forecast wouldn't fit. */
const KP_CAST_KEY = "kelbo.kpCast";
const KP_CAST_MS = 3 * 3600000;
const CLOUDS_KEY = "kelbo.clouds";
const CLOUDS_MS = 60 * 60000;
const ALERTS_KEY = "kelbo.alerts";
const ALERTS_MS = 15 * 60000;
const BLOCK_MS = 3 * 3600000; // NOAA's Kp blocks are 3 hours long
let kpCast = null; // [[block start ms, Kp], ...] for blocks still to come
let cloudCast = null; // { start: ms of the first hour, cover: [cloud %, one per hour] }
let alerts = null; // [{ name, type, ends, expires }], most serious first

function loadKpCast() {
  const q = new URLSearchParams(location.search);
  if (q.has("kpcast")) {
    const k = parseFloat(q.get("kpcast")) || 0;
    const first = Math.floor(now().getTime() / BLOCK_MS) * BLOCK_MS;
    kpCast = Array.from({ length: 24 }, (_, i) => [first + i * BLOCK_MS, k]);
    return Promise.resolve();
  }
  if (q.has("at")) return Promise.resolve();
  return cachedFetch(KP_CAST_KEY, KP_CAST_MS, "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json", (list) =>
    // Keep the blocks NOAA hasn't measured yet ("estimated" or "predicted").
    // Its times are UTC without the Z.
    list.filter((row) => row.observed !== "observed" && Number.isFinite(row.kp))
      .map((row) => [Date.parse(`${row.time_tag}Z`), row.kp]))
    .then((list) => { kpCast = list; })
    .catch(() => {});
}

function loadClouds() {
  const q = new URLSearchParams(location.search);
  if (q.has("clouds")) {
    const cover = Math.min(100, Math.max(0, parseFloat(q.get("clouds")) || 0));
    cloudCast = { start: now().getTime() - 2 * 86400000, cover: Array(10 * 24).fill(cover) };
    return Promise.resolve();
  }
  if (q.has("at")) return Promise.resolve();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${YXE.lat}&longitude=${YXE.lon}`
    + "&hourly=cloud_cover&forecast_days=8&timeformat=unixtime&timezone=GMT";
  return cachedFetch(`${CLOUDS_KEY}:${YXE.lat},${YXE.lon}`, CLOUDS_MS, url, (d) => ({
    start: d.hourly.time[0] * 1000, // the hours come one apart, so only the first time is kept
    cover: d.hourly.cloud_cover,
  }))
    .then((c) => { cloudCast = c; })
    .catch(() => {});
}

// Forecast cloud cover (%) for the hour nearest ms, or null if unknown.
function cloudAt(ms) {
  if (!cloudCast) return null;
  const c = cloudCast.cover[Math.round((ms - cloudCast.start) / 3600000)];
  return Number.isFinite(c) ? c : null;
}

// Made-up alerts for ?alert= previews
const ALERT_PREVIEWS = {
  warning: { name: "Blizzard warning", type: "warning" },
  watch: { name: "Winter storm watch", type: "watch" },
  advisory: { name: "Fog advisory", type: "advisory" },
};

function loadAlerts() {
  const q = new URLSearchParams(location.search);
  if (q.has("alert")) {
    const made = ALERT_PREVIEWS[q.get("alert")];
    const t = now().getTime();
    alerts = made ? [{ ...made, ends: t + 9 * 3600000, expires: t + 9 * 3600000 }] : [];
    return Promise.resolve();
  }
  if (q.has("at")) return Promise.resolve();
  // A small box around the spot; any alert area touching it counts
  const box = [YXE.lon - 0.03, YXE.lat - 0.02, YXE.lon + 0.03, YXE.lat + 0.02].map((n) => n.toFixed(3)).join(",");
  const url = `https://api.weather.gc.ca/collections/weather-alerts/items?f=json&lang=en&skipGeometry=true&limit=20&bbox=${box}`;
  const rank = { warning: 0, watch: 1, advisory: 2, statement: 3 };
  return cachedFetch(`${ALERTS_KEY}:${YXE.lat},${YXE.lon}`, ALERTS_MS, url, (d) => {
    const seen = new Set();
    return (d.features || []).map((f) => f.properties || {})
      .filter((p) => p.alert_name_en && p.status_en !== "ended")
      .map((p) => ({
        name: p.alert_name_en.charAt(0).toUpperCase() + p.alert_name_en.slice(1),
        type: p.alert_type,
        ends: Date.parse(p.event_end_datetime || p.expiration_datetime),
        expires: Date.parse(p.expiration_datetime),
      }))
      .filter((a) => !seen.has(a.name) && seen.add(a.name)) // the same alert can cover several areas
      .sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9));
  })
    .then((list) => { alerts = list; })
    .catch(() => {});
}

// The alert pill on the home sky ([data-horizon-alert]): the most serious
// alert, "+1 more" if there are others, linking to Environment Canada.
function setUpAlert() {
  const pill = document.querySelector("[data-horizon-alert]");
  if (!pill) return;
  // Taps on the pill open the link; they mustn't also swipe or tap the sky
  ["pointerdown", "click"].forEach((type) => pill.addEventListener(type, (e) => e.stopPropagation()));
  const show = () => {
    const t = Date.now();
    const live = (alerts || []).filter((a) => !(a.expires < t));
    const sky = pill.closest(".horizon");
    if (!live.length) {
      pill.hidden = true;
      sky?.style.removeProperty("--alert-room");
      return;
    }
    const top = live[0];
    let until = "";
    if (Number.isFinite(top.ends) && top.ends > t) {
      const ends = new Date(top.ends);
      const sameDay = localParts(ends).d === localParts(new Date(t)).d && top.ends - t < 86400000;
      until = `until ${sameDay ? "" : `${localParts(ends).weekday} `}${clock(ends)}`;
    }
    pill.href = `https://weather.gc.ca/en/location/index.html?coords=${YXE.lat.toFixed(3)},${YXE.lon.toFixed(3)}`;
    pill.classList.toggle("horizon__alert--warning", top.type === "warning");
    pill.replaceChildren(
      el("span", "", top.name),
      until ? el("span", "horizon__alert-extra", ` · ${until}`) : "",
      live.length > 1 ? el("span", "", ` +${live.length - 1}`) : ""
    );
    pill.setAttribute("aria-label", `Environment Canada: ${live.map((a) => a.name).join(", ")} in effect${until ? `, ${until}` : ""}. Opens their forecast page.`);
    pill.hidden = false;
    // On phones the pill shares the ground strip with the readout, so the
    // readout keeps clear of it (its width plus a small gap; style.css)
    sky?.style.setProperty("--alert-room", `${pill.offsetWidth + 12}px`);
  };
  // The pill is a different width on phones (no "until" part), so measure again
  addEventListener("resize", () => {
    if (!pill.hidden) pill.closest(".horizon")?.style.setProperty("--alert-room", `${pill.offsetWidth + 12}px`);
  });
  // One quick second try if the first check didn't get through
  loadAlerts().then(() => (alerts ? show() : new Promise((go) => setTimeout(go, 30000)).then(loadAlerts).then(show)));
  setInterval(() => {
    if (!document.hidden) loadAlerts().then(show);
  }, ALERTS_MS);
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
  // Real snow for today; the calendar further off (holding the sun plays the year)
  if (weather && Math.abs(t - now()) < 2 * 86400000) return weather.snow;
  if (!YXE.home) return false; // the calendar guess only fits Saskatoon
  const p = localParts(t);
  const day = p.m * 100 + p.d;
  return day >= 1125 || day <= 325;
}

// Frost glitter: on a bitter, clear morning the snow is full of tiny ice
// crystals that flash as the low sun catches them. Needs snow lying,
// -10°C or colder, little cloud, the sun up but low, and before noon.
function frostSparkle(t) {
  if (!weather || !Number.isFinite(weather.temp) || weather.temp > -10 || weather.cloud >= 40) return false;
  if (!snowOnGround(t) || sunHidden() || localParts(t).h >= 12) return false;
  const alt = sunAltitude(t);
  return alt > 0 && alt < 25;
}

function frostLine(t) {
  return frostSparkle(t) ? "Frost glitter on the snow" : "";
}

// Drifting snow: a real wind of 25 km/h or more blows loose snow along
// the ground. Needs snow lying and it not above freezing.
function snowDrift(t) {
  const { wind, known } = breeze();
  if (!known || wind < 25 || !snowOnGround(t)) return false;
  return !Number.isFinite(weather.temp) || weather.temp <= 0;
}

function driftLine(t) {
  return snowDrift(t) ? "Snow blowing across the ground" : "";
}

/* ---------- The day sky ----------
   What the weather does to the daytime sky. Sun dogs and the rainbow
   are 0 (not happening) up to 1 (in full), worked out from the weather
   above, so they don't show if the weather couldn't be fetched. Smoke
   comes from the separate air quality reading (and shows at night too),
   and heat shimmer is simply on or off. */
const SMOKE_PM = 30; // PM2.5 where wildfire smoke starts to show: a hazy sky and a redder sun
const HOT_C = 28; // the horizon shimmers at this temperature (°C) and up

// True while the weather is falling or hiding the sun (rain, snow,
// thunder, fog, or a sky that's all cloud).
function sunHidden() {
  return Boolean(weather && (weather.cloud >= 85 || weatherKind(weather.code)));
}

// How smoky it looks: a light haze from SMOKE_PM, the full deep red sun
// from about 100 (a bad smoke day).
function smokeStrength() {
  if (pm25 == null || pm25 < SMOKE_PM) return 0;
  return Math.min(1, 0.35 + (0.65 * (pm25 - SMOKE_PM)) / 70);
}

// "Smoky out there today", or "" when the air's clear.
function smokeLine(t) {
  if (!smokeStrength()) return "";
  const when = sunAltitude(t) >= SUNRISE_ALT ? "today" : "tonight";
  return pm25 >= 100 ? `Thick smoke ${when}` : `Smoky out there ${when}`;
}

// Sun dogs: a bright spot either side of a low sun, with a faint ring
// through them. Ice crystals in thin high cloud bend the light, so they
// need a cold day (about -10°C or colder), some high cloud (or bitter
// cold, when the air itself glitters with ice), the sun up but under
// 35°, and nothing lower down hiding it.
function sunDogStrength(t) {
  if (!weather || !Number.isFinite(weather.temp) || weather.temp > -10 || sunHidden()) return 0;
  const high = Number.isFinite(weather.high) ? weather.high : 0;
  if (high < 10 && weather.temp > -25) return 0;
  const alt = sunAltitude(t);
  if (alt < 0 || alt > 35) return 0;
  return Math.min(1, alt / 2, (35 - alt) / 8); // fades in after sunrise, out as the sun climbs
}

function sunDogLine(t) {
  return sunDogStrength(t) ? "Sun dogs out right now" : "";
}

// A second line for the same days: the two in the sky, and one more.
function thirdDogLine(t) {
  return sunDogStrength(t) ? "Three dogs out · one's on the bed" : "";
}

// A rainbow: rain in the last couple of hours (or showers now), the sun
// out and under 40° (the bow sits 42° out from the spot straight
// opposite the sun, so a higher sun puts it under the horizon), and
// enough gaps in the cloud for the sun to shine through.
function rainbowStrength(t) {
  if (!weather || !weather.wet || weather.cloud >= 85) return 0;
  const kind = weatherKind(weather.code);
  if (kind === "snow" || kind === "fog" || (Number.isFinite(weather.temp) && weather.temp < 1)) return 0;
  const alt = sunAltitude(t);
  if (alt < 1 || alt > 40) return 0;
  return Math.min(1, (alt - 1) / 3, (40 - alt) / 6);
}

// "Rainbow weather · look east": the rainbow is always on the far side
// of the sky from the sun.
function rainbowLine(t) {
  if (!rainbowStrength(t)) return "";
  const p = sunPosition(t);
  const away = (altAz(p.ra * R2D, p.dec * R2D, t).az + 180) % 360;
  return `Rainbow weather · look ${compassName(away)}`;
}

// "north", "southwest" and so on for a compass bearing in degrees
function compassName(deg) {
  const names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// Heat shimmer over the horizon on a hot afternoon.
function heatShimmer(t) {
  return Boolean(weather && Number.isFinite(weather.temp) && weather.temp >= HOT_C && sunAltitude(t) > 0);
}

// A clear-enough sky for the twilight colours and day Venus: the weather
// is known, nothing is falling, and the cloud is under maxCloud %.
function clearSky(maxCloud) {
  return Boolean(weather && !weatherKind(weather.code) && weather.cloud < maxCloud);
}

// The Belt of Venus: on a clear evening, just after the sun sets, a pink
// band sits low on the far side of the sky from the sun, with the
// darker blue-grey shadow of the Earth itself rising under it. Same at
// dawn, the other way round. 0..1: it comes in as the sun touches the
// horizon, is at its best with the sun 1° to 4° down, and is gone by
// about 7° down, as the Earth's shadow climbs up into the dark.
function beltStrength(t) {
  if (!clearSky(50)) return 0;
  const alt = sunAltitude(t);
  if (alt > 1 || alt < -7) return 0;
  return Math.max(0, Math.min(1, (1 - alt) / 2, (alt + 7) / 3));
}

// "Belt of Venus in the east": where to look (away from the sun).
function beltLine(t) {
  if (beltStrength(t) < 0.3) return "";
  const p = sunPosition(t);
  const away = (altAz(p.ra * R2D, p.dec * R2D, t).az + 180) % 360;
  return `Belt of Venus · the pink band in the ${compassName(away)}`;
}

// A sun pillar: a column of light standing straight up from a low sun on
// a bitterly cold day, from flat ice crystals floating in the air. It
// needs the same air as sun dogs (-10°C or colder with some high cloud,
// or -20°C on its own, when the air itself sparkles) and the sun within
// a few degrees of the horizon, and it lasts a little after sunset.
function pillarStrength(t) {
  if (!weather || !Number.isFinite(weather.temp) || weather.temp > -10 || sunHidden()) return 0;
  const high = Number.isFinite(weather.high) ? weather.high : 0;
  if (high < 10 && weather.temp > -20) return 0;
  const alt = sunAltitude(t);
  if (alt < -3 || alt > 7) return 0;
  return Math.min(1, (alt + 3) / 2, (7 - alt) / 3);
}

function pillarLine(t) {
  return pillarStrength(t) > 0.3 ? "Sun pillar · ice crystals in the cold air" : "";
}

// Venus in broad daylight. It's bright enough to see by day if you know
// exactly where to look: well clear of the sun's glare (DAY_VENUS_GAP°),
// at least DAY_VENUS_ALT° up, the sun up, and a clear sky. Returns
// { alt, az, gap } or null.
const DAY_VENUS_GAP = 20;
const DAY_VENUS_ALT = 10;
function dayVenus(t) {
  if (sunAltitude(t) < 4 || !clearSky(40)) return null;
  const venus = PLANETS.find((p) => p.name === "Venus");
  const [ra, dec] = planetRaDec(venus.orbit, t);
  const sun = sunPosition(t);
  const gap = skyGap(ra * D2R, dec * D2R, sun.ra, sun.dec);
  const at = altAz(ra, dec, t);
  if (gap < DAY_VENUS_GAP || at.alt < DAY_VENUS_ALT) return null;
  return { alt: at.alt, az: at.az, gap };
}

function dayVenusLine(t) {
  const v = dayVenus(t);
  return v ? `Venus is up in daylight · look ${compassName(v.az)}, ${Math.round(v.alt)}° high` : "";
}

// Cloud shadows sliding over the fields: a sky that's partly cloudy
// (CLOUD_SHADOW_MIN to CLOUD_SHADOW_MAX %, so there's sun between them),
// nothing falling, and the sun high enough to cast them.
const CLOUD_SHADOW_MIN = 20;
const CLOUD_SHADOW_MAX = 80;
function cloudShadowTime(t) {
  if (!weather || weatherKind(weather.code)) return false;
  return weather.cloud >= CLOUD_SHADOW_MIN && weather.cloud < CLOUD_SHADOW_MAX && sunAltitude(t) > 5;
}

// The wind: its speed (km/h, a gentle 12 if it isn't known) and which
// way it blows across the sky, 1 to the right or -1 to the left. The sky
// faces south, so a wind from the west (the usual northwest wind in
// Saskatoon too) blows things to the left.
function breeze() {
  const known = weather && Number.isFinite(weather.wind);
  const from = known && Number.isFinite(weather.windFrom) ? weather.windFrom : 290;
  return { wind: known ? weather.wind : 12, known, dir: Math.sin(from * D2R) > 0 ? 1 : -1 };
}

// How long a contrail hangs about, in ms: a few seconds on a warm, dry
// day, up to half a minute on a cold, damp one (it's a trail of ice,
// and damp air keeps it from drying out).
function contrailLinger() {
  if (!weather || !Number.isFinite(weather.temp)) return 6000;
  const cold = Math.max(0, Math.min(1, (15 - weather.temp) / 35)); // 15°C: 0, -20°C: 1
  const damp = Number.isFinite(weather.damp) ? Math.max(0, Math.min(1, (weather.damp - 40) / 55)) : 0.4;
  return 3000 + 27000 * Math.sqrt(cold * damp);
}

// The prairie on the horizon, from the calendar (Saskatoon only):
// "crocus" (prairie crocuses, Saskatchewan's flower) in April and early
// May, "young" wheat in June and July, "gold" wheat from August until
// harvest in mid September, otherwise "".
function groundSeason(t) {
  if (CRITTER === "combine") return "gold"; // the ?critter=combine preview needs a field to cut
  if (!YXE.home || snowOnGround(t)) return "";
  const p = localParts(t);
  const day = p.m * 100 + p.d;
  if (day >= 401 && day <= 505) return "crocus";
  if (day >= 601 && day <= 731) return "young";
  if (day >= 801 && day <= 915) return "gold";
  return "";
}

/* ---------- Holidays and the farm ----------
   From the calendar: bats and a jack-o'-lantern on Halloween, lights on
   the elevator through December, fireworks after dark on Canada Day and
   around midnight on New Year's, lilac hearts all day on Valentine's Day
   (and lilac windows on the elevator after dark). Preview with
   ?holiday=halloween|christmas|canada|newyear|valentines (fireworks want
   the dark too: add &at=night). The windmill and the tumbleweed follow the real
   wind, and the combine comes out for the harvest. */
const HOLIDAY = new URLSearchParams(location.search).get("holiday");

function holidayAt(t) {
  if (HOLIDAY) return HOLIDAY;
  const p = localParts(t);
  const day = p.m * 100 + p.d;
  if (day === 1031) return "halloween";
  if (day === 214) return "valentines";
  if (day >= 1201 && day <= 1226) return "christmas";
  if (day === 701 || (day === 702 && p.h < 1)) return "canada";
  if ((day === 1231 && p.h >= 23) || (day === 101 && p.h < 1)) return "newyear";
  return "";
}

// Fireworks need a properly dark sky.
function fireworksTime(t) {
  const h = holidayAt(t);
  return (h === "canada" || h === "newyear") && sunAltitude(t) < -6;
}

// Bats come out at dusk on Halloween and stay out all night.
function batsTime(t) {
  return holidayAt(t) === "halloween" && sunAltitude(t) < 4;
}

// Hearts drift up all day and all night on Valentine's Day.
function heartsTime(t) {
  return holidayAt(t) === "valentines";
}

// Tumbleweed: a real wind of 25 km/h or more on a dry day with no snow.
function tumbleTime(t) {
  const { wind, known } = breeze();
  if (!known || wind < 25 || snowOnGround(t) || weather.wet) return false;
  return !["rain", "storm", "snow"].includes(weatherKind(weather.code));
}

// The combine: gold wheat, by day, not in the rain.
function combineTime(t) {
  const wet = weather && ["rain", "storm", "snow"].includes(weatherKind(weather.code));
  return groundSeason(t) === "gold" && sunAltitude(t) > 3 && !wet;
}

// What the windmill's up to, for its tap label.
function windmillFact() {
  const { wind, known } = breeze();
  if (!known) return "Pumping water for the cattle";
  if (wind < 3) return "Not a breath of wind, so it's standing still";
  const from = Number.isFinite(weather.windFrom) ? ` from the ${compassName(weather.windFrom)}` : "";
  return `Spinning in a ${Math.round(wind)} km/h wind${from}`;
}

// Sun dogs, the rainbow and the smoky sun for moment t. placeSun calls
// this (with the sun's place across the sky, 0..1), so they follow the
// sun through the opening spin and a swipe too.
function placeOptics(scene, t, sunX) {
  if (!scene.optics) return;
  skyVar(scene, "--sundogs", sunDogStrength(t).toFixed(2));
  skyVar(scene, "--pillar", pillarStrength(t).toFixed(2));
  // The Belt of Venus: brightest on the side of the sky away from the
  // sun (kept on screen, so it shows even when that's behind you), and
  // the Earth's shadow under it climbs as the sun sinks.
  const belt = beltStrength(t);
  skyVar(scene, "--belt", belt.toFixed(2));
  if (belt) {
    const p = sunPosition(t);
    const away = (altAz(p.ra * R2D, p.dec * R2D, t).az + 180) % 360;
    // The band runs the full width of the screen, so its brightest spot
    // is given as a share of the screen's width, not the sky's
    const box = scene.getBoundingClientRect();
    const across = Math.max(0.1, Math.min(0.9, skyX(away)));
    skyVar(scene, "--belt-x", ((box.left + across * box.width) / (innerWidth || 1)).toFixed(3));
    skyVar(scene, "--belt-rise", Math.max(0, Math.min(1, -sunAltitude(t) / 6)).toFixed(3));
  }
  let bow = rainbowStrength(t);
  if (bow && !scene.sky) {
    // Sizes in pixels, measured once (and again after a resize)
    const w = scene.optics.offsetWidth;
    if (w) {
      scene.sky = {
        w,
        sun: scene.querySelector(".horizon__sun").offsetWidth,
        bow: scene.optics.querySelector(".horizon__rainbow").offsetWidth / 2.5, // --bow-r
      };
    } else bow = 0;
  }
  skyVar(scene, "--rainbow", bow.toFixed(2));
  if (!bow) return;
  // The bow's middle sits as far right of the middle of the sky as the
  // sun is left of it (and the other way round), and its centre is as
  // far under the horizon as the sun is above it, so a low sun makes a
  // tall bow and a higher sun a shallow one. A rainbow is always on the
  // far side of the sky from the sun, so when that would put the bow
  // under or round the sun (around midday, or on a narrow phone), it's
  // pushed out past the sun's side, and may run off the edge.
  const { w, sun, bow: r } = scene.sky;
  const sunAt = sunX * (w - sun) + sun / 2; // the sun's middle, as in .horizon__sun
  const gap = r * 1.24 + sun * 0.6; // the outer bow's radius, plus the sun's and a little room
  let at = (1 - sunX) * w;
  if (Math.abs(at - sunAt) < gap) at = sunAt + (at >= sunAt ? gap : -gap);
  skyVar(scene, "--bow-x", (at / w).toFixed(3));
  skyVar(scene, "--bow-d", (sunAltitude(t) / 42).toFixed(3));
}

/* ---------- The grain elevator ----------
   A prairie grain elevator stands on the horizon about where the sun is
   at noon (due south). Its shadow lies on the ground and follows the
   real sun: long and off to the right (northwest) after sunrise, short
   and straight toward you at noon, long and off to the left (northeast)
   before sunset. Heavy cloud takes it away. The readout says how long
   your own shadow is: 1 ÷ tan(the sun's height) times your height. */
// The elevator's outline: [x, y] in an 86 × 72 box, the ground at y = 72,
// modelled on a real wooden prairie elevator. From the left: a loading
// spout hanging off the side, the tall main house with its steep gable, a
// taller narrow leg house behind it with a low roof, a long annex roof
// sloping down to the right, and a cyclone dust collector at the end.
// (A driveway scale shed sits at the foot of the left wall.)
const ELEVATOR = [
  [0, 72], [0, 62], [17, 62], [17, 46], [9.5, 55], [8, 53.5], [17, 43], [17, 30], // shed roof, spout
  [30, 11], [36, 19.8], [36, 3.5], [42, 1], [48, 3.5], [48, 27], // main house gable, leg house
  [71, 43], [71, 22], [72.5, 19.5], [76.5, 19.5], [78, 22], [78, 72], // annex roof, cyclone
];
const ELEVATOR_W = 86;
const ELEVATOR_H = 72;
const ELEVATOR_MID = 30; // the peak of the main house, which stands on the noon spot
// Extra pieces drawn with the same silhouette colour but left out of the
// shadow (thin things): the pipe from the leg house to the cyclone with
// its prop, and a utility pole at the far right.
const ELEVATOR_BITS = [
  "M47 20.5H72V22.5H47Z", // dust pipe
  "M59.5 22.5H60.8V36H59.5Z", // its prop
  "M82.4 28H83.8V72H82.4Z", // pole
  "M80 30H86.2V31.3H80Z", // crossarm
];
// The little station depot beside it, in a 40 × 22 box: a pitched roof with
// a chimney, and a low platform canopy on the right.
const DEPOT = [[0, 22], [0, 12], [12, 4], [16, 7], [16, 2], [19, 2], [19, 9], [24, 12], [40, 12], [40, 22]];
// A prairie water-pump windmill to the left of the elevator, in a 30 × 50
// box: a lattice tower, and on top a wheel of twelve blades (it spins at
// the real wind speed, style.css) with the tail vane trailing downwind.
const WINDMILL_TOWER = "M14 13H16L22 50H20.6L15 16.5L9.4 50H8Z" + // the two legs
  "M10.6 40H19.4V41H10.6ZM11.9 30H18.1V31H11.9ZM13.1 21.5H16.9V22.4H13.1Z" + // cross braces
  "M10.6 40L18.1 31L18.7 31.7L11.2 40.7ZM19.4 40L11.9 31L11.3 31.7L18.8 40.7Z"; // and an X
const WINDMILL_TAIL = "M15 10.4H26V11.6H15ZM22 6.5L28.5 8.5V13.5L22 12.5Z";
// Halloween: a jack-o'-lantern by the elevator's foot (16 × 13 box)
const PUMPKIN = "M8 3.2C11.5 1.8 15.5 4 15.5 8C15.5 11.5 12 13 8 13C4 13 0.5 11.5 0.5 8C0.5 4 4.5 1.8 8 3.2Z";
const PUMPKIN_FACE = "M3.6 6.6L5.6 5.4L6 7.6ZM12.4 6.6L10.4 5.4L10 7.6ZM3.5 9.2L5 10L6.5 9.4L8 10.4L9.5 9.4L11 10L12.5 9.2L11.6 11.4H4.4Z";
const DEPOT_W = 40;
const DEPOT_H = 22;
const DEPOT_MID = 12; // under the ridge of the roof
const SHADOW_SQUASH = 0.3; // the ground is seen from low down, so shadows toward you look this much shorter

function svgNode(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const name in attrs) node.setAttribute(name, attrs[name]);
  return node;
}

// Builds the elevator, its shadow, the wheat and the crocuses (the
// season ones stay hidden until paintWeather switches them on).
function setUpLand(scene) {
  const ground = scene.querySelector(".horizon__ground");
  const elevator = svgNode("svg", { class: "horizon__elevator", viewBox: `0 0 ${ELEVATOR_W} ${ELEVATOR_H}` });
  elevator.append(
    svgNode("path", { d: `M${ELEVATOR.map((p) => p.join(" ")).join("L")}Z` }),
    ...ELEVATOR_BITS.map((d) => svgNode("path", { d })),
    svgNode("rect", { class: "elevator__door", x: 52, y: 52, width: 9, height: 20 }), // the annex's barn door
    // little windows that glow after dark: high in the gable, the leg house, the annex
    svgNode("rect", { class: "elevator__light", x: 28.5, y: 15.5, width: 3, height: 4 }),
    (scene.homeLight = svgNode("rect", { class: "elevator__light", x: 40.5, y: 7, width: 3, height: 4 })), // the top one hides a secret (see targets in setUpSkyTaps)
    svgNode("rect", { class: "elevator__light", x: 64, y: 51, width: 3, height: 3 })
  );
  // December: a string of lights along its rooflines, in the three
  // light colours, every few units round the outline (shown by style.css)
  const lights = svgNode("g", { class: "elevator__xmas" });
  let n = 0;
  for (let i = 1; i < ELEVATOR.length; i++) {
    const [x1, y1] = ELEVATOR[i - 1], [x2, y2] = ELEVATOR[i];
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let s = 0; s < len; s += 3.6) {
      const x = x1 + ((x2 - x1) * s) / len, y = y1 + ((y2 - y1) * s) / len;
      if (y > 64) continue; // not down at ground level
      lights.append(svgNode("circle", { class: `xmas xmas--${n++ % 3}`, cx: x.toFixed(1), cy: y.toFixed(1), r: 1.1 }));
    }
  }
  elevator.append(lights);
  // Halloween: a jack-o'-lantern at the elevator's foot, its face lit after dark
  const pumpkin = svgNode("svg", { class: "horizon__pumpkin", viewBox: "0 0 16 13" });
  pumpkin.append(
    svgNode("path", { class: "pumpkin__stalk", d: "M7.4 3.4L7.8 0.6H9L8.8 3.4Z" }),
    svgNode("path", { class: "pumpkin__body", d: PUMPKIN }),
    svgNode("path", { class: "pumpkin__face", d: PUMPKIN_FACE })
  );
  // The windmill, to the left (its wheel spins at the real wind speed)
  const windmill = svgNode("svg", { class: "horizon__windmill", viewBox: "0 0 30 50" });
  const wheel = svgNode("g", { class: "windmill__wheel" });
  for (let i = 0; i < 12; i++) {
    // Each blade a thin wedge from near the hub to the rim
    wheel.append(svgNode("path", { d: "M-0.5 -2.6L-1.3 -9.2L1.3 -9.2L0.5 -2.6Z", transform: `rotate(${i * 30})` }));
  }
  wheel.append(svgNode("circle", { class: "windmill__rim", r: 9.2 }), svgNode("circle", { r: 1.6 }));
  const hub = svgNode("g", { transform: "translate(15 11)" });
  hub.append(wheel);
  windmill.append(svgNode("path", { d: WINDMILL_TOWER }), svgNode("path", { class: "windmill__tail", d: WINDMILL_TAIL }), hub);
  scene.windmill = windmill;
  // The station depot to the right of it, and the rail line they stand beside
  const depot = svgNode("svg", { class: "horizon__depot", viewBox: `0 0 ${DEPOT_W} ${DEPOT_H}` });
  depot.append(
    svgNode("path", { d: `M${DEPOT.map((p) => p.join(" ")).join("L")}Z` }),
    svgNode("rect", { class: "elevator__light", x: 5, y: 15, width: 3, height: 3 }) // a lit window after dark
  );
  const track = el("div", "horizon__track");
  const shadow = svgNode("svg", { class: "horizon__shadow" });
  scene.shadowShape = svgNode("polygon", {});
  scene.depotShape = svgNode("polygon", {});
  shadow.append(scene.shadowShape, scene.depotShape);
  scene.elevator = elevator;
  scene.depot = depot;
  scene.track = track;
  scene.shadow = shadow;

  // Prairie crocuses: little clumps of two or three pale purple cups
  // with gold hearts, dotted along the horizon
  const crocuses = el("div", "horizon__crocuses");
  for (let i = 0; i < 18; i++) {
    const clump = svgNode("svg", { viewBox: "-8 -13 16 13" });
    const n = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < n; j++) {
      const flower = svgNode("g", { transform: `translate(${(j - (n - 1) / 2) * 4.5 + (Math.random() - 0.5) * 2} 0) scale(${0.75 + Math.random() * 0.35})` });
      flower.append(
        svgNode("path", { class: "crocus__cup", d: "M0 0C-3 -1 -3.4 -5 -2.8 -8.5L-1.3 -6.4L0 -10L1.3 -6.4L2.8 -8.5C3.4 -5 3 -1 0 0Z" }),
        svgNode("circle", { class: "crocus__heart", cx: 0, cy: -7, r: 1 })
      );
      clump.append(flower);
    }
    clump.style.left = `${(i + 0.2 + Math.random() * 0.6) * (100 / 18)}%`;
    crocuses.append(clump);
  }
  ground.after(shadow, windmill, elevator, depot, pumpkin, track, el("div", "horizon__wheat"), el("div", "horizon__stubble"), crocuses);
  skyVarsAgain(scene); // the shadow is new: give it the numbers set so far
  scene.land = null; // measured on the first paint, and again whenever the sky or window changes size
  const remeasure = () => { scene.land = null; scene.sky = null; };
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(scene);
  // The shadow strip is 100vw wide, so its left edge moves with the window
  // even when the (capped) sky stays the same size
  window.addEventListener("resize", remeasure);
}

// The sun's height and compass direction at moment t, in degrees.
function sunAltAz(t) {
  const p = sunPosition(t);
  return altAz(p.ra * R2D, p.dec * R2D, t);
}

// The sun's height as you see it: the air bends low sunlight up a little
// (about half a degree at the horizon), which makes low shadows shorter.
// Takes and gives degrees.
function seenAltitude(alt) {
  if (alt < -1) return alt; // the formula only holds near and above the horizon
  return alt + 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * D2R) / 60;
}

// How strong shadows are (0..1), from the seen height: none until the sun
// clears the horizon, fainter through broken cloud or smoke, gone when
// the sun's hidden.
function shadowStrength(alt) {
  if (alt <= 0 || sunHidden()) return 0;
  const cloud = weather ? weather.cloud / 85 : 0;
  return Math.min(1, alt / 4) * (1 - 0.5 * cloud) * (1 - 0.6 * smokeStrength());
}

// Lays the shadows of the elevator and the depot on the ground for moment
// t: each corner of an outline is moved away from the sun by its height ÷
// tan(the sun's height), then squashed toward you for the low view of the
// ground.
function placeShadow(scene, t) {
  if (!scene.shadowShape) return;
  const sun = sunAltAz(t);
  const alt = seenAltitude(sun.alt);
  const az = sun.az;
  const show = shadowStrength(alt);
  skyVar(scene, "--land-shadow", show.toFixed(2));
  if (!show) {
    scene.shadowShape.removeAttribute("points"); // no stale sunset shadow left lying there
    scene.depotShape.removeAttribute("points");
    return;
  }
  if (!scene.land) {
    const box = scene.elevator.getBoundingClientRect();
    const hut = scene.depot.getBoundingClientRect();
    if (!box.width) return;
    const left = scene.shadow.getBoundingClientRect().left;
    scene.land = {
      base: box.left + box.width * (ELEVATOR_MID / ELEVATOR_W) - left,
      scale: box.height / ELEVATOR_H,
      depotBase: hut.left + hut.width * (DEPOT_MID / DEPOT_W) - left,
      depotScale: hut.height / DEPOT_H,
    };
  }
  const { base, scale, depotBase, depotScale } = scene.land;
  const long = Math.min(80, 1 / Math.tan(alt * D2R)); // shadow length for each unit of height
  const away = (az + 180) * D2R; // shadows point away from the sun
  const dx = -Math.sin(away) * long; // east is on the left
  const dy = Math.max(0.05, Math.cos(away)) * long * SHADOW_SQUASH; // north comes toward you (down)
  const cast = (outline, tall, mid, from, size) => outline.map(([x, y]) => {
    const up = (tall - y) * size;
    return `${(from + (x - mid) * size + dx * up).toFixed(1)},${(dy * up).toFixed(1)}`;
  }).join(" ");
  scene.shadowShape.setAttribute("points", cast(ELEVATOR, ELEVATOR_H, ELEVATOR_MID, base, scale));
  scene.depotShape.setAttribute("points", cast(DEPOT, DEPOT_H, DEPOT_MID, depotBase, depotScale));
}

// "Your shadow is 2.4× your height", while the sun's out
function shadowLine(t) {
  const alt = seenAltitude(sunAltitude(t));
  if (!shadowStrength(alt)) return "";
  const long = Math.round(10 / Math.tan(alt * D2R)) / 10; // to one decimal
  if (long > 100) return "Your shadow is over 100× your height";
  if (long < 0.1) return "Barely any shadow, the sun's almost overhead";
  if (long > 0.95 && long < 1.05) return "Your shadow is as long as you are tall";
  return `Your shadow is ${long < 10 ? long.toFixed(1) : Math.round(long)}× your height`;
}

// What the elevator says when it's tapped: how long its shadow is and
// where it points, or why there isn't one.
function elevatorFact(t) {
  const alt = seenAltitude(sunAltitude(t));
  if (shadowStrength(alt)) {
    const long = Math.min(99, Math.round(10 / Math.tan(alt * D2R)) / 10);
    const away = (sunAltAz(t).az + 180) % 360; // shadows point away from the sun
    return `Shadow ${long < 10 ? long.toFixed(1) : Math.round(long)}× its height, pointing ${compassName(away)}`;
  }
  if (document.documentElement.dataset.theme === "dark") return "Its light stays on until the sun's back";
  return alt > 0 ? "No shadow while the sun's hidden" : "No shadow with the sun down";
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
  // Smoke haze, the rainbow and sun dogs, under the clouds and rain
  scene.optics = layer("horizon__optics");
  scene.optics.append(el("div", "horizon__belt"), el("div", "horizon__pillar"), el("div", "horizon__rainbow"), el("div", "horizon__sundogs"));
  skyVarsAgain(scene); // these four are new: give them the numbers set so far
  scene.snowline = el("div", "horizon__snowline");
  scene.querySelector(".horizon__ground").after(scene.snowline);
  // Winter ground: frost glitter over the snow, and snow blowing along the line
  scene.frost = el("div", "horizon__frost");
  scene.drift = el("div", "horizon__drift");
  scene.snowline.after(scene.frost, scene.drift);
  // Cloud shadows drifting over the fields (and the snow) on a partly cloudy day
  scene.cloudShadows = el("div", "horizon__cloud-shadows");
  scene.drift.after(scene.cloudShadows);
  const refresh = () => Promise.all([loadWeather(), loadKp(), loadAir()]);
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, WEATHER_MS);
  // Lightning bolts are drawn here (under the critters, over the clouds)
  scene.bolts = el("div", "horizon__bolts");
  scene.clouds.after(scene.bolts);
  // Lightning in a thunderstorm: a bolt every 5 to 20 seconds, then the
  // rumble (a buzz on phones that can) a few seconds after
  if (!REDUCE_MOTION) {
    (function flash() {
      setTimeout(() => {
        if (scene.classList.contains("horizon--storm") && !document.hidden) {
          strike(scene);
          setTimeout(() => buzz([80, 40, 140]), 1000 + Math.random() * 4000);
        }
        flash();
      }, 5000 + Math.random() * 15000);
    })();
  }
}

const BREEZY_KMH = 20;

// Shows the weather, snow and northern lights for moment t.
function paintWeather(scene, t) {
  if (!scene.clouds) return;
  scene.classList.toggle("horizon--snowy", snowOnGround(t));
  scene.style.setProperty("--aurora", auroraStrength(t).toFixed(2));
  scene.style.setProperty("--smoke", smokeStrength().toFixed(2));
  scene.style.setProperty("--wind", Math.min(1, breeze().wind / 50).toFixed(2)); // sways the wheat
  // A real breeze (BREEZY_KMH and up) makes the sun's rays flicker
  scene.classList.toggle("horizon--breezy", breeze().known && breeze().wind >= BREEZY_KMH);
  scene.classList.toggle("horizon--hot", heatShimmer(t));
  scene.classList.toggle("horizon--frost", frostSparkle(t));
  scene.classList.toggle("horizon--drift", snowDrift(t));
  scene.classList.toggle("horizon--cloud-shadows", cloudShadowTime(t));
  scene.style.setProperty("--drift-dir", String(breeze().dir)); // 1 blows right, -1 left
  const field = groundSeason(t);
  scene.classList.toggle("horizon--crocus", field === "crocus");
  scene.classList.toggle("horizon--wheat", field === "young" || field === "gold");
  scene.classList.toggle("horizon--gold", field === "gold");
  const holiday = holidayAt(t);
  scene.classList.toggle("horizon--halloween", holiday === "halloween");
  scene.classList.toggle("horizon--christmas", holiday === "christmas");
  scene.classList.toggle("horizon--valentines", holiday === "valentines");
  // The windmill: one turn of the wheel takes 2 s in a 12 km/h breeze,
  // quicker as it blows harder; still when it's calm. Its tail trails downwind.
  const air = breeze();
  scene.style.setProperty("--mill-s", `${Math.max(0.5, 24 / Math.max(1, air.wind)).toFixed(2)}s`);
  scene.classList.toggle("horizon--calm", air.wind < 3);
  scene.style.setProperty("--mill-flip", String(air.dir));
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
  // The cloud layer spans the whole screen, so wide screens get more.
  const wide = Math.max(1, Math.min(2.5, innerWidth / 600));
  const count = cloud < 15 ? 0 : Math.round(Math.min(6, Math.round(cloud / 17)) * wide);
  const size = scene.closest(".page-head") ? 0.6 : 1; // smaller on the short page-head skies
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const c = el("i", "cloud");
    const slow = 140 + Math.random() * 120; // seconds to cross
    c.style.setProperty("--h", `${((14 + Math.random() * 18) * size).toFixed(0)}px`);
    // measured down from the top of the sky (the layer starts --cloud-reach above it)
    c.style.top = `calc(var(--cloud-reach) + var(--sky-height) * ${(0.04 + Math.random() * 0.5).toFixed(2)})`;
    c.style.setProperty("--x", `${((i + Math.random() * 0.6) / count * 100).toFixed(0)}%`); // where it sits with motion off
    c.style.animationDuration = `${slow.toFixed(0)}s`;
    c.style.animationDelay = `${(-slow * ((i + 0.5) / count)).toFixed(0)}s`; // already partway across
    clouds.push(c);
  }
  scene.clouds.replaceChildren(...clouds);
  // Their shadows on the ground: soft dark patches drifting the same way
  // as the clouds (left to right), one for about every other cloud.
  // style.css only shows them while cloudShadowTime is true.
  const patches = [];
  const shadows = Math.round(count * 0.6);
  for (let i = 0; i < shadows; i++) {
    const s = el("i", "cloud-shadow");
    const slow = 60 + Math.random() * 50; // seconds to cross: they're near, so they look quicker
    s.style.setProperty("--w", `${(18 + Math.random() * 22).toFixed(0)}vw`);
    s.style.top = `${(10 + Math.random() * 45).toFixed(0)}%`;
    s.style.setProperty("--x", `${((i + Math.random() * 0.6) / shadows * 100).toFixed(0)}%`);
    s.style.animationDuration = `${slow.toFixed(0)}s`;
    s.style.animationDelay = `${(-slow * ((i + 0.5) / shadows)).toFixed(0)}s`;
    patches.push(s);
  }
  if (scene.cloudShadows) scene.cloudShadows.replaceChildren(...patches);
}

/* ---------- Prairie seasons ----------
   Things that come with the time of year, from the calendar (no
   internet): Canada geese flying over in V's in the fall (heading south)
   and spring (back north), fireflies blinking low over the ground on
   summer nights, and autumn leaves blowing across in September and
   October (faster in a real wind). With them, a jet now and then by day,
   its contrail hanging about longer on cold, damp days, and on windy
   afternoons a hawk circling (or, at weekends, someone's kite). On warm,
   settled summer afternoons, pelicans circle up a thermal; on calm summer
   weekend mornings and evenings, a hot-air balloon drifts over; in
   winter, flocks of snow buntings wheel low over the snow. Off for
   "reduce motion". Preview one with
   ?critter=geese|fireflies|leaves|jet|hawk|kite|pelicans|balloon|buntings|hearts. */
const GEESE_EVERY_S = 40; // a flock every 40 seconds on average, in season
const JET_EVERY_S = 90; // a jet every minute and a half on average, by day
const CAR_EVERY_S = 420; // the secret stock car: about once every seven minutes, any hour
const TRAIN_EVERY_S = 150; // a freight train along the rails every couple of minutes, any hour
const HAWK_EVERY_S = 60; // how often a hawk turns up on a windy afternoon
const BATS_EVERY_S = 6; // a few bats every few seconds on Halloween night
const HEARTS_EVERY_S = 4; // a heart every few seconds on Valentine's Day
const TUMBLE_EVERY_S = 12; // how often a tumbleweed rolls by on a dry, windy day
const COMBINE_EVERY_S = 120; // how often the combine comes out in the harvest
const PELICAN_EVERY_S = 75; // a group of pelicans on a warm, settled summer afternoon
const BALLOON_EVERY_S = 120; // a hot-air balloon, on a calm summer weekend morning or evening
const BUNTING_EVERY_S = 35; // a flock of snow buntings over the snow in winter
const CRITTER = new URLSearchParams(location.search).get("critter"); // a ?critter= preview

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

// Autumn leaves: September and October, from first light to dusk, when
// it isn't snowing.
function leavesTime(t) {
  const p = localParts(t);
  const snowing = weather && weatherKind(weather.code) === "snow";
  return YXE.home && (p.m === 9 || p.m === 10) && sunAltitude(t) > -4 && !snowing;
}

// Jets: by day (that's when contrails show), under a sky that isn't
// all cloud or rain.
function jetTime(t) {
  return sunAltitude(t) > 2 && !sunHidden();
}

// A windy afternoon: a real wind of 20 km/h or more, noon to about 6
// PM with the sun well up, dry and above freezing.
function windyAfternoon(t) {
  const { wind, known } = breeze();
  const p = localParts(t);
  if (!known || wind < 20 || p.h < 12 || p.h >= 18 || sunAltitude(t) < 8 || sunHidden()) return false;
  return !Number.isFinite(weather.temp) || weather.temp >= 3;
}

// Hawks on weekdays (kites at weekends). Saskatoon's hawks are only
// around from April to October.
function hawkTime(t) {
  const p = localParts(t);
  const weekend = p.weekday === "Sat" || p.weekday === "Sun";
  return windyAfternoon(t) && !weekend && (!YXE.home || (p.m >= 4 && p.m <= 10));
}

// A kite instead of the hawk at weekends.
function kiteTime(t) {
  const p = localParts(t);
  return windyAfternoon(t) && (p.weekday === "Sat" || p.weekday === "Sun");
}

// American white pelicans: Saskatoon's summer birds (they fish below the
// weir on the river). They ride warm air up in slow circles, so they come
// out on warm, settled afternoons, May to September, with the wind under
// 20 km/h: never at the same time as the hawk or the kite, which need it
// windier.
function pelicanTime(t) {
  const p = localParts(t);
  if (!YXE.home || p.m < 5 || p.m > 9 || p.h < 11 || p.h >= 19 || sunAltitude(t) < 15 || sunHidden()) return false;
  const { wind, known } = breeze();
  if (known && wind >= 20) return false;
  return !weather || !Number.isFinite(weather.temp) || weather.temp >= 15;
}

// A hot-air balloon: only in a real calm (under BALLOON_WIND km/h), on a
// summer weekend, in the low light of early morning or evening (the sun
// 3° to 20° up), dry and not overcast. The calm-day opposite of the kite.
const BALLOON_WIND = 8;
function balloonTime(t) {
  const p = localParts(t);
  const { wind, known } = breeze();
  if (!YXE.home || !known || wind >= BALLOON_WIND || p.m < 5 || p.m > 9) return false;
  if (p.weekday !== "Sat" && p.weekday !== "Sun") return false;
  const alt = sunAltitude(t);
  return alt >= 3 && alt <= 20 && !sunHidden();
}

// Snow buntings: little white birds down from the Arctic for the winter.
// Flocks wheel low over snowy fields, November to March, by day, when it
// isn't snowing hard or foggy.
function buntingTime(t) {
  const p = localParts(t);
  if (!YXE.home || (p.m > 3 && p.m < 11) || !snowOnGround(t) || sunAltitude(t) < 2) return false;
  const kind = weather ? weatherKind(weather.code) : "";
  return kind !== "storm" && kind !== "fog" && !(weather && weather.code >= 73 && kind === "snow");
}

function setUpCritters(scene, timeNow) {
  if (REDUCE_MOTION) return;
  const box = el("div", "horizon__critters");
  // In front of the sun, moon and clouds (they're all much closer), but
  // behind the horizon line and the ground
  (scene.querySelector(".horizon__moon") || scene.optics || scene.querySelector(".horizon__stars")).after(box);

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

  // One autumn leaf tumbling across on the wind, low in the sky, bobbing
  // and flipping over as it goes.
  function leaf(wind, dir) {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const small = h < 140;
    const node = el("i", ["leaf", "leaf leaf--gold", "leaf leaf--rust"][Math.floor(Math.random() * 3)]);
    box.append(node);
    const size = (small ? 0.75 : 1) * (0.8 + Math.random() * 0.5);
    const dur = (small ? 0.8 : 1) * (15000 / (1 + wind / 10)) * (0.8 + Math.random() * 0.4); // ~8 s on a light breeze
    const y0 = h * (0.3 + Math.random() * 0.55);
    const x0 = dir > 0 ? -14 : w + 14;
    const spin = (1.5 + Math.random() * 3) * 360 * dir;
    const bob = (small ? 4 : 7) + Math.random() * 12;
    const drop = (Math.random() - 0.3) * h * 0.3; // mostly sinking, now and then lifted
    const waves = 1.5 + Math.random() * 2;
    const frames = [];
    for (let i = 0; i <= 16; i++) {
      const p = i / 16;
      const x = x0 + (w + 28) * dir * p;
      const y = y0 + drop * p + Math.sin(p * waves * 2 * Math.PI) * bob;
      frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(spin * p).toFixed(0)}deg) scale(${size.toFixed(2)}, ${(size * Math.cos(p * 14)).toFixed(2)})` });
    }
    node.animate(frames, { duration: dur, easing: "linear" }).onfinish = () => node.remove();
  }

  // A jet crossing high up. Its contrail is a row of short dashes, each
  // appearing as the jet passes and fading (and spreading) over
  // contrailLinger(), so the trail is short on a warm, dry day and
  // stretches right across the sky on a cold, damp one.
  let jetFlying = false;
  function jet() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    jetFlying = true;
    const small = h < 140;
    const len = w + 80;
    const left = Math.random() < 0.5; // flying toward the left, or the right
    const path = el("div", "jet-path"); // turned to the jet's heading, and flipped when it flies left
    path.style.top = `${(h * (0.08 + Math.random() * 0.28)).toFixed(0)}px`;
    path.style.width = `${len}px`;
    path.style.transform = `rotate(${((Math.random() - 0.5) * 12).toFixed(1)}deg)${left ? " scaleX(-1)" : ""}`;
    const dur = (small ? 14000 : 22000) + Math.random() * 8000;
    const linger = contrailLinger();
    const step = 8; // px between dashes (each is twice as long, so they overlap)
    for (let x = 0; x < len; x += step) {
      const dash = el("i", "contrail");
      dash.style.left = `${x - step}px`;
      dash.style.width = `${step * 2}px`;
      path.append(dash);
      dash.animate(
        [{ opacity: 0.85, transform: "scaleY(1)" }, { opacity: 0, transform: `scaleY(${(1 + linger / 8000).toFixed(2)})` }],
        { delay: (dur * (x + step)) / len, duration: linger, easing: "ease-in" }
      );
    }
    const plane = svgNode("svg", { class: "jet", viewBox: "0 0 12 10" });
    plane.append(svgNode("path", { d: "M0 5H12M7.5 5L4.5 0.5M7.5 5L4.5 9.5M1.6 5L0.4 2.8M1.6 5L0.4 7.2" }));
    path.append(plane);
    box.append(path);
    plane.animate([{ translate: "0 0" }, { translate: `${len}px 0` }], { duration: dur, easing: "linear" }).onfinish = () => {
      plane.remove();
      jetFlying = false;
      setTimeout(() => path.remove(), linger + 500); // once the last of the trail has gone
    };
  }

  // A freight train along the rails by the depot: a locomotive and a string
  // of grain cars, a silhouette like the elevator. It runs on the ground
  // strip, so it's added to the scene itself (the critter box only covers
  // the sky).
  let trainRunning = false;
  function train() {
    if (!scene.track || !scene.track.clientWidth) return;
    trainRunning = scene.trainRunning = true;
    const cars = 9 + Math.floor(Math.random() * 6);
    // In a 12-high box: the locomotive (16 long, with a cab), then the cars
    let d = "M0 9V4H3V2H9V4H16V9Z";
    let x = 17;
    for (let i = 0; i < cars; i++) {
      d += `M${x} 9V3.5H${x + 12}V9Z`;
      x += 13;
    }
    const wheels = [];
    for (let wx = 3; wx < x; wx += 6.5) wheels.push(svgNode("circle", { cx: wx, cy: 10, r: 1.2 }));
    const len = x;
    const rig = svgNode("svg", { class: "train", viewBox: `0 0 ${len} 12` });
    rig.style.width = `calc(var(--elevator-h) * 0.2 * ${len} / 12)`; // set outright so no browser falls back to a 300px-wide box
    rig.append(svgNode("path", { d }), ...wheels, svgNode("circle", { class: "elevator__light", cx: 0.6, cy: 6, r: 1.1 })); // headlight after dark
    const right = Math.random() < 0.5; // the locomotive is drawn at the left end, so it heads left unless flipped
    const wrap = el("div", "train-path");
    wrap.style.transform = right ? "scaleX(-1)" : "";
    wrap.append(rig);
    scene.track.after(wrap);
    const w = scene.track.clientWidth;
    const own = rig.getBoundingClientRect().width || len;
    // Heading left: from past the right edge to past the left. The wrap is flipped to go right.
    const dur = 16000 + Math.random() * 8000;
    // Tapping the train names it, and earns the Trainspotter badge
    const untap = tappable(rig, "Freight train", `${cars} grain cars rolling through Longlight Station`, 22, () => spot("train"));
    rig.animate([{ translate: `${w}px 0` }, { translate: `${-own}px 0` }], { duration: dur, easing: "linear" }).onfinish = () => {
      wrap.remove();
      untap();
      trainRunning = scene.trainRunning = false;
    };
  }

  // A sky secret: every so often a tiny stock car tears along the prairie
  // just under the horizon, a few seconds from edge to edge. Tapping it
  // in time earns a hidden badge. Preview with ?critter=stockcar.
  let carRunning = false;
  function stockCar() {
    if (!scene.track || !scene.track.clientWidth) return;
    carRunning = true;
    const lane = el("div", "tumble-path");
    // In a 26 x 10 box, nose at the left: body with a spoiler, two wheels,
    // and a clay stripe along the door
    const car = svgNode("svg", { class: "stockcar", viewBox: "0 0 26 10" });
    car.append(
      svgNode("path", { d: "M0 7.6V5.6L4.5 4.7L8.5 2H17L20 4.5L24.6 4.9V2.4H26V7.6Z" }),
      svgNode("rect", { class: "stockcar__stripe", x: 5, y: 5.2, width: 15, height: 1.1 }),
      svgNode("circle", { cx: 6, cy: 7.8, r: 2 }),
      svgNode("circle", { cx: 20, cy: 7.8, r: 2 })
    );
    if (Math.random() < 0.5) lane.style.transform = "scaleX(-1)"; // heads left unless the lane is flipped
    lane.append(car);
    scene.track.after(lane);
    const w = scene.track.clientWidth;
    const own = car.getBoundingClientRect().width || 24;
    const untap = tappable(car, "Stock car", "Flat out down the back stretch. You found a secret", 18, () => spot("car"));
    car.animate([{ translate: `${w}px 0` }, { translate: `${-own}px 0` }], { duration: 3400 + Math.random() * 1200, easing: "linear" }).onfinish = () => {
      lane.remove();
      untap();
      carRunning = false;
    };
  }

  // A hawk riding the wind: it circles (seen from below, so the circle
  // looks flattened), tilting into each turn, while the wind carries it
  // slowly across the sky.
  let hawkFlying = false;
  function hawk(dir) {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    hawkFlying = true;
    const small = h < 140;
    const drift = el("div", "hawk-drift");
    drift.style.top = `${(h * (0.15 + Math.random() * 0.3)).toFixed(0)}px`;
    const bird = svgNode("svg", { class: "hawk", viewBox: "-12.5 -4 25 10.5" });
    bird.append(svgNode("path", { d: "M0 -3.5L1.2 -1.8L11.6 -1.6L12 -0.9L11.1 -0.4L11.5 0.2L10.4 0.5L3 1.6L1.4 2.6L2.4 5.2Q0 6.2 -2.4 5.2L-1.4 2.6L-3 1.6L-10.4 0.5L-11.5 0.2L-11.1 -0.4L-12 -0.9L-11.6 -1.6L-1.2 -1.8Z" }));
    drift.append(bird);
    box.append(drift);
    const rx = (small ? 16 : 26) + Math.random() * 14, ry = rx * 0.28;
    const turn = Math.random() < 0.5 ? 1 : -1; // round one way or the other
    const circle = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * 2 * Math.PI * turn;
      circle.push({ transform: `translate(${(Math.cos(a) * rx).toFixed(1)}px, ${(Math.sin(a) * ry).toFixed(1)}px) rotate(${(-Math.sin(a) * 14 * turn).toFixed(1)}deg)` });
    }
    bird.animate(circle, { duration: 8000 + Math.random() * 4000, iterations: Infinity });
    const x0 = dir > 0 ? -rx - 24 : w + rx + 24;
    drift.animate(
      [{ translate: `${x0}px 0` }, { translate: `${x0 + dir * (w + 2 * rx + 48)}px ${((Math.random() - 0.5) * 24).toFixed(0)}px` }],
      { duration: 55000 + Math.random() * 25000, easing: "linear" }
    ).onfinish = () => {
      drift.remove();
      hawkFlying = false;
    };
  }

  // A kite on a long string from someone standing on the horizon. It
  // flies downwind of them, swaying (style.css), its tail flicking.
  // Kept up while it's kite weather.
  let kite = null;
  function kiteUp(on) {
    if (on && !kite) {
      const w = box.clientWidth, h = box.clientHeight;
      if (!w || !h) return;
      const small = h < 140;
      const { dir } = breeze();
      const k = small ? 0.65 : 1; // the kite's size
      const rise = h * (small ? 0.55 : 0.62); // how high it flies
      const reach = rise * 0.6; // how far downwind
      // Where the string meets the ground: a few tries, keeping the kite
      // clear of the sun if it can (a clay kite is hard to see on it)
      const sun = scene.querySelector(".horizon__sun");
      const sunSize = sun.offsetWidth;
      const sky = scene.getBoundingClientRect();
      const sunX = (parseFloat(skyVarOf(scene, "--sun-x")) || 0) * (sky.width - sunSize) + sunSize / 2 + sky.left - box.getBoundingClientRect().left;
      const sunY = (1 - (parseFloat(skyVarOf(scene, "--sun-alt")) || 0)) * (h - sunSize / 2) + sunSize / 2;
      let ground = 0, far = -1;
      for (let i = 0; i < 8 && far < sunSize * 0.8 + 16 * k; i++) {
        const spot = dir < 0 ? w * (0.66 + Math.random() * 0.2) : w * (0.14 + Math.random() * 0.2);
        const gap = Math.hypot(spot + dir * reach - sunX, h - rise - sunY);
        if (gap > far) { far = gap; ground = spot; }
      }
      const width = reach + 26 * k, height = rise + 34 * k;
      kite = svgNode("svg", {
        class: "kite",
        viewBox: `${dir > 0 ? -6 : 6 - width} ${-height} ${width} ${height}`,
      });
      kite.style.width = `${width}px`;
      kite.style.height = `${height}px`;
      kite.style.left = `${dir > 0 ? ground - 6 : ground - width + 6}px`;
      kite.style.transformOrigin = `${dir > 0 ? "6px" : "calc(100% - 6px)"} 100%`; // sways about the hand holding it
      const kx = dir * reach, ky = -rise;
      kite.append(svgNode("path", { class: "kite__string", d: `M0 0Q${(kx * 0.8).toFixed(1)} ${(ky * 0.3).toFixed(1)} ${kx.toFixed(1)} ${ky.toFixed(1)}` }));
      const flyer = svgNode("g", { class: "kite__flyer", transform: `translate(${kx.toFixed(1)} ${ky.toFixed(1)}) scale(${k}) rotate(${dir * -12})` });
      const wobble = svgNode("g", { class: "kite__wobble" }); // tilts back and forth (style.css)
      wobble.append(
        svgNode("path", { class: "kite__tail", d: "M0 10Q-3 14 0 18T0 26T0 34M-2 16.5L2 18.5M-2 18.5L2 16.5M-2 24.5L2 26.5M-2 26.5L2 24.5" }),
        svgNode("path", { class: "kite__body", d: "M0 -8L6 -1L0 10L-6 -1Z" }),
        svgNode("path", { class: "kite__spars", d: "M0 -8V10M-6 -1H6" })
      );
      flyer.append(wobble);
      kite.append(flyer);
      box.append(kite);
    } else if (!on && kite) {
      kite.remove();
      kite = null;
    }
  }

  // A few bats fluttering across on Halloween: quick, jerky wingbeats
  // and a wobbly, dipping flight.
  function bats() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const small = h < 140;
    const n = 1 + Math.floor(Math.random() * 3);
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const bat = svgNode("svg", { class: "bat", viewBox: "-8 -4 16 8" });
      bat.append(svgNode("path", { d: "M0 -1.2L1 -2.4L1.4 -0.8C3 -2.6 5.6 -3 8 -1.6C6.6 -1 6.4 0.2 6.6 1.2C5.4 0.4 4.2 0.6 3.6 1.6C2.8 0.8 1.8 0.8 1 2L0 1L-1 2C-1.8 0.8 -2.8 0.8 -3.6 1.6C-4.2 0.6 -5.4 0.4 -6.6 1.2C-6.4 0.2 -6.6 -1 -8 -1.6C-5.6 -3 -3 -2.6 -1.4 -0.8L-1 -2.4Z" }));
      bat.style.width = `${small ? 11 : 16}px`;
      bat.firstChild.style.animationDuration = `${(0.16 + Math.random() * 0.08).toFixed(2)}s`;
      box.append(bat);
      const y0 = h * (0.15 + Math.random() * 0.55);
      const x0 = dir > 0 ? -20 : w + 20;
      const frames = [];
      const wobble = 2 + Math.random() * 3;
      for (let k = 0; k <= 20; k++) {
        const p = k / 20;
        const y = y0 + Math.sin(p * wobble * 2 * Math.PI) * h * 0.08 + (Math.random() - 0.5) * 10;
        frames.push({ translate: `${(x0 + dir * (w + 40) * p).toFixed(0)}px ${y.toFixed(0)}px` });
      }
      bat.animate(frames, { duration: (small ? 5000 : 7000) + Math.random() * 3000, delay: i * (300 + Math.random() * 500), easing: "linear", fill: "backwards" })
        .onfinish = () => bat.remove();
    }
  }

  // Valentine's Day: one small heart drifts up from the prairie line,
  // swaying a little, and fades into the sky. Tapping it names it.
  function valentineHeart() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const size = 8 + Math.random() * 6;
    const heart = svgNode("svg", { class: "valentine-heart", viewBox: "0 0 16 16" });
    heart.append(svgNode("path", { d: HEART_PATH }));
    heart.style.width = heart.style.height = `${size.toFixed(1)}px`;
    box.append(heart);
    const x0 = w * (0.05 + Math.random() * 0.9);
    const sway = 6 + Math.random() * 10;
    const turns = 1 + Math.random() * 1.5;
    const frames = [];
    for (let k = 0; k <= 20; k++) {
      const p = k / 20;
      const x = x0 + Math.sin(p * turns * 2 * Math.PI) * sway;
      const y = h - size - p * h * 0.6;
      frames.push({ translate: `${x.toFixed(1)}px ${y.toFixed(1)}px`, opacity: p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.5) / 0.5).toFixed(2) });
    }
    const untap = tappable(heart, "Happy Valentine's Day", "From Longlight", 12);
    heart.animate(frames, { duration: 6000 + Math.random() * 3000, easing: "linear", fill: "both" }).onfinish = () => {
      heart.remove();
      untap();
    };
  }

  // One firework: a spark climbs from the ground, then bursts into a
  // ring of sparks that fall and fade. The palette's light colours.
  function firework() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const small = h < 140;
    const x = w * (0.1 + Math.random() * 0.8);
    const y = h * (0.15 + Math.random() * 0.35);
    const colour = ["clay", "lilac", "ivory"][Math.floor(Math.random() * 3)];
    const rise = el("i", `spark spark--${colour}`);
    rise.style.left = `${x}px`;
    rise.style.top = `${h}px`;
    box.append(rise);
    const up = 700 + Math.random() * 400;
    rise.animate(
      [{ translate: "0 0", opacity: 1 }, { translate: `${((Math.random() - 0.5) * 30).toFixed(0)}px ${-(h - y)}px`, opacity: 0.8 }],
      { duration: up, easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" }
    ).onfinish = () => {
      rise.remove();
      const n = small ? 16 : 28;
      const radius = (small ? 26 : 55) + Math.random() * (small ? 14 : 35);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI + Math.random() * 0.2;
        const s = el("i", `spark spark--${Math.random() < 0.8 ? colour : "ivory"}`);
        s.style.left = `${x}px`;
        s.style.top = `${y}px`;
        box.append(s);
        const dx = Math.cos(a) * radius, dy = Math.sin(a) * radius;
        s.animate(
          [
            { translate: "0 0", opacity: 1, scale: 1.4 },
            { translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px`, opacity: 1, scale: 1, offset: 0.45 },
            { translate: `${(dx * 1.1).toFixed(1)}px ${(dy * 1.1 + radius * 0.6).toFixed(1)}px`, opacity: 0, scale: 0.6 },
          ],
          { duration: 1600 + Math.random() * 600, easing: "cubic-bezier(0.1, 0.7, 0.3, 1)" }
        ).onfinish = () => s.remove();
      }
    };
  }

  // A tumbleweed rolling along the ground on a dry, windy day: bouncing
  // over the bumps, spinning as it goes, faster in a harder wind.
  function tumbleweed() {
    if (!scene.track || !scene.track.clientWidth) return;
    const { wind, dir } = breeze();
    const lane = el("div", "tumble-path");
    const weed = svgNode("svg", { class: "tumbleweed", viewBox: "-10 -10 20 20" });
    weed.append(svgNode("path", { d: "M-8 0A8 8 0 1 0 8 0A8 8 0 1 0 -8 0ZM-6 -3Q0 4 6 -4M-7 3Q-1 -6 5 6M-3 -7Q4 -1 -2 7M2 -7Q-5 0 3 7M-6 5Q0 1 7 2M-7 -2Q1 -1 6 -6" }));
    lane.append(weed);
    scene.track.after(lane);
    const w = scene.track.clientWidth;
    const size = weed.getBoundingClientRect().width || 14;
    const across = w + size * 2;
    const dur = Math.max(4500, (across / (wind * 0.9)) * 1000); // px per second grows with the wind
    const x0 = dir > 0 ? -size : w + size;
    const turns = across / (Math.PI * size);
    const frames = [];
    for (let i = 0; i <= 24; i++) {
      const p = i / 24;
      const hop = Math.abs(Math.sin(p * Math.PI * (4 + Math.random()))) * size * (0.4 + Math.random() * 0.5);
      frames.push({ transform: `translate(${(x0 + dir * across * p).toFixed(1)}px, ${(-hop).toFixed(1)}px) rotate(${(dir * turns * 360 * p).toFixed(0)}deg)` });
    }
    weed.animate(frames, { duration: dur, easing: "linear" }).onfinish = () => lane.remove();
  }

  // Harvest: a combine crawls along the gold wheat with a grain truck
  // behind it, cutting the field as it goes (style.css masks the cut
  // part of the wheat away using --cut, and short stubble shows instead).
  // The field grows back a while after.
  let harvesting = false;
  function combine() {
    const wheat = scene.querySelector(".horizon__wheat");
    if (!wheat || !wheat.clientWidth) return;
    harvesting = true;
    const left = Math.random() < 0.5; // heading left, or the right
    const rig = svgNode("svg", { class: "combine", viewBox: "0 0 70 21" });
    rig.append(
      svgNode("path", { d: "M0 18V14H9V18ZM8 15.5L14 12.5V14.5L9 17.5Z" }), // the header out front and its arm
      svgNode("path", { class: "combine__reel", d: "M1.5 12a3.5 3 0 1 0 7 0a3.5 3 0 1 0 -7 0Z" }), // the reel
      svgNode("path", { d: "M12 18V8H18V3H25V8H27V4H37V8H38V18Z" }), // body, cab and grain tank
      svgNode("path", { d: "M36 5H58V6.2H36ZM57 6.2H58.5V8.4H57Z" }), // the unloading auger, over the truck
      svgNode("rect", { class: "combine__glass", x: 19.2, y: 4.2, width: 4.6, height: 3 }),
      svgNode("circle", { cx: 16, cy: 17.2, r: 3.6 }), svgNode("circle", { cx: 34, cy: 18.4, r: 2.4 }),
      svgNode("path", { d: "M46 20.5V13.5H48L50 10.5H54V20.5ZM55 20.5V11H70V20.5Z" }), // the grain truck
      svgNode("circle", { cx: 50, cy: 20.2, r: 1.7 }), svgNode("circle", { cx: 63.5, cy: 20.2, r: 1.7 }), svgNode("circle", { cx: 67.5, cy: 20.2, r: 1.7 })
    );
    const lane = el("div", "harvest-path");
    lane.style.transform = left ? "" : "scaleX(-1)"; // drawn heading left
    lane.append(rig);
    wheat.after(lane);
    const w = wheat.clientWidth;
    const own = rig.getBoundingClientRect().width || 70;
    const dur = 42000 + Math.random() * 18000;
    scene.style.setProperty("--cut-dir", left ? "to left" : "to right");
    scene.classList.add("horizon--harvest");
    const run = rig.animate([{ translate: `${w}px 0` }, { translate: `${-own}px 0` }], { duration: dur, easing: "linear" });
    // Keep the edge of the cut field under the header as it goes
    (function follow() {
      if (!rig.isConnected) return;
      const p = Math.min(1, (run.currentTime || 0) / dur);
      scene.style.setProperty("--cut", `${(p * (w + own)).toFixed(1)}px`);
      if (p < 1) requestAnimationFrame(follow);
    })();
    run.onfinish = () => {
      lane.remove();
      harvesting = false;
      // The field grows back a minute later (fading in)
      setTimeout(() => {
        scene.classList.add("horizon--regrow");
        scene.classList.remove("horizon--harvest");
        scene.style.setProperty("--cut", "0px");
        setTimeout(() => scene.classList.remove("horizon--regrow"), 2500);
      }, 60000);
    };
  }

  // Things in the sky that say what they are when tapped (setUpSkyTaps
  // reads this list). Each entry is removed with its node.
  scene.tapCritters = new Set();
  const tappable = (node, title, detail, r, onTap) => {
    const entry = { node, title, detail, r, onTap };
    scene.tapCritters.add(entry);
    return () => scene.tapCritters.delete(entry);
  };

  // A group of pelicans riding a thermal: each one circles (a flattened
  // ring, as seen from below) at its own pace and size, the whole group
  // climbing slowly while the breeze carries it across. White with black
  // wingtips, like the real ones; lilac-white in the dark theme.
  let pelicansUp = false;
  function pelicans() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    pelicansUp = true;
    const small = h < 140;
    const { dir } = breeze();
    const group = el("div", "pelicans");
    const y0 = h * (0.3 + Math.random() * 0.25);
    group.style.top = `${y0.toFixed(0)}px`;
    const birds = 5 + Math.floor(Math.random() * 6);
    const spread = small ? 22 : 38; // how wide the thermal is
    for (let i = 0; i < birds; i++) {
      const bird = svgNode("svg", { class: "pelican", viewBox: "-12 -3 24 6" });
      bird.append(
        svgNode("path", { class: "pelican__wing", d: "M-11 -0.6Q-5 -1.6 0 -0.4Q5 -1.6 11 -0.6L11.4 0.4Q5 -0.2 0 1Q-5 -0.2 -11.4 0.4Z" }),
        svgNode("path", { class: "pelican__tips", d: "M-11 -0.6L-7.5 -1.1L-7.6 0.1L-11.4 0.4ZM11 -0.6L7.5 -1.1L7.6 0.1L11.4 0.4Z" }),
        svgNode("path", { class: "pelican__body", d: "M-0.6 -0.6L0.6 -0.6L0.6 2.2L-0.6 2.2ZM0 -0.6L0 -2.6L1.2 -2.2Z" }) // body and the long bill
      );
      group.append(bird);
      const rx = spread * (0.35 + Math.random() * 0.65), ry = rx * 0.3;
      const turn = Math.random() < 0.85 ? 1 : -1; // nearly all circle the same way
      const lap = 9000 + Math.random() * 5000;
      const frames = [];
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * 2 * Math.PI * turn;
        frames.push({ transform: `translate(${(Math.cos(a) * rx).toFixed(1)}px, ${(Math.sin(a) * ry).toFixed(1)}px) rotate(${(-Math.sin(a) * 10 * turn).toFixed(1)}deg)` });
      }
      bird.animate(frames, { duration: lap, iterations: Infinity, delay: -Math.random() * lap });
    }
    box.append(group);
    const done = tappable(group, "American white pelicans", "Saskatoon's summer birds, riding warm air up in circles", spread);
    const x0 = dir > 0 ? -spread - 20 : w + spread + 20;
    group.animate(
      [{ translate: `${x0}px 0` }, { translate: `${x0 + dir * (w + spread * 2 + 40)}px ${-(h * 0.18).toFixed(0)}px` }],
      { duration: (small ? 50000 : 70000) + Math.random() * 20000, easing: "linear" }
    ).onfinish = () => {
      group.remove();
      done();
      pelicansUp = false;
    };
  }

  // A hot-air balloon drifting very slowly on the calm air, bobbing a
  // little and lighting its burner now and then (style.css).
  let balloonUp = false;
  function balloon() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    balloonUp = true;
    const small = h < 140;
    const { wind, dir } = breeze();
    const ship = svgNode("svg", { class: "balloon", viewBox: "-12 -15 24 32" });
    ship.append(
      svgNode("path", { class: "balloon__body", d: "M0 -14C7.5 -14 11 -8.5 11 -3.5C11 2.5 5.5 6.5 3.2 10H-3.2C-5.5 6.5 -11 2.5 -11 -3.5C-11 -8.5 -7.5 -14 0 -14Z" }),
      svgNode("path", { class: "balloon__gore", d: "M0 -14C-4.2 -10 -4.6 2 -1.6 10H1.6C4.6 2 4.2 -10 0 -14Z" }), // the middle panel
      svgNode("path", { class: "balloon__band", d: "M-10.6 -1H10.6L10 1.6H-10Z" }), // a band round its widest part
      svgNode("path", { class: "balloon__ropes", d: "M-3 10L-2 13.2M3 10L2 13.2" }),
      svgNode("path", { class: "balloon__flame", d: "M0 13.2Q-1 11.6 0 10.2Q1 11.6 0 13.2Z" }),
      svgNode("rect", { class: "balloon__basket", x: -2.2, y: 13.2, width: 4.4, height: 3.2, rx: 0.5 })
    );
    ship.style.width = `${small ? 18 : 28}px`;
    const y = h * (0.25 + Math.random() * 0.35);
    ship.style.top = `${y.toFixed(0)}px`;
    box.append(ship);
    const done = tappable(ship, "Hot-air balloon", () => {
      const air = breeze();
      return air.wind < 1 ? "Not a breath of wind: perfect for a flight" : `A calm ${Math.round(air.wind)} km/h: perfect for a flight`;
    });
    // Mostly across with the breeze, but it starts somewhere in the sky
    // (it took off from a field) and rises a little first
    const x0 = w * (dir > 0 ? Math.random() * 0.3 : 0.7 + Math.random() * 0.3);
    const x1 = dir > 0 ? w + 30 : -30;
    const dur = Math.max(120000, (Math.abs(x1 - x0) / Math.max(2, wind)) * 6000);
    const rise = Math.min(0.08, 5000 / dur); // fades in over about 5 seconds
    ship.animate(
      [{ translate: `${x0.toFixed(0)}px 14px`, opacity: 0 }, { translate: `${(x0 + (x1 - x0) * rise).toFixed(0)}px 0px`, opacity: 1, offset: rise }, { translate: `${x1}px -12px`, opacity: 1 }],
      { duration: dur, easing: "linear" }
    ).onfinish = () => {
      ship.remove();
      done();
      balloonUp = false;
    };
  }

  // A flock of snow buntings: small white birds that fly tight together,
  // dipping and wheeling low over the snow. Each bird keeps its own spot
  // in the flock, which slowly turns over as they go, and they flash as
  // they bank (white bellies, darker backs).
  function buntings() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const small = h < 140;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const n = (small ? 14 : 22) + Math.floor(Math.random() * 12);
    const flock = el("div", "buntings");
    const r = small ? 14 : 24; // the flock's size
    const dur = (small ? 7000 : 10000) + Math.random() * 4000;
    const x0 = dir > 0 ? -r * 2 : w + r * 2;
    const base = h * (0.6 + Math.random() * 0.15);
    const dips = 1.5 + Math.random();
    const spin = (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random());
    for (let i = 0; i < n; i++) {
      const bird = el("i", "bunting");
      // A spot in an oval, packed toward the middle
      const a0 = Math.random() * 2 * Math.PI, d = Math.sqrt(Math.random());
      const frames = [];
      for (let k = 0; k <= 24; k++) {
        const p = k / 24;
        const a = a0 + p * spin * 2 * Math.PI;
        const cx = x0 + dir * (w + r * 4) * p;
        const cy = base - Math.sin(p * dips * Math.PI) * h * 0.25 + Math.sin(p * 9) * 4;
        const x = cx + Math.cos(a) * r * 1.6 * d;
        const y = cy + Math.sin(a) * r * 0.5 * d;
        frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, opacity: (0.55 + 0.45 * Math.abs(Math.cos(a + p * 6))).toFixed(2) });
      }
      bird.animate(frames, { duration: dur, delay: Math.random() * 300, easing: "linear", fill: "backwards" }).onfinish = () => bird.remove();
      flock.append(bird);
    }
    box.append(flock);
    setTimeout(() => flock.remove(), dur + 600);
  }

  // The secret parade (tap the sun seven times, or type "longlight"):
  // everything in the sky comes out at once for about 20 seconds.
  let paradeOn = false;
  scene.parade = () => {
    if (paradeOn) return;
    paradeOn = true;
    scene.classList.add("horizon--parade");
    const { wind, dir } = breeze();
    flock();
    setTimeout(flock, 1500);
    if (!jetFlying) jet();
    if (!trainRunning) train();
    if (!hawkFlying) hawk(dir);
    if (!pelicansUp) pelicans();
    if (!balloonUp) balloon();
    setTimeout(buntings, 1000);
    bats();
    setTimeout(bats, 2500);
    tumbleweed();
    setTimeout(tumbleweed, 3500);
    for (let i = 0; i < 8; i++) setTimeout(() => leaf(Math.max(wind, 20), dir), i * 400);
    if (scene.meteorBurst) scene.meteorBurst(12, 6000);
    for (let i = 0; i < 26; i++) setTimeout(firework, 2500 + i * 600 + Math.random() * 300);
    kiteUp(true);
    setTimeout(() => {
      paradeOn = false;
      scene.classList.remove("horizon--parade");
      if (!kiteTime(timeNow()) && CRITTER !== "kite") kiteUp(false);
    }, 21000);
  };

  setInterval(() => {
    if (document.hidden) return;
    const t = timeNow();
    fireflies(firefliesTime(t) || CRITTER === "fireflies");
    if (!spinning) kiteUp(kiteTime(t) || CRITTER === "kite"); // not mid-spin, so it can see where the sun is
    if (spinning) return;
    const geese = CRITTER === "geese" ? 1 / 8 : geeseTime(t) ? 1 / GEESE_EVERY_S : 0;
    if (Math.random() < geese) flock();
    if (leavesTime(t) || CRITTER === "leaves") {
      const { wind, dir } = breeze();
      if (Math.random() < Math.min(0.9, 0.2 + wind / 50)) leaf(wind, dir);
      if (wind > 25 && Math.random() < 0.5) leaf(wind, dir); // gusty: more of them
    }
    if (!jetFlying && (CRITTER === "jet" || (jetTime(t) && Math.random() < 1 / JET_EVERY_S))) jet();
    if (!trainRunning && (CRITTER === "train" || Math.random() < 1 / TRAIN_EVERY_S)) train();
    if (!carRunning && (CRITTER === "stockcar" || Math.random() < 1 / CAR_EVERY_S)) stockCar();
    if (!hawkFlying && (CRITTER === "hawk" || (hawkTime(t) && Math.random() < 1 / HAWK_EVERY_S))) hawk(breeze().dir);
    if (Math.random() < (CRITTER === "bats" ? 0.5 : batsTime(t) ? 1 / BATS_EVERY_S : 0)) bats();
    if (Math.random() < (CRITTER === "hearts" ? 0.5 : heartsTime(t) ? 1 / HEARTS_EVERY_S : 0)) valentineHeart();
    if (CRITTER === "fireworks" || fireworksTime(t)) {
      if (Math.random() < 0.7) firework();
      if (Math.random() < 0.3) setTimeout(firework, 500);
    }
    if (Math.random() < (CRITTER === "tumbleweed" ? 0.3 : tumbleTime(t) ? 1 / TUMBLE_EVERY_S : 0)) tumbleweed();
    if (!harvesting && (CRITTER === "combine" ? !scene.classList.contains("horizon--harvest") : combineTime(t) && Math.random() < 1 / COMBINE_EVERY_S)) combine();
    if (!pelicansUp && (CRITTER === "pelicans" || (pelicanTime(t) && Math.random() < 1 / PELICAN_EVERY_S))) pelicans();
    if (!balloonUp && (CRITTER === "balloon" || (balloonTime(t) && Math.random() < 1 / BALLOON_EVERY_S))) balloon();
    if (Math.random() < (CRITTER === "buntings" ? 1 / 6 : buntingTime(t) ? 1 / BUNTING_EVERY_S : 0)) buntings();
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
  // Put the sun where the spin starts straight away, so it never shows
  // in its stand-in spot for a frame and then jumps.
  placeSun(scene, new Date(now().getTime() - 86400000));
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
   fiddling), then slides back to right now. On a computer it's the same
   with the mouse: click and drag sideways. Up-and-down swipes on a phone
   still scroll the page. */
const SWIPE_HOURS = 10; // hours per full width (bigger = faster)
const SWIPE_MAX_HOURS = 36; // how far either way a swipe can go
const SWIPE_START_PX = 10; // sideways movement before it counts as a swipe
const SWIPE_HOLD_MS = 2000; // how long it waits after you let go before heading back
const SWIPE_BACK_MS = 8000; // how long the slide back to "now" takes (slow, so the elevator's shadow can be watched turning)
const SWIPE_GLIDE_MS = 550; // how long a flick keeps coasting (bigger = longer glide)
const HOLD_START_MS = 450; // press and hold this long (without moving) to wind on to sunset or sunrise
const HOLD_RUN_MS = 2600; // how long winding on takes
const YEAR_MS = 10000; // holding the sun plays a whole year in this long

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
      shown = from * Math.pow(1 - p, 2); // a little quicker at first, then a long gentle ease into place
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
  // Holding the sun itself plays a whole year instead: the same time of
  // day, a day a frame, so the sun climbs toward summer and sinks toward
  // winter, the moon runs through its phases and the ground changes with
  // the seasons. Letting go rewinds to today.
  function startYear() {
    hideTip(scene);
    hold.live = true;
    drag = null;
    const run = ++skyRun;
    swiping = spinning = true;
    scene.classList.add("horizon--spin");
    try {
      scene.setPointerCapture(hold.id);
    } catch (err) {}
    const from = Math.round(shown / 86400000);
    let start = null;
    requestAnimationFrame(function frame(ms) {
      if (run !== skyRun) return;
      if (start === null) start = ms;
      const p = Math.min(1, (ms - start) / YEAR_MS);
      // Whole days only, so it's always the same time of day
      shown = (from + Math.round(p * 365)) * 86400000;
      paint(new Date(now().getTime() + shown), shown);
      if (p < 1) requestAnimationFrame(frame);
    });
  }
  // Back from the year to today, quickly, still a whole day at a time
  // (sliding smoothly would flick through 365 days and nights).
  function rewindYear() {
    const run = ++skyRun;
    const days = Math.round(shown / 86400000);
    let start = null;
    requestAnimationFrame(function frame(ms) {
      if (run !== skyRun) return;
      if (start === null) start = ms;
      const p = REDUCE_MOTION ? 1 : Math.min(1, (ms - start) / 1200);
      shown = Math.round(days * (1 - p) * (1 - p)) * 86400000;
      if (p < 1) {
        paint(new Date(now().getTime() + shown), shown);
        requestAnimationFrame(frame);
      } else {
        shown = 0;
        swiping = spinning = false;
        scene.classList.remove("horizon--spin");
        paint(now(), null);
      }
    });
  }
  function endHold(e) {
    if (!hold || e.pointerId !== hold.id) return;
    clearTimeout(hold.timer);
    if (hold.live) {
      lastSkyDrag = performance.now();
      if (hold.year) rewindYear();
      else slideBack();
    }
    hold = null;
  }
  // Is a press at (x, y) on the sun (with a little room round it)?
  function onSun(x, y) {
    const sun = scene.querySelector(".horizon__sun");
    if (!sun || sunAltitude(new Date(now().getTime() + shown)) < -1) return false;
    const r = sun.getBoundingClientRect();
    return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < r.width / 2 + 14;
  }
  scene.addEventListener("pointerdown", (e) => {
    if (hold || e.button > 0) return;
    const year = !REDUCE_MOTION && onSun(e.clientX, e.clientY);
    hold = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false, year };
    hold.timer = setTimeout(year ? startYear : startHold, HOLD_START_MS);
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
    if (e.button > 0 || drag) return; // left mouse button, finger or pen
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
      scene.classList.add("horizon--spin", "horizon--grabbing");
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
    scene.classList.remove("horizon--grabbing");
    lastSkyDrag = performance.now();
    glide(e.type === "pointerup" ? flickSpeed(was, e.timeStamp) : 0);
  }
  scene.addEventListener("pointerup", end);
  scene.addEventListener("pointercancel", end);
  scene.addEventListener("dragstart", (e) => e.preventDefault()); // no ghost image when dragging with a mouse

  // The moment the sky is showing (now, or wherever a swipe left it)
  return () => new Date(now().getTime() + shown);
}

// While swiping: "Tomorrow 2:15 AM" and how far from now that is.
function swipeLine(t, ahead) {
  const a = localParts(t);
  const b = localParts(now());
  const days = Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
  if (Math.abs(days) > 2) {
    // Holding the sun: the date as the year plays
    return [`${MONTHS[a.m - 1]} ${a.d} · ${clock(t)}`, "A year in 10 seconds · let go to come back"];
  }
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

/* ---------- Tilt and compass ----------
   On a phone, "Tilt sky" (in the home page hero) lets the sky follow the
   phone. Tilting it slides the stars, moon and clouds a little, like
   looking through a window (style.css moves them by --tilt-x and
   --tilt-y, only when motion is allowed). The compass turns the stars and
   planets to whichever way the phone faces, and dims the sun or moon when
   they're behind you. iPhones ask permission once, after the tap. The
   choice is kept on this phone (localStorage "kelbo.motion"), so the
   other pages' skies follow too. */
const MOTION_KEY = "kelbo.motion";
const TILT_DEG = 25; // tilting this far (degrees) moves the sky all the way
const TILT_SETTLE = 0.006; // how fast "level" catches up with how you hold the phone (per reading, about 3 s)

function setUpMotion(scene, timeNow) {
  const btn = document.querySelector("[data-motion-switch]");
  if (!("DeviceOrientationEvent" in window) || !matchMedia("(pointer: coarse)").matches) return;
  const needsAsk = typeof DeviceOrientationEvent.requestPermission === "function"; // iPhone
  const facing = scene.closest(".page-head") ? null : document.createElement("p");
  if (facing) {
    facing.className = "horizon__facing";
    facing.hidden = true;
    scene.append(facing);
  }
  let on = false;
  let level = null; // the tilt the phone is held at, which counts as "flat"
  let tilt = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  let heading = null, shownHeading = null;
  let frame = 0, lastBehind = 0;

  function reading(e) {
    if (e.beta == null || e.gamma == null) return;
    if (!level) level = { b: e.beta, g: e.gamma };
    // "Level" drifts slowly toward however you're holding it, so the sky
    // settles back to the middle when you stop tilting.
    level.b += (e.beta - level.b) * TILT_SETTLE;
    level.g += (e.gamma - level.g) * TILT_SETTLE;
    const clamp = (v) => Math.max(-1, Math.min(1, v / TILT_DEG));
    aim = { x: clamp(e.gamma - level.g), y: clamp(e.beta - level.b) };
    // Compass: iPhones give the heading straight; Android gives alpha on
    // its "absolute" event, which runs the other way round.
    let h = null;
    if (Number.isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading;
    else if (e.absolute && Number.isFinite(e.alpha)) h = 360 - e.alpha;
    if (h != null) heading = (h + ((screen.orientation && screen.orientation.angle) || 0) + 360) % 360;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  // Once a frame at most: ease toward the latest reading and redraw.
  function draw() {
    frame = 0;
    tilt.x += (aim.x - tilt.x) * 0.2;
    tilt.y += (aim.y - tilt.y) * 0.2;
    scene.style.setProperty("--tilt-x", tilt.x.toFixed(3));
    scene.style.setProperty("--tilt-y", tilt.y.toFixed(3));
    setPageTilt(tilt);
    if (heading != null) {
      if (shownHeading == null) shownHeading = heading;
      const turn = ((heading - shownHeading + 540) % 360) - 180; // the short way round
      shownHeading = (shownHeading + turn * 0.25 + 360) % 360;
      if (Math.abs(skyFacing - shownHeading) > 0.4 || (facing && facing.hidden)) {
        skyFacing = shownHeading;
        const t = timeNow();
        placeStars(scene, t);
        if (performance.now() - lastBehind > 300) behind(t);
      }
    }
    if (Math.abs(aim.x - tilt.x) > 0.002 || Math.abs(aim.y - tilt.y) > 0.002) frame = requestAnimationFrame(draw);
  }

  // Dims the sun and moon when they're behind the way you face, and
  // says which way that is.
  function behind(t) {
    lastBehind = performance.now();
    const back = (az) => Math.abs(skyX(az) - 0.5) > 0.6;
    const m = moonRaDec(t);
    scene.classList.toggle("horizon--sun-behind", back(sunAltAz(t).az));
    scene.classList.toggle("horizon--moon-behind", back(altAz(m.ra * R2D, m.dec * R2D, t).az));
    if (facing) {
      facing.textContent = `Facing ${compassName(skyFacing)}`;
      facing.hidden = false;
    }
  }

  function start() {
    on = true;
    level = null;
    window.addEventListener("deviceorientation", reading);
    window.addEventListener("deviceorientationabsolute", reading);
    label();
  }

  function stop() {
    on = false;
    window.removeEventListener("deviceorientation", reading);
    window.removeEventListener("deviceorientationabsolute", reading);
    aim = { x: 0, y: 0 };
    heading = shownHeading = null;
    skyFacing = 180;
    scene.classList.remove("horizon--sun-behind", "horizon--moon-behind");
    if (facing) facing.hidden = true;
    placeStars(scene, timeNow());
    if (!frame) frame = requestAnimationFrame(draw);
    label();
  }

  function label() {
    if (!btn) return;
    btn.textContent = on ? "Stop tilting" : "Tilt sky";
    btn.setAttribute("aria-pressed", String(on));
  }

  // Asks the iPhone for permission (it only asks after a tap; once
  // allowed it answers straight away).
  function ask() {
    if (!needsAsk) return Promise.resolve(true);
    return DeviceOrientationEvent.requestPermission().then((r) => r === "granted", () => false);
  }

  let saved = false;
  try {
    saved = localStorage.getItem(MOTION_KEY) === "on";
  } catch (e) {}
  if (saved) ask().then((ok) => ok && start());

  if (!btn) return;
  btn.hidden = false;
  label();
  btn.addEventListener("click", () => {
    if (on) {
      stop();
      try {
        localStorage.removeItem(MOTION_KEY);
      } catch (e) {}
      return;
    }
    ask().then((ok) => {
      if (!ok) {
        btn.textContent = "Motion not allowed";
        setTimeout(label, 3000);
        return;
      }
      start();
      try {
        localStorage.setItem(MOTION_KEY, "on");
      } catch (e) {}
    });
  });
}

/* ---------- The live tab icon ----------
   The browser tab's icon redraws itself as a tiny copy of the sky right
   now: purple by day with the sun where it really is, slate at night
   with the moon and a few stars, and a cloud on a cloudy day. Phones
   that don't show tab icons just ignore it, and the plain icon in each
   page's <head> stays for anyone without JavaScript. */
let iconKey = "";
function skyIcon(scene) {
  const link = document.querySelector('link[rel="icon"]');
  if (!link || !scene) return;
  const dark = document.documentElement.dataset.theme === "dark";
  const css = (name) => parseFloat(skyVarOf(scene, name)) || 0;
  const sx = css("--sun-x"), sa = css("--sun-alt");
  const mx = css("--moon-x"), ma = css("--moon-alt"), ms = css("--moon-show");
  const cloud = weather ? weather.cloud : 0;
  // Snap to whole pixels, so it only redraws when something visibly moves
  const sun = { x: Math.round(6 + sx * 52), y: Math.round(40 - sa * 24) };
  const moon = { x: Math.round(6 + mx * 52), y: Math.round(40 - ma * 24) };
  const phase = moonPhase(now());
  const key = [dark, sun.x, sun.y, moon.x, moon.y, ms > 0.5, cloud >= 50, cloud >= 85, Math.round(phase * 16)].join();
  if (key === iconKey) return;
  iconKey = key;
  let art = "";
  if (dark) {
    art += '<g fill="#B48CE8"><circle cx="12" cy="12" r="1.3"/><circle cx="50" cy="9" r="1"/><circle cx="34" cy="17" r="0.9"/><circle cx="22" cy="26" r="0.8"/></g>';
    if (ms > 0.5 && ma > 0) {
      art += `<g transform="translate(${moon.x} ${moon.y}) scale(7)"><circle r="1" fill="#D97757" opacity="0.2"/><path d="${moonPath(phase)}" fill="#D97757"/></g>`;
    }
  } else if (sa > -0.3) {
    // The glow breathes, like the big sun's. Only browsers that animate
    // tab icons (Firefox) show it; the rest draw the first frame.
    const pulse = REDUCE_MOTION ? "" :
      '<animate attributeName="r" values="14;17;14" dur="5s" repeatCount="indefinite"/>' +
      '<animate attributeName="opacity" values="0.3;0.45;0.3" dur="5s" repeatCount="indefinite"/>';
    art += `<circle cx="${sun.x}" cy="${sun.y}" r="15" fill="#D97757" opacity="0.3">${pulse}</circle><circle cx="${sun.x}" cy="${sun.y}" r="10" fill="#D97757"/>`;
  }
  if (cloud >= 50) {
    const puff = (x, y, k) => `<path transform="translate(${x} ${y}) scale(${k})" d="M-9 4H9A4 4 0 0 0 7 -3A6 6 0 0 0 -4 -4A5 5 0 0 0 -9 4Z" fill="#FAF9F5" opacity="${dark ? 0.35 : 0.92}"/>`;
    art += puff(42, 20, 1.1) + (cloud >= 85 ? puff(20, 13, 0.9) : "");
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><clipPath id="c"><rect width="64" height="40"/></clipPath>` +
    `<rect width="64" height="64" rx="16" fill="${dark ? "#141413" : "#7B3FC4"}"/><g clip-path="url(#c)">${art}</g>` +
    `<rect x="8" y="40" width="48" height="4" fill="${dark ? "#7B3FC4" : "#FAF9F5"}"/></svg>`;
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ---------- Mouse parallax and tilting covers ----------
   On a computer (a mouse, no touch), moving the pointer shifts the
   stars, moon, aurora and clouds a little against the land, the same
   way tilting a phone does (it sets the same --tilt-x and --tilt-y).
   Game cards tip toward the pointer in 3D with a glint on the cover. */
function setUpMouseSky(scene) {
  if (!scene || REDUCE_MOTION || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  let aim = { x: 0, y: 0 }, tilt = { x: 0, y: 0 }, frame = 0;
  function draw() {
    frame = 0;
    tilt.x += (aim.x - tilt.x) * 0.08;
    tilt.y += (aim.y - tilt.y) * 0.08;
    scene.style.setProperty("--tilt-x", tilt.x.toFixed(3));
    scene.style.setProperty("--tilt-y", tilt.y.toFixed(3));
    setPageTilt(tilt);
    if (Math.abs(aim.x - tilt.x) > 0.002 || Math.abs(aim.y - tilt.y) > 0.002) frame = requestAnimationFrame(draw);
  }
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = scene.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return; // scrolled out of sight
    aim = { x: (e.clientX / innerWidth) * 2 - 1, y: Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)) };
    if (!frame) frame = requestAnimationFrame(draw);
  });
  document.documentElement.addEventListener("pointerleave", () => {
    aim = { x: 0, y: 0 };
    if (!frame) frame = requestAnimationFrame(draw);
  });
}

const PRESS_TILT_MS = 160; // how long a finger rests on a card before it tips

function setUpCoverTilt() {
  if (REDUCE_MOTION) return;
  let card = null;
  const settle = () => {
    if (card) card.classList.remove("is-tilting");
    card = null;
  };
  // Tip a card toward the pointer (x, y on the page); "k" is how far.
  const lean = (over, e, k) => {
    card = over;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.setProperty("--ry", `${((px - 0.5) * 9 * k).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${((0.5 - py) * 7 * k).toFixed(2)}deg`);
    card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    card.classList.add("is-tilting");
  };
  const cardAt = (e) => {
    const over = e.target.closest ? e.target.closest(".project") : null;
    return over && over.querySelector(".project__cover img") ? over : null;
  };
  // A mouse: the card follows it while it's over the card
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const over = cardAt(e);
      if (over !== card) settle();
      if (over) lean(over, e, 1);
    });
    document.documentElement.addEventListener("pointerleave", settle);
  }
  // A finger: the card leans toward it once it has been held still for a
  // moment, and settles on letting go. A swipe never tips a card: the
  // press turns into a scroll (pointercancel) before the wait is over.
  let hold = 0;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    const over = cardAt(e);
    clearTimeout(hold);
    if (over) hold = setTimeout(() => lean(over, e, 0.7), PRESS_TILT_MS);
  }, { passive: true });
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" && card) lean(card, e, 0.7);
  }, { passive: true });
  ["pointerup", "pointercancel"].forEach((name) => {
    document.addEventListener(name, (e) => {
      if (e.pointerType === "mouse") return;
      clearTimeout(hold);
      settle();
    });
  });
}

/* ---------- The cover hop ----------
   Tapping a game card ("About this game") grows its cover into the big
   cover on the game's own page, instead of a plain fade. It uses the
   browser's page transitions (style.css, "view-transition"): the tapped
   cover and the game page's cover share the name "game-cover", so the
   browser slides and stretches one into the other. The game page builds
   its cover from projects.json a moment after it opens, too late for the
   transition, so the tapped picture's address is passed along in
   sessionStorage and a small script in game.html puts it in place at
   once. Newer browsers only (Chrome, Edge, Safari 18.2+); others keep the
   fade. Off with "reduce motion". */
const HOP_KEY = "kelbo.coverHop";
function setUpCoverHop() {
  if (REDUCE_MOTION || !("onpagereveal" in window)) return;
  const clear = () => {
    document.querySelectorAll("[data-hop]").forEach((node) => {
      node.style.viewTransitionName = "";
      delete node.dataset.hop;
    });
  };
  document.addEventListener("click", (e) => {
    const link = e.target.closest ? e.target.closest("a.project__main") : null;
    const card = link && link.closest(".project");
    const img = card && card.querySelector(".project__cover img");
    if (!img || !/^game-[a-z0-9-]+\.html$/.test(link.getAttribute("href") || "")) return;
    clear();
    img.parentNode.style.viewTransitionName = "game-cover";
    img.parentNode.dataset.hop = "";
    try {
      sessionStorage.setItem(HOP_KEY, JSON.stringify({ to: link.href, src: img.currentSrc || img.src, at: Date.now() }));
    } catch (err) { /* private mode: the page just fades */ }
  });
  // Coming back (the browser may bring this page back as it was): let the
  // cover shrink home, then take the name off so the next tap starts clean.
  window.addEventListener("pagereveal", (e) => {
    if (e.viewTransition) e.viewTransition.finished.then(clear, clear);
    else clear();
  });
}

/* ---------- The pull sky (and pull-to-refresh in the home-screen app) ----------
   Adds the bit of sky that shows when you pull the page down past the top
   (styles: .pull-sky in style.css). In the app saved to an iPhone's home
   screen, which has no pull-to-refresh of its own, it also refreshes: pull
   down at the top of the page, the sun rises and the label changes to
   "Let go to refresh", and letting go then reloads the page. The site
   always fetches its newest copy on a reload, so this is how the app
   picks up changes without being swiped closed. */
function setUpPullSky() {
  const sky = el("div", "pull-sky");
  sky.setAttribute("aria-hidden", "true");
  const label = el("span", "pull-sky__label");
  sky.append(el("i", "pull-sky__dots"), el("i", "pull-sky__sun"), label);
  document.body.prepend(sky);

  // Only the iPhone home-screen app: browsers have their own refresh.
  if (navigator.standalone !== true) return;
  const FAR = 110; // how far (in pixels) to pull before letting go refreshes
  let startY = null;
  let pull = 0;
  const show = (p) => {
    sky.style.setProperty("--pull", p.toFixed(2));
    sky.classList.toggle("is-ready", p >= 1);
    label.textContent = p >= 1 ? "Let go to refresh" : "Pull to refresh";
  };
  addEventListener("touchstart", (e) => {
    startY = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
    pull = 0;
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (startY === null) return;
    pull = Math.max(0, Math.min(1, (e.touches[0].clientY - startY) / FAR));
    show(pull);
  }, { passive: true });
  addEventListener("touchend", () => {
    if (startY !== null && pull >= 1) {
      label.textContent = "Refreshing…";
      location.reload();
    }
    startY = null;
  }, { passive: true });
}

/* ---------- The scroll sun ----------
   A thin clay line down the right edge of every long page, with a small
   sun that travels down it as you scroll and sets into a little horizon
   at the bottom. It only shows where it moves with your finger, so it's
   off with "reduce motion", and on pages too short to scroll much. */
function setUpScrollSun() {
  if (REDUCE_MOTION) return;
  const rail = el("div", "scroll-sun");
  rail.setAttribute("aria-hidden", "true");
  rail.append(el("i", "scroll-sun__sun"));
  document.body.append(rail);
  const header = document.querySelector(".site-header");
  let frame = 0;
  const draw = () => {
    frame = 0;
    const room = document.documentElement.scrollHeight - innerHeight;
    const shown = room > innerHeight * 0.6;
    rail.classList.toggle("is-shown", shown);
    // While the sun shows, phones hide their own grey scroll bar (style.css)
    // so there aren't two scroll markers side by side.
    document.documentElement.classList.toggle("has-scroll-sun", shown);
    rail.style.setProperty("--p", room > 0 ? Math.min(1, Math.max(0, scrollY / room)).toFixed(4) : "0");
    if (header) rail.style.setProperty("--top", `${header.offsetHeight + 14}px`);
  };
  const ask = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  addEventListener("scroll", ask, { passive: true });
  addEventListener("resize", ask);
  // Lists arrive after the page opens, which makes it longer
  if ("ResizeObserver" in window) new ResizeObserver(ask).observe(document.body);
  draw();
}

/* ---------- The character sheet boots up (about.html) ----------
   When the sheet scrolls into view its name types in letter by letter,
   the three stat boxes tick on one after another, and further down each
   party member slides in with its buff lines giving a pulse (style.css,
   "sheet--boot"). The words don't change, only how they arrive. Skipped
   with "reduce motion". */
function setUpSheet() {
  const sheet = document.querySelector(".sheet");
  if (!sheet || REDUCE_MOTION || !("IntersectionObserver" in window)) return;
  const name = sheet.querySelector(".sheet__name");
  if (name) {
    // One <span> per letter so each can switch on in turn. Screen readers
    // get the whole name from aria-label instead of five loose letters.
    const text = name.textContent.trim();
    name.setAttribute("aria-label", text);
    name.replaceChildren(
      ...[...text].map((letter, i) => {
        const span = el("span", "sheet__ch", letter);
        span.setAttribute("aria-hidden", "true");
        span.style.setProperty("--i", i);
        return span;
      })
    );
  }
  sheet.querySelectorAll(".sheet__stats > div").forEach((box, i) => box.style.setProperty("--i", i));
  sheet.classList.add("sheet--boot");
  const head = sheet.querySelector(".sheet__head") || sheet;
  const watcher = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      sheet.classList.add("is-on");
      watcher.disconnect();
    },
    { threshold: 0.3 }
  );
  watcher.observe(head);
  sheet.querySelectorAll(".party__member").forEach((member) => {
    member.classList.add("party__member--slide");
    reveal(member);
  });
}

/* ---------- The quest log (about.html) ----------
   Every project from projects.json as one short row: its name, its
   status and the same progress bar the cards use, in projects.json order
   (Kelbo's ranking, the same as the Games page). Each row links to the
   game's page (or the project itself). */
function setUpQuests(listEl, projects) {
  const rows = projects;
  listEl.replaceChildren();
  rows.forEach((project, i) => {
    const status = findStatus(project.status);
    const title = project.title || "Untitled";
    const row = el("li", "quest");
    const href = isGame(project) ? gamePage(title) : project.link;
    const top = el(href ? "a" : "div", "quest__top");
    if (href) top.href = href;
    top.append(el("span", "quest__name", title), el("span", "quest__state", status.label));
    // The bar is decoration: the status is written right beside the name
    const field = el("div", "field is-waiting");
    field.setAttribute("aria-hidden", "true");
    field.style.setProperty("--progress", status.spot);
    field.dataset.stage = status.stage;
    field.append(el("span", "field__drive"), el("span", "field__ball"));
    row.append(top, field);
    row.style.setProperty("--i", i % 6);
    listEl.append(row);
    reveal(row);
  });
}

/* ---------- The logo secret ----------
   On the home page the logo already is "home", so tapping it scrolls back
   to the top. Tap it five times quickly and its sun rises again with a
   burst of confetti (and the sting, if Sound is on), and the hidden
   Lightkeeper badge is earned. On other pages the logo is a plain link
   home, as before. */
const LOGO_TAPS = 5;
function setUpLogoSecret() {
  const mark = document.querySelector(".site-header .wordmark");
  if (!mark || !/(^|\/)(index\.html)?$/.test(location.pathname)) return;
  let taps = [];
  mark.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; // "open in a new tab" still works
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: REDUCE_MOTION ? "auto" : "smooth" });
    const at = performance.now();
    taps = taps.filter((tap) => at - tap < 3000).concat(at);
    if (taps.length < LOGO_TAPS) return;
    taps = [];
    writeJSON(LOGO_KEY, Date.now());
    if (soundOn()) playSting(); // plays, and raises the sun in time with it
    else stingRise();
    confetti(mark);
    buzz([40, 30, 40, 30, 120]);
    checkBadges();
  });
}

/* ---------- The About page secret ----------
   On the About page, tapping the Chihuahua's portrait makes him headbutt
   toward the finger: his special move from the character sheet. Five
   taps within 3 seconds and he gets his petting: a happy wiggle,
   confetti and the hidden "Petting achieved" badge. With "reduce motion"
   nothing moves (style.css), but the badge still counts. Pointer-only,
   like the sun-tap secret: the portrait is decoration to a screen reader. */
const MOOSE_TAPS = 5;
function setUpMooseAttack() {
  const dog = document.querySelector(".party__icon .party__dog");
  const icon = dog && dog.closest(".party__icon");
  if (!icon) return;
  let taps = [];
  // Each animation class comes off when it finishes, so it can play again
  icon.addEventListener("animationend", () => icon.classList.remove("party__icon--bump", "party__icon--petted"));
  icon.addEventListener("click", (e) => {
    const at = performance.now();
    taps = taps.filter((tap) => at - tap < 3000).concat(at);
    icon.classList.remove("party__icon--bump", "party__icon--petted");
    void icon.offsetWidth; // lets the same animation start over
    if (taps.length < MOOSE_TAPS) {
      // Lean toward the finger: up to 4px from the middle of the portrait
      const r = icon.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const far = Math.hypot(dx, dy) || 1;
      const push = e.clientX || e.clientY ? 4 : 0; // a keyboard "click" has no place
      icon.style.setProperty("--bump-x", `${((dx / far) * push).toFixed(1)}px`);
      icon.style.setProperty("--bump-y", `${(push ? (dy / far) * push : -4).toFixed(1)}px`);
      icon.classList.add("party__icon--bump");
      buzz(20);
      return;
    }
    taps = [];
    writeJSON(MOOSE_KEY, Date.now());
    icon.classList.add("party__icon--petted");
    confetti(icon);
    buzz([40, 30, 40, 30, 120]);
    checkBadges();
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
    if (!swiped && !spinning) skyIcon(scene);

    if (readout) {
      const left = readout.children[0];
      const right = readout.children[1];
      let l, r;
      if (swiped) {
        [l, r] = swipeLine(t, ahead);
      } else if (isDay && day.set) {
        l = takeTurns([
          eclipseLine(t), rainbowLine(t), sunDogLine(t), thirdDogLine(t), pillarLine(t), beltLine(t), lightHourLine(t) || `Sun's up ${overHere()}`,
          shadowLine(t), dayLengthLine(t), dayVenusLine(t), weatherLine(), frostLine(t), driftLine(t), smokeLine(t),
        ]);
        r = `Sets ${clock(new Date(day.set))} · ${hoursMins(day.set - t)} of light left`;
      } else if (!isDay && day.rise && t < day.rise) {
        // Night: tonight's moon, and when the sun comes back
        l = takeTurns([eclipseLine(t), beltLine(t), pillarLine(t), issLine(t), moonLine(t), lightHourLine(t), showerLine(t), auroraLine(t), weatherLine(), driftLine(t), smokeLine(t)]);
        r = `Sun's up at ${clock(new Date(day.rise))}`;
      } else {
        // After sunset: tomorrow's sunrise
        const tomorrow = sunDay(new Date(day.end + 60000));
        l = takeTurns([eclipseLine(t), beltLine(t), pillarLine(t), issLine(t), moonLine(t), lightHourLine(t), showerLine(t), auroraLine(t), weatherLine(), driftLine(t), smokeLine(t)]);
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

  // The first placing must not ease: style.css keeps the sun hidden until
  // "horizon--placed", and "horizon--spin" keeps the slow CSS easing off,
  // so the sun simply appears in the right place. The easing comes on two
  // frames later (or when the opening spin ends).
  if (scene) scene.classList.add("horizon--spin");
  if (scene && shouldSpin()) spinSun(scene);
  if (scene) {
    const shownTime = setUpSwipe(scene, paint);
    setUpLand(scene);
    setUpWeather(scene);
    loadIss().then(() => { if (issOrbit) tick(); }); // place it as soon as the orbit arrives
    setUpMeteors(scene, now);
    setUpCritters(scene, shownTime);
    setUpSkyTaps(scene, shownTime);
    setUpMotion(scene, shownTime);
    setUpMouseSky(scene);
  }
  tick();
  if (scene) {
    scene.classList.add("horizon--placed");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!spinning && !swiping) scene.classList.remove("horizon--spin");
    }));
  }
  setUpThemeToggle(tick);
  setInterval(tick, READOUT_TURN_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
}

/* ======================================================================
   SKY THIS WEEK
   ----------------------------------------------------------------------
   The card under the home hero lists what's coming up in the sky over
   the next seven days, all worked out on the phone from the same sky
   maths as the horizon (no internet): which planets are up tonight, the
   moon's phases, the moon passing a planet, meteor shower peaks,
   eclipses, equinoxes and solstices, and how sunset moves this week. It
   follows "See your sky" too. Under it is the wish counter: shooting
   stars caught on this phone, with a badge at 1, 10, 25, 50 and 100.
   ====================================================================== */
const FULL_MOON_NAMES = ["Wolf", "Snow", "Worm", "Pink", "Flower", "Strawberry", "Buck", "Sturgeon", "Harvest", "Hunter's", "Beaver", "Cold"];
const WISH_BADGES = [[1, "First wish"], [10, "Stargazer"], [25, "Night owl"], [50, "Star catcher"], [100, "Meteor master"]];
const NEAR_MOON_DEG = 5; // the moon passing closer than this to a planet makes the list
const NEAR_PLANETS_DEG = 2.5; // and two planets closer than this
const GLARE_DEG = 15; // a planet closer than this to the sun is lost in its glare
const HOUR_MS = 3600000;

function wishCount() {
  try {
    return parseInt(localStorage.getItem(WISHES_KEY), 10) || 0;
  } catch (e) {
    return 0;
  }
}

// "Today", "Tomorrow" or "Sat Oct 18", in the sky's time zone.
function dayLabel(ms, today) {
  const p = localParts(new Date(ms));
  const ahead = Math.round((zoneMidnight(p.y, p.m, p.d) - today) / 86400000);
  if (ahead === 0) return "Today";
  if (ahead === 1) return "Tomorrow";
  return `${p.weekday} ${MONTHS[p.m - 1]} ${p.d}`;
}

// "Jupiter", "Jupiter and Saturn", "Mars, Jupiter and Saturn"
function listWords(words) {
  return words.length < 3 ? words.join(" and ") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// Everything worth a look in the 7 days from the start of t's day:
// a list of { at, when, text }, in order.
function skyWeek(t) {
  const p = localParts(t);
  const start = zoneMidnight(p.y, p.m, p.d);
  const end = start + 7 * 86400000;
  const events = [];
  // "look" is when to go out and look (for the cloud forecast), if it's something to see
  const add = (at, text, when, look) => events.push({ at, text, when: when || dayLabel(at, start), look });
  const north = YXE.lat >= 0;

  // Narrows a change (f goes from below 0 to 0 or above) between a and b
  // down to under a second.
  const narrow = (f, a, b) => {
    for (let i = 0; i < 13; i++) {
      const mid = (a + b) / 2;
      if (f(new Date(mid)) < 0) a = mid; else b = mid;
    }
    return b;
  };

  // Planets and the sun on the sky's map (radians), for a moment
  const planetsAt = (when) => PLANETS.map((planet) => {
    const [ra, dec] = planetRaDec(planet.orbit, when);
    return { name: planet.name, ra: ra * D2R, dec: dec * D2R };
  });
  const sunGap = (body, sun) => skyGap(body.ra, body.dec, sun.ra, sun.dec); // degrees

  // When to look for something at moment "at": after dark that evening
  // or before dawn that morning, whichever has it higher (6°+).
  const viewing = (at, raDeg, decDeg) => {
    const day = sunDay(new Date(at));
    if (!day.rise || !day.set) return null;
    const evening = day.set + HOUR_MS, morning = day.rise - HOUR_MS;
    const eveAlt = altAz(raDeg, decDeg, new Date(evening)).alt;
    const mornAlt = altAz(raDeg, decDeg, new Date(morning)).alt;
    if (Math.max(eveAlt, mornAlt) < 6) return null;
    return eveAlt >= mornAlt ? { at: evening, words: "after dark" } : { at: morning, words: "before dawn" };
  };

  // Tonight's planets: up an hour after sunset, clear of the glare
  const today = sunDay(new Date(start + 12 * HOUR_MS));
  if (today.set) {
    const dusk = new Date(today.set + HOUR_MS);
    const sun = sunPosition(dusk);
    const up = planetsAt(dusk).filter((b) => sunGap(b, sun) > GLARE_DEG && altAz(b.ra * R2D, b.dec * R2D, dusk).alt > 6);
    add(start, up.length ? `${listWords(up.map((b) => b.name))} ${up.length > 1 ? "are" : "is"} up after dark` : "No bright planets up after dark", "Tonight", up.length ? dusk.getTime() : null);
  }

  // Step through the week an hour at a time, keeping last hour's numbers
  // to spot the moments things change.
  const phaseOff = (q) => (when) => ((moonPhase(when) - q + 1.5) % 1) - 0.5; // -0.5..0.5, 0 at phase q
  let prev = null;
  for (let at = start; at <= end; at += HOUR_MS) {
    const when = new Date(at);
    const sun = sunPosition(when);
    const moon = moonRaDec(when);
    const planets = planetsAt(when);
    const nowStep = {
      at,
      phase: moonPhase(when),
      dec: sun.dec,
      moonGaps: planets.map((b) => skyGap(moon.ra, moon.dec, b.ra, b.dec)),
      pairGaps: planets.map((a, i) => planets.map((b, j) => (j > i ? skyGap(a.ra, a.dec, b.ra, b.dec) : Infinity))),
      glare: planets.map((b) => sunGap(b, sun) < GLARE_DEG),
      planets,
    };
    if (prev) {
      // The moon's quarters
      [0, 0.25, 0.5, 0.75].forEach((q) => {
        const f = phaseOff(q);
        const a = f(new Date(prev.at)), b = f(when);
        if (a < 0 && b >= 0 && b - a < 0.2) {
          const exact = narrow(f, prev.at, at);
          const m = localParts(new Date(exact)).m;
          add(exact, [
            "New moon · darkest nights for stars",
            "First quarter moon · half lit in the evening",
            `Full moon · the ${FULL_MOON_NAMES[m - 1]} Moon`,
            "Last quarter moon · half lit before dawn",
          ][q * 4]);
        }
      });
      // Equinoxes (the sun crosses the equator)
      if ((prev.dec < 0) !== (sun.dec < 0)) {
        const spring = (sun.dec > 0) === north;
        add(at, `${spring ? "Spring" : "Fall"} equinox · day and night almost equal`);
      }
      // Solstices (the sun turns back)
      if (prev.turn != null) {
        const turn = sun.dec - prev.dec;
        if ((turn < 0) !== (prev.turn < 0)) {
          const longest = (prev.turn > 0) === north;
          add(at, longest ? "Summer solstice · the longest day of the year" : "Winter solstice · the shortest day, the light comes back from here");
        }
      }
    }
    nowStep.turn = prev ? sun.dec - prev.dec : null;
    // A close pass is the hour with the smallest gap (a dip between the
    // hour before and after), so it's judged one hour late.
    if (prev && prev.before) {
      planets.forEach((b, i) => {
        const g = prev.moonGaps[i];
        if (g < NEAR_MOON_DEG && g <= prev.before.moonGaps[i] && g < nowStep.moonGaps[i] && !prev.glare[i]) {
          const pl = prev.planets[i];
          const look = viewing(prev.at, pl.ra * R2D, pl.dec * R2D);
          if (look) add(look.at, `Moon near ${b.name} · about ${Math.max(1, Math.round(g))}° apart, ${look.words}`, null, look.at);
        }
        for (let j = i + 1; j < planets.length; j++) {
          const pg = prev.pairGaps[i][j];
          if (pg < NEAR_PLANETS_DEG && pg <= prev.before.pairGaps[i][j] && pg < nowStep.pairGaps[i][j] && !prev.glare[i] && !prev.glare[j]) {
            const pl = prev.planets[i];
            const look = viewing(prev.at, pl.ra * R2D, pl.dec * R2D);
            if (look) add(look.at, `${b.name} and ${planets[j].name} close together · ${pg.toFixed(1)}° apart, ${look.words}`, null, look.at);
          }
        }
      });
    }
    nowStep.before = prev ? { moonGaps: prev.moonGaps, pairGaps: prev.pairGaps } : null;
    prev = nowStep;
  }

  // Meteor shower peaks (the morning after the best night)
  for (const shower of SHOWERS) {
    for (const y of [p.y, p.y + 1]) {
      const peak = zoneMidnight(y, shower.m, shower.d) + 6 * HOUR_MS;
      if (peak < start || peak >= end) continue;
      const bright = moonLit(moonPhase(new Date(peak))) > 0.6 && moonAltitude(new Date(peak)) > 0;
      add(peak, `${shower.name} meteor shower peaks before dawn · up to ${shower.zhr} an hour${bright ? ", bright moon" : " in a dark sky"}`, null, peak - 2 * HOUR_MS);
    }
  }

  // Eclipses that can be seen from here, checked every 15 minutes
  let ecl = null;
  for (let at = start; at <= end + 15 * 60000; at += 15 * 60000) {
    const e = at <= end ? visibleEclipse(new Date(at)) : null;
    if (e && (!ecl || e.share > ecl.share)) ecl = { ...e, at };
    else if (!e && ecl) {
      add(ecl.at, `${ecl.total ? "Total" : "Partial"} ${ecl.kind} eclipse · deepest at ${clock(new Date(ecl.at))}`, null, ecl.at);
      ecl = null;
    }
  }

  // The space station's best passes (if its orbit has loaded): the five
  // that climb highest, at least ISS_WEEK_ALT
  issPasses(Math.max(start, t.getTime()), end)
    .filter((pass) => pass.peak >= ISS_WEEK_ALT)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, 5)
    .forEach((pass) => {
      const mins = Math.max(1, Math.round((pass.end - pass.start) / 60000));
      add(pass.start, `Space station passes over · ${clock(new Date(pass.start))}, ${compassName(pass.from)} to ${compassName(pass.to)}, up to ${Math.round(pass.peak)}° for ${mins} min`, null, pass.start);
    });

  // Northern lights: NOAA's forecast (if it has loaded) for the next 3
  // days, in 3-hour blocks. A night makes the list when a properly dark
  // block (sun 12° down) reaches the Kp the lights need here.
  if (kpCast) {
    const need = auroraKp();
    const nights = new Map(); // that evening's day label -> the strongest dark block
    kpCast.forEach(([from, k]) => {
      const mid = from + BLOCK_MS / 2;
      if (from + BLOCK_MS < t.getTime() || mid < start || mid >= end || k < need) return;
      if (sunAltitude(new Date(mid)) > -12) return;
      const night = dayLabel(mid - 12 * HOUR_MS, start); // after midnight still counts as that night
      const best = nights.get(night);
      if (!best || k > best.k) nights.set(night, { mid, k });
    });
    const name = YXE.lat >= 0 ? "Northern" : "Southern";
    nights.forEach(({ mid, k }, night) => {
      add(mid, `${name} lights ${k >= need + 1 ? "likely" : "possible"} · Kp ${Math.round(k * 10) / 10} forecast, best around ${clock(new Date(mid))}`, night === "Today" ? "Tonight" : night, mid);
    });
  }

  events.sort((a, b) => a.at - b.at);

  // How sunset moves over the week
  const last = sunDay(new Date(start + 6 * 86400000 + 12 * HOUR_MS));
  if (today.set && last.set) {
    const lp = localParts(new Date(last.set));
    events.push({ at: end, when: "This week", text: `Sunset goes from ${clock(new Date(today.set))} today to ${clock(new Date(last.set))} by ${lp.weekday}` });
  }
  return events;
}

// The wish counter under the list.
function showWishes(node) {
  if (!node) return;
  const count = wishCount();
  if (!count) {
    node.replaceChildren("On a dark night, tap a shooting star to make a wish.");
    return;
  }
  const earned = WISH_BADGES.filter(([n]) => count >= n);
  const next = WISH_BADGES.find(([n]) => count < n);
  const badges = el("span", "sky-week__badges");
  earned.forEach(([, name]) => badges.append(el("span", "sky-week__badge", name)));
  node.replaceChildren(
    el("strong", "", `${count} ${count === 1 ? "wish" : "wishes"} on this phone`),
    badges,
    next ? el("span", "sky-week__next", `Next badge at ${next[0]}`) : ""
  );
}

const SKY_WEEK_OPEN_KEY = "kelbo.skyWeekOpen";

function setUpSkyWeek() {
  const box = document.querySelector("[data-sky-week]");
  if (!box) return;
  const list = box.querySelector("[data-sky-week-list]");
  const note = box.querySelector("[data-sky-week-note]");
  const next = box.querySelector("[data-sky-week-next]");
  const draw = () => {
    list.replaceChildren(...skyWeek(now()).map((e) => {
      const row = el("li", "sky-week__item");
      const what = el("span", "sky-week__what", e.text);
      // The cloud forecast for when to look, for the next week or so
      const cloud = e.look != null && e.look > Date.now() - HOUR_MS ? cloudAt(e.look) : null;
      if (cloud != null) {
        const [kind, words] = cloud < 30 ? ["clear", "Clear sky"] : cloud < 70 ? ["some", "Some cloud"] : ["cloudy", "Cloudy"];
        what.append(" ", el("span", `sky-week__cloud sky-week__cloud--${kind}`, words));
      }
      row.append(el("span", "sky-week__when", e.when), what);
      return row;
    }));
    let words = `Worked out on this phone for ${YXE.home ? "Saskatoon" : "your sky"}.`;
    // The space station's orbit comes from CelesTrak; say how fresh it is
    if (issOrbit) {
      const made = new Date(issOrbit.epoch).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      words += ` Space station orbit from CelesTrak (${made}); its times can shift by a minute.`;
    }
    if (cloudCast) words += " Cloud forecast from Open-Meteo.";
    if (kpCast) words += " Northern lights forecast from NOAA.";
    if (note) note.textContent = words;
    // The folded box shows the first thing coming up as its one line
    const first = list.firstElementChild;
    if (next && first) next.textContent = first.children[0].textContent + ": " + first.children[1].firstChild.textContent;
  };
  // The box folds to that one line; remember whether it was left open.
  try {
    box.open = localStorage.getItem(SKY_WEEK_OPEN_KEY) === "1";
    box.addEventListener("toggle", () => {
      try {
        localStorage.setItem(SKY_WEEK_OPEN_KEY, box.open ? "1" : "0");
      } catch (e) {
        /* storage blocked: it just won't be remembered */
      }
    });
  } catch (e) {
    /* storage blocked: stays folded */
  }
  // After the page has drawn, so it doesn't hold up the opening spin
  setTimeout(() => {
    draw();
    showWishes(box.querySelector("[data-wishes]"));
    box.hidden = false;
    reveal(box);
    // Again once the station's orbit and the forecasts are in
    Promise.allSettled([loadIss(), loadClouds(), loadKpCast()]).then(draw);
  }, 0);
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
    notePlayed(titleEl ? titleEl.textContent : link.dataset.title);
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
  if (last.image) setPicture(cover, last.image);
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

/* ---------- USD/CAD on the Trading page ----------
   The Bank of Canada's daily average exchange rate (free, no key, and it
   lets browsers ask). It's published once each business day, late in the
   afternoon, so it's yesterday's or today's average, never a live quote:
   the line says so and shows the date. The last two days give the move. */
const FX_KEY = "kelbo.fx";
const FX_MS = 3 * 60 * 60 * 1000; // ask the bank again after 3 hours
const FX_URL = "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=2";

function setUpFx() {
  const node = document.querySelector("[data-fx]");
  if (!node) return;
  cachedFetch(FX_KEY, FX_MS, FX_URL, (d) =>
    // Oldest first: [{date: "2026-10-29", rate: 1.3948}, {date: "2026-10-30", ...}]
    (d.observations || [])
      .map((o) => ({ date: o.d, rate: parseFloat(o.FXUSDCAD && o.FXUSDCAD.v) }))
      .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date) && Number.isFinite(o.rate))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  )
    .then((list) => {
      const last = list[list.length - 1];
      if (!last) return; // nothing usable: leave the line hidden
      const day = new Date(last.date + "T12:00:00Z").toLocaleDateString("en-CA", {
        weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
      });
      node.replaceChildren(
        el("span", "fx__pair", "USD/CAD"),
        el("strong", "fx__rate", last.rate.toFixed(4))
      );
      const prev = list[list.length - 2];
      if (prev) {
        const pct = ((last.rate - prev.rate) / prev.rate) * 100;
        const move = Math.abs(pct) < 0.005 ? "flat" : `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(2)}%`;
        node.append(el("span", "fx__move", move));
      }
      node.append(el("span", "fx__note", `Bank of Canada daily average for ${day}, not a live quote`));
      node.hidden = false;
    })
    .catch(() => {}); // the bank didn't answer: the line just stays hidden
}

/* ======================================================================
   NEW BRIEF ALERT
   ----------------------------------------------------------------------
   For an hour after the pre-market brief goes out each morning, every
   page shows a flashing dot on the Trading link in the header, and the
   brief's card gets a flashing "New" badge (both drawn in style.css from
   data-brief-new on <html>). The time comes from briefs/latest.json, which
   the brief robot stamps when it writes a brief. A page left open checks
   again every few minutes, so it notices a brief that lands while you're
   looking at it, and the dot goes away by itself when the hour is up.
   ====================================================================== */
const BRIEF_NEW_MS = 60 * 60 * 1000; // how long a brief counts as new
const BRIEF_CHECK_MS = 5 * 60 * 1000; // how often an open page checks again

// True if this index entry went out less than an hour ago (real time,
// not the ?at= sky preview).
function briefIsNew(entry) {
  const sent = entry && Date.parse(entry.time);
  if (!Number.isFinite(sent)) return false;
  const age = Date.now() - sent;
  return age >= 0 && age < BRIEF_NEW_MS;
}

function setUpBriefAlert() {
  const root = document.documentElement;
  let clearTimer = 0;

  function show(isNew, entry) {
    if (isNew) root.dataset.briefNew = "";
    else delete root.dataset.briefNew;
    // Screen readers hear "Trading, new brief" while the dot shows.
    document.querySelectorAll('.nav a[href="trading.html"]').forEach((link) => {
      let note = link.querySelector(".nav__new");
      if (isNew && !note) link.append(el("span", "visually-hidden nav__new", ", new brief"));
      if (!isNew && note) note.remove();
    });
    clearTimeout(clearTimer);
    if (isNew) clearTimer = setTimeout(() => show(false), Date.parse(entry.time) + BRIEF_NEW_MS - Date.now());
  }

  async function check() {
    if (document.visibilityState === "hidden") return;
    try {
      // latest.json is a few bytes ({date, time}); index.json (the list of
      // months, with the latest brief at the top) is only the fallback.
      let response = await fetch("briefs/latest.json", { cache: "no-cache" });
      if (!response.ok) response = await fetch("briefs/index.json", { cache: "no-cache" });
      if (!response.ok) return;
      const data = await response.json();
      const latest = data.latest || data;
      show(briefIsNew(latest), latest);
    } catch {
      // Offline or no briefs yet: just no dot.
    }
  }

  check();
  setInterval(check, BRIEF_CHECK_MS);
  document.addEventListener("visibilitychange", check);
}

/* ======================================================================
   BADGES
   ----------------------------------------------------------------------
   Little goals for visitors, earned by using the site: playing games,
   visiting at sunset or after dark, coming back, catching a shooting
   star. Each one is saved in this browser only (localStorage), and a
   small note pops up when one is earned. The home page lists them all
   ("Your badges"); the ones still to get show how to earn them.
   To add one, add a line to BADGES and a check in badgeChecks.
   ====================================================================== */
const BADGES = [
  { id: "first-game", name: "First game", hint: "Play any game" },
  { id: "three-games", name: "Arcade regular", hint: "Play 3 different games" },
  { id: "every-game", name: "Completionist", hint: "Play every Longlight game" },
  { id: "golden-hour", name: "Golden hour", hint: "Visit within half an hour of sunset" },
  { id: "early-riser", name: "Early riser", hint: "Visit in the hour after sunrise" },
  { id: "after-dark", name: "After dark", hint: "Visit once the sky is fully dark" },
  { id: "solstice", name: "Solstice", hint: "Visit on the longest or shortest day of the year" },
  { id: "regular", name: "Regular", hint: "Visit on 3 different days" },
  { id: "explorer", name: "Explorer", hint: "Open Games, Trading, All and About" },
  { id: "wishmaker", name: "Wishmaker", hint: "Tap a shooting star on a dark night" },
  { id: "insider", name: "Insider", hint: "Read the devlog" },
  { id: "trainspotter", name: "Trainspotter", hint: "Tap the freight train as it rolls through" },
  { id: "aurora", name: "Northern lights", hint: "Visit on a night the aurora is out in the site's sky" },
  { id: "parade", name: "Parade marshal", hint: "A secret: something in the sky is hiding a party", secret: true },
  { id: "stock-car", name: "Checkered flag", hint: "A secret: something fast is out on the prairie", secret: true },
  { id: "lightkeeper", name: "Lightkeeper", hint: "A secret: the logo's sun on the home page likes attention", secret: true },
  { id: "home-base", name: "Home Base", hint: "A secret: someone left a light on after dark", secret: true },
  { id: "moose-attack", name: "Petting achieved", hint: "A secret: someone on the About page wants attention", secret: true },
];
const SPOTTED_KEY = "kelbo.spotted";   // sky things tapped: { train: time, car: time, home: time }
const LOGO_KEY = "kelbo.logoSecret";   // when the logo secret was found
const MOOSE_KEY = "kelbo.mooseAttack"; // when the About page secret was found

// Note a sky thing as spotted (the train, the stock car), then check badges.
function spot(what) {
  const seen = readJSON(SPOTTED_KEY) || {};
  if (!seen[what]) {
    seen[what] = Date.now();
    writeJSON(SPOTTED_KEY, seen);
  }
  checkBadges();
}
const BADGES_KEY = "kelbo.badges";     // { "first-game": time earned, ... }
const BADGES_OPEN_KEY = "kelbo.badgesOpen"; // whether the badges box was left open
const PLAYED_KEY = "kelbo.played";     // titles of the games opened
const DAYS_KEY = "kelbo.days";         // the last few days visited, "2026-10-24"
const PAGES_KEY = "kelbo.pages";       // which section pages were opened
const GAME_COUNT_KEY = "kelbo.gameCount"; // how many games there are, for Completionist
// Tools is hidden for now (November 2026), so Explorer doesn't need it.
const EXPLORER_PAGES = ["games.html", "trading.html", "projects.html", "about.html"];

// Note a game as played (from Play it or Play here).
function notePlayed(title) {
  if (!title) return;
  const played = readJSON(PLAYED_KEY) || [];
  if (!played.includes(title)) writeJSON(PLAYED_KEY, played.concat(title));
  checkBadges();
  keepStorage();
}

// Ask the browser not to clear this site's storage (badges, last played)
// when the phone runs low. Each game has its own address and asks for its own
// saves itself. Asked
// only when someone starts a game (Firefox shows a little prompt for it;
// Chrome and Safari decide quietly), once per page, and never an error.
let storageAsked = false;
async function keepStorage() {
  if (storageAsked || !navigator.storage || !navigator.storage.persist) return;
  storageAsked = true;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch (e) { /* not allowed here; the games' backup files still cover it */ }
}

// Is each badge earned right now? Sun badges use the real time (never a
// ?at= preview) and the sky the visitor is looking at (YXE).
function badgeChecks() {
  const played = (readJSON(PLAYED_KEY) || []).length;
  const games = Number(readJSON(GAME_COUNT_KEY)) || 0;
  const days = (readJSON(DAYS_KEY) || []).length;
  const pages = readJSON(PAGES_KEY) || [];
  const spotted = readJSON(SPOTTED_KEY) || {};
  const real = !new URLSearchParams(location.search).get("at");
  const now = new Date();
  const day = real ? sunDay(now) : {};
  const t = now.getTime();
  return {
    "first-game": played >= 1,
    "three-games": played >= 3,
    "every-game": games > 0 && played >= games,
    "golden-hour": real && !!day.set && Math.abs(t - day.set) <= 30 * 60000,
    "early-riser": real && !!day.rise && t >= day.rise && t <= day.rise + 60 * 60000,
    "after-dark": real && sunAltitude(now) < -12,
    "solstice": real && !!solsticeToday(now),
    "regular": days >= 3,
    "explorer": EXPLORER_PAGES.every((page) => pages.includes(page)),
    "wishmaker": wishCount() >= 1,
    "insider": pages.includes("devlog.html"),
    "parade": !!readJSON(PARADE_KEY),
    "trainspotter": !!spotted.train,
    "aurora": real && auroraStrength(t) > 0,
    "stock-car": !!spotted.car,
    "lightkeeper": !!readJSON(LOGO_KEY),
    "home-base": !!spotted.home,
    "moose-attack": !!readJSON(MOOSE_KEY),
  };
}

// Award anything newly earned, pop up a note, and refresh the home list.
function checkBadges() {
  const earned = readJSON(BADGES_KEY) || {};
  const checks = badgeChecks();
  const fresh = BADGES.filter((b) => checks[b.id] && !earned[b.id]);
  if (fresh.length) {
    fresh.forEach((b) => { earned[b.id] = Date.now(); });
    writeJSON(BADGES_KEY, earned);
    toastBadges(fresh);
  }
  showBadges();
}

// The pop-up note at the bottom of the screen, for a few seconds.
function toastBadges(fresh) {
  let toast = document.querySelector(".badge-toast");
  if (!toast) {
    toast = el("div", "badge-toast");
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  const label = fresh.length === 1 ? "Badge earned" : `${fresh.length} badges earned`;
  toast.replaceChildren(el("strong", null, label), el("span", null, fresh.map((b) => b.name).join(", ")));
  toast.classList.remove("is-shown");
  void toast.offsetWidth; // restart the slide-in
  toast.classList.add("is-shown");
  confetti(toast);
  clearTimeout(toastBadges.timer);
  toastBadges.timer = setTimeout(() => toast.classList.remove("is-shown"), 4500);
}

// A burst of confetti in the palette's colours from the badge note:
// little bits fly up and out, then tumble down and fade.
function confetti(from) {
  if (REDUCE_MOTION) return;
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + 8;
  for (let i = 0; i < 36; i++) {
    const bit = el("i", `confetti confetti--${i % 4}`);
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    document.body.append(bit);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1; // mostly upward
    const v = 90 + Math.random() * 150;
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v;
    const spin = (Math.random() - 0.5) * 1080;
    bit.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) rotate(${(spin / 2).toFixed(0)}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${(dx * 1.4).toFixed(0)}px, ${(dy + 220).toFixed(0)}px) rotate(${spin.toFixed(0)}deg)`, opacity: 0 },
      ],
      { duration: 1600 + Math.random() * 600, easing: "cubic-bezier(0.15, 0.6, 0.4, 1)" }
    ).onfinish = () => bit.remove();
  }
}

// The "Your badges" list on the home page.
function showBadges() {
  const box = document.querySelector("[data-badges]");
  if (!box) return;
  const earned = readJSON(BADGES_KEY) || {};
  const got = BADGES.filter((b) => earned[b.id]).length;
  box.querySelector("[data-badges-count]").textContent =
    `${got} of ${BADGES.length} earned` + (got === 0 ? " · open to see how" : "");
  const list = box.querySelector("[data-badges-list]");
  list.replaceChildren();
  // Earned ones first, then the rest in order.
  const sorted = BADGES.filter((b) => earned[b.id]).concat(BADGES.filter((b) => !earned[b.id]));
  sorted.forEach((b) => {
    const item = el("li", earned[b.id] ? "badge badge--earned" : "badge");
    const when = earned[b.id] && new Date(earned[b.id]).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const name = b.secret && !earned[b.id] ? "Secret badge" : b.name;
    item.append(el("strong", null, name), el("span", null, when ? "Earned " + when : b.hint));
    list.append(item);
  });
  box.hidden = false;
}

// Once per page: note today and this page, then check.
function setUpBadges() {
  const days = readJSON(DAYS_KEY) || [];
  const p = localParts(new Date());
  const today = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  if (!days.includes(today)) writeJSON(DAYS_KEY, days.concat(today).slice(-10));
  const page = location.pathname.split("/").pop() || "index.html";
  const pages = readJSON(PAGES_KEY) || [];
  if (!pages.includes(page) && (EXPLORER_PAGES.includes(page) || page === "devlog.html")) {
    writeJSON(PAGES_KEY, pages.concat(page));
  }
  // The box folds to its count line; remember whether it was left open.
  const box = document.querySelector("[data-badges]");
  if (box) {
    box.open = localStorage.getItem(BADGES_OPEN_KEY) === "1";
    box.addEventListener("toggle", () => localStorage.setItem(BADGES_OPEN_KEY, box.open ? "1" : "0"));
  }
  checkBadges();
  // Golden hour, sunrise and dark can arrive while the page is open.
  setInterval(checkBadges, 60000);
}

// Start here once the page has loaded.
/* The glass panes' edge light (style.css --pane-edge) follows the same
   tilt as the sky, so the whole page needs the numbers, not just the
   horizon. */
function setPageTilt(tilt) {
  const root = document.documentElement.style;
  root.setProperty("--tilt-x", tilt.x.toFixed(3));
  root.setProperty("--tilt-y", tilt.y.toFixed(3));
}

/* The real lens bend on the glass panes (style.css, "Glass"). Only Chrome
   (computers and Android) can run an SVG filter behind an element, so
   the filter is added here and the page gets data-lens; Safari and
   Firefox keep the plain frost. The filter finds each pane's edges from
   its own outline (SourceAlpha: solid inside the pane, empty outside),
   blurs that into a soft ramp, and turns the ramp's slope into a
   left/right (red) and up/down (green) push, so whatever is behind the
   rim is pulled inward and stretched like light through thick glass.
   Then the usual frost and colour boost. */
function setUpLens() {
  if (REDUCE_MOTION) return;
  if (!(CSS && CSS.supports && CSS.supports("backdrop-filter", "url(#glass-lens)"))) return;
  // Firefox accepts the words but doesn't draw it; Safari fails the test above.
  if ("MozAppearance" in document.documentElement.style) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.innerHTML = `<filter id="glass-lens" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1" result="solid"/>
    <feGaussianBlur in="solid" stdDeviation="9" result="soft"/>
    <feOffset in="soft" dx="5" dy="0" result="xr"/>
    <feOffset in="soft" dx="-5" dy="0" result="xl"/>
    <feComposite in="xr" in2="xl" operator="arithmetic" k2="1" k3="-1" k4="0.5" result="gx"/>
    <feOffset in="soft" dx="0" dy="5" result="yd"/>
    <feOffset in="soft" dx="0" dy="-5" result="yu"/>
    <feComposite in="yd" in2="yu" operator="arithmetic" k2="1" k3="-1" k4="0.5" result="gy"/>
    <feColorMatrix in="gx" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="r"/>
    <feColorMatrix in="gy" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="g"/>
    <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="34" xChannelSelector="R" yChannelSelector="G" result="bent"/>
    <feGaussianBlur in="bent" stdDeviation="11" result="frost"/>
    <feColorMatrix in="frost" type="saturate" values="1.7"/>
  </filter>`;
  document.body.append(svg);
  document.documentElement.dataset.lens = "";
}

/* ---------- The studio sting ----------
   A 2-second "sun coming up" sound (assets/sounds/longlight-sting.mp3,
   made by Kelbo with ElevenLabs). Off unless the visitor turns Sound on
   with the footer switch (saved in localStorage["kelbo.sound"]).
   Turning it on plays the sting once. With Sound on, the first page of a
   visit plays it once, and the logo's sun always rises together with it:
   the sun waits below its line until the sound really starts. Phones
   block sound until a tap, so there the sun waits for the first tap or
   key (up to STING_WAIT_MS, then it comes up quietly so the logo is
   never left empty; the first tap after that still plays the sound and
   raises the sun again with it).
   The file is only downloaded once Sound is on. */
const SOUND_KEY = "kelbo.sound";
const STING_URL = "assets/sounds/longlight-sting.mp3";
const STING_DONE = "kelbo.stingPlayed"; // sessionStorage: once per visit
const STING_WAIT_MS = 4000; // how long the sun waits below its line for the sound

function soundOn() {
  try { return localStorage.getItem(SOUND_KEY) === "on"; } catch (e) { return false; }
}

let stingAudio = null;
// Fetches the whole file (a plain 200, which sw.js can keep for offline),
// then plays it from memory. Resolves true once it starts.
async function playSting() {
  try {
    if (!stingAudio) {
      const res = await fetch(STING_URL);
      if (!res.ok) return false;
      stingAudio = new Audio(URL.createObjectURL(await res.blob()));
      stingAudio.volume = 0.6;
    }
    stingAudio.currentTime = 0;
    await stingAudio.play();
    stingRise();
    return true;
  } catch (e) {
    return false; // blocked until a tap, or no file
  }
}

// The logo's sun rises in time with the sting: it swells up slowly with
// the sound and lands on the cut at about 1.33 s, then the ray shoots
// out (style.css, .logo--sting, motion only). Restarting the class
// plays it again from the start.
function stingRise() {
  const root = document.documentElement;
  root.classList.remove("logo--sting", "logo--hold");
  void root.offsetWidth;
  root.classList.add("logo--sting");
}

function setUpSound() {
  const line = document.querySelector(".site-footer p");
  if (!line || typeof Audio === "undefined") return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sound-toggle";
  const paint = () => {
    const on = soundOn();
    btn.textContent = on ? "Sound on" : "Sound off";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  };
  btn.addEventListener("click", () => {
    const on = !soundOn();
    try {
      if (on) localStorage.setItem(SOUND_KEY, "on");
      else localStorage.removeItem(SOUND_KEY);
    } catch (e) {}
    paint();
    if (on) playSting();
    else if (stingAudio) stingAudio.pause();
  });
  paint();
  line.append(" \u00b7 ", btn);

  // First page of the visit, Sound on: the sun and the sound go together.
  // Each page's <head> script has already put the sun below its line
  // (logo--sting + logo--hold) before the first frame, so it never rises
  // early and drops back. Here it is let go: by the sound starting
  // (playSting calls stingRise), or quietly once the wait runs out.
  const root = document.documentElement;
  const release = () => {
    if (root.classList.contains("logo--hold")) root.classList.remove("logo--sting", "logo--hold");
  };
  let done = false;
  try { done = sessionStorage.getItem(STING_DONE) === "1"; } catch (e) {}
  if (!soundOn() || done) return release();
  const mark = () => { try { sessionStorage.setItem(STING_DONE, "1"); } catch (e) {} };
  root.classList.add("logo--sting", "logo--hold"); // in case the <head> script didn't
  const giveUp = setTimeout(release, STING_WAIT_MS);
  playSting().then((ok) => {
    if (ok) { clearTimeout(giveUp); return mark(); }
    if (!stingAudio) { clearTimeout(giveUp); return release(); } // no file: nothing to wait for
    // Refused (no tap yet): keep the sun down and play at the first tap
    // or key. Browsers only allow sound once a tap has finished (finger
    // up), so listen for click, not pointerdown. A tap on a link is left
    // alone: the next page starts its own wait instead of cutting the
    // sound off mid-rise.
    const events = ["click", "keydown"];
    const once = (e) => {
      if (e.target === btn || !soundOn()) return;
      if (e.target.closest && e.target.closest("a[href]")) return;
      playSting().then((played) => {
        if (!played) return; // still refused: keep listening
        clearTimeout(giveUp);
        mark();
        events.forEach((name) => removeEventListener(name, once, true));
      });
    };
    events.forEach((name) => addEventListener(name, once, true));
  });
}

async function init() {
  setUpLens();
  setUpHorizon();
  setUpSkySwitch();
  setUpSkyWeek();
  setUpAlert();
  rememberPlays();
  setUpContinue();
  setUpMarketLight();
  setUpFx();
  setUpBriefAlert();
  setUpContactForm();
  setUpNow();
  setUpDevlog();
  setUpBadges();
  setUpCoverTilt();
  setUpCoverHop();
  setUpScrollSun();
  setUpPullSky();
  setUpSheet();
  setUpLogoSecret();
  setUpMooseAttack();
  setUpSound();

  // The offline helper (sw.js): keeps a copy of the site on this phone so
  // it still opens with no signal.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

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
    // "hidden": true in projects.json takes a project off the site (cards,
    // lists, its game page) without deleting its entry. Remove the line to
    // bring it back.
    projects = projects.filter((p) => !p.hidden);
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
  // For the Completionist badge: how many games there are to play.
  writeJSON(GAME_COUNT_KEY, projects.filter(isGame).length);
  checkBadges();
  lists.forEach((listEl) => {
    if (listEl.dataset.projects === "row") setUpGameRow(listEl, projects);
    else if (listEl.dataset.projects === "category") setUpCategory(listEl, projects);
    else if (listEl.dataset.projects === "news") setUpNews(listEl, projects);
    else if (listEl.dataset.projects === "press") setUpPress(listEl, projects);
    else if (listEl.dataset.projects === "game") setUpGame(listEl, projects);
    else if (listEl.dataset.projects === "quests") setUpQuests(listEl, projects);
    else setUpAll(listEl, projects);
  });
}

init();

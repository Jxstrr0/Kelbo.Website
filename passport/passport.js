/* ==========================================================================
   Longlight Passport (passport.html)
   --------------------------------------------------------------------------
   Draws the booklet: one page per game on the site, each with its stamp.

   Where the games come from:
     - projects.json: the name, address, status and "hidden" for each game.
       A game hidden there is left out here too, so one switch hides it
       everywhere.
     - passport/registry.json: the Passport-only details (the game's id,
       where it keeps its stamp, and its ink colour), matched by title.

   For now (PR 1) every stamp is empty: a dashed ring with "Play →". Real
   stamps arrive in PR 2 (stamp links) and PR 3 (the bridge).

   Privacy: stamps only ever live in this browser, under kelbo.passport.*.
   Every piece of text is put on the page with textContent, never
   innerHTML, so nothing in a data file can add code to the page.
   Spec: .github/PASSPORT.md
   ========================================================================== */
(function () {
  "use strict";

  var book = document.querySelector("[data-pp-book]");
  if (!book) return;
  var countLine = document.querySelector("[data-pp-count]");
  var loading = book.querySelector("[data-pp-loading]");

  // A small element maker: tag, class, and text (as plain text, never markup).
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  // Only plain https:// addresses are linked, so a typo or a tampered file
  // can't turn a "Play" link into something that runs code.
  function safeHttps(value) {
    try {
      var url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch (e) {
      return "";
    }
  }

  // A colour from the registry is only used if it's a plain #RRGGBB.
  function safeColour(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : "";
  }

  function getJson(path) {
    return fetch(path, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(path + " " + res.status);
      return res.json();
    });
  }

  // The games to show: the ones on the site (projects.json, in its order,
  // which is Kelbo's ranking) that also have a registry entry.
  function gamesFrom(projects, registry) {
    var byTitle = {};
    (registry && registry.games || []).forEach(function (entry) {
      if (entry && entry.title) byTitle[entry.title] = entry;
    });
    return (Array.isArray(projects) ? projects : [])
      .filter(function (p) { return p && p.category === "Game" && !p.hidden && byTitle[p.title]; })
      .map(function (p) {
        var entry = byTitle[p.title];
        return {
          id: String(entry.id || ""),
          name: String(p.title),
          status: String(p.status || ""),
          url: safeHttps(p.link),
          accent: safeColour(entry.accent),
        };
      });
  }

  // One game's page: its name and status, the stamp, and the Play button.
  function gamePage(game) {
    var page = el("li", "pp-page pp-game");
    page.dataset.game = game.id;

    var head = el("div", "pp-game__head");
    head.appendChild(el("h3", "pp-game__name", game.name));
    if (game.status) head.appendChild(el("span", "pp-game__status", game.status));
    page.appendChild(head);

    var stamp = el("div", "pp-stamp pp-stamp--empty");
    if (game.accent) stamp.style.setProperty("--stamp", game.accent);
    var inner = el("div", "pp-stamp__inner");
    inner.appendChild(el("span", "pp-stamp__name", game.name));
    inner.appendChild(el("span", "pp-stamp__note", "No stamp yet"));
    stamp.appendChild(inner);
    page.appendChild(stamp);

    page.appendChild(el("p", "pp-game__line", "Play, then add your stamp from the game."));

    if (game.url) {
      var play = el("a", "pp-play", "Play →");
      play.href = game.url;
      play.setAttribute("aria-label", "Play " + game.name);
      page.appendChild(play);
    }
    return page;
  }

  function showCount(stamped, total) {
    if (!countLine) return;
    countLine.textContent = stamped + " of " + total + (total === 1 ? " game" : " games") + " stamped";
  }

  Promise.all([getJson("projects.json"), getJson("passport/registry.json")])
    .then(function (both) {
      var games = gamesFrom(both[0], both[1]);
      if (loading) loading.remove();
      games.forEach(function (game) { book.appendChild(gamePage(game)); });
      showCount(0, games.length);
    })
    .catch(function () {
      if (loading) {
        loading.classList.remove("is-loading");
        loading.textContent = "The games couldn't load. Check your connection and reload the page.";
      }
    });
})();

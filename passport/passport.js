/* ==========================================================================
   Longlight Passport (passport.html)
   --------------------------------------------------------------------------
   Draws the booklet: one page per game on the site, each with its stamp,
   and takes in new stamps from stamp links.

   Where the games come from:
     - projects.json: the name, address, status and "hidden" for each game.
       A game hidden there is left out here too, so one switch hides it
       everywhere.
     - passport/registry.json: the Passport-only details (the game's id,
       where it keeps its stamp, and its ink colour), matched by title.

   How a stamp arrives (PR 2): a game's "Add to Longlight Passport" button
   opens passport.html#stamp=LLP1.... The code is taken out of the address
   bar straight away, before anything else on the page can see it, then
   unpacked (js/codec.js), checked (js/validate.js), and kept if it's newer
   than the stamp already here. A toast says what happened.

   Storage, in this browser only:
     kelbo.passport.stamps = { "games": { "<game id>": stamp, ... },
                               "updates": how many times a newer stamp
                                          replaced an older one }
   Stamps read back from storage are checked again, since anyone can edit
   it. "Remove all stamps" clears kelbo.passport.* and nothing else.

   Privacy: stamps are never sent anywhere or logged. Every piece of text is
   put on the page with textContent, never innerHTML, so nothing in a stamp
   or a data file can add code to the page.
   Spec: .github/PASSPORT.md
   ========================================================================== */
(function () {
  "use strict";

  var STORE_KEY = "kelbo.passport.stamps";
  var STORE_PREFIX = "kelbo.passport.";

  // ---- 1. Take a stamp out of the address bar, before anything else -------
  // The part after # never reaches a server, but other scripts on the page
  // (like the visit counter) can read the address, so it goes at once.
  var pendingCode = null;
  function takeFromAddress() {
    var hash = String(location.hash || "");
    if (hash.indexOf("#stamp=") !== 0) return null;
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {
      location.hash = "";
    }
    return hash.slice("#stamp=".length);
  }
  pendingCode = takeFromAddress();

  var book = document.querySelector("[data-pp-book]");
  if (!book) return;
  var countLine = document.querySelector("[data-pp-count]");
  var loading = book.querySelector("[data-pp-loading]");
  var clearButton = document.querySelector("[data-pp-clear]");
  var Codec = window.LLPassportCodec;
  var Check = window.LLPassportValidate;

  var games = []; // the games on the site, in Kelbo's order
  var registryIds = []; // every game the Passport knows, hidden ones too
  var namesById = {}; // id → name, hidden games too (for the toast)
  var store = { games: {}, updates: 0 };

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

  // ---- 2. Storage ------------------------------------------------------------

  // Read the stored stamps, keeping only the ones that still pass the check.
  function loadStore() {
    var out = { games: {}, updates: 0 };
    var raw;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { raw = null; }
    if (!raw || typeof raw !== "object") return out;
    var stored = raw.games && typeof raw.games === "object" ? raw.games : {};
    registryIds.forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(stored, id)) return;
      var result = Check.check(stored[id], registryIds, { today: "9999-12-31" });
      if (result.ok && result.stamp.game === id) out.games[id] = result.stamp;
    });
    var n = Number(raw.updates);
    out.updates = isFinite(n) && n > 0 ? Math.floor(n) : 0;
    return out;
  }

  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Remove every kelbo.passport.* key, and nothing else.
  function clearStore() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(STORE_PREFIX) === 0) keys.push(key);
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    } catch (e) {}
    store = { games: {}, updates: 0 };
  }

  // ---- 3. Drawing ---------------------------------------------------------------

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

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // "2026-11-24" → "24 Nov 2026" (already checked to be a real date).
  function niceDate(text) {
    var p = String(text).split("-");
    return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
  }

  function niceValue(stat) {
    var value = typeof stat.value === "number" ? stat.value.toLocaleString("en-CA") : stat.value;
    return stat.unit ? value + " " + stat.unit : value;
  }

  // The stamp itself: an empty dashed ring, or a solid one with the headline.
  function stampFor(game, stamp) {
    var ring = el("div", "pp-stamp " + (stamp ? "pp-stamp--inked" : "pp-stamp--empty"));
    if (game.accent) ring.style.setProperty("--stamp", game.accent);
    var inner = el("div", "pp-stamp__inner");
    inner.appendChild(el("span", "pp-stamp__name", game.name));
    if (stamp) {
      if (stamp.headline) inner.appendChild(el("span", "pp-stamp__headline", stamp.headline));
      inner.appendChild(el("span", "pp-stamp__date", niceDate(stamp.updated)));
    } else {
      inner.appendChild(el("span", "pp-stamp__note", "No stamp yet"));
    }
    ring.appendChild(inner);
    return ring;
  }

  // The stats under a stamp, as a list of label and value.
  function statsFor(stamp) {
    var list = el("dl", "pp-stats");
    stamp.stats.forEach(function (stat) {
      var row = el("div", "pp-stats__row");
      row.appendChild(el("dt", null, stat.label));
      row.appendChild(el("dd", null, niceValue(stat)));
      list.appendChild(row);
    });
    return list;
  }

  // One game's page: its name and status, the stamp, and the Play button.
  function gamePage(game) {
    var stamp = store.games[game.id] || null;
    var page = el("li", "pp-page pp-game" + (stamp ? " is-stamped" : ""));
    page.dataset.game = game.id;

    var head = el("div", "pp-game__head");
    head.appendChild(el("h3", "pp-game__name", game.name));
    if (game.status) head.appendChild(el("span", "pp-game__status", game.status));
    page.appendChild(head);

    page.appendChild(stampFor(game, stamp));

    if (stamp) {
      page.appendChild(statsFor(stamp));
      page.appendChild(el("p", "pp-game__line", "From version " + stamp.ver + ". Add a new stamp from the game to update it."));
    } else {
      page.appendChild(el("p", "pp-game__line", "Play, then add your stamp from the game."));
    }

    if (game.url) {
      var play = el("a", "pp-play", "Play →");
      play.href = game.url;
      play.setAttribute("aria-label", "Play " + game.name);
      page.appendChild(play);
    }
    return page;
  }

  function stampedCount() {
    return games.filter(function (g) { return store.games[g.id]; }).length;
  }

  // Draw (or redraw) every game page, and the count line above them.
  function render() {
    Array.prototype.slice.call(book.querySelectorAll(".pp-game")).forEach(function (n) { n.remove(); });
    games.forEach(function (game) { book.appendChild(gamePage(game)); });
    var stamped = stampedCount();
    if (countLine) {
      countLine.textContent = stamped + " of " + games.length + (games.length === 1 ? " game" : " games") + " stamped";
    }
    if (clearButton) clearButton.hidden = Object.keys(store.games).length === 0;
  }

  // ---- 4. The toast ---------------------------------------------------------------

  var toastTimer = 0;
  function toast(title, line, isProblem) {
    var box = document.querySelector(".pp-toast");
    if (!box) {
      box = el("div", "pp-toast");
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.classList.toggle("pp-toast--problem", !!isProblem);
    box.replaceChildren(el("strong", null, title));
    if (line) box.appendChild(el("span", null, line));
    box.classList.remove("is-shown");
    void box.offsetWidth; // restart the slide-in
    box.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove("is-shown"); }, 5000);
  }

  // Slide the booklet to a game's page, so the new stamp is in view.
  function showGame(id) {
    var page = book.querySelector('.pp-game[data-game="' + id + '"]');
    if (!page) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    page.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "start" });
  }

  // ---- 5. Taking in a stamp -----------------------------------------------------

  function takeStamp(code) {
    if (!Codec || !Check) {
      toast("Stamp not added", "The Passport didn't load properly. Reload the page and try the link again.", true);
      return;
    }
    Codec.decode(code)
      .then(function (raw) {
        var result = Check.check(raw, registryIds);
        if (!result.ok) {
          toast(result.reason === "newer" ? "Newer stamp" : "Stamp not added", result.message, true);
          return;
        }
        var stamp = result.stamp;
        var name = namesById[stamp.game] || "this game";
        var onSite = games.some(function (g) { return g.id === stamp.game; });
        var old = store.games[stamp.game];
        if (!Check.isNewer(stamp, old)) {
          var same = old && old.updated === stamp.updated && Check.compareVersions(old.ver, stamp.ver) === 0;
          toast(same ? "Already stamped" : "Older stamp", same
            ? "You already have this " + name + " stamp."
            : "Your " + name + " stamp is newer than this one, so it was kept.");
          if (onSite) showGame(stamp.game);
          return;
        }
        store.games[stamp.game] = stamp;
        if (old) store.updates += 1;
        if (!saveStore()) {
          toast("Stamp not saved", "This browser wouldn't save it (private mode, or storage is full).", true);
          return;
        }
        render();
        toast((old ? "Stamp updated: " : "Stamp added: ") + name,
          onSite ? "" : "It will show here once " + name + " is on the site.");
        if (onSite) showGame(stamp.game);
      })
      .catch(function (err) {
        toast("Stamp not added", err && err.name === "CodecError" ? err.message : "That stamp link couldn't be read.", true);
      });
  }

  // A second stamp link opened while the page is already showing.
  window.addEventListener("hashchange", function () {
    var code = takeFromAddress();
    if (code && registryIds.length) takeStamp(code);
  });

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (!window.confirm("Remove every stamp from this browser? The games keep your progress; you can add each stamp again from the game.")) return;
      clearStore();
      render();
      toast("Stamps removed", "Your Passport is empty again.");
    });
  }

  // ---- 6. Start ------------------------------------------------------------------

  Promise.all([getJson("projects.json"), getJson("passport/registry.json")])
    .then(function (both) {
      var registry = both[1];
      (registry && registry.games || []).forEach(function (entry) {
        if (entry && typeof entry.id === "string" && entry.id) {
          registryIds.push(entry.id);
          namesById[entry.id] = String(entry.title || entry.id);
        }
      });
      games = gamesFrom(both[0], registry);
      if (Check) store = loadStore();
      if (loading) loading.remove();
      render();
      if (pendingCode) takeStamp(pendingCode);
      pendingCode = null;
    })
    .catch(function () {
      if (loading) {
        loading.classList.remove("is-loading");
        loading.textContent = "The games couldn't load. Check your connection and reload the page.";
      }
      if (pendingCode) toast("Stamp not added", "The Passport couldn't load. Check your connection and open the link again.", true);
    });
})();

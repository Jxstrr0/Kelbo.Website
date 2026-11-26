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
   unpacked (js/codec.js) and checked (js/validate.js). A game's first stamp
   is kept and a toast says so. A link for a game that already has a stamp
   never replaces it by itself: the page shows both and asks, "Keep mine" or
   "Replace", because a stamp link can come from anyone. A link for a game
   with a bridge waits for that game's bridge to answer first (3 seconds at
   most), so the game's own stamp is the one already there (security test,
   26 Nov 2026: a stranger's link dated today got in ahead of the game's
   own stamp, and then outranked it).

   Never inside a frame: if another page has put the Passport in a frame,
   it shows one line and does nothing else, so a page can't hide it and
   steer a tap onto "Replace" or "Remove all stamps".

   The bridge (PR 3): for each game whose registry entry has a bridgeUrl,
   js/bridge.js opens that game's bridge page in a hidden frame and collects
   the stamp it posts back (3 seconds each, address checked). Each stamp is
   checked here like a linked one, and must name the game whose frame sent
   it. A newer one is kept without asking, since it came from the game's
   own address. Missing or slow bridges are skipped quietly.

   Badges (PR 4): passport/badges.json lists the studio badges and
   js/badges.js works out which are earned from the stamps of the games on
   the site. The shelf under the booklet shows them all, earned or not, and
   a toast names each badge the first time it's earned.

   The share card (PR 6): "Share my Passport" makes a picture of the
   Passport (js/sharecard.js: game names and counts only) and opens the
   share sheet, or downloads it. The picture is made ahead, whenever the
   stamps change, so the share sheet opens straight from the tap (iPhones
   refuse it if the tap was too long ago).

   Storage, in this browser only:
     kelbo.passport.stamps = { "games": { "<game id>": stamp, ... },
                               "updates": how many times a newer stamp
                                          replaced an older one }
     kelbo.passport.seen   = [ ids of the badges whose toast has shown ]
   Stamps read back from storage are checked again, since anyone can edit
   it. "Remove all stamps" clears kelbo.passport.* and nothing else.

   Privacy: stamps are never sent anywhere or logged. Every piece of text is
   put on the page with textContent, never innerHTML, so nothing in a stamp
   or a data file can add code to the page.
   Spec: .github/PASSPORT.md
   ========================================================================== */
(function () {
  "use strict";

  var BRIDGE_WAIT_MS = 3000; // how long each game's bridge gets to answer
  var STORE_KEY = "kelbo.passport.stamps";
  var STORE_PREFIX = "kelbo.passport.";
  var SEEN_KEY = "kelbo.passport.seen";

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

  // ---- 1b. Never inside another page's frame --------------------------------
  // The Passport is only ever opened as its own page. Inside a frame it
  // takes no stamp link, opens no bridge and shows no stamps or buttons, so
  // a page that hides it in a frame has nothing to steer a tap onto.
  var framed = true;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if (framed) {
    pendingCode = null;
    if (loading) {
      loading.classList.remove("is-loading");
      loading.textContent = "The Passport only opens as its own page. ";
      var own = document.createElement("a");
      own.href = "passport.html";
      own.target = "_blank";
      own.rel = "noopener";
      own.textContent = "Open the Passport";
      loading.appendChild(own);
    }
    return;
  }
  var clearButton = document.querySelector("[data-pp-clear]");
  var Codec = window.LLPassportCodec;
  var Check = window.LLPassportValidate;
  var Bridge = window.LLPassportBridge;
  var Badges = window.LLPassportBadges;
  var shelf = document.querySelector("[data-pp-badges]");
  var badgeCountLine = document.querySelector("[data-pp-badge-count]");
  var Share = window.LLPassportShare;
  var shareBox = document.querySelector("[data-pp-share-box]");
  var shareButton = document.querySelector("[data-pp-share]");
  var cardFile = null; // the share picture, made ahead
  var cardKey = ""; // the words it was made from

  var games = []; // the games on the site, in Kelbo's order
  var registryIds = []; // every game the Passport knows, hidden ones too
  var namesById = {}; // id → name, hidden games too (for the toast)
  var bridges = []; // [{ id, url, origin }] for games with a bridge page
  var bridgeWaits = Object.create(null); // id → { promise, done } while that game's bridge hasn't answered
  var bridgeFresh = Object.create(null); // id → true once a bridge's stamp was kept on this visit
  var store = { games: {}, updates: 0 };
  var badgeList = []; // the badges from passport/badges.json, tidied

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
      // One stamp that can't be read is left out; it never stops the others.
      try {
        var result = Check.check(stored[id], registryIds, { today: "9999-12-31" });
        if (result.ok && result.stamp.game === id) out.games[id] = result.stamp;
      } catch (e) {}
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

  // Today on this phone, as "YYYY-MM-DD" (the way stamps are dated).
  function todayText() {
    var now = new Date();
    return now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
  }

  // A number of a quadrillion or more is written short ("1.00 × 10^20"), so
  // a made-up stamp with a 300-digit number can't stretch its page.
  function niceNumber(n) {
    return Math.abs(n) >= 1e15 ? n.toExponential(2).replace("e+", " × 10^") : n.toLocaleString("en-CA");
  }

  function niceValue(stat) {
    var value = typeof stat.value === "number" ? niceNumber(stat.value) : stat.value;
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
    renderBadges();
    prepareCard();
  }

  // ---- 3c. The share card -------------------------------------------------------------

  function cardWords() {
    return Share.card({
      games: games.map(function (g) { return { id: g.id, name: g.name }; }),
      stamps: store.games,
      badges: badgeResults(),
    });
  }

  // Shown once there's a stamp from a game on the site; the picture is made
  // again only when its words change.
  function prepareCard() {
    if (!Share || !shareBox) return;
    var words = cardWords();
    shareBox.hidden = words.stamped === 0;
    if (words.stamped === 0) return;
    var key = JSON.stringify(words);
    if (key === cardKey) return;
    cardKey = key;
    cardFile = null;
    Share.make(words).then(function (file) {
      if (cardKey === key) cardFile = file;
    }, function () { /* made again on the tap */ });
  }

  function shareCard() {
    if (!Share) return;
    var ready = cardFile ? Promise.resolve(cardFile) : Share.make(cardWords());
    ready
      .then(Share.share)
      .then(function (result) {
        if (result === "downloaded") toast("Picture saved", "Your Passport card is in your downloads.");
      })
      .catch(function () {
        toast("Couldn't make the picture", "Try again in a moment.", true);
      });
  }

  // ---- 3b. Badges -------------------------------------------------------------------

  function badgeResults() {
    if (!Badges || !badgeList.length) return [];
    return Badges.evaluate(badgeList, {
      stamps: store.games,
      gameIds: games.map(function (g) { return g.id; }),
      updates: store.updates,
    });
  }

  // "2 of 3 games", "Best so far: 840 of 1,000", or "Not yet".
  function badgeProgress(result) {
    var rule = result.rule;
    var n = function (x) { return niceNumber(Number(x)); };
    if (rule.type === "gamesStamped" || (rule.type === "flag" && !rule.game)) {
      return n(result.have) + " of " + n(result.need) + (result.need === 1 ? " game" : " games");
    }
    if (rule.type === "updates") {
      return n(result.have) + " of " + n(result.need) + " updates";
    }
    if (rule.type === "stat" && result.have !== null) {
      return "Best so far: " + n(result.have) + " of " + n(result.need);
    }
    return "Not yet";
  }

  function badgeTile(result) {
    var tile = el("li", "pp-badge" + (result.earned ? " is-earned" : ""));
    tile.appendChild(el("span", "pp-badge__medal")).setAttribute("aria-hidden", "true");
    var words = el("div", "pp-badge__words");
    words.appendChild(el("h3", "pp-badge__name", result.name));
    if (result.line) words.appendChild(el("p", "pp-badge__line", result.line));
    words.appendChild(el("p", "pp-badge__state", result.earned ? "Earned" : badgeProgress(result)));
    tile.appendChild(words);
    return tile;
  }

  // Draw the badge shelf: every badge, earned ones lit.
  function renderBadges() {
    if (!shelf) return;
    var results = badgeResults();
    shelf.replaceChildren();
    results.forEach(function (r) { shelf.appendChild(badgeTile(r)); });
    var earned = results.filter(function (r) { return r.earned; }).length;
    if (badgeCountLine) badgeCountLine.textContent = results.length ? earned + " of " + results.length + " badges earned" : "";
  }

  function loadSeen() {
    try {
      var list = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
      return Array.isArray(list) ? list.filter(function (x) { return typeof x === "string"; }) : [];
    } catch (e) {
      return [];
    }
  }

  // A toast for each badge earned since the last one was shown (several at
  // once share one toast). Each badge is only ever announced once.
  function announceBadges() {
    var seen = loadSeen();
    var fresh = badgeResults().filter(function (r) { return r.earned && seen.indexOf(r.id) < 0; });
    if (!fresh.length) return;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.concat(fresh.map(function (r) { return r.id; }))));
    } catch (e) {}
    if (fresh.length === 1) toast("Badge earned: " + fresh[0].name, fresh[0].line);
    else toast("Badges earned", fresh.map(function (r) { return r.name; }).join(", "));
  }

  // ---- 4. The toast ---------------------------------------------------------------

  // Toasts wait their turn: a stamp's toast, then any badge it earned.
  var toastQueue = [];
  var toastBusy = false;
  function toast(title, line, isProblem) {
    toastQueue.push({ title: title, line: line, problem: !!isProblem });
    if (!toastBusy) nextToast();
  }

  function nextToast() {
    var next = toastQueue.shift();
    if (!next) { toastBusy = false; return; }
    toastBusy = true;
    var box = document.querySelector(".pp-toast");
    if (!box) {
      box = el("div", "pp-toast");
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.classList.toggle("pp-toast--problem", next.problem);
    box.replaceChildren(el("strong", null, next.title));
    if (next.line) box.appendChild(el("span", null, next.line));
    box.classList.remove("is-shown");
    void box.offsetWidth; // restart the slide-in
    box.classList.add("is-shown");
    setTimeout(function () {
      box.classList.remove("is-shown");
      setTimeout(nextToast, 350);
    }, toastQueue.length ? 3500 : 5000);
  }

  // Slide the booklet to a game's page, so the new stamp is in view.
  function showGame(id) {
    var page = book.querySelector('.pp-game[data-game="' + id + '"]');
    if (!page) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    page.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "start" });
  }

  // ---- 5. Taking in a stamp -----------------------------------------------------

  // Two clean stamps are the same when every field matches (check() always
  // writes them in the same order).
  function sameStamp(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // Put a stamp in the store and save it. `old` is the stamp it replaces, if
  // any. If the browser won't save, the page keeps showing what is stored.
  function keepStamp(stamp, old, name, onSite) {
    var beforeUpdates = store.updates;
    store.games[stamp.game] = stamp;
    var newer = !!old && Check.isNewer(stamp, old);
    if (newer) store.updates += 1; // going back to an older stamp isn't an update
    if (!saveStore()) {
      if (old) store.games[stamp.game] = old;
      else delete store.games[stamp.game];
      store.updates = beforeUpdates;
      toast("Stamp not saved", "This browser wouldn't save it (private mode, or storage is full).", true);
      return;
    }
    render();
    toast((!old ? "Stamp added: " : newer ? "Stamp updated: " : "Stamp replaced: ") + name,
      onSite ? "" : "It will show here once " + name + " is on the site.");
    if (onSite) showGame(stamp.game);
  }

  // "24 Nov 2026 · version 1.2.3.0"
  function stampLine(stamp) {
    return niceDate(stamp.updated) + " · version " + stamp.ver;
  }

  // The question before a link replaces a stamp: both stamps side by side,
  // "Keep mine" (where the focus starts, and what Esc does) or "Replace".
  // Answers true for Replace. A stamp link can come from anyone, so nothing
  // already in the Passport is replaced without that tap.
  var asking = false; // a question is on screen
  var skipped = 0; // stamp links that arrived while it was
  function askReplace(name, old, stamp) {
    var title = "Replace your " + name + " stamp?";
    var note = Check.isNewer(stamp, old)
      ? "The stamp in this link is newer than yours."
      : Check.isNewer(old, stamp)
        ? "The stamp in this link is older than yours."
        : "Both have the same date and version, but they aren't the same stamp.";
    if (old.updated > todayText()) note += " Yours is dated after today.";
    note += " Only replace it if the link came from your own game.";
    var rows = [["Yours", old], ["This link", stamp]];

    return new Promise(function (resolve) {
      var box = el("dialog", "pp-ask");
      if (typeof box.showModal !== "function") {
        // A browser without <dialog>: the plain question box.
        resolve(window.confirm(title + "\n\n" + rows.map(function (r) {
          return r[0] + ": " + stampLine(r[1]) + (r[1].headline ? ", " + r[1].headline : "");
        }).join("\n") + "\n\n" + note + "\n\nOK replaces it. Cancel keeps yours."));
        return;
      }
      var heading = el("h2", "pp-ask__title", title);
      heading.id = "pp-ask-title";
      box.setAttribute("aria-labelledby", heading.id);
      box.appendChild(heading);
      var list = el("dl", "pp-ask__list");
      rows.forEach(function (r) {
        var row = el("div", "pp-ask__row");
        row.appendChild(el("dt", null, r[0]));
        var words = el("dd");
        words.appendChild(el("span", "pp-ask__when", stampLine(r[1])));
        if (r[1].headline) words.appendChild(el("span", "pp-ask__headline", r[1].headline));
        row.appendChild(words);
        list.appendChild(row);
      });
      box.appendChild(list);
      box.appendChild(el("p", "pp-ask__note", note));
      var buttons = el("div", "pp-ask__buttons");
      var keep = el("button", "pp-ask__button pp-ask__button--keep", "Keep mine");
      var swap = el("button", "pp-ask__button", "Replace");
      keep.type = "button";
      swap.type = "button";
      buttons.appendChild(keep);
      buttons.appendChild(swap);
      box.appendChild(buttons);

      var answered = false;
      function answer(replace) {
        if (answered) return;
        answered = true;
        asking = false;
        try { box.close(); } catch (e) {}
        box.remove();
        resolve(replace);
      }
      keep.addEventListener("click", function () { answer(false); });
      swap.addEventListener("click", function () { answer(true); });
      box.addEventListener("cancel", function (event) { event.preventDefault(); answer(false); }); // Esc, Back
      box.addEventListener("close", function () { answer(false); });
      document.body.appendChild(box);
      asking = true;
      try {
        box.showModal();
        keep.focus();
      } catch (e) {
        answer(false);
      }
    });
  }

  // One stamp link at a time. A link that arrives while a question is on
  // screen is skipped (and said so after), so a page that fires off a pile
  // of links can't bury the player in questions.
  var intake = Promise.resolve();
  function takeStamp(code) {
    if (asking) {
      skipped += 1;
      return;
    }
    intake = intake.then(function () { return takeOne(code); }).then(function () {
      if (skipped) {
        toast("Stamp link skipped", (skipped === 1 ? "Another stamp link" : skipped + " more stamp links") +
          " arrived while that question was open. Open " + (skipped === 1 ? "it" : "them") + " again if you want " +
          (skipped === 1 ? "it." : "them."), true);
        skipped = 0;
      }
      announceBadges();
    });
  }

  function takeOne(code) {
    if (!Codec || !Check) {
      toast("Stamp not added", "The Passport didn't load properly. Reload the page and try the link again.", true);
      return Promise.resolve();
    }
    return Codec.decode(code)
      .then(function (raw) {
        var result = Check.check(raw, registryIds);
        if (!result.ok) {
          toast(result.reason === "newer" ? "Newer stamp" : "Stamp not added", result.message, true);
          return;
        }
        var stamp = result.stamp;
        var name = namesById[stamp.game] || "this game";
        var onSite = games.some(function (g) { return g.id === stamp.game; });
        // If this game has a bridge, let it answer first: the game's own
        // stamp is then the one already here, and the link has to ask.
        return bridgeAnswered(stamp.game).then(function () {
          // Read the stamps again first: another tab may have added some since this page drew.
          store = loadStore();
          var old = store.games[stamp.game];
          if (!old) {
            keepStamp(stamp, null, name, onSite);
            return;
          }
          if (onSite) showGame(stamp.game);
          if (sameStamp(stamp, old)) {
            // The bridge brought this very stamp a moment ago: its own toast says so.
            if (!bridgeFresh[stamp.game]) toast("Already stamped", "You already have this " + name + " stamp.");
            return;
          }
          return askReplace(name, old, stamp).then(function (replace) {
            if (!replace) {
              toast("Stamp kept", "Your " + name + " stamp is as it was.");
              return;
            }
            store = loadStore();
            keepStamp(stamp, store.games[stamp.game] || null, name, onSite);
          });
        });
      })
      .catch(function (err) {
        toast("Stamp not added", err && err.name === "CodecError" ? err.message : "That stamp link couldn't be read.", true);
      });
  }

  // ---- 6. The bridge ---------------------------------------------------------------

  // A stamp link for a game with a bridge waits here until that bridge has
  // answered or run out of time. Resolves at once for a game with no
  // bridge, or once its bridge is done. Never rejects.
  function bridgeAnswered(id) {
    var wait = Object.prototype.hasOwnProperty.call(bridgeWaits, id) ? bridgeWaits[id] : null;
    return wait ? wait.promise : Promise.resolve();
  }

  function bridgeDone(id) {
    var wait = Object.prototype.hasOwnProperty.call(bridgeWaits, id) ? bridgeWaits[id] : null;
    if (!wait) return;
    delete bridgeWaits[id];
    wait.done();
  }

  // Ask every game's bridge page for its stamp, keep the newer ones, and
  // say which stamps changed. Quiet when nothing did.
  function askBridges() {
    if (!Bridge || !Check || !bridges.length) return;
    var added = [];
    var updated = [];
    var ids = bridges.map(function (b) { return b.id; });
    ids.forEach(function (id) {
      var wait = {};
      wait.promise = new Promise(function (resolve) { wait.done = resolve; });
      bridgeWaits[id] = wait;
    });
    var everyoneDone = function () { ids.forEach(bridgeDone); };
    // A backstop, should a bridge never report back: no link waits past this.
    setTimeout(everyoneDone, BRIDGE_WAIT_MS + 1000);
    function take(id, raw) {
      var result = Check.check(raw, registryIds);
      if (!result.ok || result.stamp.game !== id) return; // one game can't stamp for another
      var old = store.games[id];
      // The game's own stamp wins over a stored one that isn't newer, and over
      // one dated after today (a real stamp never is), so a made-up stamp from
      // a link can't lock the real one out.
      var fromAhead = !!old && old.updated > todayText() && !sameStamp(result.stamp, old);
      if (!Check.isNewer(result.stamp, old) && !fromAhead) return;
      var beforeUpdates = store.updates;
      store.games[id] = result.stamp;
      if (old && !fromAhead) store.updates += 1;
      if (!saveStore()) {
        if (old) store.games[id] = old;
        else delete store.games[id];
        store.updates = beforeUpdates;
        return;
      }
      (old ? updated : added).push(namesById[id] || id);
      bridgeFresh[id] = true;
      render();
    }
    Bridge.collect(bridges, { timeoutMs: BRIDGE_WAIT_MS, onStamp: take, onDone: bridgeDone }).then(function () {
      everyoneDone();
      var names = added.concat(updated);
      if (!names.length) return;
      var title = added.length && !updated.length
        ? (names.length === 1 ? "Stamp added" : "Stamps added")
        : (names.length === 1 ? "Stamp updated" : "Stamps updated");
      toast(title, names.join(", ") + (names.length === 1 ? ", from the game." : ", from the games."));
      announceBadges();
    });
  }

  // A second stamp link opened while the page is already showing.
  window.addEventListener("hashchange", function () {
    var code = takeFromAddress();
    if (code && registryIds.length) takeStamp(code);
  });

  if (shareButton) shareButton.addEventListener("click", shareCard);

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (!window.confirm("Remove every stamp from this browser? The games keep your progress; you can add each stamp again from the game.")) return;
      clearStore();
      render();
      toast("Stamps removed", "Your Passport is empty again.");
    });
  }

  // ---- 7. Start ------------------------------------------------------------------

  // The badges are extra: if their file doesn't load, the stamps still do.
  var badgeFile = getJson("passport/badges.json").catch(function () { return null; });

  Promise.all([getJson("projects.json"), getJson("passport/registry.json"), badgeFile])
    .then(function (both) {
      var registry = both[1];
      if (Badges) badgeList = Badges.rules(both[2]);
      (registry && registry.games || []).forEach(function (entry) {
        if (entry && typeof entry.id === "string" && entry.id) {
          registryIds.push(entry.id);
          namesById[entry.id] = String(entry.title || entry.id);
          var origin = entry.bridgeUrl && Bridge ? Bridge.originOf(entry.bridgeUrl) : "";
          if (origin) bridges.push({ id: entry.id, url: String(entry.bridgeUrl), origin: origin });
        }
      });
      games = gamesFrom(both[0], registry);
      if (Check) store = loadStore();
      if (loading) loading.remove();
      render();
      askBridges(); // first, so a stamp link below waits for its game's bridge
      if (pendingCode) takeStamp(pendingCode); // announces its badges once it's dealt with
      else announceBadges();
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

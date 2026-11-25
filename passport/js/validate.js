/* ==========================================================================
   Longlight Passport: the stamp check (passport/js/validate.js)
   --------------------------------------------------------------------------
   Every stamp goes through check() before it's kept or shown: one that
   arrives in a link, and one read back from this phone's storage (which
   anyone can edit). It returns a clean copy holding only the fields the
   Passport knows, or a reason it was refused.

   The rules (spec section 4):
     - v is 1. A bigger number gets the "newer version" note.
     - game is one of the games in passport/registry.json.
     - ver is the game's version: numbers and dots (1.76.142.2).
     - updated is a real date, YYYY-MM-DD, not later than tomorrow.
     - headline: optional, at most 60 characters.
     - stats: 1 to 6, each with an id (a-z, 0-9, _), a label of at most 32
       characters, an optional unit of at most 8, and a value that is a
       number or text of at most 24 characters. No id twice.
     - flags: optional, at most 8 short ids.
     - at most 2 KB of JSON altogether. Unknown fields are dropped.
     - no control characters or right-to-left tricks in any text.

   isNewer() says which of two stamps is the later one: a newer date, or
   the same date with a newer version. passport.js uses it to word its
   question before a link replaces a stamp, and to count updates.

   Works as a plain <script> (window.LLPassportValidate) and in Node.
   Spec: .github/PASSPORT.md
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LLPassportValidate = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LIMITS = {
    jsonBytes: 2048,
    headline: 60,
    stats: 6,
    label: 32,
    unit: 8,
    textValue: 24,
    flags: 8,
  };

  var ID = /^[a-z0-9_]{1,32}$/;
  var VERSION = /^\d{1,6}(\.\d{1,6}){0,4}$/;
  var DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  // Control characters, and the invisible marks that flip text right-to-left.
  var BAD_CHARS = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/;

  function refuse(reason, message) {
    return { ok: false, reason: reason, message: message };
  }

  var DAMAGED = "That stamp doesn't look right, so it wasn't added.";

  // Plain text: trimmed, not empty, not too long, nothing invisible.
  function cleanText(value, max) {
    if (typeof value !== "string") return null;
    var text = value.trim();
    if (!text || text.length > max || BAD_CHARS.test(text)) return null;
    return text;
  }

  // A real calendar date as YYYY-MM-DD, as a number of days (for comparing).
  function dayNumber(text) {
    var m = DATE.exec(String(text || ""));
    if (!m) return NaN;
    var y = +m[1], mo = +m[2], d = +m[3];
    var t = Date.UTC(y, mo - 1, d);
    var back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return NaN;
    return t / 86400000;
  }

  function utf8Length(text) {
    return typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : unescape(encodeURIComponent(text)).length;
  }

  // check(raw, gameIds, options) → { ok: true, stamp } or { ok: false, reason, message }.
  //   gameIds: the ids from passport/registry.json.
  //   options.today: "YYYY-MM-DD" (defaults to the phone's date), so a
  //   stamp dated years ahead can't block every later update.
  // Whatever shape `raw` has, the answer is a refusal, never an error:
  // storage can be edited into anything, and one bad stamp mustn't stop the page.
  function check(raw, gameIds, options) {
    try {
      return checkStamp(raw, gameIds, options);
    } catch (e) {
      return refuse("damaged", DAMAGED);
    }
  }

  function checkStamp(raw, gameIds, options) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return refuse("damaged", DAMAGED);

    var json;
    try { json = JSON.stringify(raw); } catch (e) { return refuse("damaged", DAMAGED); }
    if (utf8Length(json) > LIMITS.jsonBytes) return refuse("too-big", "That stamp is too big to be a real one.");

    if (raw.v !== 1) {
      if (typeof raw.v === "number" && raw.v > 1) {
        return refuse("newer", "This stamp is from a newer version of the Passport. Reload this page and try again.");
      }
      return refuse("damaged", DAMAGED);
    }

    var ids = Array.isArray(gameIds) ? gameIds : [];
    if (typeof raw.game !== "string" || ids.indexOf(raw.game) < 0) {
      return refuse("unknown-game", "That stamp is from a game the Passport doesn't know.");
    }

    var ver = typeof raw.ver === "string" ? raw.ver.trim() : "";
    if (!VERSION.test(ver)) return refuse("damaged", DAMAGED);

    if (typeof raw.updated !== "string") return refuse("damaged", DAMAGED);
    var day = dayNumber(raw.updated);
    if (isNaN(day)) return refuse("damaged", DAMAGED);
    var todayText = options && options.today;
    if (!todayText) {
      var now = new Date();
      todayText = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
    }
    var today = dayNumber(todayText);
    if (!isNaN(today) && day > today + 1) {
      return refuse("future", "That stamp is dated in the future. Check the date on your phone, then try again.");
    }

    var stamp = { v: 1, game: raw.game, ver: ver, updated: raw.updated };

    if (raw.headline != null && raw.headline !== "") {
      var headline = cleanText(raw.headline, LIMITS.headline);
      if (headline === null) return refuse("damaged", DAMAGED);
      stamp.headline = headline;
    }

    if (!Array.isArray(raw.stats) || raw.stats.length < 1 || raw.stats.length > LIMITS.stats) {
      return refuse("damaged", DAMAGED);
    }
    var seen = Object.create(null);
    stamp.stats = [];
    for (var i = 0; i < raw.stats.length; i++) {
      var s = raw.stats[i];
      if (!s || typeof s !== "object" || Array.isArray(s)) return refuse("damaged", DAMAGED);
      if (typeof s.id !== "string" || !ID.test(s.id) || seen[s.id]) return refuse("damaged", DAMAGED);
      seen[s.id] = true;
      var label = cleanText(s.label, LIMITS.label);
      if (label === null) return refuse("damaged", DAMAGED);
      var value;
      if (typeof s.value === "number") {
        if (!isFinite(s.value)) return refuse("damaged", DAMAGED);
        value = s.value;
      } else {
        value = cleanText(s.value, LIMITS.textValue);
        if (value === null) return refuse("damaged", DAMAGED);
      }
      var stat = { id: s.id, label: label, value: value };
      if (s.unit != null && s.unit !== "") {
        var unit = cleanText(s.unit, LIMITS.unit);
        if (unit === null) return refuse("damaged", DAMAGED);
        stat.unit = unit;
      }
      stamp.stats.push(stat);
    }

    if (raw.flags != null) {
      if (!Array.isArray(raw.flags) || raw.flags.length > LIMITS.flags) return refuse("damaged", DAMAGED);
      var flags = [];
      for (var f = 0; f < raw.flags.length; f++) {
        if (typeof raw.flags[f] !== "string" || !ID.test(raw.flags[f])) return refuse("damaged", DAMAGED);
        if (flags.indexOf(raw.flags[f]) < 0) flags.push(raw.flags[f]);
      }
      if (flags.length) stamp.flags = flags;
    }

    return { ok: true, stamp: stamp };
  }

  // Compare two versions number by number: 1.10 is newer than 1.9.
  // Returns 1, 0 or -1.
  function compareVersions(a, b) {
    var pa = String(a || "").split("."), pb = String(b || "").split(".");
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = parseInt(pa[i] || "0", 10) || 0, y = parseInt(pb[i] || "0", 10) || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  // The replace rule: should `incoming` replace `stored`?
  function isNewer(incoming, stored) {
    if (!stored) return true;
    if (incoming.updated !== stored.updated) return incoming.updated > stored.updated;
    return compareVersions(incoming.ver, stored.ver) > 0;
  }

  return {
    LIMITS: LIMITS,
    check: check,
    isNewer: isNewer,
    compareVersions: compareVersions,
  };
});

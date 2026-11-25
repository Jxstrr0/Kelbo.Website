/* ==========================================================================
   Longlight Passport: studio badges (passport/js/badges.js)
   --------------------------------------------------------------------------
   Works out which badges a player has, from the stamps on this phone.
   The badges themselves are data in passport/badges.json (spec section 5);
   this file only knows the four kinds of rule:

     { "type": "gamesStamped", "min": 3 }        stamps from at least 3 games
     { "type": "gamesStamped", "all": true }     a stamp from every game shown
     { "type": "stat", "game": "pew", "stat": "best_hp", "gte": 1000 }
                                                 one game's number is at least 1000
     { "type": "flag", "flag": "career_complete", "minGames": 2 }
                                                 that flag in at least 2 games' stamps
     { "type": "flag", "game": "scrapline", "flag": "open_won" }
                                                 that flag in that one game's stamp
     { "type": "updates", "min": 5 }             stamps updated at least 5 times

   Only games on the site count, so a hidden game's stamp never earns a
   badge (and "every game" means every game a visitor can see).

   rules(json) tidies badges.json: a badge with a rule it doesn't know, or a
   missing name, is left out instead of breaking the page.
   evaluate(badges, context) says, for each badge, whether it's earned and
   how far along the player is ("2 of 3").

   Works as a plain <script> (window.LLPassportBadges) and in Node.
   Spec: .github/PASSPORT.md
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LLPassportBadges = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ID = /^[a-z0-9_]{1,40}$/;

  function wholeNumber(value) {
    return typeof value === "number" && isFinite(value) && value >= 1 && Math.floor(value) === value;
  }

  function text(value, max) {
    return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : "";
  }

  // One rule from the file → a clean copy, or null if it isn't a rule we know.
  function cleanRule(rule) {
    if (!rule || typeof rule !== "object") return null;
    if (rule.type === "gamesStamped") {
      if (rule.all === true) return { type: "gamesStamped", all: true };
      return wholeNumber(rule.min) ? { type: "gamesStamped", min: rule.min } : null;
    }
    if (rule.type === "stat") {
      if (!ID.test(String(rule.game)) || !ID.test(String(rule.stat))) return null;
      if (typeof rule.gte !== "number" || !isFinite(rule.gte)) return null;
      return { type: "stat", game: rule.game, stat: rule.stat, gte: rule.gte };
    }
    if (rule.type === "flag") {
      if (!ID.test(String(rule.flag))) return null;
      if (rule.game != null) return ID.test(String(rule.game)) ? { type: "flag", flag: rule.flag, game: rule.game } : null;
      return wholeNumber(rule.minGames) ? { type: "flag", flag: rule.flag, minGames: rule.minGames } : null;
    }
    if (rule.type === "updates") {
      return wholeNumber(rule.min) ? { type: "updates", min: rule.min } : null;
    }
    return null;
  }

  // badges.json → [{ id, name, line, rule }], skipping anything malformed
  // and any id used twice.
  function rules(json) {
    var list = json && Array.isArray(json.badges) ? json.badges : [];
    var seen = Object.create(null);
    var out = [];
    list.forEach(function (b) {
      if (!b || typeof b !== "object" || !ID.test(String(b.id)) || seen[b.id]) return;
      var name = text(b.name, 40);
      var line = text(b.line, 80);
      var rule = cleanRule(b.rule);
      if (!name || !rule) return;
      seen[b.id] = true;
      out.push({ id: b.id, name: name, line: line, rule: rule });
    });
    return out;
  }

  // How far along one rule is: { earned, have, need } (have/need are
  // counts for a progress line; a stat rule gives the best number so far).
  function progress(rule, context) {
    var ids = context.gameIds || [];
    var stamps = context.stamps || {};
    var stamped = ids.filter(function (id) { return stamps[id]; });

    if (rule.type === "gamesStamped") {
      var need = rule.all ? ids.length : rule.min;
      return { earned: need > 0 && stamped.length >= need, have: stamped.length, need: need };
    }
    if (rule.type === "stat") {
      var stamp = ids.indexOf(rule.game) >= 0 ? stamps[rule.game] : null;
      var value = null;
      (stamp && stamp.stats || []).forEach(function (s) {
        if (s.id === rule.stat && typeof s.value === "number") value = s.value;
      });
      return { earned: value !== null && value >= rule.gte, have: value, need: rule.gte };
    }
    if (rule.type === "flag") {
      var withFlag = stamped.filter(function (id) {
        if (rule.game && id !== rule.game) return false;
        return (stamps[id].flags || []).indexOf(rule.flag) >= 0;
      }).length;
      var needed = rule.game ? 1 : rule.minGames;
      return { earned: withFlag >= needed, have: withFlag, need: needed };
    }
    if (rule.type === "updates") {
      var n = Math.max(0, Math.floor(Number(context.updates) || 0));
      return { earned: n >= rule.min, have: n, need: rule.min };
    }
    return { earned: false, have: 0, need: 0 };
  }

  // evaluate(badges, { stamps, gameIds, updates }) →
  //   [{ id, name, line, rule, earned, have, need }] in the file's order.
  //   stamps:  { "<game id>": checked stamp }
  //   gameIds: the ids of the games on the site (hidden ones left out)
  //   updates: how many times a newer stamp replaced an older one
  function evaluate(badges, context) {
    var ctx = context || {};
    return (badges || []).map(function (b) {
      var p = progress(b.rule, ctx);
      return { id: b.id, name: b.name, line: b.line, rule: b.rule, earned: p.earned, have: p.have, need: p.need };
    });
  }

  return {
    rules: rules,
    evaluate: evaluate,
  };
});

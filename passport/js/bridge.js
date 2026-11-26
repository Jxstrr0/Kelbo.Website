/* ==========================================================================
   Longlight Passport: the bridge (passport/js/bridge.js)
   --------------------------------------------------------------------------
   The second way a stamp arrives (spec section 3B). A game that hosts the
   bridge page (passport/kit/passport-stamp.html, copied into the game) has
   its address in passport/registry.json as "bridgeUrl". The Passport opens
   that page in a hidden frame; the page reads the game's own stamp from
   the game's storage and posts it here.

   Both sides check the address:
     - the bridge page only posts to https://longlight.games;
     - collect() only takes a message that comes from the frame it opened,
       from exactly that game's address, in the expected shape, and small.
   Each frame gets 3 seconds. A bridge that's missing, slow or broken is
   skipped quietly; the stamp link always works.

   The frames are sandboxed: they may run their script and read their own
   storage, nothing else (no pop-ups, no forms, no moving this page).

   What comes back is still only a raw stamp. passport.js runs it through
   the stamp check (validate.js) and makes sure it names the game whose
   frame sent it, so one game can never stamp for another.

   Works as a plain <script> (window.LLPassportBridge); the two small
   checks (originOf, readMessage) also load in Node for the tests.
   Spec: .github/PASSPORT.md
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LLPassportBridge = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MESSAGE_TYPE = "llp-stamp";
  var MAX_MESSAGE_CHARS = 4096;
  var WAIT_MS = 3000;

  // A bridge address → its origin ("https://pew.longlight.games"), or ""
  // if it isn't a plain https:// page on a longlight.games game address.
  function originOf(value) {
    try {
      var url = new URL(String(value || ""));
      if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
      if (!/^[a-z0-9-]+\.longlight\.games$/.test(url.hostname)) return "";
      return url.origin;
    } catch (e) {
      return "";
    }
  }

  // A message from a bridge page → { stamp } (stamp may be null when the
  // game has none yet), or null if it isn't a bridge message at all.
  function readMessage(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    if (data.type !== MESSAGE_TYPE || data.v !== 1) return null;
    var size;
    try { size = JSON.stringify(data).length; } catch (e) { return null; }
    if (size > MAX_MESSAGE_CHARS) return null;
    var stamp = data.stamp;
    if (stamp == null) return { stamp: null };
    if (typeof stamp !== "object" || Array.isArray(stamp)) return null;
    return { stamp: stamp };
  }

  // Open a hidden frame for each bridge and collect what they send.
  //   entries: [{ id, url, origin }]  (origin from originOf)
  //   options.onStamp(id, stamp): called as each stamp arrives, so a fast
  //   game's stamp shows without waiting for a slow one.
  //   options.onDone(id): called once for each bridge, when it has answered
  //   (with a stamp or without) or run out of time. passport.js holds a
  //   stamp link for that game until then, so the game's own stamp is in
  //   place before a link's is looked at.
  // Resolves with [{ id, stamp }] for every bridge that answered with a
  // stamp, once each has answered or run out of time. Never rejects.
  function collect(entries, options) {
    var wait = (options && options.timeoutMs) || WAIT_MS;
    var onStamp = options && typeof options.onStamp === "function" ? options.onStamp : null;
    var onDone = options && typeof options.onDone === "function" ? options.onDone : null;
    return new Promise(function (resolve) {
      var open = [];
      var results = [];

      function finish(job) {
        var at = open.indexOf(job);
        if (at < 0) return;
        open.splice(at, 1);
        clearTimeout(job.timer);
        if (job.frame.parentNode) job.frame.parentNode.removeChild(job.frame);
        if (onDone) {
          try { onDone(job.id); } catch (e) { /* never stops the others */ }
        }
        if (!open.length) {
          window.removeEventListener("message", onMessage);
          resolve(results);
        }
      }

      function onMessage(event) {
        for (var i = 0; i < open.length; i++) {
          var job = open[i];
          if (event.source !== job.frame.contentWindow) continue;
          if (event.origin !== job.origin) return; // the right frame, the wrong address: ignore
          var message = readMessage(event.data);
          if (!message) return; // not a bridge message: keep waiting
          if (message.stamp) {
            results.push({ id: job.id, stamp: message.stamp });
            if (onStamp) {
              try { onStamp(job.id, message.stamp); } catch (e) { /* one bad stamp never stops the rest */ }
            }
          }
          finish(job);
          return;
        }
      }

      window.addEventListener("message", onMessage);
      (entries || []).forEach(function (entry) {
        if (!entry || !entry.origin || originOf(entry.url) !== entry.origin) return;
        var frame = document.createElement("iframe");
        frame.className = "pp-bridge";
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
        frame.setAttribute("aria-hidden", "true");
        frame.setAttribute("tabindex", "-1");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.title = "Passport bridge";
        var job = { id: entry.id, origin: entry.origin, frame: frame, timer: 0 };
        open.push(job);
        job.timer = setTimeout(function () { finish(job); }, wait);
        frame.src = entry.url;
        document.body.appendChild(frame);
      });
      if (!open.length) {
        window.removeEventListener("message", onMessage);
        resolve(results);
      }
    });
  }

  return {
    MESSAGE_TYPE: MESSAGE_TYPE,
    originOf: originOf,
    readMessage: readMessage,
    collect: collect,
  };
});

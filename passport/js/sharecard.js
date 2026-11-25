/* ==========================================================================
   Longlight Passport: the share card (passport/js/sharecard.js)
   --------------------------------------------------------------------------
   "Share my Passport" on passport.html makes a 1200 x 630 picture of the
   Passport and hands it to the phone's share sheet (or downloads it where
   there's no share sheet, as on most computers).

   What goes on the card: the names of the games stamped, how many games
   are stamped, how many studio badges are earned, the official Longlight
   logo from the press kit, and longlight.games/passport. Nothing else: no
   numbers from inside the games, no dates, nothing about the phone. The
   picture is made on this phone and never uploaded by the site.

   The words come from card() below, which Node can test. The drawing uses
   a canvas, so it only runs in a browser.
   Works as a plain <script> (window.LLPassportShare) and with require().
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LLPassportShare = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var WIDTH = 1200;
  var HEIGHT = 630;
  var MAX_NAMES = 8; // past this, the last pill reads "+ N more"
  var LOGO_URL = "assets/press/longlight-logo-dark.png"; // light letters, for the purple card
  var FONT = '"Space Grotesk", system-ui, sans-serif';
  var COLOURS = { purple: "#7B3FC4", ivory: "#FAF9F5", lilac: "#B48CE8", clay: "#D97757", ink: "#2A1A47" };

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  // The card's words, from the games on the site (in Kelbo's order), the
  // stored stamps and the badge results. Only games on the site count.
  //   games:  [{ id, name }]
  //   stamps: { "<game id>": stamp }
  //   badges: [{ earned }] (from LLPassportBadges.evaluate)
  function card(input) {
    var i = input || {};
    var games = Array.isArray(i.games) ? i.games : [];
    var stamps = i.stamps && typeof i.stamps === "object" ? i.stamps : {};
    var badges = Array.isArray(i.badges) ? i.badges : [];
    var names = games
      .filter(function (g) { return g && Object.prototype.hasOwnProperty.call(stamps, g.id); })
      .map(function (g) { return String(g.name || g.id).slice(0, 40); });
    var earned = badges.filter(function (b) { return b && b.earned; }).length;
    var shown = names.length > MAX_NAMES ? names.slice(0, MAX_NAMES - 1).concat("+ " + (names.length - MAX_NAMES + 1) + " more") : names;
    return {
      title: "PASSPORT",
      games: names.length + " of " + plural(games.length, "game", "games") + " stamped",
      badges: badges.length ? earned + " of " + badges.length + " studio badges" : "",
      names: shown,
      address: "longlight.games/passport",
      stamped: names.length,
    };
  }

  // ---- drawing (browser only) ------------------------------------------------

  var logoPromise = null;
  function loadLogo() {
    if (!logoPromise) {
      logoPromise = new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); }; // the card still works without it
        img.src = LOGO_URL;
      });
    }
    return logoPromise;
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load("700 96px " + FONT),
      document.fonts.load("500 32px " + FONT),
    ]).catch(function () {});
  }

  // A rounded rectangle path (roundRect isn't in every phone's canvas yet).
  function pill(ctx, x, y, w, h) {
    var r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.closePath();
  }

  function draw(canvas, words, logo) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    var ctx = canvas.getContext("2d");
    var left = 72;

    ctx.fillStyle = COLOURS.purple;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // The official lockup, untouched, top left.
    if (logo) {
      var logoW = 300;
      ctx.drawImage(logo, left, 56, logoW, Math.round((logoW * logo.naturalHeight) / logo.naturalWidth));
    }

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COLOURS.ivory;
    ctx.font = "700 92px " + FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "14px";
    ctx.fillText(words.title, left - 4, 268);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    ctx.font = "500 34px " + FONT;
    ctx.fillStyle = COLOURS.ivory;
    ctx.fillText(words.badges ? words.games + "  ·  " + words.badges : words.games, left, 326);

    // The stamped games as pills, wrapping onto a second or third row.
    ctx.font = "600 28px " + FONT;
    var x = left;
    var y = 372;
    var h = 52;
    var pad = 24;
    words.names.forEach(function (name) {
      var w = Math.ceil(ctx.measureText(name).width) + pad * 2;
      if (x + w > WIDTH - left && x > left) {
        x = left;
        y += h + 14;
      }
      if (y + h > 540) return; // out of room: stop quietly
      pill(ctx, x, y, w, h);
      ctx.fillStyle = "rgba(250, 249, 245, 0.12)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLOURS.lilac;
      ctx.stroke();
      ctx.fillStyle = COLOURS.ivory;
      ctx.fillText(name, x + pad, y + 35);
      x += w + 12;
    });

    // A long horizon line, then the address under it.
    ctx.fillStyle = COLOURS.lilac;
    ctx.fillRect(left, 560, WIDTH - left * 2, 3);
    ctx.fillStyle = COLOURS.ivory;
    ctx.font = "500 26px " + FONT;
    ctx.fillText(words.address, left, 602);
    return canvas;
  }

  // The card as a PNG file, ready to share.
  function make(words) {
    return Promise.all([loadLogo(), fontsReady()]).then(function (got) {
      var canvas = draw(document.createElement("canvas"), words, got[0]);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error("The picture couldn't be made."));
          try {
            resolve(new File([blob], "longlight-passport.png", { type: "image/png" }));
          } catch (e) {
            blob.name = "longlight-passport.png"; // very old browsers: no File()
            resolve(blob);
          }
        }, "image/png");
      });
    });
  }

  // Share sheet where there is one, else a download. Resolves to "shared",
  // "downloaded" or "cancelled".
  function share(file) {
    var files = [file];
    if (navigator.canShare && navigator.share && navigator.canShare({ files: files })) {
      return navigator.share({ files: files, title: "My Longlight Passport" }).then(
        function () { return "shared"; },
        function (err) {
          if (err && err.name === "AbortError") return "cancelled";
          return download(file);
        }
      );
    }
    return Promise.resolve(download(file));
  }

  function download(file) {
    var url = URL.createObjectURL(file);
    var a = document.createElement("a");
    a.href = url;
    a.download = "longlight-passport.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return "downloaded";
  }

  return { WIDTH: WIDTH, HEIGHT: HEIGHT, card: card, draw: draw, make: make, share: share };
});

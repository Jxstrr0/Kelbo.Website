/* The Passport test page's code (fake-stamp.html): builds a stamp from the
   form, packs it with ../js/codec.js, and shows the link a game's button
   would open. Text goes on the page with textContent only. */
(function () {
  "use strict";
  var form = document.querySelector("[data-fake-form]");
  var select = document.querySelector("[data-fake-games]");
  var out = document.querySelector("[data-fake-out]");
  var open = document.querySelector("[data-fake-open]");
  var Codec = window.LLPassportCodec;

  // Today's date as YYYY-MM-DD, in the phone's own time zone.
  var now = new Date();
  form.elements.updated.value = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);

  fetch("../registry.json", { cache: "no-cache" })
    .then(function (res) { return res.json(); })
    .then(function (registry) {
      registry.games.forEach(function (g) {
        var option = document.createElement("option");
        option.value = g.id;
        option.textContent = g.title;
        select.appendChild(option);
      });
    })
    .catch(function () { out.textContent = "The game list couldn't load."; });

  // A number if it reads as one, otherwise the text as typed.
  function valueOf(text) {
    var t = String(text).trim();
    return t !== "" && isFinite(Number(t)) ? Number(t) : t;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var f = form.elements;
    var stamp = { v: 1, game: f.game.value, ver: f.ver.value.trim(), updated: f.updated.value, stats: [] };
    if (f.headline.value.trim()) stamp.headline = f.headline.value.trim();
    [1, 2].forEach(function (n) {
      var label = f["label" + n].value.trim();
      if (!label) return;
      var stat = { id: "stat" + n, label: label, value: valueOf(f["value" + n].value) };
      if (f["unit" + n].value.trim()) stat.unit = f["unit" + n].value.trim();
      stamp.stats.push(stat);
    });
    if (f.career.checked) stamp.flags = ["career_complete"];
    Codec.encode(stamp)
      .then(function (code) {
        var link = new URL("../../passport.html#stamp=" + code, location.href).href;
        out.textContent = link;
        open.href = link;
        open.hidden = false;
      })
      .catch(function (err) {
        out.textContent = err && err.message ? err.message : "That stamp couldn't be packed.";
        open.hidden = true;
      });
  });
})();

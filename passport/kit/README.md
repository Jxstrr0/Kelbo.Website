# Longlight Passport kit

Everything a Longlight game needs to send its stamp to the
[Longlight Passport](https://longlight.games/passport). Copy the files in;
never import or hotlink them from the studio site. The full spec is
[`.github/PASSPORT.md`](../../.github/PASSPORT.md) in `Jxstrr0/Kelbo.Website`.
Each game's own instructions are in [`HANDOFF.md`](HANDOFF.md).

| File | What it is | Where it goes in the game |
| --- | --- | --- |
| `passport-stamp.js` | Makes, keeps and sends a stamp (classic JavaScript, sets `window.LonglightPassport`). | Next to the game's other scripts. |
| `passportStamp.ts` | The same as an ES module, for the TypeScript (Vite) games. | `src/`. |
| `passport-stamp.html` | The bridge page: the Passport opens it in a hidden frame to read the stamp. | The game's site root (`public/` in a Vite game), so it's served at `https://<game>.longlight.games/passport-stamp.html`. |

Copy them unchanged. The two script files already say where they came from at the top; when a newer kit comes out, copy the files in again.

## 1. Make and keep the stamp

Whenever the game saves (or at the end of a run, a season, a fight), build
the stamp and keep it under the game's **stamp key** (the table in
`HANDOFF.md`):

```js
// classic JS
var stamp = LonglightPassport.make({
  game: "pew",                       // the game's Passport id
  ver: VERSION,                      // numbers and dots
  headline: "Race-team career, season 4", // optional, up to 60 characters
  stats: [                           // 1 to 6
    { id: "best_hp", label: "Best engine", value: 1140, unit: "hp" },
    { id: "wins_24h", label: "24-hour wins", value: 2 }
  ],
  flags: ["career_complete"]         // optional, up to 8
});
LonglightPassport.save("pew2-passport", stamp);
```

```ts
// TypeScript
import { makeStamp, saveStamp, openPassport } from "./passportStamp";
const stamp = makeStamp({ game: "lombard", ver: VERSION, stats: [...] });
saveStamp("lombard.passport", stamp);
```

`make` / `makeStamp` checks the stamp against the Passport's rules and
returns `null` (with a console warning) if anything is off, so a mistake
shows up in the game, not as a refused stamp. `save` / `saveStamp` never
throws; it returns `false` if the browser won't save (private mode).

**What goes in a stamp:** headline numbers a player would be proud of.
**Never** save data, a name the player typed, a seed or anything personal.
A stamp is not a save code, and it isn't part of the game's backups: it is
rebuilt from the save the next time the game saves.

**Rules:** `game` is the game's Passport id. `ver` is the game's version
(numbers and dots). `headline` is at most 60 characters. Each stat has an
`id` (a-z, 0-9, `_`), a `label` of at most 32 characters, a `value` that is
a number or at most 24 characters of text, and an optional `unit` of at most
8. `flags` are at most 8 ids. At most 2 KB in all. Numbers stay numbers
(`1140`, not `"1,140"`): the Passport formats them, and badges compare them.

## 2. The button

Put an **"Add to Longlight Passport"** button where the game keeps its
studio pieces (the studio block on Credits or About, or Settings). It's a
studio piece, so the Longlight brand rules apply to it. On a tap:

```js
button.addEventListener("click", function () {
  var stamp = currentStamp();
  LonglightPassport.save("pew2-passport", stamp);   // the game's own stamp key
  LonglightPassport.open(stamp).catch(function () { /* say it didn't work */ });
});
```

Save the stamp first (step 1), then open the link, so the game's storage
and the link hold the same stamp: once the game's bridge is on, the
Passport reads the game's own stamp before it looks at the link, and asks
the player which to keep if the two differ.

`open` / `openPassport` opens the Passport in a new tab with the stamp in
the link (the browser only allows that straight from a tap, so call it in
the click handler itself, not after an `await`). The Passport shows "Stamp
added: <Game>". If `supported()` / `passportSupported()` is false (a very
old browser), hide the button.

An installed copy of a game (added to the home screen) opens the Passport
in the phone's browser, which is where the Passport keeps its stamps.

## 3. The bridge page (updates itself)

Copy `passport-stamp.html` to the game's site root and change **one line**,
the stamp key:

```html
<meta name="llp-stamp-key" content="pew2-passport">
```

Change nothing else: the page's security tag allows its script by
fingerprint, so any edit to the script stops it running. The page does
nothing unless the Passport opens it in a frame; then it reads that one key
and posts it to `https://longlight.games` only. If the game has a service
worker, it may cache this file like any other.

The Passport only opens a game's bridge once the studio site lists it
(`bridgeUrl` in `passport/registry.json` and the address in
`passport.html`'s `frame-src`). After the game's PR is live, tell the studio
site's session: "turn on the Passport bridge for <Game>".

## 4. Test it

1. Play until a stamp is saved, then check the key in the browser's
   storage (desktop dev tools, Application, Local Storage).
2. Tap the button: the Passport opens with "Stamp added: <Game>", and the
   game's page shows the headline and stats.
3. Play on, save, tap again: "Stamp updated". The same stamp twice says
   "Already stamped".
4. Once the bridge is on: play, then open https://longlight.games/passport
   directly. The stamp updates without the button.

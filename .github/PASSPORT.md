# Longlight Passport

A page on the studio site that shows one player's progress across every
Longlight game, like stamps in a passport. Each game writes a small **stamp**
(its name, version and up to six headline stats). The Passport collects the
stamps, shows one page per game, and gives **studio badges** that span games.

Everything stays on the player's phone. There is no server, no account, and
nothing is sent anywhere. Stamps run on trust: there are no leaderboards and
no cheat checks, and the page says so.

This file is the spec. It started as PR 0 (audit and spec, docs only), and
it changes whenever the Passport does. It lives in `.github/`, next to
`NOTES.md`, because this repo keeps its notes there and has no `docs/`
folder.

Status: **PR 6 done: launched** (25 November 2026). The page, stamp
links, the bridge, badges, the kit and the share card are all live, with
a Passport link in every footer and a Passport chip on the home page once
a phone has a stamp. **Prairie Engine Works is the first game with the
kit** (26 November 2026, its 1.76.143.0): it keeps its stamp under
`pew2-passport`, has the Add to Longlight Passport button, and its bridge
is on (`bridgeUrl` set, `https://pew.longlight.games` in `passport.html`'s
`frame-src`). The other games add the kit in their own sessions
(`passport/kit/HANDOFF.md`). **The iPhone check passed** (Kelbo, 26
November 2026, Safari on his iPhone: one dyno pull, then the Passport
picked up the stamp by itself; section 7, item 6), so each game's bridge
can now be turned on once its own bridge page is live.
Kelbo's answers are in section 7.

---

## 1. Audit: where everything lives (24 November 2026)

Checked by loading each address and following any redirects. No domains or
DNS were changed.

**The studio site** is served by GitHub Pages from this repo (the Deploy site
workflow), at `https://longlight.games`. `www.longlight.games` and the old
`jxstrr0.github.io/Kelbo.Website/` both forward there.

**Every game now has its own address under `longlight.games`**, also served
by GitHub Pages. The old `jxstrr0.github.io/<Repo>/` addresses forward to the
new ones (checked for 350Chev and Lombard). So every game is
**same-site** with the Passport, and every game can use both ways in (the
stamp link and the bridge, section 3).

| Game | Address | On the site? | Same-site? | Ways in |
| --- | --- | --- | --- | --- |
| Prairie Engine Works | `https://pew.longlight.games` | Yes | Yes | Link + bridge |
| Scrapline | `https://scrapline.longlight.games` | Yes | Yes | Link + bridge |
| Season Ticket | `https://seasonticket.longlight.games` | Yes | Yes | Link + bridge |
| Funded | `https://funded.longlight.games` | Yes | Yes | Link + bridge |
| Lombard | `https://lombard.longlight.games` | Yes | Yes | Link + bridge |
| Burn Rate | `https://burnrate.longlight.games` | Yes | Yes | Link + bridge |
| Frontier Lab | `https://frontierlab.longlight.games` | Hidden | Yes | Link + bridge |
| Hull Down | `https://hulldown.longlight.games` | Hidden | Yes | Link + bridge |
| Laminar | `https://laminar.longlight.games` | Hidden | Yes | Link + bridge |

What else the audit found:

- **Old saves stay behind.** Saves made before a game moved to its own
  address are still on `jxstrr0.github.io` (each game's CLAUDE.md says Kelbo
  accepted that). The Passport only sees stamps that a game writes at its
  current address.
- **Nothing stops the bridge's hidden frame.** No game sends
  `X-Frame-Options` or a `frame-ancestors` rule. Funded and Hull Down have a
  page policy on their own game page, but the bridge is its own small file,
  so that policy doesn't apply to it.
- **The studio site has a page policy on every page** (the
  `Content-Security-Policy` tag, kept up to date by
  `.github/scripts/csp-hashes.mjs`). The Passport page's policy must list
  each game's address in `frame-src`, one by one with no wildcard, and must
  add nothing to `connect-src`.
- **Same-site frames see the game's real storage.** Chrome, Firefox and
  Safari split storage only for cross-site frames. A frame from
  `pew.longlight.games` inside `longlight.games` is the same site, so it reads
  PEW's own localStorage. **Checked on an iPhone in Safari** (26 November
  2026, with Prairie Engine Works' live bridge). The link stays the way in
  that always works.
- **The service worker is already fixed.** `sw.js` has deleted only
  `longlight-*` caches since 7 November (it is now `longlight-4`), so the
  plan's service worker question is settled. The Passport page goes in
  `CORE` and `sitemap.xml` like any other top-level page.
- **No test runner yet.** The repo's checks are plain Node scripts in
  `.github/scripts/`. The Passport's tests are `node:test` files there
  (`passport.test.mjs`), with no packages, run by the Site check.
- **The site is flat pages** (`games.html`, `about.html`...) with relative
  links. GitHub Pages serves `passport.html` at `/passport` as well, so the
  page can match the rest of the site and still have a clean address.

---

## 2. Files

The plan's layout, adjusted to fit how this repo is built:

| File | What it is |
| --- | --- |
| `passport.html` | The page, at `https://longlight.games/passport`. |
| `passport/passport.js`, `passport/passport.css` | The page's code and styles. |
| `passport/registry.json` | Passport-only details per game: `id`, `stampKey`, `bridgeUrl` (or `null`), `accent`. The name, address, status and `hidden` come from `projects.json` (one source of truth), so a hidden game never shows here either. |
| `passport/badges.json` | Badge rules, checked on the phone (section 5). |
| `passport/js/codec.js` | Turns a stamp into an `LLP1.` code and back. |
| `passport/js/validate.js` | The strict stamp check (section 4). |
| `passport/js/bridge.js` | Listens to the hidden game frames. |
| `passport/kit/` | Files a game copies in: `passport-stamp.js` (classic JS), `passportStamp.ts` (TypeScript), `passport-stamp.html` (the bridge page), `README.md` (how to add them), and `HANDOFF.md` (a paragraph to paste into each game's session). |
| `passport/dev/fake-stamp.html` | A pretend game page for testing both ways in. |
| `.github/scripts/passport.test.mjs` | `node:test` tests for the codec, the stamp check and the badges. |

**The Passport's own storage:** `kelbo.passport.stamps` (every stamp, keyed
by game, as `{ "games": { "<id>": stamp }, "updates": <n> }`, where
`updates` counts the times a newer stamp replaced an older one, for the
Regular badge) and `kelbo.passport.seen` (which badges have shown their
"new" toast). Stamps read back from storage go through the stamp check
again, one by one, so a stamp that can't be read is left out and the rest
still show. "Remove all stamps" clears `kelbo.passport.*` and nothing else.

---

## 3. Two ways in

### A. The stamp link (always works)

The game's "Add to Longlight Passport" button opens:

`https://longlight.games/passport#stamp=<code>`

- `<code>` is `LLP1.` + base64url(deflate(JSON)) + `.` + a 7-character
  checksum (FNV-1a in base 36), the same shape as Lombard's `LMB1.` codes.
  Compression uses the browser's `CompressionStream("deflate-raw")`.
- The part after `#` never reaches a server, GitHub's included.
- The Passport removes the `#...` from the address bar
  (`history.replaceState`) the moment its script runs, before the visit
  counter can see the address, then checks the code. A game's first stamp
  is stored and a toast says "Stamp added: <Game>" (or why it was refused).
- **A link never replaces a stamp by itself** (security test, 25 Nov 2026:
  a stranger's link dated tomorrow replaced a real stamp, and the real one
  was then "older"). When the game already has a stamp and the link holds a
  different one, the page asks "Replace your <Game> stamp?", shows both
  (date, version, headline), says whether the link's is newer or older, and
  waits for **Keep mine** (where the focus starts; Esc does the same) or
  **Replace**. Replace works for an older stamp too, which is how a real
  stamp takes back its place. The same stamp again says "Already stamped".
  A link that arrives while the question is open is skipped, and a toast
  says so after. `updates` only counts a Replace that was truly newer.
- **A link waits for the game's own stamp** (security test, 26 Nov 2026,
  the first day with a live bridge: a stranger's link dated today, with a
  huge version, was taken as the game's first stamp a moment before the
  bridge answered, and the game's own stamp then counted as older, on that
  visit and the next ones). When the link's game has a bridge, the link is
  held until that bridge has answered or run out of time (3 seconds at
  most; a game with no bridge isn't held at all). If the game's own stamp
  arrived, the link is treated like any link over a stamp you already
  have: the same stamp says nothing more, a different one asks. So a
  game's button should save the stamp (`save`) before it opens the link
  (`open`), which is what the kit's README says.
- **Never in a frame.** If another page puts the Passport inside a frame,
  it shows "The Passport only opens as its own page" with a link, and
  takes no stamp link, opens no bridge and draws no stamps or buttons. A
  stranger's site already saw an empty Passport in a frame (phones keep a
  framed page's storage apart), but a page on another longlight.games
  address saw the real one, and could hide it and steer a tap onto Replace.
- A stamp is dated no later than tomorrow on the phone's clock (time zones),
  so a wrong date in a game can't block every later update. `ver` is
  numbers and dots, compared number by number.
- Unpacking stops past 2 KB, so a small code can't unpack into something
  huge.

### B. The bridge (updates itself)

Each game hosts `passport-stamp.html` (no dependencies, under 2 KB). It reads
the game's own stamp key and sends it to the Passport with `postMessage`.

- The Passport opens a hidden frame for each game whose registry entry has a
  `bridgeUrl`, waits up to 3 seconds for each, and keeps whatever arrives.
- **Both sides check the address.** The stamp page only posts to
  `https://longlight.games`. The Passport only accepts a message whose
  `event.origin` is that game's address in the registry.
- A missing or slow bridge is skipped quietly, never shown as an error.

How it's built (PR 3):

- **The bridge page** is `passport/kit/passport-stamp.html` (about 1.3 KB).
  A game copies it to its site root and changes one line, the
  `<meta name="llp-stamp-key">`, to its own stamp key. The script itself
  never changes, so the fingerprint in the page's own security tag
  (`default-src 'none'`) stays right. It does nothing unless it's inside a
  frame, reads that one key, and posts
  `{ type: "llp-stamp", v: 1, stamp }` to `https://longlight.games` only.
- **The Passport side** is `passport/js/bridge.js`. The frames are
  sandboxed (`allow-scripts allow-same-origin`: they run and read their
  own storage, nothing else) and removed once answered or timed out. A
  message counts only if it comes from that frame, from that game's exact
  address, in that shape, and under 4 KB. Each stamp shows as it arrives.
- **passport.js** checks each stamp like a linked one and refuses it unless
  it names the game whose frame sent it, so one game can't stamp for
  another. A newer stamp replaces the old one without asking, since it
  came from the game's own address (and counts toward `updates`); so does
  the game's stamp when the stored one is dated after today, which a real
  stamp never is. A toast says which stamps were added or updated.
  `collect` tells passport.js when each game's bridge is done (`onDone`),
  which is when a held stamp link for that game goes ahead (section 3A).
- **Turning a game's bridge on** takes two edits in this repo: its
  `bridgeUrl` in `passport/registry.json`, and its exact address in
  `passport.html`'s `frame-src`. The Site check fails if the address is
  missing, if `frame-src` lists anything else, or if a `bridgeUrl` isn't an
  https page on a `longlight.games` game address.
- **Tested** in Chromium with every address pretended (two games with
  bridges, one game trying to stamp for another, one bridge that never
  answers, a newer stamp, a visit with nothing new), and on Kelbo's iPhone
  in Safari with Prairie Engine Works' live bridge (26 November 2026,
  passed; section 7, item 6).

---

## 4. The stamp (version 1)

```json
{
  "v": 1,
  "game": "pew",
  "ver": "1.76.142.2",
  "updated": "2026-11-24",
  "headline": "Race-team career, season 4",
  "stats": [
    { "id": "best_hp", "label": "Best engine", "value": 1140, "unit": "hp" },
    { "id": "wins_24h", "label": "24-hour wins", "value": 2 }
  ],
  "flags": ["career_complete"]
}
```

Rules:

- At most **2 KB** of JSON. Anything bigger is refused.
- Headline numbers only: **no save data, no names a player typed, no seeds,
  nothing personal.** A stamp is not a save code.
- `game` must be in the registry. `headline` is optional, at most 60
  characters. `stats` has 1 to 6 items. `label` is at most 32 characters,
  `unit` at most 8, and `value` is a number or a string of at most 24
  characters. `flags` is optional, at most 8 short ids.
- Unknown fields are ignored. An unknown `v` gets a friendly note: "This
  stamp is from a newer version of the Passport."
- A newer `updated` (or the same date with a newer `ver`) makes a stamp the
  newer one. From the bridge, a newer stamp replaces the stored one. From a
  link, the page asks first (section 3A).
- A number of a quadrillion or more is shown short ("1.00 × 10^20"), and
  long labels and values wrap, so a made-up stamp can't stretch its page.
- Every string is drawn with `textContent`, **never** `innerHTML`.

Each game keeps its stamp in **localStorage under its own prefix** (the
bridge reads localStorage only, so even IndexedDB games keep the stamp
there):

| Game | Stamp key |
| --- | --- |
| Prairie Engine Works | `pew2-passport` |
| Scrapline | `scr-passport` |
| Season Ticket | `seasonticket.passport` |
| Funded | `funded.passport` |
| Lombard | `lombard.passport` |
| Burn Rate | `brn-passport` |
| Frontier Lab | `frontierlab.passport` |
| Hull Down | `hulldown.passport` |
| Laminar | `laminar.passport` |

A new key is a new localStorage key in that game. Scrapline and Burn Rate's
rules say to ask Kelbo before adding one, so their sessions ask first.

---

## 5. Badges

Badge rules are data in `passport/badges.json`, checked on the phone:

- `{ "type": "gamesStamped", "min": 5 }`
- `{ "type": "stat", "game": "pew", "stat": "best_hp", "gte": 1000 }`
- `{ "type": "flag", "flag": "career_complete", "minGames": 2 }`

Two more kinds: `{ "type": "gamesStamped", "all": true }` (every game on
the site) and `{ "type": "updates", "min": 5 }` (stamps updated 5 times).
A `flag` rule names one `game` or a `minGames` count.

The starter set is Kelbo's eight (section 7, item 3). Two of them need a
game to send a set id, which the kit's handoff paragraphs (PR 5) ask for:

| Badge | Rule | What a game sends |
| --- | --- | --- |
| First Light | `gamesStamped` min 1 | any stamp |
| Three on the Horizon | `gamesStamped` min 3 | |
| Long Light | `gamesStamped` min 5 | |
| Full Sky | `gamesStamped` all | |
| Closing Time | `flag` `career_complete`, minGames 2 | the flag `career_complete` once a career is finished |
| Thousand Horses | `stat` pew `best_hp` gte 1000 | PEW: a number stat `best_hp`, in hp |
| Title Fight | `flag` scrapline `open_won` | Scrapline: the flag `open_won` |
| Regular | `updates` min 5 | (counted by the Passport) |

How it's built (PR 4):

- `passport/js/badges.js`: `rules(json)` tidies `badges.json` (a badge with
  an unknown or broken rule, no name, or an id used twice is left out, so a
  typo never breaks the page) and `evaluate(badges, { stamps, gameIds,
  updates })` says which are earned, with `have` and `need` for the
  progress line ("2 of 3 games", "Best so far: 840 of 1,000").
- **Only games on the site count**, so a hidden game's stamp is kept but
  earns nothing, and Full Sky means every game a visitor can see. When a
  hidden game goes on the site, its stamp starts counting.
- **The shelf** sits under the booklet: all eight, earned ones lit (a clay
  half sun in a purple ring, drawn in CSS), the rest faint with their
  progress. A toast names each badge the first time it's earned, after the
  stamp's own toast; `kelbo.passport.seen` remembers which have been shown.

---

## 6. The plan, PR by PR

| PR | What |
| --- | --- |
| 0 | This audit and spec. **Stop for Kelbo's OK.** |
| 1 | The page: cover, an empty stamp for every game on the site, "How this works", brand and both themes. No nav link yet. |
| 2 | Stamp links: codec, stamp check, `#stamp=` intake, storage, toast, replace and ignore rules, tests, and a dev link builder. |
| 3 | The bridge, with address checks and time limits, tested against `passport/dev/fake-stamp.html` and on an iPhone. |
| 4 | Badges: the checker and the starter set, with tests. |
| 5 | The kit for games, plus a ready-to-paste handoff paragraph per game. |
| 6 | Polish and launch: share card, nav link, the home page chip if wanted. |

Game repos aren't touched from the studio site's session. PR 5 ends with a
handoff paragraph per game for its own session.

How the kit is built (PR 5):

- `passport-stamp.js` (classic, sets `window.LonglightPassport`) and
  `passportStamp.ts` (an ES module) do the same four things: `make` checks
  a stamp against section 4's rules and returns `null` with a console
  warning if it's wrong, `save` keeps it under the game's key, `link` builds
  the `#stamp=` link, and `open` opens the Passport in a new tab straight
  from a tap (the tab opens at once, so browsers allow it, and the game
  page goes there instead if new tabs are blocked). The code is the same
  `LLP1.` code as `passport/js/codec.js`.
- Neither file calls out, touches any key but the one it's handed, or
  writes markup. The tests check that, that their limits match the
  Passport's, and that a stamp made by either (the TypeScript one through
  Node's own type stripping) arrives in the Passport unchanged.
- Tested in Chromium with a pretend game page: make, save, tap, and the
  Passport showed "Stamp added" and then the badges, with the new tab cut
  off from the game (`opener` is null).
- `HANDOFF.md` has a paragraph per game. Each one names the files, the
  stamp key, where the button goes, that game's own rules (asking Kelbo
  before a new key in Scrapline and Burn Rate, Lombard's IndexedDB, Burn
  Rate's content rule, Funded's page policy), stat ideas, and the last
  step: ask the studio site's session to turn the bridge on.

How the launch pieces are built (PR 6):

- **Share card.** `passport/js/sharecard.js` (`window.LLPassportShare`).
  `card()` works out the words: "PASSPORT", "N of M games stamped",
  "N of M studio badges", the names of the stamped games on the site (up
  to 8, the last one "+ N more" past that) and longlight.games/passport.
  Nothing from inside a stamp goes on it (a test checks). `draw()` paints
  it on a 1200 x 630 canvas: purple, the press kit's light-letter logo PNG
  untouched, Space Grotesk, lilac pills, a horizon line. `share()` uses the
  share sheet when the phone can share files and downloads the PNG
  otherwise. passport.js makes the picture ahead whenever the words
  change, so the share sheet opens straight from the tap (Safari refuses
  `navigator.share` once the tap is too old). The button and its note
  ("Nothing from inside the games goes on it") show once there's a stamp.
- **Nav link.** Not in the header: a fifth item drops the menu to a second
  row at 360 and 390 px (measured). Instead every page's footer list has
  "Passport", between Gallery and Press kit.
- **Home chip.** "Passport N stamps" in the hero's ticker strip, a link to
  passport.html (`setUpPassportChip` in `main.js`). It reads
  `kelbo.passport.stamps` and, only when that has a stamp, fetches
  `passport/registry.json` to count stamps from games on the site (so a
  hidden game's stamp isn't counted). Hidden with no stamps. It writes
  nothing.

---

## 7. Kelbo's decisions (24 November 2026)

1. **Address and name:** `https://longlight.games/passport`, a flat
   `passport.html` like every other page, named **Longlight Passport**.
2. **First games:** all six games on the site get stamps first: Prairie
   Engine Works, Scrapline, Season Ticket, Funded, Lombard and Burn Rate.
   Hidden games follow when they go on the site.
3. **Starter badges:** all eight, as named:
   - **First Light:** your first stamp.
   - **Three on the Horizon:** stamps from 3 games.
   - **Long Light:** stamps from 5 games.
   - **Full Sky:** a stamp from every game on the site.
   - **Closing Time:** finished a career in 2 games.
   - **Thousand Horses:** a 1,000 hp engine in Prairie Engine Works.
   - **Title Fight:** won the Scrapline Open.
   - **Regular:** came back and updated stamps 5 times.
4. **Home page chip:** yes. "Your Passport: N stamps" in the ticker strip,
   shown only once a visitor has at least one stamp (launch PR).
5. **Service worker:** already fixed (section 1), nothing to decide.
6. **The bridge's iPhone check** (25 November 2026): done with the first
   real game, when it adds its bridge page in PR 5. Kelbo tests that game
   on his iPhone in Safari before any other game turns its bridge on.
   **Passed** on 26 November 2026 with Prairie Engine Works (1.76.143.0):
   the stamp appeared by itself after one dyno pull.

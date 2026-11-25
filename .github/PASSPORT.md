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

Status: **PR 3 done** (the bridge, ready and tested in Chromium; no game
has a bridge page yet, so every `bridgeUrl` is still `null` and no frame
opens). The iPhone check waits for a bridge on a real game address
(section 3B). Kelbo's answers are in section 7. Next: PR 4, badges.

---

## 1. Audit: where everything lives (24 November 2026)

Checked by loading each address and following any redirects. No domains or
DNS were changed.

**The studio site** is served by GitHub Pages from this repo (the Deploy site
workflow), at `https://longlight.games`. `www.longlight.games` and the old
`jxstrr0.github.io/Kelbo.Website/` both forward there.

**Every game now has its own address under `longlight.games`**, also served
by GitHub Pages. The old `jxstrr0.github.io/<Repo>/` addresses forward to the
new ones (checked for 350Chev, Lombard and The-Whip). So every game is
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
| Outwash | `https://outwash.longlight.games` | Hidden | Yes | Link + bridge |
| The Whip | `https://thewhip.longlight.games` | Hidden | Yes | Link + bridge |

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
  PEW's own localStorage. **This has to be checked on an iPhone in Safari in
  PR 3** before the bridge is relied on. The link stays the way in that
  always works.
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
| `passport/kit/` | Files a game copies in: `passport-stamp.js` (classic JS), `passportStamp.ts` (TypeScript), `passport-stamp.html` (the bridge page), `README.md`. |
| `passport/dev/fake-stamp.html` | A pretend game page for testing both ways in. |
| `.github/scripts/passport.test.mjs` | `node:test` tests for the codec, the stamp check and the badges. |

**The Passport's own storage:** `kelbo.passport.stamps` (every stamp, keyed
by game, as `{ "games": { "<id>": stamp }, "updates": <n> }`, where
`updates` counts the times a newer stamp replaced an older one, for the
Regular badge) and `kelbo.passport.seen` (which badges have shown their
"new" toast). Stamps read back from storage go through the stamp check
again. "Remove all stamps" clears `kelbo.passport.*` and nothing else.

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
  counter can see the address, then checks the code, stores the stamp and
  shows "Stamp added: <Game>" (or "updated", "already stamped", "older
  stamp", or why it was refused).
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
  another. A newer stamp replaces the old one (and counts toward
  `updates`); a toast says which stamps were added or updated.
- **Turning a game's bridge on** takes two edits in this repo: its
  `bridgeUrl` in `passport/registry.json`, and its exact address in
  `passport.html`'s `frame-src`. The Site check fails if the address is
  missing, if `frame-src` lists anything else, or if a `bridgeUrl` isn't an
  https page on a `longlight.games` game address.
- **Tested** in Chromium with every address pretended (two games with
  bridges, one game trying to stamp for another, one bridge that never
  answers, a newer stamp, a visit with nothing new). **Still to check:**
  an iPhone in Safari, once one real game address serves the bridge page.

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
- A newer `updated` (or the same date with a newer `ver`) replaces the stored
  stamp. An older one is ignored.
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
| Outwash | `outwash.passport` |
| The Whip | `whip:passport` |

A new key is a new localStorage key in that game. Scrapline and Burn Rate's
rules say to ask Kelbo before adding one, so their sessions ask first.

---

## 5. Badges

Badge rules are data in `passport/badges.json`, checked on the phone:

- `{ "type": "gamesStamped", "min": 5 }`
- `{ "type": "stat", "game": "pew", "stat": "best_hp", "gte": 1000 }`
- `{ "type": "flag", "flag": "career_complete", "minGames": 2 }`

The starter set is 6 to 8 badges, with names Kelbo approves (section 7).

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

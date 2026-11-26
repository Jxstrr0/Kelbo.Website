# Passport handoffs, one per game

Each section below is a paragraph to paste into **that game's own Claude
session**. The studio site's session never changes a game repo. Each game
follows its own CLAUDE.md for branches, versions, checks and merging.

The six games on the site come first (Kelbo, 24 Nov 2026). Hidden games
follow when they go on the site.

**The first game to add its bridge page is the iPhone test** (Kelbo, 25 Nov
2026, spec section 7, item 6). Once it's live, Kelbo opens the Passport on
his iPhone in Safari and checks the stamp updates on its own. Until that
passes, no other game's bridge is turned on in the studio site. Every
game's stamp link and button can ship before then. **Passed** (26 Nov
2026, with Prairie Engine Works): a game's bridge can now be turned on as
soon as its bridge page is live.

Every paragraph ends with the same last step: once the game's PR is live,
tell the studio site's session "turn on the Passport bridge for <Game>".
That session sets the game's `bridgeUrl` in `passport/registry.json` and
adds its address to `passport.html`'s `frame-src`.

| Game | Repo | Passport id | Stamp key | Kit file |
| --- | --- | --- | --- | --- |
| Prairie Engine Works | `Jxstrr0/350Chev` | `pew` | `pew2-passport` | `passport-stamp.js` |
| Scrapline | `Jxstrr0/Scrapline` | `scrapline` | `scr-passport` | `passport-stamp.js` |
| Season Ticket | `Jxstrr0/SeasonTicket` | `seasonticket` | `seasonticket.passport` | `passportStamp.ts` |
| Funded | `Jxstrr0/Funded` | `funded` | `funded.passport` | `passport-stamp.js` |
| Lombard | `Jxstrr0/Lombard` | `lombard` | `lombard.passport` | `passportStamp.ts` |
| Burn Rate | `Jxstrr0/BurnRate` | `burnrate` | `brn-passport` | `passport-stamp.js` |
| Frontier Lab (hidden) | `Jxstrr0/FrontierLab` | `frontierlab` | `frontierlab.passport` | `passportStamp.ts` |
| Hull Down (hidden) | `Jxstrr0/hull-down` | `hulldown` | `hulldown.passport` | `passportStamp.ts` |
| Laminar (hidden) | `Jxstrr0/Laminar` | `laminar` | `laminar.passport` | `passportStamp.ts` |
| Outwash (hidden) | `Jxstrr0/Outwash` | `outwash` | `outwash.passport` | `passportStamp.ts` |

Two of Kelbo's badges need a game to send something exact:
**Thousand Horses** reads PEW's number stat `best_hp` (in hp), and **Title
Fight** reads Scrapline's flag `open_won`. **Closing Time** reads the flag
`career_complete` from any two games, so each game decides with Kelbo what
"a finished career" means there. The stat ideas below are only ideas: the
game's session picks with Kelbo, at most six.

---

## Prairie Engine Works

> Add the Longlight Passport to Prairie Engine Works. Read
> `passport/kit/README.md` and `.github/PASSPORT.md` in `Jxstrr0/Kelbo.Website`
> (read-only; never change that repo from here), then copy in
> `passport/kit/passport-stamp.js` (as a new `src/` file in
> `src/manifest.txt`, or however this repo adds a script) and
> `passport/kit/passport-stamp.html` (to the repo root, served at
> `https://pew.longlight.games/passport-stamp.html`, with its
> `llp-stamp-key` meta set to `pew2-passport`; change nothing else in it).
> On every save, build a stamp with `LonglightPassport.make({ game: "pew",
> ver: VERSION, ... })` and keep it with `LonglightPassport.save("pew2-passport",
> stamp)`. It **must** include a number stat `best_hp` ("Best engine", unit
> `hp`): the best dyno figure the player has pulled, any mode. That number
> drives the studio's Thousand Horses badge. Ideas for the rest (six at
> most): best quarter-mile pass, team seasons supplied, reputation, engines
> certified, 24 Hours wins. Ask Kelbo what counts as a finished career for
> the `career_complete` flag (for example, the first shop retired into the
> Legacy record). The stamp is not a save key: it's rebuilt on every save,
> so it stays out of `buMake`/`buWrite` and the backups (confirm with Kelbo,
> since this repo's rules list its storage keys). Add an "Add to Longlight
> Passport" button to the studio block (Help or About), calling
> `LonglightPassport.open(stamp)` straight from the tap; it's a studio
> piece, so the Longlight brand rules apply. Bump the feature number of
> `VERSION`, run the three checks, and add a line to `docs/DESIGN.md`. Then
> tell the studio site's session: "turn on the Passport bridge for Prairie
> Engine Works".

## Scrapline

> Add the Longlight Passport to Scrapline. Read `passport/kit/README.md` and
> `.github/PASSPORT.md` in `Jxstrr0/Kelbo.Website` (read-only), then **ask
> Kelbo first**: this needs a new localStorage key, `scr-passport` (this
> repo's rule is to stop and ask before adding a key). The stamp is not part
> of the save (it's rebuilt from it on every save), so suggest leaving it
> out of `buMake`/`buWrite` and `KEYS` in `check-savecode.js`, and let Kelbo
> decide. Once he says yes, copy in `passport/kit/passport-stamp.js` (as a
> new `src/` file in `src/manifest.txt`) and `passport/kit/passport-stamp.html`
> (to the repo root, with its `llp-stamp-key` meta set to `scr-passport`;
> change nothing else). On every save, build the stamp with
> `LonglightPassport.make({ game: "scrapline", ver: VERSION, ... })` and keep
> it with `LonglightPassport.save("scr-passport", stamp)`. Set the flag
> `open_won` once the career has won the Scrapline Open (`crTitle().wins`
> is not empty): it drives the studio's Title Fight badge. Ideas for the
> stats: fights won, events won, Open titles, legend level, school medals.
> Ask Kelbo what counts as a finished career for `career_complete` (for
> example, a career that ended into the Hall of fame). Add an "Add to
> Longlight Passport" button to the studio block (Settings or the credits),
> calling `LonglightPassport.open(stamp)` from the tap. Bump the third
> number of `VERSION`, run every check, add the release to
> `docs/HISTORY.md`. Then tell the studio site's session: "turn on the
> Passport bridge for Scrapline".

## Season Ticket

> Add the Longlight Passport to Season Ticket. Read `passport/kit/README.md`
> and `.github/PASSPORT.md` in `Jxstrr0/Kelbo.Website` (read-only), then copy
> in `passport/kit/passportStamp.ts` (to `src/ui/career/`, not `src/sim`:
> it uses the browser) and `passport/kit/passport-stamp.html` (to `public/`,
> so it's served at `https://seasonticket.longlight.games/passport-stamp.html`,
> with its `llp-stamp-key` meta set to `seasonticket.passport`; change
> nothing else). The stamp is a per-device key like the settings, never part
> of the save: write it with `saveStamp("seasonticket.passport", makeStamp({
> game: "seasonticket", ver: <the player-facing version>, ... }))` whenever
> the career saves, inside the usual try/catch. Ideas for the stats:
> seasons played, league titles, best finish, biggest win, stadium
> capacity. No names the player typed (a renamed club or stadium stays
> out). Ask Kelbo what counts as a finished career for `career_complete`
> (for example, a first league title) and record it in the decisions log.
> Put the button's words in `src/data` like all text, and the "Add to
> Longlight Passport" button in the studio block on Credits, calling
> `openPassport(stamp)` straight from the tap. Add the bridge page to the
> service worker's file list if it lists `public/` files. Bump the version
> in `src/data/meta/version.json` with a What's new line, run `npm test`
> and `npm run build`. Then tell the studio site's session: "turn on the
> Passport bridge for Season Ticket".

## Funded

> Add the Longlight Passport to Funded. Read `passport/kit/README.md` and
> `.github/PASSPORT.md` in `Jxstrr0/Kelbo.Website` (read-only), then copy in
> `passport/kit/passport-stamp.js` (to `js/`, loaded as a classic
> `<script src>` before the modules; it sets `window.LonglightPassport`)
> and `passport/kit/passport-stamp.html` (to the repo root, with its
> `llp-stamp-key` meta set to `funded.passport`; change nothing else). The
> game's page policy needs no change: the script comes from the game itself,
> the button only opens a new tab, and the bridge page carries its own
> policy. Add both files to `CORE` in `sw.js` (and `tests/sw.test.js`).
> Keep the stamp under `funded.passport` (it follows the `funded.` rule)
> with `LonglightPassport.save("funded.passport", LonglightPassport.make({
> game: "funded", ver: VERSION, ... }))` after each day and each career end,
> from the career record (`js/meta.js`). Ideas for the stats: careers,
> evals passed, highest tier, best day, days traded, Daily streak. Ask Kelbo
> what counts as a finished career for `career_complete` (for example,
> reaching the Funded phase by passing Tier 3). Add an "Add to Longlight
> Passport" button to the stats card or the title's studio link, calling
> `LonglightPassport.open(stamp)` from the tap. Bump `VERSION`, run `node
> --test tests/*.test.js`, check at 380×760. Then tell the studio site's
> session: "turn on the Passport bridge for Funded".

## Lombard

> Add the Longlight Passport to Lombard. Read `passport/kit/README.md` and
> `.github/PASSPORT.md` in `Jxstrr0/Kelbo.Website` (read-only), then copy in
> `passport/kit/passportStamp.ts` (to `src/ui/` or `src/persist/`, never
> `src/game/`: it uses the browser) and `passport/kit/passport-stamp.html`
> (to `public/`, with its `llp-stamp-key` meta set to `lombard.passport`;
> change nothing else). Saves live in IndexedDB, but the bridge page can
> only read localStorage, so the stamp goes in localStorage under
> `lombard.passport`: note that in `docs/05-OPEN-DECISIONS.md` and confirm it
> with Kelbo. Write it with `saveStamp("lombard.passport", makeStamp({ game:
> "lombard", ver: __GAME_VERSION__, ... }))` whenever the career autosaves.
> Ideas for the stats: days open, deals made, best flip, reputation, items
> appraised. Ask Kelbo what counts as a finished career for
> `career_complete` (the story's ending, if it has one). Add an "Add to
> Longlight Passport" button to Settings or the title, calling
> `openPassport(stamp)` straight from the tap. This is a link out, not an
> API call, so the no-external-calls rule still holds. Bump `VERSION` (a
> Minor), run test, lint and shots, and look at the screenshots. Then tell
> the studio site's session: "turn on the Passport bridge for Lombard".

## Burn Rate

> Add the Longlight Passport to Burn Rate. Read `passport/kit/README.md` and
> `.github/PASSPORT.md` in `Jxstrr0/Kelbo.Website` (read-only), then **ask
> Kelbo first**: this needs a new localStorage key, `brn-passport` (this
> repo's rule is to stop and ask before adding one). The stamp isn't a save
> key and isn't backed up; it's rebuilt on every save. Once he says yes,
> copy in `passport/kit/passport-stamp.js` (as a new `src/` file in
> `src/manifest.txt`) and `passport/kit/passport-stamp.html` (to the repo
> root, with its `llp-stamp-key` meta set to `brn-passport`; change nothing
> else). On every save, `LonglightPassport.save("brn-passport",
> LonglightPassport.make({ game: "burnrate", ver: VERSION, ... }))`. Stamps
> follow the hard content rule: performance numbers only, never anything
> about propellants beyond a grade's name. Ideas for the stats: contracts
> delivered, firings, best total impulse (N·s), highest tier, incident
> reports. Ask Kelbo what counts as a finished career for
> `career_complete`. Add an "Add to Longlight Passport" button to the about
> block, calling `LonglightPassport.open(stamp)` from the tap. Bump the
> third number of `VERSION`, run the CI scripts, tick it in
> `docs/PROGRESS.md`. Then tell the studio site's session: "turn on the
> Passport bridge for Burn Rate".

---

## Hidden games (when they go on the site)

The same steps, with each repo's own rules:

- **Frontier Lab:** `passportStamp.ts`. Its rule is that only
  `src/sim/save/` touches localStorage, so `saveStamp` is called from
  there. Key `frontierlab.passport`; the bridge page goes in `public/`.
- **Hull Down:** `passportStamp.ts`; key `hulldown.passport`; the bridge
  page goes in `public/`. The built page's policy
  (`scripts/page-policy.mjs`) covers `index.html` only, and the bridge page
  has its own, so nothing needs adding there.
- **Laminar:** `passportStamp.ts`; key `laminar.passport`; the bridge page
  in `public/`; the button's words in `src/data`.
- **Outwash:** `passportStamp.ts`; key `outwash.passport`; the bridge page
  in `public/`; the button's words in `src/data/strings.ts`.

A hidden game's stamp is kept by the Passport but not shown, and earns no
badge, until the game goes on the site (`"hidden": false` in
`projects.json`).

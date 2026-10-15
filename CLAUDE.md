# Notes for Claude

Kelbo's personal site, hosted on GitHub Pages from the `main` branch root.
Live at https://jxstrr0.github.io/Kelbo.Website/

## Working on this repo

- **Auto-merge is allowed.** Once a change is pushed, the PR is open, and
  nothing is failing, merge it yourself without asking first.
- **Every change must end up on `main`**, because that's what goes live.
  Work on a branch, open a PR, merge it into `main`, then check the live
  site updated.
- Kelbo is a beginner+ coder and mostly on his phone. Explain changes in
  plain language and keep code readable, with comments on anything
  non-obvious. He may edit files in the GitHub web or mobile editor.
- Only publish personal details Kelbo has approved. The site is public.
- **The site uses the name Kelbo only.** Never put his real first or last
  name (or his initials) anywhere on the site, in page text, titles, `og:`
  tags, alt text, comments, or the link preview image.
- **The site is branded Longlight Interactive** (his studio). Page titles,
  `og:` tags, the header lockup (LONGLIGHT / INTERACTIVE), the home hero and
  the footer all say Longlight Interactive. Everything personal about Kelbo
  lives on `about.html`, linked from "by Kelbo" under the hero name (the one
  place the site says "by Kelbo"), every footer, and the nav
  on wide screens (`nav__wide`, 64rem+). Studio pages (home, Games, AI,
  Projects) speak as Longlight; Trading, the journal and Agent Fleet stay in
  his own first-person voice.

## Hard rules

- **Static only:** plain HTML, CSS, and vanilla JS. No frameworks, npm,
  bundlers, or build step.
- **No secrets.** The repo is public. Never commit API keys, tokens, or
  passwords. If a tool needs a key, talk through options with Kelbo first.
- Mobile first (works down to 360px wide), light and dark themes with
  every colour in CSS variables (`data-theme` on `<html>`, set by `main.js`
  from the real sun; `prefers-color-scheme` is only the fallback before JS
  runs, so page CSS must handle both), accessible
  (semantic HTML, visible focus, good contrast, alt text,
  `prefers-reduced-motion`).
- Use relative links only, because the site lives under `/Kelbo.Website/`
  and may move to a custom domain later. The exceptions are the `og:`
  link-preview tags and the `canonical` tag in each page's `<head>`, plus
  `robots.txt` and `sitemap.xml`, which must be absolute; update them all
  if the domain changes. Add new pages to `sitemap.xml`. `404.html` is the other exception: GitHub
  serves it at any missing address, however deep, so a small script in its
  `<head>` adds a `<base>` pointing at the site's top folder before any
  links load. Keep that script first in the `<head>`.
- The link preview image is `assets/social-preview.jpg` (1200×630, the
  Longlight sky, the sun with its glow and halo on the horizon line,
  "Longlight Interactive", plus the four game covers). Every `og:image`
  ends `?v=2` so apps refetch it; bump it on every page when the picture
  changes. Regenerate it if the covers change a lot. The favicon and
  home-screen icons are the logo's sun (glow, halo, sun) on an ivory line
  on a purple tile (the favicon turns slate in dark mode):
  `assets/icon.svg` (square source), `icon-180.png` (square), `icon-192/512`
  (rounded tile), `icon-maskable-512.png` (art inside the middle 80%) and
  `site.webmanifest`. Every page's `<head>` links the favicon and
  apple-touch-icon with `?v=3` (the manifest's icons too); bump it
  everywhere when they change.
- Footers read "© year Kelbo / Longlight Interactive" because the studio
  name isn't a registered business yet.

## Where things live

- `projects.json` is the single source of truth for projects. `main.js`
  renders it. Adding a project should never need an HTML edit. Each project
  can carry a `version` ("1.4", no "v") and `latest` (what changed), shown
  as "v1.4 · Added night mode" under the summary; either may be "".
- `now.json` feeds the "Now building" strip under the home hero (`updated`
  date plus `items`, each `text` with an optional `link`). Empty items hide
  the strip. Refresh it when Kelbo says what he's working on.
- The status labels and progress-bar fill amounts are in `STATUSES` at the
  top of `main.js`.
- The look is the Longlight Interactive "Horizon" brand: a half-set clay
  sun on a long horizon line. Five colours only (Clay #D97757, Purple
  #7B3FC4, Slate #141413, Ivory #FAF9F5, Lilac #B48CE8) as `--ll-*` tokens at
  the top of `style.css`; one font, Space Grotesk 500/700. Light theme =
  purple sky (hero, page heads, header, footer) with ivory body; dark theme
  = slate. Clay text on the purple sky is too faint, so keep clay for the
  sun, buttons and underlines there. Game covers live in `assets/covers/`
  (640×480 JPG, captured from each live game; Red Skies is portrait-only, so
  it's shot at 600px wide mid-shift with a jet on the TV camera, cropped 4:3).
- The live horizon (`[data-horizon]` in the home hero, every page head and
  the 404) puts the sun where the real sun is over Saskatoon (`YXE` in
  `main.js`, no network), switches to the dark theme at real sunset, and
  warms the sky toward clay over the last 20 minutes before it (`--warm`).
  Preview any time with `?at=noon|sunrise|sunset|dusk|night` or
  `?at=2026-06-21T21:30`. The ray's reach scales with the season
  (`seasonOf`, from day length; `--season` on `<html>`), and
  `solsticeToday` shows the `[data-horizon-badge]` pill on the home hero on
  the longest and shortest days. On the first page of a visit and on every
  refresh, `spinSun` plays the last 24 hours in `SPIN_MS` (4.5 s) so the
  sun does a full day before landing on now (`sessionStorage["kelbo.sunSpun"]`,
  `.horizon--spin` turns off the CSS easing; skipped with reduce motion).
  `placeSun` is the one place the sun gets positioned; it also calls
  `placeMoon`, which puts the clay moon (`.horizon__moon`, glow via
  drop-shadow) where the real moon is: `moonAltitude` (low-precision lunar
  theory + parallax, within ~0.2° of a full ephemeris; rise/set within a
  minute) and `moonSpanAt` (cached current stretch above/below the
  horizon: prev/next crossing, peak) map it like the sun, left to right
  across its time up, height as a share of this pass's peak, drifting back
  under the ground while down. It's night-only: `--moon-show` (opacity)
  fades it in as the sun drops from +6° to -2° and out the same at dawn,
  so they overlap briefly at dusk and dawn; missing on nights the real
  moon is down. Its shape is the real phase: `moonPhase` (moon-sun elongation, good to a few hours) feeds
  `moonPath`, an SVG drawn into the moon by `drawMoon` (faint
  `.moon__dark` disc + `.moon__lit`; waxing lit on the right). At night
  the readout's left side is `moonLine` ("Waxing crescent moon over
  Saskatoon", or "... moon rises 2:31 PM" while it's down) and the right
  side "Sun's back at 7:34 AM".
  `placeSun` also calls `placeStars`: the real sky from `STARS` (the
  named bright stars from PyEphem's catalogue, J2000 RA/Dec + magnitude,
  dec > -38° so they can rise here), alt/az from local sidereal time,
  shown facing south (az 90..270 → left..right, alt/`STAR_TOP_ALT` →
  height, hidden below 2° or in the north). `makeStars` swaps the HTML's
  placeholder dots for sized ones (`--s`, `.star--bright` halo); page
  heads only get magnitude ≤ 2. The home sky also gets
  `CONSTELLATION_LINES` (pairs of `STARS` names) drawn in
  `.horizon__lines`, an SVG stretched over the sky (viewBox 0..100 =
  the dots' percentages, non-scaling stroke); a line hides unless both
  stars are up. `PLANETS` (JPL approximate Keplerian elements +
  `EARTH_ORBIT`; `orbitXYZ`, `planetRaDec`, within ~0.1°) are placed the
  same way as `b.planet` dots (steady, ivory, Mars clay; name `span`
  on the home sky only, flipped left near the right edge).
  `placeSun` also sets `--sun-low` (0 high, 1 near the horizon: bigger,
  stronger glow), `--sun-show` (fades the glow/halo out once set, so they
  don't peek over the short page-head sky) and `--glint-sun`/`--glint-moon`
  (the `.horizon__glint` shimmer on the ground under each). The sun's halo
  is an `outline` with `outline-offset`, its glow is `::before`. Motion
  (sun-breathe, moon-float, glint-flow/sway, twinkle) is in the
  reduced-motion-safe block. The ☀/☾ button cycles auto → light → dark and is
  saved in `localStorage["kelbo.theme"]`; a tiny inline script in every
  page's `<head>` applies it before paint. The home page also has the
  "Continue?" memory card (`kelbo.lastPlayed`, `kelbo.visits`, set when any
  Play button is tapped) and the NYSE market light on the Trading tile.
- Motion lives at the bottom of `style.css`, all inside
  `prefers-reduced-motion: no-preference`; `main.js` handles scroll reveal
  and smooth filtering (FLIP) and skips both when reduce motion is on. Content must never depend on JS or
  motion to become visible.
- Tools live in `tools/<name>/` with their own `index.html`, CSS, and JS,
  reusing `../../style.css`. They run in the browser only (localStorage,
  no server), so their data stays on the visitor's device.
- Sections: `games.html`, `trading.html`, and `ai.html` each list the
  projects whose `category` matches the list's `data-category` (Game,
  Trading, AI). The home page tiles link to them and show counts.
- Games each live in their own repo with their own GitHub Pages site
  (GarageToGlory, RedSkies, BaccaratTable, 350Chev). This site only links to
  them via `link` (the pink Play it button) and `code` (the repo). The home
  page "Pick a game" cards are the `featured` projects (max 4); on phones
  all but the first are shortened (16:9 picture, two-line summary).
- The logo is the horizon lockup: the sun on a line running under
  LONGLIGHT, INTERACTIVE justified to the same width below. It's inline SVG
  with the letters outlined to paths (don't swap them back to live text),
  coloured by `.logo__sun/line/word/sub` and `--logo-line` (ivory light,
  lilac dark), plus `.logo__glow` (a blurred sun copy using the
  `#logo-glow` filter, defined once per page in the footer lockup's
  `<defs>` because the footer is never hidden) and `.logo__halo` (a thin
  clay ring). On load the sun, halo and glow rise out of the line
  (`logo-rise`/`logo-fade`, in the reduced-motion-safe block); hover lifts
  the sun. Sizes: compact 3.4rem, header lockup 13.8rem, footer
  min(19rem, 80vw). The ray is retired from the logo and only lives in the
  hero's live horizon. Below 40rem the header shows `.logo--compact` (sun +
  short line), from 40rem `.logo--full`; the footer always shows the full
  lockup.
- The header (the logo as home, the nav Games, Trading, AI, Projects, plus
  About from 64rem, and the ☀/☾ button) is copied in every page and only
  just fits at 360px, where only the compact mark shows. Test before adding
  to it. The parked tracker doesn't load
  `main.js` (its names clash), so it has no ☀/☾ button or live sun.
- The AI Trading Journal is `journal.html` + `journal.js` + `journal.css`,
  with entries in `journal.json` (a list, newest first by `date`). The
  record is calculated from each call's `grade` (hit/partial/miss, null =
  not graded) and each trade's `result` (percent; missing = open). The
  field list is at the top of `journal.js`. Entries can be long forecasts
  (calls, scenarios, levels, sectors, schedule, plan); copy their content
  faithfully and only fill in grades and the recap when Kelbo reports them.
  Kelbo updates it periodically; when he sends views or trades, write the
  entry and an honest "ai" coach note. Never invent trades or results, and
  prefer percentages over dollar amounts. `journal.js` borrows `el()` and
  `reveal()` from `main.js`, so load `main.js` first.
- Write every "ai" coach note in a general voice, not to Kelbo: judge the
  trade or idea ("winners averaged +21.5%", "holding overnight without a
  planned exit was the mistake"), never "you" or "your". Same honesty, same
  specifics.
- Options trades live in `options.json` (fields at the top of `journal.js`),
  copied from Kelbo's own options ledger. The page works out each return
  from `paid`/`sold` premiums and feeds the record's options group. Leave
  out contract counts and dollar P&L. When he sends new trades, add them
  oldest first, bump `updated`, and refresh the `ai` coach note honestly.
- The weekly scan on `agent-fleet.html` is `scan.json` (fields at the top
  of `scan.js`). A Claude Code routine on Kelbo's own Claude plan ("Longlight
  weekly scan", Saturdays 8:55 am America/Regina) rewrites it from web
  searches and merges it, so no API key exists for it. When running as that
  routine: only touch `scan.json`, use real figures from sources found that
  run (list them in `sources`), never guess a number, and leave out anything
  that can't be confirmed.
- The Prediction Tracker in `tools/prediction-tracker/` is parked: still in
  the repo but removed from `projects.json` (README has the block to
  restore it).
- The home page contact form posts to Web3Forms, which emails Kelbo. Its
  `access_key` in `index.html` is public by design (it can only send him a
  message); never put his email address in the site. Web3Forms rejects
  server-side posts, so test it from a real browser on the live site.
- `README.md` is Kelbo's plain-English editing guide. Keep it up to date
  when how things work changes.

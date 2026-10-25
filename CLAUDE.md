# Notes for Claude

Kelbo's personal site, hosted on GitHub Pages. `.github/workflows/deploy.yml`
publishes it on every push to `main` (and every 6 hours, to pick up game
releases).
Live at https://jxstrr0.github.io/Kelbo.Website/

## Working on this repo

- **Auto-merge is allowed.** Once a change is pushed, the PR is open, and
  the **Site check** has passed (green), merge it yourself without asking
  first. If it's red, read the run's summary, fix the problems on the same
  branch, and wait for green. Run `node .github/scripts/check-site.mjs`
  before pushing to catch them early.
- After merging, the **Deploy site** run must go green before the live site
  changes. If it fails, the live site keeps the last good version; fix it.
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

## Commits

Author commits as the owner so they count on their GitHub profile. At the
start of a session, run `git config user.name "Jxstrr0"` and
`git config user.email "322161611+Jxstrr0@users.noreply.github.com"`, and
keep the Co-Authored-By trailer for Claude in each message.

## Hard rules

- **Static only:** plain HTML, CSS, and vanilla JS. No frameworks, npm,
  bundlers, or build step. The deploy workflow publishes the files as-is;
  the only things it changes are each game's `version` and `latest`, filled
  in from that game's newest GitHub Release (see below), and the
  `game-<slug>.html` copies of `game.html` it adds (`make-game-pages.mjs`,
  see below). The three scripts in
  `.github/scripts/` are plain Node with no packages; keep them that way.
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
  "Longlight Interactive", plus the four featured game covers in a 2×2
  grid: Vault Street, Prairie Engine Works, Season Ticket, The Whip). Every `og:image`
  ends `?v=15` so apps refetch it; bump it on every page when the picture
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
  renders it. Its order is the display order everywhere (Games, Projects,
  What's new, home featured, "More games"): Kelbo's own ranking, games
  first: Vault Street, Prairie Engine Works, Season Ticket, The Whip, Garage to Glory,
  Outpost, Red Skies, Baccarat. Nothing sorts by progress except the
  Projects page's filter buttons (`sortByProgress`). Adding a project should never need an HTML edit. Each project
  can carry a `version` ("1.4", no "v") and `latest` (what changed), shown
  as "v1.4 · Added night mode" under the summary; either may be "".
  For games whose `code` repo has GitHub Releases, the deploy fills these
  in from the newest release (tag `v1.4` → `"1.4"`, release title →
  `latest`), so the live values can be newer than this file. Don't "fix"
  that by hand. Prefer publishing a release in the game's repo; editing
  them here is the fallback for games without releases.
  It can also carry `shots` (`[{src, alt}]`, files in `assets/shots/`,
  about 360px tall JPG, under 40 KB): `renderProject` makes a closed
  `<details class="shots">` "Screenshots (N)" with a scroll-snap strip of
  lazy images, all `12rem` tall so portrait and landscape mix. Hidden on
  the home featured list by CSS; the What's new rows don't show it.
- Whole cards are tappable: the main link (`.project__main`) stretches an
  invisible `::after` over its `.project` or `.news` card; the other links
  and `.shots` sit above it (`z-index: 2`). On a game that main link is
  "About this game" (its info page), so "Play it" is a separate button; on
  other projects it's "Take a look".
  Don't put a `transform` on `.project__main`, it would shrink that layer.
- `game.html?g=<slug>` is one game's own page (`setUpGame` in `main.js`,
  slug from `projectSlug(title)`, e.g. `prairie-engine-works`). Games' cards
  link to `gamePage(title)`, `game-<slug>.html`: the deploy writes one per
  game into `_site` (`.github/scripts/make-game-pages.mjs`, after
  `sync-releases.mjs`), a copy of `game.html` with that game's title,
  summary, cover (640×480) and address in the `<head>` and `data-game` on
  the box, and adds them to the deployed `sitemap.xml`. They never exist
  in the repo, so test them with a `_site` copy; the Site check makes them
  too. `404.html` sends a missing `game-<slug>.html` to `game.html?g=`. Cards
  link to it ("About this game →"). It shows the cover, status, summary,
  version, the Play and code buttons, "Play here" (`openPlayer`: the game's
  `link` in a full-screen `.player` iframe with a slate bar of Full screen
  where `requestFullscreen` exists, New tab and Close; it pushes a history
  step so Back closes it, and removing the frame stops the game), an optional `story` (paragraphs split
  on blank lines), all `shots` open in a strip, and the other games. It sets
  the tab title and description in JS; link-preview crawlers don't run JS, so
  only the `game-<slug>.html` copies show the game's own link preview.
  `game.html` itself is not in `sitemap.xml`; it is in `sw.js` `CORE`.
- `now.json` feeds the "Now building" strip under the home hero (`updated`
  date plus `items`, each `text` with an optional `link`). Empty items hide
  the strip. Refresh it when Kelbo says what he's working on.
- The status labels, progress-bar fill amounts and colour stages are in
  `STATUSES` at the top of `main.js`: Complete, Released (solid clay pill),
  Live (clay outline), Polishing, In development, Prototype (purple),
  Concept (lilac outline). Each has `old` names from before October 2026
  that still work. Keep `KNOWN_STATUS` in `check-site.mjs` in step.
- The look is the Longlight Interactive "Horizon" brand: a half-set clay
  sun on a long horizon line. Five colours only (Clay #D97757, Purple
  #7B3FC4, Slate #141413, Ivory #FAF9F5, Lilac #B48CE8) as `--ll-*` tokens at
  the top of `style.css`; one font, Space Grotesk 500/700, self-hosted (the
  variable woff2 files in `assets/fonts/`, `@font-face` at the top of
  `style.css`, the latin file preloaded in every page's `<head>`; no Google
  Fonts, no other font host). Light theme =
  purple sky (hero, page heads, header, footer) with ivory body; dark theme
  = slate. Clay text on the purple sky is too faint, so keep clay for the
  sun, buttons and underlines there. Game covers live in `assets/covers/`
  (640×480 JPG, captured from each live game; Red Skies is portrait-only, so
  it's shot at 600px wide mid-shift with a jet on the TV camera, cropped 4:3;
  Prairie Engine Works is the GM LT4 6.2 from the game's own studio render,
  `ENGINE_VIS.photoShot(1280, 960)`, so no stray parts show; Season Ticket is
  the game's dusk title scene at 1024×768, with every element except the 3D
  canvas hidden, cropped 4:3).
- The live horizon (`[data-horizon]` in the home hero, every page head and
  the 404) puts the sun where the real sun is over Saskatoon (`YXE` in
  `main.js`, no network; only the optional weather, air quality and aurora fetch), switches to the dark theme at real sunset, and
  warms the sky toward clay over the last 20 minutes before it (`--warm`).
  Preview any time with `?at=noon|sunrise|sunset|dusk|night` or
  `?at=2026-06-21T21:30`. The ray's reach scales with the season
  (`seasonOf`, from day length; `--season` on `<html>`), and
  `solsticeToday` shows the `[data-horizon-badge]` pill on the home hero on
  the longest and shortest days. On the first page of a visit and on every
  refresh, `spinSun` plays the last 24 hours in `SPIN_MS` (4.5 s) so the
  sun does a full day before landing on now (`sessionStorage["kelbo.sunSpun"]`,
  `.horizon--spin` turns off the CSS easing; skipped with reduce motion).
  `setUpSwipe` lets a sideways swipe (finger, or left-button mouse drag
  with `cursor: grab`/`.horizon--grabbing` on fine pointers) on the horizon
  scrub time (`SWIPE_HOURS` per width, clamped to `SWIPE_MAX_HOURS`,
  finger right = later); `paint(t, ahead)` in `setUpHorizon` redraws sky,
  theme and readout (`swipeLine`) for that moment. On release `glide`
  coasts at the flick's speed (from the last ~100 ms of moves), slowing
  with time constant `SWIPE_GLIDE_MS`, then it holds
  for `SWIPE_HOLD_MS` (a new swipe picks up from there) then eases back to
  now in `SWIPE_BACK_MS`. `swiping` pauses the minute tick;
  `skyRun` lets a swipe cut off the spin. `.horizon` has
  `touch-action: pan-y pinch-zoom` so vertical scrolling still works.
  `placeSun` is the one place the sun gets positioned; it also calls
  `placeMoon`, which puts the clay moon (`.horizon__moon`, glow via
  drop-shadow) where the real moon is: `moonAltitude` (low-precision lunar
  theory + parallax, within ~0.2° of a full ephemeris; rise/set within a
  minute) and `moonSpanAt` (cached current stretch above/below the
  horizon: prev/next crossing, peak) map it like the sun, left to right
  across its time up, height as a share of this pass's peak, drifting back
  under the ground while down. `--moon-show` (opacity) is 1 at night and
  faint by day (up to 0.32, less for thin crescents), changing over as
  the sun drops from +6° to -2° (and back at dawn); `--moon-day` turns
  the lit part pale (color-mix toward ivory) and drops the glow and
  ground glint by day. Missing on nights the real moon is down. Its shape is the real phase: `moonPhase` (moon-sun elongation, good to a few hours) feeds
  `moonPath`, an SVG drawn into the moon by `drawMoon` (faint
  `.moon__dark` disc + `.moon__lit`; waxing lit on the right). At night
  the readout's left side is `moonLine` ("Waxing crescent moon over
  Saskatoon", or "... moon rises 2:31 PM" while it's down) and the right
  side "Sun's back at 7:34 AM". The left side takes turns every
  `READOUT_TURN_MS` (`takeTurns`, `setLine` fades it in) with
  `dayLengthLine` (today vs yesterday to the second, from `sunDay().length`)
  by day and `lightHourLine` (golden hour -4°..6°, blue hour -6°..-4°)
  around sunrise and sunset.
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
  Shooting stars: `setUpMeteors` rolls dice every 500 ms (dark theme,
  sun below -8°, not spinning/swiping, off with reduce motion) from
  `meteorRate`: strays (`METEOR_EVERY_S`) plus the active `SHOWERS` entry
  (`showerAt`; rate from zhr, distance from the peak and the radiant's
  height via `altAz`), shower meteors flying away from the radiant's
  screen spot. They're `.meteor` streaks in `.horizon__meteors`, animated
  with the Web Animations API; `showerLine` joins the night readout.
  `setUpSkyTaps` (click on the scene, ignored right after a swipe or hold
  via `lastSkyDrag`) shows `.horizon__tip` for the nearest sun, moon,
  planet or star (`STAR_LY` light-travel years, `planetDistanceAU`,
  `sunDistanceAU`), or counts a wish in `localStorage["kelbo.wishes"]`
  if a meteor just flew there (`caughtMeteor`). In `setUpSwipe`, a still
  press of `HOLD_START_MS` (any pointer) eases `shown` to `nextTurn`
  (next sunset +35 min, or sunrise +25 min) over `HOLD_RUN_MS`; release
  calls `slideBack`. `setUpSwipe` returns the shown time for the taps.
  Weather, air and aurora (the only network calls, all free/no key, cached in
  localStorage by `cachedFetch`): `loadWeather` (Open-Meteo current
  weather_code, cloud_cover, cloud_cover_high, temperature_2m, snow_depth,
  wind_speed_10m, wind_direction_10m, relative_humidity_2m, precipitation,
  plus hourly precipitation for the past 2 h as `wet`; every
  `WEATHER_MS`), `loadAir` (Open-Meteo air quality current pm2_5 into
  `pm25`) and `loadKp` (NOAA SWPC planetary_k_index_1m, highest
  estimated_kp of the last 30 minutes, since each 3-hour block starts at 0;
  `KP_MS`). All are skipped with `?at=` (unless
  `?weather=`/`?kp=` previews are given; `WEATHER_PREVIEWS` rows can carry
  extra fields such as temp, high, wind, wet or pm, read via
  `weatherPreview`) and fail silently; code reading the newer fields must
  check `Number.isFinite`, since an older cached entry lacks them. `setUpWeather`
  adds `.horizon__aurora`, `.horizon__clouds`, `.horizon__precip`,
  `.horizon__optics` and `.horizon__snowline`; `paintWeather` (from `paint`) toggles
  `horizon--rain/snow/storm/fog/overcast/snowy/hot/crocus/wheat/gold`, sets `--aurora`
  (`auroraStrength`: Kp 4+ at night, not overcast), `--smoke` and `--wind`, and builds `.cloud`s
  (only when the code or cover changes, so they don't jump).
  Lightning toggles `horizon--flash`. `weatherLine` and `auroraLine` join
  the readout turns. `snowOnGround` falls back to the calendar.
  The day sky: `sunDogStrength` (0..1; ≤ −10°C, high cloud ≥ 10% or
  ≤ −25°C, sun 0..35°) and `rainbowStrength` (0..1; `wet`, cloud < 85,
  sun 1..40°), both 0 without weather; `smokeStrength` (0..1 from `pm25`,
  the separate air feed, from `SMOKE_PM`; day or night) and `heatShimmer`
  (true/false, `HOT_C`, sun up); `sunHidden` is overcast or any weather kind.
  `placeOptics` (from `placeSun`) sets `--sundogs`, `--rainbow`, `--bow-x`
  (1 − sun x, pushed out past the sun's side when the outer bow would
  reach it; sizes in `scene.sky`, measured once like `scene.land`) and
  `--bow-d` (sun alt / 42) for `.horizon__sundogs`
  (centred on the sun, `--dog-pad` wider than the ring each side so its
  mask doesn't cut off the dogs) and `.horizon__rainbow` inside `.horizon__optics`
  (clip-path polygon clips top and bottom only, so they run to the screen
  edges; its `::before` is the full-bleed smoke haze). `--smoke` also
  darkens the sun and drops its halo/glow. Heat shimmer (wavy masked
  line, rippling air on `.horizon__ground::before`, wavering elevator)
  is motion-only. Readout extras: `rainbowLine`, `sunDogLine`,
  `shadowLine`, `smokeLine`.
  Winter ground: `frostSparkle` (snow lying, ≤ −10°C, cloud < 40, not
  `sunHidden`, sun 0..25°, before noon) shows `.horizon__frost` (two masked
  tiles of ivory glints over the ground, twinkling) via `horizon--frost`;
  `snowDrift` (snow lying, known wind ≥ 25 km/h, ≤ 0°C or temp unknown)
  shows `.horizon__drift` (a masked strip of ivory streaks across the
  horizon line, sliding along `--drift-dir` = `breeze().dir`, faster with
  `--wind`) via `horizon--drift`. Both toggle in `paintWeather` before the
  unchanged-weather early return, motion only in the no-preference block.
  `frostLine` and `driftLine` join the readout turns. Preview with
  `?weather=frost&at=2026-12-15T09:30` or `?weather=drift&at=2026-12-15T13:00`.
  The railway: `.horizon__depot` (SVG from `DEPOT`, 40 × 22 box, a third
  the elevator's height, just right of it, with its own `.elevator__light`
  window after dark) and `.horizon__track` (a full-bleed rail line with
  sleepers just under the horizon, z1). `placeShadow` casts both outlines
  (`scene.shadowShape`, `scene.depotShape`; `scene.land` holds both
  measurements). `train()` in `setUpCritters` (every ~`TRAIN_EVERY_S`,
  any hour; `?critter=train`) runs a `.train` SVG (loco + 9 to 14 cars,
  headlight after dark) inside a full-bleed `.train-path` after the track,
  flipped with scaleX for the other direction; `scene.trainRunning` feeds
  the depot's tap ("Longlight Station"). Motion only: with reduce motion
  the depot and track stay, there's no train.
  Tapping the elevator (`targets` in `setUpSkyTaps`) names it and says
  what its shadow is doing (`elevatorFact`; `compassName` is shared with
  `rainbowLine`). The aurora is lilac and purple with a thin ivory glow in
  each curtain: the palette has no green, so don't add it without Kelbo's say.
  The land (`setUpLand`, every sky): `.horizon__elevator` (SVG from
  `ELEVATOR` outline in an 86 × 72 box, z1, its main-house peak
  (`ELEVATOR_MID` 30) standing at the sun's noon x, 0.38; modelled on a
  real wooden elevator: steep-gabled main house, taller narrow leg
  house, sloping annex, cyclone, loading spout and scale shed. Thin
  extras (`ELEVATOR_BITS`: dust pipe, prop, utility pole) are separate
  paths in the same fill that cast no shadow; `.elevator__door` is a
  darker barn-door panel; three `.elevator__light` windows glow clay in
  the dark theme. If the box size or `ELEVATOR_MID` changes, update the
  `30 / 72`, `86 / 72` and depot `56 / 72` (= W − MID) numbers in
  `style.css` too) and `.horizon__shadow` (a
  full-bleed SVG over the ground strip): `placeShadow` (from `placeSun`)
  projects each outline point by its height × 1/tan(alt) away from the
  sun's azimuth (`sunAltAz`, with `seenAltitude` adding refraction; east =
  left, north = down × `SHADOW_SQUASH`),
  measuring the elevator once into `scene.land` (reset when the sky or
  the window resizes); `shadowStrength` sets `--land-shadow` (z2, over
  the snow band). `groundSeason`
  (`YXE.home`, not snowy) switches `.horizon__crocuses` (Apr 1 to May 5)
  and `.horizon__wheat` (young Jun–Jul, gold Aug 1 to Sep 15; masked
  stalk pattern, sways with `--wind`). The palette has no green, so young
  wheat is pale lilac-ivory.
  `setUpCritters` (off with reduce motion; its full-bleed box sits after
  `.horizon__moon`, so they pass in front of the sun): `.geese` V's
  (SVG, flapping) every ~`GEESE_EVERY_S` in `geeseTime`, `.firefly`
  dots in `firefliesTime`, `.leaf`s in `leavesTime` (Sep–Oct, `YXE.home`;
  speed and direction from `breeze`, which defaults to 12 km/h from 290°),
  a `.jet` every ~`JET_EVERY_S` in `jetTime` with a `.contrail` of
  overlapping dashes that each fade over `contrailLinger` (3 s warm/dry
  up to 30 s cold/damp), a circling `.hawk` (`HAWK_EVERY_S`, `hawkTime` =
  `windyAfternoon` on weekdays, Apr–Oct at home; `windyAfternoon` = known
  wind ≥ 20 km/h, 12–6 PM, sun ≥ 8° and not hidden, ≥ 3°C or temp
  unknown) and a `.kite` (SVG, sways about its string's ground end) when
  `windyAfternoon` falls on a weekend (`kiteTime`). `?critter=geese|fireflies|leaves|jet|hawk|kite|train`
  forces one. In `setUpSkyTaps`, `puffCloud` (light theme, not reduce
  motion) breaks a tapped `.cloud` into `.cloud-puff`s and restarts its
  drift from the left; a tap right on the sun or moon still names it.
  Eclipses: `moonRaDec` (geocentric moon with the main Meeus terms,
  ~0.06° vs PyEphem, plus parallax) feeds `eclipseAt`: lunar when the
  moon touches the umbra (1.02 × (parallax + 0.00244 − sun radius)),
  solar from the topocentric moon (Saskatoon at 486 m); both give the
  covered share (`covered`) and the offset in moon/sun radii
  (`skyOffset`, south-facing). `visibleEclipse` needs the body up;
  `placeEclipse` (from `placeSun`) moves `.moon__shadow` (an SVG circle
  clipped to the moon) and sets `--eclipse`, or shows `.sun__bite` (a
  sky-coloured disc in `.sun__disc`). `eclipseLine` (now, or the next
  20 h via cached `nextEclipse`) leads the readout turns. The moon glow's
  `--glow-k` fades it by day and in an eclipse.
  Your sky: `[data-sky-switch]` in the home hero eyebrow
  (`setUpSkySwitch`) saves geolocation rounded to 0.1° in
  `localStorage["kelbo.sky"]` and reloads; a block right after `YXE`
  swaps its lat/lon/tz (the phone's zone), `elev` 0 and `home: false`
  before anything runs. So all sky code must read `YXE` (never hard-code
  Saskatoon): `zoneMidnight` gives local midnight in `YXE.tz`, `overHere`
  the readout wording, `dayLengthFor` the season range, `auroraKp` the
  Kp needed from magnetic latitude (4 for Saskatoon). Geese, fireflies,
  calendar snow, leaves, crocuses and wheat check `YXE.home`. `?at=` reads Saskatoon time
  (UTC-6), or the phone's time in your own sky.
  `placeSun` also sets `--sun-low` (0 high, 1 near the horizon: bigger,
  stronger glow), `--sun-show` (fades the glow/halo out once set, so they
  don't peek over the short page-head sky) and `--glint-sun`/`--glint-moon`
  (the `.horizon__glint` shimmer on the ground under each). The sun's halo
  is an `outline` with `outline-offset`, its glow is `::before`; the disc
  is a radial gradient from `--sun-base` (paler core, darker rim) with an
  inset ivory rim and a tight `box-shadow` glow, and `::after` is the fine
  rays (a `repeating-conic-gradient` masked to a ring). Motion
  (sun-breathe, sun-rays, moon-float, glint-flow/sway, twinkle) is in the
  reduced-motion-safe block. The ☀/☾ button cycles auto → light → dark and is
  saved in `localStorage["kelbo.theme"]`; a tiny inline script in every
  page's `<head>` applies it before paint. The home page also has the
  "Continue?" memory card (`kelbo.lastPlayed`, `kelbo.visits`, set when any
  Play button is tapped) and the NYSE market light on the Trading tile.
- Tilt sky: `setUpMotion` (home hero `[data-motion-switch]`, shown only
  with `pointer: coarse` and DeviceOrientationEvent; iPhone
  `requestPermission` after the tap; choice in `localStorage["kelbo.motion"]`,
  so page-head skies follow too). Tilt sets `--tilt-x/--tilt-y` (-1..1,
  `TILT_DEG`, "level" drifts with `TILT_SETTLE`); the translate rules on
  stars, meteors, aurora, moon and clouds are in the no-preference block.
  The compass (`webkitCompassHeading`, or 360 − alpha on Android's
  `deviceorientationabsolute`) sets `skyFacing`; star, planet and meteor
  radiant x always go through `skyX(az)` (180 = south, never hard-code
  `(az - 90) / 180`). It adds `.horizon__facing` ("Facing north", home only)
  and `horizon--sun-behind`/`horizon--moon-behind` (dimmed).
- Sky this week (`[data-sky-week]` under the Now strip, home only):
  `skyWeek(t)` steps the 7 days from local midnight hourly: tonight's
  planets (sunset + 1 h, alt > 6°, > `GLARE_DEG` from the sun), moon
  quarters (`FULL_MOON_NAMES` by month), moon–planet passes under
  `NEAR_MOON_DEG` and planet pairs under `NEAR_PLANETS_DEG` (geocentric,
  with `viewing` picking after dark / before dawn), equinoxes and
  solstices, `SHOWERS` peaks, `visibleEclipse` every 15 min, and the
  sunset trend. `skyGap` returns degrees. `showWishes` renders the wish
  count and `WISH_BADGES` (a badge also shows in the tap tip).
- Offline: `sw.js` (root, registered in `init`) precaches `CORE` and is
  network-first for same-origin GETs (saved copy on failure, `index.html`
  for unknown pages offline). Bump `CACHE`
  if it ever serves stale files; add new top-level pages to `CORE`.
- Page changes: cross-document view transitions (`@view-transition`)
  with `.site-header` and `.page-head .horizon` named so they stay put;
  all inside the no-preference block.
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
- `whats-new.html` is a `data-projects="news"` list: `setUpNews` in
  `main.js` shows every project with a `version` or `latest`, in
  `projects.json` order, with no dates (the file has none). Linked from
  every footer ("What's new") and listed in `sitemap.xml`.
- Games each live in their own repo with their own GitHub Pages site
  (GarageToGlory, RedSkies, BaccaratTable, 350Chev, Outpost-, SeasonTicket, The-Whip, VaultStreet). This site only links to
  them via `link` (the pink Play it button) and `code` (the repo). The home
  page "Pick a game" cards are the `featured` projects (max 4); on phones
  all but the first are shortened (16:9 picture, two-line summary).
- The logo is the horizon lockup: the sun on a line running under
  LONGLIGHT, INTERACTIVE justified to the same width below. It's inline SVG
  with the letters outlined to paths (don't swap them back to live text),
  coloured by `.logo__sun/line/word/sub` and `--logo-line` (ivory light,
  purple dark), plus `.logo__glow` (a blurred sun copy using the
  `#logo-glow` filter, defined once per page in the footer lockup's
  `<defs>` because the footer is never hidden; the letter paths live there
  too as `#ll-word`/`#ll-sub`, and both lockups draw them with
  `<use class="logo__word" href="#ll-word">`, the fill inheriting from the
  `use`) and `.logo__halo` (a thin
  clay ring). On load the sun, halo and glow rise out of the line
  (`logo-rise`/`logo-fade`/`logo-ray`, in the reduced-motion-safe block); hover lifts
  the sun. Sizes: compact 3.4rem, header lockup 13.8rem, footer
  min(19rem, 80vw). The full lockup also has the ray (`.logo__ray`, a
  tapered clay polygon at 0.6 opacity from just past the halo to the right
  edge, under LONGLIGHT, which is lifted with `translate(0 -9)` to make
  room; it grows out with `logo-ray`). The compact mark and icons have no
  ray. Below 40rem the header shows `.logo--compact` (sun +
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
  top of the record also has `renderWeek`, a one-line hit/partial/miss tally
  of the newest entry that has graded calls (graded only, never invented). The
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
- `renderTrend` (journal.js) draws a running total of the closed options trades' returns under the bars (percentages added in order, captioned as a shape and not a balance; only from `options.json`, follows the V2/V3 filter).
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

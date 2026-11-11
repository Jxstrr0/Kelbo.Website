# Longlight site: detailed notes

The full "where things live" reference for Kelbo.Website, moved out of
`CLAUDE.md` (which loads on every turn) so it's read only when a task touches
that part. It lives in `.github` so the site never publishes it. When a
change alters how something works, update the matching section here; keep
the short map in `CLAUDE.md` in step if a file or rule moves.


## Projects, cards and game pages

- `projects.json` is the single source of truth for projects. `main.js`
  renders it. Its order is the display order everywhere (Games, Projects,
  What's new, home swipe row, "More games"): Kelbo's own ranking, games
  first: Prairie Engine Works, Lombard, Escapement, Scrapline, Ink,
  Station Keeper, Season Ticket, Frontier Lab, The Whip, Red Skies. Nothing sorts by progress except the
  Projects page's filter buttons (`sortByProgress`). Adding a project should never need an HTML edit. Each project
  can carry a `version` ("1.4.0.0", no "v") and `latest` (what changed),
  shown as "v1.4.0.0 · Added night mode" under the summary; either may be
  "". Every game uses four numbers, Major.Minor.Patch.Build (Kelbo's rule,
  November 2026; check-site warns on fewer, `fourPart` in sync-releases
  pads older tags).
  For games whose `code` repo has GitHub Releases, the deploy fills these
  in from the newest release (tag `v1.4.0.0` → `"1.4.0.0"`, release title →
  `latest`), so the live values can be newer than this file. Don't "fix"
  that by hand. Prefer publishing a release in the game's repo; editing
  them here is the fallback for games without releases. Escapement,
  Scrapline and Ink publish their own: `publish-release.yml` in each repo
  (key-free) makes release `v<VERSION>` on a push to `main` when that
  version has none, titled from the `x.y.z.w: summary` merge commit.
  It can also carry `shots` (`[{src, alt}]`, files in `assets/shots/`,
  about 360px tall JPG, under 40 KB, plus an `@2x` twin about 720px tall
  under 90 KB): `renderProject` makes a closed
  `<details class="shots">` "Screenshots (N)" with a scroll-snap strip of
  lazy images, all `12rem` tall so portrait and landscape mix. Hidden on
  the home swipe row by CSS; the What's new rows don't show it.
- A game can carry a `clip` (`assets/clips/<slug>.mp4`, silent H.264,
  360×720, about 14 seconds, under 400 KB, with a same-named `.jpg` still
  beside it). `setUpGame` shows it under "See it move" as a `<video>` with
  `preload="none"`, so only the still downloads until play is pressed.
  `sw.js` lets `.mp4` requests go straight to the network. Clips and the
  newer screenshots are recorded from the live game with Playwright at a
  phone size, then cut with ffmpeg. check-site checks the files exist.
- A game can carry `art` (`assets/art/<slug>.jpg`, 640×480 plus `@2x`):
  painted key art (Higgsfield, credited in `assets/art/CREDITS.md`) that
  takes the cover's place at the top of the game page only; cards, the
  home row, the press kit and the link preview keep `image`. And a `film`
  (`assets/films/<slug>.mp4`, silent H.264 1280×720, about 10 s, under
  1.2 MB, with a same-named `.jpg` still): a "Cinematic" section under
  "See it move", `preload="none"`, labelled as not gameplay.
- A game can also carry a `cardClip` (`assets/clips/<slug>-card.mp4`,
  silent H.264, 640×480 like the cover, 30 frames a second, 6 to 8
  seconds, under 400 KB). `watchClip`/`playClip` fade it in over the card's
  cover while the card is 60% on screen (not with reduced motion or Data
  Saver); without one the tall `clip` stands in. The cover picture
  (`assets/covers/<slug>.jpg` and `@2x`) is the card clip's first frame,
  so the still simply starts moving, and the clip's last half second is
  cross-faded into its lead-in so the loop has no jump. Recorded from the
  live game with Playwright in headless Chromium, UI hidden, the game's
  clock stepped one thirtieth of a second per frame and the canvas read
  each step (so it is smooth however slow the machine is), then cut with
  ffmpeg. Re-record the cover and the card clip together.
- Game cards with a `link` say "Plays in your browser" beside the category
  pill (`playsInBrowser`, `.project__instant`); the game page adds ", no
  download".
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
  the strip. The Devlog Writer proposes new lines weekly in its draft PR;
  also refresh it when Kelbo says what he's working on.
- The status labels, progress-bar fill amounts and colour stages are in
  `STATUSES` at the top of `main.js`: Complete, Released (solid clay pill),
  Live (clay outline), Polishing, In development, Prototype (purple),
  Concept (lilac outline). Each has `old` names from before October 2026
  that still work. Keep `KNOWN_STATUS` in `check-site.mjs` in step.
## The look and covers

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
  (640×480 JPG plus a 1280×960 `name@2x.jpg` twin for sharp 3x phones; every
  cover and shot `<img>` goes through `setPicture` in `main.js`, which adds
  `srcset` "1x, @2x 2x" and drops it if the twin fails to load; check-site
  warns when a twin is missing; captured from each live game; Red Skies is portrait-only, so
  it's shot at 600px wide mid-shift with a jet on the TV camera, cropped 4:3;
  Prairie Engine Works is the GM LT4 6.2 from the game's own studio render,
  `ENGINE_VIS.photoShot(1280, 960)`, so no stray parts show; Season Ticket is
  the game's dusk title scene at 1024×768, with every element except the 3D
  canvas hidden, cropped 4:3). The non-game projects have drawn covers
  (inline SVG rendered to 640×480 JPG, palette only, no text): Pre-market
  brief (dawn sky, candles rising off the horizon, clay sun), AI Trading
  Journal (notebook with results bars and a running line), Agent Fleet
  (a V of small bots over the sun). Brief sits above the journal.
## The live sky (the horizon)

- The live horizon (`[data-horizon]` in the home hero, every page head and
  the 404) puts the sun where the real sun is over Saskatoon (`YXE` in
  `main.js`, no network; only the optional weather, air quality, aurora, ISS orbit, forecast and alert fetches; the Trading page's USD/CAD line is the one other outside call), switches to the dark theme at real sunset, and
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
  on the home sky only; `placePlanetNames` puts each name right, left
  (`planet--flip`), below or above its dot (`planet--below`/`--above`),
  the first spot on screen and clear of other names and dots). On phones
  (under 40rem) the page head is shorter: less padding, `--sky-height`
  66px, `--sun-size` 50px, and the first section starts closer.
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
  (only when the code or cover changes, so they don't jump; more on
  wide screens). `.horizon__clouds` is full-bleed and reaches
  `--cloud-reach` above the sky, masked to fade out there, so the
  overcast veil and fog have no box edges; the hero and page-head words
  sit above it (`z-index: 2`), and cloud `top`s are measured from the
  sky's top (`calc(var(--cloud-reach) + ...)`).
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
  Twilight and cold-air optics (also in `placeOptics`; `clearSky(max)` =
  cloud known and ≤ max, no falling weather): `beltStrength` (clear ≤ 50,
  sun −7..1°) sets `--belt`, `--belt-x` (the anti-sun point as a share of
  the viewport, `skyX` clamped 0.1..0.9) and `--belt-rise` (the Earth's
  shadow climbing as the sun sinks) for `.horizon__belt`, the Belt of
  Venus (full-bleed gradient with a radial mask; `beltLine` in the day and
  night readouts when ≥ 0.3). `pillarStrength` (≤ −10°C, sun not hidden,
  high cloud ≥ 10 or ≤ −20°C, sun −3..7°) sets `--pillar` for
  `.horizon__pillar`, a blurred column up from the sun (`pillarLine`).
  `placeDayVenus` (from `placeSun`) makes `.horizon__day-venus` with a
  `b.day-venus.planet` dot when `dayVenus(t)` holds: sun ≥ 4°,
  `clearSky(40)`, ≥ `DAY_VENUS_GAP` (20°) from the sun and ≥
  `DAY_VENUS_ALT` (10°) high; light theme only, tap tip and
  `dayVenusLine`; `?critter=venus` shows a pretend one. Cloud shadows:
  `cloudShadowTime` (cloud `CLOUD_SHADOW_MIN`..`MAX` = 20..<80, sun > 5°,
  nothing falling) toggles `horizon--cloud-shadows`; `paintWeather` fills
  `.horizon__cloud-shadows` with `.cloud-shadow` blurs drifting over the
  ground (`shadow-drift`, motion block). Previews `?weather=pillar` and
  `?weather=warm` (26°C, light wind, for pelicans).
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
  `windyAfternoon` falls on a weekend (`kiteTime`). Home-sky birds and a
  balloon: `.pelicans` (5–10 `svg.pelican` each looping an ellipse while
  the group drifts with the breeze; `pelicanTime` = May–Sep, 11 AM–7 PM,
  sun ≥ 15°, wind < 20, ≥ 15°C; `PELICAN_EVERY_S`), a `.balloon`
  (`balloonTime` = known wind < `BALLOON_WIND` 8 km/h, May–Sep weekends,
  sun 3–20°; `BALLOON_EVERY_S`; bobs and burns in CSS) and a flock of
  `.bunting` dots (`buntingTime` = Nov–Mar with snow lying, sun > 2°, not
  storm/fog/heavy snow; `BUNTING_EVERY_S`). These register in
  `scene.tapCritters` through `tappable(node, title, detail, r)` so a tap
  names them. `?critter=geese|fireflies|leaves|jet|hawk|kite|train|pelicans|balloon|buntings`
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
  Play button is tapped), the "Your badges" box (`[data-badges]`, under Sky
  this week; `BADGES` + `badgeChecks` in `main.js`: games played from
  `kelbo.played` (Play it and Play here call `notePlayed`), Completionist
  against `kelbo.gameCount`, sun badges from the real time in `YXE`'s sky,
  never with `?at=`, days in `kelbo.days`, Explorer/Insider from
  `kelbo.pages`, Wishmaker from `wishCount`; earned times in
  `kelbo.badges`; `checkBadges` runs on every page, every minute, after a
  play and after a wish, and `toastBadges` shows the "Badge earned" note,
  above the Play here frame) and the NYSE market light on the Trading tile.
  The Trading page head has `[data-fx]` (`setUpFx`): the Bank of Canada
  Valet `FXUSDCAD` daily average (`recent=2`, so it shows the day's move),
  via `cachedFetch` (`FX_KEY`, `FX_MS` 3 h), labelled as a daily average
  with its date, never as live. It stays hidden if the call fails.
## Sky extras, glass, tilt, the ISS, Sky this week

- The home page's Sky this week box is a `<details>` that folds to one line,
  the next thing coming up (`[data-sky-week-next]`); it borrows the badges
  box's fold styles and remembers open or closed in `kelbo.skyWeekOpen`.

- Fun extras (2026-10-30): `setUpLand` adds `.horizon__windmill` (SVG,
  `WINDMILL_TOWER`/`WINDMILL_TAIL`, at 16% across; `.windmill__wheel`
  spins at `--mill-s` from `breeze()`, paused by `horizon--calm` under
  3 km/h, flipped downwind by `--mill-flip`; tap: `windmillFact`),
  `.horizon__pumpkin` and `.elevator__xmas` (lights sampled along
  `ELEVATOR`). `holidayAt` (`?holiday=halloween|christmas|canada|newyear|valentines`)
  toggles `horizon--halloween/christmas` in `paintWeather`; `setUpCritters`
  adds `bats()` (`batsTime`), `firework()` (`fireworksTime`, Canada Day
  after dark and 11 PM to 1 AM at New Year), `tumbleweed()` (`tumbleTime`:
  known wind ≥ 25, dry, no snow; `.tumble-path`) and `combine()`
  (`combineTime`: gold wheat by day; `.harvest-path`, and `--cut`/`--cut-dir`
  on the scene drive a second mask layer on `.horizon__wheat` and the
  inverse on `.horizon__stubble`; regrows after 60 s). `?critter=` also
  takes `bats|fireworks|tumbleweed|combine` (combine forces gold wheat).
  Storms: `strike(scene, x)` draws a `.bolt` in `.horizon__bolts` (after
  the clouds) and flashes; tapping the sky in `horizon--storm` strikes there
  and shows the thunder distance; `buzz` vibrates only where supported and
  after user activation. Parade: `PARADE_TAPS` taps on the sun or typing
  "longlight" calls `startParade` → `scene.parade()` (and
  `scene.meteorBurst`), sets `kelbo.parade` for the secret `parade` badge
  (`secret: true` shows "Secret badge" until earned). `confetti` runs from
  `toastBadges`. Holding the sun (`onSun`) runs `startYear` (whole days for
  `YEAR_MS`, `swipeLine` shows the date past 2 days) and `rewindYear` on
  release; `snowOnGround` uses the calendar more than 2 days from now.
  `skyIcon` redraws the favicon `<link>` as an SVG data URL on live paints
  (cached by `iconKey`). `setUpMouseSky` sets `--tilt-x/y` from the mouse
  on fine pointers; `setUpCoverTilt` adds `.is-tilting` with `--rx/--ry`
  and a `--mx/--my` glint on `.project` cards (a mouse over the card, or a
  finger held still on it for `PRESS_TILT_MS`, so a swipe never tips a
  card; `pointerup`/`pointercancel` settle it). The `.project:hover` lift
  sits in `@media (hover: hover)`: on a phone hover sticks to the last
  card touched.
- Sky secrets and their badges (2026-11-09): `tappable(node, title,
  detail, r, onTap)` in `setUpCritters`; `onTap` runs when that thing is
  the tap's best target. The freight train calls `spot("train")`
  (Trainspotter). `stockCar` (every `CAR_EVERY_S`, `?critter=stockcar`)
  runs a tiny `.stockcar` along the tumbleweed's lane; tapping it calls
  `spot("car")` (hidden Checkered flag). `spot` saves to `kelbo.spotted`.
  Northern lights is earned when `auroraStrength` is above 0 at the real
  time. `setUpLogoSecret` (home page only): the header logo scrolls to
  the top, and `LOGO_TAPS` taps in 3 s run `stingRise` and `confetti` and
  set `kelbo.logoSecret` (hidden Lightkeeper). 18 badges in all.
- Party-member secrets (2026-11-09). They nod to the Girlfriend and the
  Chihuahua on `about.html`, unnamed, using only wording from that
  character sheet (see the Privacy rule in `CLAUDE.md`); never add a new
  detail about either. One heart, `HEART_PATH`, is shared; `floatHeart(scene,
  x, y)` floats a lilac `.horizon__heart` up from a page point (off with
  reduce motion).
  - Home Base: `setUpLand` keeps the elevator's top window as
    `scene.homeLight`; `targets` in `setUpSkyTaps` lists it (r 10, before
    the elevator so it wins the tap) only in the dark theme on the home
    page (`[data-badges]`). Its `onTap` floats a heart and calls
    `spot("home")` (hidden Home Base badge). Preview `?at=night`.
  - Wish twist: in `wish`, after the milestone label, a wish past the
    first has a `WISH_TRUE_CHANCE` (1 in 12) of "Wish granted" and a
    heart. `?wish=true` forces it. No badge, not in the README.
  - Valentine's Day: `holidayAt` returns `valentines` on February 14
    (`?holiday=valentines`); `heartsTime` and `valentineHeart()` in
    `setUpCritters` send a tappable `.valentine-heart` up every
    `HEARTS_EVERY_S` (`?critter=hearts`); `horizon--valentines` turns the
    elevator's windows lilac after dark. No badge, not in the parade.
  - Moose Attack: `setUpMooseAttack` (About page) on the `.party__icon`
    holding `.party__dog`. Each tap adds `party__icon--bump` (leaning by
    `--bump-x/y` toward the finger); `MOOSE_TAPS` taps in 3 s add
    `party__icon--petted`, run `confetti` and set `kelbo.mooseAttack`
    (hidden "Petting achieved" badge). The keyframes are motion-only.
  - The third dog: `thirdDogLine` follows `sunDogLine` in the daytime
    readout, on the same `sunDogStrength` days.
  - `404.html`: `.lost__head` puts a second copy of the portrait SVG
    (`.party__dog.lost__dog`) beside "Lost?". It is plain HTML so it shows
    with no script; a change to his markings goes in both files.
- Glass (2026-10-30): the "Glass" section of `style.css` (just before
  Motion) turns the header, cards (`.now`, `.sky-week`, `.continue__card`,
  `.project`, `.news`, `.tile`, `.facts li`, `.post`, `.press-game`, the
  contact fields), the filter buttons and the sky tip/badge toast into
  frosted panes (`--glass`, `--glass-line`, `--glass-rim` light/dark tokens;
  `backdrop-filter` blur + saturate; inset top-left rim). `body::before` is
  a fixed layer of three palette blobs (`--glass-blob-1/2/3`), so `body` is
  transparent there and `<html>` paints `--bg`. All inside
  `@supports (backdrop-filter)`; `prefers-reduced-transparency: reduce`
  restores solid cards. Clay buttons get a gloss and rim everywhere. Don't
  give an element inside the glass header its own `backdrop-filter`: a
  blur inside a blur is unreliable in Chrome. Lens edge: `--pane-edge`
  (inset shadows: rim, clay and lilac fringes offset by `--tilt-x/y`,
  dark band) and `--pane-ring` (a conic gradient drawn by a masked 1px
  `::after` on the panes that have a free pseudo-element; the tiles use
  both of theirs). `setPageTilt` copies the sky's `--tilt-x/y` onto
  `<html>` so the edges follow tilt and mouse. `setUpLens` (main.js)
  adds the `#glass-lens` SVG filter (SourceAlpha → blur → offset
  differences → displacement map, then frost and saturate) and
  `data-lens` on `<html>` only where `CSS.supports("backdrop-filter",
  "url(#x)")` and not Firefox; `:root[data-lens]` panes use
  `backdrop-filter: url(#glass-lens)`. Safari never gets it.
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
- The ISS (main.js, the block before "The moon"): `loadIss` fetches the
  CelesTrak OMM JSON (`ISS_URL`, CATNR 25544) via `cachedFetch`
  (`ISS_KEY`, `ISS_MS` 6 h, eight fields kept); `sgp4Init`/`sgp4At` are a
  hand-written near-Earth SGP4 (WGS-72, checked against satellite.js to a
  few metres; deep-space orbits rejected), `issLook(t)` turns it into
  alt/az/range for `YXE` (TEME to Earth-fixed with the site's GMST, WGS-84
  observer) plus `sunlit` (cylindrical Earth shadow), or null when the
  elements are over `ISS_STALE_MS` (4 days) from t. `issSeen` = alt ≥
  `ISS_SHOW_ALT`, sunlit, sun ≤ `ISS_DARK_SUN` (−6°). `placeIss` (from
  `placeSun`) makes `.horizon__iss` with a `b.iss` dot (name span on the
  home sky only), placed with `skyX` and the `STAR_TOP_ALT` height map;
  while seen on the live sky it re-places itself every second
  (`.iss--glide` CSS transition, motion block only; every 5 s without
  gliding under reduce motion). Tap tip in `setUpSkyTaps`; `issLine`
  joins the night readout turns; `issPasses` (30 s steps, alt ≥
  `ISS_PASS_ALT`) feeds Sky this week (peak ≥ `ISS_WEEK_ALT`, top 5).
  `?critter=iss` shows `issPreview`, a pretend 40 s pass.
- Sky this week (`[data-sky-week]` under the Now strip, home only):
  `skyWeek(t)` steps the 7 days from local midnight hourly: tonight's
  planets (sunset + 1 h, alt > 6°, > `GLARE_DEG` from the sun), moon
  quarters (`FULL_MOON_NAMES` by month), moon–planet passes under
  `NEAR_MOON_DEG` and planet pairs under `NEAR_PLANETS_DEG` (geocentric,
  with `viewing` picking after dark / before dawn), equinoxes and
  solstices, `SHOWERS` peaks, `visibleEclipse` every 15 min, and the
  sunset trend. `skyGap` returns degrees. `showWishes` renders the wish
  count and `WISH_BADGES` (a badge also shows in the tap tip).
  Forecasts (main.js, "Forecasts for Sky this week"): `loadKpCast`
  (NOAA `noaa-planetary-k-index-forecast.json`, unmeasured 3-hour blocks
  only, `KP_CAST_MS` 3 h) adds a "Northern lights possible/likely" row
  per night whose dark block (sun below −12°) reaches `auroraKp()`;
  `loadClouds` (Open-Meteo hourly `cloud_cover`, 8 days, kept as
  `{start, cover}`, `CLOUDS_MS` 1 h; `cloudAt(ms)`) puts a Clear sky /
  Some cloud / Cloudy tag on rows that carry a `look` time (`add`'s 4th
  argument: planets tonight, moon and planet passes, showers, eclipses,
  ISS passes, aurora). `setUpSkyWeek` redraws once they and the ISS
  orbit settle, and the note names the sources. `loadAlerts`
  (Environment Canada `api.weather.gc.ca` weather-alerts, `bbox` round
  `YXE`, `skipGeometry`, deduped by name, warnings first, `ALERTS_MS`
  15 min; Canada only) feeds `setUpAlert`: the `[data-horizon-alert]`
  pill on the home sky (phones: in the ground strip on the right, the
  readout kept clear by `--alert-room`; from 40rem: left, above the line;
  `--warning` solid clay)
  linking to weather.gc.ca's page for those coordinates; it stops
  pointer events reaching the sky. Previews: `?kpcast=5`, `?clouds=10`,
  `?alert=warning|watch|advisory`; plain `?at=` skips all three.
## Saves, sound, offline, studio catalogue

- Saves: since November 2026 each game has its own address
  (`<game>.longlight.games`) and its own storage, so the studio site can't
  protect their saves; each game asks `navigator.storage.persist()` itself
  and has backup files (save code in a .txt) with a reminder. `notePlayed`
  still calls `keepStorage`, which asks once per page for the site's own
  storage (badges, last played). Old saves stay on `jxstrr0.github.io`.
- Sun motion (November 2026): the logo's sun breathes (`logo-glow`,
  `logo-halo`) and sits up to `LOGO_DIP` (3) logo units lower near sunrise,
  sunset and at night (`--logo-dip` on `<html>`, set in `placeSun`, so it
  follows swipes and the spin; the line in front hides the drop).
  `stingRise` replays the rise on `.logo--sting` timed to the sting (swell,
  lands on its cut at 1.33 s); `logo--hold` keeps the sun down until the
  sound starts (set by each page's `<head>` script before the first frame;
  released quietly after `STING_WAIT_MS`, 4 s, or at once with no file). `placeLowSun` sets
  `--sun-flat` below `LOW_SUN_DEG` (4°) with `horizon--low-sun` (squashed
  `scale`, `sun-wobble`) and `horizon--rim` (setting, under `RIM_DEG` 1.5°:
  `sun-rim` ripples the border-radius). `horizon--breezy` (known wind ≥
  `BREEZY_KMH` 20, in `paintWeather`) adds `ray-flicker` to the rays.
  Tapping the sun calls `sunFlare` (`.sun-flare`: streak and rings, WAAPI,
  not with reduce motion). `skyIcon` adds SMIL `<animate>` to the tab
  icon's glow (only Firefox animates tab icons).
- Studio sting: `assets/sounds/longlight-sting.mp3` (2 s, made by Kelbo with
  ElevenLabs; `assets/sounds/CREDITS.md`). `setUpSound` (main.js) adds a
  "Sound off/on" button to the end of every footer line (`.sound-toggle`),
  saved in `localStorage["kelbo.sound"]`; off by default, and the file is
  only fetched once it's on. Turning it on plays the sting; with Sound on,
  the first page of a visit (`sessionStorage["kelbo.stingPlayed"]`) plays it
  with the logo's rise: the sun waits below its line for the sound, so on a
  phone (sound blocked until a tap) both start at the first tap or key
  (`click`/`keydown`; taps on links are skipped so the next page does it). Not in `sw.js` `CORE`. It's the site's only sound.
- Offline: `sw.js` (root, registered in `init`) precaches `CORE` and is
  network-first for same-origin GETs (saved copy on failure, `index.html`
  for unknown pages offline). Bump `CACHE`
  if it ever serves stale files; add new top-level pages to `CORE`. Its
  cleanup deletes only `longlight-*` caches; keep it that way (never delete
  another prefix).
- Studio catalogue: `.github/LONGLIGHT-STUDIO.md` is the master copy of the
  public catalogue of every game (looks, names taken, storage prefixes,
  reuse map, ideas), copied into each game repo's root. It lives in
  `.github` so it isn't published; it never describes Kelbo's private repos.
  Update it here first, then recopy.
## Pages, sections, logo and header

- Page changes: cross-document view transitions (`@view-transition`)
  with `.site-header` and `.page-head .horizon` named so they stay put;
  all inside the no-preference block.
- The cover hop (2026-11-09): `.game__cover` is named `game-cover`;
  `setUpCoverHop` gives a tapped card's cover the same name (`data-hop`,
  cleared on `pagereveal`) and leaves `{to, src, at}` in
  `sessionStorage["kelbo.coverHop"]`. The inline script after the game
  box in `game.html` puts that picture in a `.game__top` at once (same
  origin, under 8 s old, right page) so the new page has a cover in its
  first frame; `setUpGame` then rebuilds the box as usual. Keep
  `data-projects="game"` on the box: `make-game-pages.mjs` looks for it.
- Moving covers: a project with `clip` gets `data-clip` on its cover
  (`watchClip`); `clipObserver` plays a muted looping `<video
  class="project__clip">` over the picture at 60% in view and pauses it
  below that. Off with reduce motion and Data Saver (`SAVE_DATA`).
  `.project.reveal .project__cover::before` is the one-time light sweep.
- The scroll sun: `setUpScrollSun` adds `.scroll-sun` (fixed, right
  gutter, `--p` 0 to 1, `--top` under the header) on pages with more than
  0.6 of a screen to scroll. Off with reduce motion and in print. While
  it shows, `html.has-scroll-sun` hides the browser's own scroll bar on
  touch screens (`pointer: coarse`), so a phone shows one marker, not two.
- About's character sheet: `setUpSheet` splits `.sheet__name` into
  `.sheet__ch` letters (the name stays in `aria-label`), adds
  `sheet--boot`, then `is-on` when the head is in view (label, typed
  name with a cursor, stat boxes ticking on); `.party__member--slide`
  members use `reveal`. `setUpQuests` fills `[data-projects="quests"]`
  under Status: unfinished projects first (highest `spot` first), then
  finished, each a `.quest` row with the cards' `.field` bar.
- Motion lives at the bottom of `style.css`, all inside
  `prefers-reduced-motion: no-preference`; `main.js` handles scroll reveal
  and smooth filtering (FLIP) and skips both when reduce motion is on. Content must never depend on JS or
  motion to become visible.
- Tools live in `tools/<name>/` with their own `index.html`, CSS, and JS,
  reusing `../../style.css`. They run in the browser only (localStorage,
  no server), so their data stays on the visitor's device.
- Sections: `games.html`, `trading.html`, and `tools.html` each list the
  projects whose `category` matches the list's `data-category` (Game,
  Trading, Tool); `projects.html` is "All" in the nav and on its `<h1>`.
  Trading = anything for the trading day (Agent Fleet is there, since its
  bot is the weekly market scan); Tool = every other tool (the winter
  roads checker goes here). `tools.html` was `ai.html` until November 2026:
  `404.html` sends `ai.html` there. Since November 2026 Tools is hidden: it
  is out of the menu, off the home tiles and not needed for Explorer, but
  `tools.html` and the tools still work at their addresses.
  The home page has three tiles (Games, Trading, All;
  `data-category-count="*"` counts everything, 0 reads "Coming soon"),
  each with an inline `svg.tile__art` drawing (viewBox 120×100, bottom
  right at 0.4 opacity over the corner sun; `.tile__art-a` clay /
  `-b` and `-line` `--secondary`, so it follows the theme): a controller,
  candles, four suns. 1 column on phones, 3 from 40rem (the Tools tile's
  styles are still in `style.css` for when it comes back); the market light sits on its own line.
- `devlog.html` is the devlog: `setUpDevlog` renders `devlog.json`
  (`{"posts": [...]}`, newest first; `date` YYYY-MM-DD, `title`, `body`
  split on blank lines, optional `game` = a projects.json title) as dated
  `.post` cards with ids from `devlogId` (date + title slug) so posts can
  be linked; `addGameDevlog` lists a game's posts on its page above "More
  Longlight games". Posts speak as Longlight and report only real changes.
  `check-site.mjs` checks the fields, the order and the `game` titles.
  Linked from every footer ("Devlog") and the What's new intro; in
  `sitemap.xml` and `sw.js` `CORE`.
- `press.html` is the press kit: a fact sheet (`.facts`, the game count
  filled by `setUpPress` into `[data-press-count]`), the logo files in
  `assets/press/` (`longlight-logo-dark/light`, SVG with the letters as
  paths and fixed colours, plus 2× PNG; remake both if the logo changes)
  and the sun icon, the five colours, and a `data-projects="press"` list
  where `setUpPress` shows every game (cover, status, version, summary,
  game page and Play links, each screenshot as a link to the file).
  Linked from every footer ("Press kit"), in `sitemap.xml` and `sw.js` `CORE`.
- `whats-new.html` is a `data-projects="news"` list: `setUpNews` in
  `main.js` shows every project with a `version` or `latest`, in
  `projects.json` order, with no dates (the file has none). Linked from
  every footer ("What's new") and listed in `sitemap.xml`.
- Games each live in their own repo with their own GitHub Pages site
  (RedSkies, 350Chev, SeasonTicket, The-Whip, FrontierLab,
  Lombard, StationKeeper, Escapement, Ink, Scrapline). Lombard keeps its drawn cover until its real art
  pass is done; Station Keeper's cover is the live game in sunlight with the
  panels hidden; Escapement's is the live bench's balance wheel with the UI
  hidden (a placeholder in the game; retake it once real movements are on
  the bench); Ink's is the live Studio tab's back room with the UI hidden
  (the scaffold's placeholder room; retake it once the real studio is in);
  Scrapline's is the live workshop's bench bot (the default vertical
  spinner) with the UI hidden. This site only links to
  them via `link` (the pink Play it button) and `code` (the repo). The home
  page "Pick a game" is a swipe row (2026-11-09): `setUpGameRow` fills
  `.project-list--row` (`data-projects="row"`) with every game in
  projects.json order, as normal `renderProject` cards whose summary,
  version line, progress bar, code link and screenshots are hidden by CSS.
  Scroll-snap, bleeds to the screen edges, focusable for arrow keys;
  `[data-row-nav]` arrows show from 40rem up. The row is `overflow-y:
  hidden` (on `auto` it slid and bounced up and down inside itself on an
  iPhone) and its cards reveal together when the row comes into view (one
  observer on the row, not one per card). `featured` no longer
  affects the page; it only records the four covers in the link preview.
  Each game keeps its own look (fonts, colours, art). The Longlight logo,
  the five colours and Space Grotesk belong to studio pieces only (logo or
  splash, credit line, studio block, links back here); every game repo's
  CLAUDE.md has a "Longlight brand (studio pieces only)" section saying so,
  and the official logo files are the press kit's `assets/press/` ones.
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
- The header (the logo as home, the nav Games, Trading, All, About, and the ☀/☾ button) is copied in every page and only
  just fits at 360px, where only the compact mark shows. Test before adding
  to it. The parked tracker doesn't load
  `main.js` (its names clash), so it has no ☀/☾ button or live sun.
## Trading: journal, options, scan, brief, report card

- The AI Trading Journal is `journal.html` + `journal.js` + `journal.css`,
  with entries in `journal.json` (a list, newest first by `date`). The
  record is calculated from each call's `grade` (hit/partial/miss, null =
  not graded) and each trade's `result` (percent; missing = open). The
  top of the record also has `renderWeek`, a one-line hit/partial/miss tally
  of the newest entry that has graded calls (graded only, never invented). The
  field list is at the top of `journal.js`. Entries can be long forecasts
  (calls, scenarios, levels, sectors, schedule, plan). Since November 2026
  the weekly forecast and its grades come from two robots (the Forecaster
  and the Scorekeeper, below); entries Kelbo sends by hand still get copied
  faithfully, with grades and the recap only when he reports them or the
  Scorekeeper fills them. When he sends views or trades, write the
  entry and an honest "ai" coach note. Never invent trades or results, and
  prefer percentages over dollar amounts. `journal.js` borrows `el()` and
  `reveal()` from `main.js`, so load `main.js` first.
- Write every "ai" coach note in a general voice, not to Kelbo: judge the
  trade or idea ("winners averaged +21.5%", "holding overnight without a
  planned exit was the mistake"), never "you" or "your". Same honesty, same
  specifics.
- `renderTrend` (journal.js) draws a running total of the closed options trades' returns under the bars (percentages added in order, captioned as a shape and not a balance; only from `options.json`, follows the S1.0/F3.3 filter).
- Options trades live in `options.json` (fields at the top of `journal.js`),
  copied from Kelbo's own options ledger. The page works out each return
  from `paid`/`sold` premiums and feeds the record's options group. Leave
  out contract counts and dollar P&L. When he sends new trades, add them
  oldest first, bump `updated`, and refresh the `ai` coach note honestly.
- The weekly scan on `agent-fleet.html` is `scan.json` (fields at the top
  of `scan.js`). The **Scanner**, a Claude Code routine on Kelbo's own Claude plan ("Longlight
  weekly scan", Saturdays 8:55 am America/Regina) rewrites it from web
  searches and merges it, so no API key exists for it. When running as that
  routine: only touch `scan.json`, use real figures from sources found that
  run (list them in `sources`), never guess a number, and leave out anything
  that can't be confirmed.
- The pre-market brief is `briefs.html` + `briefs.js` + `briefs.css`. The
  **Morning Writer** workflow (`.github/workflows/premarket-brief.yml`,
  started by the Robot Timer weekdays at 12:30 and 13:15 UTC = 6:30 and
  7:15 am America/Regina; the first writes the brief and the backup stops
  at the "already exists" check before any API call; or by hand with a
  "rewrite today's" box) runs `.github/scripts/premarket-brief.mjs`: plain Node
  `fetch` to the Anthropic Messages API (`claude-fable-5-2` at `output_config.effort` "high" (`EFFORT`; history: Fable 5.1 wrote the 2026-11-09 brief, Opus 5.5 at xhigh before that), no `thinking` field (Fable always thinks; sending one is a 400), a spending cap from a running total at Fable list prices (`spent()`): past `WRAP_UP_AT` US$4 a paused turn gets a user message asking for the brief now (if the API refuses that, the text so far is used), `max_tokens` per reply from `roomLeft()` (8000 to 48000, so writing can't pass `HARD_CAP` US$6), no request once at `HARD_CAP`, `NETWORK_TRIES` 1 and a mid-stream error event counted as a drop, `stop_reason` "refusal" throws; server-side
  `web_search_20260209` with `MAX_SEARCHES` 35 and `web_fetch_20260209`
  with `MAX_FETCHES` 25 (20 until 2026-11-09), no domain limits, a per-section research plan in
  `SYSTEM`, prompt caching (a marker on the system block plus top-level
  `cache_control`), the previous brief minus its Sources in the user
  message for the MU **Last call:** line, a usage and estimated-cost log
  line from `PRICE`, and a `pause_turn` loop), which writes
  `briefs/YYYY-MM-DD.md` (fixed headings: `# headline`, `TLDR:`,
  `## Overnight and Asia`, `## MU` (2026-11-05 to 11-06 briefs also had a
  `## SOX` section, the PHLX Semiconductor Index as a co-main ticker;
  dropped 2026-11-09, MU stays the headline),
  `## Watchlist`, `## Calendar`, then
  `## Sources` (the model lists its own; the script keeps only links that
  appear in that run's search results, plus inline citations, max 15) and a
  `<small>` stamp; if a heading is missing it asks once,
  with search off, for a rewrite in the format), then calls `updateIndex`
  in `.github/scripts/brief-index.mjs` (also runnable alone to rebuild):
  it writes `{date, time, headline, tldr}` into `briefs/months/YYYY-MM.json`
  (one month, newest first), `briefs/index.json` as `{latest, months:
  [{month, count}]}` and `briefs/latest.json` (`{date, time}`, the
  only brief file every page fetches; index.json's `latest` is its
  fallback), and removes the oldest briefs while the folder is over
  `MAX_FOLDER_BYTES` (30 MB, about 15 years). briefs.js folds Past briefs
  by year then month and loads a month file only when its fold opens
  (`time` is the ISO send time: `setUpBriefAlert`
  in main.js sets `data-brief-new` on `<html>` while `briefIsNew` (under
  `BRIEF_NEW_MS`, 1 h; rechecked every `BRIEF_CHECK_MS`), drawing a clay
  dot on the nav Trading link and a "New" badge on the brief's card in
  style.css, plus the `.brief-new` pill by the date on briefs.html; it
  blinks only in the no-preference block). The workflow commits as morning-writer, then runs
  `gh workflow run deploy.yml` (a GITHUB_TOKEN push starts no workflows by
  itself). `briefs.js` renders the Markdown itself (escape first, then
  headings, lists, bold, italics, https links, simple tables; then
  `groupParts` wraps each `##` section in a `.brief__part` card named by
  `PART_NAMES` (`data-part` mu, overnight, watchlist, calendar, sources,
  sox for old briefs, other for anything new), puts the headline, TLDR,
  "How it did" line and section buttons (`addJumps`, buttons not #links)
  in a `.brief__lead` card and moves MU first. The dress functions only
  rearrange HTML renderMarkdown already escaped: `dressCalls` turns MU's
  `**Label:**` lines into boxes ordered by `CALL_ORDER` (gap call first in a
  clay box with a confidence pill, bull/bear side by side, last session's
  call last), resistance/support tinted clay/purple, and the
  `**Ladder:**` line (`prior | pre | call | support | resistance`, plain
  numbers, ranges as low-high, n/a) drawn by `drawLadder`/`parseLadder`
  as a price scale (dropped if it can't be read); `dressLeads` makes
  Overnight's bold starts into labels; `dressWatchlist` ticker chips and a
  News tag, plus close/pre columns from `| close <price> <%> | pre <price>
  <%> |` lines with sort buttons (`addWatchSort`; old briefs keep chips);
  `dressCalendar` day headers and a time column, SK first (`swapTimes`
  turns "ET (SK)" round inside lines too); `foldSources` folds Sources
  shut; `markChanges` colours signed % changes purple (up) and clay
  (down); `addFolds` makes each heading a fold button, remembered in
  localStorage `kelbo.briefFolds`; `markNew` loads the brief before
  (`briefBefore`) and tags Overnight, MU news and watchlist news lines
  whose words (`wordSet`, `SAME_SHARE` 0.45) weren't mostly in one of its
  lines, skipping futures/close lines. The Grader is told to ignore the
  Ladder line. Section colours are `--tone`, `--tone-ink`,
  `--tone-soft` per card in briefs.css (MU clay, Overnight purple,
  Watchlist lilac, Calendar slate/ivory); `:has()` keeps the old single
  card if a brief can't be sorted. From 64rem the cards sit side by side
  in a grid, `--wrap` 120rem on that page, Sources and the lead full
  width), draws the
  4 am to 8 pm ET session strip in Saskatoon time, and routes the archive
  by `#YYYY-MM-DD`. The page speaks in Kelbo's first person; it is a
  Trading project in `projects.json`, in `sitemap.xml` and `sw.js` `CORE`.
  Don't hand-edit the files in `briefs/`.
- The after-close report card: the **Grader** workflow
  (`.github/workflows/postmarket-recap.yml`, started by the Robot Timer
  weekdays at 22:45 and 23:45 UTC = 4:45 and 5:45 pm America/Regina, after
  the close all year, or by hand with a "redo
  today's grade" box) runs `.github/scripts/postmarket-recap.mjs`: plain
  Node `fetch`, the model in `MODEL` (`claude-opus-5-5` at `output_config.effort` "high", `max_tokens` 32000), `web_search_20260209`
  (`MAX_SEARCHES` 18) and `web_fetch_20260209` (`MAX_FETCHES` 15), the same
  caching, `pause_turn` loop and cost log line as the brief. It skips
  weekends, NYSE holidays (`marketHolidays`, computed, incl. Good Friday
  and the Saturday/Sunday observance rules), any run before 4:00 pm New
  York time on that date (`nyHour`/`nyDate`; FORCE doesn't skip it) and
  days without a brief, and
  reads today's brief (minus Sources) to grade the MU gap call
  (hit/partial/miss, ±0.5% = flat) and each key level
  (held/broke/untested), with `unknown` whenever a price isn't confirmed.
  When the brief has a `## SOX` section (`hasSox`) it grades the SOX the
  same way (`gradeTicker`, prices from `dayPrices`) into the card's `sox:
  {gap, levels, index}` (index points); older cards have no `sox`.
  Claude also copies the brief's numbers (`call_low_pct`/`call_high_pct`,
  each level's `kind`/`low`/`high`); `gapGrade` and `levelGrade` redo the
  grades from them and the prices (code wins, disagreements logged; the
  model's grade only when a number is missing), and `callClaude` retries
  network failures as well as 429/5xx.
  The script validates everything (grades outside the list become
  unknown, prices must be positive numbers or null, the gap is unknown
  without both prices, `open_pct`/`close_pct` are computed from the
  prices, sources must be https links seen that run) and writes
  `report-cards/YYYY-MM.json` (`{date: card}`, newest first) plus
  `report-cards/index.json` (`{latest, days, gap: {hit, partial, miss,
  unknown}, levels: {held, broke, untested, unknown}, sox: {days, gap,
  levels}, months, counts}`; top-level gap/levels are MU's
  (counts = cards per month, for the folds), re-added
  from every month file each run). It commits as grader and runs
  `gh workflow run deploy.yml`. Never write report cards into `briefs/`.
  `briefs.html` shows the two runs as tabs (`[data-tab]` buttons,
  `role="tablist"`, arrow keys; `showTab`/`pickTab`): Pre-market
  (`#panel-pre`: `showBrief`, plus `addCardLink`'s one-line "How it did"
  pointer under the TLDR, or today's waiting note) and After close
  (`#panel-post`: `[data-report-tally]` from `showTally`, `showCard`
  with a "Read that brief" link). Each tab ends in its own archive
  (`[data-archive="pre|post"]`, the shared `drawArchive`/`fillMonth`
  folds driven by `preArchive`/`postArchive`). The address is `#date`
  (brief), `#after` or `#after-date` (card) via `readHash`/`tabHash`.
  Everything goes on the page as text nodes; the
  `.grade--*` pills are purple (right/held), purple outline (partly), clay
  (wrong/broke) and dashed grey (not reached/couldn't confirm).
## The robots

- Robot names (use them when talking to Kelbo): **Morning Writer** =
  pre-market brief (`premarket-brief.yml`, commits as morning-writer),
  **Grader** = after-close report card (`postmarket-recap.yml`, grader),
  **Coach** = brief lessons (`brief-lessons.yml`, coach), **Devlog
  Writer** = devlog drafts (`devlog-draft.yml`, devlog-writer), **Release
  Writer** = release lines (`release-lines.yml`, release-writer),
  **Forecaster** = weekly journal forecast (`journal-forecast.yml`,
  forecaster), **Scorekeeper** = weekly journal grades
  (`journal-grade.yml`, scorekeeper),
  **Scanner** = the "Longlight weekly scan" routine. Each workflow's
  `name:` is "<Name> (<what it does>)".
- The three one-call robots (Coach, Devlog Writer, Release Writer) share `.github/scripts/claude.mjs` (`askClaude`:
  fetch to the Messages API, `output_config.effort`, a cache marker on the
  system block plus top-level `cache_control`, 4 tries on network errors,
  429 and 5xx; `logCost` from `PRICES`, which also calls `costNote`;
  `readJson` after a marker line;
  `setOutput`; `DRY_RUN`). No tools, no web search. Each workflow has a
  `workflow_dispatch` "dry run" box (`DRY_RUN=1`: print, write nothing).
- Cost notes: `costNote` (claude.mjs; also called by premarket-brief.mjs
  and postmarket-recap.mjs) prints `::notice title=Cost::US$0.90 · ...`
  in Actions, an annotation readable without a login via
  `/check-runs/<job id>/annotations`. The "Robot cost log updater"
  routine (daily 17:47 America/Regina) copies them into Kelbo's private
  API Call Log ($) artifact (doc ids `gh-<run id>`). Keep the `US$<n>`
  start of the note; the routine reads it. A new robot workflow must be
  added to that routine's workflow list too. Batch runs add ", batch" to
  the note (the routine logs them with `batch: true`); a run with no Cost
  note at all may be a batch that saved its place, so it's skipped.
- Batches (since November 2026): the Coach, the Devlog Writer, the
  Forecaster and the Scorekeeper pass `batch: { name, key }` to `askClaude`/`askClaudeWeb`,
  which then go through the Message Batches API (tokens half price,
  searches full price; `logCost`/`logWebCost` halve them). `sendBatch`
  (claude.mjs, "BATCHES") submits a batch of one and polls every
  `BATCH_CHECK_MS`; past `BATCH_WAIT_MIN` (320) minutes `saveAndStop`
  writes `.github/batches/<name>.json` (`{key, savedAt, state}`, the
  round, messages and batch id), sets `waiting=true` and exits 0, and the
  next run with the same key picks the same batch up (no second charge;
  a different key throws the file away). Expired or canceled batches are
  resubmitted. The workflows commit that folder too (`.github` is never
  published), with `timeout-minutes: 350`, and only deploy when a site
  file changed. `pullLatest` (git pull --ff-only, Actions only) runs
  before the Forecaster and Scorekeeper write journal.json, since a batch
  can take a while. There's no full-price fallback, by Kelbo's choice.
- **Robot Timer** (Nov 2026): GitHub's `schedule:` starts ran 3.5 to 7
  hours late, so the six robots above have no crons. A free Cloudflare
  Worker, `robot-timer` (code: `.github/worker/robot-timer.js`, kept the
  same as the live copy), wakes on one Cron Trigger `*/5 * * * *` and
  POSTs `workflow_dispatch` (ref `main`, default inputs) for each robot
  whose UTC day and `HH:MM` in `TIMETABLE` match the trigger's
  `scheduledTime`. It needs the Worker secret `GH_TOKEN` (fine-grained
  token, this repo only, Actions read/write, renewed yearly) and logs only
  "<robot>: started / failed (status)". Every extra start stops at the
  "already exists" check (or picks up a saved batch) before any API call.
  Release Writer and Deploy site keep their own crons. To change a time,
  edit `TIMETABLE` in both copies (times on a 5-minute mark, in UTC).
- Coach (brief lessons): `brief-lessons.yml` (Sundays 17:45 UTC = 11:45 am,
  beside the Devlog Writer and Scorekeeper, plus a 23:25 UTC pickup run that stops at once if today's lessons exist and
  no batch is saved) runs `brief-lessons.mjs` (`claude-opus-5-5`, effort
  high, one batched call): the last
  `WINDOW_DAYS` (28) of report cards from the month files, the briefs they
  graded minus Sources, `report-cards/index.json` totals and the previous
  `lessons/latest.json`. Under `MIN_CARDS` (5) cards with a graded gap
  call: no call. It validates the answer (text, status new/kept/retired,
  `evidence {count, dates}` with dates that are real cards, no `$` prices,
  at most `MAX_ACTIVE` 5 active) and writes `lessons/latest.json`
  (`{updated, window: {from, to}, cards, lessons}`) plus
  `lessons/YYYY-MM-DD.json`; commits as coach, then runs deploy.yml.
  Never in `briefs/` or `report-cards/`. `premarket-brief.mjs` adds the
  active lessons to the USER message (not SYSTEM, to keep the cache) while
  `updated` is under 14 days old, and logs "Lessons used: N".
  `setUpLessons` in briefs.js fills the closed `.lessons` fold
  (`[data-lessons]`, "What the brief is working on") on the After close
  tab, text nodes only, hidden without the file or active lessons.
- Devlog Writer: `devlog-draft.yml` (Robot Timer, Sundays 17:20 UTC plus a 23:15 UTC
  pickup that skips if today's `devlog-draft/` branch exists and no batch
  is saved; `contents` and `pull-requests: write`) runs `devlog-draft.mjs`
  (`claude-opus-5-5`, effort high, batched; only the batch file is
  committed to main, by the "Save the batch's place" step): last 7 days of merged PRs (body cut to `BODY_CHARS`) and
  releases for each projects.json game with a GitHub `code` link, plus the
  5 newest devlog posts and now.json. No activity: no call. Validates 0..4 posts, one
  per game, `game` an exact title with activity, no PR numbers or GitHub
  logins, date = run date (America/Regina); prepends them to devlog.json,
  runs check-site, pushes `devlog-draft/YYYY-MM-DD` as devlog-writer and
  opens a PR "Devlog draft for the week of ..." with source links. The
  same call returns `now` (1..`MAX_NOW` 3 lines, one per active game,
  `NOW_CHARS` 70), written to now.json (`updated` = run date, `link` from
  projects.json) in the same PR when it differs; posts or strip alone
  each open the PR (workflow output `now`).
  The workflow never merges the PR itself, but Claude may merge it once
  it's green (Kelbo's OK, Nov 2026). Needs the repo
  setting "Allow GitHub Actions to create and approve pull requests".
- Forecaster (weekly journal forecast): `journal-forecast.yml` (Sunday
  night: Robot Timer at 01:45 and 03:15 UTC Monday = 7:45 and 9:15 pm
  Sunday America/Regina, plus a 10:35 UTC 4:35 am Monday pickup;
  batched) runs `journal-forecast.mjs` (`claude-opus-5-5`,
  effort high, `askClaudeWeb` with `MAX_SEARCHES` 25 and `MAX_FETCHES`
  12): the coming week's market days from `market-days.mjs` (shared
  with the Grader; `isMarketDay`, `addDays`), the base close (last market
  day before), and the two newest entries minus trades for context. A week
  that already has an entry (any author): no call, unless FORCE, which
  only replaces the robot's own entry. Validates 3..6 calls (each needs a
  `wrongIf`; grade null), odds, trends; em-dashes become commas; `sources`
  only links seen that run (`seenSources`); `by: "forecaster"`; title
  "Forecast for the week of <Mon>", `date` = first market day, `gradeBy` =
  last. Prepends to journal.json (rewritten with 2-space JSON), commits as
  forecaster, then runs deploy.yml. A weekday run by hand covers only today
  to Friday, measured from the last close before today.
- Scorekeeper (weekly journal grades): `journal-grade.yml` (Sunday
  around noon, so the batch has the afternoon before the Forecaster:
  Robot Timer at 17:35, 19:15 and a 23:45 pickup UTC Sunday = 11:35 am,
  1:15 pm and 5:45 pm; batched; a back-up that starts while a run is
  still waiting queues behind it, via the `concurrency` group)
  runs `journal-grade.mjs` (`claude-opus-5-5`, effort high,
  `MAX_SEARCHES` 20, `MAX_FETCHES` 15): the newest entry whose `gradeBy`
  has closed (past, or today after 4:00 pm New York), within
  `LOOK_BACK_DAYS` 21, with ungraded calls (any author). Nothing waiting:
  no call. Fills each call's `grade` (hit/partial/miss; "unknown" stays
  null) and `result`, never overwriting a grade unless FORCE; `recap`,
  `ai` (general voice, warns on "you") and `lesson` only once every call
  is graded; `gradeSources`; `graded {by, at}`. Commits as scorekeeper,
  runs deploy.yml. journal.js shows a graded call's `result` ("What
  happened") and a closed "Sources (N)" fold from `sources` + `gradeSources`.
  `askClaudeWeb`, `logWebCost` and `seenSources` live at the bottom of
  `claude.mjs`.
- Release Writer: `release-lines.yml` (cron `53 */6 * * *`) runs
  `release-lines.mjs` (`claude-sonnet-5-5`, effort high): each game's
  latest release; keys `<repo>@<tag>` missing from `release-lines.json`
  go to Claude in one batched call (no new ones: no call). Lines are ≤ 90
  characters, no version number; stored as `{line, title, at}`, existing
  entries never overwritten (Kelbo may hand-edit them; broken JSON stops
  the script). Commits as release-writer, then runs deploy.yml.
  `sync-releases.mjs` uses that `line` for the exact repo@tag as `latest`,
  else the cleaned release title (missing/broken file = old behaviour).
  `check-site.mjs` validates `lessons/latest.json` and
  `release-lines.json` (a missing file is only a warning).
## Contact form, README

- The home page contact form posts to Web3Forms, which emails Kelbo. Its
  `access_key` in `index.html` is public by design (it can only send him a
  message); never put his email address in the site. Web3Forms rejects
  server-side posts, so test it from a real browser on the live site.
- **Privacy scan** (`check-site.mjs`, section 8): errors on an email
  address (`EMAIL_OK` allows example.com and GitHub no-reply ones), a phone
  number, a 9+ digit number not inside a URL, id or version, or a
  key-shaped string (`sk-ant-`, `sk-`, `ghp_`, `github_pat_`, `AKIA`,
  `xox`), in every text file (`TEXT_EXT`; pictures, fonts and sounds are
  skipped). In `TRADING_FILES` (`journal.json`, `options.json`) it also
  errors on a dollar amount within 30 characters of a money word
  (`MONEY_WORDS`: made, lost, profit, account, risked...), a count of
  contracts or shares, and "account size/balance"; a bare price level
  ("$230") is allowed. False alarm: reword, or widen the rule there. The
  human rules it backs up are the "Privacy" section of `CLAUDE.md`.
- `README.md` is Kelbo's plain-English editing guide. Keep it up to date
  when how things work changes.

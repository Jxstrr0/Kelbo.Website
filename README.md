# Kelbo.Website

My personal site: who I am, plus a list of what I'm building.

It's plain HTML, CSS, and JavaScript. There's no build step and nothing to
install. Any change you save on the `main` branch goes live within a minute
or two: a GitHub Action checks the site for mistakes, fills in game versions
from their releases, then publishes the files as they are (see
**Automatic checks and game versions** below).

**Live at:** https://longlight.games/

## What each file does

| File | What it's for |
|---|---|
| `index.html` | Home page: the Longlight Interactive name, game cards, Games / Trading / All tiles, contact |
| `about.html` | The About page: your character sheet. The quest log under Status fills itself in from `projects.json` |
| `projects.html` | The full projects page with status filters |
| `whats-new.html` | The newest version and latest change for each project, built from `projects.json` (no dates, since the file has none) |
| `devlog.html` + `devlog.json` | **Devlog**: dated studio posts, newest first. To add one, put it at the top of `"posts"` in `devlog.json` with a `date` (like `2026-10-24`), a `title`, a `body` (a blank line, written `\n\n`, starts a new paragraph) and, if it's about one game, `game` with that game's exact title. Posts about a game also show on that game's page |
| Badges | The "Your badges" box on the home page (folded to its "2 of 18 earned" line until tapped): small goals like playing 3 games, visiting at sunset or catching a shooting star. Each visitor's badges are saved in their own browser only. The list is `BADGES` in `main.js` |
| `press.html` | **Press kit**: the fact sheet, logo downloads (`assets/press/`), brand colours, and every game's cover, summary and screenshots, built from `projects.json`. Linked from every footer |
| `games.html` | The Games section: every project with `"category": "Game"` |
| `trading.html` | The Trading section: every project with `"category": "Trading"` |
| `tools.html` | The Tools section (menu: Tools): every project with `"category": "Tool"`. Hidden for now: it's not in the menu or on the home page, but the page still works. It used to be `ai.html`; old links to that address land here |
| `projects.json` | **The list of projects.** Edit this to add or change one |
| `game.html` | **One game's own page** (`game.html?g=the-whip`). It fills itself from `projects.json`, so a new game needs no new file |
| `now.json` | **The "Now building" strip** on the home page. Edit this to say what you're working on |
| `style.css` | Colours, fonts, and layout for every page |
| `main.js` | Reads `projects.json` and puts the projects on the page, and runs the live sun, the ☀/☾ button, and the "Continue?" card |
| `assets/` | Images, game cover screenshots (`assets/covers/`), the screenshot strips (`assets/shots/`), the link preview picture, the browser-tab icon, and the home-screen icon |
| `sw.js` | The offline helper: keeps a copy of each page and file on the phone so the site still opens with no signal. Keep it in the top folder |
| `site.webmanifest` | The site's name, colours and icon for phones that add it to the home screen |
| `robots.txt`, `sitemap.xml` | Tell search engines they're welcome and which pages exist. Add a line to the sitemap when you add a page |
| `agent-fleet.html` | The Agent Fleet page. All plain text except the weekly scan, so edit the words directly |
| `scan.json` | **The weekly scan.** Rewritten every Saturday by a Claude routine |
| `scan.js` | Shows the weekly scan on the Agent Fleet page |
| `briefs.html` | **The pre-market brief** page: the latest brief, where the US trading day is in Saskatoon time, and the archive |
| `briefs/` | The briefs themselves, one `YYYY-MM-DD.md` per weekday, plus `index.json` (the list of months the page reads), `months/` (one small list per month, e.g. `months/2026-11.json`) and `latest.json` (the newest one's time, for the alert dot). Written by the Morning Writer below, so you never need to edit them |
| `briefs.js`, `briefs.css` | Show the Pre-market and After close tabs, each with its archive |
| `report-cards/` | The after-close grades of each brief: one `YYYY-MM.json` per month and `index.json` (the running score). Written by the Grader below, so you never need to edit them |
| `lessons/` | **What the brief is working on**: `latest.json` (this week's lessons) plus a dated copy for each week. Written by the Coach below |
| `release-lines.json` | The short, player-friendly "What's new" line for each game release. Written by the Release Writer below; you can fix any line by hand |
| `journal.html` | The AI Trading Journal page |
| `journal.json` | **Your journal entries.** Edit this to add an update |
| `options.json` | **Your options trades.** Edit this to log a trade |
| `journal.js`, `journal.css` | Show the journal entries and options trades, and work out the record |
| `404.html` | The "page not found" screen GitHub shows for any address that doesn't exist |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is. Leave it alone |
| `.github/workflows/` | The robots: `site-check.yml` (checks every pull request), `deploy.yml` (checks again, then puts the site live), `premarket-brief.yml` (the Morning Writer), `postmarket-recap.yml` (the Grader), `brief-lessons.yml` (the Coach), `devlog-draft.yml` (the Devlog Writer) and `release-lines.yml` (the Release Writer), all below |
| `.github/scripts/` | What they run: `check-site.mjs` (the mistake finder), `sync-releases.mjs` (fills in game versions from their releases), `make-game-pages.mjs` (makes each game's own page, below), `premarket-brief.mjs` (asks Claude for the brief), `postmarket-recap.mjs` (asks Claude how the brief did), `brief-lessons.mjs` (Coach), `devlog-draft.mjs` (Devlog Writer), `release-lines.mjs` (Release Writer) and `claude.mjs` (the one-call-to-Claude code those three share) |

## Editing on your phone

1. Open the repo in the GitHub app or at github.com.
2. Tap the file you want to change, then the pencil icon (✏️).
3. Make your change and tap **Commit changes**.
4. Wait a minute or two, then refresh the site.

If the site doesn't change, open the **Actions** tab: a red ❌ on
**Deploy site** means the check found a mistake (tap it to see what in plain
English). The live site keeps the last version that worked until it's fixed.

## Automatic checks and game versions

**The site check** (`.github/scripts/check-site.mjs`) looks for anything
that would break the live site: a JSON file that won't load, a JavaScript
typo, a cover, screenshot or page that a link points at but doesn't exist.
It runs on every pull request (a red ❌ means fix before merging) and again
before every deploy (a problem stops the deploy). It also lists things
worth a look, like the "Now building" strip naming a game that's marked
finished; those never block anything.

It also has a **privacy scan**, because the whole site is public. It goes
red if any file holds an email address, a phone number, a long number that
could be an account or card number, or anything shaped like an API key, and
if `journal.json` or `options.json` holds a dollar amount of money ("made
$450", "account balance $12,000"), a number of contracts or shares, or an
account size. Stock price levels ("MU over $230") are fine. It can't
recognise a name or a story, so still read before you merge. The full list
of what must never go on the site is the "Privacy" section of `CLAUDE.md`.

**Game versions** come from each game's own GitHub Releases. When a game
ships, publish a release in that game's repo:

1. In the game's repo, tap **Releases** → **Draft a new release**.
2. Tag: the version with a `v`, like `v1.2.0.0`. Every game uses four
   numbers, Major.Minor.Patch.Build (an older short tag like `v1.5` shows
   as `v1.5.0.0`). Title: what changed, like
   `Night mode and a new garage`. (**Generate release notes** fills in the
   description from the merged PRs.)
3. Tap **Publish release**.

Within 6 hours the site shows "v1.2.0.0 · Night mode and a new garage"
for that game. For it right away, open **Actions** → **Deploy site** →
**Run workflow**. Games with no releases yet just show what's in
`projects.json`. If `projects.json` has a newer version than the newest
release, the site keeps the `projects.json` one and the deploy notes remind
you to publish a release.

Escapement, Scrapline and Ink do this by themselves: a small helper in each
repo (`.github/workflows/publish-release.yml`, free, no keys) publishes a
release whenever a merge to `main` carries a version that has none yet. It
only matters for the version number on this site, so deleting a helper is
safe: that game's number just stops at its last release.

## Change the text

All the words on the home page are in `index.html`. Look for these
comments to find each part:

- `<!-- 1. Hero -->`: the studio name, the small "Saskatoon, SK" line above
  it, "by Kelbo" under it (linked to your About page), the description, the
  two buttons, and the live sun
- `<!-- 2. Games -->`: the "Pick a game" cards (filled in from `projects.json`)
- `<!-- 3. Modes -->`: the Games / Trading / All tiles, each with a small drawing behind its words (the `<svg class="tile__art">`; its colours are in `style.css` under Mode tiles)
- `<!-- 4. Contact -->`: the contact form, and your links in the card
  beside it

Everything about you is on its own page, `about.html`: your character
sheet (the purple header with Class, Home base and Studio, then Backstory,
Abilities, Party members, Side quests and Status). The rest of the site speaks as Longlight Interactive, except
Trading and the journal, which are in your own voice.

Only change the words between the tags, like this:

```html
<p>Change only this sentence.</p>
```

The intro text on the All (`projects.html`), Games, Trading, and Tools pages is near the top
of each page's `.html` file.

The about text and project summaries are first drafts. Rewrite them in your
own words whenever you like.

## Add a project

Open `projects.json` and copy one of the blocks between `{` and `}`.
Paste it after the last one and change the values:

**The order in this file is the order on the site.** The Games page,
Projects page, What's new and the home cards all follow it from top to
bottom, so it's your own ranking (games are Prairie Engine Works, Lombard, Escapement,
Scrapline, Ink, Station Keeper, Season Ticket, Frontier Lab, The Whip, Red Skies).
To move something up, cut its block and paste it higher. A new block pasted
at the bottom shows up last. Only the Projects page's filter buttons run in
progress order.

```json
  {
    "title": "My new thing",
    "status": "In development",
    "category": "Tool",
    "summary": "One or two sentences on what it is.",
    "version": "",
    "latest": "",
    "link": "",
    "code": "",
    "image": "",
    "featured": false
  }
```

- **status**: use one of these, from most to least done:

  | Status | Means | Pill |
  |---|---|---|
  | `Complete` | Done and won't change | solid clay |
  | `Released` | Out, but may still get updates | solid clay |
  | `Live` | Keeps running with regular updates, like the journal | clay outline |
  | `Polishing` | Nearly there | purple |
  | `In development` | Being built | purple |
  | `Prototype` | Early, rough version | purple |
  | `Concept` | Just an idea, not started | lilac outline |

  The old names (`Finished - For Now`, `Building` and so on) still work,
  but the site check will suggest the new one.
  This sets how far along the progress bar the little sun sits.
- **category**: which section it shows up in: `Game`, `Trading`, or `Tool`.
  Trading is anything for the trading day; Tool is every other handy tool.
  Everything shows on All.
  Anything else still shows on the Projects page, just not in a section.
- **version** and **latest**: the version note under the summary, like
  "v1.4.0.0 · Added night mode". `version` is just the number
  (`"1.4.0.0"`); games always use four numbers, Major.Minor.Patch.Build,
  and the Site check warns about a game with fewer. `latest` is a few
  words on what changed. Either can stay `""`, and the line disappears if
  both are empty. Every game shows the version number its game reports;
  fill in `latest` when
  you ship something. The What's new page (`whats-new.html`) lists every
  project that has a version or a `latest`, in the same order as this
  file, so updating these two fields updates that page too.
- **link**: a web address, or leave it as `""` for no link. A link can
  also point to a page in this repo later, like `tools/my-tool/`.
  Tapping anywhere on a project card opens this link. On a game card,
  tapping the card opens the game's info page instead, and only the "Play it"
  button goes straight to the game (the code link and the screenshots still
  work on their own).
- **code**: the GitHub repo address, or `""`. Shows a "See the code" link.
- **image**: a cover picture, like `assets/covers/my-game.jpg`, or `""`
  (a purple tile with the initials). The brief, the journal and Agent Fleet
  use drawn covers in the five site colours, not screenshots.
  Without one, the card gets a coloured cover with the project's initials.
  Covers are shown 4:3 (640 × 480 is perfect) and should stay under 100 KB.
  Also add a sharp copy at double size with `@2x` before the `.jpg`
  (`assets/covers/my-game@2x.jpg`, 1280 × 960). Big phones like an iPhone
  16 Pro Max show that one, so the cover isn't stretched and blurry. If it's
  missing the site uses the small one and the Site check gives a warning.
- **featured**: no longer changes the home page, which now shows every game
  in one swipe row under "Pick a game", in the order they have in this
  file. The four marked `true` are the covers in the link preview picture.
- **clip** (optional): a short silent video on the game's own page, under
  "See it move": `"clip": "assets/clips/my-game.mp4"`, with a still picture
  of the same name ending `.jpg` beside it. Ask Claude to record one.
- **cardClip** (optional): the short silent loop that plays on the game's
  card, in place of its cover, while the card is on screen:
  `"cardClip": "assets/clips/my-game-card.mp4"`. It is the same shape as
  the cover and starts on the cover picture, so the two are recorded
  together. Ask Claude to record them.
- **shots** (optional): screenshots for the card's "Screenshots (4)" drawer.
  Add a list under the project, each with a picture and a short
  description for screen readers:
  `"shots": [{ "src": "assets/shots/my-game-1.jpg", "alt": "The title screen" }]`.
  Put the pictures in `assets/shots/`, about 360 pixels tall as JPGs (under
  40 KB each); portrait and landscape can mix, since they all show at the
  same height. The drawer shows on the Games and Projects pages, not on the
  home page's short cards, and the pictures only download when it's opened.
  Each screenshot also gets an `@2x` copy at double size (about 720
  pixels tall), the same way as covers.

- **story** (optional): a longer write-up for the game's own page
  (`game.html?g=<name>`, where the name is the title in lowercase with dashes,
  like `prairie-engine-works`). A blank line starts a new paragraph. The page
  works without it, and shows the summary, cover, every screenshot, the
  buttons and links to the other games. On the live site each game also
  gets its own address, like `game-frontier-lab.html`, made by the deploy:
  share that one and the link preview shows the game's cover and summary
  instead of the studio card. You never edit those files (they aren't in
  the repo); a new game gets one on the next deploy. Its **Play here** button opens the
  game inside the page, over the whole screen, with Full screen, New tab
  and Close on a bar at the top (the phone's Back button closes it too).

**Adding a game:** use `"category": "Game"` and it shows up on the Games
page automatically, with a big clay "Play it" button. Each game lives in its
own repo with GitHub Pages turned on, so `link` is that game's Pages address
(like `https://redskies.longlight.games/`) and `code` is the repo address.

**Watch the commas.** Every block needs a comma after its closing `}`,
except the very last one. If the projects disappear and the page says
"Projects couldn't load right now", it's almost always a missing or extra
comma or quote. Pasting the file into https://jsonlint.com will point to the
exact spot.

## The "Now building" strip

Under the home page hero there's a strip of what you're working on this
week. It comes from `now.json`:

```json
{
  "updated": "2026-10-15",
  "items": [
    { "text": "Finishing touches on Prairie Engine Works", "link": "https://pew.longlight.games/" },
    { "text": "Something with no link" }
  ]
}
```

- Change `updated` to today's date whenever you edit it. The strip shows
  "Updated today", "Updated 3 days ago", and so on.
- Each item is a pill. `link` is optional.
- To hide the strip, leave `items` as `[]`.
- Every Sunday the Devlog Writer suggests new lines for it from the
  week's game work, in the same pull request as its devlog drafts (see
  below). You can still edit it by hand any time.

## Add or swap images

1. In the GitHub app or website, open the `assets` folder and choose
   **Add file → Upload files**.
2. Use short lowercase names with no spaces, like `headshot.jpg`.
3. Show it in a page with:

   ```html
   <img src="assets/headshot.jpg" alt="Kelbo smiling at the camera" width="400" height="400">
   ```

   Always write `alt` text describing the picture for people who can't see it.
   Keep photos under about 500 KB so the site stays fast on phones.

To change the browser-tab icon, replace `assets/favicon.svg` (or upload a
`favicon.png` and change `favicon.svg` to `favicon.png` in every page).
Browsers hold on to old icons, so every page links them with `?v=3` on the
end (and so does `site.webmanifest`). Bump that number (to `?v=4`)
everywhere when the icon changes.

### The logo

The logo is the Longlight "horizon lockup": the sun sitting on a line that
runs under LONGLIGHT, with INTERACTIVE spaced out below it. It's drawn in
each page's header and footer as an SVG (the letters are shapes, not text,
so they never wait on the font). Phones show the short version (just the
sun on its line) and wider screens show the full lockup, which also has
the ray: a faded clay beam running from the sun to the right edge, just
under LONGLIGHT (`logo__ray`). The colours come
from the theme: the line is ivory in light mode and purple in dark mode
(`--logo-line` in `style.css`).

The sun has a soft clay glow and a thin halo ring around it. When a page
opens, the sun rises up out of its line, then the halo and glow come in
and the ray shoots out to the right, and it lifts a little when you hover over the logo. Anyone with "reduce
motion" on just sees the finished logo. The glow's blur is set once per
page, inside the footer logo (`<filter id="logo-glow">`), and the header
borrows it, so leave that `<defs>` block in the footer. The letters live
in the same `<defs>` block (`ll-word` for LONGLIGHT, `ll-sub` for
INTERACTIVE), and both logos show them with `<use href="#ll-word">`, so
each page has just one copy of them.

### The link preview

When someone shares a link to the site in a text, Discord, or X, the app
shows a preview card. That card is `assets/social-preview.jpg` (1200×630).
It shows the sun with the same glow and halo as the logo. To change it,
upload a new picture with the same name and size, then bump the `?v=19` on
the end of every page's `og:image` line (to `?v=20`) so apps fetch the new
one. Apps remember old previews for a while, so a change can still take a
day or so to show up when you share the link.

The preview's title and description come from the `og:` lines near the top
of each page. Those are the one place on the site that uses full web
addresses (`https://longlight.games/...`), because the apps reading them
aren't on this site. If the site ever moves to another domain, update them.

## Add a new section

Say you want a "Music" section next to Games, Trading, and Tools:

1. Copy `tools.html` to `music.html`. Change the `<title>`, the description,
   the `<h1>` and intro line, and `data-category="Tool"` to
   `data-category="Music"`.
2. In `index.html`, copy one of the tiles under `<!-- 3. Modes -->` and
   change its link, name, line, drawing, and `data-category-count="Music"`.
   Add `"Music"` to `KNOWN_CATEGORY` in `.github/scripts/check-site.mjs`.
3. Optionally add it to the menu (`<ul class="nav">`) in every page. Keep the
   menu short so it fits on one line on a phone (it holds four items now).

## Change colours or fonts

The site uses the Longlight Interactive brand: five colours (Clay, Purple,
Slate, Ivory, Lilac) and one font, Space Grotesk. Open `style.css`. The
brand colours are the `--ll-` lines at the very top. Under them are the
light theme (daytime), then the dark theme (after sunset). Change a value
like `#7B3FC4` (the purple) and every place that uses it updates.

The font file lives on the site itself, in `assets/fonts/` (its free
licence, `OFL.txt`, sits beside it), and the `@font-face` lines at the top
of `style.css` set it up. Each page's `<head>` asks for the file early
(`rel="preload"`) so the text shows in it sooner.

### The glass look

The header, cards, buttons and pop-ups are frosted glass, like the newer
iPhone screens: see-through panes that blur what's behind them, with a
bright edge where the light catches. Three soft blobs of lilac, clay and
purple sit behind the page so the glass has something to show as you
scroll. It's all in the **Glass** section of `style.css`, near the bottom:
`--glass` is how see-through a card is (raise the last number, like
`0.55`, to make it more solid), and `--glass-blob-1/2/3` are the blobs.
Each pane also has a lens edge: a thin ring of light, a clay fringe on
one side and a lilac one on the other, like light splitting at the rim of
thick glass. The ring moves with the Tilt sky setting on a phone, or the
mouse on a computer. On Chrome (computers and Android) the edge really
bends what's behind it, like Apple's glass; Safari on iPhone can't do
that part yet, so there you get the ring and fringes only.
Phones with **Reduce transparency** turned on (Settings, Accessibility,
Display & Text Size) get plain solid cards instead.

## The live sun

The sun in the top band of every page is the real sun over Saskatoon. It
rises on the left, crosses as the day goes on, and sinks behind the
horizon line at sunset. In the last 20 minutes before sunset the purple sky
warms up, and when the sun goes down the whole site switches to its dark
theme and the real stars come out. It's all worked out on the visitor's phone from the
date and time, so there's no internet service or key involved (apart
from the optional weather, air quality and northern lights, below).

- **The ☀/☾ button** in the header lets a visitor pick light or dark
  instead. Tap it to go light → dark → back to following the sun. Their
  phone remembers the choice.
- **To see a time of day** without waiting for it, add `?at=` to the
  address: `?at=noon`, `?at=sunrise`, `?at=sunset`, `?at=dusk`, `?at=night`,
  or an exact Saskatoon time like `?at=2026-06-21T21:30`. Only you see it.
- **To move it somewhere else**, change `YXE` near the "LIVE HORIZON"
  heading in `main.js` (latitude, longitude, and time zone).
- **The sun's look:** the sun has the same soft glow and thin halo ring
  as the logo, and the glow slowly breathes. The disc has a warm, paler
  middle that deepens toward a crisp edge, and a ring of fine rays turns
  slowly around it (once every two minutes). Near sunrise and sunset the
  glow grows bigger and stronger, like a real low sun. Under the sun (and
  the moon at night) a clay shimmer ripples on the ground strip, like
  light on water. At night the stars twinkle. The breathing, rippling and
  twinkling (and the turning rays) are all switched off for anyone with
  "reduce motion" on.
  The look is in the "live horizon" part of `style.css`, and the
  animations are near the bottom of it.
- **The stars:** the night sky shows the real stars over Saskatoon right
  now: the brightest named stars (Sirius, Vega, Orion's belt and so on),
  each where it really is. The sky strip faces south, so east is on the
  left edge, south in the middle and west on the right, and higher stars
  sit higher. They turn slowly across the sky through the night and race
  round during the opening spin. The bigger, glowing dots are the
  brightest stars. On the home page, faint lines join the stars of
  well-known constellations (Orion, the Big Dog, the Twins, the bull's
  horn, Leo, the Summer Triangle, the Swan, the Eagle, Pegasus and
  Andromeda); a line only shows while both its stars are up. The small
  skies at the top of other pages only show the brightest stars and no
  lines. The star list is `STARS` in `main.js`, and the lines are
  `CONSTELLATION_LINES` (pairs of star names, easy to add to).
- **The planets:** Mercury, Venus, Mars, Jupiter and Saturn come out
  with the stars, each where it really is tonight (worked out from their
  orbits, within about a tenth of a degree). They're steady ivory dots
  that don't twinkle, like real planets, and Mars is clay like the red
  planet. On the home page each one has its name beside it. They drift
  slowly against the stars from night to night. The orbit numbers are
  `PLANETS` in `main.js`. Try `?at=2026-10-16T05:30` for Mars, Jupiter
  and Saturn before sunrise.
- **The moon:** the clay moon with its soft glow is the real moon over
  Saskatoon, worked out from the date like the sun. It shows its real
  phase (crescent, half, gibbous, full, or just a faint disc at new moon)
  and follows its real path: it rises on the left, climbs as high as the
  real moon does, and sets on the right on its own schedule. At night
  it's the full clay moon with its glow. By day, when the real moon is
  up, it's a faint, pale ghost with no glow, like the real daytime moon
  (a thin crescent near the sun almost vanishes). It changes over as
  the sun gets low (from 6 degrees up to 2 degrees under), so around
  sunset and sunrise the sun and the moon share the sky for a little
  while. On nights when the real moon isn't up, there's no moon. At night the line under the horizon says which
  moon it is and where: "Waxing crescent moon over Saskatoon", or
  "Waxing crescent moon rises 2:31 PM" when it's down. It floats up and
  down a little and its glow breathes. Its look is `.horizon__moon` in
  `style.css`, and the maths is in the moon part of `main.js`
  (`moonPhase`, `moonAltitude`, `placeMoon`). Try a full moon with
  `?at=2026-10-26T23:30`.
- **The opening spin:** when someone opens the site or refreshes, the sun
  plays through a whole day in about 4.5 seconds (rises, crosses, sets,
  comes back up) and lands where the real sun is. It doesn't replay on
  every link tapped, and it's skipped for anyone with "reduce motion" on.
  To change the speed, edit `SPIN_MS` near the top of the sun code in
  `main.js` (4500 = 4.5 seconds).
- **Swiping through time (phones and computers):** slide a finger left or
  right along the horizon (or click and drag with a mouse) and the sky winds backward or forward: the sun, moon, stars
  and planets move to where they'd be, the page goes dark after sunset,
  and the readout shows the time you're looking at ("Tomorrow 1:52 AM").
  Flick it and it keeps spinning a moment, slowing down like a wheel.
  Once it stops it stays put for a couple of seconds, so you can grab it
  again and keep going, then everything slides back to right now. Up and down swipes
  still scroll the page. With a mouse the cursor turns into a hand over
  the sky. The numbers are at the top of the swipe code in `main.js`:
  `SWIPE_HOURS` (hours per full screen width, 10; bigger is faster),
  `SWIPE_MAX_HOURS` (how far either way, 36), `SWIPE_GLIDE_MS` (how long
  a flick coasts, 550; bigger glides further), `SWIPE_HOLD_MS` (the
  wait before it heads back, 2000 = 2 seconds) and `SWIPE_BACK_MS` (how
  long the slide back to now takes, 8000 = 8 seconds).
- **The readout takes turns:** every 6 seconds the left side of the line
  under the home page horizon swaps with a second fact. By day it's how
  today's light compares with yesterday's ("3m 55s shorter than
  yesterday"), worked out to the second. For three weeks after the
  shortest day in December it says "Days are getting longer again". Around
  sunrise and sunset it names golden hour (the sun between 4° under the
  horizon and 6° up, the warm light photographers chase) and blue hour (4°
  to 6° under), with how long is left: "Golden hour · 24m left". The
  timing is `READOUT_TURN_MS` in `main.js` (6000 = 6 seconds). Try
  `?at=sunset`.
- **Shooting stars:** on dark nights a meteor streaks across the sky every
  half a minute or so. On the nights around the big yearly meteor showers
  (Quadrantids, Lyrids, Eta Aquariids, Perseids, Draconids, Orionids,
  Leonids, Geminids, Ursids) there are more, and they fly out from the
  shower's real spot in the sky, the way real ones do. The higher that
  spot is, the more there are. At night the readout mentions it too
  ("Orionids peak tonight", "Geminids active · peak Dec 14"). Tap a
  shooting star to make a wish; the phone counts them ("That's 3 on this
  device"), shows the count and badges in **Sky this week**, and nothing is
  sent anywhere. They're off with "reduce motion"
  on. The shower list is `SHOWERS` in `main.js` (peak date, spot in the
  sky, and how busy it gets), and `METEOR_EVERY_S` sets the ordinary-night
  rate (30 = one every 30 seconds on average). Try
  `?at=2026-12-14T02:00` for the Geminids.
- **Tap the sky:** tap (or click) a star, planet, the moon or the sun and a
  little label says what it is plus a fact: when the starlight you're
  seeing left it ("This light left it in 2001"), how far a planet is
  tonight and how long its light takes, how much of the moon is lit, or
  how long sunlight takes to get here. Star distances are `STAR_LY` in
  `main.js`, in light years.
- **Hold the sky:** press and hold on the sky (finger or mouse) for half a
  second and it winds on to just after the next sunset, so the site goes
  dark and the stars come out. At night it winds on to the next sunrise
  instead. Let go and it slides back to now a couple of seconds later.
  `HOLD_START_MS` and `HOLD_RUN_MS` in `main.js` set how long to hold and
  how long the wind takes.
- **Real weather:** the sky shows Saskatoon's weather right now. Clouds
  drift past (more of them the cloudier it is), rain or snow falls,
  lightning flashes in a thunderstorm, fog sits low on the horizon, and an
  overcast sky goes pale and hides the stars. While real snow is lying on
  the ground, a thin band of snow sits under the horizon line. The readout
  takes turns with it too ("Light snow · −4°C"). It comes from
  Open-Meteo, a free weather service with no key, checked at most every
  15 minutes. If it can't be reached, the sky carries on without it (snow
  on the ground then just follows the usual Saskatoon winter, late
  November to late March). Preview it with `?weather=` plus `clear`,
  `cloudy`, `overcast`, `rain`, `snow`, `storm` or `fog`.
- **Northern lights:** when NOAA's space weather feed (free, no key,
  checked at most every 20 minutes) says the lights are likely this far
  south (a Kp index of 4 or more), soft lilac and purple curtains ripple
  across the top of the night sky, each with a thin ivory glow, stronger
  the bigger the storm (real lights are often green, but the site's five
  colours have none, so they stay lilac), and the
  readout says "Northern lights likely · Kp 5". Only on dark, clear nights.
  Preview with `?kp=6&at=night`.
- **Prairie seasons:** from mid September to mid November (heading south)
  and late March to early May (coming back), V's of Canada geese fly
  across the daytime sky every so often, flapping as they go. From mid
  June to early August, fireflies blink low over the ground on dry nights.
  These follow the calendar, so they need no internet, and they're off
  with "reduce motion" on. Try `?at=2026-07-10T23:45` for fireflies.
  `GEESE_EVERY_S` in `main.js` sets how often a flock comes over.
- **The day sky:** the weather also brings a few daytime extras. Each one
  only shows when the real conditions are right, and quietly stays away
  if the weather can't be fetched:
  - **Sun dogs:** on a cold day (about −10°C or colder) with thin high
    cloud and a low sun, a bright spot sits either side of the sun with a
    faint ring through them. Preview `?at=2027-01-12T11:00&weather=sundogs`.
  - **Wildfire smoke:** when the air is smoky (from Open-Meteo's free air
    quality feed), the sky goes hazy, the sun turns a deeper red and loses
    its halo, and the readout says "Smoky out there today" ("Thick smoke
    today" on a bad day, like the preview). `SMOKE_PM` in `main.js` sets
    how much smoke it takes. Preview `?at=noon&weather=smoke`.
  - **Rainbow:** just after rain, with the sun out and fairly low, a
    rainbow (and a faint second one) appears on the far side of the sky
    from the sun (never under or round it), and the readout says which
    way to look. Preview
    `?at=2026-09-10T17:30&weather=rainbow`.
  - **Heat shimmer:** from 28°C (`HOT_C`), the horizon line wobbles and
    the air above it ripples. Preview `?at=2027-07-15T15:00&weather=hot`.
  - **Belt of Venus:** on a clear evening just after sunset (or morning
    just before sunrise), a pink band sits low in the sky opposite the
    sun, with the darker Earth's shadow rising under it. Preview
    `?at=2026-07-12T21:55&weather=clear`.
  - **Sun pillar:** on a bitterly cold day (about −10°C or colder) with a
    low sun, a column of light stands straight up from it. Preview
    `?at=2026-01-15T17:05&weather=pillar`.
  - **Venus in daylight:** when Venus is well away from the sun and the
    sky is clear, a small bright dot shows where to look (tap it). Preview
    `?at=noon&weather=clear&critter=venus`.
  - **Cloud shadows:** on a part-cloudy day, soft shadows slide across
    the ground. Preview `?at=noon&weather=cloudy`.
- **The grain elevator:** a wooden prairie grain elevator stands on the
  horizon where the sun is at noon. It is drawn like a real one: a tall
  main house with a steep gabled front, a taller narrow leg house behind
  it, a long sloping annex with a barn door, a cyclone dust collector
  with its pipe, a loading spout, a little scale shed and a utility pole.
  The shape is the `ELEVATOR` list at the top of the grain elevator
  section in `main.js`. Its shadow on the ground follows the real sun:
  long and off to the right in the morning, short and pointing at you at
  noon, long and off to the left before sunset. The readout tells you how
  long your own shadow is right now ("Your shadow is 2.4× your
  height"). Heavy cloud takes the shadow away. After dark
  little windows glow in the gable, the leg house and the annex.
- **The railway:** a little station depot (Longlight Station) stands just
  to the right of the elevator, with a line of track running across the
  ground in front of both. The depot casts its own shadow like the
  elevator does, and a window glows after dark. Every couple of minutes
  (any hour) a freight train rolls along the rails from one edge to the
  other (off with "reduce motion"; the depot and track stay). Preview the
  train any time with `?critter=train`. `TRAIN_EVERY_S` in `main.js` sets
  how often.
- **The ground through the year:** purple prairie crocuses dot the horizon
  in April and early May, young wheat lines it in June and July, and it
  turns gold from August until harvest in mid September (the site's five
  colours have no green, so the young wheat is pale instead). Saskatoon
  calendar only. Preview `?at=2027-04-20T12:00` or `?at=2026-08-20T15:00`.
- **Things passing by** (all off with "reduce motion"):
  - **Autumn leaves** blow across in September and October, faster and
    more of them in a real wind, going the way the wind blows.
  - **A jet** crosses high up every minute and a half or so by day. Its
    contrail is short on a warm, dry day and hangs about for up to half a
    minute on a cold, damp one.
  - **A hawk** circles on windy weekday afternoons (20 km/h or more,
    above freezing, sun well up), drifting with the wind. In Saskatoon's
    sky it only shows from April to October, when the hawks are around.
    At weekends it's **a kite** on a long string instead (any month).
  - **Pelicans** circle high on warm summer afternoons, slowly drifting
    with the wind (Saskatoon's big white summer birds).
  - **A hot-air balloon** floats over on calm summer weekend mornings and
    evenings, lighting its burner now and then.
  - **Snow buntings**, a tight flock of little white birds, flash and
    wheel low over the snow in winter.
  - Tap any of the birds or the balloon and the readout says what it is.
  - Preview any of them with `?critter=` plus `leaves`, `jet`, `hawk`,
    `kite`, `geese`, `fireflies`, `train`, `pelicans`, `balloon` or
    `buntings` (add `&weather=windy` for a strong wind). `JET_EVERY_S` and `HAWK_EVERY_S` in `main.js` set how often.
- **Winter ground** (needs snow lying, so it uses the real weather):
  - **Frost glitter:** on a clear morning of -10°C or colder, the snow
    flashes with tiny sparkles while the low sun is up.
  - **Drifting snow:** when the wind is 25 km/h or more, pale streaks of
    loose snow slide along the ground the way the wind blows.
  - Preview with `?weather=frost&at=2026-12-15T09:30` or
    `?weather=drift&at=2026-12-15T13:00`.
- **Tap the grain elevator** and it says how long its shadow is and which
  way it points (or why there's no shadow right now). **Tap the depot**
  and it says whether a train is passing.
- **Tap a cloud** and it puffs apart and drifts off. A new cloud drifts in
  from the left a while later.
- **The farm** (the moving parts are off with "reduce motion"):
  - **A windmill** stands left of the elevator. Its wheel spins at the
    real wind speed (still on a calm day) and its tail points downwind.
    Tap it for the wind. Preview a calm day with `?weather=calm`.
  - **Tumbleweeds** roll along the ground on dry days with a wind of
    25 km/h or more (`?weather=windy&critter=tumbleweed`).
  - **The harvest:** while the wheat is gold (August to mid September), a
    combine and its grain truck crawl along the horizon now and then,
    cutting the field to stubble as they go. It grows back a minute later.
    Preview `?critter=combine&at=2026-08-20T14:00`.
- **Holidays**, from the calendar: on **Halloween** bats flutter across
  after dusk, a jack-o'-lantern sits at the elevator's foot and the
  windows flicker like candles. Through **December** the elevator wears a
  string of lights that twinkle after dark. **Canada Day** (after dark)
  and **New Year's** (11 PM to 1 AM) get fireworks. On **Valentine's
  Day** small hearts drift up the sky all day, and the elevator's windows
  glow lilac after dark. Preview with
  `?holiday=halloween`, `christmas`, `canada`, `newyear` or `valentines`,
  plus `&at=night` for the dark.
- **Thunderstorms:** a bolt of lightning comes down every so often, and
  tapping the sky calls one down where you tapped. A few seconds later
  the thunder: the label says how far away that was (3 seconds a
  kilometre). Android phones buzz with it; iPhones don't let websites
  vibrate. Preview `?weather=storm`.
- **Hold the sun** to play a whole year in 10 seconds: the same time of
  day, a day at a time, so the sun climbs to summer and sinks to winter,
  the moon runs through its phases and the ground goes snow, crocuses,
  wheat, gold. Let go and it rewinds to today. (Holding anywhere else
  still winds on to sunset or sunrise.)
- **The secret parade:** tap the sun 7 times in a row (or type
  "longlight" on a keyboard) and everything comes out at once for 20
  seconds: geese, a jet, the train, a hawk, a kite, bats, tumbleweeds,
  leaves, shooting stars, the northern lights and fireworks. It earns the
  hidden "Parade marshal" badge, which shows as "Secret badge" until then.
- **Badge confetti:** earning a badge throws a burst of confetti from the
  note at the bottom.
- **The tab icon** in a browser is a tiny live copy of the sky: purple
  with the sun where it really is by day, slate with the moon and stars
  at night, and a cloud on a cloudy day.
- **On a computer:** moving the mouse shifts the stars, moon and clouds a
  little against the land (like tilting a phone), and game cards tip
  toward the mouse with a glint on the cover.
- Weather, the air quality, the northern lights, the forecasts and the
  weather alerts are the only parts of the sky that fetch anything. They
  send no personal details, just a request for Saskatoon's weather, air,
  alerts and the latest space weather.
- **Weather alerts:** when Environment Canada has an alert out for
  Saskatoon (a blizzard warning, extreme cold, fog advisory and so on), a
  pill shows on the home page sky, like "! Fog advisory · until 5:39 PM".
  On phones it sits under the horizon line on the right, next to the
  weather and sunrise words; on wider screens it sits on the left, just
  above the line. Warnings are solid clay.
  Tapping it opens Environment Canada's forecast page. It's checked at
  most every 15 minutes, and it only works for places in Canada. Preview
  it with `?alert=warning`, `?alert=watch` or `?alert=advisory`.
- **Eclipses:** worked out from the same sun and moon maths (no
  internet), within a few minutes of the real times. In a lunar eclipse
  the Earth's shadow, a deep copper red, creeps across the moon and covers
  it at totality, and the moon's glow dims. In a solar eclipse the moon
  takes a bite out of the sun, as it really looks from Saskatoon. The
  readout says so while it's on ("Total lunar eclipse · 100% in shadow")
  and in the hours before ("Lunar eclipse tonight · 5:05 AM"). Try
  `?at=2026-03-03T05:30` (total lunar) or `?at=2024-04-08T12:52` (partial
  solar).
- **Your sky:** under "Saskatoon, SK" at the top of the home page there's
  a **See your sky** link. Tapping it asks the visitor's phone for their
  location (rounded to about 10 km) and switches every sky on the site to
  theirs: their sunrise and sunset in their own time zone, their moon,
  stars, planets, eclipses, meteor showers, weather and northern (or
  southern) lights. The readout says "over you" instead of "over
  Saskatoon". Their location is kept only on their device; the only places
  it goes are the weather and air quality checks (Open-Meteo, rounded); the
  space station's orbit is the same for everyone, so that call sends nothing. **Back to
  Saskatoon** switches it back. Geese, fireflies, autumn leaves, the
  crocuses and wheat, and the usual winter snow stay Saskatoon-only,
  since they follow Saskatoon's calendar.
- **Tilt sky (phones):** next to See your sky there's a **Tilt sky**
  link on phones. Tapping it (iPhones ask permission once) makes the sky
  follow the phone: tilt it and the stars, moon and clouds slide a little,
  like looking through a window; turn around and the stars and planets turn
  with you, a "Facing north" label shows in the corner, and the sun or moon
  fades when it's behind you. The other pages' skies follow too. **Stop
  tilting** turns it off. The tilt slide is off with "reduce motion" on;
  the compass still works. `TILT_DEG` in `main.js` sets how far you tilt
  for the full slide.
- **Space station:** on clear dark evenings and mornings the International
  Space Station crosses the sky as a bright steady dot (labelled "ISS" on
  the home page), moving left to right or right to left over a few
  minutes, just like the real one. It only shows when the station is lit
  by the sun and the sky is dark, which is when you can actually see it
  outside. Tap it for how high and how far away it is. Its orbit comes
  from CelesTrak (free, no key) at most every 6 hours, and the phone works
  out where it is from that. If the orbit can't be fetched, or it's more
  than 4 days old, the station just doesn't show. Preview a pretend pass
  with `?critter=iss`.
- **Seasons:** the ray coming off the sun reaches further in summer than in
  winter (full length on the longest day, a bit under half on the
  shortest). On the longest and shortest days of the year a badge appears
  on the home page sky, like "Longest day of the year · 16h 46m of light".
  Preview it with `?at=2026-06-21T13:00` or `?at=2026-12-21T13:00`.

**Sky this week** is the card under "Now building" on the home page. The
phone works it out from the same sky maths (no internet): which planets
are up after dark tonight, the moon's new, quarter and full dates (the full
moon gets its name, like "the Hunter's Moon"), the moon passing close to a
planet, meteor shower peaks (and whether the moon will wash them out),
eclipses, equinoxes and solstices, how sunset moves over the week, and the
space station's best passes (the ones that climb at least 25° high).
Two free forecasts join in when they load. NOAA's 3-day northern lights
forecast adds a "Northern lights possible" (or "likely") line for any
night it's strong enough to reach Saskatoon after dark. Open-Meteo's cloud
forecast puts a little **Clear sky**, **Some cloud** or **Cloudy** tag on
each thing to go out and look at. Preview them with `?kpcast=5` (the
northern lights strength, 0 to 9) and `?clouds=10` (cloud cover, 0 to 100).
Under it is the wish counter, with badges at 1, 10, 25, 50 and 100 wishes
(`WISH_BADGES` in `main.js`). Preview a busy week with
`?at=2026-03-01T12:00` (a total lunar eclipse).

Two small extras ride along on the home page:

- **Continue?** When someone taps Play on a game, their phone remembers it,
  and next time the home page offers that game again under "Pick a game".
  **Pick another** clears it. Nothing is sent anywhere.
- **Market light** on the Trading tile says "Market open" during New York
  Stock Exchange hours (9:30 to 4:00 Eastern, Monday to Friday). It doesn't
  know about holidays.

And one on the Trading page:

- **USD/CAD** under the Trading intro: how many Canadian dollars one US
  dollar buys, with the move from the day before. It comes from the Bank of
  Canada (free, no key), whose number is a **daily average** published once
  each business day in the late afternoon, so it's never a live quote; the
  line says that and shows which day it's for. The phone keeps it for 3
  hours (`FX_MS` in `main.js`). If the bank can't be reached, the line just
  doesn't show.

## The studio sting (sound)

The footer ends with a **Sound off / Sound on** switch. Sound is off for
everyone until they tap it. Turning it on plays the Longlight sting, a
2-second "sun coming up" sound you made with ElevenLabs
(`assets/sounds/longlight-sting.mp3`, credited in
`assets/sounds/CREDITS.md`). With Sound on, it plays once per visit as the
logo rises. Phones don't allow sound before you touch the screen, so there
it plays at your first tap instead. To swap the sound, replace that file
(keep the name, or change `STING_URL` in `main.js`).

## Motion

The animations are at the bottom of `style.css` under "Motion": pages fade
into each other (the header and the page-top sky stay put while the rest
changes, in browsers that support it, like Safari 18.2+ and Chrome), sections and cards slide up as you scroll, the sun glides
to its new spot, and buttons and cards lift when you tap them. On the
Projects page, cards glide into place when you tap a filter.

The sun moves too. The logo's sun gently glows, sits a little lower near
sunrise, sunset and at night (matching the real sun), and rises in time
with the sting when Sound is on. The big sun on the sky turns squashed and
wobbly near the horizon, its edge ripples in the last minutes before it
sets, its rays flicker on a windy day, and tapping it sends a lens flare
across the sky. Preview the low sun with `?at=sunset` and the wind with
`?weather=windy`. In Firefox the tab icon's sun glows too. Anyone whose
phone is set to **Reduce Motion** (iPhone: Settings → Accessibility →
Motion) sees the same site with nothing moving. Turn that setting on to
check it.

## Offline

`sw.js` is the offline helper (a "service worker"). Once someone has
opened the site, their phone keeps a copy of every page and file they
visit, plus the main pages straight away, so it still opens with no
signal. Online it always fetches the newest version first, so your edits
show up as normal. If it ever seems stuck on an old version, change
`CACHE` at the top of `sw.js` (for example `"longlight-2"`) and the old
copies are thrown away. It only ever throws away the site's own
`longlight-` copies, never the games' ones (they share the same space).

### Keeping game saves safe

Each game has its own address (`pew.longlight.games` and so on), so the
phone keeps each game's saves separately, and each game asks the browser
to keep them even when space runs low. Each one can also save its save
code as a backup file and reminds players to do that now and then. Saves
from before the move (November 2026) stay on the old `jxstrr0.github.io`
address.

## Previewing on a computer

Opening `index.html` straight from your files won't load the projects,
because browsers block reading `projects.json` that way. Either look at the
live site after committing, or in this folder run:

```
python3 -m http.server
```

and open http://localhost:8000.

## Rules for this repo

- **No secrets, ever.** This repo is public. Never put API keys, passwords, or
  tokens in any file, even "just for a minute". Anyone can read them, and git
  history keeps them after you delete them. Future AI tools that need a key
  will need a different setup, so plan that first.
- **Nothing private, either.** Everything here is public, not just the
  pages: every data file, the notes in `.github/`, commit messages, pull
  request text and the robots' run logs. Never put your real name, email,
  phone, address, birthday, school or employer names, family details,
  broker or bank names, account numbers, account sizes, dollar profits or
  losses, or anything from your email, Drive or brokerage anywhere in it.
  The Site check catches the machine-shaped ones (see above); the rest is
  a read before merging. If something private does land, tell Claude or
  fix it straight away, but know that deleting it in a new commit isn't
  enough: git history keeps it, and only rewriting the history removes it.
- **Keep it static.** No servers or anything that has to keep running.
- **The copyright line** in every footer says "Kelbo / Longlight
  Interactive". You own the copyright on everything here automatically.
  If you ever register Longlight Interactive as a business name, the line
  can drop "Kelbo /".

## The contact form

The form under "Get in touch" on the home page sends messages through
Web3Forms (web3forms.com), a free service that emails them to you. Your
email address isn't anywhere on the site. Web3Forms knows it from when you
made the access key, and the key in `index.html` (`name="access_key"`) is
all the page needs. The key is meant to be public: all anyone can do with
it is send you a message.

- Messages arrive with the subject "New message from Kelbo.Website", so a
  Gmail filter on that subject can put them in their own folder.
- To send them to a different email, make a new key at web3forms.com with
  that address and swap it into `index.html`.
- A hidden checkbox catches spam bots. Real visitors never see it.
- Web3Forms only accepts messages sent from a real browser, so test it on
  the live site, not from a script.

## The trading journal

`journal.html` shows your market views, trades, and record. All of it comes
from `journal.json`, so that's the only file you edit. To add an update,
paste a block like this right after the `[` at the top (newest first is
easiest, but the page sorts by date anyway):

```json
  {
    "date": "2026-10-14",
    "title": "Short headline",
    "bias": "Bullish",
    "view": "What I think the market is doing and why.\n\nA blank line like that starts a new paragraph.",
    "trades": [
      { "symbol": "SPY", "side": "Long", "result": 1.2, "note": "Why I took it" },
      { "symbol": "TSLA", "side": "Short", "note": "Still open" }
    ],
    "ai": "What the AI coach said about this entry.",
    "lesson": "One thing to keep doing or fix."
  },
```

Bigger forecast entries can also have calls, scenarios, levels, a sector
board, a schedule, and trading rules. The first entry in `journal.json` uses
all of them, so copy from there when you want the full version. Every part
is optional except `date`.

- **calls**: each one has `call`, `wrongIf` (what would prove it wrong), and
  `grade`. Leave `grade` as `null` until it's settled, then set it to
  `"hit"`, `"partial"`, or `"miss"`. The record's call score counts a hit as
  1 and a partial as half.
- **gradeBy**: the date the calls get graded, shown above them.
- **recap**: what actually happened, written when you grade.
- **bias**: `Bullish`, `Bearish`, `Neutral`, or `""` for none.
- **result**: the gain or loss in percent. `1.2` means +1.2%, `-0.8` means
  -0.8%. Leave it out while a trade is still open. Fill it in later and the
  record updates itself.
- **The record** at the top is worked out for you: the call score from
  your graded calls, and the options numbers from `options.json` (see
  below). You never type it. Above it, a one-line "Week of Oct 14: 3 hits,
  1 partial, 3 misses" tally shows the newest entry's graded calls (nothing
  shows until a call has a grade).
- **ai**: the AI coach's notes. Easiest way: send Claude your views and
  trades, and ask it to write the entry with a coach note. Or paste in
  feedback from any AI chat. Use `""` to leave it out, same for `lesson`.
- Same comma rule as `projects.json`: a comma after every `}` except the
  last one, and an empty journal is just `[]`.

Only post what you're happy for anyone to read. The site is public, so
percentages are safer than dollar amounts or account sizes.

### The weekly robots: Forecaster and Scorekeeper

Two robots now write and grade the weekly forecast for you, using the
same `ANTHROPIC_API_KEY` secret as the brief:

- **Forecaster** (Sunday night, 7:45 pm, with back-up tries at 9:15 pm
  and 4:35 am Monday):
  Claude Opus 5.5 on high effort, with web search, writes "Forecast for the
  week of ..." with the TLDR, view, sector board, 4 to 6 calls (each with a
  "wrong if"), scenarios, levels, schedule and plan, and puts it at the top
  of `journal.json`. Its note says it was written by the robot, and a
  "Sources" fold lists the pages its numbers came from. If you've already
  written an entry for that week, it leaves the week alone. About 50 cents
  to US$1 a run (batch price, below).
- **Scorekeeper** (Sunday around noon, 11:35 am, back-up at 1:15 pm and a
  5:45 pm pickup for a slow batch, so Friday's close is graded before the next forecast):
  Claude Opus 5.5 on high effort (Sonnet 5.5 until Nov 9, 2026), with web search, grades each call hit,
  partial or miss with a one-line "What happened", then writes the recap,
  the AI coach note and the lesson. It grades your own hand-written
  entries too, if their `gradeBy` day has passed and a call is still
  `null`. It never changes a grade that's already there, and a call it
  can't confirm stays ungraded rather than guessed. About 40 to 70 cents
  a run (batch price).

**Batch price.** Neither result is needed straight away, so both (and the
Coach and the Devlog Writer) send their request as a "batch": Anthropic answers when it has
room, at half the token price. The answer usually comes back within an
hour while the run waits. If it takes longer than about 5 hours, the run
saves its place in `.github/batches/` and the next try picks up the same
request, so nothing is paid twice. You don't need to do anything. The API
Call Log shows a dashed **Batch** tag on these robots.

Both have a **Run workflow** button on the Actions tab with a "dry run"
box (shows the result in the log and saves nothing) and a box to redo
the week. You can still edit anything they wrote in `journal.json`.

### Options trades

Your options trades live in `options.json`, not in the entries. The page
shows them newest first, with a bar for each trade's return, a running-total
line under the bars (it adds each trade's return in order, so read the slope
and not the number; it follows the S1.0/F3.3 filter too), S1.0/F3.3 filter
buttons, and the options numbers in the record (closed trades; win rate without
scratches, with the rate counting scratches as not a win in small print
under it; average return; and wins–losses–scratches).

To log a trade, paste a block like this inside the `"trades": [ ... ]` list
(oldest first, so new ones go at the bottom), and change `"updated"` at the
top to today's date:

```json
    {
      "opened": "2026-10-14",
      "closed": "2026-10-14",
      "symbol": "MARA",
      "strike": 8.5,
      "type": "put",
      "expiry": "2026-10-23",
      "paid": 0.425,
      "sold": 0.54,
      "system": "F3.3",
      "note": "Short note about the trade."
    },
```

- **paid** and **sold** are the option's price per share, like your broker
  shows. The page works out the return: `(sold − paid) ÷ paid`. A trade
  sold for what it cost counts as a scratch.
- **Still open?** Leave out `"closed"` and `"sold"`. It shows as Open and
  isn't counted until you add them.
- **type** is `"call"` or `"put"`. **system** is `"S1.0"` (Swing) or `"F3.3"` (Flip); the
  `"systems"` list at the top explains each one, and a new system there gets
  its own filter button.
- **ai** at the top is the AI coach's note on the whole options record.
  Claude refreshes it when you send new trades.
- Number of contracts and dollar profit are left out on purpose, so the
  public page only shows percentages. Keep those in your own ledger.
- Easiest way: send Claude the new lines from your ledger and it'll add
  them.

## The weekly scan

The Agent Fleet page shows a weekly market scan: how the big indexes did,
the week's biggest gainers and losers, and next week's earnings and
economic reports. It lives in `scan.json` and `scan.js` puts it on the page.

- **Who writes it:** a scheduled Claude routine called "Longlight weekly
  scan" runs every Saturday at 8:55 am Saskatoon time on your own Claude
  plan. It searches the market news, rewrites `scan.json`, and merges it
  into `main` like any other change. No API key, nothing secret in the repo.
- **Pause, change or run it now:** open Routines in the Claude app
  (claude.ai/code). You can turn it off, change the day or time, or tap Run
  to get a fresh scan right away.
- **Editing by hand:** the fields are listed at the top of `scan.js`. Each
  mover's `change` is the week's move in percent (`12.3` means +12.3%).
  Set `"week"` to `""` to hide the scan and show "first scan lands
  Saturday" instead.
- The numbers come from news searches, so the page says to double-check
  them, and lists its sources.

## The pre-market brief

`briefs.html` shows a short brief on MU and the AI hardware names every
weekday morning: overnight and Asia, a gap call and key levels for MU
(from November 5 to 6, 2026 the briefs also had a SOX section; it was
dropped on November 9), one line per watchlist name, and the day's calendar in Eastern and
Saskatoon time. Each brief is a Markdown file in `briefs/`
(`2026-11-02.md`). The archive list is split up so the page never loads
all of it: `briefs/index.json` lists the months (and the latest brief),
and `briefs/months/2026-11.json` holds one month's headlines. On the page,
Past briefs folds by year, then month; a month's list only downloads when
you open it.

- **Who writes it:** the **Morning Writer**
  (`.github/workflows/premarket-brief.yml`) is started by the **Robot Timer**
  (below) every weekday at 6:30 am Saskatoon time, with a back-up try at
  7:15. The first try writes the brief; the back-up sees it's there and stop without calling
  Claude, so you only pay once. It runs `.github/scripts/premarket-brief.mjs`, which asks
  Claude (with web search) for the brief, saves it, commits it to `main`,
  and starts the **Deploy site** run so it goes live a few minutes later.
- **The key:** it uses the Anthropic API, so the repo has one secret,
  `ANTHROPIC_API_KEY`, under Settings → Secrets and variables → Actions.
  The workflow only ever reads it from there. Never paste the key into a
  file. If it ever leaks, make a new key on the Anthropic console and
  replace the secret.
- **Run it now:** Actions tab → Morning Writer (pre-market brief) → Run workflow. It skips
  the day if today's brief already exists; tick the box to rewrite it.
- **If it fails:** the run shows a red ❌ with the reason. "Missing
  ANTHROPIC_API_KEY" means the secret is gone or misnamed. An "API error
  401" means the key no longer works. A "push" error means Settings →
  Actions → General → Workflow permissions needs "Read and write".
- **Changing it:** the watchlist, the rules and the layout of the brief are
  all in `SYSTEM` near the top of `premarket-brief.mjs`, in plain English.
  The times live in the Robot Timer (below), not in the workflow.
  It can run up to 35 web searches a brief (`MAX_SEARCHES`) and open up to
  25 whole pages on any site to read the actual numbers (`MAX_FETCHES`),
  following a rough search plan in `SYSTEM` (most of it on MU). It calls
  the model named in `MODEL`: Claude Fable 5.2 (`claude-fable-5-2`), the
  top model, on high effort (`EFFORT`). It costs a fifth less per word
  than Fable 5.1, which wrote the Nov 9, 2026 brief; before that it was
  Opus 5.5 on xhigh.
- **Yesterday's call:** the robot hands it the previous brief, so it says
  what changed overnight instead of repeating old news, and the MU section
  opens with **Last call:** what the last brief predicted for the open and
  what really happened.
- **Cost:** it uses prompt caching, so re-reading what it already found
  costs a twentieth of the normal price. The end of each run's log says
  how many searches and page reads it used and an estimated cost in US
  dollars (`PRICE` near the top of the script; the Anthropic console has
  the real bill). A normal brief costs about US$3.50 to US$5.
- **Spending cap:** one brief can't run up much more than about US$6.
  The script keeps a running total as it goes. Past US$4 (`WRAP_UP_AT`) it
  stops researching and tells Claude to write the brief from what it has.
  Each reply is also kept short enough that the total stays under US$6
  (`HARD_CAP`), and nothing more is sent once it gets there. A dropped
  connection isn't retried (that would cost a second brief); the 7:15 back-up
  run tries again instead. To change the cap, edit those two numbers.
- **Same headings every day:** the page expects `# headline`, `TLDR:`,
  then Overnight and Asia, MU, Watchlist and Calendar, even on a holiday.
  If a brief comes back without them, the script asks Claude once to
  rewrite it in that format (no new searching) before saving it.
- **New brief alert:** for an hour after a brief goes out, every page shows
  a flashing dot on the Trading link at the top, the brief's card says
  "New", and the brief page says "New · posted 6:34 am". The time comes
  from `briefs/latest.json` (just the date and time, a few bytes, so every
  page load stays small), which the robot writes. The hour is
  `BRIEF_NEW_MS` in `main.js`.
- **Storage limit:** the `briefs/` folder is kept under 30 MB, about 15
  years of briefs. When a new brief would push it over, the robot
  removes the oldest ones from the folder and the archive. They're still in
  the repo's history. The limit is `MAX_FOLDER_BYTES` at the top of
  `.github/scripts/brief-index.mjs`, the script that writes the archive
  lists. Running `node .github/scripts/brief-index.mjs` on its own
  rebuilds them from the briefs in the folder.
- Prices and levels come from web reports, not live quotes, so every brief
  says they're estimates and lists its sources.

## The after-close report card

After the market closes, the **Grader** grades that morning's brief, so
you can see how good the calls really are over time.

- **Who runs it:** the **Grader**
  (`.github/workflows/postmarket-recap.yml`), started by the Robot Timer every
  weekday at 4:45 pm Saskatoon time (back-up try at 5:45),
  after the 4:00 pm ET close in summer and winter. It runs
  `.github/scripts/postmarket-recap.mjs`, which asks Claude (with web
  search) for MU's previous close, open, high, low and close (and the
  SOX's, in index points, when the brief has a SOX section), then grades
  each one's calls the same way:
  - **Gap call:** Right, Partly or Wrong (rules in `SYSTEM` at the top of
    the script: anything within ±0.5% counts as flat, and the size has to
    be within 1 point of the brief's range to be Right).
  - **Key levels:** each one Held, Broke or Not reached.
  - **MU and SOX:** the open and close as a % of the previous close. The
    script works the percentages out itself from the prices.
  Only the briefs from November 5 to 6, 2026 have a SOX section; every
  other card grades MU only. The totals at the top of the After close tab keep MU's and
  the SOX's apart; the SOX line says how many days it covers.
  Anything it can't confirm says "couldn't confirm"; it never guesses a
  price, and it only lists links it really saw that run.
  Claude finds the prices and copies the brief's numbers (the gap range,
  each level's price); the script then does the grading sums itself, so a
  maths slip by the model can't change a grade. The run log says when the
  two disagreed. A dropped connection is retried, and prompt caching keeps
  the repeat reads cheap (the run log ends with the estimated cost).
- **Where it shows:** `briefs.html` has two tabs. **Pre-market** is the
  morning brief, with "Past briefs" at the bottom. **After close** is the
  report card, with the running score ("Report card, 10 graded days: Gap
  call 7 right ...") on top and "Past report cards" at the bottom. Once a
  brief is graded, a "How it did" line under its TLDR links to its card,
  and each card has a "Read that brief" link back. Before the grade is in,
  today's brief says "Graded after the close, around 4:10 pm". Links:
  `briefs.html#after` opens the After close tab, `#after-2026-11-02` a
  past card, `#2026-11-02` a past brief. The brief itself is laid out as
  colour-coded cards: a top card with the headline, TLDR and buttons that
  jump to each section, then MU (clay, with the gap call first, bull and
  bear side by side, a price ladder drawing, and last session's call at
  the bottom), Overnight (purple), Watchlist (lilac, a row per ticker with
  last close and pre-market columns; tap a column heading to sort by it,
  "Ticker" for the brief's order), Calendar (Saskatoon time first, New
  York time under it) and Sources (folded shut). Tap any section's heading
  to fold it; your phone remembers which ones you folded. Lines that
  weren't in the brief before get a clay "New" tag. Price changes show
  purple when up and clay when down. The ladder and the watchlist columns
  come from two fixed-format lines the Morning Writer writes (`**Ladder:**`
  and `| close ... | pre ... |`); older briefs without them just show
  without the drawing and columns. `briefs.js` does the sorting. On a
  computer (64rem and wider) the cards sit side by side, two to four
  across depending on the width; phones keep one column.
- **Where it's saved:** `report-cards/2026-11.json` (that month's grades)
  and `report-cards/index.json` (the totals). The brief files in `briefs/`
  are never touched.
- **Skips:** weekends, US market holidays (worked out in the script, no
  list to update), days with no brief, and any run before the 4:00 pm New
  York close (3:00 pm Saskatoon in winter, 2:00 pm in summer). A skipped
  run stops before asking Claude, so it costs nothing.
- **Cost:** it uses Opus 5.5 at high effort (`MODEL` at the
  top of the script; Sonnet 5.5 until Nov 6, 2026), up to 18 web searches (`MAX_SEARCHES`) and 15 page
  reads (`MAX_FETCHES`). It uses the same `ANTHROPIC_API_KEY` secret as the
  brief. The last line of each run's log is "Estimated cost: US$0.xx".
- **Run it now:** Actions tab → Grader (after-close report card) → Run workflow
  (on a phone, switch to the desktop site if the button doesn't show).
  Tick "Redo today's grade" to grade today again. Before the close it just
  says the market hasn't closed yet.
- **Turn it off:** open it on the Actions tab, tap "..." at the top right,
  then "Disable workflow". "Enable workflow" in the same place turns it
  back on.

## The robots' names

| Name | What it does | When (Saskatoon time) |
|---|---|---|
| **Morning Writer** | Writes the pre-market brief (`premarket-brief.yml`) | Weekdays 6:30 am |
| **Grader** | Grades that brief after the close (`postmarket-recap.yml`) | Weekdays 4:45 pm |
| **Coach** | Turns the report cards into lessons for the Morning Writer (`brief-lessons.yml`) | Sundays 11:45 am (batch) |
| **Devlog Writer** | Drafts devlog posts and "Now building" lines, and opens a pull request for you (`devlog-draft.yml`) | Sundays 11:20 am (batch) |
| **Release Writer** | Writes the player-friendly "What's new" line for game releases (`release-lines.yml`) | Every 6 hours |
| **Forecaster** | Writes the journal's forecast for the coming week (`journal-forecast.yml`) | Sundays 7:45 pm (batch) |
| **Scorekeeper** | Grades that week's journal calls (`journal-grade.yml`) | Sundays 11:35 am (batch) |
| **Scanner** | The weekly market scan on Agent Fleet (a Claude routine on your own plan, not a workflow) | Saturdays 8:55 am |

On the Actions tab each workflow shows as its name with what it does in
brackets, and its commits are signed with its name (morning-writer,
grader, coach, devlog-writer, release-writer, forecaster, scorekeeper).

### The Robot Timer (what starts the robots on time)

GitHub's own timers started the robots 3.5 to 7 hours late, so the six
robots with set times (all but the Release Writer) no longer have a GitHub
timer. Instead the **Robot Timer**, a free Cloudflare Worker, wakes every
5 minutes and presses "Run workflow" for whichever robot is due. They start
within seconds of the time in the table above.

- **The code:** `.github/worker/robot-timer.js`. The live copy is the
  `robot-timer` Worker in Cloudflare (Workers & Pages); keep the two the
  same.
- **Changing a time:** edit `TIMETABLE` near the top. Times are in UTC
  (Saskatoon is UTC−6 all year, so 12:30 is 6:30 am) and must land on a
  5-minute mark. Then ask Claude to upload it to Cloudflare, or paste it
  into the Worker's editor there and press Deploy.
- **The key:** it uses a GitHub token (`GH_TOKEN`) that can only start
  workflows in this repo. It lives in the Worker's settings as a Secret,
  never in the repo. It runs out after a year: make a new one on GitHub
  (Settings → Developer settings → Fine-grained tokens, this repo only,
  Actions: Read and write) and replace the Secret. There's a reminder.
- **Safe twice over:** every extra start stops before calling Claude when
  the work is already done, so a back-up try costs nothing.
- **If a robot didn't start:** the Worker's Logs tab in Cloudflare shows
  "started" or "failed (401)" for each try. 401 means the token has run out.

**What they cost:** every run that calls Claude pins a "Cost" note to its
run page on the Actions tab (for example "US$0.90 · 25 searches, 8 pages
read"). Those notes feed Kelbo's private API Call Log ($) on claude.ai,
which a daily routine ("Robot cost log updater", 5:47 pm) fills in.
The figures are estimates at list prices; the real bill is in the
Anthropic console under Usage and Cost.

## The Coach, the Devlog Writer and the Release Writer (Claude, one call each)

Three more robots use the same `ANTHROPIC_API_KEY` secret. Each asks
Claude one question with no web search, and only when there's something
to ask about, so most runs cost nothing. Every run's log ends with
"Estimated cost: US$0.xx".

All three have a **Run workflow** button on the Actions tab (on a phone,
switch to the desktop site if it doesn't show) with a **Dry run** box:
tick it and the robot prints what it would have saved in the log, and
saves nothing. To **turn one off**: open it on the Actions tab, tap "..."
at the top right, then "Disable workflow" ("Enable workflow" turns it
back on).

### The Coach (brief lessons, "What the brief is working on")

- **When:** Sundays at 11:45 am Saskatoon time (`brief-lessons.yml`), next
  to the Devlog Writer and the Scorekeeper, as a half-price batch; a
  5:25 pm try picks it up if it was slow. Monday's brief uses the lessons.
- **What it does:** reads every report card from the last 28 days, the
  briefs they graded, the running score and last week's lessons, and asks
  Opus 5.5 for 3 to 5 lessons about *how the brief works*: gap sizes called
  too big, supports listed too close to the price, overconfidence after a
  red day. Never market predictions. Each lesson is one instruction, its
  evidence (a count like "4 of 5 gap calls too big" and the card dates)
  and a status: New, Kept, or Retired once recent cards show it's fixed.
- **Guardrails:** with fewer than 5 graded report cards in the window it
  stops before asking (the log says why). The script checks the answer:
  at most 5 active lessons, every evidence date must be a real report
  card, no prices, and anything that fails is dropped. It never changes a
  report card or a brief.
- **Where it shows:** a closed "What the brief is working on" fold on the
  After close tab of `briefs.html` (hidden until the first lessons exist).
  The next weekday morning's brief reads them too, as long as they're
  under 14 days old (its log says "Lessons used: N").
- **Saved in:** `lessons/latest.json` plus `lessons/2026-11-07.json` for
  each week.
- **Fix a bad lesson:** edit or delete it in `lessons/latest.json` (or set
  its `"status"` to `"retired"`). Next Sunday's run starts from your
  version.

### The Devlog Writer (weekly devlog drafts)

- **When:** Sundays at 11:20 am Saskatoon time (`devlog-draft.yml`), as a
  half-price batch; a 5:15 pm try picks it up if it was slow (and stops
  straight away if the draft is already there).
- **What it does:** looks at every game with a GitHub `code` link in
  `projects.json`, collects the last 7 days of merged pull requests and
  releases, and asks Opus 5.5 (high effort) to draft 0 to 4 devlog posts (at most one
  per game) as Longlight, to players: only real changes, no code words,
  no PR numbers, no names. In the same call (no extra cost) it writes 1
  to 3 new lines for the "Now building" strip, one per game that had
  work that week, each linking to the game. No game activity that week:
  no call, and the strip keeps its old lines.
- **What you get:** a pull request called "Devlog draft for the week of
  ..." with the posts at the top of `devlog.json` on a
  `devlog-draft/YYYY-MM-DD` branch. Its description shows each post with
  links to the pull requests and releases it came from. If the strip
  lines changed, `now.json` is in the same pull request and the
  description lists them. A week with strip lines but no posts still gets
  a pull request.
- **It never merges itself.** Claude may merge it for you once its
  check is green, or read it on your phone. To fix a post, open
  the Files tab, tap "..." → Edit file on `devlog.json` (or `now.json`) and commit to that
  branch. Then **merge** to publish, or **close** to skip the week (and
  delete the branch).

### The Release Writer (the "What's new" line on each game card)

- **When:** every 6 hours at :53 (`release-lines.yml`).
- **What it does:** checks each game's newest GitHub Release. If
  `release-lines.json` has no line for it yet (keyed like
  `"350Chev@v1.2.0"`), it asks Sonnet 5.5 to rewrite the release title and
  notes as one line for players: 90 characters at most, no version number,
  nothing the notes don't say ("fix sim tick drift" → "Races no longer
  slow down late in a season."). All new releases go in one call; no new
  release, no call. It then commits the file and runs the deploy.
- **Where it shows:** the game cards' "v1.4 · ..." line, the What's new
  page and the game page. The deploy uses the line for that exact release,
  or the release title if there isn't one (or the file is missing or
  broken). The deploy itself never calls Claude.
- **Fix a bad line:** edit its `"line"` in `release-lines.json`. The robot
  never overwrites a line that's already there. To have it write a new
  one, delete that whole entry.

## Later

- **More tools:** make a new folder `tools/my-tool/` with its own
  `index.html`, then set that project's `link` to the folder. Pages in there link back with `../../`.
- **Changing the domain:** the site is live at `longlight.games` (set in
  Settings → Pages → Custom domain; because the site deploys through an
  Action, a `CNAME` file isn't needed). All links on the site are relative, so
  they keep working if the domain ever changes. The only full addresses to
  update are the `og:` and `canonical` tags in each page's `<head>`,
  `robots.txt` and `sitemap.xml`.
- **Home screen icon:** on a phone, "Add to Home Screen" in the browser
  menu puts the Longlight sun (with its glow and halo) on a purple tile on
  the home screen. The icon
  is `assets/icon.svg` (with PNG copies at 180, 192 and 512 pixels, plus
  `icon-maskable-512.png` for Android) and the name and colours are in
  `site.webmanifest`.

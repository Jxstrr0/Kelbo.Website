# Kelbo.Website

My personal site: who I am, plus a list of what I'm building.

It's plain HTML, CSS, and JavaScript. There's no build step and nothing to
install. GitHub Pages serves these files exactly as they are, so any change
you save on the `main` branch goes live within a minute or two.

**Live at:** https://jxstrr0.github.io/Kelbo.Website/

## What each file does

| File | What it's for |
|---|---|
| `index.html` | Home page: the Longlight Interactive name, game cards, Games / Trading / AI tiles, contact |
| `about.html` | The About page: your bio and the "player card" facts |
| `projects.html` | The full projects page with status filters |
| `whats-new.html` | The newest version and latest change for each project, built from `projects.json` (no dates, since the file has none) |
| `games.html` | The Games section: every project with `"category": "Game"` |
| `trading.html` | The Trading section: every project with `"category": "Trading"` |
| `ai.html` | The AI section: every project with `"category": "AI"` |
| `projects.json` | **The list of projects.** Edit this to add or change one |
| `now.json` | **The "Now building" strip** on the home page. Edit this to say what you're working on |
| `style.css` | Colours, fonts, and layout for every page |
| `main.js` | Reads `projects.json` and puts the projects on the page, and runs the live sun, the ☀/☾ button, and the "Continue?" card |
| `assets/` | Images, game cover screenshots (`assets/covers/`), the link preview picture, the browser-tab icon, and the home-screen icon |
| `site.webmanifest` | The site's name, colours and icon for phones that add it to the home screen |
| `robots.txt`, `sitemap.xml` | Tell search engines they're welcome and which pages exist. Add a line to the sitemap when you add a page |
| `agent-fleet.html` | The Agent Fleet page. All plain text except the weekly scan, so edit the words directly |
| `scan.json` | **The weekly scan.** Rewritten every Saturday by a Claude routine |
| `scan.js` | Shows the weekly scan on the Agent Fleet page |
| `journal.html` | The AI Trading Journal page |
| `journal.json` | **Your journal entries.** Edit this to add an update |
| `options.json` | **Your options trades.** Edit this to log a trade |
| `journal.js`, `journal.css` | Show the journal entries and options trades, and work out the record |
| `tools/prediction-tracker/` | The Prediction Tracker tool, parked for now (not linked from the site) |
| `404.html` | The "page not found" screen GitHub shows for any address that doesn't exist |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is. Leave it alone |

## Editing on your phone

1. Open the repo in the GitHub app or at github.com.
2. Tap the file you want to change, then the pencil icon (✏️).
3. Make your change and tap **Commit changes**.
4. Wait a minute or two, then refresh the site.

## Change the text

All the words on the home page are in `index.html`. Look for these
comments to find each part:

- `<!-- 1. Hero -->`: the studio name, the small "Saskatoon, SK" line above
  it, "by Kelbo" under it (linked to your About page), the description, the
  two buttons, and the live sun
- `<!-- 2. Games -->`: the "Pick a game" cards (filled in from `projects.json`)
- `<!-- 3. Modes -->`: the Games / Trading / AI tiles
- `<!-- 4. Contact -->`: the contact form, and your links in the card
  beside it

Everything about you is on its own page, `about.html`: the about paragraphs,
then the "player card" facts (each `<li>` is one box: a label, then the
value). The rest of the site speaks as Longlight Interactive, except
Trading and the journal, which are in your own voice.

Only change the words between the tags, like this:

```html
<p>Change only this sentence.</p>
```

The intro text on the Projects, Games, Trading, and AI pages is near the top
of each page's `.html` file.

The about text and project summaries are first drafts. Rewrite them in your
own words whenever you like.

## Add a project

Open `projects.json` and copy one of the blocks between `{` and `}`.
Paste it after the last one and change the values:

```json
  {
    "title": "My new thing",
    "status": "Building",
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

- **status**: use one of `Finished - Final Form` (complete, won't change), `Finished - For Now` (done, but may get more updates), `Mostly done`, `Building`, `Early stages`, or `Planned`. Both Finished ones get a full bar.
  This sets how far along the progress bar the little sun sits.
- **category**: which section it shows up in: `Game`, `Trading`, or `AI`.
  Anything else still shows on the Projects page, just not in a section.
- **version** and **latest**: the version note under the summary, like
  "v1.4 · Added night mode". `version` is just the number (`"1.4"`), and
  `latest` is a few words on what changed. Either can stay `""`, and the
  line disappears if both are empty. Red Skies and Prairie Engine Works
  show the version number their game pages report; fill in `latest` when
  you ship something. The What's new page (`whats-new.html`) lists every
  project that has a version or a `latest`, in the same order as this
  file, so updating these two fields updates that page too.
- **link**: a web address, or leave it as `""` for no link. A link can
  also point to a page in this repo later, like `tools/prediction-tracker/`.
- **code**: the GitHub repo address, or `""`. Shows a "See the code" link.
- **image**: a cover picture, like `assets/covers/my-game.jpg`, or `""`.
  Without one, the card gets a coloured cover with the project's initials.
  Covers are shown 4:3 (640 × 480 is perfect) and should stay under 100 KB.
- **featured**: `true` shows it as a big card under "Pick a game" on the home
  page (the first four only).

**Adding a game:** use `"category": "Game"` and it shows up on the Games
page automatically, with a big clay "Play it" button. Each game lives in its
own repo with GitHub Pages turned on, so `link` is that game's Pages address
(like `https://jxstrr0.github.io/RedSkies/`) and `code` is the repo address.

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
    { "text": "Finishing touches on Prairie Engine Works", "link": "https://jxstrr0.github.io/350Chev/" },
    { "text": "Something with no link" }
  ]
}
```

- Change `updated` to today's date whenever you edit it. The strip shows
  "Updated today", "Updated 3 days ago", and so on.
- Each item is a pill. `link` is optional.
- To hide the strip, leave `items` as `[]`.

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
borrows it, so leave that `<defs>` block in the footer.

### The link preview

When someone shares a link to the site in a text, Discord, or X, the app
shows a preview card. That card is `assets/social-preview.jpg` (1200×630).
It shows the sun with the same glow and halo as the logo. To change it,
upload a new picture with the same name and size, then bump the `?v=5` on
the end of every page's `og:image` line (to `?v=6`) so apps fetch the new
one. Apps remember old previews for a while, so a change can still take a
day or so to show up when you share the link.

The preview's title and description come from the `og:` lines near the top
of each page. Those are the one place on the site that uses full web
addresses (`https://jxstrr0.github.io/...`), because the apps reading them
aren't on this site. If the site ever moves to its own domain, update them.

## Add a new section

Say you want a "Tools" section next to Games, Trading, and AI:

1. Copy `ai.html` to `tools.html`. Change the `<title>`, the description,
   the `<h1>` and intro line, and `data-category="AI"` to
   `data-category="Tool"`.
2. In `index.html`, copy one of the tiles under `<!-- 3. Modes -->` and
   change its link, name, line, and `data-category-count="Tool"`.
3. Optionally add it to the menu (`<ul class="nav">`) in every page. Keep the
   menu short so it fits on one line on a phone. (A menu item with
   `class="nav__wide"`, like About, only shows on wide screens.)

## Change colours or fonts

The site uses the Longlight Interactive brand: five colours (Clay, Purple,
Slate, Ivory, Lilac) and one font, Space Grotesk. Open `style.css`. The
brand colours are the `--ll-` lines at the very top. Under them are the
light theme (daytime), then the dark theme (after sunset). Change a value
like `#7B3FC4` (the purple) and every place that uses it updates.

The font is loaded from Google Fonts in each page's `<head>`.

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
  long the slide back to now takes, 1800 = 1.8 seconds).
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
  device"), and nothing is sent anywhere. They're off with "reduce motion"
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
  across the top of the night sky, stronger the bigger the storm, and the
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
- **The grain elevator:** a prairie grain elevator stands on the horizon
  where the sun is at noon. Its shadow on the ground follows the real sun:
  long and off to the right in the morning, short and pointing at you at
  noon, long and off to the left before sunset. The readout tells you how
  long your own shadow is right now ("Your shadow is 2.4× your
  height"). Heavy cloud takes the shadow away. At night a little light
  glows at the top.
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
  - Preview any of them with `?critter=` plus `leaves`, `jet`, `hawk`,
    `kite`, `geese` or `fireflies` (add `&weather=windy` for a strong
    wind). `JET_EVERY_S` and `HAWK_EVERY_S` in `main.js` set how often.
- **Tap a cloud** and it puffs apart and drifts off. A new cloud drifts in
  from the left a while later.
- Weather, the air quality and the northern lights are the only parts of
  the site that fetch anything. They send no personal details, just a
  request for Saskatoon's weather and air and the latest space weather.
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
  it goes are the weather and air quality checks (Open-Meteo, rounded). **Back to
  Saskatoon** switches it back. Geese, fireflies, autumn leaves, the
  crocuses and wheat, and the usual winter snow stay Saskatoon-only,
  since they follow Saskatoon's calendar.
- **Seasons:** the ray coming off the sun reaches further in summer than in
  winter (full length on the longest day, a bit under half on the
  shortest). On the longest and shortest days of the year a badge appears
  on the home page sky, like "Longest day of the year · 16h 46m of light".
  Preview it with `?at=2026-06-21T13:00` or `?at=2026-12-21T13:00`.

Two small extras ride along on the home page:

- **Continue?** When someone taps Play on a game, their phone remembers it,
  and next time the home page offers that game again under "Pick a game".
  **Pick another** clears it. Nothing is sent anywhere.
- **Market light** on the Trading tile says "Market open" during New York
  Stock Exchange hours (9:30 to 4:00 Eastern, Monday to Friday). It doesn't
  know about holidays.

## Motion

The animations are at the bottom of `style.css` under "Motion": pages fade
into each other, sections and cards slide up as you scroll, the sun glides
to its new spot, and buttons and cards lift when you tap them. On the
Projects page, cards glide into place when you tap a filter. Anyone whose
phone is set to **Reduce Motion** (iPhone: Settings → Accessibility →
Motion) sees the same site with nothing moving. Turn that setting on to
check it.

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
  below). You never type it.
- **ai**: the AI coach's notes. Easiest way: send Claude your views and
  trades, and ask it to write the entry with a coach note. Or paste in
  feedback from any AI chat. Use `""` to leave it out, same for `lesson`.
- Same comma rule as `projects.json`: a comma after every `}` except the
  last one, and an empty journal is just `[]`.

Only post what you're happy for anyone to read. The site is public, so
percentages are safer than dollar amounts or account sizes.

### Options trades

Your options trades live in `options.json`, not in the entries. The page
shows them newest first, with a bar for each trade's return, V2/V3 filter
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
      "system": "V3",
      "note": "Short note about the trade."
    },
```

- **paid** and **sold** are the option's price per share, like your broker
  shows. The page works out the return: `(sold − paid) ÷ paid`. A trade
  sold for what it cost counts as a scratch.
- **Still open?** Leave out `"closed"` and `"sold"`. It shows as Open and
  isn't counted until you add them.
- **type** is `"call"` or `"put"`. **system** is `"V2"` or `"V3"`; the
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

## The Prediction Tracker (parked)

It's taken off the site for now, but its files are still in
`tools/prediction-tracker/`. To bring it back, add this block to
`projects.json`:

```json
  {
    "title": "Prediction Tracker",
    "status": "Finished - For Now",
    "category": "Trading",
    "summary": "Log predictions with a confidence level, then see how well-calibrated those calls turn out to be over time.",
    "link": "tools/prediction-tracker/",
    "code": "",
    "image": "",
    "featured": false
  }
```

It runs entirely in the visitor's browser:

- Calls are saved with the browser's own storage (localStorage), on that
  device only. Nothing is sent anywhere, so there's no server and no key.
- Clearing browser data or switching phones loses them, which is what the
  **Export backup** button is for. **Import backup** adds them back.
- The words on the page are in `tools/prediction-tracker/index.html`.
  The scorecard settings (confidence groups, how many calls before it
  judges, what counts as "on target") are at the top of `tracker.js`.

## Later

- **More tools:** copy the `tools/prediction-tracker/` folder setup: a new
  folder with its own `index.html`, then set that project's `link` to the
  folder, like `tools/my-tool/`. Pages in there link back with `../../`.
- **Custom domain:** add a file named `CNAME` containing just the domain (for
  example `kelbo.ca`), then point the domain at GitHub Pages in your
  domain provider's settings. All links on the site are relative, so they'll
  keep working. The only full addresses to update are the `og:` and
  `canonical` tags in each page's `<head>`, `robots.txt` and `sitemap.xml`.
- **Home screen icon:** on a phone, "Add to Home Screen" in the browser
  menu puts the Longlight sun (with its glow and halo) on a purple tile on
  the home screen. The icon
  is `assets/icon.svg` (with PNG copies at 180, 192 and 512 pixels, plus
  `icon-maskable-512.png` for Android) and the name and colours are in
  `site.webmanifest`.

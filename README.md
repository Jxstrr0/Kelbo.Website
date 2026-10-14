# Kelbo.Website

My personal site: who I am, plus a list of what I'm building.

It's plain HTML, CSS, and JavaScript. There's no build step and nothing to
install. GitHub Pages serves these files exactly as they are, so any change
you save on the `main` branch goes live within a minute or two.

**Live at:** https://jxstrr0.github.io/Kelbo.Website/

## What each file does

| File | What it's for |
|---|---|
| `index.html` | Home page: name, game cards, Games / Trading / AI tiles, about, contact |
| `projects.html` | The full projects page with status filters |
| `games.html` | The Games section: every project with `"category": "Game"` |
| `trading.html` | The Trading section: every project with `"category": "Trading"` |
| `ai.html` | The AI section: every project with `"category": "AI"` |
| `projects.json` | **The list of projects.** Edit this to add or change one |
| `style.css` | Colours, fonts, and layout for every page |
| `main.js` | Reads `projects.json` and puts the projects on the page |
| `assets/` | Images, game cover screenshots (`assets/covers/`), and the browser-tab icon |
| `tools/prediction-tracker/` | The Prediction Tracker tool (its own page, styles, and script) |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is. Leave it alone |

## Editing on your phone

1. Open the repo in the GitHub app or at github.com.
2. Tap the file you want to change, then the pencil icon (✏️).
3. Make your change and tap **Commit changes**.
4. Wait a minute or two, then refresh the site.

## Change the text

All the words on the home page are in `index.html`. Look for these
comments to find each part:

- `<!-- 1. Hero -->`: your name, the pixel "Player 1" line, the description,
  and the two buttons
- `<!-- 2. Games -->`: the "Pick a game" cards (filled in from `projects.json`)
- `<!-- 3. Modes -->`: the Games / Trading / AI tiles
- `<!-- 4. About -->`: the about paragraph
- `<!-- 5. Contact -->`: your links

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
    "link": "",
    "code": "",
    "image": "",
    "featured": false
  }
```

- **status**: use one of `Shipped`, `Mostly done`, `Building`, or `Planned`.
  This sets how full the glowing progress bar is.
- **category**: which section it shows up in: `Game`, `Trading`, or `AI`.
  Anything else still shows on the Projects page, just not in a section.
- **link**: a web address, or leave it as `""` for no link. A link can
  also point to a page in this repo later, like `tools/prediction-tracker/`.
- **code**: the GitHub repo address, or `""`. Shows a "See the code" link.
- **image**: a cover picture, like `assets/covers/my-game.jpg`, or `""`.
  Without one, the card gets a coloured cover with the project's initials.
  Covers are shown 4:3 (640 × 480 is perfect) and should stay under 100 KB.
- **featured**: `true` shows it as a big card under "Pick a game" on the home
  page (the first four only).

**Adding a game:** use `"category": "Game"` and it shows up on the Games
page automatically, with a big pink "Play it" button. Each game lives in its
own repo with GitHub Pages turned on, so `link` is that game's Pages address
(like `https://jxstrr0.github.io/RedSkies/`) and `code` is the repo address.

**Watch the commas.** Every block needs a comma after its closing `}`,
except the very last one. If the projects disappear and the page says
"Projects couldn't load right now", it's almost always a missing or extra
comma or quote. Pasting the file into https://jsonlint.com will point to the
exact spot.

## Add or swap images

1. In the GitHub app or website, open the `assets` folder and choose
   **Add file → Upload files**.
2. Use short lowercase names with no spaces, like `headshot.jpg`.
3. Show it in a page with:

   ```html
   <img src="assets/headshot.jpg" alt="Colby smiling at the camera" width="400" height="400">
   ```

   Always write `alt` text describing the picture for people who can't see it.
   Keep photos under about 500 KB so the site stays fast on phones.

To change the browser-tab icon, replace `assets/favicon.svg` (or upload a
`favicon.png` and change `favicon.svg` to `favicon.png` in both HTML files).

## Add a new section

Say you want a "Tools" section next to Games, Trading, and AI:

1. Copy `ai.html` to `tools.html`. Change the `<title>`, the description,
   the `<h1>` and intro line, and `data-category="AI"` to
   `data-category="Tool"`.
2. In `index.html`, copy one of the tiles under `<!-- 3. Modes -->` and
   change its link, name, line, and `data-category-count="Tool"`.
3. Optionally add it to the menu (`<ul class="nav">`) in every page. Keep the
   menu short so it fits on one line on a phone.

## Change colours or fonts

Open `style.css`. The colours are near the top: light mode first, then dark
mode under `@media (prefers-color-scheme: dark)`. Change a value like
`#ff3d9a` (the neon pink) and every place that uses it updates.

The fonts are Space Grotesk (all the text) and Press Start 2P (the small
pixel-style labels), loaded from Google Fonts in each page's `<head>`.

## Motion

The animations are at the bottom of `style.css` under "Motion": pages fade
into each other, the hero's grid floor rolls and its glow drifts, cards slide
up as you scroll, and buttons lift when you tap them. Anyone whose phone is
set to **Reduce Motion** (iPhone: Settings → Accessibility → Motion) sees
the same site with nothing moving. Turn that setting on to check it.

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

## The Prediction Tracker

Lives at `tools/prediction-tracker/`, and the project's `link` in
`projects.json` points there. It runs entirely in the visitor's browser:

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
  example `colbyjoyes.com`), then point the domain at GitHub Pages in your
  domain provider's settings. All links on the site are relative, so they'll
  keep working.

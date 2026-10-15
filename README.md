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
| `main.js` | Reads `projects.json` and puts the projects on the page, and runs the live sun, the ☀/☾ button, and the "Continue?" card |
| `assets/` | Images, game cover screenshots (`assets/covers/`), the link preview picture, and the browser-tab icon |
| `agent-fleet.html` | The Agent Fleet plan page. All plain text, so edit the words directly |
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

- `<!-- 1. Hero -->`: the small line above the heading, the big heading, the
  description, the two buttons, and the live sun
- `<!-- 2. Games -->`: the "Pick a game" cards (filled in from `projects.json`)
- `<!-- 3. Modes -->`: the Games / Trading / AI tiles
- `<!-- 4. About -->`: the about paragraphs, then the "player card" facts
  (each `<li>` is one box: a label, then the value)
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
  This sets how far along the progress bar the little sun sits.
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
page automatically, with a big clay "Play it" button. Each game lives in its
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
   <img src="assets/headshot.jpg" alt="Kelbo smiling at the camera" width="400" height="400">
   ```

   Always write `alt` text describing the picture for people who can't see it.
   Keep photos under about 500 KB so the site stays fast on phones.

To change the browser-tab icon, replace `assets/favicon.svg` (or upload a
`favicon.png` and change `favicon.svg` to `favicon.png` in every page).

### The link preview

When someone shares a link to the site in a text, Discord, or X, the app
shows a preview card. That card is `assets/social-preview.jpg` (1200×630).
To change it, upload a new picture with the same name and size. Apps
remember old previews for a while, so a change can take a day or so to show
up when you share the link.

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
   menu short so it fits on one line on a phone.

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
theme with a few stars. It's all worked out on the visitor's phone from the
date and time, so there's no internet service or key involved.

- **The ☀/☾ button** in the header lets a visitor pick light or dark
  instead. Tap it to go light → dark → back to following the sun. Their
  phone remembers the choice.
- **To see a time of day** without waiting for it, add `?at=` to the
  address: `?at=noon`, `?at=sunrise`, `?at=sunset`, `?at=dusk`, `?at=night`,
  or an exact Saskatoon time like `?at=2026-06-21T21:30`. Only you see it.
- **To move it somewhere else**, change `YXE` near the "LIVE HORIZON"
  heading in `main.js` (latitude, longitude, and time zone).

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
buttons, and the options numbers in the record (win rate, average return,
and wins–losses–scratches).

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

## The Prediction Tracker (parked)

It's taken off the site for now, but its files are still in
`tools/prediction-tracker/`. To bring it back, add this block to
`projects.json`:

```json
  {
    "title": "Prediction Tracker",
    "status": "Shipped",
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
  keep working.

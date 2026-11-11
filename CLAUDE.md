# Notes for Claude

Kelbo's personal site, hosted on GitHub Pages. `.github/workflows/deploy.yml`
publishes it on every push to `main` (and every 6 hours, to pick up game
releases).
Live at https://longlight.games/

## Working on this repo

- **Auto-merge is allowed.** Once a change is pushed, the PR is open, and
  the **Site check** has passed (green), merge it yourself without asking
  first (squash-merge is fine). If it's red, read the run's summary, fix the problems on the same
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
  (Games, Trading, All, About; Tools is hidden for now). Studio pages (home, Games, Tools,
  All) speak as Longlight; Trading, the journal and Agent Fleet stay in
  his own first-person voice.

## Money and safety

Kelbo pays for anything that isn't free, so keep his bill small and
predictable. Free things need no asking: commits, PRs, merges, the Site
check and Deploy site (GitHub Pages and Actions are free on this public
repo), and running the site locally.

**Ask first.** Say in plain words what it is and roughly what it costs, then
wait for a yes in this conversation. A yes covers that one action, not
later ones.

- Running a robot that uses `ANTHROPIC_API_KEY` by hand ("Run workflow",
  re-running a failed run), except a dry run. Check recent Cost notes
  for a rough price instead of guessing.
- Making a robot cost more: a new robot, a new or more frequent schedule,
  a pricier model, higher effort or `max_tokens`, or more web searches.
- Anything paid outside GitHub: Cloudflare paid plans or usage beyond the
  free tier, buying a domain, image, voice or video credits, design-tool
  credits, store or subscription sign-ups, any purchase.
- Big Claude jobs that use up his plan: multi-agent workflows, more than a
  couple of subagents at once, long loops, or scheduled routines that start
  new sessions.
- Sending email or messages for Kelbo, or posting anywhere public other
  than this repo.
- Any single task you expect to cost more than **US$5** in total: stop and
  ask before starting, even if each step looks small.

**Never:**

- Place, send or set up trades, orders, alerts or flows in his brokerage
  account. Read-only looks only, and only when he asks.
- Retry a paid run or generation in a loop. One retry at most after a
  failure, then tell Kelbo.
- Change billing, plans, payment methods or spending limits on any account.
- Commit keys, tokens or passwords (see Hard rules).

If something paid starts by mistake, cancel it at once and tell Kelbo what
ran and what it may have cost.

## Privacy: what a visitor may see

**Everything in this repo is public**, not just the pages: every JSON and
Markdown file (including this one and `.github/`), commit messages, PR
titles and bodies, the Actions logs (dry runs too) and the whole git
history, forever. Treat all of it as the live site.

**Never put these anywhere in the repo**, in any form (text, comments,
alt text, file names, screenshots, logs):

- Kelbo's real name or initials (see Hard rules), his email, phone, home
  or mailing address, birthday, the names of his university, employers or
  teams, photos of him, his home or his car, or anything that pins down
  where he lives beyond "Saskatoon".
- Family and friends: no names, ever, and no details beyond what Kelbo
  wrote himself for the character sheet on `about.html` (his brother, his
  girlfriend and his dog, unnamed). Keep that wording exactly. Elsewhere
  on the site they may be mentioned, unnamed, using only details already
  written on the character sheet; never add a new detail about them.
- Money: broker and bank names, account numbers, account sizes or
  balances, deposits, dollar profit or loss, number of contracts or shares,
  position sizes, income, debts, tax details. The trading pages show
  percentages and per-contract prices only.
- Anything from his email, calendar, Drive, messages, brokerage, other
  repos or Claude conversations. Connected tools are read on request only;
  never copy from them into the repo, a page, a PR, a commit message or a
  log. Don't list on the site which accounts or tools Claude can reach.
- Keys, tokens, passwords, recovery codes, Cloudflare account or zone IDs,
  DNS records, device names, Wi-Fi names. (The two exceptions, both public by
  design: the Web Analytics token at the foot of each page, which only
  sends visit counts, and the Turnstile site key in the home page's
  contact form; its secret lives only in Cloudflare.)

**Robots and logs.** The scripts may print counts, grades, costs and text
that is already going on the site, nothing else: never a prompt that holds
private context, never an environment variable. Workflow logs on a public
repo can be read by anyone.

**Before every merge**, read the diff for the list above. The Site check
has a privacy scan (emails, phone numbers, long account-like numbers,
dollar amounts and share counts in the trading data, key-shaped strings),
but it can't recognise a name or a story, so your own read is the real
check.

**If something private lands anyway**, don't just delete it in a new
commit: history keeps it. Tell Kelbo at once and say what it was. Removing
it for good means rewriting history and force-pushing `main`, which is his
call. If it was a key, it must also be revoked and replaced.

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
  see below). The scripts in
  `.github/scripts/` are plain Node with no packages; keep them that way.
- **No secrets.** The repo is public. Never commit API keys, tokens, or
  passwords. If a tool needs a key, talk through options with Kelbo first.
  The one key that exists is the `ANTHROPIC_API_KEY` repository secret,
  used by seven workflows: the Morning Writer (pre-market brief), the
  Grader (after-close report card), the Coach (brief lessons), the Devlog
  Writer, the Release Writer, the Forecaster (weekly journal forecast) and
  the Scorekeeper (weekly journal grades). It is only ever referenced as
  `${{ secrets.ANTHROPIC_API_KEY }}` in those workflows; `deploy.yml` and `site-check.yml` stay key-free.
- Mobile first (works down to 360px wide), light and dark themes with
  every colour in CSS variables (`data-theme` on `<html>`, set by `main.js`
  from the real sun; `prefers-color-scheme` is only the fallback before JS
  runs, so page CSS must handle both), accessible
  (semantic HTML, visible focus, good contrast, alt text,
  `prefers-reduced-motion`).
- Use relative links only, because the site is served both at
  `https://longlight.games/` and (forwarding) under `/Kelbo.Website/`. The exceptions are the `og:`
  link-preview tags and the `canonical` tag in each page's `<head>`, plus
  `robots.txt` and `sitemap.xml`, which must be absolute; update them all
  if the domain changes. Add new pages to `sitemap.xml`. `404.html` is the other exception: GitHub
  serves it at any missing address, however deep, so a small script in its
  `<head>` adds a `<base>` pointing at the site's top folder before any
  links load. Keep that script first in the `<head>`.
- The link preview image is `assets/social-preview.jpg` (1200×630, the
  Longlight sky, the sun with its glow and halo on the horizon line,
  "Longlight Interactive", plus the four featured game covers in a 2×2
  grid: Frontier Lab, Prairie Engine Works, Scrapline, Season Ticket). Every `og:image`
  ends `?v=20` so apps refetch it; bump it on every page when the picture
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

The full reference (every function, class, table and workflow) is
`.github/NOTES.md`, split by topic. Read the matching section before changing
that part, and update it when how something works changes. The short map:

- **Projects:** `projects.json` is the single source of truth, rendered by
  `main.js`; its order is the display order everywhere (Kelbo's ranking,
  games first). Adding a project never needs an HTML edit. Games use
  four-number versions; the deploy fills `version`/`latest` from each game's
  newest GitHub Release, so don't "fix" newer live values by hand.
  Screenshots are `shots` in `assets/shots/` (with `@2x` twins). Status
  names live in `STATUSES` (`main.js`), kept in step with `KNOWN_STATUS` in
  `check-site.mjs`. Notes: "Projects, cards and game pages".
- **Game pages:** `game.html?g=<slug>`; the deploy writes the
  `game-<slug>.html` copies (`make-game-pages.mjs`), which never exist in the
  repo. `game.html` is in `sw.js` `CORE`, not in `sitemap.xml`.
- **Look:** the "Horizon" brand, five `--ll-*` colours and self-hosted Space
  Grotesk at the top of `style.css`. No green anywhere (the aurora and young
  wheat use lilac). Covers in `assets/covers/` (640×480 + `@2x`), all through
  `setPicture`. Notes: "The look and covers".
- **Live sky:** `[data-horizon]` on the home hero, page heads and the 404,
  all in `main.js` (`setUpHorizon`, `placeSun`, weather, moon, stars,
  critters, taps). Sky code reads `YXE`, never hard-coded Saskatoon. Preview
  with `?at=`, `?weather=`, `?critter=`. Notes: "The live sky" and "Sky
  extras".
- **Home page:** Now strip (`now.json`), Sky this week, badges, Continue
  card, four tiles, contact form (our own `contact-form` Cloudflare Worker,
  `.github/worker/contact-form.js`; Kelbo's email lives only in its
  Cloudflare settings, never in the site or repo).
- **Offline:** `sw.js` precaches `CORE`; it only ever deletes `longlight-*`
  caches. Add new top-level pages to `CORE` and `sitemap.xml`.
- **Pages:** `games.html`, `trading.html`, `tools.html` (was `ai.html`),
  `projects.html` ("All"), `devlog.html` (`devlog.json`), `press.html`,
  `whats-new.html`, `about.html`; tools in `tools/<name>/`. Notes: "Pages,
  sections, logo and header". The header only just fits at 360px: test
  before adding to it. The logo letters are paths: never swap them for text.
- **Trading:** the journal (`journal.*`, `journal.json`, `options.json`),
  the weekly scan (`scan.json`), the pre-market brief (`briefs.*`,
  `briefs/`) and the report card (`report-cards/`). Never invent trades or
  results; coach notes judge the trade in a general voice, never "you". Don't
  hand-edit `briefs/`, `report-cards/` or `lessons/`. When running as the
  Scanner routine, only touch `scan.json` and use only confirmed figures with
  sources. Notes: "Trading".
- **Robots:** Morning Writer, Grader, Coach, Devlog Writer, Release Writer,
  Forecaster, Scorekeeper (workflows in `.github/workflows/`, scripts in
  `.github/scripts/`), plus the Scanner routine. Use their names with Kelbo.
  The Devlog Writer's PR can be merged like any other once it's green.
  Keep the `US$<n>` start of
  each Cost note; add any new robot workflow to the cost-log routine. Notes:
  "The robots".
- **Studio catalogue:** `.github/LONGLIGHT-STUDIO.md` is the master; update
  it here first, then recopy to the game repos.
- **`README.md`** is Kelbo's editing guide; keep it up to date.

# Home page refresh: "Horizon" (direction A)

Build brief for the studio site (repo `Jxstrr0/Kelbo.Website`, live at https://longlight.games/). Written on 19 Nov 2026 against the repo as of that day. Hand this file to a Claude Code session, e.g.:

> Read `CLAUDE.md`, then `.github/HOME-HORIZON-PLAN.md`. Do PR 1 only. Stop when it's merged and live, and give me the phone test.

Commit this file as `.github/HOME-HORIZON-PLAN.md` (inside `.github` so it isn't published, like `LONGLIGHT-STUDIO.md`). Tick off PRs in the checklist at the bottom as they land.

Kelbo picked this direction from a design canvas of three options (Claude artifact "Longlight site refresh — 3 directions", artboards *A · Horizon — desktop* and *A · Horizon — phone*). Everything the session needs from it is written out below, so it doesn't need to open the canvas.

---

## 0. Ground rules (from CLAUDE.md, restated so they aren't skipped)

- One `claude/...` branch + PR per section below. Keep each PR small enough to read on a phone.
- Run `node .github/scripts/check-site.mjs` before pushing. Auto-merge is allowed once the **Site check** is green; then wait for **Deploy site** to go green and check the live page changed.
- The site uses the name **Kelbo** only. Studio pages speak as Longlight.
- **Content-Security-Policy:** inline `<style>` and `style=""` are fine (`'unsafe-inline'`), but inline `<script>` is hash-locked. If you touch the inline script in `<head>`, re-run the hash step described in `.github/NOTES.md` ("Security tag", `csp-hashes.mjs`). No new outside hosts (fonts, scripts, APIs) without asking.
- **Font:** Space Grotesk only, self-hosted (`assets/fonts/`). The design canvas used a mono face for version numbers; use Space Grotesk with `font-variant-numeric: tabular-nums` instead. No new font host.
- **Keep every existing sky feature working.** The horizon is the site's signature: real sun position, moon, stars, planets, ISS, meteors, weather, snow, critters, sky taps, swipe-to-wind-time, tilt sky, "See your sky", sunset warm-up, theme flip at sunset, the scroll sun, the moose, the logo secret. This plan moves things *around* the horizon. It does not rebuild it.
- Test every PR in the light theme, the dark theme and auto, and with `?at=noon`, `?at=sunset`, `?at=night`. Respect `prefers-reduced-motion`.
- Before deleting or moving any element, `grep` `main.js` and `style.css` for its `data-*` hook and class. Some hooks are used as "am I on the home page?" checks (see PR 3).
- New localStorage keys must start with `kelbo.`. Don't add one unless the PR says so.
- Kelbo answered the design questions on 19 Nov 2026 (section 8). Follow those answers. Anything new that's a real design decision gets asked, not guessed.
- End each PR with a plain-language "what changed / how to test on a phone" summary.

## 1. The direction in one paragraph

Keep today's identity (purple sky, clay sun, prairie horizon, Space Grotesk) but fix the order. **The headline is the promise** ("Deep games for small screens."), and the studio name moves to the logo and a small kicker. **The spotlight game stands on the horizon line** like a building on the prairie. **Now building, Sky this week and Your badges fold into one strip** just under the horizon, instead of three stacked boxes. **Games start at the fold**, as a grid with status filters instead of a sideways row. "Choose a mode" (it repeats the nav) and the contact form leave the home page.

**The goal you can measure:** on a 390×844 phone, the top of the first game cards is visible on the first screen without scrolling. Today "Pick a game" starts about 1,050 px down.

### Page order after the refresh

1. Header (unchanged: logo, nav, theme toggle)
2. Hero: kicker, headline, one line, two buttons
3. Horizon (unchanged scene) with the **spotlight card** standing on its line
4. **Ticker strip** (Now building · Sky · Badges), the bottom edge of the hero
5. Continue card (existing, only when this phone has played a game)
6. **Pick a game** grid with filter chips
7. **Studio row**: Trading desk card + latest Devlog post
8. Footer (adds "Say hello")

---

## 2. PR 1: Hero copy and the phone fold

Files: `index.html` (hero, lines ~110–149), `style.css` (`.hero__*`, `.horizon` sizing).

### 2a. Copy

| Element | Today | New |
| --- | --- | --- |
| Kicker (`.eyebrow`) | `Saskatoon, SK` + switches | `Longlight Interactive · Saskatoon, SK` + the same switches (keep `data-sky-place`, `data-sky-switch`, `data-motion-switch` working) |
| `h1` | `Longlight Interactive` | `Deep games for small screens.` |
| `.hero__by` | `by Kelbo` | Remove as its own line; "by Kelbo" moves into the line below |
| `.hero__line` | `Deep games for small screens.` | `{N} browser games, made in Saskatoon by <a href="about.html">Kelbo</a>. Nothing to install, no account to make.` |
| Buttons | `Play a game` · `See everything` | `▶ Play {spotlight title}` (clay, links to that game) · `Browse all {N} games →` (ghost, links to `#games-heading`) |

- `{N}` = the number of games in `projects.json` (`isGame`, not `hidden`). Fill it from `main.js` after `projects.json` loads. Static HTML fallback (no JS): `Browser games, made in Saskatoon by Kelbo.` and the button text `Play a game`.
- `{spotlight title}` = the spotlight game from PR 2's rule (first game with `"featured": true`, so Prairie Engine Works today). Until PR 2 lands, hard-code nothing: keep the fallback `Play a game` → `#games-heading`.
- On phones the Play button may shorten the title (`Play PEW`): use a `shortTitle` only if one exists in `projects.json`, else `Play`. Don't invent abbreviations in code.
- `<title>`, `og:` tags and the header/footer lockups keep saying **Longlight Interactive**. **CLAUDE.md says the home hero says Longlight Interactive and that "by Kelbo" sits under the hero name.** The kicker keeps the name in the hero; update that CLAUDE.md paragraph in this PR to describe the new layout (Kelbo confirmed, Q1).

### 2b. Layout and sizes

- Desktop (≥ 64rem): the hero text sits in a left column (`max-width: ~38rem`). The right column is empty in this PR; the spotlight card fills it in PR 2.
- Headline: `font-size: clamp(2.5rem, 5.2vw, 4.75rem); line-height: .98; letter-spacing: -0.03em`. One line of body copy at ~1.2rem on desktop, 1rem on phones.
- **Phone fold budget (≤ 39.99rem wide)**, roughly: header ≤ 64px, hero text block ≤ 300px, horizon sky ~150px + ground ~40px, ticker ~52px. Reduce `--sky-height` and `--ground-height` for the home hero on phones only (the `.page-head .horizon` overrides show the pattern). Don't shrink `--sun-size` below what the sky taps need to hit.
- Buttons: min height 48px on phones (44px floor for every tap target). On phones the two buttons sit side by side if they fit, else stack.

**Phone test:** open the home page on the phone at noon and after dark (`?at=night`). The headline reads "Deep games for small screens."; "Kelbo" is a link to About; the sun, swipe-to-wind-time and sky taps still work; the hero is visibly shorter than before.

---

## 3. PR 2: The spotlight card on the horizon

Files: `index.html`, `main.js` (new `setUpSpotlight(projects)`, called from `init()` after `projects.json` loads), `style.css`.

### 3a. Which game

- **Rule:** the first game in `projects.json` order with `"featured": true`. Today that's Prairie Engine Works. `featured` is already validated by `check-site.mjs` but nothing reads it yet, so this gives it a job. If no game is featured, use the first game. No new field.
- Kelbo changes the spotlight by moving a game up in `projects.json` or flipping `featured`. Write that in the comment above `setUpSpotlight`.

### 3b. The card

- Markup: an `<a>` (whole card links to the game's own page, `game.html?g=<slug>`, via the existing `projectSlug`) holding the cover (`image`, falling back to `art`), a `FEATURED` chip, the title, the version, and the `latest` line. Plus a separate `Play` link to `link`. Don't nest links: make the card an `<article>` with two `<a>`s, or use the existing card pattern from `renderProject`.
- `version` and `latest` already come from GitHub Releases at deploy (`sync-releases.mjs` + `release-lines.json`), so the card is always current. Prefix the line with "Lately:" only if `latest` exists; if it doesn't, use the first sentence of `summary`.
- If the game has a `cardClip`, reuse the existing "play the clip while the card is on screen" code (main.js item 15). Don't write a second video player.
- Look (from the canvas): slate card `#141413`, radius 20px top corners only (it **stands** on the line, so the bottom is square), `FEATURED` chip in light clay `#E8967A` on slate, version in lilac `#B48CE8` with tabular numbers, body text `#C9C5BC`. The same in light and dark themes, because it sits on the sky either way.

### 3c. Standing on the horizon

- The card's bottom edge sits exactly on `.horizon__line`. It is drawn **above** the sky layers (stars, sun, clouds) and **below** the header.
- Put the card **outside** `.horizon`'s element (a sibling, positioned over it) so its taps don't reach the horizon's swipe/drag and sky-tap handlers. Taps on the rest of the horizon must still wind time and open sky facts.
- Desktop: right column, width ~26–28rem, the cover at 4:3. The headline column and the card bottom-align, so the hero ends with the card on the line.
- Phones: a small card (~196px wide: cover ~92px tall + title) at the **right** end of the horizon, standing on the line. The grain elevator and windmill keep their spots; if the card would cover the elevator (it has the lit-window secret), move the card, not the elevator.
- The sun can pass behind the card as it moves across the sky. That's the default (it reads like the sun setting behind a building). Kelbo confirmed this (Q4): no fading or moving.
- Reduced motion: no entrance animation. Otherwise a short rise from below the line on first load (≤ 400ms), never on every scroll.

**Phone test:** the card stands on the line on the phone and on a computer, in light and dark; tapping the card opens the PEW game page; Play opens the game; swiping the sky beside the card still winds time; `?at=sunset` and `?at=night` look right with the card in front of the sky.

---

## 4. PR 3: One ticker strip instead of three boxes

Files: `index.html` (the `[data-now]` section and the two `<details>` at lines ~151–189), `main.js` (`setUpNow`, `setUpSkyWeek`, `setUpBadges`), `style.css`.

### 4a. The strip

- One full-width band directly under `.horizon__ground`, inside `.hero`, so the hero ends with it. Colour: a deeper shade of `--ground` (e.g. `color-mix(in srgb, var(--ground), var(--ll-slate) 30%)`) with a 3px ivory top edge that reads as the horizon line continuing. It follows the theme and the sunset warm-up like the rest of the hero.
- Contents, left to right, wrapping on desktop and **one sideways-scrolling row of chips on phones**:
  1. `● NOW BUILDING` label + the first two `now.json` items as links (existing `setUpNow` data; keep "hidden if now.json is empty").
  2. `Sky:` + the next sky event (the text `setUpSkyWeek` puts in `[data-sky-week-next]`, e.g. "Saturn is up after dark").
  3. `Badges {earned} of {total}` (the text `setUpBadges` puts in `[data-badges-count]`), pushed to the right end on desktop.
- The horizon's own readout ("Sets 5:10 PM · 6h 17m of light left") stays where it is in the ground band. Don't repeat it in the strip.

### 4b. Opening the full lists

- **Sky** and **Badges** become `<button>`s that open the full list in a `<dialog>` (one for each): the sky list, wishes and note; the badges list and "Saved on this phone only. Nothing is sent anywhere." Move the existing `<ol>`/`<ul>` nodes into the dialogs so `setUpSkyWeek` and `setUpBadges` keep filling the same elements.
- The `<details>` fold memory (which remembers open/closed) isn't needed any more. If it uses a localStorage key, leave the key alone (don't delete other code's data); just stop reading it.
- Dialog: close button (44px, `aria-label="Close"`), Esc closes, focus returns to the chip, tap outside closes. Light and dark styles.

### 4c. Don't break the hidden checks

- `main.js` ~line 2911 uses `document.querySelector("[data-badges]")` to know it's on the home page (the lit elevator window secret). Keep a `[data-badges]` element on the home page (the dialog works), or switch that check to an explicit `document.body.dataset.page === "home"` and add `data-page="home"` to `<body>`. Grep for every other `[data-badges]`, `[data-sky-week]` and `[data-now]` use and check each one still works.
- No-JS: the strip is hidden (like today's boxes) and the page still reads fine.

**Phone test:** the strip sits right under the horizon; it scrolls sideways with a finger; Sky opens the week's sky list; Badges opens the badge list and earning a badge still updates the count; the elevator window secret still works after dark.

---

## 5. PR 4: "Pick a game" as a grid with status filters

Files: `index.html` (games section, lines ~191–229), `main.js` (`setUpGameRow` → new `setUpGameGrid`), `style.css`, `projects.json` + `check-site.mjs` (optional `tagline`).

### 5a. Grid

- Replace the sideways row (`data-projects="row"`, `[data-row-nav]`) with a grid: `grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr))` on desktop, **two columns** on phones (`repeat(2, minmax(0, 1fr))`, 12px gap).
- Show **every game** in `projects.json` order (Kelbo's ranking), as Kelbo chose (Q5).
- Keep the Continue card (`[data-continue]`) above the grid exactly as it works today.
- Keep "All games →" to `games.html` in the section head.

### 5b. Card

- Cover (4:3), title, status pill, one short line, and a bottom row with **Play** (clay pill, links to `link`) and the version (tabular numbers, muted). Desktop only shows the short line; on phones the card is cover + title + status pill, with the whole card tappable to the game page and Play shown under the title.
- Reuse what you can from `renderProject` and the existing cover hover/hop/tilt code (`setUpCoverTilt`, `setUpCoverHop`) instead of a new card from scratch. The status pill colours stay the existing `.project__status` stages.
- **Short line:** add an optional `"tagline"` string (≤ 80 characters) to `projects.json` and validate it in `check-site.mjs` next to `featured`. Fall back to the first sentence of `summary` when it's missing. Add the appendix taglines to `projects.json` as written: Kelbo approved them (Q6).

### 5c. Filter chips

- Above the grid on the right of the heading (wrapping under it on phones): `All · {n}`, `Released · {n}`, `Polishing · {n}`, `Early builds · {n}`. Counts are worked out from the data, never typed in.
- Groups come from `STATUSES` in `main.js`: stage `out` or `live` → Released; label `Polishing` → Polishing; `In development`, `Prototype`, `Concept` → Early builds. Hide a chip whose count is 0.
- Use real `<button>`s with `aria-pressed`, in a `role="group"` with `aria-label="Filter games"`. Reuse `refilter()` (the Projects page's smooth filtering) for the animation. The choice isn't remembered (no new key).
- Today's counts on the live site are 4 released, 5 polishing and 2 early builds, but the code must not assume them.

**Phone test:** the first game cards peek above the bottom of the first screen on the phone; tapping each chip filters with the smooth slide; Play opens the game; Continue still appears after playing a game; the grid looks right in light and dark.

---

## 6. PR 5: Studio row, contact off the home page, footer

Files: `index.html` (sections 4 and 5, lines ~231–334), new `contact.html`, `main.js`, `style.css`, `sitemap.xml`, `sw.js` (if it lists pages).

### 6a. Studio row (replaces "Choose a mode")

Two cards side by side on desktop, stacked on phones:

- **Trading desk** (slate card): kicker `TRADING DESK`, title `Tools for my trading day` (Trading stays in Kelbo's own voice), the names of the `Trading` projects from `projects.json` joined with `·`, and the existing market light. Move `data-market` into this card so `setUpMarketLight` keeps working. Links to `trading.html`.
- **Latest devlog post** (white card): the cover of the post's `game` (if it has one), kicker `DEVLOG · {date}`, the post title, and its first sentence. Read it with the existing `loadDevlog()` (respect its hidden-game rule). Links to that post on `devlog.html`.
- `fillCategoryCounts` and the `.tiles` styles become unused on the home page. Leave the function if other pages use `data-category-count`; delete the home-only tile CSS in PR 6.

### 6b. Contact moves to its own page (Kelbo chose this, Q2)

- New `contact.html` with the form moved **unchanged** (same `action`, honeypot, Turnstile div, `data-contact-form`, `data-contact-status`). Copy the CSP tag, header, nav, footer `<defs>` and the Turnstile `<script>` from `index.html`. `setUpContactForm()` already finds the form by `data-contact-form`, so it should just work there.
- Remove the form and the Turnstile script from `index.html`.
- Add `contact.html` to `sitemap.xml`, and to `sw.js`'s list of pages if it keeps one (cache names stay `longlight-*`).

### 6c. Footer

- Add **Say hello** (→ `contact.html`) to the start of the footer links. Keep `© {year} Kelbo / Longlight Interactive` and the lockup.
- The nav stays **Games · Trading · All · About** with no Play button (Kelbo chose this, Q3). Don't touch other pages' menus.

**Phone test:** the Trading card shows "Market open/closed" on weekdays; the Devlog card opens the latest post; Say hello opens the contact page and a test message sends (Turnstile shows when needed); no contact form on the home page.

---

## 7. PR 6: Tidy and final pass

- Delete CSS and JS that only served the removed pieces: the sideways row and its arrows (`setUpGameRow`, `.project-list--row`, `.row-nav`), home-only tile styles, the old `.now` / `.sky-week` / `.badges` box styles that the strip and dialogs replaced. Grep each class and hook across every `.html` page before deleting: games.html, projects.html and others may share them.
- Update the comment list at the top of `main.js` (items 2, 5 and 12 change) and the comments in `index.html` that describe the sections.
- Check CLAUDE.md's description of the home page matches what shipped (hero updated in PR 1; also the games grid, ticker strip and contact page).
- Final check at 390×844, 430×932 and 1366×900, light and dark, `?at=noon|sunset|night`, reduced motion on, JavaScript off (the hero, links and `noscript` games link still make sense).
- Lighthouse-style sanity on the phone: covers are `loading="lazy"` except the spotlight; no layout jump when `projects.json` arrives (reserve the grid's height or show skeleton cards).

---

## 8. Decisions (Kelbo, 19 Nov 2026)

1. **Hero name (PR 1):** the headline is "Deep games for small screens."; "Longlight Interactive · Saskatoon, SK" goes in the small kicker above it; "by Kelbo" moves into the line under the headline. Update CLAUDE.md to match.
2. **Contact (PR 5):** new `contact.html`, linked as "Say hello" in every footer.
3. **Menu (PR 5):** keep Games · Trading · All · About, no Play button.
4. **Sun vs spotlight card (PR 2):** the sun may pass behind the card. No fading or moving.
5. **Home grid (PR 4):** every game, with the filter chips.
6. **Taglines (PR 4):** use the appendix drafts as written.

## 9. Out of scope

Other pages' layouts (games.html, projects.html and the rest keep their current look), any change to the sky simulation itself, new outside services or fonts, new analytics, any paid service. If something here seems to need one of those, stop and ask.

---

## Appendix: taglines (approved 19 Nov 2026, ≤ 80 characters)

| Game | Tagline |
| --- | --- |
| Prairie Engine Works | Build an engine part by part, put it on the dyno, then go racing. |
| Season Ticket | Own a football club and change tactics while the match plays. |
| Burn Rate | Design a solid rocket motor to spec, fire it, learn why it missed. |
| The Whip | Climb from rookie MP to Chief Whip. Every MP remembers your promises. |
| Scrapline | Build a combat robot under the weight limit and fight it in the arena. |
| Funded | Pass a prop-firm challenge without breaking the daily loss limit. |
| Lombard | Run a canal-side pawn shop: inspect, spot the fakes, haggle. |
| Frontier Lab | Found an AI lab and grow it across the world's tech capitals. |
| Quench | Heat, hammer and quench a blade, then find out what you made. |
| Hull Down | Design a tank against a weight limit and send it to trial. |
| Laminar | Prove a shape in the wind tunnel, then see if the tunnel was right. |

---

## Checklist

- [x] PR 1: Hero copy, headline, phone fold
- [x] PR 2: Spotlight card standing on the horizon
- [x] PR 3: Ticker strip + Sky and Badges dialogs
- [ ] PR 4: Games grid, status filters, taglines
- [ ] PR 5: Studio row, contact page, footer
- [ ] PR 6: Tidy, docs, final phone pass

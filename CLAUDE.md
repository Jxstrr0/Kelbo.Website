# Notes for Claude

Colby's personal site, hosted on GitHub Pages from the `main` branch root.
Live at https://jxstrr0.github.io/Kelbo.Website/

## Working on this repo

- **Auto-merge is allowed.** Once a change is pushed, the PR is open, and
  nothing is failing, merge it yourself without asking first.
- Colby is a beginner+ coder and mostly on his phone. Explain changes in
  plain language and keep code readable, with comments on anything
  non-obvious. He may edit files in the GitHub web or mobile editor.
- Only publish personal details Colby has approved. The site is public.

## Hard rules

- **Static only:** plain HTML, CSS, and vanilla JS. No frameworks, npm,
  bundlers, or build step.
- **No secrets.** The repo is public. Never commit API keys, tokens, or
  passwords. If a tool needs a key, talk through options with Colby first.
- Mobile first (works down to 360px wide), light and dark mode via
  `prefers-color-scheme` with every colour in CSS variables, accessible
  (semantic HTML, visible focus, good contrast, alt text,
  `prefers-reduced-motion`).
- Use relative links only, because the site lives under `/Kelbo.Website/`
  and may move to a custom domain later. The one exception is the `og:`
  link-preview tags in each page's `<head>`, which must be absolute; update
  them if the domain changes.
- The link preview image is `assets/social-preview.jpg` (1200×630, the neon
  look plus the four game covers). Regenerate it if the covers change a lot.

## Where things live

- `projects.json` is the single source of truth for projects. `main.js`
  renders it. Adding a project should never need an HTML edit.
- The status labels and progress-bar fill amounts are in `STATUSES` at the
  top of `main.js`.
- The look is "neon arcade" (dark synthwave hero, pink/cyan glow, project
  cards with cover images). Fonts: Space Grotesk + Press Start 2P (pixel
  accents only, always uppercase). Game covers live in `assets/covers/`
  (640×480 JPG, captured from each live game).
- Motion lives at the bottom of `style.css`, all inside
  `prefers-reduced-motion: no-preference`; `main.js` handles scroll reveal
  and skips it when reduce motion is on. Content must never depend on JS or
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
  page "Pick a game" cards are the `featured` projects (max 4).
- The nav (Games, Trading, AI, Projects; the CJ wordmark is home) is copied
  in every page and only just fits at 360px. Test before adding to it.
- `README.md` is Colby's plain-English editing guide. Keep it up to date
  when how things work changes.

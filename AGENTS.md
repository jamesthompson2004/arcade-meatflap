# Agent conventions — Meatflap Arcade

This is the canonical conventions doc for any AI coding agent working in this repo.
Read it first, regardless of which tool or machine you use. Read [HANDOFF.md](HANDOFF.md)
for relevant history and recent handoff notes; add useful context there after meaningful
work. Keep durable project conventions in this file.

`CLAUDE.md` is a thin entry point for Claude Code's automatic loading and points here.
All agents follow the same editing, validation, commit, and deployment conventions.

## What this is

Small browser games hosted at [arcade.meatflap.com](https://arcade.meatflap.com). Plain
HTML/CSS/JS — **no build step, no framework, no dependencies.** Every game lives in its own
`games/<name>/` folder and is fully self-contained (its own `index.html` + CSS + JS). Games
do not share code with each other, even when two are near-duplicates of each other (see
Eliza/Baconiza below) — that's a deliberate choice, not an oversight.

Do not introduce a bundler, npm scripts, or a `package.json` with build tooling. The deploy
workflow has `skip_app_build: true` specifically because this is a pure static site; adding
build tooling will break deployment unless the workflow is updated too.

## Workflow: commit straight to `main`, no PRs

Push directly to `main` instead of opening a pull request. This is a single-maintainer
project, so the PR review step isn't buying anything — and Azure Static Web Apps' Free tier
has a small cap on concurrent PR-preview staging environments, so opening PRs routinely trips
a "maximum number of staging environments" deploy failure on the preview build (harmless —
the real `main` deploy is unaffected — but it's noise). Commit locally, push to `main`, let
the existing CI/CD deploy it.

## Deployment

- Hosted on Azure Static Web Apps (Free tier).
- CI/CD via GitHub Actions — every push to `main` auto-deploys. Workflow file:
  `.github/workflows/azure-static-web-apps-zealous-bush-0efed390f.yml`.
- Custom domain `arcade.meatflap.com` is configured in Azure DNS (CNAME to the Static Web
  App's default hostname).

## New games target desktop first, not mobile

Default a new game to desktop-only: keyboard/mouse controls, no touch UI. Detect
touch/coarse-pointer devices and show a "come back on desktop" message instead of loading the
game, rather than building on-screen controls up front. Mobile support can come later, per
game, if it's worth the design effort — it is not a launch requirement.

- Canvas/board elements should still use responsive sizing (`max-width: 100%; height: auto;`)
  so the desktop-only message and page layout don't break on a small screen.
- Gate the game itself behind `window.matchMedia("(hover: none) and (pointer: coarse)")` and
  show a brief "this game doesn't work on mobile yet" block instead.
  - Reference implementations: `games/wander/`, `games/tetris/`, `games/bacman/` (see the
    inline script in each game's `index.html`).
- This policy doesn't apply to games with no real-time control scheme — e.g. `games/fireside/`
  (ambient visual, one button) and `games/eliza/`/`games/baconiza/` (text chat) work fine on
  mobile as-is and aren't gated.

`games/snake/` and `games/scout/` predate this policy and already have full touch support
(on-screen D-pad / Jump-Duck buttons) — that's fine as-is, but it's not the pattern to
replicate for new games going forward.

## Structure

```
index.html          hub page (game cards)
styles.css           shared hub styles + one .{name}-thumb block per game
games/
  <name>/            each game: its own index.html + css + js, fully self-contained
```

## Adding a new game — checklist

1. Create `games/<name>/index.html` (+ its own css/js). Follow the desktop-first policy above
   unless the game has no real-time control scheme.
2. Add a card for it on the hub in `index.html`.
3. Add a `.{name}-thumb` background + `::after` emoji block in `styles.css` (every existing
   game has one — copy the pattern from whichever is closest in tone).
4. Create a matching `game:<name>` GitHub label (see `gh label create`) — every game has one,
   used to scope issues to that game.
5. Push to `main` — the GitHub Actions workflow deploys automatically.

## Project-specific technical knowledge

Distilled from the (much longer, chattier) shared handoff log in `HANDOFF.md` — read that
file's log if you want the full story behind any of these, but the durable facts are here so
you don't have to.

**`games/wander/` — the flagship game, a procedural wireframe walking sim:**
- World population (trees, rocks, buildings, lemurs, pants, bird flocks) regenerates **fresh
  every frame** from a hash of world-cell coordinates + a session `SEED`, with no caching.
  Lakes/rivers are the one exception — river pathing is CPU-expensive, so they're generated
  once per cell and cached forever in `lakeCache` for the session. This matters if you're
  adding a live-tunable setting: density/behavior knobs apply instantly to unexplored areas
  just by reading a config value each frame; lake/river knobs only take hold after "New
  World" clears `lakeCache`.
- `games/wander/wander-config.js` holds `CONFIG_DEFAULTS`/`CONFIG_STORAGE_KEY`/
  `loadWanderConfig()`, shared between the game (`wander.js`) and the live settings sheet
  (`games/wander/settings.html`) so the two can't drift apart on what a knob defaults to. The
  `New World` button re-reads this in place (`Object.assign(CONFIG, loadWanderConfig())`) so
  a settings change applies without a full page reload.
- Buildings are single-room for now (#1 tracks multi-room) — "room" == the building's whole
  rectangle. `buildingContaining()` will need to get smarter if multi-room buildings land.
- Entities that "go away" (scared-off pants, startled bird flocks, collected bacon) use a
  `RespawnSet` — a `Map<key, removedAtSkyTime>` with the same `has/add/delete/clear` surface
  a plain `Set` had, so no call sites changed — that lets them come back after a timeout
  instead of an explored area staying permanently empty.
- Water collision: the player, pants, and lemurs are all blocked from entering a lake
  (pushed to the boundary) but can freely cross a river — river isn't a collision obstacle
  for anyone, and that's intentional, not a gap.
- Pants can spontaneously form leader/follower groups (#77) when they wander close to each
  other. The structure is deliberately kept **flat**: a free pants joining an existing group
  points its `leaderKey` at the group's original leader directly, never at another follower —
  no follow-chains, no matter how large the crowd gets.
- Fish in lakes (#66) are invisible except during a per-lake timed event (school breach or
  shore flop) — there's no persistent fish population to render otherwise.

**`games/eliza/` and `games/baconiza/` — same engine, intentionally duplicated, not shared:**
- Both are ports of Weizenbaum's 1966 ELIZA/DOCTOR mechanism (ranked-keyword decomposition/
  reassembly, pronoun reflection, a MEMORY stack, a NONE fallback list) — see
  `games/eliza/eliza.js`'s header comment for the mechanism details and the two subtleties
  that are easy to get wrong (keyword *detection* runs on the user's original words;
  decomposition *matching* runs on a pronoun-reflected copy).
- Baconiza is a clone of Eliza reskinned around bacon, built by literally copying the three
  files into a new folder and editing the copy (issue #79 asked for a clone with the original
  left intact, not a shared module) — if you improve one engine's logic, the other doesn't
  get it automatically. Check both when making an engine-level fix.
- **Capture-index gotcha:** a decomposition pattern's `{n}` reassembly placeholders only count
  wildcard (`W(...)`) and `ALT(...)` tokens in the pattern — literal words don't consume an
  index. It's very easy to write a reassembly referencing `{3}` when the pattern only has 2
  capturable slots, and the bug is *silent*: the placeholder just renders as empty text, which
  often still reads as a grammatically plausible (if less specific) sentence, so it doesn't
  visibly break. If you add or edit a decomposition rule, run this validator in the browser
  console before trusting it (catches mismatches across every rule in the file at once):
  ```js
  for (const entry of KEYWORDS) for (const d of entry.decomps) {
    const capCount = d.pattern.filter(t => t.wild || t.alt).length;
    for (const r of d.reassemblies) {
      const bad = [...r.matchAll(/\{(\d+)\}/g)].map(m => +m[1]).filter(n => n > capCount || n < 1);
      if (bad.length) console.log(entry.triggers, r, "bad indices:", bad);
    }
  }
  ```

## Testing in a browser preview

If you're using a sandboxed/automated browser tool to verify changes: it can aggressively
cache a bare directory URL's HTML document (e.g. `/games/wander/`) and, separately, individual
`<script src>`/`<link>` subresources, in ways normal `Cache-Control` headers don't explain —
a fresh navigation to the same URL sometimes still serves a stale script. If an edit doesn't
seem to have taken effect (a new field reads as `undefined`, a new function isn't defined),
don't assume the edit failed — try a cache-busting query string, or open a brand-new tab and
navigate there instead of reusing one that already loaded the page once. Confirm what the
server is actually returning with a direct `fetch(url, {cache: 'no-store'})` if in doubt.

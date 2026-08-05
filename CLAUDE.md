# Meatflap Arcade

Small browser games hosted at arcade.meatflap.com. Plain HTML/CSS/JS — no build step, no framework, no dependencies.

## New games target desktop first, not mobile

Default a new game to desktop-only: keyboard/mouse controls, no touch UI. Detect
touch/coarse-pointer devices and show a "come back on desktop" message instead of loading
the game, rather than building on-screen controls up front. Mobile support can come later,
per game, if it's worth the design effort — it is not a launch requirement.

- Canvas/board elements should still use responsive sizing (`max-width: 100%; height: auto;`) so the desktop-only message and page layout don't break on a small screen.
- Gate the game itself behind `window.matchMedia("(hover: none) and (pointer: coarse)")` and show a brief "this game doesn't work on mobile yet" block instead.
  - Reference implementations: `games/wander/`, `games/tetris/`, `games/bacman/` (see the inline script in each game's `index.html`).

`games/snake/` and `games/scout/` predate this policy and already have full touch support
(on-screen D-pad / Jump-Duck buttons) — that's fine as-is, but it's not the pattern to
replicate for new games going forward.

## Workflow: commit straight to `main`, no PRs

Push directly to `main` instead of opening a pull request. This is a single-maintainer
project, so the PR review step isn't buying anything — and Azure Static Web Apps' Free
tier has a small cap on concurrent PR-preview staging environments, so opening PRs
routinely trips a `maximum number of staging environments` deploy failure on the preview
build (harmless — the real `main` deploy is unaffected — but it's just noise to work
around). Commit locally, push to `main`, and let the existing CI/CD deploy it.

## Deployment

- Hosted on Azure Static Web Apps (Free tier).
- CI/CD via GitHub Actions — every push to `main` auto-deploys. Workflow file: `.github/workflows/azure-static-web-apps-zealous-bush-0efed390f.yml`.
- Custom domain `arcade.meatflap.com` is configured in Azure DNS (CNAME to the Static Web App's default hostname).
- Don't add a build step (bundler, npm scripts, etc.) — the deploy workflow has `skip_app_build: true` because this is a pure static site. Adding a `package.json` with build tooling will break the deploy unless the workflow is updated too.

## Structure

See README.md for the file layout and how to add a new game.

## A note between machines

This project gets worked on from more than one computer. If you're picking this up
somewhere new, feel free to leave a short note below for whichever machine (and whichever
Claude) finds this next — what you shipped, what you learned, anything worth knowing.
Keep entries brief, sign off with the date and time, and if this section ever gets unwieldy, feel
free to prune the oldest entries rather than let it grow forever.

---

*(Pruned the two oldest entries from tonight's Tetris/Bacman/stamina/Snake batch and the #50
bird-flock-across-walls fix — nothing in them needed to survive past this point. The
aspirational #38 performance lesson — a headless-browser-only perf "fix" can make real
rendering worse, get real DevTools profiling first — is still worth knowing if you go near
that issue again, just no longer spelled out here.)*

*(Pruned the 10:26pm and 10:54pm entries from 2026-07-30 — #49/#51/#54/#57/#59 all landed
and are stable; the one detail worth carrying forward is that `getNearbyPantsBase` has two
independent placement loops, outdoor hash-grid plus a `"room_" + building key` one, mentioned
again below where it's still relevant.)*

**2026-07-30, 11:15pm ET:** A different Claude, picking up right after the 10:54pm wrap-up.
Closed three quick ones James flagged as easy: #55 (pants now swing their legs while walking
normally, not just while fleeing — `pantsSegments`'s `swing` term was hardcoded to 0 unless
`p.fleeing`), #56 (bird flocks now ramp their wingspan/flap amplitude up from 0 over
`BIRD_TAKEOFF_DURATION` = 0.35s instead of popping straight to full flap on the same frame
`flying` goes true — added a `liftT` field alongside the existing `climb` rise), and #58
(Nubby now collides with pants using the exact same mutual-push pattern already used for
lemurs, gated behind a `PANTS_JUMP_CLEAR_HEIGHT` so you can still hop over one — this was
needed now that protected pants stand their ground instead of always fleeing on approach).
Verified all three by poking at game state directly in the browser console rather than eyeballing
pixels — cleaner than it sounds, and worth doing again if you're checking animation/physics
tuning rather than visuals. One gotcha I hit: don't drive `keys.forward` and then `wait()` across
separate tool calls to test movement — the game's own `requestAnimationFrame` loop keeps running
against real wall-clock time the whole time, including tool round-trip latency, so the player
travels much farther than the wait duration implies. Do the whole set-keys/sleep/read-result
sequence inside one script (a single `async` IIFE with `setTimeout`) instead. 🥓

**2026-07-31, 3:35pm ET:** A different Claude, on the Windows PC. Shipped lakes and rivers
in Wander (#52): lake basins blend into `terrainHeight` so the bed is always flat regardless
of raw noise, rivers do gradient-descent pathing downhill from the lake's rim with an
animated flow-tick shader, and everything is cached per-cell in `lakeCache` since river
pathing is genuinely CPU-expensive (unlike buildings/trees/rocks, which regenerate fresh
every frame on purpose). Along the way, fixed spawn ordering so lakes/rivers generate right
after the ground and buildings avoid *them* rather than the other way around (#65 — water is
the more fundamental terrain feature); fixed rivers occasionally flowing uphill or not
starting at the lake's water level, by seeding the downhill search from `waterY` and
terminating instead of falling back when no downhill direction exists (#63); and fixed rivers
vanishing mid-view while moving/turning, caused by visibility being decided from only the
lake's center point — now every river point is sampled and the closest wins (#64). Finished
by bumping `LAKE_DENSITY`/`LAKE_FLATNESS_MAX`/`RIVER_CHANCE` for a ~2x higher spawn rate per
James's request (#68). If you touch any of this, the constants are all named and grouped near
the top of `wander.js`, and there's a solid regression-test pattern already established:
measure exact violation counts across thousands of generated samples rather than eyeballing
it, since none of this renders in a screenshot-able way here anyway. 🥓

**2026-07-31, 7:10pm ET:** A different Claude, on the Mac. Closed out a batch of small Wander
fixes and shipped a new game. Fixes: #60/a follow-up — the Nubby-pants and lemur-pants
collision pushes moved `pantsState.x/z` directly with no wall re-check, so a bacon-protected
pants standing its ground in a room could get shoved straight through the wall; both push
sites now re-run `resolveWallCollision` against the pushed position, same as pants' normal
walk/flee movement already does. #61 — pants, bird flocks, and collected bacon no longer stay
gone forever: replaced the plain `goneKeys`/`goneBirdFlocks`/`collectedBacon` `Set`s with a
`RespawnSet` class (same `has`/`add`/`delete`/`clear` surface, so no call sites changed) that
remembers the `skyTime` a key was removed at and forgets it again once a timeout elapses
(60s/45s/75s respectively — the day/night cycle is 120s). #62 — added a canvas-drawn compass
at the top-left (deliberately *not* top-center, which collides with the fixed-position title
in desktop-fill mode): a fixed marker at top means "straight ahead," and N/E/S/W rotate
around it using the same relative-bearing math `celestialScreenPos` already uses for the sun.

New game: **Skibidi Translator** (`games/skibidi/`, #53 then #69). Type a sentence, content
words get swapped for slang while function words (a stoplist of ~90 articles/pronouns/
prepositions/auxiliary verbs) are left alone so the sentence's grammar stays legible. Each
swap keeps the original word's suffix (-s/-ing/-ed/-er/-est/-ly) and capitalization, so tense
and number still agree — that's the whole trick and it's in `detectForm`/`inflect`/
`genericInflect` if you want to add more words. Started with just "skibidi" (#53), then James
supplied a full Gen-Z slang list and #69 expanded `SLANG_WORDS` to ~30 terms plus a
`SLANG_PHRASES` list of fixed multi-word expressions (no cap, touch grass, main character
energy, ...) that are only ever chosen for a *plain*-form word, never inflected, so nothing
ever becomes "no capping." Also added the matching `game:skibidi` GitHub label — if you add
another new game, it wants one too, same convention as the other `game:*` labels. One thing
worth knowing: the highlighter tracks which tokens got replaced *during* the substitution pass
itself (a token array with a `replaced` flag) rather than pattern-matching the output
afterward — the original one-word version got away with regex-detecting "skibidi*" in the
output, but that stops working the moment the replacement pool isn't a single word anymore. 🥓

**2026-08-04 ET:** Another session, another batch of Wander work, plus the settings sheet
James had wanted for a while. In rough order:

#66 — fish jumping in lakes. Fish stay invisible under the water and only exist for the
duration of a per-lake event (`fishState`, keyed by the lake's own cache key, only ticks
while the lake is in `currentLakes`, same convention as bird flocks/pants): a school of 1-6
breaching, each fish on its own staggered arc so the school doesn't jump in lockstep, or —
rarer — a single fish flopping out onto the shore, flailing in place, then flopping back in.
Verified event lifecycles by driving `update()`/`render()` directly rather than waiting out
the real 7-16s interval.

#70/#71 — water correctness. Player always spawns at the origin, so `ensureSpawnLake()` now
force-inserts a lake a short random distance northwest of spawn straight into `lakeCache`
(bypassing the density roll, with a few retries for a flat spot) on load and every "New
World", so there's always water to find early on. Separately, pants/lemurs/bird flocks now
get the same lake-exclusion check buildings already had at spawn (#65's pattern extended),
and pants/lemurs got the player's own lake push-out collision added to their walk/flee
movement (rivers remain crossable for everyone, unchanged). While fixing the Nubby-pants
wall-clip bug (#60) I'd also found and fixed the identical bug in the lemur-pants push,
unprompted — same missing wall re-check, same fix.

#74 — cut sprint stamina drain 50% (`STAMINA_DRAIN_RATE` halved, refill untouched) per a
one-line ask; full stamina now lasts 7s of sprinting instead of 3.5s.

#24 — the "editable variables" issue, open since day one and finally done. Rather than
exposing every constant in the file, curated it to ~28 knobs weighted toward what's fun to
crank and what's changed most since the issue was filed: world population density (trees,
rocks, buildings, lemurs, lakes, rivers, pants — both outdoor and bacon-room-resident, bird
flocks, boss bacon), movement feel (speed, accel/decel, sprint stamina timing), wildlife
notice/flee radii and speeds, fish event timing/school size, and tree/rock/boss-bacon size
as a %± adjustment from the original value (never an absolute override, so the sheet always
reads relative to what shipped). Architecture: a `CONFIG` object whose defaults, storage key,
and loader (`loadWanderConfig`) now live in a new `wander-config.js`, loaded by both
`wander.js` and the new `games/wander/settings.html` (a plain form, linked from the game's
HUD as "⚙️ Settings") so the two can never drift apart on what a knob defaults to. The nice
surprise: almost none of the affected systems needed new regeneration logic, because
trees/rocks/pants/lemurs/birds/buildings already regenerate fresh every frame straight from
these constants with no caching — swapping a hardcoded const for a `CONFIG.xxx` read was
enough for the change to apply live to unexplored areas. Lakes are the one exception (cached
per-session in `lakeCache`, since river pathing is too expensive to redo every frame), so a
lake/river-density change only fully takes hold after "New World" — same caveat as always
with lakes. If you add more knobs later, follow the same three-piece pattern: default in
`CONFIG_DEFAULTS`, a `<label><input>` in `settings.html`, and a wired-up `name="..."` that
matches the CONFIG key exactly (the form reads/writes by key name generically, no per-field
JS needed). One test-harness gotcha, not a real bug: the sandboxed browser preview aggressively
caches the top-level HTML document for a bare directory URL (`/games/wander/`) across
navigations in a way normal cache-control doesn't explain — if a script tag you just added
isn't showing up in `document.head` after a reload, try a cache-busting query string or a
brand-new tab before assuming your edit didn't save. 🥓

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

**2026-07-30, 5:53pm ET:** Hey — whoever's reading this from the home desktop or the MacBook next,
welcome. Since this file last changed we shipped Tetris, Bacman (Nubby hunting runaway
bacon instead of being chased by ghosts — long story, see #40), stamina for Nubby's
sprint, and turned Snake into a growing strip of bacon. Also learned the hard way that a
"performance fix" measured only in a headless, non-compositing browser pane can make real
rendering *worse*, not better (#38, reverted, now aspirational) — if you ever chase that
one again, get real DevTools profiling first. Have fun out there. 🥓

**2026-07-30, 7:21pm ET:** Hi all — a different Claude here, picking this up after a big batch of
work had already landed from wherever you all were tonight (Tetris, Bacman, stamina, the
performance-pass-and-revert, all of it — nice work). Fixed #50: bird flocks could spawn with
their base point (and therefore some of the flock's members) landing across a building wall,
because `getNearbyBirdFlocksBase` was missing the same building-footprint exclusion check
that trees and rocks already had. One-line fix, same `footRadius + 3` pattern used everywhere
else. Confirmed the bug was real by re-running the old placement logic against 10 seeds
(14/126 flocks violated) vs. the fixed version (0/126). Good luck out there, and have fun with
Nubby. 🥓

**2026-07-30, 10:26pm ET:** Same Claude as 7:21pm, still going. Since then, closed out #49
(pants and birds can no longer be scared through walls — added a real segment-intersection
line-of-sight check, `wallBlocksLineOfSight`, and gated every scare trigger on it), #51 (pants
can now startle nearby bird flocks too, same as lemurs already startle pants, with fleeing
pants getting a 1.5x radius since they're loud and erratic), and #54 (pants now pop an
appreciative thought bubble — sized to the room's total bacon value, capped at 16, four text
tiers with a much bigger font at the top one — when they're in a room with bacon and the
player's nearby enough to witness it; walls block this exactly like they block scares).
Buildings are still single-room for now (#1), so "room" == the building's rectangle — worth
knowing if multi-room buildings ever land, since `buildingContaining` will need to get smarter.
Wrapping up for the night — good luck, whoever's next. 🥓

**2026-07-30, 10:54pm ET:** Still the same Claude from 7:21/10:26pm — this really is the
wrap-up now. James wanted to actually see #54 (bacon appreciation) in action, so I temporarily
made pants spawn in every bacon room, pushed it live, he confirmed it worked, and I reverted
back to the normal rare hash-grid placement. While testing it, he caught a real problem:
walking into a room would almost always scare the pants off before you could see it appreciate
anything. Fixed as #57 — a pants standing in a room with bacon is now protected and won't
flee at all, instead giving a bacon-themed "you can't scare me" quip on a cooldown before
carrying on with its normal wandering/appreciation. Then, since pants-in-a-bacon-room was
still basically never encountered normally, added #59: each bacon room now separately rolls a
15% chance of getting a resident pants, verified against 300 seeds to land at ~15.5%. If you
touch pants spawning again, note `getNearbyPantsBase` now has two independent placement
loops — the original outdoor hash-grid, plus the room-chance one keyed by `"room_" + building
key` — don't confuse the two. Good night out there. 🥓

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

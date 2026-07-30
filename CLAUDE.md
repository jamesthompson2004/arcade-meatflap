# Meatflap Arcade

Small browser games hosted at arcade.meatflap.com. Plain HTML/CSS/JS — no build step, no framework, no dependencies.

## Requirement: every game/page must work on both desktop and mobile

This applies from the start of building something new, not as a later retrofit.

- Canvas/board elements need responsive sizing: `max-width: 100%; height: auto;` on the canvas.
- Provide touch-friendly controls in addition to keyboard/mouse — an on-screen D-pad or large buttons, not swipe/tap alone. Show touch controls only on touch devices via `@media (hover: none) and (pointer: coarse)`, so desktop stays keyboard-only and uncluttered.
  - Reference implementations: `games/snake/` (D-pad) and `games/scout/` (Jump/Duck buttons).
- Before calling a game done, verify it in a mobile viewport (not just desktop) — resize the browser preview and test the touch controls, not just that the layout doesn't overflow.

**Exception: `games/wander/`.** It's a WASD + camera-turn 3D-style walker, and a D-pad (the pattern above) was tried but wasn't a good experience on mobile — so it currently detects touch/coarse-pointer devices and shows a "come back on desktop" message instead of loading the game (see the inline script in `wander/index.html`). This is a deliberate, temporary call, not an oversight — don't "fix" it by just re-enabling the existing D-pad. Revisiting mobile support for Wander means designing controls actually suited to first/third-person movement (e.g. a virtual joystick + drag-to-look), not the D-pad pattern used elsewhere.

## Deployment

- Hosted on Azure Static Web Apps (Free tier).
- CI/CD via GitHub Actions — every push to `main` auto-deploys. Workflow file: `.github/workflows/azure-static-web-apps-zealous-bush-0efed390f.yml`.
- Custom domain `arcade.meatflap.com` is configured in Azure DNS (CNAME to the Static Web App's default hostname).
- Don't add a build step (bundler, npm scripts, etc.) — the deploy workflow has `skip_app_build: true` because this is a pure static site. Adding a `package.json` with build tooling will break the deploy unless the workflow is updated too.

## Structure

See README.md for the file layout and how to add a new game.

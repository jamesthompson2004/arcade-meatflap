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

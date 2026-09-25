# Meatflap Arcade

Small browser games, hosted at [arcade.meatflap.com](https://arcade.meatflap.com).

Plain HTML/CSS/JS, no build step, no framework. Deployed via Azure Static Web Apps
with automatic CI/CD from GitHub Actions (pushes to `main` deploy straight to prod).

## Working with coding agents

Use whichever coding agent you prefer; the project instructions and handoff notes are shared
across tools and machines. Start a new session with:

> Read AGENTS.md and the relevant notes in HANDOFF.md, then get oriented.

- [AGENTS.md](AGENTS.md) is the source of truth for editing constraints, validation,
  the direct-to-`main` commit workflow, deployment, and game-specific technical notes.
- [HANDOFF.md](HANDOFF.md) holds shared context from previous sessions. Leave a brief dated
  note there when future work would benefit from what you learned or left unfinished.
- [CLAUDE.md](CLAUDE.md) is only an automatic-loading entry point for Claude Code;
  it points to the same shared documents.

## Structure

```
index.html          hub page (one card per game)
styles.css           shared hub styles + one .{name}-thumb block per game
games/
  <name>/            each game: its own index.html + css/js, fully self-contained
```

Current games: `bacman`, `baconiza`, `eliza`, `fireside`, `flappy`, `meatbreaker`, `scout`, `snake`,
`tetris`, `wander`.

## Adding a new game

1. Create `games/<name>/index.html` (+ its own css/js).
2. Add a card for it on the hub in `index.html`.
3. Add a `.{name}-thumb` block (background + emoji) in `styles.css`.
4. Create a matching `game:<name>` GitHub label, used to scope issues to that game.
5. Push to `main` — the GitHub Actions workflow deploys automatically.

See `AGENTS.md` for the desktop-first-for-new-games policy and other conventions.

## Local dev

No build step required. Serve the folder with any static file server, e.g.:

```bash
python3 -m http.server 8531
```

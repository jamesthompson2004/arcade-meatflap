# Meatflap Arcade

Small browser games, hosted at [arcade.meatflap.com](https://arcade.meatflap.com).

Plain HTML/CSS/JS, no build step, no framework. Deployed via Azure Static Web Apps
with automatic CI/CD from GitHub Actions (pushes to `main` deploy straight to prod;
pull requests get their own preview URL).

## Structure

```
index.html          hub page
styles.css           shared hub styles
games/
  snake/             first game
```

## Adding a new game

1. Create `games/<name>/index.html` (+ its own css/js).
2. Add a card for it on the hub in `index.html`.
3. Push to `main` — the GitHub Actions workflow deploys automatically.

## Local dev

No build step required. Serve the folder with any static file server, e.g.:

```bash
python3 -m http.server 8531
```

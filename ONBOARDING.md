# Meatflap Arcade — Setup Guide

This guide assumes you've never done any of this before. Every step is spelled out —
what to click, what to type, and why. It should take about 15–20 minutes, and none of it
involves a big download — this project has no build tools and no dependencies to install.

## What you're setting up

Meatflap Arcade is a collection of small browser games (plain HTML/CSS/JavaScript, no
framework) hosted at [arcade.meatflap.com](https://arcade.meatflap.com). This guide
downloads the project's code, sets up two small command-line tools, and gets **Claude
Code** — an AI coding assistant — pointed at the project so it can build and ship changes
for you.

You don't need to know how to code to use this guide. You do need to be comfortable
typing commands into a terminal window when told to.

## Step 0: Open a terminal

Some steps below use a **terminal** — a text-based window where you type commands.

- **On a Mac**: press `Cmd + Space`, type `Terminal`, press `Enter`.
- **On Windows**: install **Git for Windows** (Step 1 below), which includes a program
  called **Git Bash** — use that instead of Command Prompt or PowerShell for every
  command in this guide, since it understands the same commands as a Mac.

## Step 1: Install Git

Git downloads ("clones") this project's code and keeps track of changes to it.

- **Mac**: In Terminal, type `git -v` and press Enter. If Git isn't installed yet, macOS
  will offer to install "Command Line Developer Tools" — click **Install** and wait a few
  minutes.
- **Windows**: Go to [git-scm.com/download/win](https://git-scm.com/download/win),
  download it, open the installer, and click through with all default options (just keep
  clicking **Next**, then **Install**). Afterward, search "Git Bash" in your Start menu —
  that's your terminal for the rest of this guide.

Verify: run `git --version` — you should see a version number.

## Step 2: Install the GitHub CLI

This project tracks its to-do list as GitHub "issues." A small tool called `gh` lets
Claude Code read and update those issues (and check whether a change deployed
successfully) without you having to do it by hand in a browser.

- **Mac**: In Terminal, run:
  ```bash
  brew install gh
  ```
  (If you don't have Homebrew installed, go to [brew.sh](https://brew.sh) first and
  follow the one-line install command on that page, then try `brew install gh` again.)
- **Windows**: In Git Bash, run:
  ```bash
  winget install --id GitHub.cli
  ```
  (Or download the installer directly from [cli.github.com](https://cli.github.com).)

Once installed, connect it to your GitHub account:
```bash
gh auth login
```
Pick **GitHub.com**, then **HTTPS**, then let it open your browser to finish signing in —
follow the prompts on screen.

Verify: run `gh --version` — you should see a version number. Then run
`gh auth status` — it should say you're logged in.

## Step 3: Install Claude Code

If this computer doesn't already have Claude Code, go to
[claude.com/claude-code](https://claude.com/claude-code) and follow the install
instructions there (the CLI, desktop app, and IDE extensions all work — pick whichever
matches how you already use Claude). Sign in with your Anthropic account when prompted.

## Step 4: Download the project's code

In your terminal, navigate to where you want the project folder (e.g. your Desktop) and
run:

```bash
cd Desktop
git clone https://github.com/jamesthompson2004/arcade-meatflap.git
```

This creates a new folder named `arcade-meatflap` with the full project inside it —
every game, fully self-contained, no separate download or asset-syncing step needed.

## Step 5: Open the project in Claude Code

- **CLI**: in your terminal, run:
  ```bash
  cd arcade-meatflap
  claude
  ```
- **Desktop app**: open the app and open the `arcade-meatflap` folder from Step 4.

## Step 6: Let Claude Code get oriented

In your very first message to Claude Code in this project, say something like:

> Read AGENTS.md and get oriented.

`AGENTS.md` is this project's conventions doc — it explains the no-build-tools rule, the
"commit straight to `main`, no pull requests" workflow this project uses, the folder
structure, and notes on the trickier games. `CLAUDE.md` also exists and loads
automatically for Claude Code — it points back to `AGENTS.md`. Shared history and
handoff notes for every coding agent live in `HANDOFF.md`, which is worth a skim too.

## Step 7: Check that a local preview works

Claude Code tests changes by serving the site locally and checking it in a browser
before shipping anything. You can confirm this works yourself by running, from inside
the `arcade-meatflap` folder:

```bash
python3 -m http.server 8531
```

Then open `http://localhost:8531` in a browser — you should see the arcade hub page
with cards for each game. Press `Ctrl+C` in the terminal to stop the server when you're
done looking.

(If `python3` isn't found, install Python 3 from [python.org](https://www.python.org/downloads/)
first — Mac usually has it already.)

## Step 8: See what's on the to-do list

```bash
gh issue list --limit 30
```

This lists the same open issues Claude Code works from. Pick one, tell Claude Code to
take it on, and it'll implement the change, test it in a browser, commit, and push to
`main` — which automatically redeploys the live site at arcade.meatflap.com within a
minute or two.

## What's next

- Everything you need to know about how this project works day-to-day —
  conventions, deployment, and accumulated notes on each game — lives in **AGENTS.md**
  in the project folder. Start there any time you're unsure of something.
- There's nothing else to install and no separate "server" project — unlike Meatflap
  Park, this is a single self-contained repo.

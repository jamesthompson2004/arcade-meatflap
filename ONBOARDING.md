# Meatflap Arcade — Setup Guide

This guide assumes you've never done any of this before. It explains what to install,
what to type, and how to start working with either coding agent. Setup time depends on
which tools you already have. The games themselves have no build tools or dependencies.

## What you're setting up

Meatflap Arcade is a collection of small browser games (plain HTML/CSS/JavaScript, no
framework) hosted at [arcade.meatflap.com](https://arcade.meatflap.com). You'll download
the code, install Git and the GitHub CLI, and set up both **Claude Code** and **OpenAI
Codex** through their desktop apps. You can switch agents while keeping the same code
and project instructions.

You don't need to know how to code. Some setup steps require typing commands into a
terminal. You'll sign in separately to GitHub, Claude, and ChatGPT; access to one coding
agent does not provide access to the other. Follow each app's current account and access
requirements when signing in.

## Step 0: Open a terminal

A **terminal** is a text-based window where you type commands.

- **Mac**: press `Cmd + Space`, type `Terminal`, and press `Enter`.
- **Windows**: open **PowerShell** from the Start menu. This guide uses PowerShell for
  Windows commands. Git for Windows also includes Git Bash, which you can use if you
  prefer, but shell-specific commands in other instructions may differ.

After installing tools, close and reopen your terminal so it can find them. Restart
already-open coding apps too if they cannot find a newly installed tool.

## Step 1: Install Git

Git downloads ("clones") the code and keeps track of changes.

- **Mac**: run `git --version`. If macOS offers to install Command Line Developer Tools,
  accept and wait for the installation to finish.
- **Windows**: download [Git for Windows](https://git-scm.com/download/win), open the
  installer, and keep the default options. Reopen PowerShell afterward.

Verify: run `git --version` — you should see a version number.

Git also needs a name and email for your commits. Check whether they're already set:

```bash
git config --global user.name
git config --global user.email
```

If either is missing, set it with your own details (replace the example values):

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Use an email associated with your GitHub account, or the private commit email shown in
GitHub's email settings. These defaults apply to repositories on this computer.

## Step 2: Install the GitHub CLI

The `gh` command lets either coding agent read and update GitHub issues and check
whether a change deployed successfully.

- **Mac**: run `brew install gh`. If Homebrew isn't installed, follow the installation
  instructions at [brew.sh](https://brew.sh), including its shell setup steps, then retry.
- **Windows**: run `winget install --id GitHub.cli --exact` in PowerShell. Alternatively,
  get the installer from [cli.github.com](https://cli.github.com).

Reopen your terminal, then connect your GitHub account:

```bash
gh auth login
```

Choose **GitHub.com**, then **HTTPS**, and browser sign-in. Follow the prompts and
allow Git authentication when asked. Use an account with write access to this repository
if you intend to push changes.

Verify with `gh --version` and `gh auth status`.

## Step 3: Install both coding agents

### Claude Desktop / Claude Code

1. Follow the [official Claude desktop setup guide](https://code.claude.com/docs/en/desktop-quickstart)
   to download and install the app for your computer.
2. Open Claude and sign in with your Claude account.
3. Select **Code** for working on the repository. Follow any first-run setup prompts.

### ChatGPT Desktop / Codex

1. Follow the [official OpenAI quickstart](https://learn.chatgpt.com/docs/quickstart)
   to download and install the desktop app for your computer.
2. Open the app and sign in with your ChatGPT account.
3. Select **Codex** for software development. Follow any first-run setup prompts.

The linked guides have the current downloads, supported systems, and account requirements.
Installing these apps locally lets the agents work with your local project files; it
isn't an installation of offline AI models.

### Optional: terminal interfaces

The desktop apps are enough for this guide. If you prefer working in a terminal, follow
these separate installation guides:

- [Claude Code CLI](https://code.claude.com/docs/en/quickstart)
- [Codex CLI](https://developers.openai.com/codex/cli)

Once installed, run `claude` or `codex` from inside the project folder and follow the
sign-in prompts. You do not need both a desktop app and its CLI to get started.

## Step 4: Download the project's code

In your terminal, move to a folder where you want to keep your projects. For example,
these commands create a `Projects` folder inside your home folder if it doesn't exist.

**Mac:**

```bash
mkdir -p ~/Projects
cd ~/Projects
```

**Windows PowerShell:**

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\Projects"
Set-Location "$HOME\Projects"
```

Then, on either system:

```bash
git clone https://github.com/jamesthompson2004/arcade-meatflap.git
cd arcade-meatflap
```

This creates the `arcade-meatflap` folder with every game included. Clone once per
computer, not once per agent. If you already have the repository on this computer,
use that existing folder and follow the switching instructions below.

## Step 5: Open the project in either agent

- **Claude Desktop**: select **Code**, choose a local session, and select the
  `arcade-meatflap` folder from Step 4.
- **ChatGPT Desktop**: select **Codex**, add or open a project, and choose that same
  `arcade-meatflap` folder. Use a local task in the existing checkout for this workflow.

You can register the folder in both apps. Let one agent finish or stop before the other
starts editing that folder. If an app creates a separate worktree (an isolated checkout),
its changes must be brought back to the shared checkout before the other agent can use them.

## Step 6: Let your agent get oriented

Start a new session with:

> Read AGENTS.md and the relevant notes in HANDOFF.md. Check the Git status and recent commits, then get oriented.

[AGENTS.md](AGENTS.md) contains the editing constraints, validation guidance, and
**commit straight to `main`, no pull requests** workflow. Codex loads it automatically;
Claude Code loads [CLAUDE.md](CLAUDE.md), which points to the same instructions.
[HANDOFF.md](HANDOFF.md) contains shared history and notes from previous sessions.

## Step 7: Install Python and check the local preview

Python 3 provides a simple local web server for previewing these static games. Check
whether it is installed:

- **Mac**: run `python3 --version`.
- **Windows PowerShell**: run `py -3 --version`.

If the command isn't found, install Python 3 from
[python.org](https://www.python.org/downloads/), reopen the terminal, and check again.

From inside the `arcade-meatflap` folder, start the preview server:

**Mac:**

```bash
python3 -m http.server 8531 --bind 127.0.0.1
```

**Windows PowerShell:**

```powershell
py -3 -m http.server 8531 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:8531) in a browser. You should see the arcade hub
and be able to open its games. Keep the terminal running while using the preview;
press `Ctrl+C` there to stop the server.

Your coding agent can use this same preview to check changes. If it cannot run browser
checks in its current setup, have it explain what it verified and what needs a manual check.

## Step 8: Pick an issue and ship a change

From the project folder, run:

```bash
gh issue list --limit 30
```

Choose an issue and ask your coding agent to implement it, validate the change, commit,
and push to `main` following `AGENTS.md`. A push triggers the Azure Static Web Apps
workflow. Have the agent check the deployment result before treating the change as live.

## Switching between agents and computers

### On the same computer

1. Let the active agent finish or stop it before another agent edits the same folder.
2. Ask it to leave a brief dated note in `HANDOFF.md` when there is useful context:
   what changed, what was tested, and any unfinished work.
3. Open the same project folder in the next agent and use the orientation prompt from
   Step 6. Have it inspect existing changes before starting new edits.

Chat history does not automatically transfer between agents. Shared files, Git history,
and handoff notes carry the context. Uncommitted files are visible in the same checkout,
but don't automatically appear on another computer.

### On another computer

1. Before leaving, have the current agent finish, validate, commit, and push the work
   and any useful handoff notes. Because pushes to `main` deploy the site, don't push
   unfinished gameplay changes there just to transfer them; ask the agent to arrange
   an explicit handoff if you need to move unfinished work.
2. On the other computer, complete this guide's tool installation and sign-ins if needed.
   Use its existing clone, or clone the repository once if it has none.
3. In that computer's project folder, run:

   ```bash
   git status
   ```

   If it shows local changes or a branch other than `main`, ask your agent to inspect
   and reconcile them before continuing. Don't discard them to force an update.
4. With a clean working tree on `main`, run:

   ```bash
   git pull --ff-only origin main
   ```

   If Git reports diverging history, ask your agent to inspect and resolve it.
5. Start the next session with the orientation prompt from Step 6.

## What's next

Use [AGENTS.md](AGENTS.md) for project conventions and [HANDOFF.md](HANDOFF.md) for
session context, whichever agent you choose. There is no separate backend or game
dependency installation: this is one self-contained static repository.

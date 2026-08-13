# Ledger — a personal chess coach

A static, single-page chess coaching app. Paste in your game's PGN export, get an
AI-written review of your mistakes, and automatically turn your real blunders into puzzles
that build a puzzle Elo separate from your live game Elo. It tracks recurring weaknesses over
time and always tells you the one thing to fix before your next game.

No backend, no build step — just static files, so it deploys straight to GitHub Pages.

## Deploying to GitHub Pages

1. Create a new GitHub repo and push everything in this folder to it (`index.html`, `css/`, `js/`, this `README.md`).
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. GitHub gives you a URL like `https://yourname.github.io/repo-name/`. It can take a minute to go live.
4. Open the URL, go to **Settings** in the app, and paste in your own Anthropic API key.

## About your API key

- The key is stored only in `localStorage` in your browser — it is never written into any file
  in the repo and never committed to git. Someone browsing your repo's source code cannot see it.
- Calls go directly from your browser to Anthropic's API (no middleman server).
- The GitHub Pages URL itself is public by default: anyone with the link can open the app, but
  they'd need to enter their own key to use the AI features — your key doesn't travel with the page.
- Because it's a public link, don't paste anything into it you wouldn't want a stranger with the
  URL to see, and be mindful of your key if you ever share your screen.

## What it does

- **New Game** — paste in your game's PGN export (chess.com, lichess, or any other source). If you've
  saved your username in Settings, it's matched against the export's White/Black tags to fill in your
  color, opponent, and the result automatically. Then it generates a full move-by-move review: what
  was good, what wasn't, and specifically what you should have played instead and why.
- **Review** — a clickable, annotated move list next to a board, color-coded by inaccuracy /
  mistake / blunder, each with the coach's explanation.
- **Puzzles** — every real mistake or blunder from your games becomes a puzzle (the position right
  before you went wrong). Solve it to earn XP and move your **Puzzle Elo**, tracked completely
  separately from your **Live Game Elo** (which you update yourself after real games).
- **Weaknesses** — a running breakdown of mistake categories (hanging pieces, missed tactics,
  opening errors, endgame technique, etc.) across every game you've reviewed, plus a single
  "work on this before your next game" callout weighted toward your most recent games.
- **Settings** — API key, model, your username (for auto-filling New Game from a pasted PGN), live
  Elo, and full JSON export/import so you can back up or move your data.

## Notes

- Data lives entirely in your browser's `localStorage`. Different browser or device = different
  data, unless you export/import a backup (Settings → Data).
- The coaching review runs on your own Anthropic API key, so usage is billed to your own account.

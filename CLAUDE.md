# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Vanilla JavaScript Tetris. No build step, no package manager, no dependencies — just `index.html`, `style.css`, and `game.js` (Canvas 2D API).

## Running the game

Open `index.html` directly in a browser, or serve it locally (needed if testing anything that requires `http://` origin):

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no test suite, linter, or build/bundle process in this repo.

## Architecture

All game logic lives in `game.js` (~300 lines), driven by a `requestAnimationFrame` loop:

- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying the locked piece.
- **Pieces**: defined as square matrices; rotation is done via transpose + row-reverse (`rotateCW`).
- **Collision** (`collide`): checks piece cells against board bounds and locked cells.
- **Wall kicks** (`tryRotate`): on a colliding rotation, tries shifting the piece ±1/±2 columns before giving up on the rotation.
- **Game loop** (`loop`): accumulates elapsed time; drops the piece one row once `dropInterval` is exceeded, otherwise calls `lockPiece()`.
- **Line clearing** (`clearLines`): scans bottom-to-top; full rows are removed and empty rows unshifted at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by current level; hard drop adds 2 pts/cell dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level increases every 10 lines; drop speed = `max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.
- Game over is triggered in `spawn()` when a freshly spawned piece already collides.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` by `ROWS × BLOCK`).

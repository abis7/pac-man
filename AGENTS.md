# AGENTS.md

## Project

- Vanilla JS/HTML/CSS Pac-Man clone. No build step, no package.json, no bundler, no test framework, no linter/typecheck — do not invent `npm test`/`lint` commands.
- Run by opening `src/index.html` in a browser (a static server also works). "Testing" means loading the page and checking the browser console.
- Repo language is Spanish (README, code comments, UI text). Keep new code comments and user-facing text in Spanish.

## Architecture

- Classic script tags, no modules/imports. Load order in `src/index.html` matters: `maze.js` → `game.js` → `render.js` → `main.js`.
- Files communicate only via `window` globals: `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` (maze.js); `createGame`, `update`, `DIRS` (game.js); `draw` (render.js). New shared code must export on `window` and add its `<script>` tag in dependency order.
- Grid is 28 cols x 31 rows, cell coords (x, y) origin top-left. Tile codes: `#` wall(1), `.` dot(2), space walkable(0), `-` ghost-pen door(3).
- `MAZE` is pristine and never mutated: `createGame()` deep-copies it into `game.grid` so eaten dots don't corrupt restarts. Renderer draws from `game.grid`, never `MAZE`.
- Game states: `start` | `playing` | `won` | `lost`. `main.js` owns the rAF loop, keyboard, and overlay; `game.js` owns rules, movement, and collisions.

## Spec-driven workflow

- This repo exists to practice spec-driven development. Two repo-local skills: `/spec` (designs `specs/NN-slug.md`, asks questions, never writes code) and `/spec-impl` (implements only specs whose status means "Approved"; pauses after each plan step for diff review; never commits automatically).
- Specs live in `specs/NN-slug.md` (`specs/` may not exist yet — `/spec` creates it). Header state machine: Draft → In review → Approved → Implemented (Spanish equivalents accepted). `specs/.spec-config.yml` (`AutoCreateBranch`) controls branch creation.
- Default branch is `main`; remote `origin` is `https://github.com/abis7/pac-man.git`. `/spec-impl` creates `spec-NN-slug` branches, so branch from a clean `main`.
- `.agents/skills/` and `skills-lock.json` are managed by the skill installer — don't edit by hand.

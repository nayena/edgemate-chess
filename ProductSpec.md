# Product Spec — Dracula Chess

This document is the single source of truth for what we're building. If code and this document
disagree, this document wins until we deliberately update it.

## Glossary (plain-English definitions, used once here, then assumed known)

- **Cloudflare Workers** — a hosting platform where your code runs on-demand, close to the
  visitor, instead of on one server that's on all the time. We use the Free plan.
- **Wrangler** — the command-line tool and config file (`wrangler.jsonc`) used to configure and
  deploy a Cloudflare Workers project.
- **Static assets** — files (HTML/CSS/JS/images) served as-is, with no server code running.
  Fast and free.
- **SPA (single-page application) fallback** — a rule that says "if the requested file doesn't
  exist, serve `index.html` instead," so a JavaScript app can handle routing itself.
- **Durable Object** — a Cloudflare feature: one small server-side program that gets its own
  private memory and its own tiny SQLite database, with a guarantee that only one instance of
  it is ever running for a given name. We use one Durable Object per online chess room.
- **SQLite** — a lightweight, file-based database. Each Durable Object here keeps one SQLite
  database to remember the current board position, so the game survives a server restart.
- **WebSocket** — a connection between browser and server that both sides can send messages
  over at any time, without re-opening the connection (unlike a normal page request/response).
- **Room code** — a short text code both online players type in to land in the same Durable
  Object / game.
- **Minimax** — a simple algorithm for a computer opponent: it looks ahead a few moves, assumes
  both players always pick their best option, and picks the move that gives itself the best
  worst-case outcome.
- **Alpha-beta pruning** — a shortcut for minimax that skips checking moves it can prove won't
  change the outcome, so the computer can "think" faster at the same look-ahead depth.
- **Depth** (as in "depth 2") — how many half-moves (one player's single move) ahead the
  computer calculates before picking one. Depth 2 = it considers its move and your best reply.
- **Perft test** ("**perf**ormance **t**est", standard chess-programming term) — a test that
  counts every possible legal game continuation from a position, to a given depth, and checks
  the count against a known-correct number. It catches rules bugs that "looks right" testing
  would miss.
- **En passant** — a special pawn-capture rule: if an opponent's pawn just moved two squares
  and landed beside yours, you may capture it as if it had only moved one square, but only on
  your very next move.
- **Castling** — a special king+rook move (each side may do it once, under specific conditions)
  that moves the king two squares toward a rook and the rook to the square the king crossed.
- **Promotion** — when a pawn reaches the far end of the board, it must become a queen, rook,
  bishop, or knight, chosen by the player.
- **Check / checkmate / stalemate** — check: the king is under attack. Checkmate: the king is
  under attack and there's no legal move to escape it — game over, that side loses. Stalemate:
  the side to move has no legal move but isn't in check — game over, drawn.

## The three modes

### 1. Hot-seat
Two people share one device/screen and alternate turns on the same board. No account, no
server game-state needed — this can run as a purely static page.

### 2. Vs Computer
You play **White**; the browser calculates Black's moves using minimax + alpha-beta pruning at
look-ahead **depth 2**, and must always reply with a legal move within **2 seconds**. Runs
entirely in the browser — no server round-trip needed for the computer's "thinking."

*(Decision recorded 2026-09-15: user confirmed they play White, since White moves first and is
the simpler default to build and test. Swapping this later just means flipping which side the
engine plays.)*

### 3. Online
Two players type the same room code on two different devices. The **first to join plays
White**, the **second plays Black**, anyone after that just watches. The **server is the
referee** — it re-checks every move against `rules.js` before broadcasting it, so a modified or
buggy client can't cheat or desync the game. Refreshing the page **rejoins the same game** (no
progress lost). A "New game" action **resets the board for both players**. No timers of any
kind are used anywhere in the online path — the current position is saved to the Durable
Object's SQLite database after every single move, so there's nothing time-based to get wrong or
to recover after a crash.

## Definition of "done"

- All six piece types move according to full legal chess rules.
- Check, checkmate, and stalemate are detected and shown to the player(s).
- Castling, en passant, and promotion (with a choice of piece) all work.
- An illegal move cannot be made in the UI — not "is corrected after," literally not selectable.
- `rules.js` passes the perft test from the starting position: depth 1 = 20, depth 2 = 400,
  depth 3 = 8,902 legal move sequences. This is fixed *before* any UI or mode is built.
- Vs Computer always replies with a legal move within 2 seconds.
- Online mode behaves exactly as described above, including refresh-to-rejoin and New Game
  resetting both sides.
- Captured pieces + material count (the chosen optional extra, see below) is built **last**,
  only after the three modes above are solid.

## The look

Dark, late-night, "hacker desk lamp" mood, based on the well-known **Dracula** color theme:
a near-black background (around `#282a36`), a muted purple/lavender checkerboard instead of
plain black-and-white, and Dracula's signature accent colors — pink (`#ff79c6`), green
(`#50fa7b`), cyan (`#8be9fd`) — used for highlights and UI chrome. Typeface: a clean monospace
font (e.g. "JetBrains Mono" with a system monospace fallback), to keep a developer-tool feel.
A **selected piece** gets a glowing pink ring around its square. Every square it can **legally
move to** shows a small green dot in the middle of the square, or a green ring around the edge
of the square if moving there would capture the piece standing on it.

*(Decision recorded 2026-09-15: no Figma file is connected to this project/session, so the look
is defined here in writing rather than matched pixel-for-pixel to a design file. If a Figma file
becomes available later, this section should be updated to match it and treated as the source
of truth going forward.)*

## Not in scope

Accounts or logins, clocks, ratings, draw by repetition, the fifty-move rule, opening books,
move export (e.g. PGN), and React. The whole project is plain HTML, CSS, and JavaScript.

## Technical constraints (not negotiable)

- Cloudflare Workers **Free plan**. Static site served via `assets` in `wrangler.jsonc`, with
  `not_found_handling: "single-page-application"`. `run_worker_first` is set for the WebSocket
  path (so those requests reach our server code instead of being treated as a missing static
  file). `compatibility_date` is set to the date each change is made; `observability` (Cloudflare's
  built-in logging/metrics) is enabled.
- **`rules.js`** is the *only* place chess rules are written. It's written by hand — no
  `chess.js` or any other chess library — and is imported by hot-seat, vs-computer, and the
  online server code alike, so all three modes are provably playing by the same rules. It must
  pass the perft test (see "Definition of done") before any other code is built on top of it.
- **No Socket.IO, Express, or `ws`.** Online multiplayer is one **SQLite-backed Durable Object
  per room**, looked up with `env.ROOM.getByName(roomCode)`, declared with `new_sqlite_classes`
  in `wrangler.jsonc`. Connections use Cloudflare's native WebSocket API
  (`ctx.acceptWebSocket()`), messages are JSON objects shaped like `{ type, payload }`, and a
  connected player's identity is remembered on their WebSocket via `ws.serializeAttachment()`.
  **No timers of any kind** — the game position is saved after every move instead of on a clock.

## Optional extra (built last)

**Captured pieces + material count.** Once a piece is captured, it's shown in a small tray on
the side of the board for the player who captured it, and a running material-point total (using
standard chess piece values) shows which side is ahead and by how much. This is purely a display
feature — it doesn't change any rule.

## Decisions log

Recorded here so later sessions don't have to guess why something is the way it is:

- **2026-09-15** — Game name chosen: "Dracula Chess" (chess + Dracula, per user request).
- **2026-09-15** — GitHub repo: reused the user's existing empty repo at
  `https://github.com/nayena/ChessGame.git` rather than creating a new one.
- **2026-09-15** — Vs Computer color: user plays White (default/simpler case; swappable later).
- **2026-09-15** — Optional extra: captured pieces + material count (chosen over undo-in-hot-seat,
  sound-on-move, and resign-online).
- **2026-09-15** — Look/design source: no Figma file was connected to this session, so the look
  is written out above instead of matched to a design file.

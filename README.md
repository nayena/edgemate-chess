# Dracula Chess

A browser chess game with three ways to play: pass-and-play on one screen, against a simple
in-browser computer opponent, or online against a friend using a shared room code. Built on
Cloudflare Workers with plain HTML, CSS and JavaScript — no frameworks, no chess libraries.

By Heidy Naranjo.

## What this is

Dracula Chess is a from-scratch implementation of chess rules (see `rules.js`) plus three ways
to play them:

1. **Hot-seat** — two people share one screen and take turns.
2. **Vs Computer** — you play White, the browser calculates Black's replies (minimax with
   alpha-beta pruning, look-ahead depth 2). No server involved.
3. **Online** — two people type the same room code on two different devices and see each
   other's moves live. A small always-on program on Cloudflare's servers (see "How it's built"
   below) keeps the two devices in sync.

Full legal chess is in scope: castling, en passant, pawn promotion (with a choice of piece),
check, checkmate, and stalemate. Illegal moves are simply not allowed to happen. Out of scope,
on purpose: accounts, clocks, ratings, the draw-by-repetition and fifty-move rules, opening
books, move export, and React.

## The look

Dark, late-night, "hacker desk lamp" mood — inspired by the Dracula color theme popular with
developers. Near-black background, a muted purple-and-lavender checkerboard, and Dracula's
signature accent colors (pink, green, cyan) used for highlights. A selected piece gets a glowing
pink ring on its square; every square it can legally move to shows a small green dot, or a green
ring if moving there would capture a piece. Typeface is a clean monospace font, to keep the
developer-tool feel.

## How it's built (plain English)

- **Cloudflare Workers** — the hosting platform. Instead of renting a whole server that runs all
  the time, your code runs only when a request comes in, on Cloudflare's network of data
  centers around the world. The free plan is enough for this project.
- **Static assets** — the HTML/CSS/JS files for the board and menus are served directly by
  Cloudflare as plain files, which is fast and free. Only the Online mode needs a live program
  running on the server.
- **Durable Object** — a Cloudflare feature that gives one small piece of server-side code its
  own private memory and its own tiny database, and guarantees only one copy of it runs at a
  time. Each online chess room gets exactly one Durable Object, so there's never a mix-up about
  whose move it is.
- **WebSocket** — a live, two-way connection between a browser and the server that stays open
  (unlike a normal web request, which opens, gets one answer, and closes). This is how each
  player's moves appear instantly on the other player's screen.
- **rules.js** — one file, written by hand, that knows every chess rule and is shared by all
  three modes and by the server. This guarantees hot-seat, vs-computer, and online games can
  never disagree about what's legal.

See `ProductSpec.md` for the full specification and `FEATUREROADMAP_workplan.md` for the
task-by-task build plan and current status.

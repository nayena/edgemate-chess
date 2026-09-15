# Feature Roadmap / Workplan — EdgeMate

Order of work, per the product spec: rules engine first (nothing else can be trusted until it's
correct), then **hot-seat live on the internet**, then **vs computer**, then **online rooms**,
then the **optional extra** (captured pieces + material count).

Each task lists: what it depends on, which files it touches, and its Definition of Done (DoD) —
the concrete, checkable condition that makes the task "finished," not just "started."

---

## Phase 0 — Project setup ✅ in progress

- [x] Create GitHub repo and push initial commit
      **Files:** `.gitignore`
      **DoD:** repo exists on GitHub, `main` has one commit, remote is connected.
- [x] Write `README.md`, `ProductSpec.md`, `FEATUREROADMAP_workplan.md`
      **Depends on:** initial commit
      **Files:** `README.md`, `ProductSpec.md`, `FEATUREROADMAP_workplan.md`
      **DoD:** all three documents exist, committed, and a pull request is open for review.

## Phase 1 — Rules engine (blocks every later phase)

- [ ] Scaffold the Cloudflare Workers project (`wrangler.jsonc`, `package.json`, empty
      `public/` folder for static assets)
      **Depends on:** Phase 0
      **Files:** `wrangler.jsonc`, `package.json`
      **DoD:** `npx wrangler dev` runs locally without errors and serves a blank page.
- [ ] Write `rules.js`: board representation, move generation, and legality checking for all six
      piece types, including check detection
      **Depends on:** scaffold
      **Files:** `rules.js`
      **DoD:** exports functions to generate legal moves from a position and apply a move.
- [ ] Add castling, en passant, and promotion to `rules.js`
      **Depends on:** base move generation
      **Files:** `rules.js`
      **DoD:** all three special-move types are legal exactly when chess rules say they should
      be, and illegal in every other case.
- [ ] Add checkmate and stalemate detection
      **Depends on:** legality checking
      **Files:** `rules.js`
      **DoD:** a game correctly reports checkmate or stalemate in known test positions (e.g.
      Fool's Mate, Scholar's Mate, a simple stalemate setup).
- [ ] Write the perft test
      **Depends on:** all of the above
      **Files:** `rules.test.js` (or similar), `rules.js`
      **DoD:** from the starting position, the test prints depth 1 = 20, depth 2 = 400,
      depth 3 = 8,902 — matching the known-correct counts. **This must pass before Phase 2
      starts.**

## Phase 2 — Hot-seat mode, live on the internet

- [ ] Build the board UI (squares, pieces, Dracula-theme styling, selected-square and
      legal-move highlighting)
      **Depends on:** Phase 1 passing perft
      **Files:** `public/index.html`, `public/style.css`, `public/board.js`
      **DoD:** board renders the starting position in the Dracula look described in
      `ProductSpec.md`.
- [ ] Wire the board UI to `rules.js` for two-player, same-screen play
      **Depends on:** board UI
      **Files:** `public/board.js`, `rules.js`
      **DoD:** two people can play a full legal game on one screen, including castling, en
      passant, promotion, check, checkmate, and stalemate; illegal moves cannot be made.
- [ ] Deploy to Cloudflare Workers
      **Depends on:** working hot-seat mode
      **Files:** `wrangler.jsonc`
      **DoD:** the game is reachable at a public `*.workers.dev` URL and hot-seat mode is fully
      playable there by two people on one browser.

## Phase 3 — Vs Computer

- [ ] Implement minimax with alpha-beta pruning at depth 2 in the browser
      **Depends on:** Phase 1 (`rules.js`)
      **Files:** `public/engine.js`, `rules.js`
      **DoD:** given any legal position, the engine returns a legal move.
- [ ] Wire "Vs Computer" mode into the UI (player = White, engine = Black)
      **Depends on:** engine, hot-seat board UI
      **Files:** `public/board.js`, `public/engine.js`
      **DoD:** a full game can be played against the computer start to finish; the engine always
      replies within 2 seconds.
- [ ] Deploy the update
      **Depends on:** working Vs Computer mode
      **Files:** `wrangler.jsonc`
      **DoD:** Vs Computer is playable on the public URL from Phase 2.

## Phase 4 — Online rooms

- [ ] Create the Room Durable Object (SQLite-backed) that stores the current position
      **Depends on:** Phase 1 (`rules.js`)
      **Files:** `room.js` (or similar), `wrangler.jsonc` (`new_sqlite_classes` binding)
      **DoD:** `env.ROOM.getByName(roomCode)` returns a working Durable Object instance that can
      save and load a board position.
- [ ] Accept WebSocket connections and assign player identity (White / Black / spectator)
      **Depends on:** Room Durable Object
      **Files:** `room.js`
      **DoD:** first connection to a room is assigned White, second is assigned Black, others
      are spectators, using `ctx.acceptWebSocket()` and `ws.serializeAttachment()` — no
      Socket.IO/Express/`ws` library involved.
- [ ] Validate and broadcast moves server-side
      **Depends on:** WebSocket connections, `rules.js`
      **Files:** `room.js`, `rules.js`
      **DoD:** every incoming move is checked against `rules.js` before being applied or
      broadcast; illegal moves sent by a client are rejected, not applied.
- [ ] Handle refresh-to-rejoin and "New game"
      **Depends on:** move validation/broadcast
      **Files:** `room.js`, `public/online.js`
      **DoD:** refreshing the page reconnects to the same in-progress game; "New game" resets
      the board for both connected players.
- [ ] Wire the room-code UI (enter/create a code, join, see live opponent moves)
      **Depends on:** all of the above
      **Files:** `public/online.js`, `public/index.html`
      **DoD:** two people on two separate devices can type the same room code and play a full
      legal game live against each other.
- [ ] Deploy the update
      **Depends on:** working online mode
      **Files:** `wrangler.jsonc`
      **DoD:** all three modes are playable on the public URL.

## Phase 5 — Optional extra: captured pieces + material count

- [ ] Track captured pieces per side as moves are made
      **Depends on:** Phases 2–4 complete
      **Files:** `public/board.js`, `rules.js`
      **DoD:** every capture, in every mode, is recorded.
- [ ] Display captured-piece trays and a running material-count difference
      **Depends on:** capture tracking
      **Files:** `public/board.js`, `public/style.css`
      **DoD:** both players can see captured pieces and material balance update live, in all
      three modes, styled to match the Dracula look.
- [ ] Deploy the update
      **Depends on:** working feature
      **Files:** `wrangler.jsonc`
      **DoD:** the feature is live on the public URL — this is the final task in the roadmap.

---

## How we'll work through this

For every task above: implement it, commit it on its own branch, push, and open a pull request
for your review — never force-pushed, never committed straight to `main`. Nothing in Phase 2
starts until the Phase 1 perft test is passing.

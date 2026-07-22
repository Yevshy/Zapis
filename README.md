# Записочки

Anonymous real-time multiplayer "consequences" game, running entirely on Cloudflare:
**Cloudflare Workers** serve the app and hold the HTTP routes, **Durable Objects**
are the authoritative game rooms, and **WebSockets** push every state change to
players instantly — no polling, no external database, no accounts.

---

## How it works, in one paragraph

Each room is one **Durable Object** instance, addressed by its 6-letter room
code (`GAME_ROOM.idFromName(code)`), so the code *is* the room's address —
no separate lookup table needed. Every browser opens a WebSocket to
`/ws/<code>`, which the Worker forwards straight into that room's Durable
Object. The Durable Object holds the only copy of the game state, mutates it
in response to messages (`start`, `submit`), and broadcasts the new public
state to every connected socket. It uses the **Hibernatable WebSockets API**,
so a quiet room (nobody currently typing) doesn't cost any compute between
messages — the object can hibernate and wake back up when a message arrives,
restoring its state from Durable Object storage.

---

## Project structure

```
zapysochky/
├── index.html                 # Vite entry / app shell
├── wrangler.toml               # Worker + Durable Object + static assets config
├── vite.config.ts
├── package.json
├── tsconfig.json                # client build (DOM lib)
├── tsconfig.worker.json         # worker typecheck (Workers types, no DOM)
├── public/                      # static passthrough assets (favicon, etc.)
└── src/
    ├── shared/                  # imported by BOTH client and worker
    │   ├── types.ts             # GameStatus, PublicRoomState, WS message types
    │   ├── questions.ts         # the 5 fixed questions (Ukrainian)
    │   ├── nicknames.ts         # anonymous nickname generator
    │   └── roomCode.ts          # 6-letter room code generation/validation
    ├── worker/                  # runs on Cloudflare, never shipped to the browser
    │   ├── index.ts             # fetch() router: REST + WS upgrade + static assets
    │   ├── env.ts                # Env bindings interface
    │   ├── gameRoom.ts           # the GameRoom Durable Object class
    │   └── roomState.ts          # pure game-state functions (start/submit/rotate/etc.)
    └── client/                  # runs in the browser, bundled by Vite
        ├── main.ts               # bootstrap, routing, Actions implementation
        ├── state.ts               # tiny observable store
        ├── actions.ts              # Actions interface shared by screens
        ├── socket.ts                # WebSocket client w/ reconnect + backoff
        ├── api.ts                    # REST calls (create room / room info)
        ├── identity.ts                # persists anonymous playerId/nickname
        ├── dom.ts                      # escaping, pluralization, icons
        ├── style.css
        └── screens/
            ├── home.ts        # create / join a room
            ├── lobby.ts        # waiting room + Start button states
            ├── round.ts        # active question screen + spectator view
            └── results.ts      # reveal + browse every paper
```

---

## Install & run locally

You need two terminals — one for the Worker/Durable Object backend, one for
the Vite dev server (which proxies `/api` and `/ws` to the Worker).

```bash
npm install

# terminal 1 — Worker + Durable Object, on http://127.0.0.1:8787
npm run dev:worker

# terminal 2 — Vite dev server with hot reload, on http://127.0.0.1:5173
npm run dev
```

Open `http://127.0.0.1:5173`. Open a second tab (or an incognito window,
since identity is stored in `localStorage` per browser) to test with a second
player.

---

## Deploy to Cloudflare

This ships as a **single Worker** that serves both the built frontend and the
Durable Object backend — one command, one deployable:

```bash
npm install
npm run deploy      # = `vite build` then `wrangler deploy`
```

The first deploy will:
1. Build the client into `dist/` via Vite.
2. Upload the Worker script and register the `GameRoom` Durable Object class
   (the `[[migrations]]` block in `wrangler.toml` handles this automatically).
3. Upload `dist/` as the Worker's static assets (`[assets]` binding), served
   for any request that isn't `/api/*` or `/ws/*`.

You'll need to be logged in first: `npx wrangler login`.

If you'd rather deploy the frontend and backend as two separate Cloudflare
projects (e.g. Pages for the frontend, a Worker for the backend), split the
`[assets]` block out of `wrangler.toml`, point the frontend at your Worker's
`*.workers.dev` URL for `/api` and `/ws`, and deploy `dist/` with
`wrangler pages deploy dist` instead. The single-Worker setup above is
simpler and is what's configured out of the box.

---

## Rooms & URLs

- `/` — home screen: create a room or join one by code.
- `/join/ABC123` — direct link into a specific room (shareable).
- Room codes are 6 uppercase letters (ambiguous letters `I`/`O` excluded).

---

## Gameplay rules implemented

- Anonymous nickname generated per browser (`src/shared/nicknames.ts`),
  persisted in `localStorage` so a refresh reconnects you to the same seat
  instead of joining as a new player.
- Minimum 2 players to enable **Start**. Once a game starts, nobody new can
  join that game — later joiners see a "wait for the next game" spectator
  screen.
- 5 rounds, fixed question order (`Який? / Хто? / Як? / Що зробив? / Кого?`).
- Every player has one paper. Paper ownership per round is computed with a
  pure formula (`paperIndexForPlayer`) rather than by mutating a "current
  holder" — this makes rotation immune to race conditions, since every
  server-side event recomputes the same deterministic answer.
- A round only advances once **everyone seated** has submitted; then all
  papers reveal simultaneously and every paper is browsable.

### Disconnects

Presence is tracked by the WebSocket connection itself (no client heartbeat
needed). If a player disconnects mid-game, their seat is held for **30
seconds** (a Durable Object alarm tracks the exact deadline). If they
reconnect in time (same `playerId`, restored from `localStorage`), they pick
up exactly where they left off. If they don't, their answer for the current
round is auto-filled with `"…"` so the rest of the table is never stuck
waiting on someone who left for good.

### After the reveal

Results stay on screen for a short window, after which the Durable Object
automatically resets the room to a fresh lobby (carrying over anyone still
connected), matching "a new waiting lobby begins automatically."

---

## Extending it

- **More questions / longer games**: edit `src/shared/questions.ts` and
  `TOTAL_ROUNDS` in `src/shared/types.ts`.
- **Persisting finished games** (e.g. a gallery of past results): the Durable
  Object already has `ctx.storage` available — write completed games to a
  separate key (or to D1 if you want them queryable across rooms) inside
  `returnToLobby`/`alarm` in `gameRoom.ts` before the state is reset.
- **Rate limiting / abuse prevention**: add a check in
  `src/worker/index.ts`'s `/api/create-room` handler (e.g. Cloudflare's
  built-in rate limiting rules, or a simple counter in a Durable Object).
- **Typed Env bindings**: run `npm run cf-typegen` to regenerate
  `worker-configuration.d.ts` from `wrangler.toml` if you add new bindings.

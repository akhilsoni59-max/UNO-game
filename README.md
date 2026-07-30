# ChromaCards

6-player multiplayer color card game with private rooms and shareable join links.

Premium table presentation: high-resolution raster card artwork, six-seat layout
engine, Bézier card-transfer animations, Web Audio SFX, and design tokens. Server
remains authoritative for all rules.

## Features

- Create a room → get a code + shareable link (`/room/ABC123`)
- **2–6 players** (host starts when enough people are connected)
- Server-authoritative rules (play, draw, pass, reverse, skip, +2, wild, +4)
- **ONE!** call + catch penalty (+2)
- **Reconnect** after refresh/disconnect (stable player token)
- Leave room from lobby or table
- **Premium game layer**: PNG card faces/backs, seat geometry, draw/play flights, turn FX
- Color picker for wilds, rematch back to lobby
- Sound on/off (synthesized SFX; no copyrighted audio)
- Debug HUD: add `?debug` to the client URL
- Development visual-event simulator: open an active room with `?debug`, then
  use the `DEV` control or press `Alt+V`

## Quick start

```bash
cd UNO-game
npm.cmd install
npm.cmd run install:all
npm.cmd run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  

Open the client in two browser windows (or one normal + one private) to test multiplayer. Share the room link so others can join.

## Production

```bash
npm.cmd run build
npm.cmd run start
```

Serves the built client from the server on port 3001.

Recommended cloud architecture:

- **Vercel** serves the Vite/React frontend using `vercel.json`.
- **Railway** (or another persistent container host) runs the authoritative
  Socket.IO server using the root `Dockerfile` and `railway.json`.
- **Supabase** stores profiles, operational room snapshots, match history, and
  leaderboard data. Apply migrations from `supabase/migrations`.

Required production environment variables:

| Host | Variable | Purpose |
|---|---|---|
| Railway | `CLIENT_ORIGIN` | Exact Vercel production origin |
| Railway | `SUPABASE_URL` | Supabase project URL |
| Railway | `SUPABASE_SERVICE_ROLE_KEY` | Server-only database credential |
| Vercel | `VITE_SERVER_URL` | Public Railway service URL |

Never add the Supabase service-role key to a Vercel variable prefixed with
`VITE_`; those values are bundled into browser JavaScript.

## Smoke test (server logic)

```bash
cd server
node src/smoke-test.js
```

## Notes

Original game (not affiliated with Mattel UNO). Rules inspired by classic color-matching shedding games.

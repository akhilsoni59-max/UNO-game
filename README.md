# ChromaCards

6-player multiplayer color card game with private rooms and shareable join links.

Premium table presentation: original SVG cards, six-seat layout engine, Bézier card-transfer animations, Web Audio SFX, and design tokens. Server remains authoritative for all rules.

## Features

- Create a room → get a code + shareable link (`/room/ABC123`)
- **2–6 players** (host starts when enough people are connected)
- Server-authoritative rules (play, draw, pass, reverse, skip, +2, wild, +4)
- **ONE!** call + catch penalty (+2)
- **Reconnect** after refresh/disconnect (stable player token)
- Leave room from lobby or table
- **Premium game layer**: SVG card faces/backs, seat geometry, draw/play flights, turn FX
- Color picker for wilds, rematch back to lobby
- Sound on/off (synthesized SFX; no copyrighted audio)
- Debug HUD: add `?debug` to the client URL

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

## Smoke test (server logic)

```bash
cd server
node src/smoke-test.js
```

## Notes

Original game (not affiliated with Mattel UNO). Rules inspired by classic color-matching shedding games.

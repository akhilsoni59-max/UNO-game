# ChromaCards

6-player multiplayer color card game with private rooms and shareable join links.

## Features

- Create a room → get a code + shareable link (`/room/ABC123`)
- Up to **6 players**
- Server-authoritative rules (play, draw, pass, reverse, skip, +2, wild, +4)
- **ONE!** call + catch penalty (+2)
- Premium printed-style cards + Framer Motion play animations
- Felt table UI, color picker for wilds, rematch back to lobby

## Quick start

```bash
cd chromacards
npm.cmd install
npm.cmd run install:all
npm.cmd run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  

Open the client URL on multiple browsers/devices (same Wi‑Fi / localhost) to test multiplayer. Share the room link so others can join.

## Production

```bash
npm.cmd run build
npm.cmd run start
```

Serves the built client from the server on port 3001.

## Notes

Original game (not affiliated with Mattel UNO). Rules inspired by classic color-matching shedding games.

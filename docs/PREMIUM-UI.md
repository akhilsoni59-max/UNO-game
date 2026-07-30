# Premium table UI — architecture notes

## Decision

Keep React + Socket.IO multiplayer and server rules. Replace the in-game **presentation** with a dedicated game layer (SVG cards, layout engine, rAF animation queue, Web Audio). PixiJS deferred to avoid multiplayer risk; same separation of concerns.

## Modules

| Module | Role |
|--------|------|
| `game/tokens/*` | Design + motion tokens |
| `game/layout/TableLayoutEngine` | Normalized seats, fan math, scale |
| `game/cards/*` | SVG face/back + action icons |
| `game/animation/*` | Orchestrator, transfer layer, FPS overlay |
| `game/sound/SoundManager` | Synthesized SFX + prefs |
| `game/components/PremiumGameTable` | Stage composition |
| Server `lastAction.id` | Deterministic animation dedupe |

## Run

```bash
cd UNO-game
npm run install:all
npm run dev
```

- Client: http://localhost:5173  
- Debug overlay: http://localhost:5173/?debug  

## Validation

- Six seats via `seatPlayersClockwise` + role anchors  
- Draw/play flights via `CardTransferLayer` + Bézier  
- Reduced motion: `prefers-reduced-motion` shortens durations  
- Sound: unlock on first interaction; mute in HUD  

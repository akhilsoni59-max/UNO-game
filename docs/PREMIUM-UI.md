# Premium table UI - architecture notes

## Decision

Keep React, Socket.IO multiplayer, and the server rules. The active table uses a
dedicated game-presentation layer built from high-resolution PNG cards, a logical layout engine,
an animation queue, a visual transfer layer, and synthesized Web Audio effects.
PixiJS remains unnecessary for the current card count and would add migration
risk without improving the authoritative game model.

## Modules

| Module | Role |
|---|---|
| `game/tokens/*` | Central visual and motion tokens |
| `game/layout/TableLayoutEngine` | Normalized seats, card fan math, responsive scale |
| `game/cards/Card.tsx` | Runtime mapping from card data to raster PNG artwork |
| `public/assets/raster-cards/*` | Complete generated card face/back asset family |
| `tools/generate_raster_cards.py` | Reproducible raster deck generator |
| `artifacts/premium-card-master-v3.png` | ImageGen art-direction master used for the production deck |
| `artifacts/premium-card-deck-v3-contact-sheet.png` | Visual QA sheet containing all 55 unique runtime assets |
| `game/animation/*` | Awaitable orchestrator, transfer layer, and FPS overlay |
| `game/events/GameVisualEvents` | Backend-ready semantic visual event contract |
| `game/components/GameEventSimulator` | Development-only visual event controls |
| `game/sound/SoundManager` | Synthesized sound hooks and preferences |
| `game/components/PremiumGameTable` | Stage composition and state-to-visual adapter |
| Server `lastAction.id` | Deterministic animation deduplication |

## Card asset pipeline

Every face uses one premium construction system: dark outer keyline, warm-white
rim, saturated suit field, large ivory diamond, outlined display glyph, and
mirrored corner index. ImageGen supplies the art-direction master; the checked-in
raster generator reproduces its geometry deterministically so values and action
symbols cannot drift between cards.

Regenerate and visually audit the complete deck with:

```powershell
python tools\generate_raster_cards.py `
  --out client\public\assets\raster-cards `
  --contact-sheet artifacts\premium-card-deck-v3-contact-sheet.png
```

## Visual event contract

`GameVisualEvent` is the public animation-facing API. It accepts deal, draw,
play, turn, color, skip, direction, and win events without importing Socket.IO
or authoritative rule state. The current server `lastAction` payload is adapted
into the same animation path. A future backend can emit this event union directly
while continuing to own hands, rules, turns, and validation.

## Development controls

```bash
cd UNO-game
npm.cmd run install:all
npm.cmd run dev
```

- Client: `http://localhost:5173`
- Debug overlay and event simulator: append `?debug` to an active room URL.
- Reduced-motion QA override: append `?reduced` to an active room URL.
- Toggle the simulator with `Alt+V`.
- While the simulator is open, `D` triggers draw and `P` triggers play.

The simulator is development-only and does not replace the live game state.
It drives the same visual event adapter intended for the future backend.

## Validation

- Six seats are assigned by `seatPlayersClockwise` and normalized role anchors.
- Initial dealing launches cards one at a time in seat order with overlapping
  flights, local-card flips, and destination reveals on landing.
- Draw and play events use `CardTransferLayer` with Bezier paths.
- Reduced motion shortens non-essential animation timing.
- Sound unlocks on interaction and can be muted from the HUD.
- Responsive screenshots are stored in `artifacts/screenshots`.

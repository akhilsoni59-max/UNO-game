import { useMemo } from "react";
import type { GamePlayer } from "../../types";
import { CardView } from "../cards/Card";
import { computeFanSlots, type SeatLayout } from "../layout/TableLayoutEngine";
import { gameTokens } from "../tokens/gameTokens";

interface Props {
  player: GamePlayer;
  seat: SeatLayout;
  onCatch?: () => void;
  visibleCount?: number;
  activeOverride?: boolean;
}

export function OpponentHand({ player, seat, onCatch, visibleCount, activeOverride }: Props) {
  const count = player.cardCount;
  const active = activeOverride ?? player.isTurn;
  const dealtCount = visibleCount == null ? count : Math.min(count, visibleCount);
  const show = Math.min(dealtCount, seat.maxVisibleCards);
  const cardW = gameTokens.opponentCardW;
  const cardH = gameTokens.opponentCardH;
  const fanWidth = Math.min(130, Math.max(36, show * cardW * 0.4));

  const slots = useMemo(
    () =>
      computeFanSlots(show, {
        center: seat.anchor,
        fanWidth,
        cardW,
        cardH,
        rotationDeg: seat.handRotation,
        curveDepth: 4,
        maxAngle: 6,
        compact: true,
      }),
    [show, seat.anchor.x, seat.anchor.y, seat.handRotation, fanWidth, cardW, cardH]
  );

  const nameOffset = nameOffsetFor(seat);

  return (
    <div className={`gc-seat ${active ? "is-turn" : ""} ${player.connected === false ? "is-offline" : ""}`}>
      {slots.map((s, i) => (
        <div
          key={i}
          className="gc-opp-card"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: cardW,
            height: cardH,
            transform: `translate(${s.x - cardW / 2}px, ${s.y - cardH / 2}px) rotate(${s.rotation}deg)`,
            zIndex: s.z + 2,
            transition: "transform 200ms cubic-bezier(0.22, 0.75, 0.18, 1)",
          }}
        >
          <CardView faceDown width={cardW} height={cardH} />
        </div>
      ))}

      <div
        className="gc-avatar-block"
        style={{
          position: "absolute",
          left: nameOffset.x,
          top: nameOffset.y,
          transform: "translate(-50%, -50%)",
          zIndex: 20,
        }}
      >
        <div className={`gc-avatar ${active ? "pulse" : ""}`}>
          <span>{initials(player.name)}</span>
          <svg className="gc-timer-ring" viewBox="0 0 52 52" aria-hidden>
            <circle className="track" cx="26" cy="26" r="23" />
            <circle className="progress" cx="26" cy="26" r="23" pathLength="100" />
          </svg>
        </div>
        <div className="gc-player-meta">
          <div className="gc-player-name">{player.name}</div>
          <div className="gc-player-count">
            {count}
            {player.saidOne ? " · ONE" : ""}
            {player.connected === false ? " · off" : ""}
          </div>
          {active && <div className="gc-turn-caption">PLAYING</div>}
        </div>
        {player.cardCount === 1 && !player.saidOne && onCatch && (
          <button type="button" className="gc-catch-btn" onClick={onCatch}>
            Catch
          </button>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function nameOffsetFor(seat: SeatLayout) {
  const { anchor, nameSide } = seat;
  const d = 52;
  switch (nameSide) {
    case "above":
      return { x: anchor.x, y: anchor.y - d };
    case "below":
      return { x: anchor.x, y: anchor.y + d + 10 };
    case "left":
      return { x: anchor.x - d - 10, y: anchor.y };
    case "right":
      return { x: anchor.x + d + 10, y: anchor.y };
    default:
      return { x: anchor.x, y: anchor.y - d };
  }
}

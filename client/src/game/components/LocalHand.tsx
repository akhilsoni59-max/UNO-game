import { useMemo, useState } from "react";
import type { Card } from "../../types";
import { CardView } from "../cards/Card";
import { computeFanSlots, type Point } from "../layout/TableLayoutEngine";
import { sound } from "../sound/SoundManager";

interface Props {
  cards: Card[];
  playableIds: Set<string>;
  isTurn: boolean;
  inputLocked: boolean;
  center: Point;
  fanWidth: number;
  cardW: number;
  cardH: number;
  hiddenIds?: Set<string>;
  onPlay: (card: Card) => void;
  onInvalid: (card: Card) => void;
}

export function LocalHand({
  cards,
  playableIds,
  isTurn,
  inputLocked,
  center,
  fanWidth,
  cardW,
  cardH,
  hiddenIds,
  onPlay,
  onInvalid,
}: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);

  const visible = cards.filter((c) => !hiddenIds?.has(c.id));
  const slots = useMemo(
    () =>
      computeFanSlots(visible.length, {
        center: { x: center.x, y: center.y },
        fanWidth,
        cardW,
        cardH,
        rotationDeg: 0,
        curveDepth: 22,
        maxAngle: 16,
      }),
    [visible.length, center.x, center.y, fanWidth, cardW, cardH]
  );

  // Hover separation: push neighbors
  const hoverIndex = hoverId ? visible.findIndex((c) => c.id === hoverId) : -1;

  function activate(card: Card) {
    if (inputLocked) return;
    const playable = playableIds.has(card.id);
    if (!isTurn || !playable) {
      setShakeId(card.id);
      sound.play("invalid");
      onInvalid(card);
      setTimeout(() => setShakeId(null), 320);
      return;
    }
    // Touch: select then play
    if (selectedId === card.id) {
      setSelectedId(null);
      onPlay(card);
      return;
    }
    setSelectedId(card.id);
    sound.play("lift");
    // Desktop second path: immediate play on double intent — single click plays if mouse
    if (window.matchMedia("(hover: hover)").matches) {
      setSelectedId(null);
      onPlay(card);
    }
  }

  return (
    <div className="gc-local-hand" style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
      {visible.map((card, i) => {
        const slot = slots[i];
        if (!slot) return null;
        const playable = isTurn && playableIds.has(card.id);
        const isHover = hoverId === card.id;
        const dist = hoverIndex >= 0 ? i - hoverIndex : 0;
        const sep = hoverIndex >= 0 && dist !== 0 ? Math.sign(dist) * Math.max(0, 10 - Math.abs(dist) * 3) : 0;
        const lift = isHover ? -18 : playable ? -4 : 0;
        const scale = isHover ? 1.06 : selectedId === card.id ? 1.05 : 1;
        const z = isHover || selectedId === card.id ? 100 + i : slot.z;

        return (
          <div
            key={card.id}
            className="gc-hand-slot"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: cardW,
              height: cardH,
              transform: `translate(${slot.x - cardW / 2 + sep}px, ${slot.y - cardH / 2 + lift}px) rotate(${slot.rotation}deg) scale(${scale})`,
              zIndex: z,
              transition: "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              pointerEvents: "auto",
            }}
          >
            <CardView
              card={card}
              width={cardW}
              height={cardH}
              playable={playable}
              dimmed={isTurn && !playable}
              selected={selectedId === card.id}
              shaking={shakeId === card.id}
              onClick={() => activate(card)}
              onPointerEnter={() => {
                setHoverId(card.id);
                if (playable) sound.play("lift", i % 3);
              }}
              onPointerLeave={() => setHoverId((h) => (h === card.id ? null : h))}
            />
          </div>
        );
      })}
    </div>
  );
}

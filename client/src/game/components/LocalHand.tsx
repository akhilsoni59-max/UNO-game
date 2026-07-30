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
  visibleCount?: number;
  onPlay: (card: Card) => void;
  onInvalid: (card: Card) => void;
  onBusy?: () => void;
  onDragStart?: (card: Card) => void;
  onDragEnd?: () => void;
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
  visibleCount,
  onPlay,
  onInvalid,
  onBusy,
  onDragStart,
  onDragEnd,
}: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);

  const visible = cards
    .filter((c) => !hiddenIds?.has(c.id))
    .slice(0, visibleCount == null ? cards.length : visibleCount);
  const slots = useMemo(
    () =>
      computeFanSlots(visible.length, {
        center: { x: center.x, y: center.y },
        fanWidth,
        cardW,
        cardH,
        rotationDeg: 0,
        curveDepth: 5,
        maxAngle: 4,
      }),
    [visible.length, center.x, center.y, fanWidth, cardW, cardH]
  );

  // Hover separation: push neighbors
  const activeId = hoverId ?? selectedId;
  const hoverIndex = activeId ? visible.findIndex((c) => c.id === activeId) : -1;

  function activate(card: Card) {
    if (inputLocked) {
      onBusy?.();
      return;
    }
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
    <div
      className="gc-local-hand"
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(".gc-card[role='button']")
        );
        const current = buttons.indexOf(document.activeElement as HTMLElement);
        if (current < 0 || buttons.length < 2) return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        buttons[(current + delta + buttons.length) % buttons.length]?.focus();
      }}
      aria-label="Your hand"
    >
      {visible.map((card, i) => {
        const slot = slots[i];
        if (!slot) return null;
        const playable = isTurn && playableIds.has(card.id);
        const isHover = hoverId === card.id;
        const dist = hoverIndex >= 0 ? i - hoverIndex : 0;
        const sep = hoverIndex >= 0 && dist !== 0 ? Math.sign(dist) * Math.max(0, 19 - Math.abs(dist) * 5) : 0;
        const lift = isHover ? -13 : selectedId === card.id ? -9 : playable ? -3 : 0;
        const scale = isHover ? 1.04 : selectedId === card.id ? 1.025 : 1;
        const z = isHover || selectedId === card.id ? 100 + i : slot.z;

        return (
          <div
            key={card.id}
            className="gc-hand-slot"
            data-card-id={card.id}
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
              draggable={playable}
              onDragStart={() => onDragStart?.(card)}
              onDragEnd={onDragEnd}
            />
          </div>
        );
      })}
    </div>
  );
}

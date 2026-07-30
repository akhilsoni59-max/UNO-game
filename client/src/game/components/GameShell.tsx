import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ChatMessage, GameAction, RuleSettings } from "../../types";

const QUICK_MESSAGES = ["Good play", "Nice one", "Your move", "Rematch?"] as const;

export function GameShell({
  playerCount,
  roomCode,
  messages,
  currentPlayerId,
  onSendChat,
  rules,
  actions,
  connectionState,
  children,
}: {
  playerCount: number;
  roomCode: string;
  messages: ChatMessage[];
  currentPlayerId?: string;
  onSendChat: (text: string) => Promise<void>;
  rules: RuleSettings;
  actions: GameAction[];
  connectionState: "connected" | "reconnecting";
  children: ReactNode;
}) {
  const [openPanel, setOpenPanel] = useState<"rules" | "chat" | null>(null);
  const [seenMessages, setSeenMessages] = useState(messages.length);
  const unread = openPanel === "chat" ? 0 : Math.max(0, messages.length - seenMessages);

  useEffect(() => {
    if (openPanel === "chat") setSeenMessages(messages.length);
  }, [messages.length, openPanel]);

  return (
    <div className={`gc-game-shell players-${playerCount}`}>
      <RulesPanel
        roomCode={roomCode}
        playerCount={playerCount}
        rules={rules}
        actions={actions}
        open={openPanel === "rules"}
        onClose={() => setOpenPanel(null)}
      />

      <main className="gc-board-column">{children}</main>

      <ChatPanel
        messages={messages}
        currentPlayerId={currentPlayerId}
        open={openPanel === "chat"}
        onClose={() => setOpenPanel(null)}
        onSend={onSendChat}
      />

      {connectionState === "reconnecting" && (
        <div className="gc-network-state" role="status" aria-live="assertive">
          <i aria-hidden="true" />
          Reconnecting to the table…
        </div>
      )}

      <nav className="gc-panel-tabs" aria-label="Game information">
        <button
          type="button"
          className={openPanel === "rules" ? "is-active" : ""}
          aria-expanded={openPanel === "rules"}
          onClick={() => setOpenPanel((value) => (value === "rules" ? null : "rules"))}
        >
          RULES
        </button>
        <button
          type="button"
          className={openPanel === "chat" ? "is-active" : ""}
          aria-expanded={openPanel === "chat"}
          onClick={() => setOpenPanel((value) => (value === "chat" ? null : "chat"))}
        >
          CHAT
          {unread > 0 && <span>{Math.min(unread, 99)}</span>}
        </button>
      </nav>
    </div>
  );
}

function RulesPanel({
  roomCode,
  playerCount,
  rules,
  actions,
  open,
  onClose,
}: {
  roomCode: string;
  playerCount: number;
  rules: RuleSettings;
  actions: GameAction[];
  open: boolean;
  onClose: () => void;
}) {
  const rows = [
    ["MATCH", "Play the active color, number, or action symbol."],
    [
      "DRAW",
      rules.drawUntilPlayable
        ? "Draw until a playable card appears; only the final card may be played."
        : "Draw once; only that newly drawn card may be played.",
    ],
    [
      "PENALTY",
      rules.stacking
        ? "Stack the same +2 or +4 card, or take the accumulated penalty."
        : "+2 and Wild +4 are taken immediately. No stacking.",
    ],
    ["WILD +4", "Legal only when you hold no card matching the active color."],
    ["REVERSE", "Changes direction. With two players it also skips."],
    ["CALL 1", "Press 1 within three seconds or draw two cards."],
    [
      "SPECIAL",
      [
        rules.jumpIn ? "Identical cards may jump in out of turn." : "",
        rules.sevenZero ? "Seven swaps hands; zero rotates every hand." : "",
      ].filter(Boolean).join(" ") || "Classic turn order with no 7–0 hand swaps.",
    ],
  ] as const;

  return (
    <aside className={`gc-side-panel gc-rules-panel ${open ? "is-open" : ""}`}>
      <PanelHeader eyebrow="FIELD MANUAL" title="House rules" onClose={onClose} />
      <div className="gc-rules-status">
        <span>ROOM {roomCode}</span>
        <span>{playerCount} PLAYERS</span>
      </div>
      <ol className="gc-rule-list">
        {rows.map(([title, copy], index) => (
          <li key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{title}</strong>
              <p>{copy}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="gc-activity-feed" aria-labelledby="activity-title">
        <div>
          <small>LIVE RECORD</small>
          <h3 id="activity-title">Recent actions</h3>
        </div>
        {actions.length ? (
          <ol>
            {actions.slice(-5).reverse().map((action) => (
              <li key={action.id}>
                <i className={`is-${action.type}`} aria-hidden="true" />
                <span>{action.message || action.type}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>Actions will appear as the round unfolds.</p>
        )}
      </section>
      <p className="gc-rules-footnote">
        Server-authoritative · {Object.values(rules).some(Boolean) ? "Custom table" : "Classic table"}
      </p>
    </aside>
  );
}

function ChatPanel({
  messages,
  currentPlayerId,
  open,
  onClose,
  onSend,
}: {
  messages: ChatMessage[];
  currentPlayerId?: string;
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  async function send(clean: string) {
    if (!clean || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(clean);
      setText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent");
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(text.trim());
  }

  return (
    <aside className={`gc-side-panel gc-chat-panel ${open ? "is-open" : ""}`}>
      <PanelHeader eyebrow="ROOM CHANNEL" title="Table chat" onClose={onClose} />
      <div className="gc-chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="gc-chat-empty">
            <i />
            <strong>Quiet table</strong>
            <span>Say hello or call out a good play.</span>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={message.playerId === currentPlayerId ? "is-you" : ""}
            >
              <header>
                <strong>{message.name}</strong>
                <time>
                  {new Date(message.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </header>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>
      <div className="gc-quick-chat" aria-label="Quick messages">
        {QUICK_MESSAGES.map((message) => (
          <button type="button" key={message} disabled={sending} onClick={() => void send(message)}>
            {message}
          </button>
        ))}
      </div>
      <form className="gc-chat-form" onSubmit={submit}>
        <label htmlFor="table-chat">Message the table</label>
        <div>
          <input
            id="table-chat"
            value={text}
            maxLength={180}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type a message…"
            autoComplete="off"
          />
          <button type="submit" disabled={!text.trim() || sending}>
            {sending ? "…" : "SEND"}
          </button>
        </div>
        <span className={error ? "is-error" : ""} aria-live="polite">
          {error || `${text.length}/180`}
        </span>
      </form>
    </aside>
  );
}

function PanelHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <header className="gc-side-header">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      <button type="button" onClick={onClose} aria-label={`Close ${title}`}>
        ×
      </button>
    </header>
  );
}

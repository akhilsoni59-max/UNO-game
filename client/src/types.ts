export type Color = "red" | "yellow" | "green" | "blue";
export type CardType = "number" | "skip" | "reverse" | "draw2" | "wild" | "wild4";

export interface Card {
  id: string;
  color: Color | "black";
  type: CardType;
  value?: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  isYou: boolean;
  isBot?: boolean;
}

export interface GamePlayer {
  id: string;
  name: string;
  cardCount: number;
  saidOne: boolean;
  eliminated: boolean;
  isTurn: boolean;
  isYou: boolean;
  connected?: boolean;
  isBot?: boolean;
}

export interface RuleSettings {
  stacking: boolean;
  jumpIn: boolean;
  drawUntilPlayable: boolean;
  sevenZero: boolean;
}

export interface GameAction {
  id?: string;
  type: string;
  message?: string;
  playerId?: string;
  targetId?: string;
  card?: Card;
  color?: string;
  count?: number;
  reason?: string;
  jumpIn?: boolean;
  time?: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  time: number;
}

export interface LobbyState {
  status: "lobby";
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  minPlayers: number;
  rules: RuleSettings;
}

export interface GameState {
  status: "playing" | "finished";
  code: string;
  hostId: string;
  currentColor: Color;
  currentPlayerId: string | null;
  direction: number;
  pendingDraw: number;
  winnerId: string | null;
  ranking: string[];
  lastAction: GameAction | null;
  actionLog: GameAction[];
  topCard: Card | null;
  discardCount: number;
  deckCount: number;
  turnDrawTaken: boolean;
  drawnCardId: string | null;
  oneCallDeadline: number | null;
  turnDeadline: number;
  turnDurationMs: number;
  rules: RuleSettings;
  rematchVotes: string[];
  chat: ChatMessage[];
  you: {
    id: string;
    name: string;
    hand: Card[];
    saidOne: boolean;
    isTurn: boolean;
  } | null;
  players: GamePlayer[];
}

export type AppState = LobbyState | GameState | null;

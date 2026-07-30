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
}

export interface GamePlayer {
  id: string;
  name: string;
  cardCount: number;
  saidOne: boolean;
  eliminated: boolean;
  isTurn: boolean;
  isYou: boolean;
}

export interface LobbyState {
  status: "lobby";
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  minPlayers: number;
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
  lastAction: { type: string; message?: string; playerId?: string; card?: Card } | null;
  topCard: Card | null;
  discardCount: number;
  deckCount: number;
  turnDrawTaken: boolean;
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

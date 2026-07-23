/**
 * Shared types between the Worker/Durable Object (server) and the browser client.
 * Keep this file free of any Cloudflare-specific or DOM-specific types so it can be
 * imported from both sides without pulling in incompatible `lib`s.
 */

export type GameStatus = "lobby" | "playing" | "finished";

export const TOTAL_ROUNDS = 5;

export interface PlayerInfo {
  id: string;
  nickname: string;
  connected: boolean;
  /** True if this player joined after the current game already started. */
  spectator: boolean;
}

/** One answer written on a paper during a single round. */
export interface PaperAnswer {
  round: number;
  playerId: string;
  nickname: string;
  answer: string;
}

/**
 * The state broadcast to every connected client. Notably it never includes
 * any answer text while a game is in progress — only once `status` is
 * "finished" do the full papers become visible, matching the physical
 * game's "nobody sees previous answers until the reveal" rule.
 */
export interface PublicRoomState {
  code: string;
  status: GameStatus;
  players: PlayerInfo[];
  /** Fixed seating order for the active/last game, null while in lobby. */
  order: string[] | null;
  currentRound: number;
  totalRounds: number;
  question: { title: string; examples: string[] } | null;
  /** Player ids who have submitted an answer for the current round. */
  submittedPlayerIds: string[];
  /** Only populated once status === "finished". Index = paper index. */
  papers: PaperAnswer[][] | null;
  /** Server timestamp (ms) the current round began, for optional client UI. */
  roundStartedAt: number | null;
  finishedAt: number | null;
  /**
   * Player ids who have pressed "Нова гра" on the results screen. Only
   * meaningful (and non-empty) once status === "finished".
   */
  readyForNewGamePlayerIds: string[];
}

/** Messages sent from the client to the server over the room WebSocket. */
export type ClientMessage =
  | { type: "start" }
  | { type: "submit"; answer: string }
  | { type: "readyForNewGame" }
  | { type: "ping" };

/** Messages sent from the server to the client over the room WebSocket. */
export type ServerMessage =
  | { type: "welcome"; playerId: string; nickname: string }
  | { type: "state"; state: PublicRoomState }
  | { type: "error"; message: string }
  | { type: "pong" };

export interface CreateRoomResponse {
  code: string;
}

export interface RoomInfoResponse {
  exists: boolean;
  status: GameStatus | null;
  playerCount: number;
}

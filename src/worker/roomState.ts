import { QUESTIONS } from "../shared/questions";
import { TOTAL_ROUNDS, type GameStatus, type PaperAnswer, type PublicRoomState } from "../shared/types";

/** How long a disconnected player's seat is held before their answer is auto-filled. */
export const DISCONNECT_GRACE_MS = 30_000;

export interface InternalPlayer {
  id: string;
  nickname: string;
  connected: boolean;
  /** ms timestamp the socket closed, or null while connected. */
  disconnectedAt: number | null;
  /** True once a game started after this player joined mid-game. */
  spectator: boolean;
}

export interface InternalRoomState {
  code: string;
  status: GameStatus;
  players: Record<string, InternalPlayer>;
  order: string[] | null;
  currentRound: number;
  papers: Record<number, PaperAnswer[]>;
  submissions: Record<number, Record<string, true>>;
  roundStartedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

export function createInitialState(code: string): InternalRoomState {
  return {
    code,
    status: "lobby",
    players: {},
    order: null,
    currentRound: 0,
    papers: {},
    submissions: {},
    roundStartedAt: null,
    finishedAt: null,
    createdAt: Date.now()
  };
}

/** Paper `i` is held, at round `r`, by whoever sits at index (i + r - 1) mod n in `order`. */
export function paperIndexForPlayer(order: string[], playerIndex: number, round: number): number {
  const n = order.length;
  return ((playerIndex - (round - 1)) % n + n) % n;
}

export function activePlayerIds(state: InternalRoomState): string[] {
  return Object.values(state.players)
    .filter((p) => p.connected)
    .map((p) => p.id);
}

export function addOrReconnectPlayer(state: InternalRoomState, playerId: string, nickname: string): void {
  const existing = state.players[playerId];
  if (existing) {
    existing.connected = true;
    existing.disconnectedAt = null;
    // Keep the original nickname on reconnect so mid-game identity stays stable.
    return;
  }
  const isLateJoiner = state.status !== "lobby";
  state.players[playerId] = {
    id: playerId,
    nickname,
    connected: true,
    disconnectedAt: null,
    spectator: isLateJoiner
  };
}

export function markDisconnected(state: InternalRoomState, playerId: string): void {
  const player = state.players[playerId];
  if (!player) return;
  player.connected = false;
  player.disconnectedAt = Date.now();
  // In the lobby there's no seat to protect — just drop them so the player
  // count and Start button reflect reality immediately.
  if (state.status === "lobby") {
    delete state.players[playerId];
  }
}

export function canStart(state: InternalRoomState): boolean {
  return state.status === "lobby" && activePlayerIds(state).length >= 2;
}

/** Locks in seating order and begins round 1. Returns false if preconditions aren't met. */
export function startGame(state: InternalRoomState): boolean {
  if (!canStart(state)) return false;
  const ids = activePlayerIds(state);
  const order = shuffle(ids);
  state.status = "playing";
  state.order = order;
  state.currentRound = 1;
  state.papers = {};
  state.submissions = { 1: {} };
  state.roundStartedAt = Date.now();
  state.finishedAt = null;
  return true;
}

export interface SubmitResult {
  ok: boolean;
  reason?: string;
}

export function submitAnswer(state: InternalRoomState, playerId: string, rawAnswer: string): SubmitResult {
  if (state.status !== "playing" || !state.order) return { ok: false, reason: "Гра не триває." };
  const answer = rawAnswer.trim().slice(0, 200);
  if (!answer) return { ok: false, reason: "Відповідь не може бути порожньою." };

  const playerIndex = state.order.indexOf(playerId);
  if (playerIndex === -1) return { ok: false, reason: "Ви приєднались після початку гри." };

  const round = state.currentRound;
  const submitted = (state.submissions[round] ??= {});
  if (submitted[playerId]) return { ok: false, reason: "Ви вже відповіли цього раунду." };

  const paperIndex = paperIndexForPlayer(state.order, playerIndex, round);
  const nickname = state.players[playerId]?.nickname ?? "Гравець";
  (state.papers[paperIndex] ??= []).push({ round, playerId, nickname, answer });
  submitted[playerId] = true;
  return { ok: true };
}

/**
 * If every seated player has submitted for the current round, advances to
 * the next round (or finishes the game after round 5). Returns true if the
 * state changed.
 */
export function advanceRoundIfComplete(state: InternalRoomState): boolean {
  if (state.status !== "playing" || !state.order) return false;
  const round = state.currentRound;
  const submitted = state.submissions[round] ?? {};
  const allSubmitted = state.order.every((id) => submitted[id]);
  if (!allSubmitted) return false;

  if (round >= TOTAL_ROUNDS) {
    state.status = "finished";
    state.finishedAt = Date.now();
  } else {
    state.currentRound = round + 1;
    state.submissions[round + 1] = {};
    state.roundStartedAt = Date.now();
  }
  return true;
}

/**
 * Fills in "…" for any player who has been disconnected longer than the
 * grace period and hasn't submitted the current round yet, so the rest of
 * the table is never stuck waiting on someone who left for good.
 */
export function resolveExpiredDisconnects(state: InternalRoomState, now: number): boolean {
  if (state.status !== "playing" || !state.order) return false;
  const round = state.currentRound;
  const submitted = (state.submissions[round] ??= {});
  let changed = false;

  state.order.forEach((id, index) => {
    if (submitted[id]) return;
    const player = state.players[id];
    if (!player || player.connected || player.disconnectedAt === null) return;
    if (now - player.disconnectedAt < DISCONNECT_GRACE_MS) return;

    const paperIndex = paperIndexForPlayer(state.order!, index, round);
    (state.papers[paperIndex] ??= []).push({
      round,
      playerId: id,
      nickname: player.nickname,
      answer: "…"
    });
    submitted[id] = true;
    changed = true;
  });

  return changed;
}

/** Timestamp of the next disconnect grace period expiring, or null if none pending. */
export function nextDisconnectDeadline(state: InternalRoomState): number | null {
  if (state.status !== "playing" || !state.order) return null;
  const round = state.currentRound;
  const submitted = state.submissions[round] ?? {};
  let earliest: number | null = null;
  for (const id of state.order) {
    if (submitted[id]) continue;
    const player = state.players[id];
    if (!player || player.connected || player.disconnectedAt === null) continue;
    const deadline = player.disconnectedAt + DISCONNECT_GRACE_MS;
    if (earliest === null || deadline < earliest) earliest = deadline;
  }
  return earliest;
}

/** Resets the room to a fresh lobby, carrying over anyone still connected. */
export function returnToLobby(state: InternalRoomState): InternalRoomState {
  const fresh = createInitialState(state.code);
  for (const player of Object.values(state.players)) {
    if (player.connected) {
      fresh.players[player.id] = { ...player, spectator: false, disconnectedAt: null };
    }
  }
  return fresh;
}

export function toPublicState(state: InternalRoomState): PublicRoomState {
  const question = state.status === "playing" && state.currentRound >= 1
    ? QUESTIONS[state.currentRound - 1]
    : null;
  const submittedPlayerIds = Object.keys(state.submissions[state.currentRound] ?? {});

  return {
    code: state.code,
    status: state.status,
    players: Object.values(state.players).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      connected: p.connected,
      spectator: p.spectator
    })),
    order: state.order,
    currentRound: state.currentRound,
    totalRounds: TOTAL_ROUNDS,
    question,
    submittedPlayerIds,
    papers: state.status === "finished" ? hydratePapers(state) : null,
    roundStartedAt: state.roundStartedAt,
    finishedAt: state.finishedAt
  };
}

function hydratePapers(state: InternalRoomState): PaperAnswer[][] {
  const count = state.order?.length ?? 0;
  const result: PaperAnswer[][] = [];
  for (let i = 0; i < count; i++) {
    result.push((state.papers[i] ?? []).slice().sort((a, b) => a.round - b.round));
  }
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

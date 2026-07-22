import type { PublicRoomState } from "../shared/types";
import type { ConnectionStatus } from "./socket";

export type Screen = "home" | "room";

export interface AppState {
  screen: Screen;
  roomCode: string | null;
  playerId: string;
  nickname: string;
  connection: ConnectionStatus;
  room: PublicRoomState | null;
  errorMessage: string | null;
  homeJoinCode: string;
  homeBusy: boolean;
  draftAnswer: string;
  justSubmittedRound: number | null;
  resultsPaperIndex: number;
}

type Listener = (state: AppState) => void;

export function createStore(initial: AppState) {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    get(): AppState {
      return state;
    },
    set(patch: Partial<AppState>): void {
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state));
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export type Store = ReturnType<typeof createStore>;

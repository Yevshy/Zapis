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
    // Updates state without notifying listeners (no re-render).
    // Used for fields backed by a live, focused text input (e.g. while the
    // user is typing), so the DOM node the browser is actively editing is
    // never torn down and rebuilt mid-keystroke. The input element itself
    // remains the source of truth for its own value while focused.
    setSilent(patch: Partial<AppState>): void {
      state = { ...state, ...patch };
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export type Store = ReturnType<typeof createStore>;

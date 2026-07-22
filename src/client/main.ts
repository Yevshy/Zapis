import type { Actions } from "./actions";
import { createStore, type AppState } from "./state";
import { render } from "./render";
import { RoomSocket } from "./socket";
import { getOrCreateIdentity, saveNickname } from "./identity";
import { createRoom } from "./api";
import { isValidRoomCode, normalizeRoomCode } from "../shared/roomCode";

const appEl = document.getElementById("app")!;
const identity = getOrCreateIdentity();

function parseRoomCodeFromPath(): string | null {
  const match = location.pathname.match(/^\/join\/([A-Za-z]+)\/?$/);
  if (!match) return null;
  const code = normalizeRoomCode(match[1]);
  return isValidRoomCode(code) ? code : null;
}

const initialCode = parseRoomCodeFromPath();

const store = createStore({
  screen: initialCode ? "room" : "home",
  roomCode: initialCode,
  playerId: identity.playerId,
  nickname: identity.nickname,
  connection: "connecting",
  room: null,
  errorMessage: null,
  homeJoinCode: "",
  homeBusy: false,
  draftAnswer: "",
  justSubmittedRound: null,
  resultsPaperIndex: 0
} satisfies AppState);

let socket: RoomSocket | null = null;

function connectTo(code: string): void {
  socket?.close();
  store.set({ room: null, connection: "connecting", errorMessage: null, draftAnswer: "", justSubmittedRound: null });
  socket = new RoomSocket({
    code,
    playerId: store.get().playerId,
    nickname: store.get().nickname,
    onStatusChange: (connection) => store.set({ connection }),
    onMessage: (message) => {
      if (message.type === "state") {
        const prevRound = store.get().room?.currentRound;
        const draftAnswer = message.state.currentRound !== prevRound ? "" : store.get().draftAnswer;
        store.set({ room: message.state, errorMessage: null, draftAnswer });
      } else if (message.type === "error") {
        store.set({ errorMessage: message.message });
      } else if (message.type === "welcome") {
        // Server may have generated a fresh playerId (first-ever visit); keep it in sync.
        store.set({ playerId: message.playerId, nickname: message.nickname });
      }
    }
  });
  socket.connect();
}

function navigateHome(): void {
  socket?.close();
  socket = null;
  history.pushState({}, "", "/");
  store.set({ screen: "home", roomCode: null, room: null, homeBusy: false, errorMessage: null });
}

function navigateToRoom(code: string): void {
  history.pushState({}, "", `/join/${code}`);
  store.set({ screen: "room", roomCode: code, homeBusy: false });
  connectTo(code);
}

const actions: Actions = {
  async createAndJoinRoom() {
    store.set({ homeBusy: true, errorMessage: null });
    try {
      const { code } = await createRoom();
      navigateToRoom(code);
    } catch {
      store.set({ homeBusy: false, errorMessage: "Не вдалося створити кімнату. Спробуйте ще раз." });
    }
  },

  setHomeJoinCode(code: string) {
    store.set({ homeJoinCode: code });
  },

  joinRoomByCode() {
    const code = normalizeRoomCode(store.get().homeJoinCode);
    if (!isValidRoomCode(code)) {
      store.set({ errorMessage: "Код кімнати складається з 6 літер." });
      return;
    }
    navigateToRoom(code);
  },

  startGame() {
    socket?.send({ type: "start" });
  },

  setDraftAnswer(text: string) {
    store.set({ draftAnswer: text });
  },

  submitAnswer() {
    const text = store.get().draftAnswer.trim();
    if (!text) return;
    const round = store.get().room?.currentRound ?? null;
    socket?.send({ type: "submit", answer: text });
    store.set({ draftAnswer: "", justSubmittedRound: round });
    if (round !== null) {
      setTimeout(() => {
        if (store.get().justSubmittedRound === round) store.set({ justSubmittedRound: null });
      }, 800);
    }
  },

  goHome() {
    navigateHome();
  },

  showResultsPaper(index: number) {
    store.set({ resultsPaperIndex: index });
  }
};

window.addEventListener("popstate", () => {
  const code = parseRoomCodeFromPath();
  if (code) {
    store.set({ screen: "room", roomCode: code });
    connectTo(code);
  } else {
    socket?.close();
    socket = null;
    store.set({ screen: "home", roomCode: null, room: null });
  }
});

store.subscribe((state) => render(appEl, state, actions));
render(appEl, store.get(), actions);

if (initialCode) connectTo(initialCode);

// Keep the persisted nickname in sync in case it's ever changed elsewhere.
saveNickname(store.get().nickname);

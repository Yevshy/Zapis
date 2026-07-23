import type { Env } from "./env";
import type { ClientMessage, RoomInfoResponse, ServerMessage } from "../shared/types";
import { generateNickname } from "../shared/nicknames";
import {
  addOrReconnectPlayer,
  advanceRoundIfComplete,
  activePlayerIds,
  allActivePlayersReadyForNewGame,
  createInitialState,
  markDisconnected,
  markReadyForNewGame,
  nextDisconnectDeadline,
  resolveExpiredDisconnects,
  startGame,
  startNewGameFromResults,
  submitAnswer,
  toPublicState,
  type InternalRoomState
} from "./roomState";

interface WSAttachment {
  playerId: string;
}

export class GameRoom {
  private readonly state: DurableObjectState;
  private room: InternalRoomState;
  private readonly ready: Promise<void>;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.room = createInitialState("");
    this.ready = this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<InternalRoomState>("room");
      if (stored) this.room = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);

    const codeParam = url.searchParams.get("code") ?? url.pathname.split("/").filter(Boolean).pop();
    if (!this.room.code && codeParam) this.room.code = codeParam;

    if (url.pathname === "/info") {
      return Response.json(this.info());
    }

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleUpgrade(url);
    }

    return new Response("Not found", { status: 404 });
  }

  // ---------------------------------------------------------------------
  // WebSocket lifecycle (Hibernation API — the runtime wakes this object
  // only when a message actually arrives, and restores `room` from storage
  // via the constructor above when it does).
  // ---------------------------------------------------------------------

  private handleUpgrade(url: URL): Response {
    const playerIdParam = url.searchParams.get("playerId");
    const playerId = playerIdParam && playerIdParam.length > 0 ? playerIdParam : crypto.randomUUID();
    const nickname = (url.searchParams.get("nickname") || generateNickname()).slice(0, 40);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server, [playerId]);
    server.serializeAttachment({ playerId } satisfies WSAttachment);

    addOrReconnectPlayer(this.room, playerId, nickname);
    void this.scheduleNextAlarm();
    void this.persistAndBroadcast();

    this.send(server, { type: "welcome", playerId, nickname });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ready;
    if (typeof message !== "string") return;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    const attachment = ws.deserializeAttachment() as WSAttachment | null;
    if (!attachment) return;
    const { playerId } = attachment;

    switch (parsed.type) {
      case "start": {
        const ok = startGame(this.room);
        if (!ok) {
          this.send(ws, { type: "error", message: "Потрібно щонайменше 2 гравці, щоб почати." });
          return;
        }
        await this.scheduleNextAlarm();
        await this.persistAndBroadcast();
        return;
      }
      case "submit": {
        const result = submitAnswer(this.room, playerId, parsed.answer);
        if (!result.ok) {
          this.send(ws, { type: "error", message: result.reason ?? "Не вдалося надіслати відповідь." });
          return;
        }
        advanceRoundIfComplete(this.room);
        await this.scheduleNextAlarm();
        await this.persistAndBroadcast();
        return;
      }
      case "readyForNewGame": {
        const changed = markReadyForNewGame(this.room, playerId);
        if (!changed) return;
        if (allActivePlayersReadyForNewGame(this.room)) {
          startNewGameFromResults(this.room);
        }
        await this.scheduleNextAlarm();
        await this.persistAndBroadcast();
        return;
      }
      case "ping": {
        this.send(ws, { type: "pong" });
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ready;
    const attachment = ws.deserializeAttachment() as WSAttachment | null;
    if (!attachment) return;
    markDisconnected(this.room, attachment.playerId);
    // A disconnect can be the very thing that makes "everyone connected has
    // pressed Нова гра" true (fewer people left to wait on).
    if (allActivePlayersReadyForNewGame(this.room)) {
      startNewGameFromResults(this.room);
    }
    await this.scheduleNextAlarm();
    await this.persistAndBroadcast();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  // ---------------------------------------------------------------------
  // Alarms drive everything that has to happen without a client message:
  // auto-filling "…" for players who never reconnect. The results screen
  // itself never times out — players leave it only by all pressing
  // "Нова гра".
  // ---------------------------------------------------------------------

  async alarm(): Promise<void> {
    await this.ready;
    const now = Date.now();

    const disconnectsResolved = resolveExpiredDisconnects(this.room, now);
    if (disconnectsResolved) advanceRoundIfComplete(this.room);

    await this.persistAndBroadcast();
    await this.scheduleNextAlarm();
  }

  private async scheduleNextAlarm(): Promise<void> {
    const disconnectDeadline = nextDisconnectDeadline(this.room);
    if (disconnectDeadline === null) {
      await this.state.storage.deleteAlarm();
      return;
    }
    await this.state.storage.setAlarm(disconnectDeadline);
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private async persistAndBroadcast(): Promise<void> {
    await this.state.storage.put("room", this.room);
    const message: ServerMessage = { type: "state", state: toPublicState(this.room) };
    const payload = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Broken socket — the runtime will fire webSocketClose/Error for it shortly.
      }
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Ignore — socket is on its way out.
    }
  }

  private info(): RoomInfoResponse {
    const hasEverStarted = this.room.status !== "lobby";
    const hasPlayers = Object.keys(this.room.players).length > 0;
    return {
      exists: hasEverStarted || hasPlayers,
      status: this.room.status,
      playerCount: activePlayerIds(this.room).length
    };
  }
}

import type { ClientMessage, ServerMessage } from "../shared/types";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

interface RoomSocketOptions {
  code: string;
  playerId: string;
  nickname: string;
  onMessage: (message: ServerMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 10_000;

export class RoomSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1000;
  private closedByUser = false;

  constructor(private readonly opts: RoomSocketOptions) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  private open(): void {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ playerId: this.opts.playerId, nickname: this.opts.nickname });
    const url = `${proto}//${location.host}/ws/${this.opts.code}?${params.toString()}`;

    this.opts.onStatusChange(this.backoffMs > 1000 ? "reconnecting" : "connecting");
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.backoffMs = 1000;
      this.opts.onStatusChange("open");
      this.startPing();
    });

    ws.addEventListener("message", (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        this.opts.onMessage(message);
      } catch {
        // ignore malformed frames
      }
    });

    ws.addEventListener("close", () => {
      this.stopPing();
      if (this.closedByUser) {
        this.opts.onStatusChange("closed");
        return;
      }
      this.opts.onStatusChange("reconnecting");
      this.scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      ws.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      this.open();
    }, this.backoffMs);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPing();
    this.ws?.close();
  }
}

export interface Env {
  /** Durable Object namespace — one instance per room code. */
  GAME_ROOM: DurableObjectNamespace;
  /** Static assets built by Vite (the `dist/` folder), bound via [assets] in wrangler.toml. */
  ASSETS: Fetcher;
}

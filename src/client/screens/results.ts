import type { AppState } from "../state";
import type { Actions } from "../actions";
import { escapeHtml, ICONS } from "../dom";

export function renderResults(state: AppState): string {
  const room = state.room!;
  const papers = room.papers ?? [];
  const index = Math.min(state.resultsPaperIndex, Math.max(papers.length - 1, 0));
  const paper = papers[index] ?? [];

  const connectedPlayers = room.players.filter((p) => p.connected);
  const total = connectedPlayers.length;
  const readySet = new Set(room.readyForNewGamePlayerIds);
  const readyCount = connectedPlayers.filter((p) => readySet.has(p.id)).length;
  const iAmReady = readySet.has(state.playerId);

  const tabs = papers
    .map((_, i) => `<button class="paper-tab ${i === index ? "active" : ""}" data-idx="${i}">Записочка ${i + 1}</button>`)
    .join("");

  const lines = paper
    .map(
      (a) => `
        <div class="result-line" style="animation-delay:${a.round * 60}ms">
          <span class="num">${a.round}</span>
          <span class="txt">${escapeHtml(a.answer)}</span>
          <span class="who">${escapeHtml(a.nickname)}</span>
        </div>`
    )
    .join("");

  return `
    <main>
      <div class="card note-card">
        <button id="copyNoteBtn" class="copy-note-btn" title="Скопіювати записочку" aria-label="Скопіювати записочку">${ICONS.clipboard}</button>

        <p class="eyebrow">Сет завершено</p>
        <h1 style="margin:0 0 4px;font-size:24px;">Читаємо записочки</h1>
        <p class="muted" style="font-size:14px;margin:0 0 18px;">Перегляньте усі ${papers.length} записочок цього сету</p>

        <div class="paper-tabs">${tabs}</div>
        <div class="result-lines">${lines}</div>

        <button id="newGameBtn" class="start-btn" style="margin-top:22px;" ${iAmReady ? "disabled" : ""}>
          ${iAmReady ? "Чекаємо на інших гравців…" : "Нова гра"}
        </button>
        <div class="answered-pill">${ICONS.user}Готові&nbsp;<b>${readyCount} із ${total}</b></div>
      </div>
    </main>
  `;
}

export function bindResults(root: HTMLElement, state: AppState, actions: Actions): void {
  root.querySelectorAll<HTMLButtonElement>(".paper-tab").forEach((btn) => {
    btn.addEventListener("click", () => actions.showResultsPaper(parseInt(btn.dataset.idx ?? "0", 10)));
  });

  root.querySelector<HTMLButtonElement>("#newGameBtn")?.addEventListener("click", () => actions.readyForNewGame());

  root.querySelector<HTMLButtonElement>("#copyNoteBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const room = state.room!;
    const papers = room.papers ?? [];
    const index = Math.min(state.resultsPaperIndex, Math.max(papers.length - 1, 0));
    const paper = papers[index] ?? [];
    const sentence = paper
      .slice()
      .sort((a, b) => a.round - b.round)
      .map((a) => a.answer)
      .join(" ");
    try {
      await navigator.clipboard.writeText(sentence);
      const original = btn.innerHTML;
      btn.innerHTML = ICONS.check;
      setTimeout(() => (btn.innerHTML = original), 1600);
    } catch {
      // Clipboard API unavailable — silently ignore, the text is visible on screen anyway.
    }
  });
}

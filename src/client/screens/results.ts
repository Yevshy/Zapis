import type { AppState } from "../state";
import type { Actions } from "../actions";
import { escapeHtml } from "../dom";

export function renderResults(state: AppState): string {
  const room = state.room!;
  const papers = room.papers ?? [];
  const index = Math.min(state.resultsPaperIndex, Math.max(papers.length - 1, 0));
  const paper = papers[index] ?? [];

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
      <div class="card">
        <p class="eyebrow">Сет завершено</p>
        <h1 style="margin:0 0 4px;font-size:24px;">Читаємо записочки</h1>
        <p class="muted" style="font-size:14px;margin:0 0 18px;">Перегляньте усі ${papers.length} записочок цього сету</p>

        <div class="paper-tabs">${tabs}</div>
        <div class="result-lines">${lines}</div>

        <p class="muted" style="text-align:center;font-size:13px;margin-top:20px;">
          Нове лобі відкриється автоматично за кілька секунд
        </p>
      </div>
    </main>
  `;
}

export function bindResults(root: HTMLElement, _state: AppState, actions: Actions): void {
  root.querySelectorAll<HTMLButtonElement>(".paper-tab").forEach((btn) => {
    btn.addEventListener("click", () => actions.showResultsPaper(parseInt(btn.dataset.idx ?? "0", 10)));
  });
}

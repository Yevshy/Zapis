import type { AppState } from "../state";
import type { Actions } from "../actions";
import { escapeHtml, ICONS } from "../dom";

export function renderRound(state: AppState): string {
  const room = state.room!;
  const isSeated = room.order?.includes(state.playerId) ?? false;

  if (!isSeated) return renderSpectator(room);

  const question = room.question!;
  const answeredCount = room.submittedPlayerIds.length;
  const total = room.order!.length;
  const iHaveSubmitted = room.submittedPlayerIds.includes(state.playerId);
  const showFold = state.justSubmittedRound === room.currentRound;

  return `
    <main>
      <div class="card">
        <div class="round-label">Раунд ${room.currentRound} з ${room.totalRounds}</div>
        <h1 class="question">${escapeHtml(question.title)}</h1>
        <div class="examples serif-example">
          ${question.examples.map((e) => `<div>${escapeHtml(e)}</div>`).join("")}
        </div>

        ${
          iHaveSubmitted
            ? `<div class="waiting-note"><span class="spinner"></span>Чекаємо на інших гравців…</div>`
            : `
              <input id="answerInput" class="answer-input" placeholder="${escapeHtml(question.title)}"
                autocomplete="off" value="${escapeHtml(state.draftAnswer)}" />
              <button id="submitBtn" class="submit-btn" ${state.draftAnswer.trim() ? "" : "disabled"}>Відповісти</button>
            `
        }

        <div class="answered-pill">${ICONS.user}Відповіли&nbsp;<b>${answeredCount} із ${total}</b></div>
      </div>
    </main>
    ${showFold ? `<div class="fold-overlay"><div class="fold-paper">${escapeHtml(question.title)} — записочку складено й передано далі ✓</div></div>` : ""}
  `;
}

function renderSpectator(room: NonNullable<AppState["room"]>): string {
  const activeCount = room.players.filter((p) => p.connected).length;
  return `
    <main>
      <div class="card center">
        <div class="badge-icon">${ICONS.mail}</div>
        <h1 style="margin:0 0 8px;font-size:22px;">Гру вже розпочато</h1>
        <p class="muted" style="font-size:14.5px;line-height:1.6;">
          Ви приєднались, поки грали інші. Зачекайте, будь ласка — щойно поточний сет завершиться,
          автоматично відкриється нове лобі, і ви зможете грати.
        </p>
        <p class="muted" style="font-size:13px;margin-top:18px;"><span class="spinner"></span>Зараз онлайн: ${activeCount}</p>
      </div>
    </main>
  `;
}

export function bindRound(root: HTMLElement, _state: AppState, actions: Actions): void {
  const input = root.querySelector<HTMLInputElement>("#answerInput");
  const btn = root.querySelector<HTMLButtonElement>("#submitBtn");
  if (!input || !btn) return;

  input.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    // Never write el.value back here — the DOM node already holds exactly
    // what the user typed. We only mirror it into app state (silently, so
    // no re-render tears down this focused node) and update the button.
    actions.setDraftAnswer(el.value);
    if (btn) btn.disabled = !el.value.trim();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) actions.submitAnswer();
  });
  btn.addEventListener("click", () => actions.submitAnswer());
  input.focus();
}

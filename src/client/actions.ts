export interface Actions {
  createAndJoinRoom(): void;
  setHomeJoinCode(code: string): void;
  joinRoomByCode(): void;
  startGame(): void;
  setDraftAnswer(text: string): void;
  submitAnswer(): void;
  goHome(): void;
  showResultsPaper(index: number): void;
  readyForNewGame(): void;
}

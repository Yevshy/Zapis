export interface Question {
  title: string;
  examples: string[];
}

/** The five questions are always asked in this fixed order. */
export const QUESTIONS: Question[] = [
  {
    title: "Який?",
    examples: ["норовливий", "пихатий", "той з першого під’їзду", "занадто щасливий"]
  },
  {
    title: "Хто?",
    examples: ["маніяк", "мисливець на відьом", "сусід", "водій маршрутки"]
  },
  {
    title: "Як?",
    examples: ["злісно", "не поспішаючи", "наче нічого не сталося", "із захопленням"]
  },
  {
    title: "Що зробив?",
    examples: ["розсмішив", "навчив графічному дизайну", "спародіював", "змусив помити ноги"]
  },
  {
    title: "Кого?",
    examples: ["Святого Миколая", "сусідку", "найкращого друга", "астрологів"]
  }
];

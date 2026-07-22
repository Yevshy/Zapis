// Excludes visually ambiguous letters (I, O) to keep codes easy to read aloud/type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

const ROOM_CODE_PATTERN = /^[A-Z]{6}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

const WAKE_UP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateWakeUpSecret() {
  const randomBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const code = Array.from(randomBytes, byte => WAKE_UP_CODE_ALPHABET[byte & 31]).join('');
  return `GING_${code}`;
}

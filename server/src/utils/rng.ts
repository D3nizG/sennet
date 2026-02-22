import crypto from 'crypto';

/** Cryptographically secure random integer in [1, 6]. */
export function secureRoll(): number {
  return crypto.randomInt(1, 7);
}

/** Generate a random lobby/room code (6 uppercase alphanumeric chars). */
export function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

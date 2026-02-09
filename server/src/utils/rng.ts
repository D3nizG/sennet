import crypto from 'crypto';

/** Cryptographically secure random integer in [1, 6]. */
export function secureRoll(): number {
  const buf = crypto.randomBytes(4);
  const val = buf.readUInt32BE(0);
  return (val % 6) + 1;
}

/** Generate a random lobby/room code (6 uppercase alphanumeric chars). */
export function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

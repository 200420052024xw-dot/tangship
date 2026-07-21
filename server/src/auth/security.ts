import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [salt, key] = String(stored || '').split(':');
  if (!salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  if (expected.length !== 64) return false;
  return timingSafeEqual(expected, scryptSync(password, salt, 64));
};

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

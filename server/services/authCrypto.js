import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const OTP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 8-character one-time password (no ambiguous chars). */
export function generateOneTimePassword() {
  const bytes = crypto.randomBytes(8);
  let otp = '';
  for (let i = 0; i < 8; i++) otp += OTP_CHARS[bytes[i] % OTP_CHARS.length];
  return otp;
}

export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashSecret(value) {
  return bcrypt.hash(String(value), 12);
}

export async function verifySecret(value, hash) {
  if (!value || !hash) return false;
  return bcrypt.compare(String(value), hash);
}

export function normalizeOtp(input) {
  return String(input || '')
    .replace(/\s|-/g, '')
    .toUpperCase()
    .trim();
}

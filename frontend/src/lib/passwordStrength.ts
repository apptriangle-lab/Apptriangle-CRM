/** Cryptographically random password with mixed character classes (length 12–64). */
export function generateSecurePassword(length = 20): string {
  const len = Math.max(12, Math.min(64, length));
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+";
  const all = upper + lower + digits + symbols;
  const buf = new Uint32Array(Math.max(len, 32));
  crypto.getRandomValues(buf);
  const chars: string[] = [
    upper[buf[0]! % upper.length],
    lower[buf[1]! % lower.length],
    digits[buf[2]! % digits.length],
    symbols[buf[3]! % symbols.length],
  ];
  for (let i = 4; i < len; i++) {
    chars.push(all[buf[i]! % all.length]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = buf[i % buf.length]! % (i + 1);
    const t = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = t;
  }
  return chars.join("");
}

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PasswordStrengthResult = {
  score: PasswordStrengthLevel;
  /** 0–100 for the progress bar */
  percent: number;
  label: string;
};

const STRENGTH_LABELS = ["", "Very weak", "Weak", "Fair", "Medium", "Good", "Strong"] as const;

/**
 * Heuristic strength (not a password-cracking estimate). Empty string → score 0.
 */
export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: 0, percent: 0, label: "" };
  }

  let points = 0;
  const len = password.length;
  points += Math.min(35, len * 3);
  if (len >= 12) points += 10;
  if (len >= 16) points += 10;
  if (len >= 20) points += 5;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNum = /\d/.test(password);
  const hasSym = /[^a-zA-Z0-9]/.test(password);
  const kinds = [hasLower, hasUpper, hasNum, hasSym].filter(Boolean).length;
  points += kinds * 12;

  if (/(.)\1{3,}/.test(password)) points -= 12;
  if (/^[a-z]+$/i.test(password) || /^\d+$/.test(password)) points -= 15;

  points = Math.max(0, Math.min(100, points));

  let score: PasswordStrengthLevel = 1;
  if (points >= 18) score = 2;
  if (points >= 32) score = 3;
  if (points >= 46) score = 4;
  if (points >= 60) score = 5;
  if (points >= 74) score = 6;

  const label = STRENGTH_LABELS[score] ?? "Very weak";

  return { score, percent: points, label };
}

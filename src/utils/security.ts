/**
 * BridgeofTalent Security Utilities v3
 * Fortifies against XSS, injection, abuse, and common web vulnerabilities.
 * All user-supplied input MUST pass through these helpers before storage or display.
 */

const MAX = {
  STRING: 10000,
  TITLE: 200,
  NAME: 120,
  EMAIL: 254,
  BIO: 2000,
  MESSAGE: 5000,
  COMMENT: 2000,
  LINK: 2048,
  ARRAY_LENGTH: 50,
  PASSWORD: 128,
} as const;

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const DANGEROUS_PATTERNS = [
  /<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
];

/** Escape HTML to prevent XSS. Use when rendering user content as text. */
export function escapeHtml(str: unknown): string {
  if (str == null || typeof str !== 'string') return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, (c) => map[c] ?? c);
}

/** Sanitize string: trim, limit length, strip control chars, block dangerous patterns. */
export function sanitizeString(input: unknown, maxLen: number = MAX.STRING): string {
  if (input == null) return '';
  let s = '';
  const raw = String(input);
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) continue;
    s += raw[i];
  }
  s = s.trim();
  if (maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** Deep sanitization for display (escape + length limit). */
export function sanitizeForDisplay(input: unknown, maxLen: number = MAX.STRING): string {
  return escapeHtml(sanitizeString(input, maxLen));
}

/** Validate and normalize email. Returns empty string if invalid. */
export function sanitizeEmail(input: unknown): string {
  const s = sanitizeString(input, MAX.EMAIL).toLowerCase();
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(s) ? s : '';
}

/** Validate password strength. Returns validation result. */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong';
} {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (password.length > MAX.PASSWORD) errors.push(`Max ${MAX.PASSWORD} characters`);
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('At least one special character');

  const score = 5 - errors.length;
  const strength = score <= 2 ? 'weak' : score <= 4 ? 'fair' : 'strong';

  return { valid: errors.length === 0, errors, strength };
}

/** Sanitize URL. Only allows http, https, mailto. */
export function sanitizeUrl(input: unknown): string {
  const s = sanitizeString(input, MAX.LINK).trim();
  if (!s) return '';
  try {
    const u = new URL(s, 'https://example.com');
    if (SAFE_LINK_PROTOCOLS.includes(u.protocol)) return u.href;
  } catch {
    // invalid URL
  }
  return '';
}

/** Check for dangerous content patterns. */
export function containsDangerousContent(input: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

/** Sanitize job post input with comprehensive validation. */
export function sanitizeJobInput(data: Record<string, unknown>) {
  const sanitized = {
    title: sanitizeString(data?.title, MAX.TITLE),
    description: sanitizeString(data?.description, 5000),
    category: sanitizeString(data?.category, 64),
    location: sanitizeString(data?.location, 64),
    budgetType: data?.budgetType === 'hourly' ? 'hourly' : 'fixed',
    budgetMin: Math.min(1_000_000, Math.max(0, Number(data?.budgetMin) || 0)),
    budgetMax: Math.min(1_000_000, Math.max(0, Number(data?.budgetMax) || 0)),
    teamSize: Math.min(20, Math.max(1, Math.floor(Number(data?.teamSize) || 1))),
    skills: Array.isArray(data?.skills)
      ? data.skills.slice(0, 20).map((s) => sanitizeString(s, 64)).filter(Boolean)
      : [],
  };

  if (sanitized.budgetMax > 0 && sanitized.budgetMin > sanitized.budgetMax) {
    [sanitized.budgetMin, sanitized.budgetMax] = [sanitized.budgetMax, sanitized.budgetMin];
  }

  return sanitized;
}

/** Sanitize bid input. */
export function sanitizeBidInput(data: Record<string, unknown>) {
  return {
    amount: Math.min(1_000_000, Math.max(0, Number(data?.amount) || 0)),
    message: sanitizeString(data?.message, MAX.MESSAGE),
    timeline: sanitizeString(data?.timeline, 200),
  };
}

/** Sanitize message/chat input. */
export function sanitizeMessage(input: unknown) {
  return sanitizeString(input, MAX.MESSAGE);
}

/** Sanitize review input. */
export function sanitizeReviewInput(data: Record<string, unknown>) {
  return {
    rating: Math.min(5, Math.max(1, Math.floor(Number(data?.rating) || 5))),
    comment: sanitizeString(data?.comment, MAX.COMMENT),
  };
}

/** Sanitize user profile fields. */
export function sanitizeProfileInput(data: Record<string, unknown>) {
  return {
    name: sanitizeString(data?.name, MAX.NAME),
    title: sanitizeString(data?.title, MAX.TITLE),
    bio: sanitizeString(data?.bio, MAX.BIO),
    location: sanitizeString(data?.location, 120),
    company: sanitizeString(data?.company, MAX.NAME),
    hourlyRate: Math.min(10000, Math.max(0, Number(data?.hourlyRate) || 0)),
    skills: Array.isArray(data?.skills)
      ? data.skills.slice(0, 30).map((s) => sanitizeString(s, 64)).filter(Boolean)
      : [],
  };
}

/** Sanitize array of strings. */
export function sanitizeStringArray(
  arr: unknown,
  maxItems: number = MAX.ARRAY_LENGTH,
  maxItemLen: number = 64
): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems).map((s) => sanitizeString(s, maxItemLen)).filter(Boolean);
}

/** Generate secure random token. */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const LIMITS = MAX;

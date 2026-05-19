/**
 * BridgeofTalent Security Utilities
 * Fortifies against XSS, injection, and abuse. Use for all user-supplied input.
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
};

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Escape HTML to prevent XSS. Use when rendering user content as text.
 * Never use dangerouslySetInnerHTML with user content.
 */
export function escapeHtml(str) {
  if (str == null || typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  return str.replace(/[&<>"'/]/g, (c) => map[c]);
}

/**
 * Sanitize string: trim, limit length, strip control chars. Returns safe string.
 * Strips ASCII control characters (0x00–0x1F and 0x7F) without using a
 * control-character literal in a regex (avoids the no-control-regex lint rule
 * while still removing the same characters).
 */
export function sanitizeString(input, maxLen = MAX.STRING) {
  if (input == null) return '';
  let s = '';
  const raw = String(input);
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) continue; // strip control chars
    s += raw[i];
  }
  s = s.trim();
  if (maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Sanitize for display (escape + length). Use when rendering user content.
 */
export function sanitizeForDisplay(input, maxLen = MAX.STRING) {
  return escapeHtml(sanitizeString(input, maxLen));
}

/**
 * Validate email format. Returns sanitized email or empty string if invalid.
 */
export function sanitizeEmail(input) {
  const s = sanitizeString(input, MAX.EMAIL).toLowerCase();
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(s) ? s : '';
}

/**
 * Sanitize URL for links. Only allow http, https, mailto. Prevents javascript: etc.
 */
export function sanitizeUrl(input) {
  const s = sanitizeString(input, MAX.LINK).trim();
  if (!s) return '';
  try {
    const u = new URL(s, 'https://example.com');
    if (SAFE_LINK_PROTOCOLS.includes(u.protocol)) return u.href;
  } catch (_) {}
  return '';
}

/**
 * Sanitize object of string fields with per-field max lengths.
 */
export function sanitizeObject(obj, schema) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [key, maxLen] of Object.entries(schema)) {
    if (obj[key] != null) out[key] = sanitizeString(obj[key], maxLen);
  }
  return { ...obj, ...out };
}

/**
 * Validate and sanitize job post input.
 */
export function sanitizeJobInput(data) {
  return {
    title: sanitizeString(data?.title, MAX.TITLE),
    description: sanitizeString(data?.description, 5000),
    category: sanitizeString(data?.category, 64),
    location: sanitizeString(data?.location, 64),
    budgetType: data?.budgetType === 'hourly' ? 'hourly' : 'fixed',
    budgetMin: Math.min(1e9, Math.max(0, Number(data?.budgetMin) || 0)),
    budgetMax: Math.min(1e9, Math.max(0, Number(data?.budgetMax) || 0)),
    teamSize: Math.min(10, Math.max(1, Math.floor(Number(data?.teamSize) || 1))),
    skills: Array.isArray(data?.skills) ? data.skills.slice(0, 20).map(s => sanitizeString(s, 64)).filter(Boolean) : [],
  };
}

/**
 * Validate and sanitize bid input.
 */
export function sanitizeBidInput(data) {
  return {
    amount: Math.min(1e9, Math.max(0, Number(data?.amount) || 0)),
    message: sanitizeString(data?.message, MAX.MESSAGE),
    timeline: sanitizeString(data?.timeline, 200),
  };
}

/**
 * Sanitize message/chat input.
 */
export function sanitizeMessage(input) {
  return sanitizeString(input, MAX.MESSAGE);
}

/**
 * Sanitize review input.
 */
export function sanitizeReviewInput(data) {
  return {
    rating: Math.min(5, Math.max(1, Math.floor(Number(data?.rating) || 5))),
    comment: sanitizeString(data?.comment, MAX.COMMENT),
  };
}

/**
 * Sanitize user profile fields (name, bio, title, etc.).
 */
export function sanitizeProfileInput(data) {
  return {
    name: sanitizeString(data?.name, MAX.NAME),
    title: sanitizeString(data?.title, MAX.TITLE),
    bio: sanitizeString(data?.bio, MAX.BIO),
    location: sanitizeString(data?.location, 120),
    company: sanitizeString(data?.company, MAX.NAME),
    hourlyRate: Math.min(10000, Math.max(0, Number(data?.hourlyRate) || 0)),
    skills: Array.isArray(data?.skills) ? data.skills.slice(0, 30).map(s => sanitizeString(s, 64)).filter(Boolean) : [],
  };
}

/**
 * Sanitize array of strings (e.g. skills). Prevents oversized arrays.
 */
export function sanitizeStringArray(arr, maxItems = MAX.ARRAY_LENGTH, maxItemLen = 64) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems).map((s) => sanitizeString(s, maxItemLen)).filter(Boolean);
}

export const LIMITS = MAX;

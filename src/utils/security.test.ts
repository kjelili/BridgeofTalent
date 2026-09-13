import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  validatePassword,
  containsDangerousContent,
  sanitizeJobInput,
} from '@/utils/security';

describe('escapeHtml', () => {
  it('escapes angle brackets and quotes', () => {
    expect(escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;&#x2F;b&gt;');
  });
  it('returns empty string for non-strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('');
  });
});

describe('sanitizeString', () => {
  it('trims and enforces max length', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
    expect(sanitizeString('abcdef', 3)).toBe('abc');
  });
});

describe('sanitizeEmail', () => {
  it('lowercases and accepts valid emails', () => {
    expect(sanitizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
  it('rejects invalid emails', () => {
    expect(sanitizeEmail('not-an-email')).toBe('');
  });
});

describe('sanitizeUrl', () => {
  it('allows https', () => {
    expect(sanitizeUrl('https://example.com')).toContain('https://example.com');
  });
  it('blocks the javascript protocol', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });
});

describe('validatePassword', () => {
  it('rejects weak passwords', () => {
    expect(validatePassword('weak').valid).toBe(false);
  });
  it('accepts strong passwords', () => {
    const result = validatePassword('Str0ng!pass');
    expect(result.valid).toBe(true);
    expect(result.strength).toBe('strong');
  });
});

describe('containsDangerousContent', () => {
  it('flags inline event handlers', () => {
    expect(containsDangerousContent('<img onerror=alert(1)>')).toBe(true);
  });
});

describe('sanitizeJobInput', () => {
  it('swaps min/max when reversed and caps skills', () => {
    const out = sanitizeJobInput({
      title: 'Job',
      description: 'desc',
      budgetMin: 5000,
      budgetMax: 1000,
      skills: Array.from({ length: 40 }, (_, i) => 'skill' + i),
    });
    expect(out.budgetMin).toBe(1000);
    expect(out.budgetMax).toBe(5000);
    expect(out.skills.length).toBeLessThanOrEqual(20);
  });
});

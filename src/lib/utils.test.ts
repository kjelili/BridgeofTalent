import { describe, it, expect } from 'vitest';
import { cn, formatCurrency } from '@/lib/utils';

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
  it('drops falsey values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});

describe('formatCurrency', () => {
  it('formats whole USD amounts', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
  });
  it('rounds to whole dollars', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
  });
});

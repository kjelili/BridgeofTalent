import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Lazily construct a rate limiter from Upstash env vars. When they are not
// configured the limiter is absent and every call is allowed (fail-open), so
// local dev and builds are never blocked.
let limiter: Ratelimit | null = null;
let initialized = false;

function getLimiter(): Ratelimit | null {
  if (initialized) return limiter;
  initialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(20, '10 s'),
      prefix: 'bot-ratelimit',
      analytics: false,
    });
  }
  return limiter;
}

/** Returns { success: false } only when a configured limiter is exceeded. */
export async function rateLimit(identifier: string): Promise<{ success: boolean }> {
  const l = getLimiter();
  if (!l) return { success: true };
  try {
    const { success } = await l.limit(identifier);
    return { success };
  } catch {
    // Never block requests because the limiter itself failed.
    return { success: true };
  }
}

/** Best-effort client IP for use as a rate-limit key. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'anonymous';
}

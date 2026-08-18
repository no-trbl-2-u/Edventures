/**
 * Roadmap 3.7 - rate limiting, by IP.
 *
 * A fixed-window counter behind a tiny store interface, so the same logic runs
 * against an in-process `Map` today and a Cloudflare KV namespace the moment
 * one is bound (Phase 3.10 brings KV in for durable logging anyway).
 *
 * Fixed windows are the crude choice: a caller can fire a full window's worth
 * of requests at the end of one window and again at the start of the next. That
 * is fine here. The job is to stop a script hammering Edward's inbox, not to
 * meter an API - and every extra bit of precision costs a read-modify-write
 * round trip on a request path a real customer is waiting on.
 *
 * The limits are deliberately loose. A household booking a walker for two dogs
 * and a cat sitter in the same evening is a real thing; getting rate-limited
 * for it would be absurd.
 */

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length, in seconds. */
  windowSeconds: number;
  /** Appears in logs so a block can be traced to the rule that caused it. */
  name: string;
}

export const DEFAULT_RULES: RateLimitRule[] = [
  { name: "burst", limit: 3, windowSeconds: 60 },
  { name: "hourly", limit: 8, windowSeconds: 60 * 60 },
  { name: "daily", limit: 20, windowSeconds: 24 * 60 * 60 },
];

export interface RateLimitStore {
  /** Increment the counter for `key` and return its new value. Implementations
   *  must expire the key after `windowSeconds`. */
  increment(key: string, windowSeconds: number): Promise<number>;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Set when blocked: seconds until the caller may retry. */
  retryAfter: number;
  /** Set when blocked: which rule tripped. */
  rule?: string;
}

/**
 * In-process store.
 *
 * Scoped to a single warm isolate, so it is leaky by nature: Cloudflare may
 * route the next request to a different isolate that has never heard of this
 * IP. That makes it a speed bump rather than a wall, which is honestly all an
 * unauthenticated contact form needs until KV arrives. Swap in a KV-backed
 * store and the same rules become real.
 */
export function memoryStore(): RateLimitStore {
  const counters = new Map<string, { count: number; expiresAt: number }>();

  return {
    async increment(key, windowSeconds) {
      const now = Date.now();

      // Opportunistic sweep. Without it a long-lived isolate accumulates an
      // entry per IP per window forever.
      if (counters.size > 5000) {
        for (const [k, v] of counters) if (v.expiresAt <= now) counters.delete(k);
      }

      const existing = counters.get(key);
      if (existing && existing.expiresAt > now) {
        existing.count += 1;
        return existing.count;
      }
      counters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    },
  };
}

/**
 * A KV-backed store, for when a namespace is bound.
 *
 * Takes the minimal slice of the KV interface it needs rather than the binding
 * type, so this file stays free of Cloudflare types and remains testable.
 */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export function kvStore(kv: KVLike): RateLimitStore {
  return {
    async increment(key, windowSeconds) {
      // Not atomic. Two simultaneous requests can read the same value and both
      // write n+1, undercounting by one. For a form whose limits are measured
      // in single digits per minute, a Durable Object to fix that is not worth
      // the latency or the complexity.
      const current = parseInt((await kv.get(key)) ?? "0", 10);
      const next = (Number.isFinite(current) ? current : 0) + 1;
      await kv.put(key, String(next), { expirationTtl: Math.max(60, windowSeconds) });
      return next;
    },
  };
}

/**
 * Check every rule, and increment every rule's counter even after one has
 * already blocked. Skipping the rest would let a caller who is over the burst
 * limit stay invisible to the daily one.
 */
export async function checkRateLimit(
  identifier: string,
  store: RateLimitStore,
  rules: RateLimitRule[] = DEFAULT_RULES,
  now = Date.now(),
): Promise<RateLimitResult> {
  let blocked: RateLimitResult | null = null;

  for (const rule of rules) {
    // The window number is part of the key, which is what makes the counter
    // reset without anything having to delete it.
    const windowIndex = Math.floor(now / (rule.windowSeconds * 1000));
    const key = `rl:${rule.name}:${identifier}:${windowIndex}`;
    const used = await store.increment(key, rule.windowSeconds);

    if (used > rule.limit && !blocked) {
      const windowEnds = (windowIndex + 1) * rule.windowSeconds * 1000;
      blocked = {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((windowEnds - now) / 1000)),
        rule: rule.name,
      };
    }
  }

  return blocked ?? { allowed: true, retryAfter: 0 };
}

/**
 * Best-effort client IP.
 *
 * `CF-Connecting-IP` is set by Cloudflare and cannot be spoofed from outside
 * the edge; the others are fallbacks for local development and are trusted only
 * because nothing security-critical hangs off this value. An unidentifiable
 * caller shares one bucket rather than escaping the limit entirely.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

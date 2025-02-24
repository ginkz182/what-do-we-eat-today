// utils/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RATE_LIMIT } from '@/config/constants';

export class RateLimiter {
  private limiter: Ratelimit;

  constructor(redis: Redis) {
    this.limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT.REQUESTS_PER_DAY, RATE_LIMIT.WINDOW),
      analytics: true,
      prefix: 'google_api_ratelimit',
    });
  }

  async checkLimit(identifier: string) {
    return await this.limiter.limit(identifier);
  }
}

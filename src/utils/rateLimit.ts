// utils/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export class RateLimiter {
  private limiter: Ratelimit;

  constructor(redis: Redis, requestsPerDay = 10) {
    this.limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requestsPerDay, '24 h'),
      analytics: true,
    });
  }

  async checkLimit(identifier: string) {
    return await this.limiter.limit(identifier);
  }
}

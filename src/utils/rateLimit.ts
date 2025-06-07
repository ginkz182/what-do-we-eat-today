import { Redis } from 'ioredis';

export class RateLimiter {
  constructor(
    private redis: Redis,
    private limit: number = 10,
    private windowSeconds: number = 60,
  ) {}

  async checkLimit(ip: string) {
    const key = `rate_limit:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    const window = now - this.windowSeconds;

    // Use a pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, window);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, this.windowSeconds);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    if (currentCount >= this.limit) {
      // Remove the request we just added since we're over limit
      await this.redis.zrem(key, `${now}-${Math.random()}`);

      return {
        success: false,
        limit: this.limit,
        remaining: 0,
        reset: (now + this.windowSeconds) * 1000,
      };
    }

    return {
      success: true,
      limit: this.limit,
      remaining: this.limit - currentCount - 1,
      reset: (now + this.windowSeconds) * 1000,
    };
  }
}

import { Redis } from 'ioredis';

export class RateLimiter {
  constructor(
    private redis: Redis,
    private systemLimit: number = 100,
    private ipLimit: number = 10,
    private systemWindow: number = 3600, // 1 hour
    private ipWindow: number = 300, // 5 minutes
  ) {}

  async checkLimit(ip: string) {
    try {
      // Check IP limit FIRST (no side effects)
      const ipResult = await this.checkIpLimit(ip);
      if (!ipResult.success) {
        return { reason: 'ip_limit', ...ipResult };
      }

      // Only check system limit if IP check passes
      const systemResult = await this.checkSystemLimit();
      if (!systemResult.success) {
        return { reason: 'system_limit', ...systemResult };
      }

      return { ...systemResult, ...ipResult };
    } catch (error) {
      console.warn('Rate limit check failed, allowing request:', error);
      return {
        success: true,
        limit: this.ipLimit,
        remaining: this.ipLimit,
        reset: Date.now() + this.ipWindow * 1000,
      };
    }
  }

  private async checkSystemLimit() {
    const key = `system_rate_limit:places`;
    return this.executeRateLimit(key, this.systemLimit, this.systemWindow);
  }

  private async checkIpLimit(ip: string) {
    const key = `ip_rate_limit:places:${ip}`;
    return this.executeRateLimit(key, this.ipLimit, this.ipWindow);
  }

  private async executeRateLimit(key: string, limit: number, windowSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const window = now - windowSeconds;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, window);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    if (currentCount >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: (now + windowSeconds) * 1000,
      };
    }

    return {
      success: true,
      limit,
      remaining: limit - currentCount - 1,
      reset: (now + windowSeconds) * 1000,
    };
  }
}

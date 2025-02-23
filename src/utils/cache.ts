// utils/cache.ts
import { Redis } from '@upstash/redis';
import { PlaceSearchParams, Restaurant, UserSearch } from '../types/places';
import { generateGeohash } from './geohash';
import { roundCoordinates, roundRadius } from './location';

export class CacheManager {
  private redis: Redis;
  private defaultTTL: number;

  constructor(redis: Redis, defaultTTL = 3600) {
    this.redis = redis;
    this.defaultTTL = defaultTTL;
  }

  private generateLocationCacheKey(params: PlaceSearchParams): string {
    const { latitude, longitude } = roundCoordinates(
      params.locationRestriction.circle.center.latitude,
      params.locationRestriction.circle.center.longitude,
    );
    const radius = roundRadius(params.locationRestriction.circle.radius);
    const geohash = generateGeohash(latitude, longitude);

    return `places:${geohash}:${radius}`;
  }

  private getUserCacheKey(userId: string): string {
    return `user:${userId}:searches`;
  }

  async getLocationCache(params: PlaceSearchParams): Promise<Restaurant[] | null> {
    const key = this.generateLocationCacheKey(params);
    const data = await this.redis.get<string>(key);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  }

  async setLocationCache(params: PlaceSearchParams, data: Restaurant[]): Promise<void> {
    const key = this.generateLocationCacheKey(params);
    await this.redis.set(key, JSON.stringify(data), { ex: this.defaultTTL });
  }

  async getUserSearches(userId: string): Promise<UserSearch[]> {
    const key = this.getUserCacheKey(userId);
    return (await this.redis.get<UserSearch[]>(key)) || [];
  }

  async addUserSearch(
    userId: string,
    params: PlaceSearchParams,
    results: Restaurant[],
  ): Promise<void> {
    const key = this.getUserCacheKey(userId);
    const searches = await this.getUserSearches(userId);

    const newSearch: UserSearch = {
      params,
      results,
      timestamp: Date.now(),
    };

    searches.unshift(newSearch);
    searches.splice(5); // Keep only last 5 searches

    await this.redis.set(key, searches, { ex: 86400 }); // 24 hours TTL
  }
}

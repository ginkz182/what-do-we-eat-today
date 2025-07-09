// utils/cache.ts
import { Redis } from 'ioredis';
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
    const cuisines = params.includedTypes.sort().join(',');

    return `places:${geohash}:${radius}:${cuisines}`;
  }

  private getUserCacheKey(userId: string): string {
    return `user:${userId}:searches`;
  }

  async getLocationCache(params: PlaceSearchParams): Promise<Restaurant[] | null> {
    try {
      const key = this.generateLocationCacheKey(params);
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Cache read failed, continuing without cache:', error);
      return null;
    }
  }

  async setLocationCache(params: PlaceSearchParams, data: Restaurant[]): Promise<void> {
    try {
      const key = this.generateLocationCacheKey(params);
      await this.redis.setex(key, this.defaultTTL, JSON.stringify(data));
    } catch (error) {
      console.warn('Cache write failed, continuing without cache:', error);
    }
  }

  async getUserSearches(userId: string): Promise<UserSearch[]> {
    try {
      const key = this.getUserCacheKey(userId);
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('User cache read failed, continuing without cache:', error);
      return [];
    }
  }

  async addUserSearch(
    userId: string,
    params: PlaceSearchParams,
    results: Restaurant[],
  ): Promise<void> {
    try {
      const key = this.getUserCacheKey(userId);
      const searches = await this.getUserSearches(userId);

      const newSearch: UserSearch = {
        params,
        results,
        timestamp: Date.now(),
      };

      searches.unshift(newSearch);
      searches.splice(5); // Keep only last 5 searches

      await this.redis.setex(key, 86400, JSON.stringify(searches)); // 24 hours TTL
    } catch (error) {
      console.warn('User cache write failed, continuing without cache:', error);
    }
  }
}

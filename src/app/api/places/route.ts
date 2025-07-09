import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Redis } from 'ioredis';
import { CacheManager } from '@/utils/cache';
import { RateLimiter } from '@/utils/rateLimit';
import { GooglePlacesService } from '@/utils/places';
import type { RequestBody, Restaurant } from '@/types/places';
import { CACHE, GOOGLE_PLACES, CUISINE_SELECTION } from '@/config/constants';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const CACHE_TTL = CACHE.TTL;

// Initialize services
console.log('REDIS_URL:', process.env.REDIS_URL);
const redis = new Redis(process.env.REDIS_URL!);

const cacheManager = new CacheManager(redis, CACHE_TTL);
const rateLimiter = new RateLimiter(redis);
const placesService = new GooglePlacesService(GOOGLE_PLACES_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0] ?? '127.0.0.1';

    const body: RequestBody = await request.json();
    const { location, radius } = body;
    let { cuisines = [] } = body;

    // Backend validation: Enforce cuisine selection limit
    if (cuisines.length > CUISINE_SELECTION.MAX_SELECTIONS) {
      console.log(`⚠️ Too many cuisines selected (${cuisines.length}), limiting to ${CUISINE_SELECTION.MAX_SELECTIONS}`);
      cuisines = cuisines.slice(0, CUISINE_SELECTION.MAX_SELECTIONS);
    }

    const baseSearchParams = {
      locationRestriction: {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: radius * 1000,
        },
      },
      maxResultCount: GOOGLE_PLACES.MAX_RESULTS,
      languageCode: GOOGLE_PLACES.LANGUAGE,
    };

    // HYBRID APPROACH:
    // 1. No cuisines selected → Single broad API call
    // 2. Specific cuisines (1-3) → Per-cuisine API calls with individual caching
    
    if (cuisines.length === 0) {
      // Strategy 1: Single broad search for all restaurant types
      console.log(`🌍 No cuisines selected - doing broad search`);
      
      const broadSearchParams = {
        ...baseSearchParams,
        includedTypes: ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery'],
      };

      let allRestaurants = await cacheManager.getLocationCache(broadSearchParams);
      
      if (allRestaurants && allRestaurants.length > 0) {
        console.log(`✅ Cache HIT: ${allRestaurants.length} restaurants`);
        return NextResponse.json({
          data: allRestaurants,
          source: 'location_cache',
        });
      }

      // Check rate limit before API call
      const rateLimitResult = await rateLimiter.checkLimit(ip);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'API rate limit exceeded',
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            reset: new Date(rateLimitResult.reset).toISOString(),
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.reset.toString(),
              'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
            },
          },
        );
      }

      console.log(`🌐 Fetching all restaurants from Google Places API...`);
      allRestaurants = await placesService.searchPlaces(broadSearchParams);
      console.log(`📥 Got ${allRestaurants.length} total restaurants from API`);
      
      await cacheManager.setLocationCache(broadSearchParams, allRestaurants);
      console.log(`💾 Cached ${allRestaurants.length} restaurants for location`);

      return NextResponse.json({
        data: allRestaurants,
        source: 'api',
      });
    } else {
      // Strategy 2: Per-cuisine search with individual caching
      console.log(`🎯 Specific cuisines selected (${cuisines.length}):`, cuisines);
      
      const allCachedResults: Restaurant[] = [];
      const cuisinesNeedingAPI: string[] = [];

      // Check cache for each cuisine
      for (const cuisine of cuisines) {
        const cuisineSearchParams = {
          ...baseSearchParams,
          includedTypes: [cuisine],
        };
        
        const cachedData = await cacheManager.getLocationCache(cuisineSearchParams);
        
        if (cachedData) {
          console.log(`✅ Cache HIT for ${cuisine}: ${cachedData.length} results`);
          allCachedResults.push(...cachedData);
        } else {
          console.log(`❌ Cache MISS for ${cuisine}`);
          cuisinesNeedingAPI.push(cuisine);
        }
      }

      // If all cuisines are cached, return immediately
      if (cuisinesNeedingAPI.length === 0) {
        const uniqueResults = Array.from(
          new Map(allCachedResults.map(r => [r.id, r])).values()
        );
        
        console.log(`✨ Returning ${uniqueResults.length} cached results (all from cache)`);
        return NextResponse.json({
          data: uniqueResults,
          source: 'per_cuisine_cache',
        });
      }

      // Check rate limit before making API calls
      const rateLimitResult = await rateLimiter.checkLimit(ip);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'API rate limit exceeded',
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            reset: new Date(rateLimitResult.reset).toISOString(),
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.reset.toString(),
              'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
            },
          },
        );
      }

      // Fetch missing cuisines from API
      const newResults: Restaurant[] = [];
      
      for (const cuisine of cuisinesNeedingAPI) {
        console.log(`🌐 Fetching ${cuisine} from Google Places API...`);
        
        const cuisineSearchParams = {
          ...baseSearchParams,
          includedTypes: [cuisine],
        };
        
        const restaurants = await placesService.searchPlaces(cuisineSearchParams);
        console.log(`📥 Got ${restaurants.length} results for ${cuisine}`);
        
        newResults.push(...restaurants);
        
        // Cache results for this specific cuisine
        await cacheManager.setLocationCache(cuisineSearchParams, restaurants);
        console.log(`💾 Cached ${restaurants.length} results for ${cuisine}`);
      }

      // Combine cached + new results
      const allResults = [...allCachedResults, ...newResults];
      
      // Remove duplicates
      const uniqueResults = Array.from(
        new Map(allResults.map(r => [r.id, r])).values()
      );

      console.log(`🎯 Final result: ${uniqueResults.length} restaurants (${allCachedResults.length} cached + ${newResults.length} fresh)`);

      return NextResponse.json({
        data: uniqueResults,
        source: cuisinesNeedingAPI.length === cuisines.length ? 'per_cuisine_api' : 'mixed',
      });
    }
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch restaurants',
      },
      { status: 500 },
    );
  }
}

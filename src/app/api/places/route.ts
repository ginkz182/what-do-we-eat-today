import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Redis } from 'ioredis';
import { CacheManager } from '@/utils/cache';
import { RateLimiter } from '@/utils/rateLimit';
import { GooglePlacesService } from '@/utils/places';
import { isNearbyLocation } from '@/utils/location';
import type { PlaceSearchParams, RequestBody, UserSearch, Restaurant } from '@/types/places';
import { CACHE, GOOGLE_PLACES } from '@/config/constants';

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
    const { location, radius, cuisines = [] } = body;

    // If no cuisines selected, search all types
    const searchCuisines = cuisines.length > 0 ? cuisines : [
      'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 
      'fast_food_restaurant', 'ice_cream_shop', 'pizza_restaurant', 
      'sandwich_shop', 'coffee_shop', 'brunch_restaurant', 'american_restaurant',
      'chinese_restaurant', 'italian_restaurant', 'japanese_restaurant', 
      'korean_restaurant', 'indian_restaurant', 'thai_restaurant', 
      'mexican_restaurant', 'french_restaurant', 'seafood_restaurant', 
      'steak_house', 'sushi_restaurant', 'vegan_restaurant', 'vegetarian_restaurant'
    ];

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

    // Try to get results from per-cuisine caches
    const allCachedResults: Restaurant[] = [];
    const cuisinesNeedingAPI: string[] = [];

    console.log(`🔍 Checking cache for ${searchCuisines.length} cuisines:`, searchCuisines);

    for (const cuisine of searchCuisines) {
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

    console.log(`📊 Cache summary: ${allCachedResults.length} cached results, ${cuisinesNeedingAPI.length} cuisines need API`);
    if (cuisinesNeedingAPI.length > 0) {
      console.log(`🔄 Will fetch from API:`, cuisinesNeedingAPI);
    }

    // If we have all cuisines cached, return combined results
    if (cuisinesNeedingAPI.length === 0) {
      // Remove duplicates and shuffle
      const uniqueResults = Array.from(
        new Map(allCachedResults.map(r => [r.id, r])).values()
      );
      
      console.log(`✨ Returning ${uniqueResults.length} cached results (all from cache)`);
      
      return NextResponse.json({
        data: uniqueResults,
        source: 'location_cache',
      });
    }

    // Only check rate limit before making Google API call
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

    // Fetch missing cuisines from Google API
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
      source: cuisinesNeedingAPI.length === searchCuisines.length ? 'api' : 'mixed',
    });
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

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Redis } from '@upstash/redis';
import { CacheManager } from '@/utils/cache';
import { RateLimiter } from '@/utils/rateLimit';
import { GooglePlacesService } from '@/utils/places';
import { isNearbyLocation } from '@/utils/location';
import type { PlaceSearchParams, RequestBody, UserSearch } from '@/types/places';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const CACHE_TTL = 3600; // 1 hour

// Initialize services
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const cacheManager = new CacheManager(redis, CACHE_TTL);
const rateLimiter = new RateLimiter(redis, 100); // 100 requests per day
const placesService = new GooglePlacesService(GOOGLE_PLACES_API_KEY);

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const forwardedFor = (await headers()).get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0] ?? '127.0.0.1';

    // Check rate limit
    const { success, limit, reset, remaining } = await rateLimiter.checkLimit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit,
          remaining,
          reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        },
      );
    }

    const body: RequestBody = await request.json();
    const { location, radius } = body;

    const searchParams: PlaceSearchParams = {
      locationRestriction: {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: radius * 1000, // Convert km to meters
        },
      },
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      languageCode: 'en',
    };

    // Check user's recent searches
    const userSearches = await cacheManager.getUserSearches(ip);
    const matchingSearch = userSearches.find(
      (search: UserSearch) =>
        isNearbyLocation(search.params.locationRestriction.circle.center, location) &&
        search.params.locationRestriction.circle.radius ===
          searchParams.locationRestriction.circle.radius,
    );

    if (matchingSearch && Date.now() - matchingSearch.timestamp < CACHE_TTL * 1000) {
      return NextResponse.json({
        data: matchingSearch.results,
        source: 'user_cache',
      });
    }

    // Check location-based cache
    const cachedData = await cacheManager.getLocationCache(searchParams);
    if (cachedData) {
      await cacheManager.addUserSearch(ip, searchParams, cachedData);
      return NextResponse.json({
        data: cachedData,
        source: 'location_cache',
      });
    }

    // Fetch from Google Places API
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.priceLevel,places.rating,places.userRatingCount,places.types,places.formattedAddress',
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = await response.json();

    const restaurants = data.places.map((place: any) => ({
      id: place.id,
      name: place.displayName.text,
      cuisine: place.types[0],
      price: ''.padStart(place.priceLevel || 0, '$'),
      rating: place.rating || 0,
      address: place.formattedAddress,
      reviewCount: place.userRatingCount || 0,
    }));

    // Cache results
    await Promise.all([
      cacheManager.setLocationCache(searchParams, restaurants),
      cacheManager.addUserSearch(ip, searchParams, restaurants),
    ]);

    return NextResponse.json({
      data: restaurants,
      source: 'api',
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

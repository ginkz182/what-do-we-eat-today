import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';

interface PlaceSearchParams {
  locationRestriction: {
    circle: {
      center: {
        latitude: number;
        longitude: number;
      };
      radius: number;
    };
  };
  includedTypes: string[];
  maxResultCount: number;
  languageCode: string;
}

interface GooglePlace {
  id: string;
  displayName: {
    text: string;
  };
  priceLevel: number;
  rating: number;
  userRatingCount: number;
  types: string[];
  formattedAddress: string;
}

interface RequestBody {
  location: {
    lat: number;
    lng: number;
  };
  radius: number;
  cuisine: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { location, radius, cuisine } = body;

    const searchParams: PlaceSearchParams = {
      locationRestriction: {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng
          },
          radius: radius * 1000 // Convert km to meters
        }
      },
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      languageCode: "en"
    };

    // Add cuisine type if specified
    if (cuisine && cuisine !== 'All') {
      searchParams.includedTypes.push(cuisine.toLowerCase());
    }

    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error('Google Places API key is not configured');
    }

    const response = await fetch(GOOGLE_PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.priceLevel,places.rating,places.userRatingCount,places.types,places.formattedAddress'
      } as HeadersInit,
      body: JSON.stringify(searchParams)
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform the response to match our frontend expectations
    const restaurants = (data.places as GooglePlace[]).map(place => ({
      id: place.id,
      name: place.displayName.text,
      cuisine: place.types[0], // Using first type as primary cuisine
      price: ''.padStart(place.priceLevel || 0, '$'),
      rating: place.rating || 0,
      address: place.formattedAddress,
      reviewCount: place.userRatingCount || 0
    }));

    return NextResponse.json({ data: restaurants }, { status: 200 });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch restaurants from Google Places API' },
      { status: 500 }
    );
  }
}

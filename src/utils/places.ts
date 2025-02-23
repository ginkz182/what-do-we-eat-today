// utils/places.ts
import type { PlaceSearchParams, Restaurant, GooglePlace } from '@/types/places';

export class GooglePlacesService {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.apiUrl = 'https://places.googleapis.com/v1/places:searchNearby';
  }

  async searchPlaces(params: PlaceSearchParams): Promise<Restaurant[]> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.priceLevel,places.rating,places.userRatingCount,places.types,places.formattedAddress',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = await response.json();

    return (data.places as GooglePlace[]).map(place => ({
      id: place.id,
      name: place.displayName.text,
      cuisine: place.types[0],
      price: ''.padStart(place.priceLevel || 0, '$'),
      rating: place.rating || 0,
      address: place.formattedAddress,
      reviewCount: place.userRatingCount || 0,
    }));
  }
}

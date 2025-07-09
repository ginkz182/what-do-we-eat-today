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
          'places.id,places.displayName,places.priceLevel,places.rating,places.userRatingCount,places.types,places.formattedAddress,places.photos',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places API error response:', errorText);
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if we got any places back
    if (!data.places || !Array.isArray(data.places)) {
      console.log('No places returned from Google API:', data);
      return [];
    }
    
    // Filter to only include food-related establishments
    const foodTypes = [
      'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 
      'fast_food_restaurant', 'ice_cream_shop', 'pizza_restaurant', 
      'sandwich_shop', 'coffee_shop', 'brunch_restaurant'
    ];
    
    const filteredPlaces = (data.places as GooglePlace[])
      .filter(place => place.types && place.types.some(type => foodTypes.includes(type)))
      .map(place => ({
        id: place.id,
        name: place.displayName.text,
        cuisine: place.types.find(type => foodTypes.includes(type)) || place.types[0],
        price: ''.padStart(place.priceLevel || 0, '$'),
        rating: place.rating || 0,
        address: place.formattedAddress,
        reviewCount: place.userRatingCount || 0,
        photos: place.photos?.slice(0, 3).map(photo => 
          `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&key=${this.apiKey}`
        ) || [],
      }));

    
    return filteredPlaces;
  }
}

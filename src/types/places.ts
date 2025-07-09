// types/places.ts

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface RequestLocation {
  lat: number;
  lng: number;
}

export interface PlaceSearchParams {
  locationRestriction: {
    circle: {
      center: GeoLocation;
      radius: number;
    };
  };
  includedTypes: string[];
  maxResultCount: number;
  languageCode: string;
}

export interface GooglePlace {
  id: string;
  displayName: {
    text: string;
  };
  priceLevel: number;
  rating: number;
  userRatingCount: number;
  types: string[];
  formattedAddress: string;
  photos?: {
    name: string;
    widthPx: number;
    heightPx: number;
    authorAttributions?: {
      displayName: string;
      uri: string;
    }[];
  }[];
}

export interface RequestBody {
  location: RequestLocation;
  radius: number;
  cuisines?: string[];
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  price: string;
  rating: number;
  address: string;
  reviewCount: number;
  photos?: string[];
}

export interface UserSearch {
  params: PlaceSearchParams;
  results: Restaurant[];
  timestamp: number;
}

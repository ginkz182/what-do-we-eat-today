import { GeoLocation, RequestLocation } from '@/types/places';

// utils/location.ts
export const roundCoordinates = (lat: number, lng: number, decimals = 3): GeoLocation => {
  return {
    latitude: Math.round(lat * Math.pow(10, decimals)) / Math.pow(10, decimals),
    longitude: Math.round(lng * Math.pow(10, decimals)) / Math.pow(10, decimals),
  };
};

export const isNearbyLocation = (
  loc1: GeoLocation,
  loc2: RequestLocation,
  threshold = 0.001, // roughly 100m
): boolean => {
  return (
    Math.abs(loc1.latitude - loc2.lat) < threshold &&
    Math.abs(loc1.longitude - loc2.lng) < threshold
  );
};

export const roundRadius = (radius: number, nearest = 100): number => {
  return Math.round(radius / nearest) * nearest;
};

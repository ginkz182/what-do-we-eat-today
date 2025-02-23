// utils/geohash.ts
import Geohash from 'latlon-geohash';

export const generateGeohash = (lat: number, lng: number, precision = 5): string => {
  return Geohash.encode(lat, lng, precision);
};

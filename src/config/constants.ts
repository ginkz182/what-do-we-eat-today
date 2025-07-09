// src/config/constants.ts
export const RATE_LIMIT = {
  REQUESTS_PER_DAY: 10,
  WINDOW: '24 h',
} as const;

export const CACHE = {
  TTL: 3600,
} as const;

export const GOOGLE_PLACES = {
  MAX_RESULTS: 20, // Google Places API max limit
  LANGUAGE: 'en',
} as const;

export const CUISINE_SELECTION = {
  MAX_SELECTIONS: 3, // Maximum number of cuisines that can be selected
} as const;

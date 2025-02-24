// src/config/constants.ts
export const RATE_LIMIT = {
  REQUESTS_PER_DAY: 10,
  WINDOW: '24 h',
} as const;

export const CACHE = {
  TTL: 3600,
} as const;

export const GOOGLE_PLACES = {
  MAX_RESULTS: 20,
  LANGUAGE: 'en',
} as const;

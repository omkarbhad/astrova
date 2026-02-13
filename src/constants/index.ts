// App Constants
export const APP_NAME = 'Astrova';
export const APP_DESCRIPTION = 'Vedic Birth Chart Generator';
export const APP_VERSION = '1.0.0';

// API Constants
export const API_ENDPOINTS = {
  KUNDALI: '/api/kundali',
  CHARTS: '/api/charts',
  REVERSE_GEOCODE: '/api/reverse-geocode',
  CHAT: '/api/chat',
} as const;

// Chart Constants
export const CHART_CONSTANTS = {
  DEFAULT_REQUEST: {
    year: 1990,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    tz_offset_hours: 5.5,
    latitude: 19.076,
    longitude: 72.8777,
    ayanamsha: 'lahiri',
    use_utc: false,
  },
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear() + 1,
  AYANAMSHAS: ['lahiri', 'raman', 'krishnamurti'] as const,
} as const;

// UI Constants
export const UI_CONSTANTS = {
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
  },
  ANIMATION: {
    DURATION: {
      FAST: 150,
      NORMAL: 300,
      SLOW: 500,
    },
  },
  DEBOUNCE: {
    REALTIME_INPUT: 600,
    SEARCH: 300,
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'astrova_auth_token',
  USER_PREFERENCES: 'astrova_user_preferences',
  CHART_CACHE: 'astrova_chart_cache',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTH_REQUIRED: 'Authentication required. Please sign in.',
  CHART_NOT_FOUND: 'Chart not found.',
  INVALID_INPUT: 'Invalid input provided.',
  SERVER_ERROR: 'Server error. Please try again later.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  CHART_SAVED: 'Chart saved successfully!',
  CHART_DELETED: 'Chart deleted successfully!',
  CHART_UPDATED: 'Chart updated successfully!',
} as const;

// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

// Helper function to make API calls with the correct base URL
export const apiRequest = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint}`;
};

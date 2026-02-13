// Auth types - Clerk handles auth now.
// These are kept for backward compatibility with any code that imports them.

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthState {
  user: unknown | null;
  loading: boolean;
  isAuthenticated: boolean;
}

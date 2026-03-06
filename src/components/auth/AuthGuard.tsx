import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

function hasMagnovaAuth(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('magnova_auth='));
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const [hasSessionCookie, setHasSessionCookie] = useState<boolean | null>(null);

  useEffect(() => {
    setHasSessionCookie(hasMagnovaAuth());
  }, []);

  // Still checking cookie
  if (hasSessionCookie === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(24,16%,6%)]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // Has magnova_session cookie from auth.magnova.ai — user is authenticated
  // Even if Firebase state hasn't loaded yet, allow through
  if (hasSessionCookie) {
    // If Firebase hasn't loaded yet but cookie exists, show loading
    if (!isLoaded) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(24,16%,6%)]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-4" />
            <p className="text-neutral-500 text-sm">Loading Astrova...</p>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  // Still loading Firebase auth (no cookie)
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(24,16%,6%)]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-neutral-500 text-sm">Loading Astrova...</p>
        </div>
      </div>
    );
  }

  // No cookie AND Firebase says not signed in — redirect to auth
  if (!isSignedIn) {
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `https://auth.magnova.ai/astrova?redirect=${redirect}`;
    return null;
  }

  return <>{children}</>;
}

import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Auth is now handled centrally at auth.magnova.ai.
 * This page redirects unauthenticated users there and handles the return.
 */
export default function LoginPage() {
  const { isSignedIn, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  useEffect(() => {
    if (!loading && !isSignedIn) {
      const returnUrl = redirectTo ?? window.location.origin + '/chart';
      window.location.href = `https://auth.magnova.ai/astrova?redirect=${encodeURIComponent(returnUrl)}`;
    }
  }, [loading, isSignedIn, redirectTo]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (isSignedIn) {
    if (redirectTo) { window.location.href = decodeURIComponent(redirectTo); return null; }
    return <Navigate to="/chart" replace />;
  }

  // Redirecting to auth.magnova.ai — show brief loading state
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
    </div>
  );
}

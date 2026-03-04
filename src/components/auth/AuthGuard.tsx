import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isSignedIn, isLoaded } = useAuth();

  // Still loading session — show spinner
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,10%,6%)]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-neutral-500 text-sm">Loading Astrova...</p>
        </div>
      </div>
    );
  }

  // No session at all — redirect to login
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

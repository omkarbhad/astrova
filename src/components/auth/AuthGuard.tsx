import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSignedIn) {
      navigate('/', { replace: true });
    }
  }, [loading, isSignedIn, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(24,16%,6%)]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}

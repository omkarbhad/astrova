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
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const has = hasMagnovaAuth();
    setAuthenticated(has);
    setChecked(true);

    if (!has) {
      const redirect = encodeURIComponent(window.location.href);
      window.location.href = `https://auth.magnova.ai/astrova?redirect=${redirect}`;
    }
  }, []);

  if (!checked || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(24,16%,6%)]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return <>{children}</>;
}

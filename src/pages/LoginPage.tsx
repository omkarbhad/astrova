import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  const { isSignedIn, loading } = useAuth();

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
    </div>
  );

  if (isSignedIn) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* Stars/particles visual hint */}
      <div className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <LoginForm className="relative z-10" />

      <p className="mt-6 text-xs text-zinc-600">
        Secure login powered by Firebase × Magnova
      </p>
    </div>
  );
}

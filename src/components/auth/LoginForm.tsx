'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function LoginForm({ className }: { className?: string }) {
  const { signInWithGoogle, signInWithEmail, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = mode === 'login'
      ? await signInWithEmail(email, password)
      : await signUp(email, password, name);
    if (result?.error) setError(result.error);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    const result = await signInWithGoogle();
    if (result?.error) setError(result.error);
    setLoading(false);
  };

  return (
    <div className={cn(
      'w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-md',
      className
    )}>
      {/* Logo + Title */}
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">✦</span>
          <span className="text-xl font-semibold tracking-tight text-white">Magnova</span>
        </div>
        <p className="text-sm text-zinc-400">
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-zinc-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 border border-red-500/20">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-50"
        >
          {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {/* Toggle mode */}
      <p className="text-center text-xs text-zinc-500">
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
          className="text-white underline underline-offset-2 hover:no-underline"
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>

      <p className="text-center text-[10px] text-zinc-600">
        By continuing, you agree to Magnova's{' '}
        <a href="/terms" className="underline underline-offset-1 hover:text-zinc-400">Terms</a>
        {' '}and{' '}
        <a href="/privacy" className="underline underline-offset-1 hover:text-zinc-400">Privacy Policy</a>
      </p>
    </div>
  );
}

import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Loader2, LogOut, User, Coins } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
  const { isLoaded, isSignedIn, astrovaUser, signOut } = useAuth();
  let liveCredits: number | null = null;
  try { const ctx = useCredits(); liveCredits = ctx.credits; } catch { /* CreditsProvider may not be mounted */ }
  const [open, setOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [open]);

  // Reset avatar error when user changes
  useEffect(() => {
    if (astrovaUser?.avatar_url) {
      setAvatarError(false);
    }
  }, [astrovaUser?.avatar_url]);

  if (!isLoaded) {
    return <Loader2 className="w-5 h-5 animate-spin text-white/40" />;
  }

  if (!isSignedIn) {
    return (
      <button
        onClick={() => window.location.href = '/login'}
        className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-black hover:bg-neutral-200 transition-colors"
      >
        Sign In
      </button>
    );
  }

  // Signed in but astrovaUser not yet loaded from DB — show loader briefly, then sign-out fallback
  if (!astrovaUser) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  const initials = (astrovaUser.display_name?.[0] || astrovaUser.email[0] || '?').toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-xs font-semibold text-white hover:border-neutral-600 transition-colors overflow-hidden"
      >
        {astrovaUser.avatar_url && !avatarError ? (
          <img 
            src={astrovaUser.avatar_url} 
            alt="" 
            className="w-full h-full object-cover rounded-full"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-neutral-800/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[100]">
          <div className="px-3.5 py-3 border-b border-neutral-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700/50 flex items-center justify-center overflow-hidden shrink-0">
                {astrovaUser.avatar_url && !avatarError ? (
                  <img 
                    src={astrovaUser.avatar_url} 
                    alt="" 
                    className="w-full h-full object-cover rounded-full"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <User className="w-4 h-4 text-neutral-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-white text-sm font-medium truncate">{astrovaUser.display_name || 'User'}</div>
                <div className="text-neutral-500 text-[11px] truncate">{astrovaUser.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 px-0.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 text-xs font-semibold">{liveCredits ?? astrovaUser.credits}</span>
              <span className="text-neutral-500 text-[10px]">credits</span>
            </div>
          </div>
          <div className="p-1.5">
            <button
              onClick={() => { signOut(); setOpen(false); nav('/'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { Heart, Shield, Calendar, Sparkles, Info } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  activeView: 'kundali' | 'matcher';
  onViewChange: (view: 'kundali' | 'matcher') => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onOpenModelInfo?: () => void;
}

export function Header({
  activeView,
  onViewChange,
  onToggleSidebar,
  sidebarOpen,
  onOpenModelInfo,
}: HeaderProps) {
  const { astrovaUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = astrovaUser?.role === 'admin';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === '1') onViewChange('kundali');
      if (event.altKey && event.key === '2') onViewChange('matcher');
      if (event.altKey && event.key.toLowerCase() === 'a' && onToggleSidebar) onToggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleSidebar, onViewChange]);

  const navItems = [
    { key: 'kundali' as const, label: 'Charts', icon: Calendar, activeColor: 'text-amber-400', activeBg: 'bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10' },
    { key: 'matcher' as const, label: 'Matcher', icon: Heart, activeColor: 'text-amber-400', activeBg: 'bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10' },
  ];

  return (
    <header className="sticky top-0 z-[60] w-full bg-[linear-gradient(180deg,rgba(20,13,7,0.96),rgba(13,9,5,0.94))] backdrop-blur-xl border-b border-amber-500/20 shadow-[0_6px_18px_rgba(0,0,0,0.22)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/astrova_logo.png" alt="Astrova" className="w-7 h-7 sm:w-8 sm:h-8" />
            <div className="hidden sm:block flex flex-col justify-center">
              <h1 className="text-sm font-semibold text-white leading-none tracking-tight">Astrova</h1>
              <p className="text-[10px] text-neutral-500 leading-none mt-0.5">Your Modern Astrologer</p>
            </div>
            <h1 className="sm:hidden text-sm font-semibold text-white">Astrova</h1>
          </div>

          {/* Center Nav - Icons only on mobile, full on desktop */}
          <nav className="flex items-center gap-0.5 p-0.5 rounded-full bg-[hsl(24,18%,9%)] border border-amber-500/25">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onViewChange(item.key)}
                  className={`flex items-center gap-1.5 px-3 sm:px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-all duration-200 shrink-0 ${
                    isActive
                      ? item.activeBg
                      : 'text-neutral-400 hover:text-amber-200 hover:bg-amber-500/10'
                  }`}
                  title={item.label}
                  aria-label={`Open ${item.label}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? item.activeColor : ''}`} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}

            {isAdmin && onOpenModelInfo && (
              <button
                onClick={onOpenModelInfo}
                className="flex items-center gap-1.5 px-3 sm:px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-all duration-200 text-neutral-400 hover:text-amber-300 hover:bg-amber-500/10"
                title="Model Context Info"
                aria-label="Open model context info"
              >
                <Info className="w-4 h-4" />
                <span className="hidden sm:inline">Info</span>
              </button>
            )}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Astrova AI Toggle */}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  sidebarOpen
                    ? 'text-neutral-300 hover:text-amber-200 hover:bg-amber-500/12 border border-amber-500/25 hover:border-amber-500/40'
                    : 'bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30'
                }`}
                title="Toggle Astrova AI"
                aria-label="Toggle Astrova AI sidebar"
              >
                <Sparkles className={`w-4 h-4 ${sidebarOpen ? 'text-amber-400 animate-pulse' : ''}`} />
                <span className="text-xs">AI</span>
              </button>
            )}

            {/* Admin Link */}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="p-1.5 rounded-full text-neutral-500 hover:bg-amber-500/10 transition-all group"
                title="Admin Panel"
                aria-label="Open admin panel"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-amber-500/20 mx-0.5 hidden sm:block" />

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

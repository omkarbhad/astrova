import { Heart, Shield, LayoutGrid, Sparkles, Info } from 'lucide-react';
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

  const navItems = [
    { key: 'kundali' as const, label: 'Charts', icon: LayoutGrid, activeColor: 'text-amber-400', activeBg: 'bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10' },
    { key: 'matcher' as const, label: 'Matcher', icon: Heart, activeColor: 'text-pink-400', activeBg: 'bg-pink-500/15 text-pink-300 shadow-sm shadow-pink-500/10' },
  ];

  return (
    <header className="sticky top-0 z-[60] w-full bg-[hsl(220,10%,6%)]/95 backdrop-blur-xl border-b border-[hsl(220,8%,16%)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/astrova_logo.png" alt="Astrova" className="w-7 h-7 sm:w-8 sm:h-8" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold text-white leading-none tracking-tight">Astrova</h1>
              <p className="text-[10px] text-neutral-500 leading-none mt-0.5">Your Modern Astrologer</p>
            </div>
            <h1 className="sm:hidden text-sm font-semibold text-white">Astrova</h1>
          </div>

          {/* Center Nav - Icons only on mobile, full on desktop */}
          <nav className="flex items-center gap-0.5 p-0.5 rounded-full bg-[hsl(220,10%,7%)]/90 border border-[hsl(220,8%,18%)]">
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
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 ${isActive ? item.activeColor : ''}`} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}

            {isAdmin && onOpenModelInfo && (
              <button
                onClick={onOpenModelInfo}
                className="flex items-center gap-1.5 px-3 sm:px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-all duration-200 text-neutral-500 hover:text-cyan-300"
                title="Model Context Info"
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  sidebarOpen
                    ? 'bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30'
                    : 'text-neutral-400 hover:text-amber-300 hover:bg-amber-500/10 border border-[hsl(220,8%,20%)] hover:border-amber-500/30'
                }`}
                title="Toggle Astrova AI"
              >
                <Sparkles className={`w-3.5 h-3.5 ${sidebarOpen ? 'text-amber-400 animate-pulse' : ''}`} />
                <span className="text-[11px]">AI</span>
              </button>
            )}

            {/* Admin Link */}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-800/60 transition-all group"
                title="Admin Panel"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400 group-hover:text-emerald-300" />
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-[hsl(220,8%,18%)] mx-0.5 hidden sm:block" />

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

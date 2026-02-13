import { Sparkles, Heart, Settings } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserMenu } from '@/components/auth/UserMenu';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAILS = ['omkarbhad@gmail.com'];

interface HeaderProps {
  activeView: 'kundali' | 'matcher';
  onViewChange: (view: 'kundali' | 'matcher') => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function Header({
  activeView,
  onViewChange,
  onToggleSidebar,
  sidebarOpen,
}: HeaderProps) {
  const { user } = useUser();
  const navigate = useNavigate();
  const isAdmin = user && ADMIN_EMAILS.includes(user.primaryEmailAddress?.emailAddress || '');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-violet-500/15 bg-black/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <img 
              src="/astrova_logo.png" 
              alt="Astrova Logo" 
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
            <div className="hidden sm:block">
              <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
                Astrova
              </h1>
              <p className="text-[10px] sm:text-xs text-neutral-400 leading-tight">
                Vedic Birth Chart Generator
              </p>
            </div>
            <h1 className="sm:hidden text-sm font-bold text-white">Astrova</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Navigation Tabs */}
            <Tabs
              value={activeView}
              onValueChange={(v) => onViewChange(v as 'kundali' | 'matcher')}
              className="hidden sm:block"
            >
              <TabsList>
                <TabsTrigger value="kundali" className="gap-1.5">
                  <img 
                    src="/astrova_logo.png" 
                    alt="Astrova" 
                    className="w-4 h-4"
                  />
                  Charts
                </TabsTrigger>
                <TabsTrigger value="matcher" className="gap-1.5">
                  <Heart className="w-4 h-4" />
                  Matcher
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Mobile Navigation */}
            <Tabs
              value={activeView}
              onValueChange={(v) => onViewChange(v as 'kundali' | 'matcher')}
              className="sm:hidden"
            >
              <TabsList>
                <TabsTrigger value="kundali" className="px-2.5 gap-1">
                  <img 
                    src="/astrova_logo.png" 
                    alt="Astrova" 
                    className="w-4 h-4"
                  />
                  <span className="text-xs">Charts</span>
                </TabsTrigger>
                <TabsTrigger value="matcher" className="px-2.5 gap-1">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs">Match</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Astrova AI Toggle */}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                  sidebarOpen
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30'
                    : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400 hover:text-white hover:bg-neutral-800 hover:border-neutral-600/50'
                }`}
                title="Toggle Astrova AI"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Astrova AI</span>
                <span className="sm:hidden">AI</span>
              </button>
            )}

            {/* Admin Link */}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50 text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs transition-all"
                title="Admin Panel"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

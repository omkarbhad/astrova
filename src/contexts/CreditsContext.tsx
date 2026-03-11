import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { deductUserCredits, updateUserCredits, getAstrovaUserById, getCreditCosts } from '@/lib/api';

interface CreditCosts {
  AI_MESSAGE: number;
  CHART_GENERATION: number;
  MATCHING: number;
}

interface CreditsContextType {
  credits: number;
  creditCosts: CreditCosts;
  deductCredits: (amount: number, action?: string) => boolean;
  addCredits: (amount: number, syncWithServer?: boolean) => void;
  showBuyModal: boolean;
  setShowBuyModal: (show: boolean) => void;
}

const CreditsContext = createContext<CreditsContextType | null>(null);
const INITIAL_CREDITS = 0;

function toNumberSafe(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const DEFAULT_CREDIT_COSTS: CreditCosts = {
  AI_MESSAGE: 2,
  CHART_GENERATION: 1,
  MATCHING: 3,
};

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { astrovaUser, isSignedIn } = useAuth();
  // No localStorage — credits come from DB only
  const [credits, setCredits] = useState<number>(INITIAL_CREDITS);
  const [creditCosts, setCreditCosts] = useState<CreditCosts>(DEFAULT_CREDIT_COSTS);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const mountedRef = useRef(true);
  const userIdRef = useRef<string | null>(null);
  useEffect(() => { userIdRef.current = astrovaUser?.id ?? null; }, [astrovaUser?.id]);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Fetch credit costs from public API (wait for auth)
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const costs = await getCreditCosts();
        if (cancelled) return;
        if (costs && typeof costs === 'object') {
          setCreditCosts({
            AI_MESSAGE: costs.ai_message ?? DEFAULT_CREDIT_COSTS.AI_MESSAGE,
            CHART_GENERATION: costs.chart_generation ?? DEFAULT_CREDIT_COSTS.CHART_GENERATION,
            MATCHING: costs.matching ?? DEFAULT_CREDIT_COSTS.MATCHING,
          });
        }
      } catch { /* use defaults */ }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  // Sync credits from DB user — no localStorage
  useEffect(() => {
    if (astrovaUser) {
      setCredits(toNumberSafe(astrovaUser.credits));
    } else if (!isSignedIn) {
      setCredits(INITIAL_CREDITS);
    }
  }, [astrovaUser?.id, astrovaUser?.credits, isSignedIn]);

  const deductCredits = useCallback((amount: number, action?: string): boolean => {
    console.log('[credits] deductCredits called:', { amount, action, currentCredits: credits });
    if (amount <= 0) return true;
    if (credits < amount) {
      console.log('[credits] insufficient credits:', { credits, amount });
      setShowBuyModal(true);
      return false;
    }
    const newCredits = credits - amount;
    setCredits(newCredits);
    const uid = userIdRef.current;
    if (uid) {
      console.log('[credits] calling deductUserCredits API:', { uid, amount, action });
      deductUserCredits(uid, amount, action || 'ai_message').then(async (result) => {
        console.log('[credits] deductUserCredits result:', result);
        const fresh = await getAstrovaUserById(uid);
        console.log('[credits] fresh user data:', fresh);
        if (mountedRef.current && fresh && typeof fresh.credits === 'number') {
          setCredits(fresh.credits);
        }
      }).catch((err) => {
        console.error('[credits] deduct sync failed:', err);
        if (mountedRef.current) {
          setCredits(prev => prev + amount);
        }
      });
    } else {
      console.log('[credits] no user ID, skipping API call');
    }
    return true;
  }, [credits]);

  const addCredits = useCallback((amount: number, syncWithServer = true) => {
    if (amount <= 0) return;
    const newCredits = credits + amount;
    setCredits(newCredits);
    if (!syncWithServer) return;
    const uid = userIdRef.current;
    if (uid) {
      updateUserCredits(uid, amount, 'credit_purchase').then(async () => {
        const fresh = await getAstrovaUserById(uid);
        if (mountedRef.current && fresh && typeof fresh.credits === 'number') {
          setCredits(fresh.credits);
        }
      }).catch((err) => {
        console.error('[credits] add sync failed:', err);
        if (mountedRef.current) {
          setCredits(prev => prev - amount);
        }
      });
    }
  }, [credits]);

  return (
    <CreditsContext.Provider value={{ credits, creditCosts, deductCredits, addCredits, showBuyModal, setShowBuyModal }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}

// Credit packages for purchase
export const CREDIT_PACKAGES = [
  { id: 'starter', credits: 20, price: 99, label: 'Starter', popular: false },
  { id: 'basic', credits: 50, price: 199, label: 'Basic', popular: true },
  { id: 'pro', credits: 120, price: 399, label: 'Pro', popular: false },
  { id: 'unlimited', credits: 300, price: 799, label: 'Unlimited', popular: false },
];

// Fallback credit costs (overridden by admin config at runtime)
export const CREDIT_COSTS = {
  AI_MESSAGE: 2,
  CHART_GENERATION: 1,
  MATCHING: 3,
};

export function CreditsDisplay({ compact = false }: { compact?: boolean }) {
  const { credits, setShowBuyModal } = useCredits();

  return (
    <button
      onClick={() => setShowBuyModal(true)}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 hover:from-amber-500/30 hover:to-yellow-500/30 transition-all ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <Coins className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-400`} />
      <span className="font-semibold text-amber-200">{Number.isFinite(credits) ? credits : 0}</span>
    </button>
  );
}

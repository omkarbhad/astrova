import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { deductUserCredits, getAdminConfig, updateUserCredits, getAstrovaUserById } from '@/lib/api';

interface CreditCosts {
  AI_MESSAGE: number;
  CHART_GENERATION: number;
  MATCHING: number;
}

interface CreditsContextType {
  credits: number;
  creditCosts: CreditCosts;
  deductCredits: (amount: number, action?: string) => boolean;
  addCredits: (amount: number) => void;
  showBuyModal: boolean;
  setShowBuyModal: (show: boolean) => void;
}

const CreditsContext = createContext<CreditsContextType | null>(null);
const CREDITS_STORAGE_KEY = 'astrova_dakshina_credits';
const INITIAL_CREDITS = 20;

const DEFAULT_CREDIT_COSTS: CreditCosts = {
  AI_MESSAGE: 1,
  CHART_GENERATION: 0,
  MATCHING: 0,
};

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { astrovaUser, isSignedIn } = useAuth();
  const [credits, setCredits] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(CREDITS_STORAGE_KEY);
      return stored ? parseInt(stored, 10) : INITIAL_CREDITS;
    } catch {
      return INITIAL_CREDITS;
    }
  });
  const [creditCosts, setCreditCosts] = useState<CreditCosts>(DEFAULT_CREDIT_COSTS);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Fetch credit costs from admin config (wait for auth)
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const costs = await getAdminConfig('credit_costs');
        if (costs && typeof costs === 'object') {
          const c = costs as Record<string, number>;
          setCreditCosts({
            AI_MESSAGE: c.ai_message ?? DEFAULT_CREDIT_COSTS.AI_MESSAGE,
            CHART_GENERATION: c.chart_generation ?? DEFAULT_CREDIT_COSTS.CHART_GENERATION,
            MATCHING: c.matching ?? DEFAULT_CREDIT_COSTS.MATCHING,
          });
        }
      } catch { /* use defaults */ }
    })();
  }, [isSignedIn]);

  // Sync credits from DB user on login, reset on sign-out
  useEffect(() => {
    if (astrovaUser) {
      setCredits(astrovaUser.credits);
      localStorage.setItem(CREDITS_STORAGE_KEY, astrovaUser.credits.toString());
    } else {
      setCredits(INITIAL_CREDITS);
      localStorage.removeItem(CREDITS_STORAGE_KEY);
    }
  }, [astrovaUser?.id, astrovaUser?.credits]);

  useEffect(() => {
    localStorage.setItem(CREDITS_STORAGE_KEY, credits.toString());
  }, [credits]);

  const deductCredits = useCallback((amount: number, action?: string): boolean => {
    if (amount <= 0) return true;
    if (credits < amount) {
      setShowBuyModal(true);
      return false;
    }
    const newCredits = credits - amount;
    setCredits(newCredits);
    localStorage.setItem(CREDITS_STORAGE_KEY, newCredits.toString());
    // Deduct in DB and re-sync actual balance
    if (astrovaUser?.id) {
      deductUserCredits(astrovaUser.id, amount, action || 'ai_message').then(async () => {
        const fresh = await getAstrovaUserById(astrovaUser.id);
        if (fresh && typeof fresh.credits === 'number') {
          setCredits(fresh.credits);
          localStorage.setItem(CREDITS_STORAGE_KEY, fresh.credits.toString());
        }
      }).catch(() => {});
    }
    return true;
  }, [credits, astrovaUser?.id]);

  const addCredits = useCallback((amount: number) => {
    const newCredits = credits + amount;
    setCredits(newCredits);
    localStorage.setItem(CREDITS_STORAGE_KEY, newCredits.toString());
    // Sync to DB and re-fetch actual balance
    if (astrovaUser?.id) {
      updateUserCredits(astrovaUser.id, amount, 'credit_purchase').then(async () => {
        const fresh = await getAstrovaUserById(astrovaUser.id);
        if (fresh && typeof fresh.credits === 'number') {
          setCredits(fresh.credits);
          localStorage.setItem(CREDITS_STORAGE_KEY, fresh.credits.toString());
        }
      }).catch(() => {});
    }
  }, [credits, astrovaUser?.id]);

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
  AI_MESSAGE: 1,
  CHART_GENERATION: 0,
  MATCHING: 0,
};

export function CreditsDisplay({ compact = false }: { compact?: boolean }) {
  const { credits, setShowBuyModal } = useCredits();

  return (
    <button
      onClick={() => setShowBuyModal(true)}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 hover:from-amber-500/30 hover:to-yellow-500/30 transition-all ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <Coins className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-400`} />
      <span className="font-semibold text-amber-200">{credits}</span>
    </button>
  );
}

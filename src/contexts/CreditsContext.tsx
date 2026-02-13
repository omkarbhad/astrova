import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Coins } from 'lucide-react';

interface CreditsContextType {
  credits: number;
  deductCredits: (amount: number) => boolean;
  addCredits: (amount: number) => void;
  showBuyModal: boolean;
  setShowBuyModal: (show: boolean) => void;
}

const CreditsContext = createContext<CreditsContextType | null>(null);
const CREDITS_STORAGE_KEY = 'astrova_dakshina_credits';
const INITIAL_CREDITS = 20;

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(CREDITS_STORAGE_KEY);
      return stored ? parseInt(stored, 10) : INITIAL_CREDITS;
    } catch {
      return INITIAL_CREDITS;
    }
  });
  const [showBuyModal, setShowBuyModal] = useState(false);

  useEffect(() => {
    localStorage.setItem(CREDITS_STORAGE_KEY, credits.toString());
  }, [credits]);

  const deductCredits = useCallback((amount: number): boolean => {
    if (credits < amount) {
      setShowBuyModal(true);
      return false;
    }
    setCredits(prev => prev - amount);
    return true;
  }, [credits]);

  const addCredits = useCallback((amount: number) => {
    setCredits(prev => prev + amount);
  }, []);

  return (
    <CreditsContext.Provider value={{ credits, deductCredits, addCredits, showBuyModal, setShowBuyModal }}>
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

// Credit cost per action
export const CREDIT_COSTS = {
  AI_MESSAGE: 1,
  CHART_ANALYSIS: 2,
  DETAILED_READING: 5,
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
      <span className="text-amber-400/70 text-xs">Dakshina</span>
    </button>
  );
}

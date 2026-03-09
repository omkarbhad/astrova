import { useEffect, useRef, useState } from 'react';
import { Coins, Check, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useCredits, CREDIT_PACKAGES } from '@/contexts/CreditsContext';

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BuyCreditsModal({ isOpen, onClose }: BuyCreditsModalProps) {
  const { addCredits, credits } = useCredits();
  const [purchased, setPurchased] = useState<{ credits: number } | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const purchaseTimeoutRef = useRef<number | null>(null);

  const handlePurchase = (pkg: typeof CREDIT_PACKAGES[0]) => {
    if (isPurchasing) return;
    setIsPurchasing(true);
    addCredits(pkg.credits);
    setPurchased({ credits: pkg.credits });
    purchaseTimeoutRef.current = window.setTimeout(() => {
      setPurchased(null);
      setIsPurchasing(false);
      onClose();
    }, 1200);
  };

  useEffect(() => {
    if (!isOpen) {
      setPurchased(null);
      setIsPurchasing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (purchaseTimeoutRef.current) {
        window.clearTimeout(purchaseTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="z-[90] sm:max-w-md bg-[linear-gradient(160deg,rgba(12,9,6,0.94),rgba(22,14,8,0.9))] border-amber-500/20 text-white shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Coins className="w-5 h-5 text-amber-400" />
            Buy Dakshina Credits
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="text-center mb-4">
            <p className="text-sm text-neutral-400">Current Balance</p>
            <p className="text-3xl font-bold text-amber-400 flex items-center justify-center gap-2">
              <Coins className="w-6 h-6" />
              {Number.isFinite(credits) ? credits : 0}
            </p>
          </div>

          {purchased && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-amber-300" />
              </div>
              <p className="text-lg font-bold text-white">+{purchased.credits} Credits Added!</p>
              <p className="text-sm text-neutral-400 mt-1">Your balance has been updated</p>
            </div>
          )}

          {!purchased && <div className="grid gap-3" role="list" aria-label="Credit packages">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                disabled={isPurchasing}
                className={`relative w-full p-4 rounded-xl border transition-all text-left hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:outline-none ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-amber-500/12 to-yellow-500/10 border-amber-500/50 hover:border-amber-500'
                    : 'bg-[hsl(24,16%,8%)] border-amber-500/20 hover:border-amber-500/35'
                } ${isPurchasing ? 'opacity-70 cursor-not-allowed' : ''}`}
                aria-label={`Buy ${pkg.credits} credits for rupees ${pkg.price}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-amber-500 rounded-full text-[10px] font-bold text-black flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Best Value
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{pkg.label}</p>
                    <p className="text-sm text-neutral-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      {pkg.credits} credits
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">₹{pkg.price}</p>
                    <p className="text-xs text-neutral-400">₹{(pkg.price / pkg.credits).toFixed(1)}/credit</p>
                  </div>
                </div>
              </button>
            ))}
          </div>}

          {!purchased && <div className="mt-4 pt-4 border-t border-amber-500/20">
            <div className="flex items-start gap-2 text-xs text-neutral-400">
              <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                Credits never expire. Use them for AI readings, chart analysis, and detailed interpretations.
              </p>
            </div>
          </div>}

          {isPurchasing && !purchased && (
            <p className="mt-3 text-center text-xs text-amber-300">Processing your purchase…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

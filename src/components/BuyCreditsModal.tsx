import { useState } from 'react';
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

  const handlePurchase = (pkg: typeof CREDIT_PACKAGES[0]) => {
    addCredits(pkg.credits);
    setPurchased({ credits: pkg.credits });
    setTimeout(() => { setPurchased(null); onClose(); }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[hsl(220,10%,8%)] border-[hsl(220,8%,18%)] text-white">
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
              {credits}
            </p>
          </div>

          {purchased && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-white">+{purchased.credits} Credits Added!</p>
              <p className="text-sm text-neutral-400 mt-1">Your balance has been updated</p>
            </div>
          )}

          {!purchased && <div className="grid gap-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                className={`relative w-full p-4 rounded-xl border transition-all text-left hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/50 hover:border-amber-500'
                    : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600'
                }`}
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
                    <p className="text-xs text-neutral-500">₹{(pkg.price / pkg.credits).toFixed(1)}/credit</p>
                  </div>
                </div>
              </button>
            ))}
          </div>}

          {!purchased && <div className="mt-4 pt-4 border-t border-neutral-800">
            <div className="flex items-start gap-2 text-xs text-neutral-400">
              <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <p>
                Credits never expire. Use them for AI readings, chart analysis, and detailed interpretations.
              </p>
            </div>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

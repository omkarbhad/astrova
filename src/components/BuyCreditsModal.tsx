import { useEffect, useRef, useState } from 'react';
import { Coins, Check, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useCredits } from '@/contexts/CreditsContext';
import { claimFreeCredits } from '@/lib/api';

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FREE_CREDITS = 20;

export function BuyCreditsModal({ isOpen, onClose }: BuyCreditsModalProps) {
  const { credits, addCredits } = useCredits();
  const [claimed, setClaimed] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const handleClaimFree = async () => {
    if (isClaiming || claimed) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const res = await claimFreeCredits();
      if (res?.ok) {
        addCredits(FREE_CREDITS, false);
        setClaimed(true);
        timeoutRef.current = window.setTimeout(() => {
          setIsClaiming(false);
          onClose();
        }, 1400);
      } else {
        setAlreadyClaimed(true);
        setIsClaiming(false);
      }
    } catch {
      setClaimError('Could not claim credits. Try again later.');
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setClaimed(false);
      setAlreadyClaimed(false);
      setIsClaiming(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="z-[90] sm:max-w-md bg-[linear-gradient(160deg,rgba(12,9,6,0.94),rgba(22,14,8,0.9))] border-amber-500/20 text-white shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Coins className="w-5 h-5 text-amber-400" />
            Dakshina Credits
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="text-center mb-5">
            <p className="text-sm text-neutral-400">Current Balance</p>
            <p className="text-3xl font-bold text-amber-400 flex items-center justify-center gap-2">
              <Coins className="w-6 h-6" />
              {Number.isFinite(credits) ? credits : 0}
            </p>
          </div>

          {claimed ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-amber-300" />
              </div>
              <p className="text-lg font-bold text-white">+{FREE_CREDITS} Credits Added!</p>
              <p className="text-sm text-neutral-400 mt-1">Your balance has been updated</p>
            </div>
          ) : alreadyClaimed ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-zinc-700/40 border border-zinc-600/40 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-zinc-400" />
              </div>
              <p className="text-lg font-bold text-white">Already Claimed</p>
              <p className="text-sm text-neutral-400 mt-1">You've already claimed your free credits.</p>
            </div>
          ) : (
            <>
              {/* Payment coming soon notice */}
              <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-4">
                <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-200">Payment system coming soon</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Paid plans are not available yet. Claim your free credits below to explore Astrova.
                  </p>
                </div>
              </div>

              {/* Free credits CTA */}
              <button
                onClick={handleClaimFree}
                disabled={isClaiming}
                className="w-full p-4 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/12 to-yellow-500/10 hover:border-amber-500 hover:scale-[1.02] transition-all text-left focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">Free Starter Credits</p>
                    <p className="text-sm text-neutral-400 flex items-center gap-1 mt-0.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      {FREE_CREDITS} credits · No payment required
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold">
                    Claim
                  </span>
                </div>
              </button>

              {claimError && (
                <p className="mt-2 text-xs text-red-400 text-center">{claimError}</p>
              )}
              <p className="mt-4 text-xs text-neutral-500 text-center">
                Credits are used for AI readings, chart analysis, and interpretations.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

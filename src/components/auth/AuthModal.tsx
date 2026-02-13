import { SignIn } from '@clerk/clerk-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10">
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-neutral-900 border border-neutral-700/50 shadow-2xl',
            },
          }}
        />
      </div>
    </div>
  );
}

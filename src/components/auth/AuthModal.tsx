import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 bg-neutral-900 border border-neutral-700/50 shadow-2xl rounded-xl p-6 max-w-sm w-full text-center">
        <h2 className="text-white font-semibold text-lg mb-2">Sign In Required</h2>
        <p className="text-neutral-400 text-sm mb-4">Please sign in to continue.</p>
        <button
          onClick={() => { onClose(); navigate('/login'); }}
          className="w-full bg-white text-black font-medium py-2 rounded-lg hover:bg-neutral-200 transition-colors text-sm"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}

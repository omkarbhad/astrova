import { Button } from './ui/button';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function AlertDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'OK', 
  cancelText = 'Cancel' 
}: AlertDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-sm mx-4 w-full">
        <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
        <p className="text-neutral-500 mb-6">{message}</p>
        <div className="flex gap-3">
          {onCancel && (
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1"
            >
              {cancelText}
            </Button>
          )}
          <Button
            onClick={onConfirm || onCancel}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

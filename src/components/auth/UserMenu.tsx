import { UserButton, useUser } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';

export function UserMenu() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <Loader2 className="w-5 h-5 animate-spin text-white/40" />;
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: 'w-8 h-8',
          userButtonPopoverCard: 'bg-neutral-900 border border-neutral-700/50',
        },
      }}
    />
  );
}

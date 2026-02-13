import { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface AdBlockProps {
  type?: 'banner' | 'sidebar' | 'footer';
  className?: string;
  dismissible?: boolean;
}

export function AdBlock({ 
  type = 'banner', 
  className = '',
  dismissible = true 
}: AdBlockProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const adContent = {
    banner: {
      title: "Premium Kundali Features",
      description: "Unlock detailed predictions, remedies, and personalized consultations",
      cta: "Upgrade Now",
      bgColor: "bg-gradient-to-r from-purple-600/20 to-blue-600/20",
      borderColor: "border-purple-500/30"
    },
    sidebar: {
      title: "Astrology Consultation",
      description: "Get personalized readings from expert astrologers",
      cta: "Book Session",
      bgColor: "bg-gradient-to-b from-orange-600/20 to-red-600/20",
      borderColor: "border-orange-500/30"
    },
    footer: {
      title: "Vedic Astrology Course",
      description: "Learn the ancient science of Jyotish from certified practitioners",
      cta: "Start Learning",
      bgColor: "bg-gradient-to-r from-green-600/20 to-teal-600/20",
      borderColor: "border-green-500/30"
    }
  };

  const content = adContent[type];

  const baseClasses = `
    ${content.bgColor} 
    ${content.borderColor} 
    border 
    rounded-lg 
    p-4 
    relative
    transition-all
    duration-300
    hover:shadow-lg
    ${className}
  `;

  return (
    <div className={baseClasses}>
      {dismissible && (
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full bg-neutral-900/50 hover:bg-neutral-900/70 transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-3 h-3 text-neutral-500" />
        </button>
      )}
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white mb-1">{content.title}</h3>
          <p className="text-xs text-neutral-500">{content.description}</p>
        </div>
        
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-md text-primary text-xs font-medium transition-colors">
          {content.cta}
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      
      <div className="mt-2 text-[10px] text-neutral-500/50 text-center">
        Sponsored
      </div>
    </div>
  );
}


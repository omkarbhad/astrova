import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LandingHeader = () => {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
            isScrolled 
                ? "bg-[linear-gradient(180deg,rgba(20,13,7,0.96),rgba(13,9,5,0.94))] backdrop-blur-md border-b border-amber-500/20" 
                : "bg-transparent"
        )}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <img src="/astrova_logo.png" alt="Astrova" className="w-6 h-6" />
                        <span className="text-sm font-semibold text-white">Astrova</span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm text-neutral-400 hover:text-amber-200 transition-colors">
                            Features
                        </a>
                        <a href="#pricing" className="text-sm text-neutral-400 hover:text-amber-200 transition-colors">
                            Pricing
                        </a>
                        <a href="#reviews" className="text-sm text-neutral-400 hover:text-amber-200 transition-colors">
                            Reviews
                        </a>
                    </nav>

                    {/* CTA Buttons */}
                    <div className="flex items-center gap-3">
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-neutral-400 hover:text-amber-200 hover:bg-amber-500/10"
                        >
                            <Link to="/login">Login</Link>
                        </Button>
                        <Button asChild size="sm" className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500">
                            <Link to="/register">Get Started</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export { LandingHeader };

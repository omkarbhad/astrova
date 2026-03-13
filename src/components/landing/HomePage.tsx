import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UserIcon, Settings, Zap, DollarSign, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from './global/container';
import { Wrapper } from './global/wrapper';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Marquee from './ui/marquee';
import { StarsBackground, CosmicOrbs } from './ui/stars-background';
import { features, perks, pricingCards, reviews } from './constants';

const HomePage = () => {
    const { isSignedIn, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const firstRow = reviews.slice(0, reviews.length / 2);
    const secondRow = reviews.slice(reviews.length / 2);

    const handleLogin = async () => {
        if (isSignedIn) { navigate('/chart'); return; }
        const result = await signInWithGoogle();
        if (!result.error) navigate('/chart');
    };

    return (
        <div className="min-h-screen bg-[hsl(24,16%,6%)]">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-[hsl(24,20%,10%)] focus:text-white focus:rounded-md">
                Skip to content
            </a>
            {/* Header */}
            <Header onLogin={handleLogin} />
            
            <section id="main-content" className="w-full relative flex items-center justify-center flex-col px-4 sm:px-6 md:px-8 py-8 sm:py-10 lg:py-12 min-h-screen">
                {/* Cosmic Background */}
                <StarsBackground />
                <CosmicOrbs />
                
                {/* Main gradient overlay */}
                <div className="fixed inset-0 bg-[hsl(24,16%,6%)] -z-20" />
                <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.08),transparent)] -z-10" />
                
                {/* Subtle cosmic glow orbs - Warm amber */}
                <div className="fixed inset-0 pointer-events-none -z-30">
                    <div className="absolute top-[40%] left-1/2 w-3/4 -translate-x-1/2 h-1/4 md:h-1/3 inset-0 bg-gradient-to-r from-amber-600/12 to-amber-400/6 blur-[5rem] animate-image-glow" />
                    <div className="absolute top-[30%] left-1/4 w-96 h-96 bg-amber-600/8 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute top-[50%] right-1/4 w-72 h-72 bg-orange-600/6 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-[70%] left-1/3 w-80 h-80 bg-amber-500/5 rounded-full blur-[110px] animate-pulse" style={{ animationDelay: '1.5s' }} />
                </div>

                {/* hero */}
                <Wrapper>
                    <Container>
                        <div className="flex flex-col items-center justify-center py-10 sm:py-14 md:py-16 lg:py-20 h-full relative">
                            <div className="flex flex-col items-center max-w-3xl w-full">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium text-center leading-tight tracking-tight">
                                    <span className="bg-gradient-to-b from-white via-white to-neutral-400 bg-clip-text text-transparent">Discover Your Cosmic Destiny</span>
                                    <br />
                                    <span className="bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 bg-clip-text text-transparent">with Ancient Vedic Wisdom</span>
                                </h1>
                                <p className="text-neutral-400 mt-3 sm:mt-4 text-center text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                                    Generate accurate kundali birth charts and unlock insights into your life's journey.
                                </p>
                                <div className="flex flex-row items-center justify-center mt-6 sm:mt-8 gap-4">
                                    <Button onClick={handleLogin} className="h-10 px-6 bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-medium hover:from-amber-500 hover:to-yellow-500 transition-colors" aria-label="Create account and get started">
                                        Get Started
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                    <Button onClick={handleLogin} className="h-10 px-6 bg-transparent border border-amber-500/30 text-amber-100 font-medium hover:bg-amber-500/10 hover:border-amber-500/45 transition-all" aria-label="Log into Astrova">
                                        Login
                                    </Button>
                                </div>
                            </div>

                            <div className="relative flex items-center py-8 sm:py-12 md:py-16 w-full">
                                {/* Glow underneath the image - Linkify style */}
                                <div className="absolute top-[10%] left-1/2 w-3/4 -translate-x-1/2 h-1/4 md:h-1/3 inset-0 bg-gradient-to-r from-amber-500/15 to-orange-500/10 blur-[5rem] animate-image-glow" />
                                <div className="absolute top-1/2 left-1/2 -z-10 w-full h-full -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-600/5 to-yellow-600/5 rounded-full blur-[150px]" />
                                <div className="relative group w-full max-w-6xl mx-auto">
                                    <div className="-m-2 rounded-lg p-2 ring-1 ring-inset ring-amber-500/20 lg:-m-4 lg:rounded-xl bg-opacity-50 backdrop-blur-3xl">
                                        <div 
                                            style={{
                                                "--size": 80,
                                                "--duration": 12,
                                                "--anchor": 90,
                                                "--border-width": 2,
                                                "--color-from": "#f59e0b",
                                                "--color-to": "#ea580c",
                                                "--delay": "-9s"
                                            } as React.CSSProperties}
                                            className="absolute inset-[0] rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent] ![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)] after:content-[''] after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:[animation:border-beam_calc(var(--duration)*1s)_infinite_linear] after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]"
                                        ></div>
                                        <div className="relative rounded-lg overflow-hidden">
                                            <img
                                                src="/image1.png"
                                                alt="Your Kundali Chart Will Appear Here"
                                                className="w-full h-auto object-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="absolute -bottom-4 inset-x-0 w-full h-1/2 bg-gradient-to-t from-[hsl(24,16%,6%)] z-40"></div>
                                        <div className="absolute bottom-0 md:-bottom-8 inset-x-0 w-full h-1/4 bg-gradient-to-t from-[hsl(24,16%,6%)] z-50"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Container>
                </Wrapper>

                {/* how it works */}
                <Wrapper className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-20 relative">
                    <Container>
                        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
                            <div className="flex flex-col items-center gap-2">
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-[hsl(32.1,94.6%,43.7%)] to-[hsl(32.1,94.6%,33%)] border border-amber-600/50 opacity-90">
                                    <Settings className="w-3 h-3 text-white mr-1" />
                                    <span className="text-xs font-medium text-white">Process</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white via-white to-neutral-400 bg-clip-text text-transparent tracking-tight">
                                    Get your kundali in minutes
                                </h2>
                            </div>
                            <p className="text-neutral-400 mt-4 text-sm max-w-md mx-auto leading-relaxed">
                                Enter your birth details, generate your chart, and explore your insights.
                            </p>
                        </div>
                    </Container>
                    <Container>
                        <div className="grid grid-cols-1 sm:grid-cols-3 w-full gap-4 sm:gap-6">
                            {perks.map((perk, index) => (
                                <Card key={perk.title} className="group bg-[hsl(24,16%,8%)]/70 border border-amber-500/15 hover:border-amber-500/30 hover:bg-[hsl(24,18%,10%)] transition-all duration-300">
                                    <CardHeader className="pb-2">
                                        <div className="flex flex-col items-start gap-3">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 group-hover:border-amber-500/35 transition-colors">
                                                <perk.icon className="w-5 h-5 text-amber-300 group-hover:text-amber-200 transition-colors" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono text-neutral-600">0{index + 1}</span>
                                                <CardTitle className="text-sm font-medium text-white">{perk.title}</CardTitle>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <CardDescription className="text-sm text-neutral-500 leading-relaxed">
                                            {perk.info}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </Container>
                </Wrapper>

                {/* features */}
                <Wrapper id="features" className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-20 relative">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.03),transparent)] -z-10" />
                    <Container>
                        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
                            <div className="flex flex-col items-center gap-2">
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-[hsl(32.1,94.6%,43.7%)] to-[hsl(32.1,94.6%,33%)] border border-amber-600/50 opacity-90">
                                    <Zap className="w-3 h-3 text-white mr-1" />
                                    <span className="text-xs font-medium text-white">Features</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white via-white to-neutral-400 bg-clip-text text-transparent tracking-tight">
                                    Powerful features for you
                                </h2>
                            </div>
                            <p className="text-neutral-400 mt-4 text-sm max-w-md mx-auto leading-relaxed">
                                Everything you need for accurate kundali charts
                            </p>
                        </div>
                    </Container>
                    <Container>
                        <div className="grid grid-cols-2 sm:grid-cols-3 w-full gap-3 sm:gap-4 md:gap-6">
                            {features.map((feature) => (
                                <Card key={feature.title} className="group bg-[hsl(24,16%,8%)]/70 border border-amber-500/15 hover:border-amber-500/30 hover:bg-[hsl(24,18%,10%)] transition-all duration-300">
                                    <CardHeader className="pb-2">
                                        <div className="flex flex-col items-center text-center gap-3">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 group-hover:border-amber-500/35 transition-colors">
                                                <feature.icon className="w-5 h-5 text-amber-300 group-hover:text-amber-200 transition-colors" />
                                            </div>
                                            <CardTitle className="text-sm font-medium text-white group-hover:text-amber-100 transition-colors">{feature.title}</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0 text-center">
                                        <CardDescription className="text-sm text-neutral-500 leading-relaxed line-clamp-2">
                                            {feature.info}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </Container>
                </Wrapper>

                {/* pricing */}
                <Wrapper id="pricing" className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-20 relative">
                    <Container>
                        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
                            <div className="flex flex-col items-center gap-2">
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-[hsl(32.1,94.6%,43.7%)] to-[hsl(32.1,94.6%,33%)] border border-amber-600/50 opacity-90">
                                    <DollarSign className="w-3 h-3 text-white mr-1" />
                                    <span className="text-xs font-medium text-white">Pricing</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white via-white to-neutral-400 bg-clip-text text-transparent tracking-tight">
                                    Simple, transparent pricing
                                </h2>
                            </div>
                            <p className="text-neutral-400 mt-4 text-sm max-w-md mx-auto leading-relaxed">
                                Choose the best plan for your journey
                            </p>
                        </div>
                    </Container>
                    <Container className="flex items-center justify-center">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl">
                            {pricingCards.map((card) => (
                                <Card key={card.title} className={cn(
                                    "group bg-[hsl(24,16%,8%)]/80 relative overflow-visible border border-amber-500/20 hover:border-amber-500/35 hover:bg-[hsl(24,18%,10%)] transition-all duration-200 flex flex-col w-full",
                                    card.title === "Premium" && "border-amber-500/35 bg-[hsl(24,18%,10%)]"
                                )}>
                                    {card.title === "Premium" && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="text-[10px] font-medium bg-amber-500 text-black px-3 py-1 rounded-full">Popular</span>
                                        </div>
                                    )}
                                    <CardHeader className={cn("text-center pt-4 sm:pt-5", card.title === "Premium" && "pt-6 sm:pt-7")}>
                                        <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{card.title}</CardTitle>
                                        <div className="mt-3">
                                            <span className="text-3xl sm:text-4xl font-semibold text-white">{card.price}</span>
                                            {card.duration && <span className="text-sm text-neutral-500">/{card.duration}</span>}
                                        </div>
                                        <CardDescription className="mt-2 text-sm text-neutral-500">{card.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4 flex-1">
                                        <div className="space-y-3">
                                            {card.features.map((feature) => (
                                                <div key={feature} className="flex items-center gap-3">
                                                    <svg className="w-4 h-4 text-neutral-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="text-sm text-neutral-400">{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-4">
                                        <Button 
                                            className={cn(
                                                "w-full h-10 text-sm font-medium transition-all duration-200",
                                                card.title === "Premium" 
                                                    ? "bg-gradient-to-r from-amber-600 to-yellow-600 text-white hover:from-amber-500 hover:to-yellow-500" 
                                                    : "bg-transparent border border-amber-500/30 text-amber-100 hover:bg-amber-500/10 hover:border-amber-500/45"
                                            )}
                                            aria-label={`${card.buttonText} ${card.title} plan`}
                                        >
                                            {card.buttonText}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </Container>
                </Wrapper>

                {/* testimonials */}
                <Wrapper id="testimonials" className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-20 relative">
                    <Container>
                        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
                            <div className="flex flex-col items-center gap-2">
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-[hsl(32.1,94.6%,43.7%)] to-[hsl(32.1,94.6%,33%)] border border-amber-600/50 opacity-90">
                                    <MessageSquare className="w-3 h-3 text-white mr-1" />
                                    <span className="text-xs font-medium text-white">Testimonials</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white via-white to-neutral-400 bg-clip-text text-transparent tracking-tight">
                                    What people are saying
                                </h2>
                            </div>
                            <p className="text-neutral-400 mt-4 text-sm max-w-md mx-auto leading-relaxed">
                                See how Astrova helps astrology enthusiasts
                            </p>
                        </div>
                    </Container>
                    <Container>
                        <div className="w-full">
                            <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden py-4">
                                <div className="flex items-start justify-start w-full mb-4">
                                    <Marquee reverse pauseOnHover className="[--duration:30s] select-none">
                                        {firstRow.map((review, idx) => (
                                            <Card key={`${review.name}-${idx}`} className="w-72 sm:w-80 mx-2 bg-[hsl(24,16%,8%)]/70 border border-amber-500/15 hover:border-amber-500/30 hover:bg-[hsl(24,18%,10%)] transition-all duration-300">
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                            <UserIcon className="w-4 h-4 text-amber-300" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-sm font-medium text-white">{review.name}</CardTitle>
                                                            <CardDescription className="text-xs text-neutral-500">{review.username}</CardDescription>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-sm text-neutral-400 leading-relaxed">"{review.body}"</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Marquee>
                                </div>
                                <div className="flex items-start justify-start w-full">
                                    <Marquee pauseOnHover className="[--duration:30s] select-none">
                                        {secondRow.map((review, idx) => (
                                            <Card key={`${review.name}-${idx}`} className="w-72 sm:w-80 mx-2 bg-[hsl(24,16%,8%)]/70 border border-amber-500/15 hover:border-amber-500/30 hover:bg-[hsl(24,18%,10%)] transition-all duration-300">
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                            <UserIcon className="w-4 h-4 text-amber-300" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-sm font-medium text-white">{review.name}</CardTitle>
                                                            <CardDescription className="text-xs text-neutral-500">{review.username}</CardDescription>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-sm text-neutral-400 leading-relaxed">"{review.body}"</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Marquee>
                                </div>
                                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-[hsl(24,16%,6%)]"></div>
                                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-[hsl(24,16%,6%)]"></div>
                            </div>
                        </div>
                    </Container>
                </Wrapper>

                {/* CTA Section */}
                <Wrapper className="flex flex-col items-center justify-center py-16 sm:py-20 md:py-24 relative">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(245,158,11,0.06),transparent)] -z-10" />
                    <Container>
                        <div className="max-w-2xl mx-auto text-center">
                            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground tracking-tight leading-tight">
                                Ready to discover your<br />
                                <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 bg-clip-text text-transparent">cosmic destiny?</span>
                            </h2>
                            <p className="text-muted-foreground mt-4 sm:mt-6 text-base sm:text-lg max-w-lg mx-auto">
                                Generate accurate kundali charts and unlock insights into your life's journey
                            </p>
                            <div className="flex flex-row items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
                                <Link to="/chart">
                                    <Button size="lg" className="h-10 sm:h-11 px-6 sm:px-8" aria-label="Open chart generation page">
                                        Get Started Free
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                                <a href="mailto:support@astrova.app?subject=Astrova%20Sales%20Inquiry" className="inline-flex">
                                    <Button variant="outline" size="lg" className="h-10 sm:h-11 px-6 sm:px-8" aria-label="Contact sales via email">
                                        Contact Sales
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </Container>
                </Wrapper>
            </section>

            {/* Footer */}
            <Footer />
        </div>
    );
};

// Header component
function Header({ onLogin }: { onLogin: () => void }) {
    const [scrolled, setScrolled] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 20;
            setScrolled(isScrolled);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={`sticky top-0 z-50 w-full transition-all duration-500 ease-in-out ${
            scrolled 
                ? 'bg-[linear-gradient(180deg,rgba(20,13,7,0.96),rgba(13,9,5,0.94))] backdrop-blur-xl shadow-lg opacity-100 border-b border-amber-500/20' 
                : 'bg-transparent opacity-100'
        }`}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex h-14 items-center justify-between">
                    {/* Logo/Title */}
                    <Link to="/" className="flex items-center gap-2">
                        <img 
                            src="/astrova_logo.png" 
                            alt="Astrova Logo" 
                            className="w-7 h-7 transition-opacity duration-500"
                        />
                        <span className={`text-sm font-semibold transition-all duration-500 ${
                            scrolled ? 'text-white opacity-100' : 'text-white opacity-90'
                        }`}>Astrova</span>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex items-center gap-6" aria-label="Homepage sections">
                        <a href="#features" className={`text-sm transition-all duration-500 ${
                            scrolled ? 'text-neutral-400 hover:text-amber-200 opacity-100' : 'text-neutral-300 hover:text-amber-200 opacity-80'
                        }`}>
                            Features
                        </a>
                        <a href="#pricing" className={`text-sm transition-all duration-500 ${
                            scrolled ? 'text-neutral-400 hover:text-amber-200 opacity-100' : 'text-neutral-300 hover:text-amber-200 opacity-80'
                        }`}>
                            Pricing
                        </a>
                        <a href="#testimonials" className={`text-sm transition-all duration-500 ${
                            scrolled ? 'text-neutral-400 hover:text-amber-200 opacity-100' : 'text-neutral-300 hover:text-amber-200 opacity-80'
                        }`}>
                            Testimonials
                        </a>
                    </nav>

                    {/* CTA Buttons */}
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={onLogin} aria-label="Log in" className={`transition-all duration-500 h-8 px-3 text-sm ${
                            scrolled
                                ? 'text-neutral-300 hover:text-amber-200 hover:bg-amber-500/10 opacity-100'
                                : 'text-neutral-300 hover:text-amber-200 hover:bg-amber-500/10 opacity-90'
                        }`}>
                            Log in
                        </Button>
                        <Button size="sm" onClick={onLogin} aria-label="Get started" className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white h-8 px-4 text-sm font-medium rounded-lg transition-all duration-500 opacity-100">
                            Get Started
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}

// Footer component (exact copy from homepage)
function Footer() {
    const [newsletterEmail, setNewsletterEmail] = React.useState('');
    const [newsletterNotice, setNewsletterNotice] = React.useState<string | null>(null);

    const handleNewsletterSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const email = newsletterEmail.trim();
        if (!email || !email.includes('@')) {
            setNewsletterNotice('Please enter a valid email address.');
            window.setTimeout(() => setNewsletterNotice(null), 2200);
            return;
        }

        window.location.href = `mailto:support@astrova.app?subject=Newsletter%20Signup&body=Please%20add%20${encodeURIComponent(email)}%20to%20Astrova%20newsletter.`;
        setNewsletterEmail('');
        setNewsletterNotice('Thanks! Your mail app opened for confirmation.');
        window.setTimeout(() => setNewsletterNotice(null), 2600);
    };

    return (
        <footer className="border-t border-amber-500/15 bg-[hsl(24,16%,5%)]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
                {/* Top section with logo and newsletter */}
                <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
                    <div className="max-w-sm">
                        <Link to="/" className="flex items-center gap-2.5 mb-4">
                            <img src="/astrova_logo.png" alt="Astrova" className="w-8 h-8" />
                            <span className="text-base font-semibold text-white">Astrova</span>
                        </Link>
                        <p className="text-sm text-neutral-400 leading-relaxed">
                            Your Modern Astrologer. Precise Vedic calculations, AI-powered readings, Shadbala analysis, Vimshottari Dasha tracking, and Ashtakoot matching — all free.
                        </p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-3">
                        <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Stay Updated</span>
                        <form className="flex gap-2" onSubmit={handleNewsletterSubmit}>
                            <input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} placeholder="your@email.com" aria-label="Newsletter email" className="bg-[hsl(24,18%,9%)] border border-amber-500/20 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/40 w-56" />
                            <Button type="submit" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-sm px-4 py-2 rounded-lg font-medium" aria-label="Subscribe to newsletter">Subscribe</Button>
                        </form>
                        {newsletterNotice && <p className="text-[11px] text-neutral-400">{newsletterNotice}</p>}
                    </div>
                </div>

                {/* Links grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                    <div>
                        <h3 className="text-xs font-semibold text-white mb-4 uppercase tracking-wider">Product</h3>
                        <ul className="space-y-2.5">
                            <li><a href="#features" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Features</a></li>
                            <li><a href="#pricing" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Pricing</a></li>
                            <li><Link to="/chart" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Birth Chart</Link></li>
                            <li><Link to="/match" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Matching</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-white mb-4 uppercase tracking-wider">Features</h3>
                        <ul className="space-y-2.5">
                            <li><Link to="/chart" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">AI Astrologer</Link></li>
                            <li><Link to="/chart" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Shadbala Analysis</Link></li>
                            <li><Link to="/chart" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Dasha Predictions</Link></li>
                            <li><Link to="/chart" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Yoga Detection</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-white mb-4 uppercase tracking-wider">Company</h3>
                        <ul className="space-y-2.5">
                            <li><a href="#features" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">About</a></li>
                            <li><a href="https://astrova.app" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors" target="_blank" rel="noreferrer">Blog</a></li>
                            <li><a href="mailto:support@astrova.app" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-white mb-4 uppercase tracking-wider">Legal</h3>
                        <ul className="space-y-2.5">
                            <li><a href="mailto:support@astrova.app?subject=Privacy%20Policy" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Privacy Policy</a></li>
                            <li><a href="mailto:support@astrova.app?subject=Terms%20of%20Service" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Terms of Service</a></li>
                            <li><a href="mailto:support@astrova.app?subject=Cookie%20Policy" className="text-sm text-neutral-400 hover:text-amber-300 transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="pt-8 border-t border-amber-500/15 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-neutral-500">
                            © {new Date().getFullYear()} Astrova. All rights reserved.
                        </p>
                        <span className="text-neutral-700">·</span>
                        <span className="text-xs text-neutral-600">Made with precision</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Open Astrova on X" className="w-8 h-8 rounded-lg bg-[hsl(24,18%,9%)] border border-amber-500/20 flex items-center justify-center text-neutral-400 hover:text-amber-100 hover:border-amber-500/35 transition-all">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                        </a>
                        <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="Open Astrova on GitHub" className="w-8 h-8 rounded-lg bg-[hsl(24,18%,9%)] border border-amber-500/20 flex items-center justify-center text-neutral-400 hover:text-amber-100 hover:border-amber-500/35 transition-all">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                        <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Open Astrova on Instagram" className="w-8 h-8 rounded-lg bg-[hsl(24,18%,9%)] border border-amber-500/20 flex items-center justify-center text-neutral-400 hover:text-amber-100 hover:border-amber-500/35 transition-all">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default HomePage;

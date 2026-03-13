import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from './global/container';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Marquee from './ui/marquee';
import { StarsBackground, CosmicOrbs } from './ui/stars-background';
import { pricingCards, reviews } from './constants';

// Inject fonts
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
if (!document.querySelector('link[href*="Cormorant+Garamond"]')) {
    document.head.appendChild(fontLink);
}

const serif = "font-['Cormorant_Garamond',serif]";
const mono = "font-['JetBrains_Mono',monospace]";

const HomePage = () => {
    const { isSignedIn, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const firstRow = reviews.slice(0, reviews.length / 2);
    const secondRow = reviews.slice(reviews.length / 2);

    const handleLogin = async () => {
        if (isSignedIn) { navigate('/chart'); return; }
        const { error } = await signInWithGoogle();
        if (!error) navigate('/chart');
    };

    return (
        <div className="min-h-screen bg-[#06020a] font-['DM_Sans',system-ui,sans-serif] text-white selection:bg-purple-500/30 selection:text-white">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-[#0d0a12] focus:text-white focus:rounded-md">
                Skip to content
            </a>

            {/* Grain Texture Overlay */}
            <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.022] mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")` }}
            />

            <Header onLogin={handleLogin} />

            <main id="main-content">
                {/* ── HERO ── */}
                <section className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden text-center px-4 sm:px-6 pt-24 pb-20">
                    <StarsBackground />
                    <CosmicOrbs />

                    {/* Radial glows */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(168,85,247,0.09),transparent_70%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(245,158,11,0.04),transparent_50%)]" />

                    {/* Horizontal light streak */}
                    <div className="absolute top-[45%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

                    <div className="relative z-10 max-w-5xl mx-auto">
                        {/* Badge */}
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/7 mb-8 ${mono} text-[0.7rem] tracking-[0.1em] text-amber-300 uppercase`}
                            style={{ animation: 'fadeUp 0.8s ease-out both' }}>
                            <span className="w-[5px] h-[5px] rounded-full bg-amber-400"
                                style={{ boxShadow: '0 0 8px #f59e0b', animation: 'badgePulse 2s ease-in-out infinite' }} />
                            Vedic · Jyotish · AI-Powered
                        </div>

                        {/* Headline */}
                        <h1
                            className={`${serif} text-[clamp(3.5rem,8vw,7.5rem)] font-semibold leading-[0.93] tracking-[-0.025em] mb-6`}
                            style={{ animation: 'fadeUp 0.8s ease-out 0.1s both' }}
                        >
                            <span className="block text-white">Your Stars,</span>
                            <span className="block italic"
                                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                Decoded
                            </span>
                            <span className="block text-white/50 not-italic font-normal text-[0.52em] tracking-[0.02em] italic mt-2">
                                Ancient Vedic wisdom meets modern intelligence
                            </span>
                        </h1>

                        {/* Sub */}
                        <p className="text-neutral-400 text-base sm:text-lg max-w-[510px] mx-auto leading-[1.75] mb-10"
                            style={{ animation: 'fadeUp 0.8s ease-out 0.2s both' }}>
                            Astrova calculates your precise Vedic birth chart, reveals personality insights, analyses couple compatibility, and lets you ask an AI astrologer anything — anytime.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12"
                            style={{ animation: 'fadeUp 0.8s ease-out 0.3s both' }}>
                            <Button
                                onClick={handleLogin}
                                className="h-12 px-7 text-sm font-semibold text-white border-none rounded-lg transition-all"
                                style={{
                                    background: 'linear-gradient(135deg, #7c3aed, #d97706)',
                                    boxShadow: '0 0 30px rgba(168,85,247,0.3), 0 0 60px rgba(245,158,11,0.1)',
                                }}
                                aria-label="Read your birth chart"
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Read My Chart
                            </Button>
                            <Button
                                onClick={handleLogin}
                                variant="ghost"
                                className="h-12 px-7 text-sm font-medium text-neutral-400 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-lg transition-all"
                                aria-label="Chat with AI Astrologer"
                            >
                                Chat with AI Astrologer
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>

                        {/* Trust */}
                        <p className={`text-[0.75rem] text-neutral-600 tracking-[0.05em]`}
                            style={{ animation: 'fadeUp 0.8s ease-out 0.4s both' }}>
                            Trusted by <span className="text-neutral-400">8,400+</span> seekers · Free birth chart · No credit card
                        </p>
                    </div>

                    {/* Scroll indicator */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                        style={{ animation: 'fadeUp 1s ease-out 1s both' }}>
                        <span className={`${mono} text-[0.65rem] text-neutral-600 tracking-[0.15em] uppercase`}>Explore</span>
                        <div className="w-px h-10 bg-gradient-to-b from-neutral-700 to-transparent"
                            style={{ animation: 'scrollLine 2s ease-in-out infinite' }} />
                    </div>

                    {/* Bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#06020a] to-transparent" />
                </section>

                {/* Section divider */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent via-30%" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), rgba(245,158,11,0.3), transparent)' }} />

                {/* ── FAUX UI SECTION ── */}
                <section className="relative z-10 py-24 px-4 sm:px-6 flex flex-col items-center gap-12">
                    {/* Section label */}
                    <div className={`${mono} text-[0.7rem] tracking-[0.2em] uppercase text-amber-400 flex items-center gap-3`}>
                        <span className="w-8 h-px bg-amber-500/35" />
                        Your Dashboard
                        <span className="w-8 h-px bg-amber-500/35" />
                    </div>

                    <div className="text-center">
                        <h2 className={`${serif} text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.1]`}>
                            Everything the cosmos<br />
                            <em className="not-italic italic"
                                style={{ background: 'linear-gradient(90deg, #a855f7, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontStyle: 'italic' }}>
                                reveals about you
                            </em>
                        </h2>
                        <p className="text-neutral-500 max-w-[460px] mx-auto text-[0.9375rem] mt-4">
                            Your Vedic chart, personality profile, and AI astrologer — all in one place.
                        </p>
                    </div>

                    {/* App frame */}
                    <div className="w-full max-w-[1080px] rounded-2xl overflow-hidden"
                        style={{
                            border: '1px solid rgba(168,85,247,0.18)',
                            boxShadow: '0 0 0 1px rgba(245,158,11,0.04), 0 50px 120px rgba(0,0,0,0.75), 0 0 80px rgba(168,85,247,0.1), 0 0 120px rgba(245,158,11,0.05)',
                            background: '#130e08',
                        }}>

                        {/* Top bar */}
                        <div className="h-[52px] flex items-center px-5 gap-0"
                            style={{ background: '#0e0a05', borderBottom: '1px solid rgba(245,158,11,0.12)' }}>

                            {/* Logo area */}
                            <div className="flex items-center gap-2 min-w-[170px]">
                                <div className="w-7 h-7 rounded-[6px] flex items-center justify-center text-sm flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.4),rgba(245,158,11,0.15))', border: '1px solid rgba(245,158,11,0.3)' }}>
                                    ✦
                                </div>
                                <div>
                                    <div className="text-[0.8rem] font-semibold text-white/90 leading-none">Astrova</div>
                                    <div className="text-[0.58rem] text-white/30">Your Modern Astrologer</div>
                                </div>
                            </div>

                            {/* Center tabs */}
                            <div className="flex gap-1 mx-auto rounded-lg p-[3px]"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[0.72rem] font-medium"
                                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', color: 'rgba(245,158,11,0.9)' }}>
                                    <span className="w-2 h-2 rounded-[2px] bg-current opacity-60" />
                                    Charts
                                </div>
                                <div className="px-3.5 py-1.5 text-[0.72rem] font-medium text-white/35">♡ Matcher</div>
                                <div className="px-3.5 py-1.5 text-[0.72rem] font-medium text-white/35">◎ Info</div>
                            </div>

                            {/* Right icons */}
                            <div className="flex items-center gap-2 min-w-[130px] justify-end">
                                <FauxIconBtn className="text-[0.75rem] font-semibold" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: 'rgba(245,158,11,0.7)' }}>AI</FauxIconBtn>
                                <FauxIconBtn>◯</FauxIconBtn>
                                <div className="w-[30px] h-[30px] rounded-full flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.4),rgba(245,158,11,0.3))', border: '1px solid rgba(255,255,255,0.15)' }} />
                            </div>
                        </div>

                        {/* App body */}
                        <div className="grid min-h-[540px]" style={{ gridTemplateColumns: '1fr 280px' }}>

                            {/* Main panel */}
                            <div className="flex flex-col gap-3.5 p-4"
                                style={{ background: '#100c07', borderRight: '1px solid rgba(245,158,11,0.1)' }}>

                                {/* Birth Details Card */}
                                <div className="rounded-[10px] p-4"
                                    style={{ background: '#1a1208', border: '1px solid rgba(245,158,11,0.18)' }}>

                                    {/* Header */}
                                    <div className="flex items-start gap-3 mb-3.5">
                                        <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-base flex-shrink-0"
                                            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
                                            📅
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[0.875rem] font-semibold text-white/90 mb-1">Birth Details</div>
                                            <SkLine className="h-1.5 w-40" />
                                        </div>
                                        <div className="flex items-center gap-2 ml-auto">
                                            <FauxChip className="gap-1.5" style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)', color: 'rgba(245,158,11,0.8)' }}>
                                                <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: 'rgba(245,158,11,0.8)', boxShadow: '0 0 6px rgba(245,158,11,0.5)' }} />
                                                Hazel
                                            </FauxChip>
                                            <FauxChip>✏</FauxChip>
                                            <FauxChip>Save</FauxChip>
                                            <FauxChip>Delete</FauxChip>
                                        </div>
                                    </div>

                                    <div className="text-[0.62rem] text-white/20 border-t border-white/[0.04] pt-1.5 mb-3.5">
                                        Shortcut: Ctrl/Cmd + S to save · Esc to cancel delete
                                    </div>

                                    {/* Input grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {/* Date */}
                                        <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <FauxInputIcon>📅</FauxInputIcon>
                                                <span className="text-[0.72rem] font-semibold text-white/70">Date</span>
                                                <div className="ml-auto px-2 text-[0.65rem] font-semibold rounded"
                                                    style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)', color: 'rgba(245,158,11,0.9)', height: '18px', display: 'flex', alignItems: 'center' }}>
                                                    16/4/2004
                                                </div>
                                            </div>
                                            <div className="text-[0.6rem] text-white/25 mb-1.5">Birth date</div>
                                            <div className="flex gap-1.5">
                                                <SkDropdown /><SkDropdown /><SkDropdown />
                                            </div>
                                        </div>

                                        {/* Time */}
                                        <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <FauxInputIcon>⏰</FauxInputIcon>
                                                <span className="text-[0.72rem] font-semibold text-white/70">Time</span>
                                                <div className="ml-auto px-2 text-[0.65rem] font-semibold rounded"
                                                    style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)', color: 'rgba(245,158,11,0.9)', height: '18px', display: 'flex', alignItems: 'center' }}>
                                                    07:33:00
                                                </div>
                                            </div>
                                            <div className="text-[0.6rem] text-white/25 mb-1.5">Birth time</div>
                                            <div className="flex gap-1.5">
                                                <SkDropdown /><SkDropdown /><SkDropdown />
                                            </div>
                                        </div>

                                        {/* Location */}
                                        <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <FauxInputIcon>📍</FauxInputIcon>
                                                <span className="text-[0.72rem] font-semibold text-white/70">Location</span>
                                                <div className="ml-auto px-2 text-[0.6rem] font-semibold rounded"
                                                    style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)', color: 'rgba(245,158,11,0.9)', height: '18px', display: 'flex', alignItems: 'center', minWidth: '100px' }}>
                                                    New York, US
                                                </div>
                                            </div>
                                            <div className="text-[0.6rem] text-white/25 mb-1.5">Birth place</div>
                                            <div className="flex items-center gap-1.5 rounded-md px-2.5 mb-1.5" style={{ height: '28px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                                <div className="w-2.5 h-2.5 rounded-full border border-white/15 flex-shrink-0" />
                                                <SkLine className="flex-1 h-1" />
                                            </div>
                                            <SkLine className="h-1 w-4/5" />
                                        </div>
                                    </div>
                                </div>

                                {/* Charts Row */}
                                <div className="grid grid-cols-2 gap-3.5 flex-1">
                                    <VedicChartCard label="D1 — Lagna Chart" chartId="d1" />
                                    <VedicChartCard label="D9 — Navamsa Chart" chartId="d9" />
                                </div>
                            </div>

                            {/* AI Sidebar */}
                            <div className="flex flex-col" style={{ background: '#0d0a06' }}>
                                {/* Header */}
                                <div className="p-4 pb-3.5 flex flex-col gap-3 items-center" style={{ borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <div className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[0.65rem]"
                                                style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                                ✦
                                            </div>
                                            <div>
                                                <div className="text-[0.8rem] font-semibold text-white/80 leading-none">Astrova</div>
                                                <div className="text-[0.62rem] flex items-center gap-1" style={{ color: 'rgba(245,158,11,0.6)' }}>
                                                    <span className="w-[5px] h-[5px] rounded-full bg-amber-400/70" />
                                                    Hazel
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 h-[22px] rounded-[5px] text-[0.68rem] font-semibold"
                                            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'rgba(245,158,11,0.8)' }}>
                                            ✦ 76
                                        </div>
                                    </div>

                                    {/* Avatar */}
                                    <div className="flex flex-col items-center gap-2 w-full">
                                        <div className="relative w-14 h-14 rounded-xl flex items-center justify-center text-2xl overflow-hidden"
                                            style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.25),rgba(168,85,247,0.15))', border: '1px solid rgba(245,158,11,0.25)' }}>
                                            ✦
                                            <div className="absolute inset-0 sk-shimmer" />
                                        </div>
                                        <div className="text-[0.9rem] font-semibold text-white/90">Astrova</div>
                                        <div className="text-[0.68rem] text-white/35 text-center leading-relaxed max-w-[180px]">
                                            Your Modern Astrologer<br />Ask me about your birth chart, dashas, strengths, and more.
                                        </div>
                                    </div>
                                </div>

                                {/* Topic buttons 2×4 */}
                                <div className="p-3.5 grid grid-cols-2 gap-2 flex-1 content-start">
                                    {['◎ Overview', '📋 Career', '♡ Love', '⚡ Health', '⏳ Dasha', '✦ Strengths', '🏠 Houses', '🔮 Remedies'].map((topic) => (
                                        <div key={topic} className="relative h-9 rounded-lg flex items-center gap-1.5 px-2.5 text-[0.7rem] text-white/40 overflow-hidden cursor-default"
                                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                            <div className="absolute inset-0 sk-shimmer" />
                                            {topic}
                                        </div>
                                    ))}
                                </div>

                                {/* Chat composer */}
                                <div className="p-3.5 mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div className="flex items-center gap-2 h-10 rounded-[10px] px-3"
                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,85,247,0.15)' }}>
                                        <div className="relative flex-1 h-[7px] rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', width: '70%' }}>
                                            <div className="absolute inset-0 sk-shimmer" />
                                        </div>
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[0.7rem] text-white flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg,#7c3aed,#d97706)', boxShadow: '0 0 10px rgba(168,85,247,0.3)' }}>
                                            ↑
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section divider */}
                <SectionDivider />

                {/* ── FEATURES BENTO ── */}
                <section id="features" className="relative py-24 sm:py-32">
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(13,10,20,0.5),transparent)]" />
                    <Container>
                        <div className="text-center mb-16">
                            <div className={`${mono} text-[0.7rem] tracking-[0.2em] uppercase text-amber-400 flex items-center justify-center gap-3 mb-4`}>
                                <span className="w-8 h-px bg-amber-500/35" />
                                What's Inside
                                <span className="w-8 h-px bg-amber-500/35" />
                            </div>
                            <h2 className={`${serif} text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.1]`}>
                                The full spectrum of<br />
                                <em className="italic" style={{ background: 'linear-gradient(90deg,#a855f7,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                    Vedic wisdom
                                </em>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Birth Chart — span 2 */}
                            <div className="group relative p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-purple-500/20 transition-all duration-500 lg:col-span-2">
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/[0.03] group-hover:to-transparent transition-all duration-500" />
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-xl" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>☽</div>
                                    <h3 className={`${serif} text-xl font-semibold text-white/90 mb-2`}>Vedic Birth Chart (Kundali)</h3>
                                    <p className="text-sm text-neutral-500 leading-relaxed">Precise D1 Lagna chart calculated from your exact birth time and location. All 12 houses, 9 planets, Rahu & Ketu — displayed in North Indian style with complete divisional charts (D9 Navamsa and more).</p>
                                    <div className="mt-5 rounded-lg p-3 flex flex-col gap-1.5 overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div className="absolute inset-0 sk-shimmer" />
                                        <div className="h-1.5 rounded-sm" style={{ background: 'rgba(168,85,247,0.25)', width: '80%' }} />
                                        <div className="h-1.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.08)', width: '60%' }} />
                                        <div className="h-1.5 rounded-sm" style={{ background: 'rgba(245,158,11,0.22)', width: '70%' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Couple Compatibility */}
                            <div className="group relative p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-rose-500/20 transition-all duration-500">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-xl" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>♡</div>
                                    <h3 className={`${serif} text-xl font-semibold text-white/90 mb-2`}>Couple Compatibility</h3>
                                    <p className="text-sm text-neutral-500 leading-relaxed">Ashtakoot score, Guna Milan, and a narrative on your cosmic partnership — who you click with and why.</p>
                                </div>
                            </div>

                            {/* Nakshatra */}
                            <div className="group relative p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-purple-500/20 transition-all duration-500">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-xl" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>◎</div>
                                    <h3 className={`${serif} text-xl font-semibold text-white/90 mb-2`}>Nakshatra Analysis</h3>
                                    <p className="text-sm text-neutral-500 leading-relaxed">Your Moon nakshatra, Janma Tara, and how your 27 birth stars shape your deepest instincts and nature.</p>
                                </div>
                            </div>

                            {/* Dasha */}
                            <div className="group relative p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-500/20 transition-all duration-500">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>⌛</div>
                                    <h3 className={`${serif} text-xl font-semibold text-white/90 mb-2`}>Dasha Periods</h3>
                                    <p className="text-sm text-neutral-500 leading-relaxed">Vimshottari Dasha timeline — know exactly which planetary period rules your life right now and what's next.</p>
                                </div>
                            </div>

                            {/* AI Astrologer — span 2 */}
                            <div className="group relative p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-500/20 transition-all duration-500 lg:col-span-2">
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/[0.03] group-hover:to-transparent transition-all duration-500" />
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>✦</div>
                                    <h3 className={`${serif} text-xl font-semibold text-white/90 mb-2`}>AI Astrologer — Always On</h3>
                                    <p className="text-sm text-neutral-500 leading-relaxed">Ask your dedicated AI astrologer anything: personality traits, career timing, relationship dynamics, spiritual remedies. It knows your chart inside out and answers in plain language, not jargon.</p>
                                    <div className="mt-5 rounded-lg p-3 flex flex-col gap-1.5 overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div className="absolute inset-0 sk-shimmer" />
                                        <div className="h-1.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.08)', width: '90%' }} />
                                        <div className="h-1.5 rounded-sm" style={{ background: 'rgba(168,85,247,0.25)', width: '75%' }} />
                                        <div className="h-1.5 rounded-sm" style={{ background: 'rgba(245,158,11,0.22)', width: '80%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Container>
                </section>

                {/* ── PRICING ── */}
                <section id="pricing" className="relative py-24 sm:py-32">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.04),transparent_70%)]" />
                    <Container>
                        <div className="text-center mb-16">
                            <div className={`${mono} text-[0.7rem] tracking-[0.2em] uppercase text-amber-400 flex items-center justify-center gap-3 mb-4`}>
                                <span className="w-8 h-px bg-amber-500/35" />
                                Pricing
                                <span className="w-8 h-px bg-amber-500/35" />
                            </div>
                            <h2 className={`${serif} text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.1]`}>
                                Start free,{' '}
                                <em className="italic" style={{ background: 'linear-gradient(90deg,#a855f7,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                    go deeper
                                </em>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
                            {pricingCards.map((card) => {
                                const isPremium = card.title === 'Premium';
                                return (
                                    <div key={card.title}
                                        className={cn(
                                            "relative rounded-2xl p-6 sm:p-8 border transition-all duration-500 flex flex-col",
                                            isPremium
                                                ? "border-purple-500/35 bg-purple-500/5"
                                                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                                        )}
                                        style={isPremium ? { boxShadow: '0 0 50px rgba(168,85,247,0.1)' } : {}}>

                                        {isPremium && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <span className={`${mono} text-[0.58rem] tracking-[0.1em] uppercase text-white px-4 py-1 rounded-full`}
                                                    style={{ background: 'linear-gradient(90deg,#7c3aed,#d97706)' }}>
                                                    POPULAR
                                                </span>
                                            </div>
                                        )}

                                        <div className={cn("mb-6", isPremium && "pt-2")}>
                                            <h3 className={`${mono} text-[0.68rem] tracking-[0.15em] uppercase text-neutral-500 mb-4`}>{card.title}</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className={cn(`${serif} text-4xl sm:text-5xl font-semibold`,
                                                    isPremium ? '' : 'text-white'
                                                )}
                                                    style={isPremium ? { background: 'linear-gradient(90deg,#a855f7,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}}>
                                                    {card.price}
                                                </span>
                                                {card.duration && <span className="text-sm text-neutral-500">/ {card.duration}</span>}
                                            </div>
                                            <p className="text-sm text-neutral-500 mt-2">{card.description}</p>
                                        </div>

                                        <div className="flex-1 space-y-2.5 mb-8">
                                            {card.features.map((f) => (
                                                <div key={f} className="flex items-start gap-2.5">
                                                    <span className="text-[0.5rem] mt-1 flex-shrink-0" style={{ color: isPremium ? '#a855f7' : 'rgba(255,255,255,0.2)' }}>✦</span>
                                                    <span className="text-sm text-neutral-400">{f}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            onClick={handleLogin}
                                            className={cn(
                                                "w-full h-11 text-sm font-semibold rounded-lg transition-all border",
                                                isPremium
                                                    ? "text-white border-transparent"
                                                    : "bg-transparent text-neutral-400 border-white/10 hover:bg-white/[0.06] hover:text-white"
                                            )}
                                            style={isPremium ? { background: 'linear-gradient(135deg,#7c3aed,#d97706)', boxShadow: '0 0 25px rgba(168,85,247,0.3)' } : {}}
                                            aria-label={`${card.buttonText} ${card.title} plan`}
                                        >
                                            {card.buttonText}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </Container>
                </section>

                {/* ── TESTIMONIALS ── */}
                <section id="testimonials" className="relative py-24 sm:py-32 overflow-hidden">
                    <Container>
                        <div className="text-center mb-16">
                            <div className={`${mono} text-[0.7rem] tracking-[0.2em] uppercase text-amber-400 flex items-center justify-center gap-3 mb-4`}>
                                <span className="w-8 h-px bg-amber-500/35" />
                                Testimonials
                                <span className="w-8 h-px bg-amber-500/35" />
                            </div>
                            <h2 className={`${serif} text-3xl sm:text-4xl md:text-5xl font-semibold`}>
                                Loved by{' '}
                                <em className="italic" style={{ background: 'linear-gradient(90deg,#a855f7,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                    seekers
                                </em>
                            </h2>
                        </div>
                    </Container>

                    <div className="relative">
                        <div className="flex flex-col gap-4 py-4">
                            <Marquee reverse pauseOnHover className="[--duration:35s] select-none">
                                {firstRow.map((review, idx) => (
                                    <ReviewCard key={`${review.name}-${idx}`} review={review} />
                                ))}
                            </Marquee>
                            <Marquee pauseOnHover className="[--duration:35s] select-none">
                                {secondRow.map((review, idx) => (
                                    <ReviewCard key={`${review.name}-${idx}`} review={review} />
                                ))}
                            </Marquee>
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-[#06020a]" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/5 bg-gradient-to-l from-[#06020a]" />
                    </div>
                </section>

                {/* ── FINAL CTA ── */}
                <section className="relative py-32 sm:py-40 overflow-hidden text-center">
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 50%, rgba(168,85,247,0.07) 0%, transparent 70%)' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full blur-[120px]"
                        style={{ background: 'rgba(168,85,247,0.04)' }} />

                    <Container>
                        <div className="relative max-w-2xl mx-auto">
                            <div className="text-[2.5rem] mb-4" style={{ filter: 'drop-shadow(0 0 14px rgba(245,158,11,0.6))' }}>✦</div>

                            <h2 className={`${serif} text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.0]`}>
                                The stars have always<br />
                                been{' '}
                                <em className="italic" style={{ background: 'linear-gradient(90deg,#a855f7,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                    speaking
                                </em>
                            </h2>

                            <p className="text-neutral-400 mt-6 text-base sm:text-lg max-w-[420px] mx-auto leading-relaxed">
                                Your Vedic chart holds a map of who you are and what's coming. It takes 30 seconds to read it.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
                                <Button
                                    onClick={handleLogin}
                                    className="h-12 px-10 text-sm font-semibold text-white border-none rounded-lg transition-all"
                                    style={{ background: 'linear-gradient(135deg,#7c3aed,#d97706)', boxShadow: '0 0 30px rgba(168,85,247,0.4)' }}
                                    aria-label="Read your birth chart free"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Read My Chart Free
                                </Button>
                                <Button
                                    onClick={handleLogin}
                                    variant="ghost"
                                    className="h-12 px-8 text-sm font-medium text-neutral-400 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-lg transition-all"
                                    aria-label="Chat with AI Astrologer"
                                >
                                    Chat with AI Astrologer
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </Container>
                </section>
            </main>

            <Footer />

            {/* Global keyframes */}
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes badgePulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.8); }
                }
                @keyframes scrollLine {
                    0%, 100% { opacity: 0.3; transform: scaleY(1); }
                    50% { opacity: 0.8; transform: scaleY(0.6); }
                }
                @keyframes cosmicDrift {
                    from { transform: translate(0, 0) scale(1); }
                    to { transform: translate(25px, -35px) scale(1.08); }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    60%, 100% { transform: translateX(100%); }
                }
                .sk-shimmer {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.055) 50%, transparent 100%);
                    transform: translateX(-100%);
                    animation: shimmer 2.6s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

// ── Small helper components ──

function FauxIconBtn({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <div className={cn("relative w-[30px] h-[30px] rounded-[7px] flex items-center justify-center overflow-hidden flex-shrink-0", className)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', ...style }}>
            <div className="sk-shimmer absolute inset-0" />
            {children}
        </div>
    );
}

function FauxChip({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <div className={cn("relative h-[26px] rounded-md flex items-center px-2.5 text-[0.68rem] overflow-hidden flex-shrink-0", className)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', ...style }}>
            <div className="sk-shimmer absolute inset-0" />
            {children}
        </div>
    );
}

function FauxInputIcon({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center text-[0.6rem] flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.15)' }}>
            {children}
        </div>
    );
}

function SkLine({ className }: { className?: string }) {
    return (
        <div className={cn("relative rounded overflow-hidden", className)} style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="sk-shimmer absolute inset-0" />
        </div>
    );
}

function SkDropdown() {
    return (
        <div className="relative flex-1 h-6 rounded-[5px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="sk-shimmer absolute inset-0" />
        </div>
    );
}

function VedicChartCard({ label, chartId }: { label: string; chartId: 'd1' | 'd9' }) {
    return (
        <div className="relative rounded-[10px] p-3 flex flex-col items-center gap-3 overflow-hidden min-h-[280px]"
            style={{ background: '#1a1208', border: '1px solid rgba(245,158,11,0.18)' }}>
            <div className="self-start text-[0.65rem] tracking-[0.1em] text-amber-500/50 uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{label}</div>
            <div className="flex-1 flex items-center justify-center w-full">
                {chartId === 'd1' ? <D1Chart /> : <D9Chart />}
            </div>
            {/* Shimmer sweep over chart */}
            <div className="absolute inset-0 sk-shimmer pointer-events-none" style={{ animationDuration: '3s' }} />
        </div>
    );
}

function D1Chart() {
    return (
        <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '90%', maxWidth: '220px', height: 'auto' }}>
            <rect x="2" y="2" width="216" height="216" rx="3" stroke="rgba(245,158,11,0.35)" strokeWidth="1.2" />
            <polygon points="110,2 218,110 110,218 2,110" fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth="1" />
            <rect x="57" y="57" width="106" height="106" rx="1" fill="none" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="2" y1="2" x2="57" y2="57" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="218" y1="2" x2="163" y2="57" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="2" y1="218" x2="57" y2="163" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="218" y1="218" x2="163" y2="163" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            {/* Center house 1 */}
            <text x="110" y="108" textAnchor="middle" fontSize="9" fill="rgba(168,85,247,0.9)" fontFamily="monospace" fontWeight="600">Asc</text>
            <text x="110" y="120" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontFamily="monospace">Ma</text>
            <text x="94" y="132" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.35)" fontFamily="monospace">Ve</text>
            <text x="124" y="132" textAnchor="middle" fontSize="7" fill="rgba(100,220,100,0.8)" fontFamily="monospace">Gk</text>
            <text x="110" y="150" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">2</text>
            {/* Top house */}
            <text x="88" y="38" textAnchor="middle" fontSize="9" fill="rgba(245,158,11,0.9)" fontFamily="monospace" fontWeight="600">Su°↑</text>
            <text x="100" y="50" textAnchor="middle" fontSize="8" fill="rgba(168,85,247,0.8)" fontFamily="monospace">Ra•</text>
            <text x="116" y="50" textAnchor="middle" fontSize="8" fill="rgba(100,220,100,0.9)" fontFamily="monospace">Me*</text>
            <text x="110" y="62" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">1</text>
            {/* Right house */}
            <text x="185" y="100" textAnchor="middle" fontSize="9" fill="rgba(100,180,255,0.9)" fontFamily="monospace" fontWeight="600">Uk</text>
            <text x="185" y="114" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">12</text>
            {/* Left house */}
            <text x="36" y="100" textAnchor="middle" fontSize="9" fill="rgba(100,180,255,0.7)" fontFamily="monospace" fontWeight="600">Ka</text>
            <text x="36" y="114" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">4</text>
            {/* Bottom house */}
            <text x="110" y="185" textAnchor="middle" fontSize="9" fill="rgba(200,200,255,0.9)" fontFamily="monospace" fontWeight="600">Mo</text>
            <text x="110" y="197" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">11</text>
            {/* Bottom-left */}
            <text x="54" y="170" textAnchor="middle" fontSize="9" fill="rgba(245,158,11,0.7)" fontFamily="monospace" fontWeight="600">Ju*</text>
            <text x="54" y="182" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">5</text>
            {/* Top-left */}
            <text x="36" y="148" textAnchor="middle" fontSize="9" fill="rgba(100,220,200,0.9)" fontFamily="monospace" fontWeight="600">Mn</text>
            <text x="36" y="132" textAnchor="middle" fontSize="9" fill="rgba(255,150,255,0.9)" fontFamily="monospace" fontWeight="600">Sa</text>
            <text x="36" y="118" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">3</text>
        </svg>
    );
}

function D9Chart() {
    return (
        <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '90%', maxWidth: '220px', height: 'auto' }}>
            <rect x="2" y="2" width="216" height="216" rx="3" stroke="rgba(245,158,11,0.35)" strokeWidth="1.2" />
            <polygon points="110,2 218,110 110,218 2,110" fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth="1" />
            <rect x="57" y="57" width="106" height="106" rx="1" fill="none" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="2" y1="2" x2="57" y2="57" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="218" y1="2" x2="163" y2="57" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="2" y1="218" x2="57" y2="163" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            <line x1="218" y1="218" x2="163" y2="163" stroke="rgba(245,158,11,0.2)" strokeWidth="0.8" />
            {/* Top */}
            <text x="86" y="38" textAnchor="middle" fontSize="9" fill="rgba(255,80,80,0.9)" fontFamily="monospace" fontWeight="600">Ma</text>
            <text x="132" y="38" textAnchor="middle" fontSize="9" fill="rgba(100,220,100,0.9)" fontFamily="monospace" fontWeight="600">Me</text>
            <text x="110" y="62" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">4</text>
            {/* Center */}
            <text x="110" y="105" textAnchor="middle" fontSize="9" fill="rgba(168,85,247,0.9)" fontFamily="monospace" fontWeight="600">Asc</text>
            <text x="98" y="118" textAnchor="middle" fontSize="8" fill="rgba(168,140,255,0.8)" fontFamily="monospace">Ve</text>
            <text x="122" y="118" textAnchor="middle" fontSize="8" fill="rgba(200,200,255,0.8)" fontFamily="monospace">Mo</text>
            <text x="110" y="148" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">3</text>
            {/* Left */}
            <text x="36" y="104" textAnchor="middle" fontSize="9" fill="rgba(245,158,11,0.9)" fontFamily="monospace" fontWeight="600">Ju</text>
            <text x="36" y="118" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">5</text>
            {/* Right */}
            <text x="185" y="104" textAnchor="middle" fontSize="9" fill="rgba(245,158,11,0.9)" fontFamily="monospace" fontWeight="600">Su</text>
            <text x="185" y="118" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">1</text>
            {/* Bottom */}
            <text x="80" y="185" textAnchor="middle" fontSize="9" fill="rgba(168,85,247,0.7)" fontFamily="monospace" fontWeight="600">Ra</text>
            <text x="80" y="197" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">6</text>
            {/* Bottom-right */}
            <text x="185" y="175" textAnchor="middle" fontSize="9" fill="rgba(100,200,100,0.8)" fontFamily="monospace" fontWeight="600">Ke</text>
            <text x="185" y="187" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">12</text>
            <text x="36" y="148" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace" fontWeight="700">2</text>
        </svg>
    );
}

function SectionDivider() {
    return (
        <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), rgba(245,158,11,0.3), transparent)' }} />
    );
}

function ReviewCard({ review }: { review: { name: string; username: string; body: string } }) {
    return (
        <div className="w-80 mx-2 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-purple-500/15 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(245,158,11,0.15))', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <span className="text-xs font-semibold text-purple-300">{review.name[0]}</span>
                </div>
                <div>
                    <div className="text-sm font-medium text-white/90">{review.name}</div>
                    <div className="text-[11px] text-neutral-600">{review.username}</div>
                </div>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">{review.body}</p>
        </div>
    );
}

// ── HEADER ──
function Header({ onLogin }: { onLogin: () => void }) {
    const [scrolled, setScrolled] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={cn(
            "fixed top-0 z-50 w-full transition-all duration-500",
            scrolled
                ? "backdrop-blur-xl border-b border-white/[0.04]"
                : "bg-transparent"
        )}
            style={scrolled ? { background: 'rgba(6,2,10,0.8)' } : {}}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex h-16 items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5">
                        <img src="/astrova_logo.png" alt="Astrova" className="w-7 h-7" />
                        <span className="text-sm font-semibold text-white/90 tracking-tight">Astrova</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-8" aria-label="Homepage sections">
                        {[
                            { label: 'Birth Chart', href: '#features' },
                            { label: 'Compatibility', href: '#features' },
                            { label: 'AI Astrologer', href: '#features' },
                            { label: 'Pricing', href: '#pricing' },
                        ].map((item) => (
                            <a key={item.label} href={item.href}
                                className="text-[13px] text-neutral-500 hover:text-neutral-200 transition-colors duration-300">
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onLogin}
                            aria-label="Log in"
                            className="text-[13px] text-neutral-400 hover:text-white h-9 px-4"
                        >
                            Log in
                        </Button>
                        <Button
                            size="sm"
                            onClick={onLogin}
                            aria-label="Get your chart"
                            className="h-9 px-5 text-[13px] font-semibold text-white border-none rounded-lg transition-all"
                            style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}
                        >
                            Get Your Chart →
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}

// ── FOOTER ──
function Footer() {
    return (
        <footer className="border-t border-white/[0.04]" style={{ background: '#050208' }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4">
                <Link to="/" className="flex items-center gap-2.5">
                    <img src="/astrova_logo.png" alt="Astrova" className="w-6 h-6" />
                    <span className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-white/35" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Astrova</span>
                </Link>
                <ul className="flex gap-6 list-none">
                    {[
                        { label: 'Privacy', href: 'mailto:support@astrova.app?subject=Privacy%20Policy' },
                        { label: 'Terms', href: 'mailto:support@astrova.app?subject=Terms%20of%20Service' },
                        { label: 'Blog', href: 'https://astrova.app', external: true },
                        { label: 'Twitter', href: 'https://x.com', external: true },
                    ].map((link) => (
                        <li key={link.label}>
                            <a href={link.href} className="text-[0.75rem] text-neutral-700 hover:text-neutral-400 transition-colors"
                                {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                                {link.label}
                            </a>
                        </li>
                    ))}
                </ul>
                <p className="text-[0.75rem] text-neutral-700">© 2026 Astrova · Magnova AI</p>
            </div>
        </footer>
    );
}

export default HomePage;

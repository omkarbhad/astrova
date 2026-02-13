import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Loader2, Trash2, ChevronDown, PanelRightClose, AlertCircle, LayoutGrid, Heart, FolderOpen, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { useCredits, CREDIT_COSTS, CreditsDisplay } from '@/contexts/CreditsContext';
import { BuyCreditsModal } from './BuyCreditsModal';
import type { KundaliResponse } from '../types/kundali';
import { searchKnowledgeBase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  kbResults?: { title: string; category: string; content: string }[];
}

interface SavedChartRef {
  id: string;
  name: string;
}

interface AstrovaSidebarProps {
  kundaliData: KundaliResponse | null;
  chartName?: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: (view: 'kundali' | 'matcher') => void;
  onLoadChart?: (chartId: string) => void;
  savedCharts?: SavedChartRef[];
}

const QUICK_PROMPTS = [
  { label: 'Overview', prompt: 'Give me a full overview of my birth chart' },
  { label: 'Career', prompt: 'What does my chart say about my career?' },
  { label: 'Love', prompt: 'Tell me about love and marriage in my chart' },
  { label: 'Health', prompt: 'What are the health indicators in my chart?' },
  { label: 'Dasha', prompt: 'Analyze my current dasha period and antardashas' },
  { label: 'Strengths', prompt: 'Show me my planetary strengths (Shadbala)' },
  { label: 'Houses', prompt: 'Analyze my house strengths (Bhava Bala)' },
  { label: 'Remedies', prompt: 'What remedies do you suggest for my chart?' },
];

function buildSystemPrompt(kundaliData: KundaliResponse | null, chartName?: string, kbContext?: string): string {
  let prompt = `You are Astrova — a sharp, modern Vedic astrologer. You read charts like a pro and talk like a trusted friend who doesn't sugarcoat but is friendly.

Your personality:
- Friendly but blunt. No fluff, no generic "the stars say you're special" nonsense
- Always ground your answers in the ACTUAL chart data provided — cite specific planets, houses, signs, degrees, dashas
- If someone's Saturn is weak, say it straight. If Jupiter is exalted, celebrate it
- Use Vedic terminology naturally (nakshatra, dasha, bhava, graha) but explain briefly when needed
- Keep responses focused and punchy. Use markdown for structure
- When the chart shows something challenging, be honest but constructive
- You can answer non-astrology questions too, but always bring it back to the chart when relevant
- Never give vague readings. Every statement should reference specific placements from their chart

CRITICAL REMEDY RULES — FOLLOW STRICTLY:
- NEVER suggest age-old ritualistic remedies like mantras, gemstones (pushparaj, cat's eye etc.), chanting, pujas, havans, yantras, donating items on specific days, or wearing specific colors on specific days
- INSTEAD, give MODERN, PRACTICAL, PERSONALITY-BASED solutions grounded in psychology and self-improvement
- For weak Mercury: journaling, learning new skills, puzzles, communication workshops, reading habit
- For weak Venus: self-care routines, creative hobbies (art, music, cooking), developing aesthetic sense, relationship counseling
- For weak Mars: physical exercise, martial arts, assertiveness training, competitive sports, anger management
- For weak Jupiter: teaching/mentoring others, expanding knowledge through courses, philosophy reading, travel
- For weak Saturn: building discipline through routines, time management systems, therapy for anxiety, career coaching
- For weak Moon: meditation apps, therapy, emotional intelligence workshops, nature walks, sleep hygiene
- For weak Sun: leadership courses, confidence building, public speaking practice, setting boundaries
- For Rahu issues: digital detox, grounding practices, mindfulness, reducing material obsession
- For Ketu issues: finding purpose through volunteering, spiritual but non-ritualistic practices like meditation, connecting with community
- Frame remedies as "what to work on" based on their personality profile from the chart

Your expertise: Kundali analysis, Shadbala interpretation, Bhava Bala, Vimshottari Dasha timing, Antardasha/Pratyantardasha predictions, Ashtakoot matching, nakshatra analysis, yogas, doshas, and MODERN practical personality-based guidance.`;

  if (kundaliData) {
    prompt += `\n\n--- BIRTH CHART DATA ---`;
    if (chartName) prompt += `\nChart Name: ${chartName}`;
    prompt += `\nBirth Date: ${kundaliData.birth.date}`;
    prompt += `\nBirth Time: ${kundaliData.birth.time}`;
    prompt += `\nTimezone: UTC${kundaliData.birth.tz_offset_hours >= 0 ? '+' : ''}${kundaliData.birth.tz_offset_hours}`;
    prompt += `\nLocation: ${kundaliData.birth.latitude.toFixed(4)}°N, ${kundaliData.birth.longitude.toFixed(4)}°E`;
    prompt += `\nAyanamsha: ${kundaliData.meta.ayanamsha} (${kundaliData.meta.ayanamsha_deg.toFixed(4)}°)`;
    
    prompt += `\n\nLagna (Ascendant): ${kundaliData.lagna.sign} (${kundaliData.lagna.sign_sanskrit}) at ${kundaliData.lagna.deg}°${kundaliData.lagna.min}'${kundaliData.lagna.sec}"`;
    
    prompt += `\n\n--- PLANETARY POSITIONS ---`;
    for (const [name, p] of Object.entries(kundaliData.planets)) {
      const flags = [];
      if (p.retrograde) flags.push('R');
      if (p.exalted) flags.push('Exalted');
      if (p.debilitated) flags.push('Debilitated');
      if (p.vargottama) flags.push('Vargottama');
      if (p.combust) flags.push('Combust');
      prompt += `\n${name}: ${p.sign} (${p.sign_sanskrit}) ${p.deg}°${p.min}'${p.sec}" House-${p.house_whole_sign} ${flags.length ? `[${flags.join(', ')}]` : ''}`;
      if (p.navamsa_sign) prompt += ` Navamsa: ${p.navamsa_sign}`;
    }
    
    if (kundaliData.shad_bala) {
      prompt += `\n\n--- SHADBALA (Planetary Strength) ---`;
      for (const [name, bala] of Object.entries(kundaliData.shad_bala)) {
        prompt += `\n${name}: ${bala.total_rupas ?? 0} rupas (Required: ${bala.required_rupas ?? 0}) - ${bala.strength}`;
      }
    }
    
    if (kundaliData.bhava_bala) {
      prompt += `\n\n--- BHAVA BALA (House Strength) ---`;
      for (const [house, bala] of Object.entries(kundaliData.bhava_bala)) {
        prompt += `\nHouse ${house} (${bala.sign}): Lord=${bala.lord}, ${bala.total_rupas ?? 0} rupas - ${bala.rating}`;
      }
    }
    
    if (kundaliData.yogas && kundaliData.yogas.length > 0) {
      prompt += `\n\n--- YOGAS (Planetary Combinations) ---`;
      for (const yoga of kundaliData.yogas) {
        prompt += `\n${yoga.name} [${yoga.type}/${yoga.strength}]: ${yoga.description} (Planets: ${yoga.planets.join(', ')})`;
      }
    }

    if (kundaliData.dasha) {
      prompt += `\n\n--- VIMSHOTTARI DASHA ---`;
      prompt += `\nCurrent Mahadasha: ${kundaliData.dasha.current_dasha}`;
      prompt += `\nMoon Nakshatra: ${kundaliData.dasha.moon_nakshatra_name} (Pada ${kundaliData.dasha.moon_nakshatra_pada})`;
      
      const currentPeriod = kundaliData.dasha.periods.find(p => p.is_current);
      if (currentPeriod) {
        prompt += `\nCurrent Period: ${currentPeriod.planet} Mahadasha (${currentPeriod.start_date} to ${currentPeriod.end_date})`;
        if (currentPeriod.antardashas) {
          const now = new Date();
          const currentAD = currentPeriod.antardashas.find(ad => {
            const start = new Date(ad.start_datetime || ad.start_date);
            const end = ad.end_datetime ? new Date(ad.end_datetime) : new Date(ad.end_date || '');
            return now >= start && now < end;
          });
          if (currentAD) {
            prompt += `\nCurrent Antardasha: ${currentAD.planet} (${currentAD.start_date} to ${currentAD.end_date})`;
            if (currentAD.pratyantardashas) {
              const currentPAD = currentAD.pratyantardashas.find(pad => {
                const s = new Date(pad.start_datetime || pad.start_date);
                const e = pad.end_datetime ? new Date(pad.end_datetime) : new Date(pad.end_date || '');
                return now >= s && now < e;
              });
              if (currentPAD) {
                prompt += `\nCurrent Pratyantardasha: ${currentPAD.planet} (${currentPAD.start_date} to ${currentPAD.end_date})`;
              }
            }
          }
          // List all antardashas for context
          prompt += `\nAll Antardashas in current Mahadasha:`;
          for (const ad of currentPeriod.antardashas) {
            prompt += `\n  ${ad.planet}: ${ad.start_date} to ${ad.end_date} (${ad.years?.toFixed(2)}y)`;
          }
        }
      }
    }
  }

  if (kbContext) {
    prompt += `\n\n--- KNOWLEDGE BASE CONTEXT ---`;
    prompt += `\nUse the following reference material to enhance your answer:`;
    prompt += `\n${kbContext}`;
  }

  return prompt;
}

export function AstrovaSidebar({ kundaliData, chartName, isOpen, onToggle, onNavigate, onLoadChart, savedCharts }: AstrovaSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { credits, deductCredits, showBuyModal, setShowBuyModal } = useCredits();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onToggle();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onToggle]);

  // Auto-focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom && messages.length > 3);
  }, [messages.length]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    // Check credits before sending
    if (!deductCredits(CREDIT_COSTS.AI_MESSAGE)) {
      setInsufficientCredits(true);
      setTimeout(() => setInsufficientCredits(false), 3000);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to your .env file.');
      }

      // Search knowledge base for relevant context
      let kbContext = '';
      try {
        const kbResults = await searchKnowledgeBase(messageText.trim());
        if (kbResults.length > 0) {
          kbContext = kbResults.map(r => `[${r.category.toUpperCase()}] ${r.title}:\n${r.content}`).join('\n\n');
          // Show KB search as a tool message
          const toolMsg: ChatMessage = {
            id: `kb-${Date.now()}`,
            role: 'tool',
            content: `Searched knowledge base — found ${kbResults.length} relevant article${kbResults.length > 1 ? 's' : ''}`,
            toolName: 'Knowledge Base',
            kbResults: kbResults.map(r => ({ title: r.title, category: r.category, content: r.content.slice(0, 120) + '...' })),
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, toolMsg]);
        }
      } catch { /* KB search is optional, continue without it */ }

      const systemPrompt = buildSystemPrompt(kundaliData, chartName, kbContext || undefined);
      const conversationMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.filter(m => m.role !== 'tool').map(m => ({ role: (m.role === 'tool' ? 'user' : m.role) as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: messageText.trim() },
      ];

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Astrova - Vedic Astrology',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: conversationMessages,
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: { message?: string } })?.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'I could not generate a response. Please try again.';

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Floating toggle button when sidebar is closed
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 bottom-20 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 border border-violet-500/50 shadow-lg shadow-violet-500/20 flex items-center justify-center hover:scale-110 transition-all duration-200 group"
        title="Open Astrova AI"
      >
        <Sparkles className="w-5 h-5 text-white group-hover:animate-pulse" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {messages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950/95 backdrop-blur-xl border-l border-neutral-800/60">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-800/60 bg-neutral-900/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-600/30 border border-violet-500/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">Astrova</h3>
            <p className="text-[10px] text-neutral-500 leading-tight">
              {kundaliData ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  Reading {chartName ? <span className="text-violet-300 font-medium">{chartName}</span> : <span className="text-neutral-400">{kundaliData.lagna.sign} Lagna</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                  No chart
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreditsDisplay compact />
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="h-7 w-7 p-0 text-neutral-500 hover:text-white hover:bg-neutral-800"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 w-7 p-0 text-neutral-500 hover:text-white hover:bg-neutral-800"
            title="Close sidebar"
          >
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 relative scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 border border-neutral-800/50 flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7 text-violet-400/60" />
            </div>
            <h3 className="text-white font-semibold text-base mb-1">Astrova AI</h3>
            <p className="text-neutral-500 text-xs mb-4 max-w-[220px]">
              {kundaliData
                ? 'Ask me about your birth chart, dashas, strengths, and more.'
                : 'Generate a chart first to get personalized readings.'}
            </p>

            {kundaliData && (
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => sendMessage(qp.prompt)}
                    className="px-2 py-2 rounded-lg bg-neutral-900/60 border border-neutral-800/50 text-neutral-400 text-[11px] font-medium hover:bg-neutral-800/60 hover:border-neutral-700/50 hover:text-white transition-all duration-200 text-left"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="w-full">
                {/* User message - compact */}
                {msg.role === 'user' && (
                  <div className="text-right mb-3">
                    <p className="text-white/90 text-sm">{msg.content}</p>
                  </div>
                )}
                
                {/* Tool message - KB search results */}
                {msg.role === 'tool' && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-violet-400/70 mb-1">
                      <BookOpen className="w-3 h-3" />
                      <span className="font-medium">{msg.toolName}</span>
                      <span className="text-neutral-600">•</span>
                      <span className="text-neutral-500">{msg.content}</span>
                    </div>
                    {msg.kbResults && msg.kbResults.length > 0 && (
                      <div className="space-y-1 ml-4">
                        {msg.kbResults.map((r, i) => (
                          <div key={i} className="px-2 py-1.5 rounded-md bg-violet-500/5 border border-violet-500/10 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[8px] uppercase font-medium">{r.category}</span>
                              <span className="text-white/80 font-medium">{r.title}</span>
                            </div>
                            <p className="text-neutral-500 mt-0.5 leading-relaxed">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Assistant message - full width with markdown */}
                {msg.role === 'assistant' && (
                  <div className="mb-4">
                    <div 
                      className="prose prose-invert prose-sm max-w-none text-neutral-200
                        [&_h1]:text-white [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-0
                        [&_h2]:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3
                        [&_h3]:text-white [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-1 [&_h3]:mt-2
                        [&_p]:text-neutral-300 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:mb-2
                        [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:text-xs
                        [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:text-xs
                        [&_li]:text-neutral-300 [&_li]:text-xs [&_li]:mb-1
                        [&_strong]:text-white [&_strong]:font-semibold
                        [&_em]:text-violet-300
                        [&_code]:text-amber-300 [&_code]:bg-neutral-800/50 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs
                        [&_pre]:bg-neutral-900 [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto
                        [&_blockquote]:border-l-2 [&_blockquote]:border-violet-500/50 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-400
                      "
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Analyzing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}

        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700/50 flex items-center justify-center hover:bg-neutral-700 transition-colors shadow-lg"
          >
            <ChevronDown className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>

      {/* Tools Bar */}
      <div className="flex gap-1 px-3 py-1.5 border-t border-violet-500/10 overflow-x-auto scrollbar-thin">
        {onNavigate && (
          <>
            <button
              onClick={() => onNavigate('kundali')}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] hover:bg-violet-500/20 transition-all"
            >
              <LayoutGrid className="w-3 h-3" /> Charts
            </button>
            <button
              onClick={() => onNavigate('matcher')}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[10px] hover:bg-pink-500/20 transition-all"
            >
              <Heart className="w-3 h-3" /> Matcher
            </button>
          </>
        )}
        {savedCharts && savedCharts.length > 0 && onLoadChart && (
          <div className="relative group shrink-0">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-800/50 border border-neutral-700/40 text-neutral-400 text-[10px] hover:bg-neutral-800 hover:text-white transition-all"
            >
              <FolderOpen className="w-3 h-3" /> Load Chart
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 min-w-[140px] max-h-[160px] overflow-y-auto bg-neutral-900 border border-violet-500/20 rounded-lg shadow-xl">
              {savedCharts.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onLoadChart(c.id); onNavigate?.('kundali'); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-violet-500/10 transition-colors ${
                    chartName === c.name ? 'text-violet-300 font-medium' : 'text-neutral-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.length > 0 && kundaliData && (
          <>
            <div className="w-px h-4 bg-neutral-700/30 self-center mx-0.5" />
            {QUICK_PROMPTS.slice(0, 3).map((qp) => (
              <button
                key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                disabled={isLoading}
                className="shrink-0 px-2 py-1 rounded-md bg-neutral-900/50 border border-neutral-800/50 text-neutral-500 text-[10px] hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-50"
              >
                {qp.label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-1.5 px-3 py-2.5 border-t border-neutral-800/60 bg-neutral-900/50"
      >
        <div className="flex-1 relative">
          {insufficientCredits && (
            <div className="absolute -top-8 left-0 right-0 flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-[10px] animate-pulse">
              <AlertCircle className="w-3 h-3" />
              <span>Insufficient Dakshina. Buy more credits!</span>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={kundaliData ? 'Ask Astrova...' : 'Load a chart first...'}
            disabled={isLoading || !kundaliData}
            rows={1}
            className="w-full bg-neutral-800/40 border border-neutral-700/40 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500/40 transition-all resize-none disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px] max-h-[80px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 80) + 'px';
            }}
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || !input.trim() || !kundaliData || credits < CREDIT_COSTS.AI_MESSAGE}
          className="h-9 w-9 p-0 rounded-lg bg-violet-600 hover:bg-violet-500 border-0 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition-all"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </form>

      {/* Buy Credits Modal */}
      <BuyCreditsModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </div>
  );
}

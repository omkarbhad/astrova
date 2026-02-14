import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ArrowUp, Loader2, LayoutGrid, Heart, FolderOpen, BookOpen, PanelRightClose, Trash2, Eye, Briefcase, HeartPulse, Activity, Clock, Dumbbell, Home, Pill, Globe, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { useCredits, CREDIT_COSTS, CreditsDisplay } from '@/contexts/CreditsContext';
import { BuyCreditsModal } from './BuyCreditsModal';
import { useAuth } from '@/contexts/AuthContext';
import type { KundaliResponse } from '../types/kundali';
import { searchKnowledgeBase, getAdminConfig, getUserEnabledModels, getUserSetting, getUserChatSessions, saveChatSession, deleteChatSession, type ChatSession } from '../lib/supabase';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  kbResults?: { title: string; category: string; content: string }[];
  isStreaming?: boolean;
}

interface SavedChartRef {
  id: string;
  name: string;
}

interface MatchDataRef {
  chart1Name: string;
  chart2Name: string;
  scores: { category: string; score: number; maxScore: number; description: string }[];
}

interface AstrovaSidebarProps {
  kundaliData: KundaliResponse | null;
  chartName?: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: (view: 'kundali' | 'matcher') => void;
  onLoadChart?: (chartId: string) => void;
  onGenerateChart?: (data: { date: string; time: string; lat: number; lon: number; name?: string }) => void;
  savedCharts?: SavedChartRef[];
  matchData?: MatchDataRef | null;
}

const QUICK_PROMPTS = [
  { label: 'Overview', prompt: 'Give me a full overview of my birth chart', icon: Eye, color: 'text-amber-400' },
  { label: 'Career', prompt: 'What does my chart say about my career?', icon: Briefcase, color: 'text-blue-400' },
  { label: 'Love', prompt: 'Tell me about love and marriage in my chart', icon: HeartPulse, color: 'text-pink-400' },
  { label: 'Health', prompt: 'What are the health indicators in my chart?', icon: Activity, color: 'text-green-400' },
  { label: 'Dasha', prompt: 'Analyze my current dasha period and antardashas', icon: Clock, color: 'text-purple-400' },
  { label: 'Strengths', prompt: 'Show me my planetary strengths (Shadbala)', icon: Dumbbell, color: 'text-orange-400' },
  { label: 'Houses', prompt: 'Analyze my house strengths (Bhava Bala)', icon: Home, color: 'text-cyan-400' },
  { label: 'Remedies', prompt: 'What remedies do you suggest for my chart?', icon: Pill, color: 'text-emerald-400' },
];

function buildSystemPrompt(kundaliData: KundaliResponse | null, chartName?: string, kbContext?: string): string {
  let prompt = `You are Astrova — a sharp, modern Vedic astrologer. You read charts like a pro and speak like a trusted friend who tells the truth without being harsh.

CORE IDENTITY:
- Friendly but blunt
- Direct, not rude
- No vague spiritual fluff
- No generic motivational lines
- Always grounded in the ACTUAL chart data provided

MANDATORY:
Every statement must reference:
- Planet
- Sign
- House (bhava)
- Degree (if available)
- Nakshatra (if available)
- Active dasha (if applicable)

If it’s not visible in the chart, do not say it.

ASTROLOGY EXPERTISE:
- Parashara Vedic astrology
- Shadbala & Bhava Bala
- Vimshottari Dasha (Mahadasha, Antardasha, Pratyantardasha)
- Nakshatra analysis
- Yogas & Doshas
- Functional benefic/malefic logic
- Planetary aspects (7th + special aspects of Mars, Jupiter, Saturn)
- Dispositor chains
- Ashtakoot matching
- Bhrigu Nandi Nadi techniques

BHRIGU NANDI NADI RULES (MANDATORY FOR PREDICTIONS):
- Planets tell stories through adjacency, not just lordship.
- 12th from a planet = what it spends/loses.
- 2nd from a planet = what it gains/accumulates.
- Saturn’s position from Jupiter = karmic debt.
- Rahu amplifies obsessively.
- Ketu detaches or spiritualizes.
- Jupiter-Saturn axis:
  - Jupiter = where blessings flow
  - Saturn = where karma demands work
- Nakshatra lord chain:
  Moon → its nakshatra lord → that lord’s nakshatra lord.
- Planets in the same nakshatra share a karmic bond.
- Dispositor chain reveals ultimate controller.
- Time events using:
  - Dasha lord transiting natal placements
  - Transit over natal dasha lord
  - Saturn/Jupiter transit triggers

STRICT REMEDY RULES (NON-NEGOTIABLE):
NEVER suggest:
- Mantras
- Gemstones
- Pujas
- Havans
- Yantras
- Temple donations
- Ritual fasting
- Wearing colors on specific days
- Any religious or ritualistic remedies

MODERN REMEDY SYSTEM (ONLY THIS):
Remedies must be:
- Psychological
- Behavioral
- Skill-based
- Practical
- Self-development focused

Examples:
- Weak Mercury → journaling, public speaking, reading habit, communication workshops
- Weak Venus → creative hobbies, grooming, art/music, relationship therapy
- Weak Mars → gym, martial arts, assertiveness training, competitive sports
- Weak Jupiter → mentoring, higher education, philosophy, teaching
- Weak Saturn → strict routines, time-blocking, therapy, long-term planning
- Weak Moon → meditation apps, sleep hygiene, emotional regulation training
- Weak Sun → leadership roles, confidence training, boundary setting
- Rahu imbalance → digital detox, grounding practices
- Ketu imbalance → volunteering, purpose-driven work, mindfulness

Frame remedies as:
“Here’s what you need to work on.”

RESPONSE STYLE:
- Use emojis (but don’t overdo it)
- Short paragraphs
- Clean markdown structure
- Punchy sentences
- Simple language
- No academic jargon
- No walls of text
- Honest but constructive
- No fear-based predictions
- No overpromising

OUTPUT STRUCTURE FOR CHART READINGS:

### Core Pattern
Explain dominant planetary theme.

### Personality Blueprint
Backed by placements.

### Career & Money
Cite houses, lords, Nadi relationships.

### Relationships
7th house, Venus, Jupiter, Nadi links.

### Current Dasha Impact
Specific timing insight.

### Challenges
Direct but constructive.

### What You Need to Work On
Modern remedies only.

NON-ASTROLOGY QUESTIONS:
- Answer clearly.
- If chart exists, connect to placements.
- If no chart is provided, do not fabricate astrology.

ETHICAL BOUNDARIES:
- No medical diagnosis
- No legal advice
- No death predictions
- No guaranteed outcomes
- No fear manipulation

Final Principle:
Astrova reads charts like data.
Speaks like a friend.
Predicts like a Nadi astrologer.
Guides like a modern psychologist.

No fluff.
No superstition.
Only sharp, grounded astrology.
`;

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
      if (p.nakshatra) prompt += ` Nakshatra: ${p.nakshatra} Pada-${p.nakshatra_pada} (Lord: ${p.nakshatra_lord})`;
      if (p.navamsa_sign) prompt += ` Navamsa: ${p.navamsa_sign}`;
    }
    
    const aspectDefs = [
      { name: 'Conjunction', angle: 0, orb: 10 },
      { name: 'Opposition', angle: 180, orb: 10 },
      { name: 'Trine', angle: 120, orb: 8 },
      { name: 'Square', angle: 90, orb: 8 },
      { name: 'Sextile', angle: 60, orb: 6 },
    ];
    const planetNames = Object.keys(kundaliData.planets);
    const aspectsList: string[] = [];
    for (let i = 0; i < planetNames.length; i++) {
      for (let j = i + 1; j < planetNames.length; j++) {
        const p1 = kundaliData.planets[planetNames[i]];
        const p2 = kundaliData.planets[planetNames[j]];
        let angle = Math.abs(p1.longitude - p2.longitude);
        if (angle > 180) angle = 360 - angle;
        for (const ad of aspectDefs) {
          if (Math.abs(angle - ad.angle) <= ad.orb) {
            aspectsList.push(`${planetNames[i]}-${planetNames[j]}: ${ad.name} (${Math.round(angle)}°)`);
            break;
          }
        }
      }
    }
    if (aspectsList.length > 0) {
      prompt += `\n\n--- PLANETARY ASPECTS ---`;
      for (const a of aspectsList) prompt += `\n${a}`;
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
              prompt += `\nAll Pratyantardashas in ${currentAD.planet} Antardasha:`;
              for (const pad of currentAD.pratyantardashas) {
                const padStart = new Date(pad.start_datetime || pad.start_date);
                const padEnd = pad.end_datetime ? new Date(pad.end_datetime) : new Date(pad.end_date || '');
                const isPadCurrent = now >= padStart && now < padEnd;
                prompt += `\n    ${pad.planet}: ${pad.start_date} to ${pad.end_date}${isPadCurrent ? ' [CURRENT]' : ''}`;
              }
            }
          }
          prompt += `\nAll Antardashas in current Mahadasha:`;
          for (const ad of currentPeriod.antardashas) {
            const adStart = new Date(ad.start_datetime || ad.start_date);
            const adEnd = ad.end_datetime ? new Date(ad.end_datetime) : new Date(ad.end_date || '');
            const isAdCurrent = now >= adStart && now < adEnd;
            prompt += `\n  ${ad.planet}: ${ad.start_date} to ${ad.end_date} (${ad.years?.toFixed(2)}y)${isAdCurrent ? ' [CURRENT]' : ''}`;
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

export function AstrovaSidebar({ kundaliData, chartName, isOpen, onToggle, onNavigate, onLoadChart, onGenerateChart, savedCharts, matchData }: AstrovaSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { credits, deductCredits, showBuyModal, setShowBuyModal } = useCredits();
  const { astrovaUser } = useAuth();
  const astrovaUserId = astrovaUser?.id || '';

  // Chat history state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Model selection state
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Load model from admin config or user preference
  useEffect(() => {
    async function loadModel() {
      if (astrovaUserId) {
        const savedModel = await getUserSetting(astrovaUserId, 'selected_model');
        if (savedModel && typeof savedModel === 'string') {
          setSelectedModel(savedModel);
          return;
        }
      }
      const adminModel = await getAdminConfig('selected_model');
      if (adminModel && typeof adminModel === 'string') {
        setSelectedModel(adminModel);
      } else {
        const models = await getUserEnabledModels();
        if (models.length > 0) setSelectedModel(models[0].model_id);
      }
    }
    loadModel();
  }, [astrovaUserId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onToggle();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Auto-send compatibility analysis when matchData arrives
  const lastMatchRef = useRef<string>('');
  useEffect(() => {
    if (!matchData || !isOpen) return;
    const matchKey = `${matchData.chart1Name}-${matchData.chart2Name}`;
    if (lastMatchRef.current === matchKey) return;
    lastMatchRef.current = matchKey;
    const overall = matchData.scores.find(s => s.category === 'Overall Compatibility');
    const pct = overall ? Math.round((overall.score / overall.maxScore) * 100) : 0;
    sendMessage(`Compatibility analysis done for ${matchData.chart1Name} and ${matchData.chart2Name} (${pct}% match, ${overall?.score || 0}/${overall?.maxScore || 36}). Give a brief compatibility reading based on the Ashtakoota scores. Keep it concise.`);
  }, [matchData, isOpen]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom && messages.length > 3);
  }, [messages.length]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

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
        throw new Error('OpenRouter API key not configured.');
      }
      const modelToUse = selectedModel || 'google/gemini-2.0-flash-001';

      // Search knowledge base for relevant context
      let kbContext = '';
      try {
        const kbResults = await searchKnowledgeBase(messageText.trim());
        if (kbResults.length > 0) {
          kbContext = kbResults.map(r => `[${r.category.toUpperCase()}] ${r.title}:\n${r.content}`).join('\n\n');
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
      } catch { /* KB search is optional */ }

      // Web search is always available to the model automatically

      let systemPrompt = buildSystemPrompt(kundaliData, chartName, kbContext || undefined);
      if (matchData) {
        systemPrompt += `\n\n--- COMPATIBILITY ANALYSIS ---`;
        systemPrompt += `\nPerson 1: ${matchData.chart1Name} | Person 2: ${matchData.chart2Name}`;
        systemPrompt += `\nAshtakoota Scores:`;
        matchData.scores.forEach(s => {
          systemPrompt += `\n  ${s.category}: ${s.score}/${s.maxScore} — ${s.description}`;
        });
      }
      const conversationMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.filter(m => m.role !== 'tool').map(m => ({ role: (m.role === 'tool' ? 'user' : m.role) as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: messageText.trim() },
      ];

      // Create placeholder for streaming
      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Streaming fetch
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Astrova - Vedic Astrology',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: conversationMessages,
          max_tokens: 2048,
          temperature: 0.7,
          stream: true,
          plugins: [{ id: 'web' }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: { message?: string } })?.error?.message || `API error: ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                setMessages(prev => prev.map(m => 
                  m.id === assistantId ? { ...m, content: fullContent } : m
                ));
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      // Finalize streaming
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: fullContent || 'I could not generate a response. Please try again.', isStreaming: false } : m
      ));

    } catch (err) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => {
        // Remove any empty streaming message
        const filtered = prev.filter(m => !(m.isStreaming && !m.content));
        return [...filtered, errorMessage];
      });
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

  const parseBirthDetails = (text: string): { date: string; time: string; lat: number; lon: number; name?: string } | null => {
    const dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})/);
    const timeMatch = text.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)/);
    const latMatch = text.match(/lat(?:itude)?[:\s]*(-?\d+\.?\d*)/i);
    const lonMatch = text.match(/lon(?:gitude)?[:\s]*(-?\d+\.?\d*)/i);
    
    if (dateMatch && timeMatch) {
      let dateStr = dateMatch[0].replace(/\//g, '-');
      const parts = dateStr.split('-');
      if (parts[0].length <= 2 && parts.length === 3) {
        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return {
        date: dateStr,
        time: timeMatch[1],
        lat: latMatch ? parseFloat(latMatch[1]) : 28.6139,
        lon: lonMatch ? parseFloat(lonMatch[1]) : 77.2090,
      };
    }
    return null;
  };

  const handleGenerateFromChat = (text: string) => {
    const details = parseBirthDetails(text);
    if (details && onGenerateChart) {
      onGenerateChart(details);
      const toolMsg: ChatMessage = {
        id: `tool-gen-${Date.now()}`,
        role: 'tool',
        content: `Generated chart for ${details.date} ${details.time}`,
        toolName: 'Chart Generator',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, toolMsg]);
    }
  };


  // Floating toggle button when sidebar is closed
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 bottom-20 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border border-amber-400/50 shadow-lg shadow-amber-500/25 flex items-center justify-center hover:scale-110 transition-all duration-200 group"
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
    <div className="flex flex-col h-full bg-[hsl(220,10%,7%)] backdrop-blur-xl border-l border-[hsl(220,8%,18%)]">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[hsl(220,8%,18%)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">Astrova</h3>
            <p className="text-[10px] text-neutral-500 leading-tight">
              {kundaliData ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  Reading {chartName ? <span className="text-amber-300 font-medium">{chartName}</span> : <span className="text-neutral-400">{kundaliData.lagna.sign} Lagna</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                  No chart loaded
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditsDisplay compact />
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="h-7 w-7 p-0 text-neutral-500 hover:text-white hover:bg-white/5"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 w-7 p-0 text-neutral-500 hover:text-white hover:bg-white/5"
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/20 flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7 text-amber-400/70" />
            </div>
            <h3 className="text-white font-semibold text-base mb-1">Astrova</h3>
            <p className="text-neutral-500 text-[10px] mb-0.5">Your Modern Astrologer</p>
            <p className="text-neutral-500 text-xs mb-5 max-w-[220px]">
              {kundaliData
                ? 'Ask me about your birth chart, dashas, strengths, and more.'
                : 'Generate a chart first to get personalized readings.'}
            </p>

            {kundaliData && (
              <div className="grid grid-cols-2 gap-2 w-full">
                {QUICK_PROMPTS.map((qp) => {
                  const Icon = qp.icon;
                  return (
                    <button
                      key={qp.label}
                      onClick={() => sendMessage(qp.prompt)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] text-neutral-300 text-[11px] font-medium hover:bg-[hsl(220,10%,13%)] hover:border-[hsl(220,8%,24%)] hover:text-white transition-all duration-200 text-left group"
                    >
                      <Icon className={`w-3.5 h-3.5 ${qp.color} shrink-0 group-hover:scale-110 transition-transform`} />
                      <span>{qp.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="w-full">
                {/* User message */}
                {msg.role === 'user' && (
                  <div className="flex flex-col items-end mb-3 gap-1">
                    <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[hsl(220,10%,14%)] border border-[hsl(220,8%,20%)]">
                      <p className="text-white/90 text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    {parseBirthDetails(msg.content) && onGenerateChart && (
                      <button
                        onClick={() => handleGenerateFromChat(msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium hover:bg-amber-500/20 transition-colors"
                      >
                        <LayoutGrid className="w-3 h-3" />
                        Generate Chart
                      </button>
                    )}
                  </div>
                )}
                
                {/* Tool message */}
                {msg.role === 'tool' && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {msg.toolName === 'Knowledge Base' ? (
                        <BookOpen className="w-3 h-3 text-amber-400" />
                      ) : msg.toolName === 'Internet Access' ? (
                        <Globe className="w-3 h-3 text-blue-400" />
                      ) : (
                        <LayoutGrid className="w-3 h-3 text-emerald-400" />
                      )}
                      <span className="text-neutral-400 font-medium">{msg.content}</span>
                    </div>
                  </div>
                )}

                {/* Assistant message */}
                {msg.role === 'assistant' && (
                  <div className="mb-4">
                    <div 
                      className="prose prose-invert prose-sm max-w-none text-neutral-200
                        [&_h1]:text-white [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-0
                        [&_h2]:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3
                        [&_h3]:text-white [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-1 [&_h3]:mt-2
                        [&_p]:text-neutral-300 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2
                        [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:text-sm
                        [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:text-sm
                        [&_li]:text-neutral-300 [&_li]:text-sm [&_li]:mb-1
                        [&_strong]:text-white [&_strong]:font-semibold
                        [&_em]:text-amber-300
                        [&_code]:text-amber-300 [&_code]:bg-[hsl(220,10%,14%)] [&_code]:px-1 [&_code]:rounded [&_code]:text-xs
                        [&_pre]:bg-[hsl(220,10%,10%)] [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto
                        [&_blockquote]:border-l-2 [&_blockquote]:border-amber-500/50 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-400
                      "
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                      {msg.isStreaming && !msg.content && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </div>
                      )}
                      {msg.isStreaming && msg.content && (
                        <span className="inline-block w-1.5 h-4 bg-amber-400/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && !messages.some(m => m.isStreaming) && (
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}

        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[hsl(220,10%,12%)] border border-[hsl(220,8%,22%)] flex items-center justify-center hover:bg-[hsl(220,10%,18%)] transition-colors shadow-lg"
          >
            <ChevronDown className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>

      {/* Tools Bar */}
      <div className="flex gap-1 px-3 py-1.5 border-t border-[hsl(220,8%,15%)] overflow-x-auto scrollbar-thin">
        {onNavigate && (
          <>
            <button
              onClick={() => onNavigate?.('kundali')}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] hover:bg-amber-500/20 transition-all"
            >
              <LayoutGrid className="w-3 h-3" /> Charts
            </button>
            <button
              onClick={() => onNavigate?.('matcher')}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[10px] hover:bg-pink-500/20 transition-all"
            >
              <Heart className="w-3 h-3" /> Matcher
            </button>
          </>
        )}
        {savedCharts && savedCharts.length > 0 && onLoadChart && (
          <div className="relative group shrink-0">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[hsl(220,10%,12%)] border border-[hsl(220,8%,20%)] text-neutral-400 text-[10px] hover:bg-[hsl(220,10%,16%)] hover:text-white transition-all"
            >
              <FolderOpen className="w-3 h-3" /> Load Chart
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-[100] min-w-[140px] max-h-[160px] overflow-y-auto bg-[hsl(220,10%,9%)] border border-[hsl(220,8%,20%)] rounded-lg shadow-xl">
              {savedCharts.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onLoadChart?.(c.id); onNavigate?.('kundali'); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-amber-500/10 transition-colors ${
                    chartName === c.name ? 'text-amber-300 font-medium' : 'text-neutral-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-[hsl(220,8%,15%)]">
        {insufficientCredits && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] text-center">
            Insufficient credits. Purchase more to continue.
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={kundaliData ? 'Ask Astrova...' : 'Load a chart first...'}
              disabled={isLoading || !kundaliData}
              rows={1}
              className="w-full bg-[hsl(220,10%,11%)] border border-[hsl(220,8%,20%)] rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15 transition-all resize-none disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] max-h-[120px]"
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
            className="h-11 w-11 p-0 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-0 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition-all shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Buy Credits Modal */}
      <BuyCreditsModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </div>
  );
}

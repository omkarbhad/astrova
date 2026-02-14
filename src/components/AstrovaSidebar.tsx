import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, BookOpen, PanelRightClose, Trash2, Eye, Briefcase, HeartPulse, Activity, Clock, Dumbbell, Home, Pill, ChevronDown, ChevronRight, Copy, Check, Square, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { useCredits, CreditsDisplay } from '@/contexts/CreditsContext';
import { BuyCreditsModal } from './BuyCreditsModal';
import type { KundaliResponse } from '../types/kundali';
import { searchKnowledgeBase, getAdminConfig, getUserEnabledModels } from '../lib/supabase';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  kbResults?: { title: string; category: string; content: string }[];
  isStreaming?: boolean;
  thinking?: string;
  showThinking?: boolean;
  thinkingDuration?: number;
}

interface MatchDataRef {
  chart1Name: string;
  chart2Name: string;
  chart1?: KundaliResponse;
  chart2?: KundaliResponse;
  scores: { category: string; score: number; maxScore: number; description: string }[];
}

interface AstrovaSidebarProps {
  kundaliData: KundaliResponse | null;
  chartName?: string;
  isOpen: boolean;
  onToggle: () => void;
  onGenerateChart?: (data: { date: string; time: string; lat: number; lon: number; name?: string }) => void;
  matchData?: MatchDataRef | null;
}

const CHART_PROMPTS = [
  { label: 'Overview', prompt: 'Give me a full overview of my birth chart', icon: Eye, color: 'text-amber-400' },
  { label: 'Career', prompt: 'What does my chart say about my career?', icon: Briefcase, color: 'text-blue-400' },
  { label: 'Love', prompt: 'Tell me about love and marriage in my chart', icon: HeartPulse, color: 'text-pink-400' },
  { label: 'Health', prompt: 'What are the health indicators in my chart?', icon: Activity, color: 'text-green-400' },
  { label: 'Dasha', prompt: 'Analyze my current dasha period and antardashas', icon: Clock, color: 'text-purple-400' },
  { label: 'Strengths', prompt: 'Show me my planetary strengths (Shadbala)', icon: Dumbbell, color: 'text-orange-400' },
  { label: 'Houses', prompt: 'Analyze my house strengths (Bhava Bala)', icon: Home, color: 'text-cyan-400' },
  { label: 'Remedies', prompt: 'What remedies do you suggest for my chart?', icon: Pill, color: 'text-emerald-400' },
];

const GENERAL_PROMPTS = [
  { label: 'What is Vedic?', prompt: 'What is Vedic astrology and how is it different from Western astrology?', icon: Eye, color: 'text-amber-400' },
  { label: 'Houses', prompt: 'Explain the 12 houses in Vedic astrology briefly', icon: Home, color: 'text-cyan-400' },
  { label: 'Planets', prompt: 'What do the 9 planets (Navagraha) signify in Vedic astrology?', icon: Activity, color: 'text-green-400' },
  { label: 'Doshas', prompt: 'What are common doshas like Mangal Dosha and Sade Sati?', icon: HeartPulse, color: 'text-pink-400' },
];

export function buildSystemPrompt(kundaliData: KundaliResponse | null, chartName?: string, kbContext?: string): string {
  let prompt = `You are Astrova — a sharp, modern Vedic astrologer. You read charts like a pro and talk like a trusted friend.

RULES:
- Default: 2-4 sentences. Short, punchy, no filler.
- Only give long responses when user says "explain", "detail", "full", "elaborate", "tell me more".
- Talk like a smart friend: "Your Mars in 10th is fire for career" not "Mars positioned in the 10th bhava indicates..."
- Bold key placements. Keep it scannable.
- Always cite actual planet, sign, house from chart data. Never fabricate.
- Use Parashara system, Shadbala, Bhava Bala, Vimshottari Dasha, Nakshatras, Yogas.
- Remedies: only modern practical ones (therapy, gym, journaling, meditation, skill-building, routines). No mantras, gemstones, pujas, rituals.
- No medical/legal advice, no death predictions, no fear tactics.
- Non-astrology questions: answer normally, connect to chart briefly if loaded.
- No chart loaded: give general astrology knowledge, don't make up placements.
- Use emojis where appropriate.
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
  }

  if (kbContext) {
    prompt += `\n\n--- KNOWLEDGE BASE CONTEXT ---`;
    prompt += `\nUse the following reference material to enhance your answer:`;
    prompt += `\n${kbContext}`;
  }

  return prompt;
}

function parseBirthDetailsFromText(text: string): { date: string; time: string; lat: number; lon: number; name?: string } | null {
  // Match date patterns: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
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
}

export function AstrovaSidebar({ kundaliData, chartName, isOpen, onToggle, onGenerateChart, matchData }: AstrovaSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { credits, creditCosts, deductCredits, showBuyModal, setShowBuyModal } = useCredits();

  // Model selection state
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load default model
  useEffect(() => {
    async function loadModels() {
      const models = await getUserEnabledModels();
      const adminModel = await getAdminConfig('default_model');
      if (adminModel && typeof adminModel === 'string') {
        setSelectedModel(adminModel);
      } else if (models.length > 0) {
        setSelectedModel(models[0].model_id);
      } else {
        setSelectedModel('stepfun/step-3.5-flash:free');
      }
    }
    loadModels();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setIsLoading(false);
          setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
        }
        onToggle();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const lastMatchRef = useRef<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom && messages.length > 3);
  }, [messages.length]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    // Ensure we have a valid model
    if (!selectedModel) {
      setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'assistant' as const, content: 'Model not loaded. Please refresh the page.', timestamp: new Date() }]);
      return;
    }

    if (!deductCredits(creditCosts.AI_MESSAGE, 'ai_message')) {
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
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Auto-detect birth details and generate chart
    if (!kundaliData && onGenerateChart) {
      const birthDetails = parseBirthDetailsFromText(messageText);
      if (birthDetails) {
        onGenerateChart(birthDetails);
        const toolMsg: ChatMessage = {
          id: `chart-gen-${Date.now()}`,
          role: 'tool',
          content: `Chart generated for ${birthDetails.date} ${birthDetails.time}`,
          toolName: 'Chart Generator',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, toolMsg]);
      }
    }

    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured.');
      }
      const modelToUse = selectedModel;

      // Search knowledge base only for astrology-related queries
      let kbContext = '';
      const astroKeywords = /\b(planet|house|bhava|dasha|nakshatra|yoga|dosha|lagna|ascendant|sign|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|shadbala|bhava bala|transit|remedy|remedies|matching|compatibility|horoscope|chart|kundali|vedic|astrology|mangal|sade sati|mahadasha|antardasha|navamsa|arudha|atmakaraka|combustion|retrograde|exalt|debilit|nadi|muhurta|pushkara|gandanta)\b/i;
      if (astroKeywords.test(messageText)) {
        try {
          const kbResults = await searchKnowledgeBase(messageText.trim());
          if (kbResults.length > 0) {
            kbContext = kbResults.map(r => `[${r.category.toUpperCase()}] ${r.title}:\n${r.content}`).join('\n\n');
            const toolMsg: ChatMessage = {
              id: `kb-${Date.now()}`,
              role: 'tool',
              content: `Found ${kbResults.length} relevant article${kbResults.length > 1 ? 's' : ''}`,
              toolName: 'Knowledge Base',
              kbResults: kbResults.map(r => ({ title: r.title, category: r.category, content: r.content.slice(0, 120) + '...' })),
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, toolMsg]);
          }
        } catch { /* KB search is optional */ }
      }

      // Web search is always available to the model automatically

      let systemPrompt = buildSystemPrompt(kundaliData, chartName, kbContext || undefined);
      if (matchData) {
        systemPrompt += `\n\n--- COMPATIBILITY ANALYSIS ---`;
        systemPrompt += `\n👤 Male: ${matchData.chart1Name}`;
        systemPrompt += `\n👩 Female: ${matchData.chart2Name}`;
        systemPrompt += `\n\nAshtakoota Scores:`;
        matchData.scores.forEach(s => {
          systemPrompt += `\n  ${s.category}: ${s.score}/${s.maxScore} — ${s.description}`;
        });
        // Add both charts' key planetary data for the AI to reference by name
        if (matchData.chart1) {
          systemPrompt += `\n\n--- ${matchData.chart1Name.toUpperCase()}'s CHART (Male) ---`;
          systemPrompt += `\nLagna: ${matchData.chart1.lagna.sign}`;
          for (const [name, p] of Object.entries(matchData.chart1.planets)) {
            systemPrompt += `\n${name}: ${p.sign} H${p.house_whole_sign}${p.nakshatra ? ` Nak:${p.nakshatra}` : ''}${p.retrograde ? ' [R]' : ''}`;
          }
        }
        if (matchData.chart2) {
          systemPrompt += `\n\n--- ${matchData.chart2Name.toUpperCase()}'s CHART (Female) ---`;
          systemPrompt += `\nLagna: ${matchData.chart2.lagna.sign}`;
          for (const [name, p] of Object.entries(matchData.chart2.planets)) {
            systemPrompt += `\n${name}: ${p.sign} H${p.house_whole_sign}${p.nakshatra ? ` Nak:${p.nakshatra}` : ''}${p.retrograde ? ' [R]' : ''}`;
          }
        }
        systemPrompt += `\n\nIMPORTANT: Always refer to the couple by their names (${matchData.chart1Name} and ${matchData.chart2Name}). Analyze their compatibility using both charts.`;
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

      // Streaming fetch with abort controller
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
          max_tokens: 4096,
          temperature: 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: { message?: string } })?.error?.message || `API error: ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let thinkingContent = '';
      let thinkingStartTime = 0;

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
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.reasoning) {
                if (!thinkingStartTime) thinkingStartTime = Date.now();
                thinkingContent += delta.reasoning;
                setMessages(prev => prev.map(m => 
                  m.id === assistantId ? { ...m, thinking: thinkingContent } : m
                ));
              }
              if (delta?.content) {
                fullContent += delta.content;
                setMessages(prev => prev.map(m => 
                  m.id === assistantId ? { ...m, content: fullContent } : m
                ));
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      // Finalize streaming
      const thinkDuration = thinkingStartTime ? Math.round((Date.now() - thinkingStartTime) / 1000) : 0;
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: fullContent || '', isStreaming: false, thinkingDuration: thinkDuration || undefined } : m
      ));

    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
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
      abortControllerRef.current = null;
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
    setMessages([]);
  };

  // Keep sendMessageRef in sync for matchData useEffect
  sendMessageRef.current = sendMessage;

  // Auto-send compatibility analysis when matchData arrives
  useEffect(() => {
    if (!matchData || !isOpen) return;
    const matchKey = `${matchData.chart1Name}-${matchData.chart2Name}`;
    if (lastMatchRef.current === matchKey) return;
    lastMatchRef.current = matchKey;
    const overall = matchData.scores.find(s => s.category === 'Overall Compatibility');
    const pct = overall ? Math.round((overall.score / overall.maxScore) * 100) : 0;
    sendMessageRef.current(`Compatibility: ${matchData.chart1Name} (Male) + ${matchData.chart2Name} (Female) — ${pct}% match (${overall?.score || 0}/${overall?.maxScore || 36}). Give a brief compatibility reading using their names. What works well and what to watch out for?`);
  }, [matchData, isOpen]);

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const retryLastMessage = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // Remove last assistant error message and the user message (will be re-added by sendMessage)
      setMessages(prev => {
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'assistant') { idx = i; break; }
        }
        if (idx >= 0) return prev.slice(0, idx);
        return prev;
      });
      // Skip credit deduction for retry by calling sendMessage with retry flag
      sendMessageRetry(lastUserMsg.content);
    }
  };

  const sendMessageRetry = async (messageText: string) => {
    if (!messageText.trim()) return;
    // No credit deduction for retries — the original attempt already deducted
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    try {
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OpenRouter API key not configured.');
      let kbContext = '';
      const astroKeywords = /\b(planet|house|bhava|dasha|nakshatra|yoga|dosha|lagna|ascendant|sign|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|shadbala|bhava bala|transit|remedy|remedies|matching|compatibility|horoscope|chart|kundali|vedic|astrology)\b/i;
      if (astroKeywords.test(messageText)) {
        try {
          const kbResults = await searchKnowledgeBase(messageText.trim());
          if (kbResults.length > 0) kbContext = kbResults.map(r => `[${r.category.toUpperCase()}] ${r.title}:\n${r.content}`).join('\n\n');
        } catch { /* optional */ }
      }
      const systemPrompt = buildSystemPrompt(kundaliData, chartName, kbContext || undefined);
      const conversationMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.filter(m => m.role !== 'tool').map(m => ({ role: (m.role === 'tool' ? 'user' : m.role) as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: messageText.trim() },
      ];
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }]);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'Astrova - Vedic Astrology' },
        body: JSON.stringify({ model: selectedModel, messages: conversationMessages, max_tokens: 4096, temperature: 0.7, stream: true }),
        signal: controller.signal,
      });
      if (!response.ok) { const ed = await response.json().catch(() => ({})); throw new Error((ed as { error?: { message?: string } })?.error?.message || `API error: ${response.status}`); }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let thinkingContent = '';
      let thinkingStartTime = 0;
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
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.reasoning) { if (!thinkingStartTime) thinkingStartTime = Date.now(); thinkingContent += delta.reasoning; setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, thinking: thinkingContent } : m)); }
              if (delta?.content) { fullContent += delta.content; setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)); }
            } catch { /* skip */ }
          }
        }
      }
      const thinkDuration = thinkingStartTime ? Math.round((Date.now() - thinkingStartTime) / 1000) : 0;
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent || '', isStreaming: false, thinkingDuration: thinkDuration || undefined } : m));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Chat API Error:', err);
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('403')) {
          errorMessage = 'API authentication failed. Please check your API key.';
        } else if (err.message.includes('404') || err.message.includes('model not found')) {
          errorMessage = 'Model not available. Please try a different model.';
        } else if (err.message.includes('429') || err.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }
      setMessages(prev => { const filtered = prev.filter(m => !(m.isStreaming && !m.content)); return [...filtered, { id: `error-${Date.now()}`, role: 'assistant' as const, content: errorMessage, timestamp: new Date() }]; });
    } finally { abortControllerRef.current = null; setIsLoading(false); inputRef.current?.focus(); }
  };

  // Floating toggle button when sidebar is closed
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 bottom-20 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border border-amber-400/50 shadow-lg shadow-amber-500/25 flex items-center justify-center hover:scale-110 transition-all duration-200 group"
        title="Open Astrova AI"
      >
        <img src="/star.png" alt="" className="w-5 h-5 group-hover:animate-pulse" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {(() => { const c = messages.filter(m => m.role === 'assistant').length; return c > 9 ? '9+' : c; })()}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[hsl(220,10%,7%)] backdrop-blur-xl border-l border-[hsl(220,8%,18%)]">
      {/* Sidebar Header */}
      <div className="px-3 py-2.5 border-b border-[hsl(220,8%,18%)]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
              <img src="/star.png" alt="" className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm leading-tight">Astrova</h3>
              <p className="text-[10px] text-neutral-500 leading-tight">
                {kundaliData ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    {chartName ? <span className="text-amber-300 font-medium">{chartName}</span> : <span className="text-neutral-400">{kundaliData.lagna.sign} Lagna</span>}
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
          <div className="flex items-center gap-1">
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
              <img src="/star.png" alt="" className="w-7 h-7" />
            </div>
            <h3 className="text-white font-semibold text-base mb-1">Astrova</h3>
            <p className="text-neutral-500 text-[10px] mb-0.5">Your Modern Astrologer</p>
            <p className="text-neutral-500 text-xs mb-5 max-w-[220px]">
              {kundaliData
                ? 'Ask me about your birth chart, dashas, strengths, and more.'
                : 'Ask about Vedic astrology, or generate a chart for personalized readings.'}
            </p>

            <div className="grid grid-cols-2 gap-2 w-full">
              {(kundaliData ? CHART_PROMPTS : GENERAL_PROMPTS).map((qp) => {
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
                  </div>
                )}
                
                {/* Tool message */}
                {msg.role === 'tool' && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <BookOpen className="w-3 h-3 text-amber-400" />
                      <span className="text-neutral-400 font-medium">{msg.content}</span>
                    </div>
                  </div>
                )}

                {/* Assistant message */}
                {msg.role === 'assistant' && (
                  <div className="mb-4">
                    {/* Thinking tokens - collapsible */}
                    {msg.thinking && (
                      <div className="mb-1.5">
                        {msg.isStreaming && !msg.content ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-400/70">
                            <img src="/star.png" alt="" className="w-4 h-4 animate-spin" style={{ animationDuration: '2s' }} />
                            <span>Thinking...</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, showThinking: !m.showThinking } : m))}
                            className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                          >
                            <ChevronRight className={`w-3 h-3 transition-transform ${msg.showThinking ? 'rotate-90' : ''}`} />
                            <img src="/star.png" alt="" className="w-3 h-3" />
                            <span>Thought{msg.thinkingDuration ? ` for ${msg.thinkingDuration}s` : ''}</span>
                          </button>
                        )}
                        {msg.showThinking && (
                          <div className="mt-1.5 px-3 py-2.5 rounded-xl bg-[hsl(220,10%,9%)] border border-[hsl(220,8%,15%)] text-[11px] text-neutral-400 leading-relaxed max-h-[180px] overflow-y-auto whitespace-pre-wrap">
                            {msg.thinking}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="group/msg">
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
                        {msg.isStreaming && !msg.content && !msg.thinking && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-400/70">
                            <img src="/star.png" alt="" className="w-4 h-4 animate-spin" style={{ animationDuration: '2s' }} />
                            <span>Thinking...</span>
                          </div>
                        )}
                        {msg.isStreaming && msg.content && (
                          <span className="inline-block w-1.5 h-4 bg-amber-400/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                        )}
                      </div>
                      {/* Copy + Retry buttons - hover reveal */}
                      {!msg.isStreaming && msg.content && (
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
                          >
                            {copiedMessageId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedMessageId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                          {msg.id.startsWith('error-') && (
                            <button
                              onClick={retryLastMessage}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-neutral-500 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                            >
                              <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </>
        )}

        {showScrollDown && (
          <div className="sticky bottom-2 flex justify-center pointer-events-none">
            <button
              onClick={scrollToBottom}
              className="pointer-events-auto w-7 h-7 rounded-full bg-[hsl(220,10%,12%)] border border-[hsl(220,8%,22%)] flex items-center justify-center hover:bg-[hsl(220,10%,18%)] transition-colors shadow-lg"
            >
              <ChevronDown className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="px-3 pb-3 pt-2">
        {insufficientCredits && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] text-center">
            Insufficient credits. Purchase more to continue.
          </div>
        )}
        <div className="relative bg-[hsl(220,10%,11%)] border border-[hsl(220,8%,20%)] rounded-2xl focus-within:border-amber-500/40 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all flex items-center">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={kundaliData ? 'Ask Astrova anything...' : 'Ask about Vedic astrology...'}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent px-4 py-0 text-sm text-white placeholder-neutral-500 focus:outline-none resize-none disabled:opacity-40 disabled:cursor-not-allowed h-[44px] text-left leading-[44px]"
          />
          <div className="absolute bottom-1.5 right-2 flex items-center">
            {isLoading ? (
              <Button
                type="button"
                onClick={stopGeneration}
                className="h-7 w-7 p-0 rounded-lg bg-red-600/80 hover:bg-red-600 border-0 shrink-0 transition-all"
                title="Stop generating"
              >
                <Square className="w-3 h-3 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim() || credits < creditCosts.AI_MESSAGE}
                className="h-7 w-7 p-0 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-0 disabled:opacity-20 disabled:cursor-not-allowed shrink-0 transition-all"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Buy Credits Modal */}
      <BuyCreditsModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </div>
  );
}

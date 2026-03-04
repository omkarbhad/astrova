import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, BookOpen, PanelRightClose, Trash2, Eye, Briefcase, HeartPulse, Activity, Clock, Dumbbell, Home, Pill, ChevronDown, ChevronRight, Copy, Check, Square, RefreshCw, Link2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { useCredits, CreditsDisplay } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';
import { BuyCreditsModal } from './BuyCreditsModal';
import type { KundaliResponse } from '../types/kundali';
import { getAdminConfig, getUserEnabledModels, searchKnowledgeBase } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  kbResults?: { title: string; category: string; content: string }[];
  isStreaming?: boolean;
  thinking?: string;
  thinkingDuration?: number;
}

interface MatchDataRef {
  chart1Name: string;
  chart2Name: string;
  chart1?: KundaliResponse;
  chart2?: KundaliResponse;
  scores: { category: string; score: number; maxScore: number; description: string }[];
}

function formatCoordinate(value: number, positiveHemisphere: string, negativeHemisphere: string): string {
  const hemisphere = value >= 0 ? positiveHemisphere : negativeHemisphere;
  return `${Math.abs(value).toFixed(4)}°${hemisphere}`;
}

type DashaPeriod = KundaliResponse['dasha']['periods'][number];
type Antardasha = NonNullable<DashaPeriod['antardashas']>[number];
type Pratyantardasha = NonNullable<Antardasha['pratyantardashas']>[number];

function getCurrentDashaContext(chart: KundaliResponse): {
  currentPeriod?: DashaPeriod;
  currentAntardasha?: Antardasha;
  currentPratyantardasha?: Pratyantardasha;
  nextAntardasha?: Antardasha;
  nextPratyantardasha?: Pratyantardasha;
} {
  const dasha = chart.dasha;
  const currentPeriod = dasha.periods.find(p => p.is_current);
  if (!currentPeriod?.antardashas) {
    return { currentPeriod };
  }

  const now = new Date();
  const currentAntardasha = currentPeriod.antardashas.find(ad => {
    const s = new Date(ad.start_datetime || ad.start_date);
    const e = ad.end_datetime ? new Date(ad.end_datetime) : new Date(ad.end_date || '');
    return now >= s && now < e;
  });

  const nextAntardasha = currentPeriod.antardashas.find(ad => {
    const s = new Date(ad.start_datetime || ad.start_date);
    return s > now;
  });

  const currentPratyantardasha = currentAntardasha?.pratyantardashas?.find(pad => {
    const s = new Date(pad.start_datetime || pad.start_date);
    const e = pad.end_datetime ? new Date(pad.end_datetime) : new Date(pad.end_date || '');
    return now >= s && now < e;
  });

  const nextPratyantardasha = currentAntardasha?.pratyantardashas?.find(pad => {
    const s = new Date(pad.start_datetime || pad.start_date);
    return s > now;
  });

  return { currentPeriod, currentAntardasha, currentPratyantardasha, nextAntardasha, nextPratyantardasha };
}

export function buildMatchContextPrompt(matchData?: MatchDataRef | null): string {
  if (!matchData) return '';

  const getChartSnapshot = (label: string, chart?: KundaliResponse): string => {
    if (!chart) return '';

    const strongPlanets = chart.shad_bala
      ? Object.entries(chart.shad_bala)
          .sort((a, b) => (b[1].total_rupas ?? 0) - (a[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([name, b]) => `${name} (${b.total_rupas ?? 0}r)`)
      : [];
    const weakPlanets = chart.shad_bala
      ? Object.entries(chart.shad_bala)
          .sort((a, b) => (a[1].total_rupas ?? 0) - (b[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([name, b]) => `${name} (${b.total_rupas ?? 0}r)`)
      : [];
    const strongHouses = chart.bhava_bala
      ? Object.entries(chart.bhava_bala)
          .sort((a, b) => (b[1].total_rupas ?? 0) - (a[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([house, b]) => `H${house} ${b.sign} (${b.total_rupas ?? 0}r)`)
      : [];
    const weakHouses = chart.bhava_bala
      ? Object.entries(chart.bhava_bala)
          .sort((a, b) => (a[1].total_rupas ?? 0) - (b[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([house, b]) => `H${house} ${b.sign} (${b.total_rupas ?? 0}r)`)
      : [];

    const { currentPeriod, currentAntardasha, currentPratyantardasha, nextAntardasha } = getCurrentDashaContext(chart);

    let text = `\n\n--- ${label.toUpperCase()}'s SNAPSHOT ---`;
    text += `\nBirth: ${chart.birth.date} ${chart.birth.time} (UTC${chart.birth.tz_offset_hours >= 0 ? '+' : ''}${chart.birth.tz_offset_hours}, Adjusted UTC${chart.birth.adjusted_tz_offset_hours >= 0 ? '+' : ''}${chart.birth.adjusted_tz_offset_hours}${chart.birth.dst_applied ? ', DST applied' : ''})`;
    text += `\nLocation: ${formatCoordinate(chart.birth.latitude, 'N', 'S')}, ${formatCoordinate(chart.birth.longitude, 'E', 'W')}`;
    text += `\nAyanamsha: ${chart.meta.ayanamsha} (${chart.meta.ayanamsha_deg.toFixed(4)}°)`;
    text += `\nLagna: R:${chart.lagna.sign} (${chart.lagna.sign_sanskrit}) ${chart.lagna.deg}°${chart.lagna.min}'${chart.lagna.sec}"`;
    if (chart.planets.Moon) text += `\nMoon: R:${chart.planets.Moon.sign} H:${chart.planets.Moon.house_whole_sign}${chart.planets.Moon.nakshatra ? ` Nak:${chart.planets.Moon.nakshatra} P${chart.planets.Moon.nakshatra_pada}` : ''}`;
    if (chart.planets.Venus) text += `\nVenus: R:${chart.planets.Venus.sign} H:${chart.planets.Venus.house_whole_sign}`;
    if (chart.planets.Mars) text += `\nMars: R:${chart.planets.Mars.sign} H:${chart.planets.Mars.house_whole_sign}`;
    if (chart.planets.Jupiter) text += `\nJupiter: R:${chart.planets.Jupiter.sign} H:${chart.planets.Jupiter.house_whole_sign}`;
    if (chart.planets.Saturn) text += `\nSaturn: R:${chart.planets.Saturn.sign} H:${chart.planets.Saturn.house_whole_sign}`;

    if (chart.dasha) {
      text += `\nCurrent Mahadasha: ${chart.dasha.current_dasha}`;
      if (currentPeriod) text += `\nCurrent Mahadasha Window: ${currentPeriod.start_date} to ${currentPeriod.end_date}`;
      if (currentAntardasha) text += `\nCurrent Antardasha: ${currentAntardasha.planet} (${currentAntardasha.start_date} to ${currentAntardasha.end_date})`;
      if (currentPratyantardasha) text += `\nCurrent Pratyantardasha: ${currentPratyantardasha.planet} (${currentPratyantardasha.start_date} to ${currentPratyantardasha.end_date})`;
      if (nextAntardasha) text += `\nNext Antardasha: ${nextAntardasha.planet} (${nextAntardasha.start_date} to ${nextAntardasha.end_date})`;
    }

    if (strongPlanets.length) text += `\nStrong Planets: ${strongPlanets.join(', ')}`;
    if (weakPlanets.length) text += `\nWeak Planets: ${weakPlanets.join(', ')}`;
    if (strongHouses.length) text += `\nStrong Houses: ${strongHouses.join(', ')}`;
    if (weakHouses.length) text += `\nWeak Houses: ${weakHouses.join(', ')}`;

    text += `\n\nCore Planetary Positions:`;
    for (const [name, p] of Object.entries(chart.planets)) {
      const flags = [];
      if (p.retrograde) flags.push('R');
      if (p.exalted) flags.push('Exalted');
      if (p.debilitated) flags.push('Debilitated');
      if (p.vargottama) flags.push('Vargottama');
      if (p.combust) flags.push('Combust');
      text += `\n${name}: R:${p.sign} H:${p.house_whole_sign}${p.nakshatra ? ` Nak:${p.nakshatra}${p.nakshatra_pada ? ` P${p.nakshatra_pada}` : ''}${p.nakshatra_lord ? ` (Lord:${p.nakshatra_lord})` : ''}` : ''}${p.navamsa_sign ? ` Navamsa:${p.navamsa_sign}` : ''}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
    }

    // Include Upagrahas if present
    if (chart.upagrahas && Object.keys(chart.upagrahas).length > 0) {
      text += `\n\nUpagrahas:`;
      for (const [name, u] of Object.entries(chart.upagrahas)) {
        text += `\n${name}: R:${u.sign} H:${u.house_whole_sign}${u.nakshatra ? ` Nak:${u.nakshatra}` : ''}`;
      }
    }

    // Include full dasha timeline
    if (chart.dasha) {
      text += `\n\nAll Mahadashas:`;
      for (const md of chart.dasha.periods) {
        text += `\n- ${md.planet}: ${md.start_date} to ${md.end_date}${md.is_current ? ' (CURRENT)' : ''}`;
      }
      const currentPeriod = chart.dasha.periods.find(p => p.is_current);
      if (currentPeriod?.antardashas) {
        text += `\nAll Antardashas in Current Mahadasha (${currentPeriod.planet}):`;
        const now = new Date();
        const currentAD = currentPeriod.antardashas.find(ad => {
          const s = new Date(ad.start_datetime || ad.start_date);
          const e = ad.end_datetime ? new Date(ad.end_datetime) : new Date(ad.end_date || '');
          return now >= s && now < e;
        });
        for (const ad of currentPeriod.antardashas) {
          const isCurrentAD = currentAD && ad.planet === currentAD.planet && ad.start_date === currentAD.start_date;
          text += `\n- ${ad.planet}: ${ad.start_date} to ${ad.end_date}${isCurrentAD ? ' (CURRENT)' : ''}`;
        }
        if (currentAD?.pratyantardashas && currentAD.pratyantardashas.length > 0) {
          text += `\nAll Pratyantardashas in Current Antardasha:`;
          for (const pad of currentAD.pratyantardashas) {
            text += `\n- ${pad.planet}: ${pad.start_date} to ${pad.end_date}`;
          }
        }
      }
    }

    // Include Shadbala and Bhava Bala summaries
    if (chart.shad_bala) {
      text += `\n\nShadbala Summary:`;
      for (const [name, bala] of Object.entries(chart.shad_bala)) {
        const sthana = typeof bala.sthana_bala === 'number' ? bala.sthana_bala : bala.sthana_bala.total;
        const kala = typeof bala.kala_bala === 'number' ? bala.kala_bala : bala.kala_bala.total;
        text += `\n${name}: ${bala.total_rupas ?? 0}r - ${bala.strength} (Sthana:${sthana ?? 0}, Dig:${bala.dig_bala ?? 0}, Kala:${kala ?? 0}, Chesta:${bala.chesta_bala ?? 0}, Naisargika:${bala.naisargika_bala ?? 0}, Drik:${bala.drik_bala ?? 0})`;
      }
    }
    if (chart.bhava_bala) {
      text += `\n\nBhava Bala Summary:`;
      for (const [house, bala] of Object.entries(chart.bhava_bala)) {
        text += `\nHouse ${house} (${bala.sign}): ${bala.total_rupas ?? 0}r - ${bala.rating} (Lord:${bala.lord}, Bhavadhipati:${bala.bhavadhipati_bala ?? 0}, Dig:${bala.bhava_digbala ?? 0}, Drishti:${bala.bhava_drishti_bala ?? 0})`;
      }
    }

    // Include Yogas if any
    if (chart.yogas && chart.yogas.length > 0) {
      text += `\n\nYogas:`;
      for (const yoga of chart.yogas) {
        text += `\n${yoga.name} [${yoga.type}/${yoga.strength}]: ${yoga.description}`;
      }
    }

    return text;
  };

  const baseScores = matchData.scores.filter(s => s.category !== 'Overall Compatibility');
  const totalScore = baseScores.reduce((sum, s) => sum + s.score, 0);
  const maxTotalScore = baseScores.reduce((sum, s) => sum + s.maxScore, 0) || 36;
  const percentage = Math.round((totalScore / maxTotalScore) * 100);
  const compatibilityBand = percentage >= 75 ? 'High' : percentage >= 55 ? 'Moderate' : 'Challenging';

  let prompt = `\n\n--- COMPATIBILITY ANALYSIS ---`;
  prompt += `\n${matchData.chart1Name} & ${matchData.chart2Name}`;
  prompt += `\nTotal Score: ${totalScore}/${maxTotalScore} (${percentage}%)`;
  prompt += `\nCompatibility Band: ${compatibilityBand}`;
  prompt += `\n\nAshtakoota Scores:`;
  matchData.scores.forEach(s => {
    prompt += `\n  ${s.category}: ${s.score}/${s.maxScore} — ${s.description}`;
  });

  const topScores = [...matchData.scores]
    .filter(s => s.maxScore > 0)
    .sort((a, b) => (b.score / b.maxScore) - (a.score / a.maxScore))
    .slice(0, 3)
    .map(s => `${s.category} (${s.score}/${s.maxScore})`);
  const lowScores = [...matchData.scores]
    .filter(s => s.maxScore > 0)
    .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
    .slice(0, 3)
    .map(s => `${s.category} (${s.score}/${s.maxScore})`);

  if (topScores.length) prompt += `\nTop Compatibility Areas: ${topScores.join(', ')}`;
  if (lowScores.length) prompt += `\nFriction Areas: ${lowScores.join(', ')}`;

  prompt += getChartSnapshot(matchData.chart1Name, matchData.chart1);
  prompt += getChartSnapshot(matchData.chart2Name, matchData.chart2);

  prompt += `\n\nCOMPATIBILITY RESPONSE STYLE:`;
  prompt += `\n- Start with a direct verdict in 1 line.`;
  prompt += `\n- Then give 2-4 concise bullets: chemistry, communication, conflict pattern, long-term stability.`;
  prompt += `\n- Prioritize lowest-score factors (especially Nadi, Gana, Bhakoot, Yoni) with practical guidance.`;
  prompt += `\n- Mention current dasha overlap only if it changes near-term relationship dynamics.`;
  prompt += `\n- Be honest but constructive; avoid fear language.`;

  prompt += `\n\nIMPORTANT: Always refer to the couple by their names (${matchData.chart1Name} and ${matchData.chart2Name}). Compare both charts before conclusions.`;
  return prompt;
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
  { label: 'Career', prompt: 'What does my chart say about my career?', icon: Briefcase, color: 'text-amber-300' },
  { label: 'Love', prompt: 'Tell me about love and marriage in my chart', icon: HeartPulse, color: 'text-amber-300' },
  { label: 'Health', prompt: 'What are the health indicators in my chart?', icon: Activity, color: 'text-amber-300' },
  { label: 'Dasha', prompt: 'Analyze my current dasha period and antardashas', icon: Clock, color: 'text-amber-300' },
  { label: 'Strengths', prompt: 'Show me my planetary strengths (Shadbala)', icon: Dumbbell, color: 'text-orange-400' },
  { label: 'Houses', prompt: 'Analyze my house strengths (Bhava Bala)', icon: Home, color: 'text-amber-300' },
  { label: 'Remedies', prompt: 'What remedies do you suggest for my chart?', icon: Pill, color: 'text-amber-300' },
];

const GENERAL_PROMPTS = [
  { label: 'What is Vedic?', prompt: 'What is Vedic astrology and how is it different from Western astrology?', icon: Eye, color: 'text-amber-400' },
  { label: 'Houses', prompt: 'Explain the 12 houses in Vedic astrology briefly', icon: Home, color: 'text-amber-300' },
  { label: 'Planets', prompt: 'What do the 9 planets (Navagraha) signify in Vedic astrology?', icon: Activity, color: 'text-amber-300' },
  { label: 'Doshas', prompt: 'What are common doshas like Mangal Dosha and Sade Sati?', icon: HeartPulse, color: 'text-amber-300' },
];

const LOGO_SRC = '/Logo.png';
const THINKING_ICON_SRC = '/star.png';
const FALLBACK_MODEL = 'stepfun/step-3.5-flash:free';

function extractThinkingDelta(delta: unknown): string {
  if (!delta || typeof delta !== 'object') return '';

  const candidate = delta as {
    reasoning?: unknown;
    thinking?: unknown;
    reasoning_content?: unknown;
  };

  const raw = candidate.reasoning ?? candidate.thinking ?? candidate.reasoning_content;
  if (typeof raw === 'string') return raw;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const text = (item as { text?: unknown; content?: unknown }).text ?? (item as { text?: unknown; content?: unknown }).content;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }

  return '';
}

function buildKbContextPrompt(query: string, kbArticles: { title: string; category: string; content: string }[]): string {
  if (!kbArticles.length) return '';
  const compactArticles = kbArticles.slice(0, 4).map((article, index) => {
    const compactContent = article.content.replace(/\s+/g, ' ').slice(0, 1100);
    return `\n[KB ${index + 1}] ${article.title} (${article.category})\n${compactContent}`;
  }).join('\n');

  return `\n\n--- KNOWLEDGE BASE CONTEXT (Semantic Retrieval) ---\nUser Query: ${query}\nUse this KB context when relevant, prioritize chart data for chart-specific answers, and do not hallucinate beyond these sources.${compactArticles}`;
}

export function buildSystemPrompt(kundaliData: KundaliResponse | null, chartName?: string, skipSingleChartSections?: boolean): string {
  let prompt = `You are Astrova — a sharp, modern Vedic astrologer. You read charts like a pro and talk like a trusted friend.

RULES:
- Default: 2-4 sentences. Short, punchy, no filler.
- Only give long responses when user says "explain", "detail", "full", "elaborate", "tell me more".
- Talk like a smart friend: "Your Mars in 10th is fire for career" not "Mars positioned in the 10th bhava indicates..."
- Bold key placements. Keep it scannable.
- Notation legend for compact chart refs: H = House, R = Rashi (sign).
- Always cite actual planet, sign, house from chart data. Never fabricate.
- Use Parashara system, Shadbala, Bhava Bala, Vimshottari Dasha, Nakshatras, Yogas.
- If user asks for Bhrigu Nandi Nadi (also typed as Brighu/Bighu), use Nadi-style reading: planetary house-sign chains, conjunction/aspect links, karaka-driven event themes, and dasha/transit timing anchors.
- For Nadi-style answers, clearly label it as an interpretive technique and keep claims probabilistic ("likely", "tends to") unless timing is strongly supported.
- Remedies: only modern practical ones (therapy, gym, journaling, meditation, skill-building, routines). No mantras, gemstones, pujas, rituals.
- No medical/legal advice, no death predictions, no fear tactics.
- Non-astrology questions: answer normally, connect to chart briefly if loaded.
- No chart loaded: give general astrology knowledge, don't make up placements.
- Treat currently loaded chart/match as active context until user provides a new chart.
- Start with 1-line verdict, then 2-4 concise supporting points.
- Prioritize what is most actionable right now (current dasha + strongest/weakest factors).
- If data conflicts, mention both sides briefly and give balanced takeaway.
- Should say 11th house not 11th, same for rashi
`;

  if (kundaliData && !skipSingleChartSections) {
    prompt += `\n\n--- BIRTH CHART DATA ---`;
    if (chartName) prompt += `\nChart Name: ${chartName}`;
    prompt += `\nBirth Date: ${kundaliData.birth.date}`;
    prompt += `\nBirth Time: ${kundaliData.birth.time}`;
    prompt += `\nTimezone: UTC${kundaliData.birth.tz_offset_hours >= 0 ? '+' : ''}${kundaliData.birth.tz_offset_hours}`;
    prompt += `\nAdjusted Timezone: UTC${kundaliData.birth.adjusted_tz_offset_hours >= 0 ? '+' : ''}${kundaliData.birth.adjusted_tz_offset_hours}${kundaliData.birth.dst_applied ? ` (DST +${kundaliData.birth.dst_adjustment_hours}h applied)` : ''}`;
    prompt += `\nLocation: ${formatCoordinate(kundaliData.birth.latitude, 'N', 'S')}, ${formatCoordinate(kundaliData.birth.longitude, 'E', 'W')}`;
    prompt += `\nAyanamsha: ${kundaliData.meta.ayanamsha} (${kundaliData.meta.ayanamsha_deg.toFixed(4)}°)`;
    
    prompt += `\n\nLagna (Ascendant): R:${kundaliData.lagna.sign} (${kundaliData.lagna.sign_sanskrit}) at ${kundaliData.lagna.deg}°${kundaliData.lagna.min}'${kundaliData.lagna.sec}"`;

    const strongPlanets = kundaliData.shad_bala
      ? Object.entries(kundaliData.shad_bala)
          .sort((a, b) => (b[1].total_rupas ?? 0) - (a[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([name, b]) => `${name} (${b.total_rupas ?? 0}r)`)
      : [];
    const weakPlanets = kundaliData.shad_bala
      ? Object.entries(kundaliData.shad_bala)
          .sort((a, b) => (a[1].total_rupas ?? 0) - (b[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([name, b]) => `${name} (${b.total_rupas ?? 0}r)`)
      : [];
    const strongHouses = kundaliData.bhava_bala
      ? Object.entries(kundaliData.bhava_bala)
          .sort((a, b) => (b[1].total_rupas ?? 0) - (a[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([house, b]) => `H${house} ${b.sign} (${b.total_rupas ?? 0}r)`)
      : [];
    const weakHouses = kundaliData.bhava_bala
      ? Object.entries(kundaliData.bhava_bala)
          .sort((a, b) => (a[1].total_rupas ?? 0) - (b[1].total_rupas ?? 0))
          .slice(0, 3)
          .map(([house, b]) => `H${house} ${b.sign} (${b.total_rupas ?? 0}r)`)
      : [];

    prompt += `\n\n--- QUICK CONTEXT SNAPSHOT ---`;
    if (strongPlanets.length) prompt += `\nStrong Planets: ${strongPlanets.join(', ')}`;
    if (weakPlanets.length) prompt += `\nWeak Planets: ${weakPlanets.join(', ')}`;
    if (strongHouses.length) prompt += `\nStrong Houses: ${strongHouses.join(', ')}`;
    if (weakHouses.length) prompt += `\nWeak Houses: ${weakHouses.join(', ')}`;
    
    prompt += `\n\n--- PLANETARY POSITIONS ---`;
    for (const [name, p] of Object.entries(kundaliData.planets)) {
      const flags = [];
      if (p.retrograde) flags.push('R');
      if (p.exalted) flags.push('Exalted');
      if (p.debilitated) flags.push('Debilitated');
      if (p.vargottama) flags.push('Vargottama');
      if (p.combust) flags.push('Combust');
      prompt += `\n${name}: R:${p.sign} (${p.sign_sanskrit}) ${p.deg}°${p.min}'${p.sec}" H:${p.house_whole_sign} ${flags.length ? `[${flags.join(', ')}]` : ''}`;
      if (p.nakshatra) prompt += ` Nakshatra: ${p.nakshatra} Pada-${p.nakshatra_pada} (Lord: ${p.nakshatra_lord})`;
      if (p.navamsa_sign) prompt += ` Navamsa: ${p.navamsa_sign}`;
    }

    if (kundaliData.upagrahas && Object.keys(kundaliData.upagrahas).length > 0) {
      prompt += `\n\n--- UPAGRAHAS ---`;
      for (const [name, u] of Object.entries(kundaliData.upagrahas)) {
        prompt += `\n${name}: R:${u.sign} (${u.sign_sanskrit}) ${u.deg}°${u.min}'${u.sec}" H:${u.house_whole_sign}${u.nakshatra ? ` Nakshatra: ${u.nakshatra} Pada-${u.nakshatra_pada}` : ''}`;
      }
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

    if (kundaliData.rasi_chart?.length) {
      prompt += `\n\n--- RASI CHART (D1 Occupancy) ---`;
      kundaliData.rasi_chart.forEach((housePlanets, idx) => {
        const houseNumber = idx + 1;
        prompt += `\nHouse ${houseNumber}: ${housePlanets.length ? housePlanets.join(', ') : 'Empty'}`;
      });
    }

    if (kundaliData.navamsa_chart?.length) {
      prompt += `\n\n--- NAVAMSA CHART (D9 Occupancy) ---`;
      kundaliData.navamsa_chart.forEach((housePlanets, idx) => {
        const houseNumber = idx + 1;
        prompt += `\nHouse ${houseNumber}: ${housePlanets.length ? housePlanets.join(', ') : 'Empty'}`;
      });
    }

    if (kundaliData.shad_bala) {
      prompt += `\n\n--- SHADBALA (Planetary Strength) ---`;
      for (const [name, bala] of Object.entries(kundaliData.shad_bala)) {
        const sthana = typeof bala.sthana_bala === 'number' ? bala.sthana_bala : bala.sthana_bala.total;
        const kala = typeof bala.kala_bala === 'number' ? bala.kala_bala : bala.kala_bala.total;
        prompt += `\n${name}: ${bala.total_rupas ?? 0} rupas (Required: ${bala.required_rupas ?? 0}) - ${bala.strength}`;
        prompt += ` | Sthana:${sthana ?? 0}, Dig:${bala.dig_bala ?? 0}, Kala:${kala ?? 0}, Chesta:${bala.chesta_bala ?? 0}, Naisargika:${bala.naisargika_bala ?? 0}, Drik:${bala.drik_bala ?? 0}`;
      }
    }
    
    if (kundaliData.bhava_bala) {
      prompt += `\n\n--- BHAVA BALA (House Strength) ---`;
      for (const [house, bala] of Object.entries(kundaliData.bhava_bala)) {
        prompt += `\nHouse ${house} (${bala.sign}): Lord=${bala.lord}, ${bala.total_rupas ?? 0} rupas - ${bala.rating}`;
        prompt += ` | Bhavadhipati:${bala.bhavadhipati_bala ?? 0}, Dig:${bala.bhava_digbala ?? 0}, Drishti:${bala.bhava_drishti_bala ?? 0}, Residential:${bala.residential_strength ?? 0}, PlanetContribution:${bala.planet_contribution ?? 0}`;
      }
    }

    if (kundaliData.ashtakavarga) {
      const sarva = kundaliData.ashtakavarga.sarva;
      if (sarva?.points?.length === 12) {
        const strongestSarva = sarva.points
          .map((value, index) => ({ value, house: index + 1 }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 4)
          .map((entry) => `H${entry.house}:${entry.value}`)
          .join(', ');
        const weakestSarva = sarva.points
          .map((value, index) => ({ value, house: index + 1 }))
          .sort((a, b) => a.value - b.value)
          .slice(0, 4)
          .map((entry) => `H${entry.house}:${entry.value}`)
          .join(', ');
        prompt += `\n\n--- ASHTAKAVARGA (Sarva) ---`;
        prompt += `\nTotal: ${sarva.total ?? 0}`;
        prompt += `\nStrong Houses by Sarva: ${strongestSarva}`;
        prompt += `\nWeak Houses by Sarva: ${weakestSarva}`;
      }
    }
    
    if (kundaliData.yogas && kundaliData.yogas.length > 0) {
      prompt += `\n\n--- YOGAS (Planetary Combinations) ---`;
      for (const yoga of kundaliData.yogas) {
        prompt += `\n${yoga.name} [${yoga.type}/${yoga.strength}]: ${yoga.description} (Planets: ${yoga.planets.join(', ')})`;
      }
    }

    if (kundaliData.dasha) {
      const { currentPeriod, currentAntardasha, currentPratyantardasha, nextAntardasha, nextPratyantardasha } = getCurrentDashaContext(kundaliData);
      prompt += `\n\n--- VIMSHOTTARI DASHA ---`;
      prompt += `\nCurrent Mahadasha: ${kundaliData.dasha.current_dasha}`;
      if (currentPeriod) prompt += `\nCurrent Mahadasha Window: ${currentPeriod.start_date} to ${currentPeriod.end_date}`;
      prompt += `\nMoon Nakshatra: ${kundaliData.dasha.moon_nakshatra_name} (Pada ${kundaliData.dasha.moon_nakshatra_pada})`;
      
      // All Mahadashas
      if (kundaliData.dasha.periods && kundaliData.dasha.periods.length > 0) {
        prompt += `\n\nAll Mahadashas:`;
        for (const md of kundaliData.dasha.periods) {
          prompt += `\n- ${md.planet}: ${md.start_date} to ${md.end_date}${md.is_current ? ' (CURRENT)' : ''}`;
        }
      }

      if (currentPeriod) {
        if (currentPeriod.antardashas) {
          if (currentAntardasha) {
            prompt += `\nCurrent Antardasha: ${currentAntardasha.planet} (${currentAntardasha.start_date} to ${currentAntardasha.end_date})`;
            if (currentPratyantardasha) {
              prompt += `\nCurrent Pratyantardasha: ${currentPratyantardasha.planet} (${currentPratyantardasha.start_date} to ${currentPratyantardasha.end_date})`;
            }
            if (currentAntardasha.pratyantardashas && currentAntardasha.pratyantardashas.length > 0) {
              prompt += `\nAll Pratyantardashas in Current Antardasha:`;
              for (const pad of currentAntardasha.pratyantardashas) {
                prompt += `\n- ${pad.planet}: ${pad.start_date} to ${pad.end_date}`;
              }
            }
          }
          // All Antardashas in Current Mahadasha
          prompt += `\nAll Antardashas in Current Mahadasha (${currentPeriod.planet}):`;
          for (const ad of currentPeriod.antardashas) {
            const isCurrentAD = currentAntardasha && ad.planet === currentAntardasha.planet && ad.start_date === currentAntardasha.start_date;
            prompt += `\n- ${ad.planet}: ${ad.start_date} to ${ad.end_date}${isCurrentAD ? ' (CURRENT)' : ''}`;
          }
          if (nextAntardasha) {
            prompt += `\nNext Antardasha: ${nextAntardasha.planet} (${nextAntardasha.start_date} to ${nextAntardasha.end_date})`;
          }
          if (nextPratyantardasha) {
            prompt += `\nNext Pratyantardasha: ${nextPratyantardasha.planet} (${nextPratyantardasha.start_date} to ${nextPratyantardasha.end_date})`;
          }
        }
      }
    }

    prompt += `\n\nIMPORTANT: Use only the loaded chart/match data in this session. Keep responses concise and analyze on demand; avoid dumping every row unless user explicitly asks for full details.`;
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
  const [expandedThinkingById, setExpandedThinkingById] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { credits, creditCosts, deductCredits, showBuyModal, setShowBuyModal } = useCredits();
  const { isSignedIn } = useAuth();

  // Active model (configured by admin; no user-side selection here)
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load default model (wait for auth so JWT token is available)
  useEffect(() => {
    if (!isSignedIn) return;
    async function loadModels() {
      const models = await getUserEnabledModels();
      const adminModel = await getAdminConfig('default_model');
      const enabledModelIds = new Set(models.map((model) => model.model_id));

      if (adminModel && typeof adminModel === 'string' && enabledModelIds.has(adminModel)) {
        setSelectedModel(adminModel);
      } else if (models.length > 0) {
        setSelectedModel(models[0].model_id);
      } else {
        setSelectedModel('stepfun/step-3.5-flash:free');
      }
    }
    loadModels();
  }, [isSignedIn]);

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

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom && messages.length > 3);
  }, [messages.length]);

  const resizeInput = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 48), 140);
    el.style.height = `${nextHeight}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    resizeInput(e.target);
  };

  const toggleThinking = (id: string) => {
    setExpandedThinkingById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

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
    resizeInput(inputRef.current);

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
      const modelToUse = selectedModel || FALLBACK_MODEL;

      const kbResults = await searchKnowledgeBase(messageText.trim()).catch(() => []);
      if (kbResults.length > 0) {
        const kbToolMessage: ChatMessage = {
          id: `kb-${Date.now()}`,
          role: 'tool',
          content: `Using KB context from ${kbResults.length} article${kbResults.length > 1 ? 's' : ''}`,
          toolName: 'Knowledge Base Retrieval',
          timestamp: new Date(),
          kbResults: kbResults.slice(0, 4).map((a) => ({ title: a.title, category: a.category, content: a.content.slice(0, 220) })),
        };
        setMessages(prev => [...prev, kbToolMessage]);
      }

      let systemPrompt = buildSystemPrompt(kundaliData, chartName, !!matchData);
      systemPrompt += buildMatchContextPrompt(matchData);
      systemPrompt += buildKbContextPrompt(messageText.trim(), kbResults);
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
              const thinkingDelta = extractThinkingDelta(delta);
              if (thinkingDelta) {
                if (!thinkingStartTime) thinkingStartTime = Date.now();
                thinkingContent += thinkingDelta;
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
    setExpandedThinkingById({});
  };

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
      const modelToUse = selectedModel || FALLBACK_MODEL;
      const kbResults = await searchKnowledgeBase(messageText.trim()).catch(() => []);
      const systemPrompt = `${buildSystemPrompt(kundaliData, chartName, !!matchData)}${buildMatchContextPrompt(matchData)}${buildKbContextPrompt(messageText.trim(), kbResults)}`;
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
        body: JSON.stringify({ model: modelToUse, messages: conversationMessages, max_tokens: 4096, temperature: 0.7, stream: true }),
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
              const thinkingDelta = extractThinkingDelta(delta);
              if (thinkingDelta) { if (!thinkingStartTime) thinkingStartTime = Date.now(); thinkingContent += thinkingDelta; setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, thinking: thinkingContent } : m)); }
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
        <img src={LOGO_SRC} alt="Astrova" className="w-6 h-6 object-contain group-hover:scale-105 transition-transform" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {(() => { const c = messages.filter(m => m.role === 'assistant').length; return c > 9 ? '9+' : c; })()}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[hsl(24,16%,8%)] backdrop-blur-xl border-l border-amber-500/20">
      {/* Sidebar Header */}
      <div className="px-3 py-3 border-b border-amber-500/15 bg-[linear-gradient(120deg,rgba(245,158,11,0.08),rgba(249,115,22,0.03)_55%,transparent)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[hsl(24,18%,9%)] border border-amber-400/30 shadow-[0_0_0_1px_rgba(245,158,11,0.15)_inset] flex items-center justify-center">
              <img src={LOGO_SRC} alt="Astrova logo" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm leading-tight tracking-wide">Astrova</h3>
              <p className="text-[10px] text-neutral-400 leading-tight">
                {matchData ? (
                  <span className="flex items-center gap-1">
                    <span className="text-neutral-300">{matchData.chart1Name}</span>
                    <Link2 className="w-3 h-3 text-amber-400" />
                    <span className="text-neutral-300">{matchData.chart2Name}</span>
                  </span>
                ) : kundaliData ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="h-7 w-7 p-0 text-neutral-500 hover:text-white hover:bg-white/5"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
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
              <img src={LOGO_SRC} alt="Astrova" className="w-7 h-7 object-contain" />
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
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[hsl(24,18%,9%)] border border-amber-500/15 text-neutral-300 text-[11px] font-medium hover:bg-[hsl(24,20%,12%)] hover:border-amber-500/25 hover:text-white transition-all duration-200 text-left group"
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
                    <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[hsl(24,18%,11%)] border border-amber-500/15">
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
                      <div className="mb-2 rounded-xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.03)_55%,rgba(24,15,8,0.35))] px-2.5 py-2">
                        <button
                          onClick={() => toggleThinking(msg.id)}
                          className="w-full flex items-center justify-between gap-2 text-left"
                        >
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <img src={THINKING_ICON_SRC} alt="" className={`w-3.5 h-3.5 object-contain ${msg.isStreaming ? 'animate-spin' : ''}`} style={msg.isStreaming ? { animationDuration: '2s' } : undefined} />
                            <span className="text-xs text-amber-200">Thinking...</span>
                            {msg.thinkingDuration ? <span className="text-[10px] text-amber-300/70">{msg.thinkingDuration}s</span> : null}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-amber-200/80 transition-transform ${expandedThinkingById[msg.id] ? 'rotate-90' : ''}`} />
                        </button>
                        {expandedThinkingById[msg.id] || msg.isStreaming ? (
                          <div className="mt-2 rounded-lg bg-black/20 border border-amber-500/15 px-2.5 py-2 text-[11px] text-amber-50/85 leading-relaxed max-h-[170px] overflow-y-auto whitespace-pre-wrap">
                            {msg.thinking}
                          </div>
                        ) : (
                          <p className="mt-1.5 text-[11px] text-amber-100/70 line-clamp-2">{msg.thinking}</p>
                        )}
                      </div>
                    )}
                    <div className="group/msg px-0.5 py-0">
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
                          [&_code]:text-amber-300 [&_code]:bg-[hsl(24,18%,11%)] [&_code]:px-1 [&_code]:rounded [&_code]:text-xs
                          [&_pre]:bg-[hsl(24,18%,9%)] [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto
                          [&_blockquote]:border-l-2 [&_blockquote]:border-amber-500/50 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-400
                        "
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                        {msg.isStreaming && !msg.content && !msg.thinking && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90">
                            <img src={THINKING_ICON_SRC} alt="" className="w-4 h-4 animate-spin" style={{ animationDuration: '2s' }} />
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
                            {copiedMessageId === msg.id ? <Check className="w-3 h-3 text-amber-300" /> : <Copy className="w-3 h-3" />}
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
              className="pointer-events-auto w-7 h-7 rounded-full bg-[hsl(24,18%,10%)] border border-amber-500/20 flex items-center justify-center hover:bg-[hsl(24,20%,13%)] transition-colors shadow-lg"
            >
              <ChevronDown className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="px-3 pt-0.5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-[linear-gradient(180deg,transparent,rgba(18,11,7,0.9)_30%,rgba(18,11,7,0.98))]">
        {insufficientCredits && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] text-center">
            Insufficient credits. Purchase more to continue.
          </div>
        )}
        <div className="relative bg-[hsl(24,18%,9%)] border border-amber-500/20 rounded-[26px] focus-within:border-amber-500/40 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all flex items-end shadow-[0_8px_26px_rgba(0,0,0,0.3)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={kundaliData ? 'Ask Astrova anything...' : 'Ask about Vedic astrology...'}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent pl-4 pr-14 py-3.5 text-base sm:text-sm leading-5 text-white placeholder-neutral-500 focus:outline-none resize-none disabled:opacity-40 disabled:cursor-not-allowed min-h-[50px] max-h-[140px]"
          />
          <div className="absolute right-2 bottom-2 flex items-center">
            {isLoading ? (
              <Button
                type="button"
                onClick={stopGeneration}
                className="h-9 w-9 p-0 rounded-full bg-red-600/80 hover:bg-red-600 border-0 shrink-0 transition-all"
                title="Stop generating"
              >
                <Square className="w-4 h-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim() || credits < creditCosts.AI_MESSAGE}
                className="h-9 w-9 p-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-0 disabled:opacity-20 disabled:cursor-not-allowed shrink-0 transition-all"
              >
                <ArrowUp className="w-4 h-4" />
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

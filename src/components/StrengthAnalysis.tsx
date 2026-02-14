import { useState, useMemo, useId, Fragment, useRef, useEffect } from 'react';
import { Zap, ChevronDown } from 'lucide-react';
import type { PlanetInfo, ShadBalaInfo, BhavaBalaInfo, DashaInfo, LagnaInfo } from '../types/kundali';

interface RadarDataPoint {
  label: string;
  shortLabel: string;
  description: string;
  value: number;
  maxValue: number;
  plotRatio?: number;
  displayPercent?: number;
  strengthRatio?: number;
  color: string;
  icon?: string;
}

interface Aspect {
  planet1: string;
  planet2: string;
  type: string;
  angle: number;
  orb: number;
  nature: 'harmonious' | 'tense' | 'neutral';
  oneLine: string;
  pairOneLine: string;
  description: string;
  color: string;
}

interface StrengthAnalysisProps {
  shadBala: Record<string, Partial<ShadBalaInfo>>;
  bhavaBala?: Record<number, Partial<BhavaBalaInfo>>;
  planets?: Record<string, PlanetInfo>;
  upagrahas?: Record<string, PlanetInfo>;
  lagna?: LagnaInfo;
  dashaData?: DashaInfo;
}

function formatYears(y: number | undefined): string {
  if (y === undefined || y === null) return '—';
  const fullYears = Math.floor(y);
  const months = Math.round((y - fullYears) * 12);
  if (fullYears === 0) return `${months}m`;
  if (months === 0) return `${fullYears}y`;
  return `${fullYears}y ${months}m`;
}

const REQUIRED_RUPAS: Record<string, number> = {
  Sun: 5.0, Moon: 6.0, Mars: 5.0, Mercury: 7.0, Jupiter: 6.5, Venus: 5.5, Saturn: 5.0,
};

const PLANET_CONFIG: Record<string, { 
  icon: string; label: string; color: string; description: string; 
  element: string; nature: string; gender: string; rules: string;
  keywords: string[]; bodyParts: string; day: string;
}> = {
  Sun: { 
    icon: '☉', label: 'Self', color: '#fbbf24', 
    description: 'Identity, purpose, leadership, vitality, father, authority',
    element: 'Fire', nature: 'Malefic', gender: 'Male', rules: 'Leo',
    keywords: ['Soul', 'Ego', 'Power', 'Government', 'Father'],
    bodyParts: 'Heart, Spine, Eyes', day: 'Sunday'
  },
  Moon: { 
    icon: '☽', label: 'Mind', color: '#e2e8f0', 
    description: 'Emotions, mother, comfort, intuition, memory, public',
    element: 'Water', nature: 'Benefic', gender: 'Female', rules: 'Cancer',
    keywords: ['Mind', 'Mother', 'Emotions', 'Public', 'Nurturing'],
    bodyParts: 'Brain, Fluids, Chest', day: 'Monday'
  },
  Mars: { 
    icon: '♂', label: 'Drive', color: '#f87171', 
    description: 'Courage, action, energy, siblings, competition, property',
    element: 'Fire', nature: 'Malefic', gender: 'Male', rules: 'Aries & Scorpio',
    keywords: ['Energy', 'Courage', 'Brothers', 'Land', 'Surgery'],
    bodyParts: 'Blood, Muscles, Head', day: 'Tuesday'
  },
  Mercury: { 
    icon: '☿', label: 'Intellect', color: '#4ade80', 
    description: 'Communication, learning, trade, writing, calculation',
    element: 'Earth', nature: 'Neutral', gender: 'Neutral', rules: 'Gemini & Virgo',
    keywords: ['Speech', 'Logic', 'Trade', 'Education', 'Friends'],
    bodyParts: 'Nervous System, Skin, Lungs', day: 'Wednesday'
  },
  Jupiter: { 
    icon: '♃', label: 'Growth', color: '#fde047', 
    description: 'Wisdom, expansion, luck, teachers, children, dharma',
    element: 'Ether', nature: 'Benefic', gender: 'Male', rules: 'Sagittarius & Pisces',
    keywords: ['Wisdom', 'Fortune', 'Guru', 'Children', 'Dharma'],
    bodyParts: 'Liver, Fat, Thighs', day: 'Thursday'
  },
  Venus: { 
    icon: '♀', label: 'Love', color: '#f9a8d4', 
    description: 'Relationships, beauty, art, luxury, spouse, pleasure',
    element: 'Water', nature: 'Benefic', gender: 'Female', rules: 'Taurus & Libra',
    keywords: ['Love', 'Beauty', 'Marriage', 'Art', 'Luxury'],
    bodyParts: 'Reproductive, Face, Kidneys', day: 'Friday'
  },
  Saturn: { 
    icon: '♄', label: 'Discipline', color: '#93c5fd', 
    description: 'Structure, karma, delays, service, longevity, renunciation',
    element: 'Air', nature: 'Malefic', gender: 'Neutral', rules: 'Capricorn & Aquarius',
    keywords: ['Karma', 'Discipline', 'Service', 'Delays', 'Longevity'],
    bodyParts: 'Bones, Joints, Teeth', day: 'Saturday'
  },
  // Upagrahas
  Rahu: { 
    icon: '☊', label: 'Obsession', color: '#c084fc', 
    description: 'Desires, illusions, foreign, unconventional, amplification',
    element: 'Air', nature: 'Malefic', gender: 'Neutral', rules: 'Aquarius',
    keywords: ['Desire', 'Illusion', 'Foreign', 'Obsession', 'Amplify'],
    bodyParts: 'Skin disorders, Poisons', day: 'Saturday'
  },
  Ketu: { 
    icon: '☋', label: 'Liberation', color: '#fb923c', 
    description: 'Spirituality, detachment, past karma, moksha, intuition',
    element: 'Fire', nature: 'Malefic', gender: 'Neutral', rules: 'Scorpio',
    keywords: ['Moksha', 'Detachment', 'Past Life', 'Intuition', 'Spiritual'],
    bodyParts: 'Spine, Nervous system', day: 'Tuesday'
  },
  Mandi: { 
    icon: 'Mn', label: 'Obstacles', color: '#94a3b8', 
    description: 'Son of Saturn, obstacles, delays, suffering, karmic debt',
    element: 'Earth', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Obstacles', 'Delays', 'Suffering', 'Karma', 'Restriction'],
    bodyParts: 'Chronic illness', day: 'Saturday'
  },
  Gulika: { 
    icon: 'Gk', label: 'Poison', color: '#64748b', 
    description: 'Son of Saturn, poison, death-like experiences, transformation',
    element: 'Earth', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Poison', 'Death', 'Transform', 'Hidden', 'Intense'],
    bodyParts: 'Toxins, Poisons', day: 'Saturday'
  },
  Dhuma: {
    icon: 'Dh', label: 'Smoke', color: '#f59e0b',
    description: 'Fiery obscuration point derived from Sun, linked with heat and agitation',
    element: 'Fire', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Smoke', 'Heat', 'Obstruction', 'Irritation', 'Confusion'],
    bodyParts: 'Eyes, Head', day: 'Sunday'
  },
  Vyatipata: {
    icon: 'Vy', label: 'Upheaval', color: '#ef4444',
    description: 'Disruptive solar upagraha opposite Dhuma, linked with reversals',
    element: 'Air', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Reversal', 'Shock', 'Disruption', 'Instability', 'Suddenness'],
    bodyParts: 'Nervous System', day: 'Sunday'
  },
  Parivesha: {
    icon: 'Pv', label: 'Halo', color: '#f97316',
    description: 'Encircling malefic upagraha opposite Vyatipata, linked with mental pressure',
    element: 'Fire', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Pressure', 'Enclosure', 'Stress', 'Fog', 'Strain'],
    bodyParts: 'Head, Aura', day: 'Sunday'
  },
  Indrachapa: {
    icon: 'Ic', label: 'Bow', color: '#84cc16',
    description: 'Kodanda point opposite Parivesha, indicates karmic turning points',
    element: 'Air', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Karmic Trigger', 'Turns', 'Tension', 'Transition', 'Bow'],
    bodyParts: 'Nerves', day: 'Sunday'
  },
  Upaketu: {
    icon: 'Uk', label: 'Sub-Ketu', color: '#fb923c',
    description: 'Solar upagraha near Ketu nature, linked with detachment and cutting events',
    element: 'Fire', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Detachment', 'Separation', 'Karmic Cut', 'Ascetic', 'Sharp'],
    bodyParts: 'Spine, Skin', day: 'Tuesday'
  },
  Kaala: {
    icon: 'Ka', label: 'Time Strike', color: '#a855f7',
    description: 'Kalavela upagraha mapped to Sun segment, linked with harsh timing effects',
    element: 'Fire', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Timing', 'Harshness', 'Burn', 'Pressure', 'Deadline'],
    bodyParts: 'Vitality', day: 'Sunday'
  },
  Mrityu: {
    icon: 'Mr', label: 'Mrityu', color: '#dc2626',
    description: 'Kalavela upagraha mapped to Mars segment, linked with danger and crises',
    element: 'Fire', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Crisis', 'Danger', 'Injury', 'Cut', 'Fatal Tendencies'],
    bodyParts: 'Blood, Injuries', day: 'Tuesday'
  },
  ArthaPrahara: {
    icon: 'Ap', label: 'Artha Prahara', color: '#14b8a6',
    description: 'Kalavela upagraha mapped to Mercury segment, linked with pressure on resources',
    element: 'Earth', nature: 'Mixed', gender: 'Neutral', rules: 'None',
    keywords: ['Resources', 'Commerce Stress', 'Practical Strain', 'Debt', 'Logistics'],
    bodyParts: 'Nervous System', day: 'Wednesday'
  },
  YamaGhantaka: {
    icon: 'Yg', label: 'Yama Ghantaka', color: '#0ea5e9',
    description: 'Kalavela upagraha mapped to Jupiter segment, linked with karmic tests and restraint',
    element: 'Air', nature: 'Malefic', gender: 'Neutral', rules: 'None',
    keywords: ['Karmic Test', 'Restraint', 'Accountability', 'Judgment', 'Limits'],
    bodyParts: 'Thighs, Nerves', day: 'Thursday'
  },
};

const HOUSE_CONFIG: Record<number, { 
  label: string; shortLabel: string; color: string; description: string; 
  significator: string; bodyPart: string; category: string; keywords: string[];
}> = {
  1: { label: 'Ascendant', shortLabel: 'Self', color: '#f87171', description: 'Identity, body, personality, health, new beginnings', significator: 'Sun', bodyPart: 'Head', category: 'Kendra', keywords: ['Self', 'Body', 'Appearance', 'Character'] },
  2: { label: 'Wealth', shortLabel: 'Wealth', color: '#fbbf24', description: 'Money, family, speech, food, early education', significator: 'Jupiter', bodyPart: 'Face', category: 'Maraka', keywords: ['Money', 'Speech', 'Family', 'Food'] },
  3: { label: 'Siblings', shortLabel: 'Effort', color: '#fde047', description: 'Courage, siblings, short travel, communication, skills', significator: 'Mars', bodyPart: 'Arms', category: 'Upachaya', keywords: ['Courage', 'Siblings', 'Skills', 'Hobbies'] },
  4: { label: 'Home', shortLabel: 'Home', color: '#4ade80', description: 'Mother, property, vehicles, comfort, education, happiness', significator: 'Moon', bodyPart: 'Chest', category: 'Kendra', keywords: ['Mother', 'Home', 'Property', 'Peace'] },
  5: { label: 'Children', shortLabel: 'Create', color: '#22d3ee', description: 'Intelligence, children, romance, speculation, past merit', significator: 'Jupiter', bodyPart: 'Stomach', category: 'Trikona', keywords: ['Children', 'Romance', 'Creativity', 'Luck'] },
  6: { label: 'Enemies', shortLabel: 'Health', color: '#06b6d4', description: 'Health, enemies, debts, service, pets, daily work', significator: 'Mars', bodyPart: 'Intestines', category: 'Dusthana', keywords: ['Health', 'Service', 'Enemies', 'Debts'] },
  7: { label: 'Partnership', shortLabel: 'Partner', color: '#93c5fd', description: 'Marriage, business partners, public, foreign travel', significator: 'Venus', bodyPart: 'Lower Back', category: 'Kendra', keywords: ['Marriage', 'Partner', 'Business', 'Public'] },
  8: { label: 'Transformation', shortLabel: 'Change', color: '#c084fc', description: 'Death, inheritance, secrets, research, transformation', significator: 'Saturn', bodyPart: 'Reproductive', category: 'Dusthana', keywords: ['Longevity', 'Secrets', 'Occult', 'Inheritance'] },
  9: { label: 'Fortune', shortLabel: 'Dharma', color: '#e9d5ff', description: 'Luck, father, guru, higher learning, long travel, dharma', significator: 'Jupiter', bodyPart: 'Thighs', category: 'Trikona', keywords: ['Luck', 'Father', 'Guru', 'Dharma'] },
  10: { label: 'Career', shortLabel: 'Career', color: '#f9a8d4', description: 'Profession, status, authority, karma, achievements', significator: 'Saturn', bodyPart: 'Knees', category: 'Kendra', keywords: ['Career', 'Status', 'Fame', 'Authority'] },
  11: { label: 'Gains', shortLabel: 'Gains', color: '#fda4af', description: 'Income, gains, friends, elder siblings, aspirations', significator: 'Jupiter', bodyPart: 'Calves', category: 'Upachaya', keywords: ['Income', 'Friends', 'Goals', 'Gains'] },
  12: { label: 'Liberation', shortLabel: 'Moksha', color: '#a5b4fc', description: 'Losses, expenses, foreign lands, spirituality, moksha', significator: 'Saturn', bodyPart: 'Feet', category: 'Dusthana', keywords: ['Expenses', 'Foreign', 'Spirituality', 'Sleep'] },
};

const ASPECT_DEFS = [
  { name: 'Conjunction', angle: 0, orb: 10, nature: 'neutral' as const, color: '#e9d5ff', symbol: '☌', description: 'Blending of energies, intensification' },
  { name: 'Opposition', angle: 180, orb: 10, nature: 'tense' as const, color: '#f87171', symbol: '☍', description: 'Polarity, awareness, balance needed' },
  { name: 'Trine', angle: 120, orb: 8, nature: 'harmonious' as const, color: '#4ade80', symbol: '△', description: 'Flow, natural talent, ease' },
  { name: 'Square', angle: 90, orb: 8, nature: 'tense' as const, color: '#fbbf24', symbol: '□', description: 'Friction, challenge, growth' },
  { name: 'Sextile', angle: 60, orb: 6, nature: 'harmonious' as const, color: '#93c5fd', symbol: '⚹', description: 'Opportunity, cooperation' },
];

const ASPECT_ONE_LINERS: Record<(typeof ASPECT_DEFS)[number]['name'], string> = {
  Conjunction: 'Energy fusion: the two planets act as one and amplify each other.',
  Opposition: 'Awareness through polarity: balance two competing needs/forces.',
  Trine: 'Easy flow: natural talent and support with minimal resistance.',
  Square: 'Growth pressure: friction that pushes action, mastery, and change.',
  Sextile: 'Opportunity: helpful cooperation that activates with initiative.',
};

// Planet-pair aspect interpretations (specific to the two planets involved)
const PLANET_PAIR_ASPECTS: Record<string, Record<string, Record<string, string>>> = {
  Sun: {
    Moon: {
      Conjunction: 'Self and emotions merge: identity and feelings are unified.',
      Opposition: 'Head vs heart theme: conscious self opposes inner needs.',
      Trine: 'Confidence and feelings flow: self-expression supported by emotions.',
      Square: 'Ego vs emotional tension: identity conflicts with inner needs.',
      Sextile: 'Opportunity to align self and feelings: harmony through initiative.',
    },
    Mars: {
      Conjunction: 'Will and action unite: strong drive and leadership energy.',
      Opposition: 'Ego vs action tension: self-direction conflicts with drive.',
      Trine: 'Confidence and action flow: natural leadership and courage.',
      Square: 'Ego vs action friction: willpower challenged by impulses.',
      Sextile: 'Opportunity to lead and act: constructive use of energy.',
    },
    Mercury: {
      Conjunction: 'Mind and self merge: clear communication of identity.',
      Opposition: 'Mind vs self tension: thoughts oppose conscious direction.',
      Trine: 'Clear expression flows: easy communication of ideas.',
      Square: 'Mind vs self friction: communication challenges identity.',
      Sextile: 'Opportunity to express self: ideas support identity.',
    },
    Jupiter: {
      Conjunction: 'Self and wisdom unite: confident expansion and growth.',
      Opposition: 'Self vs wisdom tension: identity opposes higher learning.',
      Trine: 'Confidence and growth flow: natural optimism and expansion.',
      Square: 'Self vs growth friction: identity challenged by beliefs.',
      Sextile: 'Opportunity for growth: wisdom supports self-development.',
    },
    Venus: {
      Conjunction: 'Self and love merge: harmonious self-expression and attraction.',
      Opposition: 'Self vs love tension: identity opposes relationships.',
      Trine: 'Confidence and love flow: natural charm and harmony.',
      Square: 'Self vs love friction: identity challenged by relationships.',
      Sextile: 'Opportunity for love: relationships support self-expression.',
    },
    Saturn: {
      Conjunction: 'Self and discipline unite: serious, structured identity.',
      Opposition: 'Self vs discipline tension: freedom opposes responsibility.',
      Trine: 'Confidence and structure flow: steady achievement.',
      Square: 'Self vs discipline friction: identity challenged by limits.',
      Sextile: 'Opportunity for structure: discipline supports goals.',
    },
    Rahu: {
      Conjunction: 'Ego amplified by desire: intense ambition and worldly focus.',
      Opposition: 'Self vs obsession tension: identity opposes worldly desires.',
      Trine: 'Confidence and ambition flow: self-expression supports goals.',
      Square: 'Self vs desire friction: identity challenged by cravings.',
      Sextile: 'Opportunity for ambitious self: desires support identity.',
    },
    Ketu: {
      Conjunction: 'Self meets detachment: spiritual identity, ego dissolution.',
      Opposition: 'Self vs detachment tension: identity opposes letting go.',
      Trine: 'Confidence and spirituality flow: self-expression supports moksha.',
      Square: 'Self vs detachment friction: identity challenged by withdrawal.',
      Sextile: 'Opportunity for spiritual self: detachment supports growth.',
    },
    Mandi: {
      Conjunction: 'Self meets obstacles: identity shaped by karmic suffering.',
      Opposition: 'Self vs obstacles tension: identity opposes karmic delays.',
      Trine: 'Confidence through obstacles: self-expression overcomes karma.',
      Square: 'Self vs obstacles friction: identity challenged by suffering.',
      Sextile: 'Opportunity through karma: obstacles support self-growth.',
    },
    Gulika: {
      Conjunction: 'Self meets poison: identity transformed through crisis.',
      Opposition: 'Self vs toxicity tension: identity opposes hidden dangers.',
      Trine: 'Confidence through transformation: self-expression supports change.',
      Square: 'Self vs poison friction: identity challenged by hidden forces.',
      Sextile: 'Opportunity for transformation: crisis supports self-growth.',
    },
  },
  Moon: {
    Mars: {
      Conjunction: 'Emotions and action merge: passionate, reactive energy.',
      Opposition: 'Feelings vs action tension: emotions oppose drive.',
      Trine: 'Emotions and action flow: natural courage and initiative.',
      Square: 'Feelings vs action friction: emotional conflicts with drive.',
      Sextile: 'Opportunity for emotional action: feelings motivate.',
    },
    Mercury: {
      Conjunction: 'Feelings and thoughts merge: emotional communication.',
      Opposition: 'Feelings vs thoughts tension: heart opposes mind.',
      Trine: 'Emotional expression flows: easy communication of feelings.',
      Square: 'Feelings vs thoughts friction: emotional communication issues.',
      Sextile: 'Opportunity for emotional expression: thoughts support feelings.',
    },
    Jupiter: {
      Conjunction: 'Emotions and wisdom merge: optimistic, expansive feelings.',
      Opposition: 'Feelings vs wisdom tension: emotions oppose beliefs.',
      Trine: 'Emotional growth flows: natural optimism and support.',
      Square: 'Feelings vs wisdom friction: emotions challenged by beliefs.',
      Sextile: 'Opportunity for emotional growth: wisdom supports feelings.',
    },
    Venus: {
      Conjunction: 'Feelings and love merge: harmonious, romantic emotions.',
      Opposition: 'Feelings vs love tension: emotions oppose relationships.',
      Trine: 'Emotional harmony flows: natural affection and beauty.',
      Square: 'Feelings vs love friction: emotional relationship challenges.',
      Sextile: 'Opportunity for emotional love: relationships support feelings.',
    },
    Saturn: {
      Conjunction: 'Feelings and discipline merge: serious, controlled emotions.',
      Opposition: 'Feelings vs discipline tension: emotions oppose responsibility.',
      Trine: 'Emotional stability flows: steady, reliable feelings.',
      Square: 'Feelings vs discipline friction: emotional control challenges.',
      Sextile: 'Opportunity for emotional maturity: structure supports feelings.',
    },
    Rahu: {
      Conjunction: 'Emotions amplified: intense feelings, mental restlessness.',
      Opposition: 'Feelings vs obsession tension: emotions oppose worldly desires.',
      Trine: 'Emotions and ambition flow: feelings support material goals.',
      Square: 'Feelings vs desire friction: emotions challenged by cravings.',
      Sextile: 'Opportunity for emotional ambition: desires support feelings.',
    },
    Ketu: {
      Conjunction: 'Emotions meet detachment: intuitive, psychic sensitivity.',
      Opposition: 'Feelings vs detachment tension: emotions oppose letting go.',
      Trine: 'Emotions and spirituality flow: feelings support inner growth.',
      Square: 'Feelings vs detachment friction: emotions challenged by withdrawal.',
      Sextile: 'Opportunity for emotional spirituality: detachment supports feelings.',
    },
    Mandi: {
      Conjunction: 'Emotions meet obstacles: mental suffering, karmic emotional patterns.',
      Opposition: 'Feelings vs obstacles tension: emotions oppose karmic delays.',
      Trine: 'Emotions through obstacles: feelings overcome karma.',
      Square: 'Feelings vs obstacles friction: emotions challenged by suffering.',
      Sextile: 'Opportunity through karma: obstacles support emotional growth.',
    },
    Gulika: {
      Conjunction: 'Emotions meet poison: intense mental transformation.',
      Opposition: 'Feelings vs toxicity tension: emotions oppose hidden dangers.',
      Trine: 'Emotions through transformation: feelings support deep change.',
      Square: 'Feelings vs poison friction: emotions challenged by hidden forces.',
      Sextile: 'Opportunity for emotional transformation: crisis supports feelings.',
    },
  },
  Mars: {
    Mercury: {
      Conjunction: 'Action and thoughts merge: decisive, sharp communication.',
      Opposition: 'Action vs thoughts tension: drive opposes ideas.',
      Trine: 'Action and thoughts flow: energetic communication and ideas.',
      Square: 'Action vs thoughts friction: communication challenges drive.',
      Sextile: 'Opportunity for action: ideas support initiative.',
    },
    Jupiter: {
      Conjunction: 'Action and wisdom merge: confident, expansive drive.',
      Opposition: 'Action vs wisdom tension: drive opposes beliefs.',
      Trine: 'Action and growth flow: natural leadership and expansion.',
      Square: 'Action vs wisdom friction: drive challenged by beliefs.',
      Sextile: 'Opportunity for growth: wisdom supports action.',
    },
    Venus: {
      Conjunction: 'Action and love merge: passionate, romantic energy.',
      Opposition: 'Action vs love tension: drive opposes relationships.',
      Trine: 'Action and harmony flow: natural charm and initiative.',
      Square: 'Action vs love friction: drive challenges relationships.',
      Sextile: 'Opportunity for harmonious action: relationships support drive.',
    },
    Saturn: {
      Conjunction: 'Action and discipline merge: controlled, persistent effort.',
      Opposition: 'Action vs discipline tension: drive opposes responsibility.',
      Trine: 'Action and structure flow: steady achievement.',
      Square: 'Action vs discipline friction: drive challenged by limits.',
      Sextile: 'Opportunity for structured action: discipline supports drive.',
    },
    Rahu: {
      Conjunction: 'Action amplified: intense drive, aggressive ambition.',
      Opposition: 'Action vs obsession tension: drive opposes worldly desires.',
      Trine: 'Action and ambition flow: drive supports material goals.',
      Square: 'Action vs desire friction: drive challenged by cravings.',
      Sextile: 'Opportunity for ambitious action: desires support drive.',
    },
    Ketu: {
      Conjunction: 'Action meets detachment: spiritual warrior, past-life courage.',
      Opposition: 'Action vs detachment tension: drive opposes letting go.',
      Trine: 'Action and spirituality flow: drive supports inner growth.',
      Square: 'Action vs detachment friction: drive challenged by withdrawal.',
      Sextile: 'Opportunity for spiritual action: detachment supports drive.',
    },
    Mandi: {
      Conjunction: 'Action meets obstacles: drive shaped by karmic suffering.',
      Opposition: 'Action vs obstacles tension: drive opposes karmic delays.',
      Trine: 'Action through obstacles: drive overcomes karma.',
      Square: 'Action vs obstacles friction: drive challenged by suffering.',
      Sextile: 'Opportunity through karma: obstacles support action.',
    },
    Gulika: {
      Conjunction: 'Action meets poison: drive transformed through crisis.',
      Opposition: 'Action vs toxicity tension: drive opposes hidden dangers.',
      Trine: 'Action through transformation: drive supports deep change.',
      Square: 'Action vs poison friction: drive challenged by hidden forces.',
      Sextile: 'Opportunity for transformation: crisis supports action.',
    },
  },
  Mercury: {
    Jupiter: {
      Conjunction: 'Thoughts and wisdom merge: expansive, optimistic communication.',
      Opposition: 'Thoughts vs wisdom tension: ideas oppose beliefs.',
      Trine: 'Thoughts and growth flow: natural learning and expression.',
      Square: 'Thoughts vs wisdom friction: ideas challenged by beliefs.',
      Sextile: 'Opportunity for learning: wisdom supports ideas.',
    },
    Venus: {
      Conjunction: 'Thoughts and love merge: charming, artistic communication.',
      Opposition: 'Thoughts vs love tension: ideas oppose relationships.',
      Trine: 'Thoughts and harmony flow: natural charm and expression.',
      Square: 'Thoughts vs love friction: communication challenges relationships.',
      Sextile: 'Opportunity for harmonious communication: relationships support ideas.',
    },
    Saturn: {
      Conjunction: 'Thoughts and discipline merge: serious, structured thinking.',
      Opposition: 'Thoughts vs discipline tension: ideas oppose responsibility.',
      Trine: 'Thoughts and structure flow: clear, organized communication.',
      Square: 'Thoughts vs discipline friction: thinking challenged by limits.',
      Sextile: 'Opportunity for structured thinking: discipline supports ideas.',
    },
    Rahu: {
      Conjunction: 'Intellect amplified: clever, unconventional thinking.',
      Opposition: 'Thoughts vs obsession tension: ideas oppose worldly desires.',
      Trine: 'Intellect and ambition flow: ideas support material goals.',
      Square: 'Thoughts vs desire friction: ideas challenged by cravings.',
      Sextile: 'Opportunity for ambitious thinking: desires support ideas.',
    },
    Ketu: {
      Conjunction: 'Intellect meets detachment: intuitive, abstract thinking.',
      Opposition: 'Thoughts vs detachment tension: ideas oppose letting go.',
      Trine: 'Intellect and spirituality flow: ideas support inner growth.',
      Square: 'Thoughts vs detachment friction: ideas challenged by withdrawal.',
      Sextile: 'Opportunity for spiritual thinking: detachment supports ideas.',
    },
    Mandi: {
      Conjunction: 'Intellect meets obstacles: thinking shaped by karmic patterns.',
      Opposition: 'Thoughts vs obstacles tension: ideas oppose karmic delays.',
      Trine: 'Intellect through obstacles: ideas overcome karma.',
      Square: 'Thoughts vs obstacles friction: ideas challenged by suffering.',
      Sextile: 'Opportunity through karma: obstacles support thinking.',
    },
    Gulika: {
      Conjunction: 'Intellect meets poison: thinking transformed through crisis.',
      Opposition: 'Thoughts vs toxicity tension: ideas oppose hidden dangers.',
      Trine: 'Intellect through transformation: ideas support deep change.',
      Square: 'Thoughts vs poison friction: ideas challenged by hidden forces.',
      Sextile: 'Opportunity for transformation: crisis supports thinking.',
    },
  },
  Jupiter: {
    Venus: {
      Conjunction: 'Wisdom and love merge: expansive, harmonious relationships.',
      Opposition: 'Wisdom vs love tension: beliefs oppose relationships.',
      Trine: 'Wisdom and harmony flow: natural growth and affection.',
      Square: 'Wisdom vs love friction: beliefs challenge relationships.',
      Sextile: 'Opportunity for harmonious growth: relationships support expansion.',
    },
    Saturn: {
      Conjunction: 'Wisdom and discipline merge: structured, responsible growth.',
      Opposition: 'Wisdom vs discipline tension: expansion opposes responsibility.',
      Trine: 'Wisdom and structure flow: steady achievement and growth.',
      Square: 'Wisdom vs discipline friction: growth challenged by limits.',
      Sextile: 'Opportunity for structured growth: discipline supports wisdom.',
    },
    Rahu: {
      Conjunction: 'Wisdom amplified: expansive ambition, unconventional beliefs.',
      Opposition: 'Wisdom vs obsession tension: beliefs oppose worldly desires.',
      Trine: 'Wisdom and ambition flow: beliefs support material goals.',
      Square: 'Wisdom vs desire friction: beliefs challenged by cravings.',
      Sextile: 'Opportunity for ambitious wisdom: desires support beliefs.',
    },
    Ketu: {
      Conjunction: 'Wisdom meets detachment: deep spiritual knowledge.',
      Opposition: 'Wisdom vs detachment tension: beliefs oppose letting go.',
      Trine: 'Wisdom and spirituality flow: beliefs support inner growth.',
      Square: 'Wisdom vs detachment friction: beliefs challenged by withdrawal.',
      Sextile: 'Opportunity for spiritual wisdom: detachment supports beliefs.',
    },
    Mandi: {
      Conjunction: 'Wisdom meets obstacles: beliefs shaped by karmic suffering.',
      Opposition: 'Wisdom vs obstacles tension: beliefs oppose karmic delays.',
      Trine: 'Wisdom through obstacles: beliefs overcome karma.',
      Square: 'Wisdom vs obstacles friction: beliefs challenged by suffering.',
      Sextile: 'Opportunity through karma: obstacles support wisdom.',
    },
    Gulika: {
      Conjunction: 'Wisdom meets poison: beliefs transformed through crisis.',
      Opposition: 'Wisdom vs toxicity tension: beliefs oppose hidden dangers.',
      Trine: 'Wisdom through transformation: beliefs support deep change.',
      Square: 'Wisdom vs poison friction: beliefs challenged by hidden forces.',
      Sextile: 'Opportunity for transformation: crisis supports wisdom.',
    },
  },
  Venus: {
    Saturn: {
      Conjunction: 'Love and discipline merge: serious, committed relationships.',
      Opposition: 'Love vs discipline tension: relationships oppose responsibility.',
      Trine: 'Love and structure flow: steady, harmonious commitments.',
      Square: 'Love vs discipline friction: relationships challenged by limits.',
      Sextile: 'Opportunity for committed love: structure supports relationships.',
    },
    Rahu: {
      Conjunction: 'Love amplified by desire: intense, unconventional attractions.',
      Opposition: 'Love vs obsession tension: relationships oppose worldly desires.',
      Trine: 'Love and ambition flow: relationships support material growth.',
      Square: 'Love vs desire friction: relationships challenged by cravings.',
      Sextile: 'Opportunity for passionate love: desires support relationships.',
    },
    Ketu: {
      Conjunction: 'Love meets detachment: spiritual or past-life romantic connections.',
      Opposition: 'Love vs detachment tension: relationships oppose spiritual growth.',
      Trine: 'Love and spirituality flow: relationships support inner growth.',
      Square: 'Love vs detachment friction: relationships challenged by withdrawal.',
      Sextile: 'Opportunity for spiritual love: detachment brings clarity.',
    },
    Mandi: {
      Conjunction: 'Love meets obstacles: relationships shaped by karmic suffering.',
      Opposition: 'Love vs obstacles tension: relationships oppose karmic delays.',
      Trine: 'Love through obstacles: relationships overcome karma.',
      Square: 'Love vs obstacles friction: relationships challenged by suffering.',
      Sextile: 'Opportunity through karma: obstacles support love.',
    },
    Gulika: {
      Conjunction: 'Love meets poison: relationships transformed through crisis.',
      Opposition: 'Love vs toxicity tension: relationships oppose hidden dangers.',
      Trine: 'Love through transformation: relationships support deep change.',
      Square: 'Love vs poison friction: relationships challenged by hidden forces.',
      Sextile: 'Opportunity for transformation: crisis supports love.',
    },
  },
  Saturn: {
    Rahu: {
      Conjunction: 'Discipline amplified: intense focus on structure and ambition.',
      Opposition: 'Discipline vs obsession tension: responsibility opposes desires.',
      Trine: 'Structure and ambition flow: disciplined pursuit of goals.',
      Square: 'Discipline vs desire friction: limits challenged by cravings.',
      Sextile: 'Opportunity for focused ambition: discipline supports desires.',
    },
    Ketu: {
      Conjunction: 'Discipline meets spirituality: structured spiritual practice.',
      Opposition: 'Discipline vs detachment tension: responsibility opposes letting go.',
      Trine: 'Structure and spirituality flow: disciplined inner growth.',
      Square: 'Discipline vs detachment friction: limits challenged by withdrawal.',
      Sextile: 'Opportunity for spiritual discipline: structure supports moksha.',
    },
    Mandi: {
      Conjunction: 'Double Saturn energy: intense karmic lessons and delays.',
      Opposition: 'Discipline vs obstacles tension: responsibility opposes suffering.',
      Trine: 'Structure and karma flow: disciplined handling of obstacles.',
      Square: 'Discipline vs obstacles friction: limits compounded by karma.',
      Sextile: 'Opportunity to overcome: discipline supports karmic resolution.',
    },
    Gulika: {
      Conjunction: 'Discipline meets poison: intense transformation through limits.',
      Opposition: 'Discipline vs toxicity tension: responsibility opposes hidden dangers.',
      Trine: 'Structure and transformation flow: disciplined handling of crises.',
      Square: 'Discipline vs poison friction: limits challenged by hidden forces.',
      Sextile: 'Opportunity for transformation: discipline supports purification.',
    },
  },
  Rahu: {
    Ketu: {
      Conjunction: 'Impossible aspect: nodes are always opposite each other.',
      Opposition: 'Karmic axis activated: past vs future, letting go vs pursuing.',
      Trine: 'Desire and detachment flow: balanced karmic growth.',
      Square: 'Desire vs detachment friction: worldly vs spiritual conflict.',
      Sextile: 'Opportunity for karmic balance: desires support spiritual growth.',
    },
    Mandi: {
      Conjunction: 'Obsession meets obstacles: amplified karmic suffering.',
      Opposition: 'Desire vs obstacles tension: ambitions opposed by karma.',
      Trine: 'Desire and karma flow: obstacles fuel ambition.',
      Square: 'Desire vs obstacles friction: cravings challenged by suffering.',
      Sextile: 'Opportunity through obstacles: karma supports growth.',
    },
    Gulika: {
      Conjunction: 'Obsession meets poison: intense, potentially dangerous desires.',
      Opposition: 'Desire vs toxicity tension: ambitions opposed by hidden dangers.',
      Trine: 'Desire and transformation flow: ambitions support deep change.',
      Square: 'Desire vs poison friction: cravings challenged by hidden forces.',
      Sextile: 'Opportunity for transformation: desires support purification.',
    },
  },
  Ketu: {
    Mandi: {
      Conjunction: 'Detachment meets obstacles: spiritual lessons through suffering.',
      Opposition: 'Detachment vs obstacles tension: letting go opposed by karma.',
      Trine: 'Detachment and karma flow: spiritual growth through obstacles.',
      Square: 'Detachment vs obstacles friction: spirituality challenged by suffering.',
      Sextile: 'Opportunity for karmic release: detachment supports resolution.',
    },
    Gulika: {
      Conjunction: 'Detachment meets poison: spiritual transformation through crisis.',
      Opposition: 'Detachment vs toxicity tension: spirituality opposed by hidden dangers.',
      Trine: 'Detachment and transformation flow: letting go supports deep change.',
      Square: 'Detachment vs poison friction: spirituality challenged by hidden forces.',
      Sextile: 'Opportunity for spiritual purification: detachment supports healing.',
    },
  },
  Mandi: {
    Gulika: {
      Conjunction: 'Double malefic: intense karmic suffering and transformation.',
      Opposition: 'Obstacles vs poison tension: karma opposed by hidden dangers.',
      Trine: 'Obstacles and transformation flow: suffering leads to growth.',
      Square: 'Obstacles vs poison friction: karma compounded by hidden forces.',
      Sextile: 'Opportunity through crisis: obstacles support transformation.',
    },
  },
};

const LIFE_AREAS = [
  { key: 'identity', label: 'Identity', planets: ['Sun'], houses: [1], color: '#f97316', description: 'Your core self, vitality, and life direction' },
  { key: 'emotions', label: 'Emotions', planets: ['Moon'], houses: [4], color: '#a3a3a3', description: 'Emotional nature, comfort, and inner peace' },
  { key: 'action', label: 'Action', planets: ['Mars'], houses: [3, 6], color: '#ef4444', description: 'Drive, courage, and ability to overcome' },
  { key: 'intellect', label: 'Intellect', planets: ['Mercury'], houses: [3, 5], color: '#22c55e', description: 'Communication, learning, and analysis' },
  { key: 'growth', label: 'Growth', planets: ['Jupiter'], houses: [9, 5], color: '#eab308', description: 'Wisdom, luck, expansion, and blessings' },
  { key: 'relationships', label: 'Relationships', planets: ['Venus'], houses: [7], color: '#ec4899', description: 'Love, partnerships, and harmony' },
  { key: 'career', label: 'Career', planets: ['Saturn', 'Sun'], houses: [10], color: '#3b82f6', description: 'Professional success and status' },
  { key: 'wealth', label: 'Wealth', planets: ['Jupiter', 'Venus'], houses: [2, 11], color: '#14b8a6', description: 'Financial prosperity and gains' },
];

const UPAGRAHA_ORDER = ['Dhuma', 'Vyatipata', 'Parivesha', 'Indrachapa', 'Upaketu', 'Kaala', 'Mrityu', 'ArthaPrahara', 'YamaGhantaka', 'Gulika', 'Mandi'];

function calculateAspects(
  planets: Record<string, PlanetInfo>, 
  upagrahas?: Record<string, PlanetInfo>
): Aspect[] {
  const aspects: Aspect[] = [];
  const mainPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const nodes = ['Rahu', 'Ketu'];
  
  // Combine all bodies with their positions
  const allBodies: Record<string, PlanetInfo> = { ...planets };
  if (upagrahas) {
    Object.assign(allBodies, upagrahas);
  }
  
  // All planet names to check (main planets first, then nodes from planets, then upagrahas)
  const allNames = [
    ...mainPlanets,
    ...nodes.filter(n => allBodies[n]),
    ...UPAGRAHA_ORDER.filter(n => allBodies[n]),
  ];
  
  for (let i = 0; i < allNames.length; i++) {
    for (let j = i + 1; j < allNames.length; j++) {
      const p1 = allBodies[allNames[i]];
      const p2 = allBodies[allNames[j]];
      if (!p1 || !p2) continue;
      
      let angle = Math.abs(p1.longitude - p2.longitude);
      if (angle > 180) angle = 360 - angle;
      
      for (const aspectDef of ASPECT_DEFS) {
        const orb = Math.abs(angle - aspectDef.angle);
        if (orb <= aspectDef.orb) {
          aspects.push({
            planet1: allNames[i],
            planet2: allNames[j],
            type: aspectDef.name,
            angle: Math.round(angle),
            orb: Math.round(orb * 10) / 10,
            nature: aspectDef.nature,
            oneLine: ASPECT_ONE_LINERS[aspectDef.name],
            pairOneLine: PLANET_PAIR_ASPECTS[allNames[i]]?.[allNames[j]]?.[aspectDef.name] ?? ASPECT_ONE_LINERS[aspectDef.name],
            description: aspectDef.description,
            color: aspectDef.color,
          });
          break;
        }
      }
    }
  }
  
  return aspects.sort((a, b) => a.orb - b.orb);
}

function SpiderChart({ 
  data, 
  title, 
  subtitle,
  size = 240,
}: { 
  data: RadarDataPoint[]; 
  title: string; 
  subtitle?: string;
  size?: number;
}) {
  const reactId = useId();
  const safeId = useMemo(() => `spider_${reactId}`.replace(/[^a-zA-Z0-9_-]/g, '_'), [reactId]);

  const center = size / 2;
  const baseRadius = size * 0.32;
  const levels = 5;
  const maxScale = 1.3;
  const webRadius = baseRadius * maxScale;

  const points = useMemo(() => {
    const angleStep = (2 * Math.PI) / data.length;
    return data.map((item, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const ratio = item.maxValue > 0 ? item.value / item.maxValue : 0;
      const plotRatio = item.plotRatio ?? ratio;
      const normalizedValue = Math.min(plotRatio, maxScale);
      const strengthRatio = item.strengthRatio ?? ratio;
      const displayPercent = item.displayPercent ?? (ratio * 100);
      const r = baseRadius * normalizedValue;

      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        labelX: center + (webRadius + 22) * Math.cos(angle),
        labelY: center + (webRadius + 22) * Math.sin(angle),
        angle,
        ...item,
        normalizedValue,
        strengthRatio,
        displayPercent,
      };
    });
  }, [data, center, baseRadius, webRadius, maxScale]);

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  const webRings = useMemo(() => {
    const angleStep = (2 * Math.PI) / data.length;
    return Array.from({ length: levels }, (_, i) => {
      const t = ((i + 1) / levels) * maxScale;
      const r = baseRadius * t;
      const ringPoints = Array.from({ length: data.length }, (_, j) => {
        const angle = angleStep * j - Math.PI / 2;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
      }).join(' ');
      return { t, points: ringPoints, isMain: Math.abs(t - 1.0) < 0.01 };
    });
  }, [data.length, levels, maxScale, baseRadius, center]);

  const gridLines = useMemo(() => {
    const angleStep = (2 * Math.PI) / data.length;
    return Array.from({ length: data.length }, (_, i) => {
      const angle = angleStep * i - Math.PI / 2;
      return {
        x1: center,
        y1: center,
        x2: center + webRadius * Math.cos(angle),
        y2: center + webRadius * Math.sin(angle),
      };
    });
  }, [data.length, center, webRadius]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[720px] mb-3">
        <h3 className="text-sm sm:text-base font-semibold text-white truncate text-center">{title}</h3>
        {subtitle && <p className="text-[10px] sm:text-xs text-neutral-500 text-center mt-0.5">{subtitle}</p>}
      </div>
      
      <div className="relative w-full max-w-[720px]">
        <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto overflow-visible">
          <defs>
            <radialGradient id={`grad_${safeId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#d97706" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0.06" />
            </radialGradient>
            <filter id={`glow_${safeId}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`dot_glow_${safeId}`}>
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Web rings */}
          {webRings.map((ring, i) => (
            <polygon
              key={i}
              points={ring.points}
              fill="none"
              stroke={ring.isMain ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={ring.isMain ? 1.5 : 0.5}
              strokeDasharray={ring.isMain ? 'none' : '3,4'}
            />
          ))}

          {/* Grid lines */}
          {gridLines.map((line, i) => (
            <line key={i} {...line} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          ))}

          {/* Data polygon fill */}
          <polygon
            points={polygonPoints}
            fill={`url(#grad_${safeId})`}
            stroke="none"
          />

          {/* Data polygon stroke with glow */}
          <polygon
            points={polygonPoints}
            fill="none"
            stroke="rgba(245,158,11,0.85)"
            strokeWidth="2"
            filter={`url(#glow_${safeId})`}
            strokeLinejoin="round"
          />

          {/* Colored line segments between consecutive points */}
          {points.map((point, i) => {
            const next = points[(i + 1) % points.length];
            return (
              <line
                key={`seg-${i}`}
                x1={point.x}
                y1={point.y}
                x2={next.x}
                y2={next.y}
                stroke={point.color}
                strokeWidth="1.5"
                strokeOpacity="0.7"
              />
            );
          })}

          {/* Data points with glow */}
          {points.map((point, i) => (
            <g key={i}>
              <title>{`${point.label}: ${point.displayPercent.toFixed(0)}% - ${point.description}`}</title>
              <circle
                cx={point.x}
                cy={point.y}
                r={8}
                fill={point.color}
                fillOpacity="0.25"
                filter={`url(#dot_glow_${safeId})`}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={4.5}
                fill={point.color}
                stroke="#0a0a0b"
                strokeWidth="2"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={1.5}
                fill="#0a0a0b"
              />
            </g>
          ))}

          {/* Labels */}
          {points.map((point, i) => {
            const isLeft = point.labelX < center;
            const isTop = point.labelY < center;
            const anchor = Math.abs(point.labelX - center) < 15 ? 'middle' : isLeft ? 'end' : 'start';

            return (
              <g key={`label-${i}`}>
                <text
                  x={point.labelX}
                  y={point.labelY - 8}
                  textAnchor={anchor}
                  dominantBaseline={isTop ? 'auto' : 'hanging'}
                  fontSize="11"
                  fontWeight="500"
                  fill={point.color}
                  opacity="1"
                >
                  {point.icon || ''} {point.shortLabel}
                </text>
                <text
                  x={point.labelX}
                  y={point.labelY + 8}
                  textAnchor={anchor}
                  dominantBaseline={isTop ? 'auto' : 'hanging'}
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="monospace"
                  fill="#ffffff"
                  opacity="1"
                >
                  {point.displayPercent.toFixed(0)}%
                </text>
              </g>
            );
          })}

        </svg>
      </div>
    </div>
  );
}

function InsightCard({ title, value, subtitle, color }: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-4 text-center hover:border-amber-500/20 transition-all duration-200 relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">{title}</div>
      <div className="text-2xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-[10px] text-neutral-400">{subtitle}</div>
    </div>
  );
}

// Helper functions for Shad Bala
const getRupas = (bala: Partial<ShadBalaInfo> | undefined): number => {
  if (!bala) return 0;
  if (bala.total_rupas !== undefined) return bala.total_rupas;
  if (bala.total_shashtiamsas !== undefined) return bala.total_shashtiamsas / 60;
  if (bala.total_bala !== undefined) return bala.total_bala / 60;
  return 0;
};

const getTotalBala = (bala: Partial<ShadBalaInfo> | undefined): number => {
  if (!bala) return 0;
  if (bala.total_shashtiamsas !== undefined) return Math.round(bala.total_shashtiamsas);
  if (bala.total_rupas !== undefined) return Math.round(bala.total_rupas * 60);
  return bala.total_bala ?? 0;
};

// Helper functions for Bhava Bala
const getBhavaRupas = (bala: Partial<BhavaBalaInfo> | undefined): number => {
  if (!bala) return 0;
  if (bala.total_rupas !== undefined) return bala.total_rupas;
  if (bala.total_shashtiamsas !== undefined) return bala.total_shashtiamsas / 60;
  return (bala.strength ?? 0) / 60;
};

// Compact Shad Bala Table Component
function CompactShadBalaTable({ shadBala }: { shadBala: Record<string, Partial<ShadBalaInfo>> }) {
  const basePlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<'planet' | 'rupas' | 'required' | 'percent' | 'strength'>('planet');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const getSortValue = (planet: string, col: typeof sortCol) => {
    const bala = shadBala[planet];
    const rupas = getRupas(bala);
    const required = bala?.required_rupas ?? (planet === 'Moon' ? 6 : planet === 'Jupiter' ? 6.5 : planet === 'Venus' ? 5.5 : planet === 'Mercury' ? 7 : 5);
    const percent = (rupas / required) * 100;
    if (col === 'planet') return basePlanets.indexOf(planet);
    if (col === 'rupas') return rupas;
    if (col === 'required') return required;
    if (col === 'percent') return percent;
    if (col === 'strength') return percent;
    return 0;
  };

  const planets = [...basePlanets].sort((a, b) => {
    const va = getSortValue(a, sortCol);
    const vb = getSortValue(b, sortCol);
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const SortIcon = ({ col }: { col: typeof sortCol }) => (
    <span className={`ml-0.5 text-[8px] ${sortCol === col ? 'text-amber-400' : 'text-neutral-600'}`}>
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  return (
    <div className="bg-[hsl(220,10%,8%)] rounded-lg border border-[hsl(220,8%,18%)] overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(220,10%,10%)] sticky top-0">
            <tr className="border-b border-[hsl(220,8%,18%)]">
              <th className="px-3 py-2 text-left text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('planet')}>Planet<SortIcon col="planet" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('rupas')}>Rupas<SortIcon col="rupas" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('required')}>Required<SortIcon col="required" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('percent')}>%<SortIcon col="percent" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('strength')}>Strength<SortIcon col="strength" /></th>
            </tr>
          </thead>
          <tbody>
            {planets.map(planet => {
              const bala = shadBala[planet];
              const rupas = getRupas(bala);
              const required = bala?.required_rupas ?? (planet === 'Moon' ? 6 : planet === 'Jupiter' ? 6.5 : planet === 'Venus' ? 5.5 : planet === 'Mercury' ? 7 : 5);
              const percent = (rupas / required) * 100;
              const strength = percent >= 120 ? 'Strong' : percent >= 90 ? 'Medium' : 'Weak';
              const strengthColor = 'text-white';
              const config = PLANET_CONFIG[planet];

              return (
                <Fragment key={planet}>
                  <tr 
                    className="border-b border-[hsl(220,8%,14%)] hover:bg-[hsl(220,10%,10%)] cursor-pointer transition-colors"
                    onClick={() => setExpandedPlanet(expandedPlanet === planet ? null : planet)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span style={{ color: config?.color }}>{config?.icon}</span>
                        <span className="text-white font-medium">{planet}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">{rupas.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">{required}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={strengthColor}>{percent.toFixed(0)}%</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-[9px] font-medium ${
                        strength === 'Strong' ? 'bg-green-500/20 text-green-400' :
                        strength === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {strength}
                      </span>
                    </td>
                  </tr>
                  {expandedPlanet === planet && bala && (
                    <tr className="bg-[hsl(220,10%,9%)]">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="space-y-2">
                          <div className="text-[10px] text-neutral-400 mb-2">{config?.description}</div>
                          {/* Sub-bala breakdown */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                            {(() => {
                              const sthana = typeof bala.sthana_bala === 'object' ? (bala.sthana_bala as any).total : (bala.sthana_bala ?? 0);
                              const kala = typeof bala.kala_bala === 'object' ? (bala.kala_bala as any).total : (bala.kala_bala ?? 0);
                              const subBalas = [
                                { name: 'Sthana', value: sthana, max: 180, color: '#f59e0b' },
                                { name: 'Dig', value: bala.dig_bala ?? 0, max: 60, color: '#3b82f6' },
                                { name: 'Kala', value: kala, max: 300, color: '#8b5cf6' },
                                { name: 'Chesta', value: bala.chesta_bala ?? 0, max: 60, color: '#ef4444' },
                                { name: 'Naisargika', value: bala.naisargika_bala ?? 0, max: 60, color: '#10b981' },
                                { name: 'Drik', value: bala.drik_bala ?? 0, max: 60, color: '#06b6d4' },
                              ];
                              return subBalas.map(sb => (
                                <div key={sb.name} className="flex items-center gap-2">
                                  <span className="text-neutral-500 w-16">{sb.name}</span>
                                  <div className="flex-1 h-1.5 bg-neutral-700/50 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, (Number(sb.value) / sb.max) * 100))}%`, background: sb.color }} />
                                  </div>
                                  <span className="text-white font-mono w-8 text-right">{Number(sb.value).toFixed(0)}</span>
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="text-[9px] text-neutral-500 pt-1 border-t border-neutral-700/30">
                            Total: {getTotalBala(bala)} shashtiamsas = {rupas.toFixed(2)} rupas
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Compact Bhava Bala Table Component
function CompactBhavaBalaTable({ bhavaBala }: { bhavaBala: Record<number, Partial<BhavaBalaInfo>> | undefined }) {
  const baseHouses = Array.from({ length: 12 }, (_, i) => i + 1);
  const [expandedHouse, setExpandedHouse] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<'house' | 'rupas' | 'max' | 'percent' | 'strength'>('house');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const getSortValue = (house: number, col: typeof sortCol) => {
    const bala = bhavaBala?.[house];
    const rupas = getBhavaRupas(bala);
    const maxRupas = 4.5;
    const percent = (rupas / maxRupas) * 100;
    if (col === 'house') return house;
    if (col === 'rupas') return rupas;
    if (col === 'max') return maxRupas;
    if (col === 'percent') return percent;
    if (col === 'strength') return percent;
    return 0;
  };

  const houses = [...baseHouses].sort((a, b) => {
    const va = getSortValue(a, sortCol);
    const vb = getSortValue(b, sortCol);
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const SortIcon = ({ col }: { col: typeof sortCol }) => (
    <span className={`ml-0.5 text-[8px] ${sortCol === col ? 'text-amber-400' : 'text-neutral-600'}`}>
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  return (
    <div className="bg-[hsl(220,10%,8%)] rounded-lg border border-[hsl(220,8%,18%)] overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(220,10%,10%)] sticky top-0">
            <tr className="border-b border-[hsl(220,8%,18%)]">
              <th className="px-3 py-2 text-left text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('house')}>House<SortIcon col="house" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('rupas')}>Rupas<SortIcon col="rupas" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('max')}>Max<SortIcon col="max" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('percent')}>%<SortIcon col="percent" /></th>
              <th className="px-3 py-2 text-center text-neutral-400 cursor-pointer hover:text-white select-none" onClick={() => handleSort('strength')}>Strength<SortIcon col="strength" /></th>
            </tr>
          </thead>
          <tbody>
            {houses.map(house => {
              const bala = bhavaBala?.[house];
              const rupas = getBhavaRupas(bala);
              const maxRupas = 4.5;
              const percent = (rupas / maxRupas) * 100;
              const strength = percent >= 120 ? 'Strong' : percent >= 90 ? 'Medium' : 'Weak';
              const strengthColor = 'text-white';
              const config = HOUSE_CONFIG[house];

              return (
                <Fragment key={house}>
                  <tr 
                    className="border-b border-[hsl(220,8%,14%)] hover:bg-[hsl(220,10%,10%)] cursor-pointer transition-colors"
                    onClick={() => setExpandedHouse(expandedHouse === house ? null : house)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: config?.color }}>H{house}</span>
                        <span className="text-neutral-500">{config?.shortLabel}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">{rupas.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">{maxRupas}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={strengthColor}>{percent.toFixed(0)}%</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-[9px] font-medium ${
                        strength === 'Strong' ? 'bg-green-500/20 text-green-400' :
                        strength === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {strength}
                      </span>
                    </td>
                  </tr>
                  {expandedHouse === house && (
                    <tr className="bg-[hsl(220,10%,9%)]">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="text-[10px] text-neutral-500 space-y-1">
                          <div>Description: {config?.description}</div>
                          <div>Significator: {config?.significator}</div>
                          <div>Keywords: {config?.keywords?.slice(0, 3).join(', ')}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Compact Planetary Positions Table Component
function CompactPlanetPositionsTable({ planets, upagrahas, lagna }: { 
  planets: Record<string, PlanetInfo>; 
  upagrahas?: Record<string, PlanetInfo>;
  lagna: { sign: string; deg: number; min: number };
}) {
  const PLANET_ORDER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);
  const allBodies = useMemo(() => ({ ...planets, ...(upagrahas ?? {}) }), [planets, upagrahas]);
  const BODY_ORDER = [...PLANET_ORDER, ...UPAGRAHA_ORDER];

  return (
    <div className="bg-[hsl(220,10%,8%)] rounded-lg border border-[hsl(220,8%,18%)] overflow-hidden">
      <div className="p-3 bg-[hsl(220,10%,10%)] border-b border-[hsl(220,8%,18%)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Planetary Positions</h3>
          <div className="text-[10px] text-neutral-500">
            Lagna: {lagna.sign} {lagna.deg}°{lagna.min}'
          </div>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(220,10%,10%)] sticky top-0">
            <tr className="border-b border-[hsl(220,8%,18%)]">
              <th className="px-3 py-2 text-left text-neutral-400">Planet</th>
              <th className="px-3 py-2 text-left text-neutral-400">Sign</th>
              <th className="px-3 py-2 text-center text-neutral-400">Degree</th>
              <th className="px-3 py-2 text-center text-neutral-400">House</th>
              <th className="px-3 py-2 text-center text-neutral-400">Nakshatra</th>
            </tr>
          </thead>
          <tbody>
            {BODY_ORDER.map(planetName => {
              const planet = allBodies[planetName];
              if (!planet) return null;
              const config = PLANET_CONFIG[planetName];
              const isUpagraha = UPAGRAHA_ORDER.includes(planetName);

              return (
                <Fragment key={planetName}>
                  <tr 
                    className="border-b border-[hsl(220,8%,14%)] hover:bg-[hsl(220,10%,10%)] cursor-pointer transition-colors"
                    onClick={() => setExpandedPlanet(expandedPlanet === planetName ? null : planetName)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span style={{ color: config?.color }}>{config?.icon}</span>
                        <span className="text-white font-medium">{planetName}</span>
                        {isUpagraha && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300">Upagraha</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">{planet.sign}</td>
                    <td className="px-3 py-2 text-center">{planet.deg}°{planet.min}'</td>
                    <td className="px-3 py-2 text-center">{planet.house_whole_sign}</td>
                    <td className="px-3 py-2 text-center text-[10px]">
                      {planet.nakshatra ? `${planet.nakshatra} P${planet.nakshatra_pada}` : '-'}
                    </td>
                  </tr>
                  {expandedPlanet === planetName && (
                    <tr className="bg-[hsl(220,10%,9%)]">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="text-[10px] space-y-1.5">
                          <div className="text-neutral-400">{config?.description}</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div><span className="text-neutral-500">Longitude:</span> <span className="text-white font-mono">{planet.longitude.toFixed(4)}°</span></div>
                            <div><span className="text-neutral-500">Sign:</span> <span className="text-white">{planet.sign} ({planet.sign_sanskrit})</span></div>
                            <div><span className="text-neutral-500">Type:</span> <span className="text-white">{isUpagraha ? 'Upagraha' : 'Graha'}</span></div>
                            <div><span className="text-neutral-500">Navamsa:</span> <span className="text-white">{planet.navamsa_sign || '-'}</span></div>
                            <div><span className="text-neutral-500">House:</span> <span className="text-white">{planet.house_whole_sign}</span></div>
                            {planet.nakshatra && <div><span className="text-neutral-500">Nakshatra:</span> <span className="text-amber-300">{planet.nakshatra} Pada {planet.nakshatra_pada}</span></div>}
                            {planet.nakshatra_lord && <div><span className="text-neutral-500">Nak. Lord:</span> <span className="text-white">{planet.nakshatra_lord}</span></div>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {planet.retrograde && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px]">Retrograde</span>}
                            {planet.exalted && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[9px]">Exalted</span>}
                            {planet.debilitated && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[9px]">Debilitated</span>}
                            {planet.vargottama && <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px]">Vargottama</span>}
                            {planet.combust && <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[9px]">Combust</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Compact Dasha Table Component
function CompactDashaTable({ dashaData }: { dashaData: DashaInfo }) {
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  const safeGetDate = (isoOrYmd: string | undefined, fallbackYmd?: string) => {
    const raw = isoOrYmd ?? fallbackYmd;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const activeIndex = (() => {
    const now = new Date();
    return dashaData.periods.findIndex((period) => {
      const startFallback = `${period.start_year}-${period.start_month}-${period.start_day}`;
      const endFallback = period.end_year && period.end_month && period.end_day
        ? `${period.end_year}-${period.end_month}-${period.end_day}`
        : undefined;

      const startDate = safeGetDate(period.start_datetime, startFallback);
      if (!startDate) return false;
      const endDate = safeGetDate(period.end_datetime, period.end_date ?? endFallback);

      return now >= startDate && (!endDate || now <= endDate);
    });
  })();

  const activePeriod = activeIndex >= 0 ? dashaData.periods[activeIndex] : undefined;
  const now = new Date();
  const currentAntardasha = activePeriod?.antardashas?.find((ad) => {
    const adStart = safeGetDate(ad.start_datetime, ad.start_date);
    const adEnd = safeGetDate(ad.end_datetime, ad.end_date);
    if (!adStart) return false;
    return now >= adStart && (!adEnd || now < adEnd);
  });
  const currentPratyantardasha = currentAntardasha?.pratyantardashas?.find((pad) => {
    const padStart = safeGetDate(pad.start_datetime, pad.start_date);
    const padEnd = safeGetDate(pad.end_datetime, pad.end_date);
    if (!padStart) return false;
    return now >= padStart && (!padEnd || now < padEnd);
  });

  return (
    <div className="bg-[hsl(220,10%,8%)] rounded-lg border border-[hsl(220,8%,18%)] overflow-hidden">
      <div className="p-3 bg-[hsl(220,10%,10%)] border-b border-[hsl(220,8%,18%)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Vimshottari Dasha</h3>
          <div className="text-[10px] text-neutral-500 text-right">
            <div>Current: {(activePeriod?.planet ?? dashaData.current_dasha ?? 'Unknown')} Mahadasha</div>
            {currentAntardasha && <div>AD: {currentAntardasha.planet}</div>}
            {currentPratyantardasha && <div>PAD: {currentPratyantardasha.planet}</div>}
          </div>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(220,10%,10%)] sticky top-0">
            <tr className="border-b border-[hsl(220,8%,18%)]">
              <th className="px-3 py-2 text-left text-neutral-500">Planet</th>
              <th className="px-3 py-2 text-left text-neutral-500">Start</th>
              <th className="px-3 py-2 text-left text-neutral-500">End</th>
              <th className="px-3 py-2 text-center text-neutral-500">Years</th>
              <th className="px-3 py-2 text-center text-neutral-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {dashaData.periods.map((period, index) => {
              const config = PLANET_CONFIG[period.planet];
              const isActive = index === activeIndex;
              const isPast = index < activeIndex;

              return (
                <Fragment key={period.planet}>
                  <tr 
                    className={`border-b border-[hsl(220,8%,14%)] hover:bg-[hsl(220,10%,10%)] cursor-pointer transition-colors ${
                      isActive ? 'bg-amber-500/10' : ''
                    }`}
                    onClick={() => setExpandedPeriod(expandedPeriod === period.planet ? null : period.planet)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span style={{ color: config?.color }}>{config?.icon}</span>
                        <span className={`font-medium ${
                          isActive ? 'text-amber-400' : 'text-white'
                        }`}>{period.planet}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[10px]">
                      {period.start_date}
                    </td>
                    <td className="px-3 py-2 text-[10px]">
                      {period.end_date ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center">{formatYears(period.years)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-[9px] font-medium ${
                        isActive ? 'bg-amber-500/20 text-amber-400' :
                        isPast ? 'bg-gray-500/20 text-gray-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {isActive ? 'Active' : isPast ? 'Past' : 'Future'}
                      </span>
                    </td>
                  </tr>
                  {expandedPeriod === period.planet && (
                    <tr className="bg-[hsl(220,10%,9%)]">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="text-[10px] text-neutral-400 mb-2">{config?.description}</div>
                        {period.antardashas && period.antardashas.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">Antardashas</div>
                            {period.antardashas.map((ad) => {
                              const adConfig = PLANET_CONFIG[ad.planet];
                              const now = new Date();
                              const adStart = new Date(ad.start_datetime || ad.start_date);
                              const adEnd = ad.end_datetime ? new Date(ad.end_datetime) : new Date(ad.end_date || '');
                              const isAdActive = now >= adStart && now < adEnd;
                              return (
                                <div key={ad.planet} className={`rounded-md border ${isAdActive ? 'border-amber-500/30 bg-amber-500/5' : 'border-neutral-800/30 bg-neutral-900/30'}`}>
                                  <div
                                    className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-neutral-800/20 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setExpandedPeriod(expandedPeriod === `${period.planet}-${ad.planet}` ? period.planet : `${period.planet}-${ad.planet}`); }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span style={{ color: adConfig?.color }} className="text-[10px]">{adConfig?.icon}</span>
                                      <span className={`text-[11px] font-medium ${isAdActive ? 'text-amber-300' : 'text-white'}`}>{ad.planet}</span>
                                      {isAdActive && <span className="text-[8px] px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded">Active</span>}
                                    </div>
                                    <div className="flex items-center gap-3 text-[9px] text-neutral-500">
                                      <span>{ad.start_date}</span>
                                      <span>→</span>
                                      <span>{ad.end_date}</span>
                                      <span className="text-neutral-600">{formatYears(ad.years)}</span>
                                    </div>
                                  </div>
                                  {expandedPeriod === `${period.planet}-${ad.planet}` && ad.pratyantardashas && (
                                    <div className="px-2 pb-2 pt-1 border-t border-neutral-800/20">
                                      <div className="text-[9px] font-semibold text-yellow-300/70 uppercase tracking-wider mb-1">Pratyantardashas</div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                                        {ad.pratyantardashas.map((pad) => {
                                          const padConfig = PLANET_CONFIG[pad.planet];
                                          const padStart = new Date(pad.start_datetime || pad.start_date);
                                          const padEnd = pad.end_datetime ? new Date(pad.end_datetime) : new Date(pad.end_date || '');
                                          const isPadActive = now >= padStart && now < padEnd;
                                          return (
                                            <div key={pad.planet} className={`flex items-center justify-between px-1.5 py-1 rounded text-[9px] ${isPadActive ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-neutral-900/30'}`}>
                                              <div className="flex items-center gap-1">
                                                <span style={{ color: padConfig?.color }}>{padConfig?.icon}</span>
                                                <span className={isPadActive ? 'text-yellow-300 font-medium' : 'text-neutral-400'}>{pad.planet}</span>
                                              </div>
                                              <span className="text-neutral-600">{pad.start_date?.slice(5)}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StrengthAnalysis({ shadBala, bhavaBala, planets, upagrahas, lagna, dashaData }: StrengthAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'combined' | 'planets' | 'houses' | 'aspects' | 'shad-table' | 'bhava-table' | 'positions' | 'dasha'>('combined');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);
  
  // Filter state for aspects
  const [aspectFilters, setAspectFilters] = useState({
    planet: 'all' as string,
    type: 'all' as string,
    nature: 'all' as string,
  });

  // Calculate aspects from planet positions (including upagrahas)
  const aspects = useMemo(() => {
    if (!planets) return [];
    return calculateAspects(planets, upagrahas);
  }, [planets, upagrahas]);
  
  // Get unique planets from aspects for filter dropdown
  const aspectPlanets = useMemo(() => {
    const planetSet = new Set<string>();
    aspects.forEach(a => {
      planetSet.add(a.planet1);
      planetSet.add(a.planet2);
    });
    return Array.from(planetSet).sort();
  }, [aspects]);
  
  // Filtered aspects based on filter state
  const filteredAspects = useMemo(() => {
    return aspects.filter(a => {
      if (aspectFilters.planet !== 'all' && a.planet1 !== aspectFilters.planet && a.planet2 !== aspectFilters.planet) {
        return false;
      }
      if (aspectFilters.type !== 'all' && a.type !== aspectFilters.type) {
        return false;
      }
      if (aspectFilters.nature !== 'all' && a.nature !== aspectFilters.nature) {
        return false;
      }
      return true;
    });
  }, [aspects, aspectFilters]);

  // Process Shad Bala data
  const planetData = useMemo(() => {
    const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    return planets.map(planet => {
      const bala = shadBala[planet];
      const config = PLANET_CONFIG[planet];
      const rupas = bala?.total_rupas ?? 
        (bala?.total_shashtiamsas ? bala.total_shashtiamsas / 60 : 
        (bala?.total_bala ? bala.total_bala / 60 : 0));
      const required = bala?.required_rupas ?? REQUIRED_RUPAS[planet] ?? 5;
      
      return {
        label: `${config.icon} ${planet}`,
        shortLabel: config.label,
        description: config.description,
        value: rupas,
        maxValue: required,
        color: config.color,
        icon: config.icon,
      };
    });
  }, [shadBala]);

  // Process Bhava Bala data
  const houseData = useMemo(() => {
    if (!bhavaBala) return [];
    const BHAVA_MAX = 4.5;
    const houses = Array.from({ length: 12 }, (_, i) => i + 1);
    
    const getHouseRupas = (house: number) => {
      const bala = bhavaBala[house];
      if (!bala) return 0;
      if (typeof bala.total_rupas === 'number') return bala.total_rupas;
      if (typeof bala.total_shashtiamsas === 'number') return bala.total_shashtiamsas / 60;
      if (typeof bala.strength === 'number') return bala.strength / 60;
      return 0;
    };

    const ratios = houses.map(h => getHouseRupas(h) / BHAVA_MAX);
    const minR = Math.min(...ratios);
    const maxR = Math.max(...ratios);
    const range = Math.max(0.001, maxR - minR);

    return houses.map(house => {
      const config = HOUSE_CONFIG[house];
      const rupas = getHouseRupas(house);
      const ratio = rupas / BHAVA_MAX;
      
      return {
        label: `H${house}`,
        shortLabel: config.shortLabel,
        description: config.description,
        value: rupas,
        maxValue: BHAVA_MAX,
        strengthRatio: ratio,
        displayPercent: ratio * 100,
        plotRatio: 0.5 + ((ratio - minR) / range) * 0.9,
        color: config.color,
      };
    });
  }, [bhavaBala]);

  // Combined life area data
  const lifeAreaData = useMemo(() => {
    return LIFE_AREAS.map(area => {
      // Average planet strengths
      let planetScore = 0;
      area.planets.forEach(p => {
        const pd = planetData.find(d => d.icon === PLANET_CONFIG[p]?.icon);
        if (pd) planetScore += pd.value / pd.maxValue;
      });
      planetScore /= area.planets.length;

      // Average house strengths
      let houseScore = 0;
      if (houseData.length > 0) {
        area.houses.forEach(h => {
          const hd = houseData[h - 1];
          if (hd) houseScore += hd.strengthRatio ?? 0;
        });
        houseScore /= area.houses.length;
      }

      const combinedScore = houseData.length > 0 ? (planetScore + houseScore) / 2 : planetScore;

      return {
        label: area.label,
        shortLabel: area.label,
        description: `Combined strength for ${area.label.toLowerCase()}`,
        value: combinedScore,
        maxValue: 1,
        color: area.color,
      };
    });
  }, [planetData, houseData]);

  // Calculate insights
  const insights = useMemo(() => {
    const planetAvg = planetData.reduce((s, p) => s + p.value / p.maxValue, 0) / planetData.length;
    const houseAvg = houseData.length > 0 
      ? houseData.reduce((s, h) => s + (h.strengthRatio ?? 0), 0) / houseData.length 
      : 0;
    
    const strongPlanets = planetData.filter(p => p.value / p.maxValue >= 1.2).length;
    const strongHouses = houseData.filter(h => (h.strengthRatio ?? 0) >= 1.2).length;
    
    const strongest = [...planetData].sort((a, b) => (b.value / b.maxValue) - (a.value / a.maxValue))[0];
    const weakest = [...planetData].sort((a, b) => (a.value / a.maxValue) - (b.value / b.maxValue))[0];

    return { planetAvg, houseAvg, strongPlanets, strongHouses, strongest, weakest };
  }, [planetData, houseData]);

  return (
    <div className="bg-[hsl(220,10%,8%)] rounded-xl sm:rounded-2xl border border-[hsl(220,8%,18%)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 bg-[hsl(220,10%,7%)] border-b border-[hsl(220,8%,18%)]">
        <div className="flex items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-white truncate">Strength Analysis</h2>
              <p className="hidden sm:block text-xs text-neutral-400 mt-0.5">Your astrological power profile</p>
            </div>
          </div>

          {/* Desktop segmented control */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] overflow-x-auto scrollbar-none">
            {(['combined', 'planets', 'houses', 'aspects', 'shad-table', 'bhava-table', 'positions', 'dasha'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-white text-black'
                    : 'text-white/70 hover:text-white hover:bg-[hsl(220,10%,14%)]'
                }`}
              >
                {tab === 'combined' ? 'Overview' :
                 tab === 'planets' ? 'Planets' :
                 tab === 'houses' ? 'Houses' :
                 tab === 'aspects' ? 'Aspects' :
                 tab === 'shad-table' ? 'Shad Bala' :
                 tab === 'bhava-table' ? 'Bhava Bala' :
                 tab === 'positions' ? 'Positions' :
                 'Dasha'}
              </button>
            ))}
          </div>

          {/* Mobile dropdown */}
          <div ref={dropdownRef} className="sm:hidden relative shrink-0">
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="px-3 py-2 rounded-lg bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] text-white text-xs font-medium flex items-center gap-2"
            >
              <span>
                {activeTab === 'combined' ? 'Overview' :
                 activeTab === 'planets' ? 'Planets' :
                 activeTab === 'houses' ? 'Houses' :
                 activeTab === 'aspects' ? 'Aspects' :
                 activeTab === 'shad-table' ? 'Shad Bala' :
                 activeTab === 'bhava-table' ? 'Bhava Bala' :
                 activeTab === 'positions' ? 'Positions' :
                 'Dasha'}
              </span>
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] shadow-xl overflow-hidden z-50">
                {(['combined', 'planets', 'houses', 'aspects', 'shad-table', 'bhava-table', 'positions', 'dasha'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-white text-black'
                        : 'text-neutral-300 hover:text-white hover:bg-[hsl(220,10%,12%)]'
                    }`}
                  >
                    {tab === 'combined' ? 'Overview' :
                     tab === 'planets' ? 'Planets' :
                     tab === 'houses' ? 'Houses' :
                     tab === 'aspects' ? 'Aspects' :
                     tab === 'shad-table' ? 'Shad Bala' :
                     tab === 'bhava-table' ? 'Bhava Bala' :
                     tab === 'positions' ? 'Positions' :
                     'Dasha'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Combined View */}
        {activeTab === 'combined' && (
          <div className="space-y-8">
            {/* Expressive Summary */}
            <div className="bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 border border-amber-500/10 rounded-xl p-4 mb-2">
              <p className="text-sm text-neutral-300 leading-relaxed">
                {insights.planetAvg >= 1.0 
                  ? <>Your chart shows <span className="text-white font-semibold">strong planetary energy</span> overall. {insights.strongPlanets} out of 7 planets exceed their required strength, giving you a solid foundation.</>
                  : insights.planetAvg >= 0.8
                  ? <>Your chart has <span className="text-white font-semibold">moderate planetary strength</span>. {insights.strongPlanets} planets are strong while others need attention through focused effort.</>
                  : <>Your chart indicates areas that <span className="text-white font-semibold">need conscious development</span>. Focus on strengthening {insights.weakest?.shortLabel || 'weaker'} areas through practical action.</>
                }
                {insights.strongest && <> Your strongest asset is <span className="font-semibold" style={{ color: insights.strongest.color }}>{insights.strongest.shortLabel}</span> ({insights.strongest.icon}) — lean into this energy.</>}
                {insights.weakest && <> Work on <span className="font-semibold" style={{ color: insights.weakest.color }}>{insights.weakest.shortLabel}</span> ({insights.weakest.icon}) for balanced growth.</>}
              </p>
            </div>

            {/* Insight Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InsightCard 
                title="Planet Power" 
                value={`${(insights.planetAvg * 100).toFixed(0)}%`}
                subtitle={insights.planetAvg >= 1.0 ? 'Excellent overall' : insights.planetAvg >= 0.8 ? 'Good foundation' : 'Room to grow'}
                color={insights.planetAvg >= 1.0 ? '#4ade80' : insights.planetAvg >= 0.8 ? '#fbbf24' : '#f87171'}
              />
              <InsightCard 
                title="House Power" 
                value={houseData.length > 0 ? `${(insights.houseAvg * 100).toFixed(0)}%` : 'N/A'}
                subtitle={houseData.length > 0 ? `${insights.strongHouses}/12 houses strong` : 'No data'}
                color={houseData.length > 0 ? (insights.houseAvg >= 1.0 ? '#4ade80' : insights.houseAvg >= 0.8 ? '#fbbf24' : '#f87171') : '#666'}
              />
              <InsightCard 
                title="Strongest" 
                value={insights.strongest?.icon || '—'}
                subtitle={insights.strongest ? `${insights.strongest.shortLabel} — your superpower` : ''}
                color={insights.strongest?.color || '#fff'}
              />
              <InsightCard 
                title="Needs Focus" 
                value={insights.weakest?.icon || '—'}
                subtitle={insights.weakest ? `${insights.weakest.shortLabel} — work on this` : ''}
                color={insights.weakest?.color || '#fff'}
              />
            </div>

            {/* Combined Chart */}
            <div className="flex justify-center">
              <SpiderChart
                data={lifeAreaData}
                title="Life Balance"
                subtitle="Combined planetary & house strengths"
                size={520}
              />
            </div>
          </div>
        )}

        {/* Planets View */}
        {activeTab === 'planets' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <SpiderChart
                data={planetData}
                title="Shad Bala"
                subtitle="Sixfold planetary strength"
                size={480}
              />
            </div>

            {/* Planet Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(planet => {
                const config = PLANET_CONFIG[planet];
                const pd = planetData.find(p => p.icon === config.icon);
                const percent = pd ? (pd.value / pd.maxValue) * 100 : 0;
                
                return (
                  <div key={planet} className="bg-[hsl(220,10%,10%)] rounded-lg p-3 border border-[hsl(220,8%,18%)] hover:border-amber-500/20 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" style={{ color: config.color }}>{config.icon}</span>
                        <div>
                          <div className="text-xs font-semibold text-white">{planet}</div>
                          <div className="text-[9px] text-neutral-400">{config.label} • {config.nature}</div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {percent.toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="text-[10px] text-neutral-400 mb-2">{config.description}</div>
                    
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] border-t border-neutral-700/30 pt-2 mt-2">
                      <div><span className="text-neutral-500">Element:</span> <span className="text-white">{config.element}</span></div>
                      <div><span className="text-neutral-500">Rules:</span> <span className="text-white">{config.rules}</span></div>
                      <div><span className="text-neutral-500">Day:</span> <span className="text-white">{config.day}</span></div>
                      <div><span className="text-neutral-500">Body:</span> <span className="text-white">{config.bodyParts.split(',')[0]}</span></div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      {config.keywords.slice(0, 3).map(k => (
                        <span key={k} className="px-1.5 py-0.5 bg-neutral-700/50 rounded text-[8px]" style={{ color: config.color }}>{k}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Houses View */}
        {activeTab === 'houses' && houseData.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <SpiderChart
                data={houseData}
                title="Bhava Bala"
                subtitle="House strength distribution"
                size={480}
              />
            </div>

            {/* House Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1, 4, 7, 10].map(h => {
                const config = HOUSE_CONFIG[h];
                return (
                  <div key={h} className="bg-[hsl(220,10%,10%)] rounded-lg p-3 border border-[hsl(220,8%,18%)] hover:border-amber-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold" style={{ color: config.color }}>H{h}</span>
                      <span className="text-xs text-neutral-400">{config.label}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400">{config.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {config.keywords.map(k => (
                        <span key={k} className="px-1.5 py-0.5 bg-neutral-700/50 rounded text-[9px] text-neutral-400">{k}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Aspects View */}
        {activeTab === 'aspects' && (
          <div className="space-y-6">
            {/* Aspect Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{aspects.filter(a => a.nature === 'harmonious').length}</div>
                <div className="text-[10px] text-green-400/80 uppercase">Harmonious</div>
                <div className="text-[9px] text-neutral-400 mt-1">Trines & Sextiles</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-400">{aspects.filter(a => a.nature === 'tense').length}</div>
                <div className="text-[10px] text-orange-400/80 uppercase">Challenging</div>
                <div className="text-[9px] text-neutral-400 mt-1">Squares & Oppositions</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{aspects.filter(a => a.nature === 'neutral').length}</div>
                <div className="text-[10px] text-yellow-400/80 uppercase">Conjunctions</div>
                <div className="text-[9px] text-neutral-400 mt-1">Energy Fusion</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 p-3 bg-[hsl(220,10%,10%)] rounded-lg border border-[hsl(220,8%,18%)]">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-neutral-400 uppercase">Planet:</label>
                <select
                  value={aspectFilters.planet}
                  onChange={(e) => setAspectFilters(f => ({ ...f, planet: e.target.value }))}
                  className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/30"
                >
                  <option value="all">All</option>
                  {aspectPlanets.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-neutral-400 uppercase">Type:</label>
                <select
                  value={aspectFilters.type}
                  onChange={(e) => setAspectFilters(f => ({ ...f, type: e.target.value }))}
                  className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/30"
                >
                  <option value="all">All</option>
                  {ASPECT_DEFS.map(a => (
                    <option key={a.name} value={a.name}>{a.symbol} {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-neutral-400 uppercase">Nature:</label>
                <select
                  value={aspectFilters.nature}
                  onChange={(e) => setAspectFilters(f => ({ ...f, nature: e.target.value }))}
                  className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/30"
                >
                  <option value="all">All</option>
                  <option value="harmonious">Harmonious</option>
                  <option value="tense">Challenging</option>
                  <option value="neutral">Conjunctions</option>
                </select>
              </div>
              {(aspectFilters.planet !== 'all' || aspectFilters.type !== 'all' || aspectFilters.nature !== 'all') && (
                <button
                  onClick={() => setAspectFilters({ planet: 'all', type: 'all', nature: 'all' })}
                  className="text-[10px] text-white hover:text-neutral-300 underline"
                >
                  Clear filters
                </button>
              )}
              <div className="ml-auto text-[10px] text-neutral-400">
                Showing {filteredAspects.length} of {aspects.length} aspects
              </div>
            </div>

            {/* Aspect Legend */}
            <div className="flex flex-wrap justify-center gap-4 text-[10px] py-2 border-y border-neutral-700/30">
              {ASPECT_DEFS.map(a => (
                <div key={a.name} className="flex items-center gap-1.5">
                  <span style={{ color: a.color }} className="font-bold">{a.symbol}</span>
                  <span className="text-neutral-400">{a.name} ({a.angle}°)</span>
                </div>
              ))}
            </div>

            {/* Aspect List */}
            {filteredAspects.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Active Aspects</h4>
                <div className="grid gap-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredAspects.map((aspect, i) => {
                    const p1Config = PLANET_CONFIG[aspect.planet1];
                    const p2Config = PLANET_CONFIG[aspect.planet2];
                    const aspectDef = ASPECT_DEFS.find(a => a.name === aspect.type);
                    
                    return (
                      <div 
                        key={i} 
                        className="flex items-center gap-3 p-3 bg-[hsl(220,10%,10%)] rounded-lg border border-[hsl(220,8%,18%)] hover:border-amber-500/20 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <span style={{ color: p1Config?.color ?? '#888' }} className="text-lg">{p1Config?.icon ?? aspect.planet1.slice(0,2)}</span>
                          <span style={{ color: aspect.color }} className="text-sm font-bold">{aspectDef?.symbol}</span>
                          <span style={{ color: p2Config?.color ?? '#888' }} className="text-lg">{p2Config?.icon ?? aspect.planet2.slice(0,2)}</span>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-white">{aspect.planet1} {aspect.type} {aspect.planet2}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              aspect.nature === 'harmonious' ? 'bg-green-500/20 text-green-400' :
                              aspect.nature === 'tense' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {aspect.nature}
                            </span>
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{aspect.pairOneLine}</div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xs font-medium text-neutral-500">{aspect.angle}°</div>
                          <div className="text-[9px] text-neutral-500">orb {aspect.orb}°</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-500">
                <div className="text-sm">{aspects.length > 0 ? 'No aspects match filters' : 'No aspect data available'}</div>
                <div className="text-xs mt-1">{aspects.length > 0 ? 'Try adjusting your filters' : 'Planet positions needed to calculate aspects'}</div>
              </div>
            )}

            {/* Aspect Interpretation Guide */}
            <div className="bg-[hsl(220,10%,9%)] rounded-lg p-4 border border-[hsl(220,8%,16%)]">
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Understanding Aspects</h4>
              <div className="grid sm:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-green-400 font-medium">△ Trines (120°)</span>
                  <span className="text-neutral-500"> - Natural talents, easy flow of energy, gifts that come easily</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-medium">⚹ Sextiles (60°)</span>
                  <span className="text-neutral-500"> - Opportunities, skills that develop with effort, cooperation</span>
                </div>
                <div>
                  <span className="text-orange-400 font-medium">□ Squares (90°)</span>
                  <span className="text-neutral-500"> - Friction that drives growth, challenges that build character</span>
                </div>
                <div>
                  <span className="text-red-400 font-medium">☍ Oppositions (180°)</span>
                  <span className="text-neutral-500"> - Awareness through polarity, balance between opposing forces</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shad Bala Table View */}
        {activeTab === 'shad-table' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Shad Bala Details</h3>
              <div className="text-[10px] text-neutral-500">
                Click rows for more details
              </div>
            </div>
            <CompactShadBalaTable shadBala={shadBala} />
          </div>
        )}

        {/* Bhava Bala Table View */}
        {activeTab === 'bhava-table' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Bhava Bala Details</h3>
              <div className="text-[10px] text-neutral-500">
                Click rows for more details
              </div>
            </div>
            <CompactBhavaBalaTable bhavaBala={bhavaBala} />
          </div>
        )}

        {/* Planetary Positions View */}
        {activeTab === 'positions' && planets && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Planetary Positions</h3>
              <div className="text-[10px] text-neutral-500">
                Click rows for more details
              </div>
            </div>
            <CompactPlanetPositionsTable 
              planets={planets} 
              upagrahas={upagrahas}
              lagna={lagna ? { sign: lagna.sign, deg: lagna.deg, min: lagna.min } : { sign: 'Unknown', deg: 0, min: 0 }}
            />
          </div>
        )}

        {activeTab === 'positions' && !planets && (
          <div className="text-center py-8 text-neutral-500">
            <div className="text-sm">No planetary position data available</div>
            <div className="text-xs mt-1">Generate a kundali to view positions</div>
          </div>
        )}

        {/* Dasha View */}
        {activeTab === 'dasha' && dashaData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Vimshottari Dasha</h3>
              <div className="text-[10px] text-neutral-500">
                Click rows for more details
              </div>
            </div>
            <CompactDashaTable dashaData={dashaData} />
          </div>
        )}

        {activeTab === 'dasha' && !dashaData && (
          <div className="text-center py-8 text-neutral-500">
            <div className="text-sm">No dasha data available</div>
            <div className="text-xs mt-1">Generate a kundali to view Vimshottari Dasha</div>
          </div>
        )}

        {/* Legend - show only for non-aspects and non-table tabs */}
        {activeTab !== 'aspects' && activeTab !== 'shad-table' && activeTab !== 'bhava-table' && activeTab !== 'positions' && activeTab !== 'dasha' && (
          <div className="mt-6 pt-4 border-t border-[hsl(220,8%,16%)] flex flex-wrap justify-center gap-4 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-neutral-500">Strong ≥120%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="text-neutral-500">Medium 90-120%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-neutral-500">Weak &lt;90%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

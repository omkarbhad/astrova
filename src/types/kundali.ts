export interface KundaliRequest {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  tz_offset_hours: number;
  latitude: number;
  longitude: number;
  ayanamsha: string;
  use_utc?: boolean;  // If true, the time is already in UTC
}

export interface PlanetInfo {
  longitude: number;
  sign: string;
  sign_sanskrit: string;
  sign_index: number;
  navamsa_sign_index?: number;
  navamsa_sign?: string;
  navamsa_sign_sanskrit?: string;
  deg: number;
  min: number;
  sec: number;
  house_whole_sign: number;
  retrograde: boolean;
  symbol: string;
  exalted: boolean;
  debilitated: boolean;
  vargottama: boolean;
  combust: boolean;
  nakshatra?: string;
  nakshatra_pada?: number;
  nakshatra_lord?: string;
}

export interface LagnaInfo {
  longitude: number;
  sign: string;
  sign_sanskrit: string;
  sign_index: number;
  deg: number;
  min: number;
  sec: number;
  symbol: string;
}

export interface SthanaBalaInfo {
  uccha: number;
  saptavargaja: number;
  ojayugma: number;
  kendra: number;
  drekkana: number;
  total: number;
}

export interface KalaBalaInfo {
  divaratri: number;
  paksha: number;
  tribhaga: number;
  abda: number;
  masa: number;
  vara: number;
  hora: number;
  ayana: number;
  total: number;
}

export interface ShadBalaInfo {
  sthana_bala: SthanaBalaInfo | number;
  dig_bala: number;
  kala_bala: KalaBalaInfo | number;
  chesta_bala: number;
  naisargika_bala: number;
  drik_bala: number;
  total_shashtiamsas?: number;
  total_rupas?: number;
  required_rupas?: number;
  ratio?: number;
  total_bala?: number;
  required?: number;
  percentage?: number;
  is_strong: boolean;
  strength: "Strong" | "Medium" | "Weak";
}

export interface BhavaBalaInfo {
  house: number;
  sign?: string;
  sign_sanskrit?: string;
  lord: string;
  lord_house?: number;
  lord_sign?: string;
  planets_in_house: string[];
  bhavadhipati_bala?: number;
  bhava_digbala?: number;
  bhava_drishti_bala?: number;
  residential_strength?: number;
  planet_contribution?: number;
  total_shashtiamsas?: number;
  total_rupas?: number;
  strength?: number;
  is_strong: boolean;
  rating: "Very Strong" | "Strong" | "Medium" | "Weak";
}

export interface PratyantardashaInfo {
  planet: string;
  start_datetime?: string;
  start_date: string;
  start_year: number;
  start_month: number;
  start_day: number;
  end_datetime?: string;
  end_date?: string;
  end_year?: number;
  end_month?: number;
  end_day?: number;
  years: number;
  proportion?: number;
}

export interface AntardashaInfo {
  planet: string;
  start_datetime?: string;
  start_date: string;
  start_year: number;
  start_month: number;
  start_day: number;
  end_datetime?: string;
  end_date?: string;
  end_year?: number;
  end_month?: number;
  end_day?: number;
  years: number;
  proportion?: number;
  pratyantardashas?: PratyantardashaInfo[];
}

export interface DashaPeriodInfo {
  planet: string;
  start_datetime?: string;
  start_date: string;
  start_year: number;
  start_month: number;
  start_day: number;
  end_datetime?: string;
  end_date?: string;
  end_year?: number;
  end_month?: number;
  end_day?: number;
  years: number;
  total_years: number;
  years_passed?: number;
  is_current: boolean;
  antardashas?: AntardashaInfo[];
}

export interface DashaInfo {
  current_dasha: string;
  moon_nakshatra: number;
  moon_nakshatra_name: string;
  moon_nakshatra_pada: number;
  periods: DashaPeriodInfo[];
}

export interface YogaInfo {
  name: string;
  type: 'benefic' | 'malefic' | 'neutral';
  description: string;
  planets: string[];
  strength: 'strong' | 'moderate' | 'weak';
}

export interface KundaliResponse {
  meta: {
    ayanamsha: string;
    jd_ut: number;
    ayanamsha_deg: number;
  };
  birth: {
    date: string;
    time: string;
    tz_offset_hours: number;
    adjusted_tz_offset_hours: number;
    dst_applied: boolean;
    dst_adjustment_hours: number;
    latitude: number;
    longitude: number;
    ist_date?: string;
    ist_time?: string;
    ist_tz_offset?: number;
    debug_time_conversion?: Record<string, unknown>;
  };
  lagna: LagnaInfo;
  planets: Record<string, PlanetInfo>;
  upagrahas: Record<string, PlanetInfo>;
  rasi_chart: string[][];
  navamsa_chart?: string[][];
  shad_bala: Record<string, ShadBalaInfo>;
  bhava_bala: Record<number, BhavaBalaInfo>;
  dasha: DashaInfo;
  yogas?: YogaInfo[];
  signs: string[];
  signs_sanskrit: string[];
}

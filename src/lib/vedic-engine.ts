/**
 * Client-side Vedic Astrology Engine
 * Replaces all backend /api/kundali calculations
 * Uses astronomy-engine for accurate tropical planetary positions,
 * then converts to sidereal using Lahiri ayanamsha.
 */
import * as Astronomy from 'astronomy-engine';
import type { KundaliRequest, KundaliResponse, PlanetInfo, LagnaInfo, ShadBalaInfo, BhavaBalaInfo, DashaInfo, DashaPeriodInfo, AntardashaInfo, PratyantardashaInfo, SthanaBalaInfo, KalaBalaInfo, YogaInfo } from '../types/kundali';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIGNS_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const SIGNS_SANSKRIT = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿',
  Jupiter: '♃', Venus: '♀', Saturn: '♄', Rahu: '☊', Ketu: '☋',
};

const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

// Nakshatra lords in order (for Vimshottari Dasha)
const NAKSHATRA_LORDS = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu',
  'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus', 'Sun',
  'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu',
  'Jupiter', 'Saturn', 'Mercury',
];

// Vimshottari Dasha periods in years (in dasha sequence order)
const DASHA_SEQUENCE = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
const TOTAL_DASHA_YEARS = 120;
const DASHA_YEAR_DAYS = 365.2425;
const MS_PER_DAY = 86400000;

// Exaltation degrees (sidereal)
const EXALTATION: Record<string, { sign: number; deg: number }> = {
  Sun: { sign: 0, deg: 10 },    // Aries 10°
  Moon: { sign: 1, deg: 3 },    // Taurus 3°
  Mars: { sign: 9, deg: 28 },   // Capricorn 28°
  Mercury: { sign: 5, deg: 15 },// Virgo 15°
  Jupiter: { sign: 3, deg: 5 }, // Cancer 5°
  Venus: { sign: 11, deg: 27 }, // Pisces 27°
  Saturn: { sign: 6, deg: 20 }, // Libra 20°
};

// Debilitation signs (opposite of exaltation)
const DEBILITATION: Record<string, number> = {
  Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0,
};

// Own signs
const OWN_SIGNS: Record<string, number[]> = {
  Sun: [4],        // Leo
  Moon: [3],       // Cancer
  Mars: [0, 7],    // Aries, Scorpio
  Mercury: [2, 5], // Gemini, Virgo
  Jupiter: [8, 11],// Sagittarius, Pisces
  Venus: [1, 6],   // Taurus, Libra
  Saturn: [9, 10], // Capricorn, Aquarius
};

// Moolatrikona signs and degree ranges
const MOOLATRIKONA: Record<string, { sign: number; from: number; to: number }> = {
  Sun: { sign: 4, from: 0, to: 20 },
  Moon: { sign: 1, from: 4, to: 20 },
  Mars: { sign: 0, from: 0, to: 12 },
  Mercury: { sign: 5, from: 16, to: 20 },
  Jupiter: { sign: 8, from: 0, to: 10 },
  Venus: { sign: 6, from: 0, to: 15 },
  Saturn: { sign: 10, from: 0, to: 20 },
};

// Friendly/enemy relationships
const FRIENDS: Record<string, string[]> = {
  Sun: ['Moon', 'Mars', 'Jupiter'],
  Moon: ['Sun', 'Mercury'],
  Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'],
  Jupiter: ['Sun', 'Moon', 'Mars'],
  Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus'],
};

const ENEMIES: Record<string, string[]> = {
  Sun: ['Venus', 'Saturn'],
  Moon: [],
  Mars: ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'],
  Venus: ['Sun', 'Moon'],
  Saturn: ['Sun', 'Moon', 'Mars'],
};

// Naisargika Bala (natural strength) in shashtiamsas
const NAISARGIKA_BALA: Record<string, number> = {
  Sun: 60, Moon: 51.43, Mars: 17.14, Mercury: 25.71,
  Jupiter: 34.28, Venus: 42.86, Saturn: 8.57,
};

// Dig Bala directions: planet → house where it gets max dig bala
const DIG_BALA_HOUSE: Record<string, number> = {
  Sun: 10, Moon: 4, Mars: 10, Mercury: 1,
  Jupiter: 1, Venus: 4, Saturn: 7,
};

const UPAGRAHA_SYMBOLS: Record<string, string> = {
  Dhuma: 'Dh', Vyatipata: 'Vy', Parivesha: 'Pv', Indrachapa: 'Ic', Upaketu: 'Uk',
  Kaala: 'Ka', Mrityu: 'Mr', ArthaPrahara: 'Ap', YamaGhantaka: 'Yg', Gulika: 'Gk', Mandi: 'Mn',
};

const UPAGRAHA_SUN_OFFSETS: Record<string, number> = {
  Dhuma: 133 + 20 / 60,
  Vyatipata: 0,
  Parivesha: 0,
  Indrachapa: 0,
  Upaketu: 16 + 40 / 60,
};

const KALAVELA_TABLES: Record<string, { day: number[]; night: number[] }> = {
  Kaala: {
    day: [2, 30, 26, 22, 18, 14, 10],
    night: [14, 10, 6, 2, 30, 26, 22],
  },
  Mrityu: {
    day: [10, 6, 2, 30, 26, 22, 18],
    night: [22, 18, 14, 10, 6, 2, 30],
  },
  ArthaPrahara: {
    day: [14, 10, 6, 2, 30, 26, 22],
    night: [26, 22, 18, 14, 10, 6, 2],
  },
  YamaGhantaka: {
    day: [18, 14, 10, 6, 2, 30, 26],
    night: [2, 30, 26, 22, 18, 14, 10],
  },
  Gulika: {
    day: [26, 22, 18, 14, 10, 6, 2],
    night: [10, 6, 2, 30, 26, 22, 18],
  },
  Mandi: {
    day: [26, 22, 18, 14, 10, 6, 2],
    night: [10, 6, 2, 30, 26, 22, 18],
  },
};

// ─── Ayanamsha ───────────────────────────────────────────────────────────────

function calcAyanamsha(jd: number, type: string): number {
  const T = (jd - 2451545.0) / 36525.0;
  const year = 2000.0 + T * 100;
  
  switch (type.toLowerCase()) {
    case 'lahiri':
      return 23.853765 + (year - 2000.0) * 0.01396667;
    case 'raman':
      return 22.383333 + (year - 2000.0) * 0.01396667;
    case 'krishnamurti':
      return 23.753333 + (year - 2000.0) * 0.01396667;
    default:
      return 23.853765 + (year - 2000.0) * 0.01396667;
  }
}

// ─── Julian Day ──────────────────────────────────────────────────────────────

function calcJulianDay(year: number, month: number, day: number, hour: number, minute: number, second: number, tzOffset: number): number {
  const utHour = hour - tzOffset + minute / 60 + second / 3600;
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + utHour / 24.0 + B - 1524.5;
}

function calcJulianDayUTC(date: Date): number {
  return calcJulianDay(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    0
  );
}

function normalizeLongitude(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

function findRiseSet(body: Astronomy.Body, observer: Astronomy.Observer, direction: number, dateStart: Date, limitDays = 2): Date | null {
  const result = Astronomy.SearchRiseSet(body, observer, direction, dateStart, limitDays);
  return result ? result.date : null;
}

function buildUpagrahaInfo(name: string, longitude: number, lagnaSignIndex: number): PlanetInfo {
  const signIdx = getSignIndex(longitude);
  const deg = getDegInSign(longitude);
  const navamsaIdx = getNavamsaSignIndex(longitude);
  const houseWholeSign = ((signIdx - lagnaSignIndex + 12) % 12) + 1;
  const nak = getNakshatra(longitude);

  return {
    longitude: Math.round(longitude * 10000) / 10000,
    sign: SIGNS_EN[signIdx],
    sign_sanskrit: SIGNS_SANSKRIT[signIdx],
    sign_index: signIdx,
    navamsa_sign_index: navamsaIdx,
    navamsa_sign: SIGNS_EN[navamsaIdx],
    navamsa_sign_sanskrit: SIGNS_SANSKRIT[navamsaIdx],
    deg: deg.deg,
    min: deg.min,
    sec: deg.sec,
    house_whole_sign: houseWholeSign,
    retrograde: false,
    symbol: UPAGRAHA_SYMBOLS[name] ?? name.slice(0, 2),
    exalted: false,
    debilitated: false,
    vargottama: signIdx === navamsaIdx,
    combust: false,
    nakshatra: nak.name,
    nakshatra_pada: nak.pada,
    nakshatra_lord: NAKSHATRA_LORDS[nak.index],
  };
}

function calcSunBasedUpagrahas(sunLongitude: number): Record<string, number> {
  const dhuma = normalizeLongitude(sunLongitude + UPAGRAHA_SUN_OFFSETS.Dhuma);
  const vyatipata = normalizeLongitude(360 - dhuma);
  const parivesha = normalizeLongitude(vyatipata + 180);
  const indrachapa = normalizeLongitude(360 - parivesha);
  const upaketu = normalizeLongitude(indrachapa + UPAGRAHA_SUN_OFFSETS.Upaketu);
  return { Dhuma: dhuma, Vyatipata: vyatipata, Parivesha: parivesha, Indrachapa: indrachapa, Upaketu: upaketu };
}

function calcKalavelaUpagrahas(
  birthUtcDate: Date,
  tzOffsetHours: number,
  latitude: number,
  longitude: number,
  ayanamshaValue: number
): Record<string, number> {
  const shifted = toOffsetDate(birthUtcDate, tzOffsetHours);
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const dayStartUtc = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0) - tzOffsetHours * 3600000);
  const sunriseToday = findRiseSet(Astronomy.Body.Sun, observer, 1, dayStartUtc, 2);
  const sunsetToday = findRiseSet(Astronomy.Body.Sun, observer, -1, dayStartUtc, 2);
  if (!sunriseToday || !sunsetToday) return {};

  const prevDayStartUtc = new Date(dayStartUtc.getTime() - 86400000);
  const nextDayStartUtc = new Date(dayStartUtc.getTime() + 86400000);
  const prevSunset = findRiseSet(Astronomy.Body.Sun, observer, -1, prevDayStartUtc, 2);
  const nextSunrise = findRiseSet(Astronomy.Body.Sun, observer, 1, nextDayStartUtc, 2);

  const beforeSunrise = birthUtcDate < sunriseToday;
  const afterSunset = birthUtcDate >= sunsetToday;
  const isDayBirth = birthUtcDate >= sunriseToday && birthUtcDate < sunsetToday;

  let weekdayIndex = shifted.getUTCDay();
  if (beforeSunrise) {
    weekdayIndex = (weekdayIndex + 6) % 7;
  }

  let startTime: Date;
  let durationMs: number;
  if (isDayBirth) {
    startTime = sunriseToday;
    durationMs = sunsetToday.getTime() - sunriseToday.getTime();
  } else if (beforeSunrise && prevSunset) {
    startTime = prevSunset;
    durationMs = sunriseToday.getTime() - prevSunset.getTime();
  } else if (afterSunset && nextSunrise) {
    startTime = sunsetToday;
    durationMs = nextSunrise.getTime() - sunsetToday.getTime();
  } else {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [name, table] of Object.entries(KALAVELA_TABLES)) {
    const ghatiValue = isDayBirth ? table.day[weekdayIndex] : table.night[weekdayIndex];
    const offsetMs = (ghatiValue / 30) * durationMs;
    const upagrahaTime = new Date(startTime.getTime() + offsetMs);
    const jd = calcJulianDayUTC(upagrahaTime);
    const upagrahaLon = calcLagna(jd, latitude, longitude, ayanamshaValue);
    result[name] = upagrahaLon;
  }
  return result;
}

interface KalaTimeContext {
  localHour: number;
  dayOfWeek: number;
  localYear: number;
  localMonth: number;
  isDaytime: boolean;
  dayFraction: number;
  nightFraction: number;
  horaIndex: number;
}

function calcKalaTimeContext(
  birthUtcDate: Date,
  tzOffsetHours: number,
  latitude: number,
  longitude: number
): KalaTimeContext {
  const shifted = toOffsetDate(birthUtcDate, tzOffsetHours);
  const localHour = shifted.getUTCHours() + shifted.getUTCMinutes() / 60 + shifted.getUTCSeconds() / 3600;
  const localYear = shifted.getUTCFullYear();
  const localMonth = shifted.getUTCMonth();
  const observer = new Astronomy.Observer(latitude, longitude, 0);

  const dayStartUtc = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0) - tzOffsetHours * 3600000);
  const sunriseToday = findRiseSet(Astronomy.Body.Sun, observer, 1, dayStartUtc, 2);
  const sunsetToday = findRiseSet(Astronomy.Body.Sun, observer, -1, dayStartUtc, 2);

  if (!sunriseToday || !sunsetToday) {
    return {
      localHour,
      dayOfWeek: shifted.getUTCDay(),
      localYear,
      localMonth,
      isDaytime: localHour >= 6 && localHour < 18,
      dayFraction: Math.max(0, Math.min(1, (localHour - 6) / 12)),
      nightFraction: localHour >= 18
        ? Math.max(0, Math.min(1, (localHour - 18) / 12))
        : Math.max(0, Math.min(1, (localHour + 6) / 12)),
      horaIndex: Math.floor(localHour) % 24,
    };
  }

  const prevDayStartUtc = new Date(dayStartUtc.getTime() - MS_PER_DAY);
  const nextDayStartUtc = new Date(dayStartUtc.getTime() + MS_PER_DAY);
  const prevSunset = findRiseSet(Astronomy.Body.Sun, observer, -1, prevDayStartUtc, 2);
  const nextSunrise = findRiseSet(Astronomy.Body.Sun, observer, 1, nextDayStartUtc, 2);
  const prevSunrise = findRiseSet(Astronomy.Body.Sun, observer, 1, prevDayStartUtc, 2);

  const birthMs = birthUtcDate.getTime();
  const beforeSunrise = birthMs < sunriseToday.getTime();
  const afterSunset = birthMs >= sunsetToday.getTime();
  const isDaytime = !beforeSunrise && !afterSunset;

  let dayOfWeek = shifted.getUTCDay();
  let dayFraction = 0.5;
  let nightFraction = 0.5;
  let sunriseRef = sunriseToday;

  if (isDaytime) {
    const dayDuration = Math.max(1, sunsetToday.getTime() - sunriseToday.getTime());
    dayFraction = Math.max(0, Math.min(1, (birthMs - sunriseToday.getTime()) / dayDuration));
  } else if (beforeSunrise && prevSunset) {
    dayOfWeek = (dayOfWeek + 6) % 7;
    const nightDuration = Math.max(1, sunriseToday.getTime() - prevSunset.getTime());
    nightFraction = Math.max(0, Math.min(1, (birthMs - prevSunset.getTime()) / nightDuration));
    sunriseRef = prevSunrise ?? new Date(sunriseToday.getTime() - MS_PER_DAY);
  } else if (afterSunset && nextSunrise) {
    const nightDuration = Math.max(1, nextSunrise.getTime() - sunsetToday.getTime());
    nightFraction = Math.max(0, Math.min(1, (birthMs - sunsetToday.getTime()) / nightDuration));
  }

  let elapsedHours = (birthMs - sunriseRef.getTime()) / 3600000;
  while (elapsedHours < 0) elapsedHours += 24;

  return {
    localHour,
    dayOfWeek,
    localYear,
    localMonth,
    isDaytime,
    dayFraction,
    nightFraction,
    horaIndex: Math.floor(elapsedHours) % 24,
  };
}

// ─── Planetary Positions ─────────────────────────────────────────────────────

function getAstronomyBody(planet: string): Astronomy.Body | null {
  const map: Record<string, Astronomy.Body> = {
    Sun: Astronomy.Body.Sun,
    Moon: Astronomy.Body.Moon,
    Mars: Astronomy.Body.Mars,
    Mercury: Astronomy.Body.Mercury,
    Jupiter: Astronomy.Body.Jupiter,
    Venus: Astronomy.Body.Venus,
    Saturn: Astronomy.Body.Saturn,
  };
  return map[planet] ?? null;
}

function getTropicalLongitude(body: Astronomy.Body, date: Date): number {
  if (body === Astronomy.Body.Moon) {
    const ecl = Astronomy.EclipticGeoMoon(date);
    return ((ecl.lon % 360) + 360) % 360;
  }
  const observer = new Astronomy.Observer(0, 0, 0);
  const eq = Astronomy.Equator(body, date, observer, true, true);
  const eclCoords = Astronomy.Ecliptic(eq.vec);
  return ((eclCoords.elon % 360) + 360) % 360;
}

function getSiderealLongitude(tropicalLon: number, ayanamsha: number): number {
  return ((tropicalLon - ayanamsha) % 360 + 360) % 360;
}

function getSignIndex(longitude: number): number {
  return Math.floor(longitude / 30) % 12;
}

function getDegInSign(longitude: number): { deg: number; min: number; sec: number } {
  const posInSign = longitude % 30;
  const deg = Math.floor(posInSign);
  const minFrac = (posInSign - deg) * 60;
  const min = Math.floor(minFrac);
  const sec = Math.floor((minFrac - min) * 60);
  return { deg, min, sec };
}

function getNavamsaSignIndex(longitude: number): number {
  const posInSign = longitude % 30;
  const pada = Math.floor(posInSign / 3.333333);
  const signIdx = getSignIndex(longitude);
  // Navamsa starts from: Aries for fire signs, Capricorn for earth, Libra for air, Cancer for water
  const elementMap = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
  const startSign = [0, 9, 6, 3]; // fire→Aries, earth→Capricorn, air→Libra, water→Cancer
  const navamsaSign = (startSign[elementMap[signIdx]] + pada) % 12;
  return navamsaSign;
}

function getHoraSignIndex(longitude: number, signIndex: number): number {
  const degInSign = longitude % 30;
  const isOddSign = signIndex % 2 === 0; // Aries = 0 is odd
  const isFirstHalf = degInSign < 15;
  if (isOddSign) {
    return isFirstHalf ? 4 : 3; // Leo or Cancer
  }
  return isFirstHalf ? 3 : 4;
}

function getDrekkanaSignIndex(longitude: number, signIndex: number): number {
  const drekkana = Math.floor((longitude % 30) / 10);
  const signType = signIndex % 3; // 0 movable, 1 fixed, 2 dual
  if (signType === 0) return (signIndex + drekkana) % 12;
  if (signType === 1) return (signIndex + 4 + drekkana) % 12;
  return (signIndex + 8 + drekkana) % 12;
}

function getSaptamsaSignIndex(longitude: number, signIndex: number): number {
  const saptamsa = Math.floor((longitude % 30) / (30 / 7));
  const isOddSign = signIndex % 2 === 0;
  const startSign = isOddSign ? signIndex : (signIndex + 6) % 12;
  return (startSign + saptamsa) % 12;
}

function getDwadashamsaSignIndex(longitude: number, signIndex: number): number {
  const dwad = Math.floor((longitude % 30) / (30 / 12));
  return (signIndex + dwad) % 12;
}

function getTrimsamsaSignIndex(longitude: number, signIndex: number): number {
  const degInSign = longitude % 30;
  const isOddSign = signIndex % 2 === 0;
  if (isOddSign) {
    if (degInSign < 5) return 0; // Mars -> Aries
    if (degInSign < 10) return 10; // Saturn -> Aquarius
    if (degInSign < 18) return 8; // Jupiter -> Sagittarius
    if (degInSign < 25) return 5; // Mercury -> Virgo
    return 6; // Venus -> Libra
  }
  if (degInSign < 5) return 6; // Venus -> Libra
  if (degInSign < 12) return 5; // Mercury -> Virgo
  if (degInSign < 20) return 8; // Jupiter -> Sagittarius
  if (degInSign < 25) return 10; // Saturn -> Aquarius
  return 0; // Mars -> Aries
}

function getNakshatra(moonLongitude: number): { index: number; name: string; pada: number; degInNakshatra: number } {
  const nakshatraSpan = 360 / 27; // 13.333...
  const index = Math.floor(moonLongitude / nakshatraSpan);
  const posInNakshatra = moonLongitude - index * nakshatraSpan;
  const pada = Math.floor(posInNakshatra / (nakshatraSpan / 4)) + 1;
  return {
    index: index % 27,
    name: NAKSHATRA_NAMES[index % 27],
    pada: Math.min(pada, 4),
    degInNakshatra: posInNakshatra,
  };
}

function isRetrograde(body: Astronomy.Body, date: Date): boolean {
  if (body === Astronomy.Body.Sun || body === Astronomy.Body.Moon) return false;
  const dt = 0.5; // half day
  const d1 = new Date(date.getTime() - dt * 86400000);
  const d2 = new Date(date.getTime() + dt * 86400000);
  
  const lon1 = getTropicalLongitude(body, d1);
  const lon2 = getTropicalLongitude(body, d2);
  
  let diff = lon2 - lon1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  return diff < 0;
}

function isCombust(planetLon: number, sunLon: number, planet: string): boolean {
  if (planet === 'Sun' || planet === 'Rahu' || planet === 'Ketu') return false;
  let diff = Math.abs(planetLon - sunLon);
  if (diff > 180) diff = 360 - diff;
  const combustOrbs: Record<string, number> = {
    Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15,
  };
  return diff < (combustOrbs[planet] ?? 10);
}

// ─── Lagna (Ascendant) Calculation ───────────────────────────────────────────

function calcLagna(jd: number, latitude: number, longitude: number, ayanamsha: number): number {
  // Calculate Julian centuries from J2000.0
  const T = (jd - 2451545.0) / 36525.0;
  
  // Greenwich Mean Sidereal Time in degrees (IAU 1982 model)
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  
  // Local Sidereal Time = RAMC (Right Ascension of Medium Coeli)
  const lst = ((gmst + longitude) % 360 + 360) % 360;
  const lstRad = lst * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  
  // Obliquity of ecliptic (IAU 2006)
  const eps = (23.4393 - 0.013 * T) * Math.PI / 180;
  
  // Ascendant formula (Meeus, Astronomical Algorithms):
  // tan(ASC) = -cos(RAMC) / (sin(ε)·tan(φ) + cos(ε)·sin(RAMC))
  // atan2 gives the descendant; add 180° to get the eastern horizon (ascendant)
  const y = -Math.cos(lstRad);
  const x = Math.sin(eps) * Math.tan(latRad) + Math.cos(eps) * Math.sin(lstRad);
  let asc = Math.atan2(y, x) * 180 / Math.PI + 180;
  asc = ((asc % 360) + 360) % 360;
  
  // Convert to sidereal
  const siderealAsc = ((asc - ayanamsha) % 360 + 360) % 360;
  return siderealAsc;
}

// ─── Rahu/Ketu (Mean Node) ───────────────────────────────────────────────────

function calcMeanNode(date: Date): number {
  const jd = calcJulianDay(
    date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), 0
  );
  const T = (jd - 2451545.0) / 36525.0;
  // Mean longitude of ascending node
  let omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000;
  return ((omega % 360) + 360) % 360;
}

// ─── Vimshottari Dasha ───────────────────────────────────────────────────────

function addDashaYears(date: Date, years: number): Date {
  return new Date(date.getTime() + years * DASHA_YEAR_DAYS * MS_PER_DAY);
}

function toOffsetDate(date: Date, tzOffsetHours: number): Date {
  return new Date(date.getTime() + tzOffsetHours * 3600000);
}

function toRoundedOffsetDate(date: Date, tzOffsetHours: number): Date {
  const roundedBase = new Date(date.getTime() + 12 * 3600000);
  return toOffsetDate(roundedBase, tzOffsetHours);
}

function getOffsetDateParts(date: Date, tzOffsetHours: number): { year: number; month: number; day: number } {
  const shifted = toRoundedOffsetDate(date, tzOffsetHours);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function formatDate(date: Date, tzOffsetHours: number): string {
  const shifted = toRoundedOffsetDate(date, tzOffsetHours);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function calcVimshottariDasha(moonLongitude: number, birthDateUtc: Date, tzOffsetHours: number): DashaInfo {
  const nakshatra = getNakshatra(moonLongitude);
  const nakshatraLord = NAKSHATRA_LORDS[nakshatra.index];
  
  // Birth balance and start point of running mahadasha
  const nakshatraSpan = 360 / 27;
  const posInNakshatra = moonLongitude - nakshatra.index * nakshatraSpan;
  const fractionPassed = posInNakshatra / nakshatraSpan;
  const yearsPassed = DASHA_YEARS[nakshatraLord] * fractionPassed;
  const mahadashaStart = addDashaYears(birthDateUtc, -yearsPassed);
  
  const startIdx = DASHA_SEQUENCE.indexOf(nakshatraLord);
  
  // One full Vimshottari cycle from the running mahadasha start = 120 years
  const cycleEnd = addDashaYears(mahadashaStart, TOTAL_DASHA_YEARS);
  const periods: DashaPeriodInfo[] = [];
  let currentDate = new Date(mahadashaStart);
  const now = new Date();
  let currentDasha = '';

  for (let i = 0; i < 9; i++) {
    const seqIdx = (startIdx + i) % 9;
    const planet = DASHA_SEQUENCE[seqIdx];
    const totalYears = DASHA_YEARS[planet];
    const startDate = new Date(currentDate);
    const endDate = i === 8 ? cycleEnd : addDashaYears(currentDate, totalYears);
    const periodYears = (endDate.getTime() - startDate.getTime()) / (DASHA_YEAR_DAYS * MS_PER_DAY);

    const isCurrent = now >= startDate && now < endDate;
    if (isCurrent) currentDasha = planet;

    const antardashas = calcAntardashas(startDate, endDate, seqIdx, tzOffsetHours);
    const startParts = getOffsetDateParts(startDate, tzOffsetHours);
    const endParts = getOffsetDateParts(endDate, tzOffsetHours);

    periods.push({
      planet,
      start_date: formatDate(startDate, tzOffsetHours),
      start_datetime: startDate.toISOString(),
      start_year: startParts.year,
      start_month: startParts.month,
      start_day: startParts.day,
      end_date: formatDate(endDate, tzOffsetHours),
      end_datetime: endDate.toISOString(),
      end_year: endParts.year,
      end_month: endParts.month,
      end_day: endParts.day,
      years: Math.round(periodYears * 100000) / 100000,
      total_years: totalYears,
      is_current: isCurrent,
      antardashas,
    });

    currentDate = endDate;
  }
  
  return {
    current_dasha: currentDasha || DASHA_SEQUENCE[startIdx],
    moon_nakshatra: nakshatra.index,
    moon_nakshatra_name: nakshatra.name,
    moon_nakshatra_pada: nakshatra.pada,
    periods,
  };
}

function calcAntardashas(startDate: Date, endDate: Date, mahadashaSeqIdx: number, tzOffsetHours: number): AntardashaInfo[] {
  const antardashas: AntardashaInfo[] = [];
  let currentDate = new Date(startDate);
  const totalMs = endDate.getTime() - startDate.getTime();
  
  for (let i = 0; i < 9; i++) {
    const seqIdx = (mahadashaSeqIdx + i) % 9;
    const planet = DASHA_SEQUENCE[seqIdx];
    const proportion = DASHA_YEARS[planet] / TOTAL_DASHA_YEARS;
    const durationMs = totalMs * proportion;
    
    const adStart = new Date(currentDate);
    const adEnd = i === 8 ? endDate : new Date(currentDate.getTime() + durationMs);
    const years = (adEnd.getTime() - adStart.getTime()) / (DASHA_YEAR_DAYS * MS_PER_DAY);
    
    const pratyantardashas = calcPratyantardashas(adStart, adEnd, seqIdx, tzOffsetHours);
    const startParts = getOffsetDateParts(adStart, tzOffsetHours);
    const endParts = getOffsetDateParts(adEnd, tzOffsetHours);
    
    antardashas.push({
      planet,
      start_date: formatDate(adStart, tzOffsetHours),
      start_datetime: adStart.toISOString(),
      start_year: startParts.year,
      start_month: startParts.month,
      start_day: startParts.day,
      end_date: formatDate(adEnd, tzOffsetHours),
      end_datetime: adEnd.toISOString(),
      end_year: endParts.year,
      end_month: endParts.month,
      end_day: endParts.day,
      years: Math.round(years * 100000) / 100000,
      proportion,
      pratyantardashas,
    });
    
    currentDate = adEnd;
  }
  
  return antardashas;
}

function calcPratyantardashas(startDate: Date, endDate: Date, antardashaSeqIdx: number, tzOffsetHours: number): PratyantardashaInfo[] {
  const pads: PratyantardashaInfo[] = [];
  let currentDate = new Date(startDate);
  const totalMs = endDate.getTime() - startDate.getTime();
  
  for (let i = 0; i < 9; i++) {
    const seqIdx = (antardashaSeqIdx + i) % 9;
    const planet = DASHA_SEQUENCE[seqIdx];
    const proportion = DASHA_YEARS[planet] / TOTAL_DASHA_YEARS;
    const durationMs = totalMs * proportion;
    
    const padStart = new Date(currentDate);
    const padEnd = i === 8 ? endDate : new Date(currentDate.getTime() + durationMs);
    const years = (padEnd.getTime() - padStart.getTime()) / (DASHA_YEAR_DAYS * MS_PER_DAY);
    const startParts = getOffsetDateParts(padStart, tzOffsetHours);
    const endParts = getOffsetDateParts(padEnd, tzOffsetHours);
    
    pads.push({
      planet,
      start_date: formatDate(padStart, tzOffsetHours),
      start_datetime: padStart.toISOString(),
      start_year: startParts.year,
      start_month: startParts.month,
      start_day: startParts.day,
      end_date: formatDate(padEnd, tzOffsetHours),
      end_datetime: padEnd.toISOString(),
      end_year: endParts.year,
      end_month: endParts.month,
      end_day: endParts.day,
      years: Math.round(years * 100000) / 100000,
      proportion,
    });
    
    currentDate = padEnd;
  }
  
  return pads;
}

// ─── Shadbala Calculations ───────────────────────────────────────────────────

function calcShadBala(
  planets: Record<string, { longitude: number; signIndex: number; retrograde: boolean }>,
  lagnaSignIndex: number,
  birthUtcDate: Date,
  tzOffsetHours: number,
  latitude: number,
  longitude: number,
  ayanamshaValue: number = 24,
): Record<string, ShadBalaInfo> {
  const result: Record<string, ShadBalaInfo> = {};
  const mainPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const sunLon = planets['Sun']?.longitude ?? 0;
  const kalaContext = calcKalaTimeContext(birthUtcDate, tzOffsetHours, latitude, longitude);
  
  for (const planet of mainPlanets) {
    const p = planets[planet];
    if (!p) continue;
    
    const sthanaBala = calcSthanaBala(planet, p.longitude, p.signIndex, lagnaSignIndex);
    const digBala = calcDigBala(planet, p.longitude, lagnaSignIndex);
    const moonLon = planets['Moon']?.longitude ?? 0;
    const kalaBala = calcKalaBala(planet, kalaContext, p.longitude, sunLon, moonLon, ayanamshaValue);
    const chestaBala = calcChestaBala(planet, p.retrograde, p.longitude, sunLon, moonLon, ayanamshaValue);
    const naisargikaBala = NAISARGIKA_BALA[planet] ?? 0;
    const drikBala = calcDrikBala(planet, p.longitude, planets);
    
    const sthanaTotal = typeof sthanaBala === 'object' ? sthanaBala.total : sthanaBala;
    const kalaTotal = typeof kalaBala === 'object' ? kalaBala.total : kalaBala;
    
    const totalShashtiamsas = sthanaTotal + digBala + kalaTotal + chestaBala + naisargikaBala + drikBala;
    const totalRupas = totalShashtiamsas / 60;
    
    const requiredRupas: Record<string, number> = {
      Sun: 5.0, Moon: 6.0, Mars: 5.0, Mercury: 7.0, Jupiter: 6.5, Venus: 5.5, Saturn: 5.0,
    };
    const required = requiredRupas[planet] ?? 5.0;
    const ratio = totalRupas / required;
    const isStrong = ratio >= 1.0;
    
    result[planet] = {
      sthana_bala: sthanaBala,
      dig_bala: Math.round(digBala * 100) / 100,
      kala_bala: kalaBala,
      chesta_bala: Math.round(chestaBala * 100) / 100,
      naisargika_bala: Math.round(naisargikaBala * 100) / 100,
      drik_bala: Math.round(drikBala * 100) / 100,
      total_shashtiamsas: Math.round(totalShashtiamsas * 100) / 100,
      total_rupas: Math.round(totalRupas * 100) / 100,
      required_rupas: required,
      ratio: Math.round(ratio * 100) / 100,
      is_strong: isStrong,
      strength: ratio >= 1.2 ? 'Strong' : ratio >= 0.8 ? 'Medium' : 'Weak',
    };
  }
  
  return result;
}

function calcSthanaBala(planet: string, longitude: number, signIndex: number, lagnaSignIndex: number): SthanaBalaInfo {
  const getDignityScore = (planetName: string, signIdx: number, allowMoolatrikona = false): number => {
    let dignity = 0;
    if (OWN_SIGNS[planetName]?.includes(signIdx)) dignity = 30;
    else if (EXALTATION[planetName]?.sign === signIdx) dignity = 20;
    else {
      const signLord = getSignLord(signIdx);
      if (FRIENDS[planetName]?.includes(signLord)) dignity = 15;
      else if (ENEMIES[planetName]?.includes(signLord)) dignity = -10;
    }
    if (allowMoolatrikona) {
      const mt = MOOLATRIKONA[planetName];
      if (mt && signIdx === mt.sign) {
        const degInSign = longitude % 30;
        if (degInSign >= mt.from && degInSign <= mt.to) {
          dignity = Math.max(dignity, 22.5);
        }
      }
    }
    return dignity;
  };

  // 1. Uccha Bala (exaltation strength)
  let uccha = 0;
  if (EXALTATION[planet]) {
    const exaltDeg = EXALTATION[planet].sign * 30 + EXALTATION[planet].deg;
    let diff = Math.abs(longitude - exaltDeg);
    if (diff > 180) diff = 360 - diff;
    uccha = (180 - diff) / 3; // Max 60 shashtiamsas
  }
  
  // 2. Saptavargaja Bala (D1, D2, D3, D7, D9, D12, D30)
  const horaSign = getHoraSignIndex(longitude, signIndex);
  const drekkanaSign = getDrekkanaSignIndex(longitude, signIndex);
  const saptamsaSign = getSaptamsaSignIndex(longitude, signIndex);
  const navamsaSign = getNavamsaSignIndex(longitude);
  const dwadashamsaSign = getDwadashamsaSignIndex(longitude, signIndex);
  const trimsamsaSign = getTrimsamsaSignIndex(longitude, signIndex);
  const rasiDignity = getDignityScore(planet, signIndex, true);
  const horaDignity = getDignityScore(planet, horaSign);
  const drekkanaDignity = getDignityScore(planet, drekkanaSign);
  const saptamsaDignity = getDignityScore(planet, saptamsaSign);
  const navamsaDignity = getDignityScore(planet, navamsaSign);
  const dwadashamsaDignity = getDignityScore(planet, dwadashamsaSign);
  const trimsamsaDignity = getDignityScore(planet, trimsamsaSign);
  const vargaTotal = rasiDignity + horaDignity + drekkanaDignity + saptamsaDignity + navamsaDignity + dwadashamsaDignity + trimsamsaDignity;
  let saptavargaja = (vargaTotal / 7) * 1.5;
  saptavargaja = Math.max(0, Math.min(saptavargaja, 45));
  
  // 3. Ojayugma Bala (odd/even sign strength)
  const isOddSign = signIndex % 2 === 0; // Aries=0 is odd
  let ojayugma = 0;
  if (planet === 'Sun' || planet === 'Mars' || planet === 'Jupiter') {
    ojayugma = isOddSign ? 15 : 0;
  } else if (planet === 'Moon' || planet === 'Venus') {
    ojayugma = !isOddSign ? 15 : 0;
  } else {
    ojayugma = 7.5;
  }
  
  // 4. Kendra Bala (angular house strength) — per Brihat Parashara
  const houseFromLagna = ((signIndex - lagnaSignIndex + 12) % 12) + 1;
  let kendra = 0;
  if ([1, 4, 7, 10].includes(houseFromLagna)) kendra = 30;       // Kendra
  else if ([2, 5, 8, 11].includes(houseFromLagna)) kendra = 15;  // Panaphara
  else kendra = 7.5;                                               // Apoklima
  
  // 5. Drekkana Bala
  const degInSign = longitude % 30;
  let drekkana = 0;
  if (degInSign < 10) drekkana = planet === 'Sun' || planet === 'Mars' || planet === 'Jupiter' ? 15 : 5;
  else if (degInSign < 20) drekkana = planet === 'Moon' || planet === 'Venus' ? 15 : 5;
  else drekkana = planet === 'Mercury' || planet === 'Saturn' ? 15 : 5;
  
  const total = uccha + saptavargaja + ojayugma + kendra + drekkana;
  
  return {
    uccha: Math.round(uccha * 100) / 100,
    saptavargaja: Math.round(saptavargaja * 100) / 100,
    ojayugma: Math.round(ojayugma * 100) / 100,
    kendra: Math.round(kendra * 100) / 100,
    drekkana: Math.round(drekkana * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

function calcDigBala(planet: string, longitude: number, lagnaSignIndex: number): number {
  const signIndex = Math.floor(longitude / 30) % 12;
  const house = ((signIndex - lagnaSignIndex + 12) % 12) + 1;
  const maxHouse = DIG_BALA_HOUSE[planet] ?? 1;
  // Distance from max house (in houses, 0-6 range)
  let dist = Math.abs(house - maxHouse);
  if (dist > 6) dist = 12 - dist;
  // Cosine-based curve: max 60 at own direction, 0 at opposite (smoother than linear)
  const bala = 30 + 30 * Math.cos((dist / 6) * Math.PI);
  return Math.round(bala * 100) / 100;
}

function calcKalaBala(
  planet: string,
  kalaContext: KalaTimeContext,
  longitude: number,
  sunLon: number,
  moonLon?: number,
  ayanamshaValue: number = 24
): KalaBalaInfo {
  const {
    dayOfWeek,
    localYear,
    localMonth,
    isDaytime,
    dayFraction,
    nightFraction,
    horaIndex,
  } = kalaContext;
  
  // 1. Divaratri Bala (day/night strength) — proportional based on time
  // Diurnal: Sun, Jupiter, Saturn. Nocturnal: Moon, Mars, Venus. Mercury: always.
  let divaratri = 0;
  const diurnalPlanets = ['Sun', 'Jupiter', 'Saturn'];
  const nocturnalPlanets = ['Moon', 'Mars', 'Venus'];
  const diurnalPeak = isDaytime ? (1 - Math.abs(dayFraction - 0.5) * 2) : 0;
  const nocturnalPeak = !isDaytime ? (1 - Math.abs(nightFraction - 0.5) * 2) : 0;
  if (planet === 'Mercury') {
    divaratri = 60; // Mercury is always strong
  } else if (diurnalPlanets.includes(planet)) {
    divaratri = Math.max(0, Math.min(60, diurnalPeak * 60));
  } else if (nocturnalPlanets.includes(planet)) {
    divaratri = Math.max(0, Math.min(60, nocturnalPeak * 60));
  }
  
  // 2. Paksha Bala (lunar phase strength) — always based on Moon-Sun angle
  let paksha = 0;
  const mLon = moonLon ?? longitude; // use actual Moon longitude
  const phase = ((mLon - sunLon) % 360 + 360) % 360;
  const isShukla = phase < 180;
  if (['Moon', 'Mercury', 'Jupiter', 'Venus'].includes(planet)) {
    paksha = isShukla ? (phase / 180) * 60 : ((360 - phase) / 180) * 60;
  } else {
    paksha = !isShukla ? ((phase - 180) / 180) * 60 : ((180 - phase) / 180) * 60;
  }
  paksha = Math.max(0, Math.min(60, paksha));
  
  // 3. Tribhaga Bala (day/night divided into 3 parts)
  let tribhaga = 0;
  if (isDaytime) {
    if (dayFraction < 0.333) { if (planet === 'Mercury') tribhaga = 60; }
    else if (dayFraction < 0.667) { if (planet === 'Sun') tribhaga = 60; }
    else { if (planet === 'Saturn') tribhaga = 60; }
  } else {
    if (nightFraction < 0.333) { if (planet === 'Moon') tribhaga = 60; }
    else if (nightFraction < 0.667) { if (planet === 'Venus') tribhaga = 60; }
    else { if (planet === 'Mars') tribhaga = 60; }
  }
  
  // 4. Vara Bala (day lord)
  const dayLords = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const vara = planet === dayLords[dayOfWeek] ? 45 : 0;
  
  // 5. Hora lord (Chaldean order: Sat, Jup, Mars, Sun, Ven, Mer, Moon)
  const chaldeanOrder = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
  // Day lord starts first hora at local sunrise
  const dayLordIdx = chaldeanOrder.indexOf(dayLords[dayOfWeek]);
  const horaLordIdx = (dayLordIdx + horaIndex) % 7;
  const hora = planet === chaldeanOrder[horaLordIdx] ? 60 : 0;
  
  // 6. Abda and Masa
  const abda = planet === dayLords[localYear % 7] ? 15 : 0;
  const masa = planet === dayLords[localMonth % 7] ? 30 : 0;
  
  // 7. Ayana Bala (based on declination from TROPICAL ecliptic longitude)
  // Must convert sidereal back to tropical by adding ayanamsha
  const tropLon = (longitude + ayanamshaValue) % 360;
  const obliquity = 23.44;
  const decl = Math.asin(Math.sin(obliquity * Math.PI / 180) * Math.sin(tropLon * Math.PI / 180)) * 180 / Math.PI;
  // Benefics strong with north declination, malefics with south
  let ayana = 0;
  if (['Moon', 'Mercury', 'Jupiter', 'Venus'].includes(planet)) {
    ayana = 30 + (decl / obliquity) * 30; // 0-60 range
  } else {
    ayana = 30 - (decl / obliquity) * 30;
  }
  ayana = Math.max(0, Math.min(60, ayana));
  
  const total = divaratri + paksha + tribhaga + abda + masa + vara + hora + ayana;
  
  return {
    divaratri: Math.round(divaratri * 100) / 100,
    paksha: Math.round(paksha * 100) / 100,
    tribhaga: Math.round(tribhaga * 100) / 100,
    abda: Math.round(abda * 100) / 100,
    masa: Math.round(masa * 100) / 100,
    vara: Math.round(vara * 100) / 100,
    hora: Math.round(hora * 100) / 100,
    ayana: Math.round(ayana * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

function calcChestaBala(
  planet: string,
  retrograde: boolean,
  longitude: number,
  sunLon: number,
  moonLon?: number,
  ayanamshaValue: number = 24
): number {
  if (planet === 'Sun') {
    // Sun's Chesta Bala = Ayana Bala (based on declination/season)
    const tropicalLon = normalizeLongitude(longitude + ayanamshaValue);
    const obliquity = 23.44;
    const decl = Math.asin(Math.sin(obliquity * Math.PI / 180) * Math.sin(tropicalLon * Math.PI / 180)) * 180 / Math.PI;
    return Math.max(0, Math.min(60, 30 + (decl / obliquity) * 30));
  }
  if (planet === 'Moon') {
    // Moon's Chesta Bala = Paksha Bala (based on phase)
    const mLon = moonLon ?? longitude;
    const phase = ((mLon - sunLon) % 360 + 360) % 360;
    return Math.max(0, Math.min(60, (phase <= 180 ? phase : 360 - phase) / 3));
  }
  // Retrograde planets get higher chesta bala (moving against normal direction = more effort)
  if (retrograde) return 60;
  // Based on elongation from Sun — planets far from Sun move slower = more chesta
  let diff = Math.abs(longitude - sunLon);
  if (diff > 180) diff = 360 - diff;
  // Stationary planets (near 90° or 270° from Sun) get max chesta
  const stationaryProximity = Math.abs(diff - 90);
  return Math.max(0, Math.min(60, 60 - stationaryProximity * 0.67));
}

function getVedicAspectTargets(planet: string): number[] {
  if (planet === 'Mars') return [90, 180, 210];
  if (planet === 'Jupiter') return [120, 180, 240];
  if (planet === 'Saturn') return [60, 180, 270];
  return [180];
}

function calculateVedicAspectStrength(fromLon: number, toLon: number, planet: string, orb = 15): number {
  const rawDiff = normalizeLongitude(toLon - fromLon);
  const targets = getVedicAspectTargets(planet);
  let maxStrength = 0;

  for (const target of targets) {
    let delta = Math.abs(rawDiff - target);
    if (delta > 180) delta = 360 - delta;
    if (delta <= orb) {
      maxStrength = Math.max(maxStrength, 1 - delta / orb);
    }
  }

  return Math.max(0, Math.min(1, maxStrength));
}

function calcDrikBala(planet: string, longitude: number, planets: Record<string, { longitude: number; signIndex: number; retrograde: boolean }>): number {
  let drikBala = 0;
  const benefics = ['Jupiter', 'Venus', 'Mercury'];
  const malefics = ['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu'];
  const sunLon = planets['Sun']?.longitude ?? 0;
  
  for (const [name, p] of Object.entries(planets)) {
    if (name === planet) continue;

    const aspectStrength = calculateVedicAspectStrength(p.longitude, longitude, name, 15);
    if (aspectStrength <= 0) continue;

    if (benefics.includes(name)) {
      drikBala += 20 * aspectStrength;
    } else if (malefics.includes(name)) {
      drikBala -= 20 * aspectStrength;
    } else if (name === 'Moon') {
      const moonPhase = normalizeLongitude(p.longitude - sunLon);
      const isWaxing = moonPhase < 180;
      drikBala += (isWaxing ? 16 : -8) * aspectStrength;
    }
  }
  
  return Math.max(-60, Math.min(60, drikBala));
}

// ─── Bhava Bala ──────────────────────────────────────────────────────────────

function calcBhavaBala(
  lagnaSignIndex: number,
  planets: Record<string, { longitude: number; signIndex: number }>,
  shadBala: Record<string, ShadBalaInfo>,
): Record<number, BhavaBalaInfo> {
  const result: Record<number, BhavaBalaInfo> = {};
  const beneficSet = new Set(['Jupiter', 'Venus', 'Mercury', 'Moon']);
  const maleficSet = new Set(['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu']);

  const angularDistance = (a: number, b: number): number => {
    const d = Math.abs(normalizeLongitude(a) - normalizeLongitude(b));
    return Math.min(d, 360 - d);
  };
  
  for (let house = 1; house <= 12; house++) {
    const signIndex = (lagnaSignIndex + house - 1) % 12;
    const lord = getSignLord(signIndex);
    
    // Find planets in this house
    const planetsInHouse: string[] = [];
    for (const [name, p] of Object.entries(planets)) {
      const pHouse = ((p.signIndex - lagnaSignIndex + 12) % 12) + 1;
      if (pHouse === house) planetsInHouse.push(name);
    }
    
    // Lord's house
    const lordData = planets[lord];
    const lordHouse = lordData ? ((lordData.signIndex - lagnaSignIndex + 12) % 12) + 1 : 0;
    
    // Bhavadhipati Bala (lord's shadbala)
    const lordShadBala = shadBala[lord];
    const lordTotalShashtiamsas = lordShadBala?.total_shashtiamsas ?? 300;
    const bhavadhipatiBala = Math.min(60, Math.max(20, lordTotalShashtiamsas / 10));
    
    // Bhava Digbala — based on house type (kendra strongest, then panaphara, then apoklima)
    let bhavaDigbala = 0;
    if ([1, 4, 7, 10].includes(house)) bhavaDigbala = 45;
    else if ([2, 5, 8, 11].includes(house)) bhavaDigbala = 30;
    else bhavaDigbala = 18;

    if (house === 1) bhavaDigbala += 6;
    else if (house === 10) bhavaDigbala += 5;
    else if (house === 9) bhavaDigbala += 4;
    else if ([5, 11].includes(house)) bhavaDigbala += 3;
    
    // Bhava Drishti Bala — aspects TO this house from all planets
    let bhavaDrishtiBala = 0;
    const houseMidLon = (signIndex * 30 + 15); // midpoint of house sign
    const sunLon = planets['Sun']?.longitude ?? 0;
    for (const [name, p] of Object.entries(planets)) {
      const aspectStrength = calculateVedicAspectStrength(p.longitude, houseMidLon, name, 15);
      if (aspectStrength <= 0) continue;

      if (beneficSet.has(name)) {
        bhavaDrishtiBala += 12 * aspectStrength;
      } else if (maleficSet.has(name)) {
        bhavaDrishtiBala -= 12 * aspectStrength;
      } else if (name === 'Moon') {
        const moonPhase = normalizeLongitude(p.longitude - sunLon);
        const isWaxing = moonPhase < 180;
        bhavaDrishtiBala += (isWaxing ? 10 : -6) * aspectStrength;
      }
    }

    bhavaDrishtiBala = Math.max(-60, Math.min(60, bhavaDrishtiBala));

    // Residential strength — planets closer to house midpoint contribute more
    let residentialStrength = 0;
    for (const name of planetsInHouse) {
      const pdata = planets[name];
      if (!pdata) continue;
      const dist = angularDistance(pdata.longitude, houseMidLon);
      const inSignDist = dist > 15 ? 30 - dist : dist;
      const base = Math.max(0, (15 - inSignDist) * 4);
      if (beneficSet.has(name)) residentialStrength += base;
      else if (maleficSet.has(name)) residentialStrength += base * 0.5;
      else residentialStrength += base * 0.8;
    }
    residentialStrength = Math.min(60, residentialStrength);
    
    // Residential strength — planets in house contribute based on their shadbala
    let planetContribution = 0;
    for (const name of planetsInHouse) {
      const pBala = shadBala[name];
      if (!pBala) continue;
      const total = pBala.total_shashtiamsas ?? ((pBala.total_rupas ?? 0) * 60);
      const contribution = Math.min(30, Math.max(0, total / 20));
      if (beneficSet.has(name)) {
        planetContribution += contribution;
      } else if (maleficSet.has(name)) {
        if ([3, 6, 11].includes(house)) planetContribution += contribution * 0.7;
        else if ([6, 8, 12].includes(house)) planetContribution -= contribution * 0.4;
        else planetContribution += contribution * 0.45;
      } else {
        planetContribution += contribution * 0.8;
      }
    }
    
    // Lord placement strength — lord in kendra/trikona from own house is strong
    let lordPlacementBala = 0;
    if (lordHouse > 0) {
      const lordDistFromHouse = ((lordHouse - house + 12) % 12);
      if ([0, 3, 6, 9].includes(lordDistFromHouse)) lordPlacementBala = 20; // kendra from house
      else if ([4, 8].includes(lordDistFromHouse)) lordPlacementBala = 15;  // trikona from house
      else if ([5, 7, 11].includes(lordDistFromHouse)) lordPlacementBala = 5; // neutral
      else lordPlacementBala = -5; // 6th, 8th, 12th from own house
    }
    
    const totalShashtiamsas = bhavadhipatiBala + bhavaDigbala + bhavaDrishtiBala + residentialStrength + planetContribution + lordPlacementBala + 60;
    const totalRupas = totalShashtiamsas / 60;
    
    const isStrong = totalRupas >= 2.5;
    let rating: 'Very Strong' | 'Strong' | 'Medium' | 'Weak';
    if (totalRupas >= 4.0) rating = 'Very Strong';
    else if (totalRupas >= 3.0) rating = 'Strong';
    else if (totalRupas >= 2.0) rating = 'Medium';
    else rating = 'Weak';
    
    result[house] = {
      house,
      sign: SIGNS_EN[signIndex],
      sign_sanskrit: SIGNS_SANSKRIT[signIndex],
      lord,
      lord_house: lordHouse,
      lord_sign: lordData ? SIGNS_EN[lordData.signIndex] : undefined,
      planets_in_house: planetsInHouse,
      bhavadhipati_bala: Math.round(bhavadhipatiBala * 100) / 100,
      bhava_digbala: bhavaDigbala,
      bhava_drishti_bala: Math.round(bhavaDrishtiBala * 100) / 100,
      residential_strength: Math.round(residentialStrength * 100) / 100,
      planet_contribution: Math.round(planetContribution * 100) / 100,
      total_shashtiamsas: Math.round(totalShashtiamsas * 100) / 100,
      total_rupas: Math.round(totalRupas * 100) / 100,
      is_strong: isStrong,
      rating,
    };
  }
  
  return result;
}

function getSignLord(signIndex: number): string {
  const lords = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
  return lords[signIndex % 12];
}

// ─── Yoga Detection ─────────────────────────────────────────────────────────

function calcYogas(
  planets: Record<string, { longitude: number; signIndex: number; retrograde: boolean }>,
  lagnaSignIndex: number,
  shadBala: Record<string, ShadBalaInfo>,
): YogaInfo[] {
  const yogas: YogaInfo[] = [];
  const kendraHouses = [1, 4, 7, 10];
  const trikonaHouses = [1, 5, 9];
  
  const getHouse = (signIdx: number) => ((signIdx - lagnaSignIndex + 12) % 12) + 1;
  const areSameSign = (p1: string, p2: string) => planets[p1]?.signIndex === planets[p2]?.signIndex;
  const isInHouses = (planet: string, houses: number[]) => houses.includes(getHouse(planets[planet]?.signIndex ?? -1));
  
  // 1. Gajakesari Yoga — Jupiter in kendra from Moon
  const moonSign = planets['Moon']?.signIndex;
  const jupSign = planets['Jupiter']?.signIndex;
  if (moonSign !== undefined && jupSign !== undefined) {
    const diff = ((jupSign - moonSign + 12) % 12) + 1;
    if ([1, 4, 7, 10].includes(diff)) {
      const strength = (shadBala['Jupiter']?.is_strong && shadBala['Moon']?.is_strong) ? 'strong' : 'moderate';
      yogas.push({ name: 'Gajakesari Yoga', type: 'benefic', description: 'Jupiter in kendra from Moon — wisdom, wealth, and fame', planets: ['Jupiter', 'Moon'], strength });
    }
  }
  
  // 2. Raj Yoga — lords of kendra and trikona conjunct or mutual aspect
  const kendraLords = new Set(kendraHouses.map(h => getSignLord((lagnaSignIndex + h - 1) % 12)));
  const trikonaLords = new Set(trikonaHouses.map(h => getSignLord((lagnaSignIndex + h - 1) % 12)));
  for (const kl of kendraLords) {
    for (const tl of trikonaLords) {
      if (kl !== tl && areSameSign(kl, tl)) {
        yogas.push({ name: 'Raj Yoga', type: 'benefic', description: `${kl} (kendra lord) conjunct ${tl} (trikona lord) — power, status, and authority`, planets: [kl, tl], strength: 'strong' });
      }
    }
  }
  
  // 3. Budhaditya Yoga — Sun and Mercury in same sign
  if (areSameSign('Sun', 'Mercury')) {
    const house = getHouse(planets['Sun']?.signIndex ?? 0);
    const strength = [1, 4, 5, 7, 9, 10].includes(house) ? 'strong' : 'moderate';
    yogas.push({ name: 'Budhaditya Yoga', type: 'benefic', description: 'Sun-Mercury conjunction — intelligence, communication skills, and analytical mind', planets: ['Sun', 'Mercury'], strength });
  }
  
  // 4. Chandra-Mangal Yoga — Moon and Mars in same sign
  if (areSameSign('Moon', 'Mars')) {
    yogas.push({ name: 'Chandra-Mangal Yoga', type: 'benefic', description: 'Moon-Mars conjunction — wealth through courage and enterprise', planets: ['Moon', 'Mars'], strength: 'moderate' });
  }
  
  // 5. Hamsa Yoga — Jupiter in kendra in own/exalted sign
  if (isInHouses('Jupiter', kendraHouses)) {
    const jSign = planets['Jupiter']?.signIndex;
    if (jSign === 8 || jSign === 11 || jSign === 3) { // Sagittarius, Pisces, Cancer (exalted)
      yogas.push({ name: 'Hamsa Yoga', type: 'benefic', description: 'Jupiter in kendra in own/exalted sign — wisdom, spirituality, and good fortune', planets: ['Jupiter'], strength: 'strong' });
    }
  }
  
  // 6. Malavya Yoga — Venus in kendra in own/exalted sign
  if (isInHouses('Venus', kendraHouses)) {
    const vSign = planets['Venus']?.signIndex;
    if (vSign === 1 || vSign === 6 || vSign === 11) { // Taurus, Libra, Pisces (exalted)
      yogas.push({ name: 'Malavya Yoga', type: 'benefic', description: 'Venus in kendra in own/exalted sign — luxury, beauty, and artistic talent', planets: ['Venus'], strength: 'strong' });
    }
  }
  
  // 7. Sasa Yoga — Saturn in kendra in own/exalted sign
  if (isInHouses('Saturn', kendraHouses)) {
    const sSign = planets['Saturn']?.signIndex;
    if (sSign === 9 || sSign === 10 || sSign === 6) { // Capricorn, Aquarius, Libra (exalted)
      yogas.push({ name: 'Sasa Yoga', type: 'benefic', description: 'Saturn in kendra in own/exalted sign — authority, discipline, and leadership', planets: ['Saturn'], strength: 'strong' });
    }
  }
  
  // 8. Kemadruma Yoga (malefic) — no planets in 2nd or 12th from Moon
  if (moonSign !== undefined) {
    const sign2nd = (moonSign + 1) % 12;
    const sign12th = (moonSign + 11) % 12;
    const mainPlanets = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    const hasPlanetAdjacent = mainPlanets.some(p => {
      const pSign = planets[p]?.signIndex;
      return pSign === sign2nd || pSign === sign12th;
    });
    if (!hasPlanetAdjacent) {
      yogas.push({ name: 'Kemadruma Yoga', type: 'malefic', description: 'No planets adjacent to Moon — emotional isolation, financial struggles (cancelled if Moon is aspected by benefics)', planets: ['Moon'], strength: 'moderate' });
    }
  }
  
  // 9. Viparita Raj Yoga — lords of 6th, 8th, 12th in each other's houses
  const lord6 = getSignLord((lagnaSignIndex + 5) % 12);
  const lord8 = getSignLord((lagnaSignIndex + 7) % 12);
  const lord12 = getSignLord((lagnaSignIndex + 11) % 12);
  const dusthanaLords = [{ lord: lord6, house: 6 }, { lord: lord8, house: 8 }, { lord: lord12, house: 12 }];
  for (let i = 0; i < dusthanaLords.length; i++) {
    for (let j = i + 1; j < dusthanaLords.length; j++) {
      const l1 = dusthanaLords[i], l2 = dusthanaLords[j];
      const l1House = getHouse(planets[l1.lord]?.signIndex ?? -1);
      const l2House = getHouse(planets[l2.lord]?.signIndex ?? -1);
      if ((l1House === l2.house || l2House === l1.house) || areSameSign(l1.lord, l2.lord)) {
        yogas.push({ name: 'Viparita Raj Yoga', type: 'benefic', description: `${l1.lord} (${l1.house}th lord) and ${l2.lord} (${l2.house}th lord) connected — success through adversity`, planets: [l1.lord, l2.lord], strength: 'moderate' });
      }
    }
  }
  
  // 10. Neecha Bhanga Raj Yoga — debilitated planet gets cancellation
  for (const [name, p] of Object.entries(planets)) {
    if (name === 'Rahu' || name === 'Ketu') continue;
    const debSign = (DEBILITATION as Record<string, number>)[name];
    if (debSign !== undefined && p.signIndex === debSign) {
      const debLord = getSignLord(debSign);
      // Check if lord of debilitation sign is in kendra from lagna or Moon
      const lordHouse = getHouse(planets[debLord]?.signIndex ?? -1);
      const lordFromMoon = moonSign !== undefined ? ((planets[debLord]?.signIndex ?? 0) - moonSign + 12) % 12 + 1 : 0;
      if (kendraHouses.includes(lordHouse) || kendraHouses.includes(lordFromMoon)) {
        yogas.push({ name: 'Neecha Bhanga Raj Yoga', type: 'benefic', description: `${name}'s debilitation cancelled by ${debLord} in kendra — rise after initial struggles`, planets: [name, debLord], strength: 'strong' });
      }
    }
  }
  
  return yogas;
}

// ─── Chart Generation ────────────────────────────────────────────────────────

function buildRasiChart(_lagnaSignIndex: number, planets: Record<string, { signIndex: number }>): string[][] {
  const chart: string[][] = Array.from({ length: 12 }, () => []);
  for (const [name, p] of Object.entries(planets)) {
    chart[p.signIndex].push(name);
  }
  return chart;
}

function buildNavamsaChart(planets: Record<string, { longitude: number }>): string[][] {
  const chart: string[][] = Array.from({ length: 12 }, () => []);
  for (const [name, p] of Object.entries(planets)) {
    const navSign = getNavamsaSignIndex(p.longitude);
    chart[navSign].push(name);
  }
  return chart;
}

// ─── Main Calculation Function ───────────────────────────────────────────────

export function calculateKundali(request: KundaliRequest): KundaliResponse {
  const { year, month, day, hour, minute, second, tz_offset_hours, latitude, longitude, ayanamsha: ayanamshaType } = request;
  
  // Calculate Julian Day (in UT)
  const jd = calcJulianDay(year, month, day, hour, minute, second, tz_offset_hours);
  
  // Calculate ayanamsha
  const ayanamshaValue = calcAyanamsha(jd, ayanamshaType);
  
  // Create UTC date for astronomy-engine planetary calculations
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcDate = new Date(localAsUtcMs - tz_offset_hours * 3600000);
  
  // Calculate Lagna using JD directly for accuracy
  const lagnaLongitude = calcLagna(jd, latitude, longitude, ayanamshaValue);
  const lagnaSignIndex = getSignIndex(lagnaLongitude);
  const lagnaDeg = getDegInSign(lagnaLongitude);
  // lagnaNavamsaIndex available if needed: getNavamsaSignIndex(lagnaLongitude)
  
  const lagnaInfo: LagnaInfo = {
    longitude: Math.round(lagnaLongitude * 10000) / 10000,
    sign: SIGNS_EN[lagnaSignIndex],
    sign_sanskrit: SIGNS_SANSKRIT[lagnaSignIndex],
    sign_index: lagnaSignIndex,
    deg: lagnaDeg.deg,
    min: lagnaDeg.min,
    sec: lagnaDeg.sec,
    symbol: '↑',
  };
  
  // Calculate planetary positions
  const planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const planetsRaw: Record<string, { longitude: number; signIndex: number; retrograde: boolean; tropicalLon: number }> = {};
  const planetsInfo: Record<string, PlanetInfo> = {};
  
  let sunSiderealLon = 0;
  
  for (const name of planetNames) {
    const body = getAstronomyBody(name);
    if (!body) continue;
    
    const tropicalLon = getTropicalLongitude(body, utcDate);
    const siderealLon = getSiderealLongitude(tropicalLon, ayanamshaValue);
    const signIdx = getSignIndex(siderealLon);
    const deg = getDegInSign(siderealLon);
    const retro = isRetrograde(body, utcDate);
    const navamsaIdx = getNavamsaSignIndex(siderealLon);
    
    if (name === 'Sun') sunSiderealLon = siderealLon;
    
    planetsRaw[name] = { longitude: siderealLon, signIndex: signIdx, retrograde: retro, tropicalLon };
    
    const houseWholeSign = ((signIdx - lagnaSignIndex + 12) % 12) + 1;
    const isExalted = EXALTATION[name]?.sign === signIdx;
    const isDebilitated = DEBILITATION[name] === signIdx;
    const isVargottama = signIdx === navamsaIdx;
    const combusted = isCombust(siderealLon, sunSiderealLon, name);
    
    const nak = getNakshatra(siderealLon);
    planetsInfo[name] = {
      longitude: Math.round(siderealLon * 10000) / 10000,
      sign: SIGNS_EN[signIdx],
      sign_sanskrit: SIGNS_SANSKRIT[signIdx],
      sign_index: signIdx,
      navamsa_sign_index: navamsaIdx,
      navamsa_sign: SIGNS_EN[navamsaIdx],
      navamsa_sign_sanskrit: SIGNS_SANSKRIT[navamsaIdx],
      deg: deg.deg,
      min: deg.min,
      sec: deg.sec,
      house_whole_sign: houseWholeSign,
      retrograde: retro,
      symbol: PLANET_SYMBOLS[name] ?? name.slice(0, 2),
      exalted: isExalted,
      debilitated: isDebilitated,
      vargottama: isVargottama,
      combust: combusted,
      nakshatra: nak.name,
      nakshatra_pada: nak.pada,
      nakshatra_lord: NAKSHATRA_LORDS[nak.index],
    };
  }
  
  // Calculate Rahu and Ketu (mean nodes)
  const rahuTropical = calcMeanNode(utcDate);
  const rahuSidereal = getSiderealLongitude(rahuTropical, ayanamshaValue);
  const ketuSidereal = (rahuSidereal + 180) % 360;
  
  for (const [name, lon] of [['Rahu', rahuSidereal], ['Ketu', ketuSidereal]] as [string, number][]) {
    const signIdx = getSignIndex(lon);
    const deg = getDegInSign(lon);
    const navamsaIdx = getNavamsaSignIndex(lon);
    const houseWholeSign = ((signIdx - lagnaSignIndex + 12) % 12) + 1;
    
    planetsRaw[name] = { longitude: lon, signIndex: signIdx, retrograde: true, tropicalLon: 0 };
    
    const nakRK = getNakshatra(lon);
    planetsInfo[name] = {
      longitude: Math.round(lon * 10000) / 10000,
      sign: SIGNS_EN[signIdx],
      sign_sanskrit: SIGNS_SANSKRIT[signIdx],
      sign_index: signIdx,
      navamsa_sign_index: navamsaIdx,
      navamsa_sign: SIGNS_EN[navamsaIdx],
      navamsa_sign_sanskrit: SIGNS_SANSKRIT[navamsaIdx],
      deg: deg.deg,
      min: deg.min,
      sec: deg.sec,
      house_whole_sign: houseWholeSign,
      retrograde: true, // Rahu/Ketu always retrograde
      symbol: PLANET_SYMBOLS[name] ?? name.slice(0, 2),
      exalted: false,
      debilitated: false,
      vargottama: signIdx === navamsaIdx,
      combust: false,
      nakshatra: nakRK.name,
      nakshatra_pada: nakRK.pada,
      nakshatra_lord: NAKSHATRA_LORDS[nakRK.index],
    };
  }

  // Calculate Upagrahas (BPHS)
  const sunBasedUpagrahas = calcSunBasedUpagrahas(sunSiderealLon);
  const kalavelaUpagrahas = calcKalavelaUpagrahas(utcDate, tz_offset_hours, latitude, longitude, ayanamshaValue);
  const upagrahaLongitudes: Record<string, number> = {
    ...sunBasedUpagrahas,
    ...kalavelaUpagrahas,
  };

  const upagrahasInfo: Record<string, PlanetInfo> = {};
  const upagrahasRaw: Record<string, { longitude: number; signIndex: number }> = {};
  for (const [name, lon] of Object.entries(upagrahaLongitudes)) {
    const normalized = normalizeLongitude(lon);
    upagrahasInfo[name] = buildUpagrahaInfo(name, normalized, lagnaSignIndex);
    upagrahasRaw[name] = { longitude: normalized, signIndex: getSignIndex(normalized) };
  }
  
  // Build charts
  const combinedRaw = { ...planetsRaw, ...upagrahasRaw };
  const rasiChart = buildRasiChart(lagnaSignIndex, combinedRaw);
  const navamsaChart = buildNavamsaChart(combinedRaw);
  
  // Calculate Shadbala
  const shadBala = calcShadBala(
    planetsRaw,
    lagnaSignIndex,
    utcDate,
    tz_offset_hours,
    latitude,
    longitude,
    ayanamshaValue
  );
  
  // Calculate Bhava Bala
  const bhavaBala = calcBhavaBala(lagnaSignIndex, planetsRaw, shadBala);
  
  // Calculate Vimshottari Dasha
  const moonLon = planetsRaw['Moon']?.longitude ?? 0;
  const dasha = calcVimshottariDasha(moonLon, utcDate, tz_offset_hours);
  
  // Detect Yogas
  const yogas = calcYogas(planetsRaw, lagnaSignIndex, shadBala);
  
  // Build response
  const response: KundaliResponse = {
    meta: {
      ayanamsha: ayanamshaType,
      jd_ut: Math.round(jd * 100000) / 100000,
      ayanamsha_deg: Math.round(ayanamshaValue * 10000) / 10000,
    },
    birth: {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
      tz_offset_hours,
      adjusted_tz_offset_hours: tz_offset_hours,
      dst_applied: false,
      dst_adjustment_hours: 0,
      latitude,
      longitude,
    },
    lagna: lagnaInfo,
    planets: planetsInfo,
    upagrahas: upagrahasInfo,
    rasi_chart: rasiChart,
    navamsa_chart: navamsaChart,
    shad_bala: shadBala,
    bhava_bala: bhavaBala,
    dasha,
    yogas,
    signs: SIGNS_EN,
    signs_sanskrit: SIGNS_SANSKRIT,
  };
  
  return response;
}

// ─── Timezone Estimation (replaces backend /api/timezone) ────────────────────

export function estimateTimezone(longitude: number): number {
  // Simple estimation: 15° per hour, rounded to nearest 0.5
  const raw = longitude / 15;
  return Math.round(raw * 2) / 2;
}

// ─── Kundali Matching (Ashtakoot) ───────────────────────────────────────────

export interface MatchScore {
  category: string;
  score: number;
  maxScore: number;
  description: string;
}

export function calculateAshtakootMatch(chart1: KundaliResponse, chart2: KundaliResponse): { scores: MatchScore[]; total: number; maxTotal: number } {
  const moon1 = chart1.planets['Moon'];
  const moon2 = chart2.planets['Moon'];
  
  if (!moon1 || !moon2) {
    return { scores: [], total: 0, maxTotal: 36 };
  }
  
  const nak1 = getNakshatra(moon1.longitude);
  const nak2 = getNakshatra(moon2.longitude);
  const sign1 = moon1.sign_index;
  const sign2 = moon2.sign_index;
  const lord1 = getSignLord(sign1);
  const lord2 = getSignLord(sign2);
  
  const scores: MatchScore[] = [];
  
  // 1. Varna (1 point) — Brahmin > Kshatriya > Vaishya > Shudra
  // Water signs = Brahmin(4), Fire = Kshatriya(3), Earth = Vaishya(2), Air = Shudra(1)
  const varnaMap: Record<number, number> = { 3: 4, 7: 4, 11: 4, 0: 3, 4: 3, 8: 3, 1: 2, 5: 2, 9: 2, 2: 1, 6: 1, 10: 1 };
  const v1 = varnaMap[sign1] ?? 1;
  const v2 = varnaMap[sign2] ?? 1;
  scores.push({ category: 'Varna', score: v1 >= v2 ? 1 : 0, maxScore: 1, description: 'Spiritual compatibility and ego levels' });
  
  // 2. Vashya (2 points)
  // Aries=quadruped, Taurus=quadruped, Gemini=human, Cancer=insect/reptile,
  // Leo=wild, Virgo=human, Libra=human, Scorpio=insect/reptile,
  // Sagittarius=human(first half)/quadruped(second), Capricorn=quadruped/water,
  // Aquarius=human, Pisces=water
  const vashyaGroups: Record<number, string> = {
    0: 'quadruped', 1: 'quadruped', 2: 'human', 3: 'insect',
    4: 'wild', 5: 'human', 6: 'human', 7: 'insect',
    8: 'human', 9: 'quadruped', 10: 'human', 11: 'water'
  };
  const vg1 = vashyaGroups[sign1];
  const vg2 = vashyaGroups[sign2];
  let vashyaScore = 0;
  if (vg1 === vg2) vashyaScore = 2;
  else if ((vg1 === 'human' && (vg2 === 'quadruped' || vg2 === 'water')) ||
           (vg2 === 'human' && (vg1 === 'quadruped' || vg1 === 'water'))) vashyaScore = 1;
  else if ((vg1 === 'quadruped' && vg2 === 'wild') || (vg2 === 'quadruped' && vg1 === 'wild')) vashyaScore = 1;
  else vashyaScore = 0;
  scores.push({ category: 'Vashya', score: vashyaScore, maxScore: 2, description: 'Mutual attraction and dominance' });
  
  // 3. Tara (3 points) — based on nakshatra distance mod 9
  // Favorable: 2(Sampat), 4(Kshema), 6(Sadhaka), 8(Mitra), 0(Parama Mitra)
  // Unfavorable: 1(Janma), 3(Vipath), 5(Pratyari), 7(Vadha)
  const taraDiff1 = ((nak2.index - nak1.index + 27) % 27) % 9;
  const taraDiff2 = ((nak1.index - nak2.index + 27) % 27) % 9;
  const favorableTaras = [0, 2, 4, 6, 8];
  const tara1ok = favorableTaras.includes(taraDiff1);
  const tara2ok = favorableTaras.includes(taraDiff2);
  let taraScore = 0;
  if (tara1ok && tara2ok) taraScore = 3;
  else if (tara1ok || tara2ok) taraScore = 1.5;
  else taraScore = 0;
  scores.push({ category: 'Tara', score: taraScore, maxScore: 3, description: 'Destiny and luck compatibility' });
  
  // 4. Yoni (4 points) — correct animal per nakshatra
  // 0=Horse,1=Elephant,2=Sheep,3=Snake,4=Dog,5=Cat,6=Rat,7=Cow,8=Buffalo,9=Tiger,10=Deer,11=Monkey,12=Mongoose,13=Lion
  const YONI_ANIMALS: number[] = [
    0,  // Ashwini - Horse
    1,  // Bharani - Elephant
    2,  // Krittika - Sheep
    3,  // Rohini - Snake
    3,  // Mrigashira - Snake
    4,  // Ardra - Dog
    5,  // Punarvasu - Cat
    2,  // Pushya - Sheep
    5,  // Ashlesha - Cat
    6,  // Magha - Rat
    6,  // P.Phalguni - Rat
    7,  // U.Phalguni - Cow
    8,  // Hasta - Buffalo
    9,  // Chitra - Tiger
    8,  // Swati - Buffalo
    9,  // Vishakha - Tiger
    10, // Anuradha - Deer
    10, // Jyeshtha - Deer
    4,  // Mula - Dog
    11, // P.Ashadha - Monkey
    12, // U.Ashadha - Mongoose
    11, // Shravana - Monkey
    13, // Dhanishta - Lion
    0,  // Shatabhisha - Horse
    13, // P.Bhadrapada - Lion
    7,  // U.Bhadrapada - Cow
    1,  // Revati - Elephant
  ];
  // Enemy yoni pairs
  const YONI_ENEMIES: [number, number][] = [
    [0, 8],   // Horse - Buffalo
    [1, 13],  // Elephant - Lion
    [2, 11],  // Sheep - Monkey
    [3, 12],  // Snake - Mongoose
    [4, 10],  // Dog - Deer
    [5, 6],   // Cat - Rat
    [7, 9],   // Cow - Tiger
  ];
  const y1 = YONI_ANIMALS[nak1.index];
  const y2 = YONI_ANIMALS[nak2.index];
  let yoniScore = 0;
  if (y1 === y2) yoniScore = 4;
  else {
    const isEnemy = YONI_ENEMIES.some(([a, b]) => (y1 === a && y2 === b) || (y1 === b && y2 === a));
    if (isEnemy) yoniScore = 0;
    else yoniScore = 2; // neutral
  }
  scores.push({ category: 'Yoni', score: yoniScore, maxScore: 4, description: 'Physical and sexual compatibility' });
  
  // 5. Graha Maitri (5 points) — sign lord friendship
  let maitriScore = 0;
  if (lord1 === lord2) maitriScore = 5;
  else if (FRIENDS[lord1]?.includes(lord2) && FRIENDS[lord2]?.includes(lord1)) maitriScore = 5;
  else if (FRIENDS[lord1]?.includes(lord2) || FRIENDS[lord2]?.includes(lord1)) maitriScore = 3;
  else if (ENEMIES[lord1]?.includes(lord2) && ENEMIES[lord2]?.includes(lord1)) maitriScore = 0;
  else if (ENEMIES[lord1]?.includes(lord2) || ENEMIES[lord2]?.includes(lord1)) maitriScore = 1;
  else maitriScore = 2; // neutral
  scores.push({ category: 'Graha Maitri', score: maitriScore, maxScore: 5, description: 'Mental compatibility and friendship' });
  
  // 6. Gana (6 points) — correct per-nakshatra mapping
  // 0=Deva, 1=Manushya, 2=Rakshasa
  const GANA_MAP: number[] = [
    0, // Ashwini - Deva
    1, // Bharani - Manushya
    2, // Krittika - Rakshasa
    0, // Rohini - Deva
    0, // Mrigashira - Deva
    1, // Ardra - Manushya
    0, // Punarvasu - Deva
    0, // Pushya - Deva
    2, // Ashlesha - Rakshasa
    2, // Magha - Rakshasa
    1, // P.Phalguni - Manushya
    1, // U.Phalguni - Manushya
    0, // Hasta - Deva
    2, // Chitra - Rakshasa
    0, // Swati - Deva
    2, // Vishakha - Rakshasa
    0, // Anuradha - Deva
    2, // Jyeshtha - Rakshasa
    2, // Mula - Rakshasa
    1, // P.Ashadha - Manushya
    1, // U.Ashadha - Manushya
    0, // Shravana - Deva
    2, // Dhanishta - Rakshasa
    2, // Shatabhisha - Rakshasa
    1, // P.Bhadrapada - Manushya
    1, // U.Bhadrapada - Manushya
    0, // Revati - Deva
  ];
  const g1 = GANA_MAP[nak1.index];
  const g2 = GANA_MAP[nak2.index];
  let ganaScore = 0;
  if (g1 === g2) ganaScore = 6;
  else if (Math.abs(g1 - g2) === 1) ganaScore = 3; // Deva-Manushya or Manushya-Rakshasa
  else ganaScore = 0; // Deva-Rakshasa
  scores.push({ category: 'Gana', score: ganaScore, maxScore: 6, description: 'Temperament and behavior compatibility' });
  
  // 7. Bhakoot (7 points) — only 2/12 and 6/8 are unfavorable
  const signDiff = ((sign2 - sign1 + 12) % 12) + 1;
  const signDiffRev = ((sign1 - sign2 + 12) % 12) + 1;
  const isBhakootBad = (signDiff === 6 || signDiff === 8 || signDiffRev === 6 || signDiffRev === 8 ||
                        signDiff === 2 || signDiff === 12 || signDiffRev === 2 || signDiffRev === 12);
  const bhakootScore = isBhakootBad ? 0 : 7;
  scores.push({ category: 'Bhakoot', score: bhakootScore, maxScore: 7, description: 'Emotional compatibility and prosperity' });
  
  // 8. Nadi (8 points) — correct per-nakshatra mapping
  // 0=Aadi(Vata), 1=Madhya(Pitta), 2=Antya(Kapha)
  const NADI_MAP: number[] = [
    0, // Ashwini - Aadi
    1, // Bharani - Madhya
    2, // Krittika - Antya
    2, // Rohini - Antya
    1, // Mrigashira - Madhya
    0, // Ardra - Aadi
    0, // Punarvasu - Aadi
    1, // Pushya - Madhya
    2, // Ashlesha - Antya
    0, // Magha - Aadi
    1, // P.Phalguni - Madhya
    2, // U.Phalguni - Antya
    2, // Hasta - Antya
    1, // Chitra - Madhya
    0, // Swati - Aadi
    0, // Vishakha - Aadi
    1, // Anuradha - Madhya
    2, // Jyeshtha - Antya
    0, // Mula - Aadi
    1, // P.Ashadha - Madhya
    2, // U.Ashadha - Antya
    2, // Shravana - Antya
    1, // Dhanishta - Madhya
    0, // Shatabhisha - Aadi
    0, // P.Bhadrapada - Aadi
    1, // U.Bhadrapada - Madhya
    2, // Revati - Antya
  ];
  const n1 = NADI_MAP[nak1.index];
  const n2 = NADI_MAP[nak2.index];
  scores.push({ category: 'Nadi', score: n1 !== n2 ? 8 : 0, maxScore: 8, description: 'Health and genetic compatibility (most important)' });
  
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  return { scores, total, maxTotal: 36 };
}

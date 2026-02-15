import * as React from "react";
import type { KundaliResponse } from "../types/kundali";

interface NorthIndianChartProps {
  data: KundaliResponse;
  chartType?: "rasi" | "navamsa";
}

const ArrowUpIcon = ({ size = 11, className = "" }: { size?: number; className?: string }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 19 L12 7 L8 11 M12 7 L16 11"
      fill="none"
      stroke="white"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowDownIcon = ({ size = 11, className = "" }: { size?: number; className?: string }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 5 L12 17 L8 13 M12 17 L16 13"
      fill="none"
      stroke="white"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SquareIcon = ({ size = 9, className = "" }: { size?: number; className?: string }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="7" y="7" width="10" height="10" fill="none" stroke="white" strokeWidth="1.4" rx="1" />
  </svg>
);

const DEFAULT_SIGN_NAMES = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
];

const PLANET_ICONS: Record<string, { icon: string; color: string }> = {
  Sun: { icon: "Su", color: "#FF8C00" },
  Moon: { icon: "Mo", color: "#C0C0C0" },
  Mars: { icon: "Ma", color: "#DC143C" },
  Mercury: { icon: "Me", color: "#32CD32" },
  Jupiter: { icon: "Ju", color: "#FFD700" },
  Venus: { icon: "Ve", color: "#FF69B4" },
  Saturn: { icon: "Sa", color: "#4169E1" },
  Rahu: { icon: "Ra", color: "#708090" },
  Ketu: { icon: "Ke", color: "#8B4513" },
  Asc: { icon: "Asc", color: "#FF1493" },
  Uranus: { icon: "Ur", color: "#00CED1" },
  Neptune: { icon: "Ne", color: "#1E90FF" },
  Pluto: { icon: "Pl", color: "#9932CC" },
  Mandi: { icon: "Mn", color: "#696969" },
  Gulika: { icon: "Gk", color: "#556B2F" },
  Dhuma: { icon: "Dh", color: "#CD853F" },
  Vyatipata: { icon: "Vy", color: "#B22222" },
  Parivesha: { icon: "Pv", color: "#DAA520" },
  Indrachapa: { icon: "Ic", color: "#6B8E23" },
  Upaketu: { icon: "Uk", color: "#A0522D" },
  Kaala: { icon: "Ka", color: "#8B5CF6" },
  Mrityu: { icon: "Mr", color: "#DC2626" },
  ArthaPrahara: { icon: "Ap", color: "#14B8A6" },
  YamaGhantaka: { icon: "Yg", color: "#0EA5E9" },
};

function clampSignIndex(n: unknown): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return ((x % 12) + 12) % 12;
}

function isArrayOfStringArrays(v: unknown): v is string[][] {
  return (
    Array.isArray(v) &&
    v.every((row) => Array.isArray(row) && row.every((p) => typeof p === "string"))
  );
}

function normalizeRasiChart(rasiChartRaw: unknown, signsSanskrit: string[]): string[][] {
  const empty = Array.from({ length: 12 }, () => [] as string[]);

  if (isArrayOfStringArrays(rasiChartRaw)) {
    return empty.map((_, i) => Array.from(new Set(rasiChartRaw[i] ?? [])));
  }

  if (rasiChartRaw && typeof rasiChartRaw === "object" && !Array.isArray(rasiChartRaw)) {
    const obj = rasiChartRaw as Record<string, unknown>;

    const numericKeysPresent = Object.keys(obj).some((k) => /^[0-9]+$/.test(k));
    if (numericKeysPresent) {
      // For both Rasi and Navamsa charts, numeric keys represent house/sign indices
      return empty.map((_, i) => {
        const v = obj[String(i)];
        const arr = Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
        return Array.from(new Set(arr));
      });
    }

    const EN_SIGNS = [
      "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
      "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
    ];

    const out = empty.map(() => [] as string[]);
    for (let i = 0; i < 12; i++) {
      const keysToTry = [EN_SIGNS[i], EN_SIGNS[i].toLowerCase(), signsSanskrit[i], String(signsSanskrit[i])];
      let found: unknown = undefined;
      for (const k of keysToTry) {
        if (k in obj) {
          found = obj[k];
          break;
        }
      }
      const arr = Array.isArray(found) ? (found.filter((x) => typeof x === "string") as string[]) : [];
      out[i] = Array.from(new Set(arr));
    }
    return out;
  }

  return empty;
}


export function NorthIndianChart({ data, chartType = "rasi" }: NorthIndianChartProps) {
  const dataObj = data as unknown as Record<string, unknown>;
  const signsSanskrit: string[] = React.useMemo(() => {
    const s = dataObj["signs_sanskrit"];
    if (Array.isArray(s) && s.length >= 12) return s.map((x) => String(x));
    return DEFAULT_SIGN_NAMES;
  }, [dataObj]);

  const chart: string[][] = React.useMemo(() => {
    const raw = chartType === "navamsa" ? dataObj["navamsa_chart"] : dataObj["rasi_chart"];
    return normalizeRasiChart(raw, signsSanskrit);
  }, [dataObj, signsSanskrit, chartType]);

  const planetsMap = React.useMemo(() => {
    const planetsObj = dataObj["planets"];
    if (planetsObj && typeof planetsObj === "object" && !Array.isArray(planetsObj)) {
      return planetsObj as Record<string, unknown>;
    }
    return undefined;
  }, [dataObj]);

  const lagnaSignIndex = React.useMemo(() => {
    const lagna = dataObj["lagna"];
    if (lagna && typeof lagna === "object" && !Array.isArray(lagna)) {
      if (chartType === "navamsa") {
        const navamsaSignIndex = (lagna as Record<string, unknown>)["navamsa_sign_index"];
        return clampSignIndex(navamsaSignIndex);
      }
      const signIndex = (lagna as Record<string, unknown>)["sign_index"];
      return clampSignIndex(signIndex);
    }
    return 0;
  }, [dataObj, chartType]);

  const getHouseSignIndex = React.useCallback(
    (houseNumber: number): number => {
      // House 1 = Lagna sign, House 2 = Lagna+1, etc.
      // Signs progress anti-clockwise in North Indian layout as house number increases.
      const baseIndex = lagnaSignIndex;
      const step = houseNumber - 1;
      return (baseIndex + step + 12) % 12;
    },
    [lagnaSignIndex]
  );

  const getSignNumber = React.useCallback(
    (houseNumber: number): number => getHouseSignIndex(houseNumber) + 1,
    [getHouseSignIndex]
  );

  const getPlanetsInHouse = React.useCallback(
    (houseNumber: number): string[] => {
      const signIndex = getHouseSignIndex(houseNumber);
      return Array.from(new Set(chart[signIndex] ?? []));
    },
    [getHouseSignIndex, chart]
  );

  const renderHouseContent = (houseNumber: number) => {
    // Both Rasi and Navamsa charts keep the same house positions.
    const signNum = getSignNumber(houseNumber);
    const planets = getPlanetsInHouse(houseNumber);
    const radius = 26;
    const angleStep = planets.length > 0 ? (2 * Math.PI) / planets.length : 0;
    const startAngle = -Math.PI / 2;

    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="text-[11px] sm:text-sm font-bold leading-none text-white">{signNum}</div>
        </div>

        {planets.map((planet, idx) => {
          const planetInfo = PLANET_ICONS[planet];
          const angle = startAngle + idx * angleStep;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          // Rasi/Lagna-style: show full details with indicators
          const pData = planetsMap && (planetsMap[planet] && typeof planetsMap[planet] === "object" && !Array.isArray(planetsMap[planet]))
            ? (planetsMap[planet] as Record<string, unknown>)
            : undefined;

          const isRetro = chartType !== "navamsa" && Boolean(pData?.["retrograde"]);
          const isExalted = chartType !== "navamsa" && Boolean(pData?.["exalted"]);
          const isDebilitated = chartType !== "navamsa" && Boolean(pData?.["debilitated"]);
          const isVargottama = chartType !== "navamsa" && Boolean(pData?.["vargottama"]);
          const isCombust = chartType !== "navamsa" && Boolean(pData?.["combust"]);

          const indicators: Array<"retro" | "combust" | "vargottama" | "exalted" | "debilitated"> = [];
          if (isRetro) indicators.push("retro");
          if (isCombust) indicators.push("combust");
          if (isVargottama) indicators.push("vargottama");
          if (isExalted) indicators.push("exalted");
          if (isDebilitated) indicators.push("debilitated");

          const titleParts = [planet];
          if (isRetro) titleParts.push("Retrograde");
          if (isCombust) titleParts.push("Combust");
          if (isVargottama) titleParts.push("Vargottama");
          if (isExalted) titleParts.push("Exalted");
          if (isDebilitated) titleParts.push("Debilitated");

          return (
            <div
              key={`${planet}-${idx}`}
              className="absolute flex items-center"
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              title={titleParts.join(" | ")}
            >
              <span className="text-[10px] sm:text-[13px] md:text-[14px] font-bold leading-none" style={{ color: planetInfo?.color ?? "#fff" }}>
                {planetInfo?.icon ?? planet.slice(0, 2)}
              </span>
              {indicators.length > 0 && (
                <span className="ml-0.5 inline-flex items-center gap-0.5 text-[7.5px] sm:text-[10.5px] text-white leading-none align-top whitespace-nowrap">
                  {indicators.map((tag, i) => {
                    if (tag === "exalted") return <ArrowUpIcon key={`ex-${i}`} className="drop-shadow align-top -translate-y-1" />;
                    if (tag === "debilitated") return <ArrowDownIcon key={`de-${i}`} className="drop-shadow align-top -translate-y-1" />;
                    if (tag === "vargottama") return <SquareIcon key={`vg-${i}`} className="drop-shadow align-top -translate-y-1" />;
                    if (tag === "combust") return <span key={`cb-${i}`} className="align-top text-[10px] sm:text-[12px] -translate-y-0.5">^</span>;
                    if (tag === "retro") return <span key={`rt-${i}`} className="align-top text-[10px] sm:text-[12px] -translate-y-0.5">*</span>;
                    return null;
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-lg select-none">
            <svg viewBox="0 0 400 400" className="h-full w-full">
        <defs>
          <linearGradient id="chartBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1208" />
            <stop offset="100%" stopColor="#0b0704" />
          </linearGradient>
          <filter id="innerShadow">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="2" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="#000" floodOpacity="0.3" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        <rect x="5" y="5" width="390" height="390" fill="url(#chartBg)" stroke="#b45309" strokeOpacity="0.35" strokeWidth="2" rx="8" />
        <polygon points="200,5 395,200 200,395 5,200" fill="none" stroke="#d97706" strokeOpacity="0.32" strokeWidth="2" />
        <line x1="7" y1="7" x2="200" y2="200" stroke="#d97706" strokeOpacity="0.3" strokeWidth="2" />
        <line x1="393" y1="7" x2="200" y2="200" stroke="#d97706" strokeOpacity="0.3" strokeWidth="2" />
        <line x1="7" y1="393" x2="200" y2="200" stroke="#d97706" strokeOpacity="0.3" strokeWidth="2" />
        <line x1="393" y1="393" x2="200" y2="200" stroke="#d97706" strokeOpacity="0.3" strokeWidth="2" />
        {/* <circle cx="200" cy="200" r="35" fill="none" stroke="#8B5CF6" strokeWidth="1" opacity="0.3" />
        <text x="200" y="208" textAnchor="middle" fontSize="32" fill="#3d3255ff" opacity="0.8">
          ॐ
        </text> */}
      </svg>

      {/* North Indian Chart Layout - Anticlockwise from House 1 at top center */}
      {/* House 1 - Top Center (Lagna) */}
      <div className="absolute" style={{ top: "15%", left: "50%", transform: "translateX(-50%)", width: "24%", height: "22%" }}>
        {renderHouseContent(1)}
      </div>
      {/* House 2 - Top Left */}
      <div className="absolute" style={{ top: "2%", left: "14%", width: "22%", height: "22%" }}>
        {renderHouseContent(2)}
      </div>
      {/* House 12 - Top Right */}
      <div className="absolute" style={{ top: "2%", right: "14%", width: "22%", height: "22%" }}>
        {renderHouseContent(12)}
      </div>
      {/* House 3 - Left Top */}
      <div className="absolute" style={{ top: "16%", left: "0%", width: "20%", height: "20%" }}>
        {renderHouseContent(3)}
      </div>
      {/* House 11 - Right Top */}
      <div className="absolute" style={{ top: "16%", right: "0%", width: "20%", height: "20%" }}>
        {renderHouseContent(11)}
      </div>
      {/* House 4 - Left Center */}
      <div className="absolute" style={{ top: "50%", left: "14%", transform: "translateY(-50%)", width: "22%", height: "22%" }}>
        {renderHouseContent(4)}
      </div>
      {/* House 10 - Right Center */}
      <div className="absolute" style={{ top: "50%", right: "14%", transform: "translateY(-50%)", width: "22%", height: "22%" }}>
        {renderHouseContent(10)}
      </div>
      {/* House 5 - Left Bottom */}
      <div className="absolute" style={{ bottom: "14%", left: "0%", width: "20%", height: "20%" }}>
        {renderHouseContent(5)}
      </div>
      {/* House 9 - Right Bottom */}
      <div className="absolute" style={{ bottom: "14%", right: "0%", width: "20%", height: "20%" }}>
        {renderHouseContent(9)}
      </div>
      {/* House 6 - Bottom Left */}
      <div className="absolute" style={{ bottom: "2%", left: "14%", width: "22%", height: "22%" }}>
        {renderHouseContent(6)}
      </div>
      {/* House 8 - Bottom Right */}
      <div className="absolute" style={{ bottom: "2%", right: "14%", width: "22%", height: "22%" }}>
        {renderHouseContent(8)}
      </div>
      {/* House 7 - Bottom Center */}
      <div className="absolute" style={{ bottom: "12%", left: "50%", transform: "translateX(-50%)", width: "24%", height: "22%" }}>
        {renderHouseContent(7)}
      </div>
    </div>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Trash2, Save, FolderOpen, Check, AlertTriangle, Edit3, Calendar, X, MapPin, Clock3, Orbit, Sparkles } from 'lucide-react';
import { Header } from '@/components/Header';
import { NorthIndianChart } from '@/components/NorthIndianChart';
import { StrengthAnalysis } from '@/components/StrengthAnalysis';
import { RealtimeControls } from '@/components/RealtimeControls';
import { LoadChartsModal } from '@/components/LoadChartsModal';
import { KundaliMatcher } from '@/components/KundaliMatcher';
import { AstrovaSidebar, buildSystemPrompt } from '@/components/AstrovaSidebar';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ChartSkeleton } from '@/components/common/LoadingSkeleton';
import { SEOHead } from '@/components/common/SEOHead';
import { CreditsProvider, useCredits } from '@/contexts/CreditsContext';
import { calculateKundali, estimateTimezone } from '@/lib/vedic-engine';
import { CHART_CONSTANTS } from '@/constants';
import { getUserSavedCharts, saveChartToSupabase, deleteChartFromSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { KundaliRequest, KundaliResponse } from '@/types/kundali';

type SavedChart = {
  id: string;
  name: string;
  birthData: KundaliRequest;
  kundaliData: KundaliResponse;
  createdAt: string;
  locationName?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    timezone: number;
  };
};

const STORAGE_KEY = 'astrova_saved_charts';

function loadChartsFromStorage(): SavedChart[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChartsToStorage(charts: SavedChart[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
}


const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const UPAGRAHA_DISPLAY_ORDER = ['Dhuma', 'Vyatipata', 'Parivesha', 'Indrachapa', 'Upaketu', 'Kaala', 'Mrityu', 'ArthaPrahara', 'YamaGhantaka', 'Gulika', 'Mandi'];

function parseCalendarDate(dateStr: string): Date | null {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDashaDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = parseCalendarDate(dateStr);
    if (!d) return dateStr;
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return dateStr; }
}

function ChartPage() {
  const [kundaliData, setKundaliData] = useState<KundaliResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<KundaliRequest | null>(CHART_CONSTANTS.DEFAULT_REQUEST);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>(() => loadChartsFromStorage());
  const { astrovaUser } = useAuth();
  const astrovaUserId = astrovaUser?.id || '';

  const [selectedChartId, setSelectedChartId] = useState<string>('');
  const [currentChartName, setCurrentChartName] = useState<string>('');
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
  const [showLoadChartsModal, setShowLoadChartsModal] = useState(false);
  const [activeView, setActiveView] = useState<'kundali' | 'matcher'>('kundali');
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [saveButtonFlash, setSaveButtonFlash] = useState<'saved' | 'error' | null>(null);
  const [inlineSaveName, setInlineSaveName] = useState('');
  const [nameInputError, setNameInputError] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [matchData, setMatchData] = useState<{ chart1Name: string; chart2Name: string; chart1: KundaliResponse; chart2: KundaliResponse; scores: { category: string; score: number; maxScore: number; description: string }[] } | null>(null);
  const [matcherSaveError, setMatcherSaveError] = useState<string | null>(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const location = useLocation();
  const isAdmin = astrovaUser?.role === 'admin';

  // WF6: Auto-switch to matcher view when on /match route
  useEffect(() => {
    if (location.pathname === '/match' && activeView !== 'matcher') {
      setActiveView('matcher');
    }
  }, [location.pathname]);

  const skipNextLocationClearRef = useRef(false);
  const reverseGeocodeAbortRef = useRef<AbortController | null>(null);
  const reverseGeocodeTimeoutRef = useRef<number | null>(null);
  const lastRealtimeRequestRef = useRef<string>('');
  const lastRealtimeSuccessRef = useRef<string>('');
  const hasInitialLoaded = useRef(false);
  const saveFlashTimeoutRef = useRef<number | null>(null);
  const deleteToastTimeoutRef = useRef<number | null>(null);
  const matcherSaveTimeoutRef = useRef<number | null>(null);

  const flashSavedOnMainButton = () => {
    setSaveButtonFlash('saved');
    if (saveFlashTimeoutRef.current) {
      window.clearTimeout(saveFlashTimeoutRef.current);
    }
    saveFlashTimeoutRef.current = window.setTimeout(() => {
      setSaveButtonFlash(null);
      saveFlashTimeoutRef.current = null;
    }, 5000);
  };

  const flashErrorOnMainButton = () => {
    setSaveButtonFlash('error');
    if (saveFlashTimeoutRef.current) {
      window.clearTimeout(saveFlashTimeoutRef.current);
    }
    saveFlashTimeoutRef.current = window.setTimeout(() => {
      setSaveButtonFlash(null);
      saveFlashTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (saveFlashTimeoutRef.current) {
        window.clearTimeout(saveFlashTimeoutRef.current);
      }
      if (deleteToastTimeoutRef.current) {
        window.clearTimeout(deleteToastTimeoutRef.current);
      }
      if (matcherSaveTimeoutRef.current) {
        window.clearTimeout(matcherSaveTimeoutRef.current);
      }
      if (reverseGeocodeAbortRef.current) {
        reverseGeocodeAbortRef.current.abort();
      }
      if (reverseGeocodeTimeoutRef.current) {
        window.clearTimeout(reverseGeocodeTimeoutRef.current);
      }
    };
  }, []);

  const normalizeChartName = useCallback((name: string) => name.trim().toLowerCase(), []);

  const validateChartName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false as const, reason: 'empty' as const };
      }
      const normalized = normalizeChartName(trimmed);
      const duplicate = savedCharts.find((c) => normalizeChartName(c.name) === normalized);
      if (duplicate) {
        return { ok: false as const, reason: 'duplicate' as const };
      }
      return { ok: true as const, value: trimmed };
    },
    [normalizeChartName, savedCharts]
  );

  const actionButtonClass =
    'gap-1 border border-[hsl(220,8%,24%)] bg-[hsl(220,10%,10%)] text-white hover:bg-[hsl(220,10%,13%)] hover:border-[hsl(220,8%,30%)] transition-all duration-200 h-9 sm:h-8 px-3';
  const pageBannerClass =
    'relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(217,119,6,0.08),rgba(15,23,42,0.9))] p-5 sm:p-6';
  const summaryCardClass =
    'bg-gradient-to-br from-amber-500/12 to-yellow-600/8 rounded-xl p-4 border border-amber-500/30 shadow-[0_8px_18px_rgba(0,0,0,0.18)] min-h-0 sm:min-h-[242px]';

  // Reverse-geocode when we have coordinates but no location name
  useEffect(() => {
    if (activeView !== 'kundali') return;
    if (!currentRequest) return;
    if (!Number.isFinite(currentRequest.latitude) || !Number.isFinite(currentRequest.longitude)) return;
    if (currentLocationName.trim()) return;

    if (reverseGeocodeTimeoutRef.current) {
      window.clearTimeout(reverseGeocodeTimeoutRef.current);
    }

    reverseGeocodeTimeoutRef.current = window.setTimeout(async () => {
      try {
        if (reverseGeocodeAbortRef.current) {
          reverseGeocodeAbortRef.current.abort();
        }
        reverseGeocodeAbortRef.current = new AbortController();

        const lat = currentRequest.latitude;
        const lon = currentRequest.longitude;

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
          { signal: reverseGeocodeAbortRef.current.signal }
        );
        if (!response.ok) return;

        const data = await response.json();
        const city = data?.address?.city || data?.address?.town || data?.address?.village || '';
        const country = data?.address?.country || '';
        const name = city && country ? `${city}, ${country}` : city || data?.display_name?.split(',')[0] || '';

        if (name) setCurrentLocationName(name);
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          // ignore
        }
      }
    }, 600);

    return () => {
      if (reverseGeocodeTimeoutRef.current) {
        window.clearTimeout(reverseGeocodeTimeoutRef.current);
      }
    };
  }, [activeView, currentRequest, currentLocationName]);

  // Client-side kundali generation
  const generateKundali = useCallback((request: KundaliRequest): KundaliResponse => {
    return calculateKundali(request);
  }, []);

  // Sync charts from Supabase on login
  useEffect(() => {
    if (!astrovaUserId) return;
    (async () => {
      try {
        const remoteCharts = await getUserSavedCharts(astrovaUserId) as Array<{
          id: string; name: string; birth_data: KundaliRequest;
          kundali_data?: KundaliResponse; location_name?: string;
          coordinates?: { latitude: number; longitude: number; timezone: number };
          created_at?: string;
        }>;
        if (remoteCharts.length > 0) {
          const mapped: SavedChart[] = remoteCharts.map(c => ({
            id: c.id,
            name: c.name,
            birthData: c.birth_data,
            kundaliData: c.kundali_data || generateKundali(c.birth_data),
            createdAt: c.created_at || new Date().toISOString(),
            locationName: c.location_name,
            coordinates: c.coordinates,
          }));
          setSavedCharts(mapped);
          saveChartsToStorage(mapped);
        }
      } catch { /* fallback to localStorage */ }
    })();
  }, [astrovaUserId, generateKundali]);

  const handleSubmit = useCallback((request: KundaliRequest) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setMatchData(null);
    setNameInputError(false);
    try {
      const result = generateKundali(request);
      setKundaliData(result);
      setCurrentRequest(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate kundali');
    } finally {
      setIsLoading(false);
    }
  }, [generateKundali, isLoading]);

  const handleManualGenerate = useCallback(() => {
    if (!currentRequest) return;
    if (isLoading) return;
    handleSubmit(currentRequest);
  }, [currentRequest, handleSubmit, isLoading]);

  const handleRealtimeChange = useCallback((data: KundaliRequest) => {
    const dataKey = JSON.stringify(data);
    if (lastRealtimeSuccessRef.current === dataKey && kundaliData) return;
    lastRealtimeRequestRef.current = dataKey;

    setMatchData(null);

    if (
      !currentRequest ||
      Math.abs((currentRequest.latitude ?? 0) - (data.latitude ?? 0)) > 0.0001 ||
      Math.abs((currentRequest.longitude ?? 0) - (data.longitude ?? 0)) > 0.0001
    ) {
      if (skipNextLocationClearRef.current) {
        skipNextLocationClearRef.current = false;
      } else {
        setCurrentLocationName('');
      }
    }
    setCurrentRequest(data);

    try {
      const result = generateKundali(data);
      setKundaliData(result);
      lastRealtimeSuccessRef.current = dataKey;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate kundali');
    }
  }, [kundaliData, currentRequest, generateKundali]);

  // Generate initial chart on mount
  useEffect(() => {
    if (!hasInitialLoaded.current && currentRequest) {
      hasInitialLoaded.current = true;
      handleRealtimeChange(currentRequest);
    }
  }, [currentRequest, handleRealtimeChange]);

  const handleLoadCharts = () => {
    setShowLoadChartsModal(true);
  };

  // Save chart to localStorage
  const saveNewChart = useCallback((payload: {
    name: string;
    birthData: KundaliRequest;
    locationName?: string;
  }) => {
    const charts = loadChartsFromStorage();
    const normalized = payload.name.trim().toLowerCase();
    if (charts.find(c => c.name.trim().toLowerCase() === normalized)) {
      throw new Error('A chart with this name already exists');
    }

    const kundali = generateKundali(payload.birthData);
    const newChart: SavedChart = {
      id: Date.now().toString(),
      name: payload.name,
      birthData: payload.birthData,
      kundaliData: kundali,
      createdAt: new Date().toISOString(),
      locationName: payload.locationName,
      coordinates: {
        latitude: payload.birthData.latitude,
        longitude: payload.birthData.longitude,
        timezone: payload.birthData.tz_offset_hours,
      },
    };

    const updated = [...charts, newChart];
    saveChartsToStorage(updated);
    setSavedCharts(updated);
    setSelectedChartId(newChart.id);
    setCurrentChartName(newChart.name);

    // Sync to Supabase
    if (astrovaUserId) {
      saveChartToSupabase(astrovaUserId, {
        name: payload.name,
        birth_data: payload.birthData,
        kundali_data: kundali,
        location_name: payload.locationName,
        coordinates: {
          latitude: payload.birthData.latitude,
          longitude: payload.birthData.longitude,
          timezone: payload.birthData.tz_offset_hours,
        },
      }).then(result => {
        if (result && typeof result === 'object' && 'id' in result) {
          // Update local chart with Supabase ID for future sync
          const supaId = (result as { id: string }).id;
          setSavedCharts(prev => prev.map(c => c.id === newChart.id ? { ...c, id: supaId } : c));
          setSelectedChartId(supaId);
          const updatedWithId = updated.map(c => c.id === newChart.id ? { ...c, id: supaId } : c);
          saveChartsToStorage(updatedWithId);
        }
      }).catch(() => { /* localStorage is the fallback */ });
    }
  }, [generateKundali, astrovaUserId]);

  const handleSaveChart = useCallback(() => {
    if (!kundaliData || !currentRequest) return;

    const validation = validateChartName(inlineSaveName);
    if (!validation.ok) {
      setNameInputError(true);
      flashErrorOnMainButton();
      return;
    }

    try {
      saveNewChart({
        name: validation.value,
        birthData: currentRequest,
        locationName: currentLocationName.trim() || undefined,
      });
      flashSavedOnMainButton();
      setInlineSaveName('');
      setNameInputError(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save chart';
      setError(message);
      if (message.toLowerCase().includes('already exists')) {
        setNameInputError(true);
      }
      flashErrorOnMainButton();
    }
  }, [currentLocationName, currentRequest, inlineSaveName, kundaliData, saveNewChart, validateChartName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!isEditingName && !isLoading && kundaliData && currentRequest) {
          handleSaveChart();
        }
      }
      if (event.key === 'Escape' && showModelInfo) {
        setShowModelInfo(false);
      }
      if (event.key === 'Escape' && deleteConfirmation) {
        setDeleteConfirmation(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentRequest, deleteConfirmation, handleSaveChart, isEditingName, isLoading, kundaliData, showModelInfo]);

  const handleLoadChart = (chartId: string) => {
    const chart = savedCharts.find(c => c.id === chartId);
    if (chart) {
      const restoredRequest = {
        ...chart.birthData,
        latitude: chart.coordinates?.latitude ?? chart.birthData.latitude,
        longitude: chart.coordinates?.longitude ?? chart.birthData.longitude,
        tz_offset_hours: chart.coordinates?.timezone ?? chart.birthData.tz_offset_hours,
      };
      setCurrentRequest(restoredRequest);
      setError(null);
      const hasExplicitCoords =
        typeof chart.coordinates?.latitude === 'number' &&
        typeof chart.coordinates?.longitude === 'number';
      setCurrentLocationName(hasExplicitCoords ? (chart.locationName || '') : '');
      setCurrentChartName(chart.name);
      setSelectedChartId(chartId);
      setIsEditingName(false);
      setInlineSaveName('');
      setNameInputError(false);
      setShowLoadChartsModal(false);
      setRealtimeEnabled(false);

      try {
        const result = generateKundali(restoredRequest);
        setKundaliData(result);
      } catch {
        setKundaliData(chart.kundaliData);
      }
    }
  };

  const deleteChartFromStorageFn = (chartId: string) => {
    const charts = loadChartsFromStorage().filter(c => c.id !== chartId);
    saveChartsToStorage(charts);
    setSavedCharts(charts);
    if (selectedChartId === chartId) {
      setSelectedChartId('');
      setCurrentChartName('');
      setInlineSaveName('');
      setNameInputError(false);
      setIsEditingName(false);
    }
    // Sync delete to Supabase
    if (astrovaUserId) {
      deleteChartFromSupabase(chartId).catch(() => {});
    }
  };

  const handleDeleteChart = (chartId: string) => {
    const chart = savedCharts.find(c => c.id === chartId);
    deleteChartFromStorageFn(chartId);
    setDeleteConfirmation(false);
    setDeleteToast(`Deleted "${chart?.name || 'chart'}"`);
    if (deleteToastTimeoutRef.current) {
      window.clearTimeout(deleteToastTimeoutRef.current);
    }
    deleteToastTimeoutRef.current = window.setTimeout(() => {
      setDeleteToast(null);
      deleteToastTimeoutRef.current = null;
    }, 3000);
  };

  return (
    <ErrorBoundary>
      <SEOHead />
      <AuthGuard>
        <CreditsProvider>
          <div className="min-h-screen flex flex-col bg-[hsl(220,10%,6%)]">
          {/* Background gradient */}
          <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.06),transparent)] pointer-events-none" />
          <div className="fixed inset-0 bg-[radial-gradient(circle_at_10%_30%,rgba(16,185,129,0.08),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(245,158,11,0.07),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.06),transparent_45%)] pointer-events-none" />

          <Header
            activeView={activeView}
            onViewChange={(v) => {
              const nextView = v as 'kundali' | 'matcher';
              setActiveView(nextView);
              if (nextView === 'kundali') {
                setMatchData(null);
              }
            }}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
            onOpenModelInfo={() => setShowModelInfo(true)}
          />

          {/* Main layout with sidebar */}
          <div className="flex-1 flex relative">
            {/* Main content area */}
            <main className={`flex-1 min-w-0 py-4 sm:py-8 px-3 sm:px-4 relative transition-all duration-300 ${sidebarOpen ? 'lg:mr-[420px]' : ''}`} aria-label="Chart page main content">
              <div className="max-w-7xl mx-auto">
                {error && (
                  <div role="alert" className="max-w-2xl mx-auto mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                    <button onClick={() => setError(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/10 transition-colors shrink-0" aria-label="Dismiss error">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="space-y-6 sm:space-y-8">
                  {activeView === 'kundali' ? (
                    <>
                      {/* Intro Banner */}
                      <div className="max-w-6xl mx-auto">
                        <div className={pageBannerClass}>
                          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
                          <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />
                          <div className="relative">
                            <div className="flex items-center justify-center gap-3 mb-2">
                              <Sparkles className="w-6 h-6 text-amber-300" />
                              <h2 className="text-2xl font-bold text-white">Birth Chart Analysis</h2>
                              <Sparkles className="w-6 h-6 text-amber-300" />
                            </div>
                            <p className="text-sm text-neutral-300 text-center">Generate your Vedic birth chart — all calculations run locally</p>
                            <p className="text-neutral-400 text-sm text-center mt-1 hidden sm:block">Date, time and location powered by precision Vedic calculations</p>
                            <p className="text-[11px] text-neutral-500 text-center mt-2 hidden sm:block">Fill the birth form below, then generate your chart.</p>
                          </div>
                        </div>
                      </div>
                      {currentRequest && (
                        <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
                          {/* Birth Details Section */}
                          <div className="bg-[linear-gradient(160deg,rgba(15,23,42,0.9),rgba(17,24,39,0.85))] rounded-2xl sm:rounded-3xl border border-[hsl(220,8%,18%)] shadow-[0_12px_30px_rgba(0,0,0,0.3)] max-w-6xl mx-auto">
                            {/* Header with controls */}
                            <div className="flex flex-col gap-3 px-4 sm:px-6 py-3.5 sm:py-4.5 bg-[linear-gradient(120deg,rgba(17,24,39,0.9),rgba(15,23,42,0.85))] border-b border-[hsl(220,8%,18%)] rounded-t-2xl sm:rounded-t-3xl">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner shadow-amber-500/20">
                                    <Calendar className="w-4 h-4 text-amber-300" />
                                  </div>
                                  <div>
                                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Birth Details</h3>
                                    <p className="hidden sm:block text-xs text-neutral-400 mt-0.5">Enter date, time, and location to generate your chart</p>
                                  </div>
                                </div>

                                {/* Chart name, edit, save/delete - right aligned */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Chart name and pen */}
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {!isEditingName ? (
                                      <>
                                        <div className="min-w-0">
                                          {nameInputError ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/25 border border-yellow-500/40 text-yellow-200 rounded-lg text-xs font-medium animate-pulse h-9 sm:h-8" style={{ animationDuration: '2.5s' }}>
                                              <AlertTriangle className="w-3 h-3 shrink-0" />
                                              <span className="truncate">{!inlineSaveName.trim() ? 'Enter a name' : 'Name exists'}</span>
                                            </div>
                                          ) : inlineSaveName ? (
                                            <button
                                              type="button"
                                              className="block w-full text-left truncate px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-white font-medium cursor-pointer hover:border-neutral-700 transition-colors text-xs h-9 sm:h-8"
                                              onClick={() => { setIsEditingName(true); setNameInputError(false); }}
                                              title={inlineSaveName}
                                              aria-label="Edit unsaved chart name"
                                            >
                                              {inlineSaveName}
                                            </button>
                                          ) : currentChartName ? (
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-1.5 truncate px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-md text-xs font-medium cursor-pointer hover:bg-amber-500/25 transition-colors h-9 sm:h-8"
                                              onClick={() => { setIsEditingName(true); setNameInputError(false); }}
                                              title={currentChartName}
                                              aria-label="Edit current chart name"
                                            >
                                              {selectedChartId && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                                              <span className="truncate">{currentChartName}</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              className="block w-full text-left truncate px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-neutral-500 italic text-xs cursor-pointer hover:border-neutral-700 transition-colors h-9 sm:h-8"
                                              onClick={() => { setIsEditingName(true); setNameInputError(false); }}
                                              aria-label="Add chart name"
                                            >
                                              Untitled
                                            </button>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => { setIsEditingName(true); setNameInputError(false); }}
                                          className="shrink-0 h-9 w-9 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all"
                                          title="Edit chart name"
                                          aria-label="Edit chart name"
                                        >
                                          <Edit3 className="w-3 h-3 text-white/60" />
                                        </button>
                                      </>
                                    ) : (
                                      <input
                                        type="text"
                                        value={inlineSaveName}
                                        onChange={(e) => {
                                          setInlineSaveName(e.target.value);
                                          const validation = validateChartName(e.target.value);
                                          setNameInputError(!validation.ok);
                                        }}
                                        onBlur={() => setIsEditingName(false)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            setIsEditingName(false);
                                            if (!nameInputError && inlineSaveName.trim()) {
                                              handleSaveChart();
                                            }
                                          }
                                        }}
                                        placeholder="Chart name..."
                                        maxLength={42}
                                        aria-label="Chart name"
                                        className={`min-w-0 w-full px-2.5 py-1 bg-neutral-900/50 border rounded-lg text-xs font-medium focus:outline-none transition-all h-9 sm:h-8 ${
                                          nameInputError
                                            ? 'border-yellow-500/50 text-yellow-200 placeholder-yellow-200/50 bg-yellow-500/10'
                                            : 'border-neutral-700/60 text-white placeholder-white/40 focus:border-neutral-600/80'
                                        }`}
                                        autoFocus
                                      />
                                    )}
                                  </div>

                                  {/* Save and Delete buttons */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Save button */}
                                    <Button
                                      variant="outline" size="sm" onClick={handleSaveChart}
                                      disabled={!kundaliData || !currentRequest || isLoading}
                                      className={`${actionButtonClass} px-3 h-9 sm:h-8 ${(!kundaliData || !currentRequest) ? 'opacity-50 pointer-events-none' : ''} ${
                                        saveButtonFlash === 'saved' ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 animate-pulse' :
                                        saveButtonFlash === 'error' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200 animate-pulse' : ''
                                      }`}
                                      title={saveButtonFlash === 'saved' ? 'Saved' : 'Save chart'}
                                      aria-label={saveButtonFlash === 'saved' ? 'Saved chart' : 'Save chart'}
                                    >
                                      {saveButtonFlash === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                      <span className="text-xs ml-1 hidden md:inline">{saveButtonFlash === 'saved' ? 'Saved' : 'Save'}</span>
                                    </Button>

                                    {/* Delete button */}
                                    {selectedChartId ? (
                                      deleteConfirmation ? (
                                        <div className="flex items-center gap-1">
                                          <Button variant="outline" size="sm" onClick={() => handleDeleteChart(selectedChartId)}
                                            className="bg-red-500/20 border-red-500/50 text-red-200 hover:bg-red-500/30 h-9 sm:h-8 px-3 text-xs"
                                            aria-label="Confirm delete chart">
                                            <Trash2 className="w-4 h-4" />
                                            <span className="ml-1 hidden md:inline">Confirm?</span>
                                          </Button>
                                          <Button variant="outline" size="sm" onClick={() => setDeleteConfirmation(false)} className={`${actionButtonClass} h-9 w-9 sm:h-8 sm:w-8 p-0`} aria-label="Cancel delete chart">
                                            <X className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button variant="outline" size="sm" onClick={() => setDeleteConfirmation(true)} className={`${actionButtonClass} px-3 h-9 sm:h-8`} title="Delete chart" aria-label="Delete chart">
                                          <Trash2 className="w-4 h-4" />
                                          <span className="text-xs ml-1 hidden md:inline">Delete</span>
                                        </Button>
                                      )
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2 w-full">
                                {/* Other controls below, right-aligned */}
                                <div className="flex flex-col gap-2 w-full">
                                  {/* Controls on bottom/right - always right aligned */}
                                  <div className="flex items-center justify-between w-full gap-1.5">
                                    {/* Shortcut text hidden on mobile, shown on larger screens */}
                                    <p className="text-[10px] text-neutral-500 px-1 hidden lg:block text-left">Shortcut: Ctrl/Cmd + S to save • Esc to cancel delete</p>
                                    
                                    {/* Buttons */}
                                    <div className="flex items-center gap-1.5">
                                      {/* Saved Charts button */}
                                      <Button
                                        variant="outline" size="sm" onClick={handleLoadCharts} className={`${actionButtonClass} px-3 h-9 sm:h-8 flex-shrink-0`} aria-label="Open saved charts modal">
                                        <FolderOpen className="w-4 h-4" />
                                        <span className="text-xs ml-1">Saved</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/30 border border-white/10 ml-1">{savedCharts.length}</span>
                                      </Button>

                                      {/* Auto toggle */}
                                      <label className="flex items-center justify-start gap-1.5 cursor-pointer h-9 sm:h-8 px-3 rounded-lg bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,20%)] flex-shrink-0">
                                        <span className="text-xs text-neutral-400">Auto</span>
                                        <div className="relative">
                                          <input
                                            type="checkbox"
                                            checked={realtimeEnabled}
                                            onChange={(e) => setRealtimeEnabled(e.target.checked)}
                                            className="sr-only"
                                            aria-label="Toggle auto update"
                                            aria-pressed={realtimeEnabled}
                                          />
                                          <div className={`w-10 h-5 sm:w-8 sm:h-4 rounded-full transition-colors ${realtimeEnabled ? 'bg-amber-400' : 'bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,22%)]'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 sm:w-3 sm:h-3 rounded-full shadow transition-transform ${realtimeEnabled ? 'translate-x-5 sm:translate-x-4 bg-[hsl(220,10%,8%)]' : 'bg-neutral-400'}`} />
                                          </div>
                                        </div>
                                      </label>

                                      {/* Generate Chart button - longer with better disabled UI */}
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleManualGenerate}
                                        disabled={realtimeEnabled || !currentRequest || isLoading}
                                        aria-label={realtimeEnabled ? 'Chart automatically generated' : (isLoading ? 'Generating chart' : 'Generate chart')}
                                        className={`h-9 sm:h-8 px-4 sm:px-6 min-w-[120px] sm:min-w-[200px] transition-all duration-200 flex-shrink-0 ${
                                          realtimeEnabled 
                                            ? 'bg-neutral-600/30 border-neutral-600/50 text-neutral-400 cursor-not-allowed' 
                                            : (!currentRequest || isLoading)
                                              ? 'bg-amber-400/50 border-amber-400/30 text-black/40 cursor-not-allowed'
                                              : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-black hover:shadow-lg hover:shadow-amber-400/20'
                                        }`}
                                      >
                                        <span className="text-xs font-semibold">
                                          {realtimeEnabled ? 'Auto' : (isLoading ? 'Generating...' : 'Generate')}
                                        </span>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 sm:p-4">
                              <div className="rounded-xl border border-[hsl(220,8%,20%)] bg-[hsl(220,10%,9%)] p-2 sm:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                <RealtimeControls
                                  data={currentRequest}
                                  onChange={(data) => {
                                    if (selectedChartId) {
                                      setSelectedChartId('');
                                      setCurrentChartName('');
                                    }
                                    setCurrentRequest(data);
                                    if (realtimeEnabled) {
                                      handleRealtimeChange(data);
                                    }
                                  }}
                                  showHeader={false}
                                  showLocation={true}
                                  compact={true}
                                  locationName={currentLocationName}
                                  onLocationNameChange={(name) => {
                                    skipNextLocationClearRef.current = true;
                                    setCurrentLocationName(name);
                                  }}
                                  showSliders={realtimeEnabled}
                                  onGenerate={() => currentRequest && handleSubmit(currentRequest)}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Loading skeleton below form */}
                          {isLoading && (
                            <div className="max-w-2xl mx-auto" role="status" aria-live="polite" aria-label="Generating chart">
                              <ChartSkeleton />
                            </div>
                          )}

                          {/* Charts */}
                          {kundaliData && currentRequest && (
                            <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                <div className="bg-[linear-gradient(160deg,rgba(15,23,42,0.92),rgba(30,41,59,0.7))] rounded-lg sm:rounded-xl p-3 sm:p-4 border border-[hsl(220,8%,18%)] hover:border-amber-500/30 transition-colors flex flex-col shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
                                  <div className="flex-1 flex items-center justify-center">
                                    <NorthIndianChart data={kundaliData} chartType="rasi" />
                                  </div>
                                  <h3 className="text-sm sm:text-base font-medium text-center mt-2 sm:mt-3 text-white">Lagna (D1)</h3>
                                </div>

                                <div className="bg-[linear-gradient(160deg,rgba(15,23,42,0.92),rgba(30,41,59,0.7))] rounded-lg sm:rounded-xl p-3 sm:p-4 border border-[hsl(220,8%,18%)] hover:border-amber-500/30 transition-colors flex flex-col shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
                                  <div className="flex-1 flex items-center justify-center">
                                    <NorthIndianChart data={kundaliData} chartType="navamsa" />
                                  </div>
                                  <h3 className="text-sm sm:text-base font-medium text-center mt-2 sm:mt-3 text-white">Navamsa (D9)</h3>
                                </div>
                              </div>
                              
                              {/* Ascendant & Dasha Info */}
                              <div className="max-w-6xl mx-auto rounded-2xl border border-amber-500/20 bg-[linear-gradient(145deg,rgba(245,158,11,0.08),rgba(30,41,59,0.52))] p-3 sm:p-4 shadow-[0_12px_26px_rgba(0,0,0,0.22)]">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 place-items-stretch">
                                {/* Ascendant Card */}
                                <div className={summaryCardClass}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-amber-500/30 flex items-center justify-center">
                                      <span className="text-amber-300 text-sm font-bold">↑</span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-white">Ascendant (Lagna)</h4>
                                  </div>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-white">{kundaliData.lagna.sign}</span>
                                    <span className="text-sm text-amber-300">{kundaliData.lagna.sign_sanskrit}</span>
                                  </div>
                                  <div className="text-xs text-neutral-400 mt-1">
                                    {kundaliData.lagna.deg}°{kundaliData.lagna.min}'{kundaliData.lagna.sec}"
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-amber-500/20">
                                    <div className="text-xs"><span className="text-neutral-500">Moon:</span> <span className="text-white font-medium">{kundaliData.planets.Moon?.sign || '—'}</span></div>
                                    <div className="text-xs"><span className="text-neutral-500">Sun:</span> <span className="text-white font-medium">{kundaliData.planets.Sun?.sign || '—'}</span></div>
                                    <div className="text-xs"><span className="text-neutral-500">Nakshatra:</span> <span className="text-amber-300 font-medium">{kundaliData.planets.Moon?.nakshatra || kundaliData.dasha?.moon_nakshatra_name || '—'}</span></div>
                                    <div className="text-xs"><span className="text-neutral-500">Pada:</span> <span className="text-white font-medium">{kundaliData.planets.Moon?.nakshatra_pada || kundaliData.dasha?.moon_nakshatra_pada || '—'}</span></div>
                                  </div>
                                </div>

                                {/* Upagraha Card */}
                                <div className={summaryCardClass}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-6 h-6 rounded-lg bg-amber-500/30 flex items-center justify-center">
                                        <Orbit className="w-3.5 h-3.5 text-amber-100" />
                                      </div>
                                      <h4 className="text-sm font-semibold text-white">Upagrahas (BPHS)</h4>
                                    </div>
                                    {kundaliData.upagrahas && Object.keys(kundaliData.upagrahas).length > 0 ? (
                                      <div className="space-y-1.5 max-h-[180px] sm:max-h-[212px] overflow-y-auto pr-1 custom-scrollbar">
                                        {UPAGRAHA_DISPLAY_ORDER.filter((name) => Boolean(kundaliData.upagrahas[name])).map((name) => {
                                          const upa = kundaliData.upagrahas[name];
                                          return (
                                            <div key={name} className="flex items-center justify-between text-xs rounded-md px-2 py-1 bg-amber-500/5 border border-amber-500/15">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-amber-300 font-medium">{upa?.symbol || name.slice(0, 2)}</span>
                                                <span className="text-white">{name}</span>
                                              </div>
                                              <span className="text-amber-100/90">{upa?.sign} {upa?.deg}°{upa?.min}'</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="h-[180px] sm:h-[212px] rounded-lg border border-amber-500/20 bg-amber-500/5 text-neutral-400 text-xs flex items-center justify-center text-center px-3">
                                        No upagraha data for this chart.
                                      </div>
                                    )}
                                  </div>
                                
                                {/* Current Dasha Card */}
                                {kundaliData.dasha && (() => {
                                  const currentPeriod = kundaliData.dasha.periods.find(p => p.is_current);
                                  const now = new Date();
                                  const currentAD = currentPeriod?.antardashas?.find(ad => {
                                    const start = new Date(ad.start_datetime || ad.start_date);
                                    const end = ad.end_datetime ? new Date(ad.end_datetime) : new Date(ad.end_date || '');
                                    return now >= start && now < end;
                                  });
                                  const currentPAD = currentAD?.pratyantardashas?.find(pad => {
                                    const start = new Date(pad.start_datetime || pad.start_date);
                                    const end = pad.end_datetime ? new Date(pad.end_datetime) : new Date(pad.end_date || '');
                                    return now >= start && now < end;
                                  });
                                  
                                  return (
                                    <div className={summaryCardClass}>
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-amber-500/30 flex items-center justify-center">
                                          <span className="text-amber-300 text-xs font-bold">D</span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-white">Vimshottari Dasha</h4>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        {/* Mahadasha */}
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Mahadasha</span>
                                            <div className="text-lg font-bold text-white">{kundaliData.dasha.current_dasha}</div>
                                          </div>
                                          <div className="text-right text-[10px] text-amber-300/70 space-y-0.5">
                                            <div><span className="text-neutral-500">Start:</span> {formatDashaDate(currentPeriod?.start_date)}</div>
                                            <div><span className="text-neutral-500">End:</span> {formatDashaDate(currentPeriod?.end_date)}</div>
                                          </div>
                                        </div>
                                        
                                        {/* Antardasha */}
                                        {currentAD && (
                                          <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                                            <div>
                                              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Antardasha</span>
                                              <div className="text-base font-semibold text-amber-200">{currentAD.planet}</div>
                                            </div>
                                            <div className="text-right text-[10px] text-amber-300/60 space-y-0.5">
                                              <div><span className="text-neutral-500">Start:</span> {formatDashaDate(currentAD.start_date)}</div>
                                              <div><span className="text-neutral-500">End:</span> {formatDashaDate(currentAD.end_date)}</div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Pratyantardasha */}
                                        {currentPAD && (
                                          <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                                            <div>
                                              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Pratyantardasha</span>
                                              <div className="text-sm font-medium text-amber-300">{currentPAD.planet}</div>
                                            </div>
                                            <div className="text-right text-[10px] text-amber-300/50 space-y-0.5">
                                              <div><span className="text-neutral-500">Start:</span> {formatDashaDate(currentPAD.start_date)}</div>
                                              <div><span className="text-neutral-500">End:</span> {formatDashaDate(currentPAD.end_date)}</div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Nakshatra info */}
                                        <div className="pt-2 border-t border-amber-500/20 text-xs text-neutral-400">
                                          Moon in {kundaliData.dasha.moon_nakshatra_name} (Pada {kundaliData.dasha.moon_nakshatra_pada})
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!currentRequest && (
                        <div className="bg-[hsl(220,10%,8%)]/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-[hsl(220,8%,18%)] flex flex-col max-w-6xl mx-auto">
                          <h2 className="text-base sm:text-xl font-medium text-center mb-3 sm:mb-4 text-white">North Indian Chart</h2>
                          <div className="flex-1 flex items-center justify-center py-8">
                            <div className="text-neutral-400 text-sm">Generate birth chart to view chart</div>
                          </div>
                        </div>
                      )}

                      {kundaliData && (
                        <div className="max-w-6xl mx-auto">
                          <div className="rounded-2xl p-4 sm:p-5 border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(249,115,22,0.08),rgba(15,23,42,0.92))] shadow-[0_10px_25px_rgba(0,0,0,0.25)]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.12em] text-amber-300/80">Birth Chart Analysis</p>
                                <p className="text-white font-semibold text-sm sm:text-base mt-0.5">{kundaliData.birth.date} • {kundaliData.birth.time}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end text-xs">
                                <span className="px-2.5 py-1 rounded-md bg-black/25 border border-white/10 text-neutral-200 inline-flex items-center gap-1.5"><Clock3 className="w-3 h-3" />TZ {kundaliData.birth.tz_offset_hours}h</span>
                                {kundaliData.birth.dst_applied && (
                                  <span className="px-2 py-1 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 font-medium">
                                    DST +{kundaliData.birth.dst_adjustment_hours}h
                                  </span>
                                )}
                                <span className="px-2.5 py-1 rounded-md bg-black/25 border border-white/10 text-neutral-300 inline-flex items-center gap-1.5"><MapPin className="w-3 h-3" />Lat {kundaliData.birth.latitude.toFixed(2)}°</span>
                                <span className="px-2.5 py-1 rounded-md bg-black/25 border border-white/10 text-neutral-300">Lon {kundaliData.birth.longitude.toFixed(2)}°</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {kundaliData && (
                        <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
                          <div className="rounded-2xl border border-[hsl(220,8%,16%)] bg-[linear-gradient(150deg,rgba(15,23,42,0.84),rgba(30,41,59,0.52))] p-2 sm:p-3 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
                            <StrengthAnalysis
                              shadBala={kundaliData.shad_bala}
                              bhavaBala={kundaliData.bhava_bala}
                              ashtakavarga={kundaliData.ashtakavarga}
                              planets={kundaliData.planets}
                              upagrahas={kundaliData.upagrahas}
                              lagna={kundaliData.lagna}
                              dashaData={kundaliData.dasha}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : activeView === 'matcher' ? (
                    <KundaliMatcher
                      savedCharts={savedCharts}
                      onDeleteChart={deleteChartFromStorageFn}
                      onMatchComplete={(data) => {
                        setMatchData({
                          chart1Name: data.chart1Name,
                          chart2Name: data.chart2Name,
                          chart1: data.chart1,
                          chart2: data.chart2,
                          scores: data.scores.map(s => ({ category: s.category, score: s.score, maxScore: s.maxScore, description: s.description })),
                        });
                      }}
                      onSaveChart={async (name, birthData, locationName) => {
                        if (!name || !name.trim()) {
                          setMatcherSaveError('Please enter a name before saving.');
                          if (matcherSaveTimeoutRef.current) {
                            window.clearTimeout(matcherSaveTimeoutRef.current);
                          }
                          matcherSaveTimeoutRef.current = window.setTimeout(() => {
                            setMatcherSaveError(null);
                            matcherSaveTimeoutRef.current = null;
                          }, 3000);
                          return;
                        }
                        const normalized = name.trim().toLowerCase();
                        if (savedCharts.find(c => c.name.trim().toLowerCase() === normalized)) {
                          setMatcherSaveError(`A chart named "${name.trim()}" already exists.`);
                          if (matcherSaveTimeoutRef.current) {
                            window.clearTimeout(matcherSaveTimeoutRef.current);
                          }
                          matcherSaveTimeoutRef.current = window.setTimeout(() => {
                            setMatcherSaveError(null);
                            matcherSaveTimeoutRef.current = null;
                          }, 3000);
                          return;
                        }
                        const kundali = calculateKundali(birthData);
                        const id = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        const newChart: SavedChart = {
                          id,
                          name,
                          birthData,
                          kundaliData: kundali,
                          createdAt: new Date().toISOString(),
                          locationName,
                          coordinates: { latitude: birthData.latitude, longitude: birthData.longitude, timezone: birthData.tz_offset_hours },
                        };
                        setSavedCharts(prev => {
                          const next = [...prev, newChart];
                          saveChartsToStorage(next);
                          return next;
                        });
                        if (astrovaUserId) {
                          saveChartToSupabase(astrovaUserId, {
                            name,
                            birth_data: birthData,
                            kundali_data: kundali,
                            location_name: locationName,
                            coordinates: { latitude: birthData.latitude, longitude: birthData.longitude, timezone: birthData.tz_offset_hours },
                          });
                        }
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </main>

            {/* Single backdrop for sidebar */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-30 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Astrova AI Sidebar - below navbar */}
            <div className={`fixed top-14 bottom-0 right-0 w-full sm:w-[380px] lg:w-[420px] z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <AstrovaSidebar
                kundaliData={kundaliData}
                chartName={currentChartName || undefined}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                onGenerateChart={(data) => {
                  const [y, m, d] = data.date.split('-').map(Number);
                  const timeParts = data.time.replace(/\s*[AaPp][Mm]/i, '').split(':').map(Number);
                  const tz = estimateTimezone(data.lon);
                  const req: KundaliRequest = {
                    year: y, month: m, day: d,
                    hour: timeParts[0] || 0, minute: timeParts[1] || 0, second: timeParts[2] || 0,
                    latitude: data.lat, longitude: data.lon,
                    tz_offset_hours: tz, ayanamsha: 'lahiri',
                  };
                  setCurrentRequest(req);
                  handleSubmit(req);
                  if (data.name) { setInlineSaveName(data.name); setCurrentChartName(''); }
                }}
                matchData={matchData}
              />
            </div>

            {showModelInfo && isAdmin && (
              <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-3 sm:p-6">
                <div role="dialog" aria-modal="true" aria-label="Model context" className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-[hsl(220,8%,18%)] bg-[hsl(220,10%,7%)]" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,8%,16%)]">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Model Context (Current Session)</h3>
                    <button
                      type="button"
                      onClick={() => setShowModelInfo(false)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[hsl(220,10%,10%)]"
                      title="Close"
                      aria-label="Close model context"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 overflow-auto max-h-[calc(85vh-56px)]">
                    <pre className="text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap break-words">
{(() => {
  let prompt = buildSystemPrompt(kundaliData, currentChartName || undefined);
  if (matchData) {
    prompt += `\n\n--- COMPATIBILITY ANALYSIS ---`;
    prompt += `\n👤 Male: ${matchData.chart1Name}`;
    prompt += `\n👩 Female: ${matchData.chart2Name}`;
    prompt += `\n\nAshtakoota Scores:`;
    matchData.scores.forEach(s => {
      prompt += `\n  ${s.category}: ${s.score}/${s.maxScore} — ${s.description}`;
    });
    if (matchData.chart1) {
      prompt += `\n\n--- ${matchData.chart1Name.toUpperCase()}'s CHART (Male) ---`;
      prompt += `\nLagna: R:${matchData.chart1.lagna.sign}`;
      for (const [name, p] of Object.entries(matchData.chart1.planets)) {
        prompt += `\n${name}: R:${p.sign} H:${p.house_whole_sign}${p.nakshatra ? ` Nak:${p.nakshatra}` : ''}${p.retrograde ? ' [R]' : ''}`;
      }
    }
    if (matchData.chart2) {
      prompt += `\n\n--- ${matchData.chart2Name.toUpperCase()}'s CHART (Female) ---`;
      prompt += `\nLagna: R:${matchData.chart2.lagna.sign}`;
      for (const [name, p] of Object.entries(matchData.chart2.planets)) {
        prompt += `\n${name}: R:${p.sign} H:${p.house_whole_sign}${p.nakshatra ? ` Nak:${p.nakshatra}` : ''}${p.retrograde ? ' [R]' : ''}`;
      }
    }
    prompt += `\n\nIMPORTANT: Always refer to the couple by their names (${matchData.chart1Name} and ${matchData.chart2Name}). Analyze their compatibility using both charts.`;
  }
  return prompt;
})()}
                    </pre>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <footer className="mt-auto border-t border-[hsl(220,8%,14%)] bg-[hsl(220,10%,5%)]">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <img src="/astrova_logo.png" alt="Astrova" className="w-5 h-5 opacity-60" />
                  <span className="text-sm font-semibold text-neutral-400">Astrova</span>
                  <span className="text-neutral-700">·</span>
                  <span className="text-xs text-neutral-500">Vedic Birth Chart Generator</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-600">© {new Date().getFullYear()} Astrova</span>
                  <span className="text-neutral-700">·</span>
                  <a href="mailto:support@astrova.app?subject=Privacy%20Policy" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Privacy</a>
                  <a href="mailto:support@astrova.app?subject=Terms%20of%20Service" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Terms</a>
                </div>
              </div>
            </div>
          </footer>

          {/* Load Charts Modal */}
          <LoadChartsModal
            isOpen={showLoadChartsModal}
            charts={savedCharts}
            onLoad={handleLoadChart}
            onEdit={() => {}}
            onDelete={deleteChartFromStorageFn}
            onClose={() => setShowLoadChartsModal(false)}
          />
          
          {/* Global Buy Credits Modal */}
          <BuyCreditsModalWrapper />

          {/* Delete Toast */}
          {deleteToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 bg-[hsl(220,10%,9%)] border border-[hsl(220,8%,24%)] rounded-xl shadow-2xl text-sm text-white flex items-center gap-2" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              {deleteToast}
              <button type="button" className="ml-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5" onClick={() => setDeleteToast(null)} aria-label="Dismiss delete message">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Matcher Save Error Toast */}
          {matcherSaveError && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 bg-[hsl(220,10%,9%)] border border-red-500/40 rounded-xl shadow-2xl text-sm text-red-200 flex items-center gap-2" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              {matcherSaveError}
              <button type="button" className="ml-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-300 hover:text-red-100 hover:bg-red-500/10" onClick={() => setMatcherSaveError(null)} aria-label="Dismiss matcher save error">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </CreditsProvider>
    </AuthGuard>
    </ErrorBoundary>
  );
}

// Wrapper component to access credits context
function BuyCreditsModalWrapper() {
  const { showBuyModal, setShowBuyModal } = useCredits();
  return <BuyCreditsModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />;
}

export default ChartPage;

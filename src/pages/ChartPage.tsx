import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Trash2, Download, Save, FolderOpen, Check, AlertTriangle, Edit3, Calendar, X } from 'lucide-react';
import { Header } from '@/components/Header';
import { NorthIndianChart } from '@/components/NorthIndianChart';
import { StrengthAnalysis } from '@/components/StrengthAnalysis';
import { RealtimeControls } from '@/components/RealtimeControls';
import { LoadChartsModal } from '@/components/LoadChartsModal';
import { KundaliMatcher } from '@/components/KundaliMatcher';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ChartSkeleton } from '@/components/common/LoadingSkeleton';
import { SEOHead } from '@/components/common/SEOHead';
import { apiRequest } from '../config/api';
import { useAuth } from '@/contexts/auth';
import { CHART_CONSTANTS } from '@/constants';
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


function ChartPage() {
  const { user } = useAuth();
  const [kundaliData, setKundaliData] = useState<KundaliResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<KundaliRequest | null>(CHART_CONSTANTS.DEFAULT_REQUEST);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string>('');
  const [currentChartName, setCurrentChartName] = useState<string>('');
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
  const [showLoadChartsModal, setShowLoadChartsModal] = useState(false);
  const [activeView, setActiveView] = useState<'kundali' | 'matcher'>('kundali');
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [saveButtonFlash, setSaveButtonFlash] = useState<'saved' | 'error' | null>(null);
  const [inlineSaveName, setInlineSaveName] = useState('');
  const [nameInputError, setNameInputError] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);

  const skipNextLocationClearRef = useRef(false);
  const reverseGeocodeAbortRef = useRef<AbortController | null>(null);
  const reverseGeocodeTimeoutRef = useRef<number | null>(null);
  const lastRealtimeRequestRef = useRef<string>('');
  const lastRealtimeSuccessRef = useRef<string>('');
  const realtimeInFlightRef = useRef<string>('');
  const hasInitialLoaded = useRef(false);
  const saveFlashTimeoutRef = useRef<number | null>(null);

  const flashSavedOnMainButton = () => {
    setSaveButtonFlash('saved');
    if (saveFlashTimeoutRef.current) {
      window.clearTimeout(saveFlashTimeoutRef.current);
    }
    saveFlashTimeoutRef.current = window.setTimeout(() => {
      setSaveButtonFlash(null);
      saveFlashTimeoutRef.current = null;
    }, 1000);
  };

  const normalizeChartName = useCallback((name: string) => name.trim().toLowerCase(), []);

  const validateChartName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false as const, reason: 'empty' as const };
      }

      const normalized = normalizeChartName(trimmed);
      const duplicate = savedCharts.find((c) => normalizeChartName(c.name) === normalized);

      console.log('Validating name:', name);
      console.log('Normalized:', normalized);
      console.log('Found duplicate:', duplicate?.name);

      if (duplicate) {
        return { ok: false as const, reason: 'duplicate' as const };
      }

      return { ok: true as const, value: trimmed };
    },
    [normalizeChartName, savedCharts]
  );

  const actionButtonClass =
    'gap-1 bg-neutral-200/10 border border-neutral-600/50 text-white hover:bg-neutral-200/20 hover:border-neutral-500/70 transition-all duration-200';

  const apiHeaders = useCallback((uid: string) => ({ 'X-User-Id': uid }), []);

  const fetchChartsFromDb = useCallback(async (uid: string) => {
    const resp = await axios.get<SavedChart[]>(apiRequest('/api/charts'), { headers: apiHeaders(uid) });
    setSavedCharts(resp.data);
    return resp.data;
  }, [apiHeaders]);

  const deleteChartFromDb = async (chartId: string) => {
    if (!user) return;
    try {
      await axios.delete(apiRequest(`/api/charts/${encodeURIComponent(chartId)}`), { headers: apiHeaders(user.id) });
      await fetchChartsFromDb(user.id);
    } catch (e) {
      const status = (e as { response?: { status?: number; data?: { detail?: string } } }).response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      if (status === 404) {
        throw new Error(detail || 'Chart not found.');
      }
      throw new Error(detail || 'Failed to delete chart.');
    } finally {
      if (selectedChartId === chartId) {
        setSelectedChartId('');
      }
    }
  };

  
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
          `/api/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
          { signal: reverseGeocodeAbortRef.current.signal }
        );
        if (!response.ok) return;

        const data: { city?: string; state?: string; country?: string; display_name?: string } = await response.json();
        const city = (data.city ?? '').trim();
        const state = (data.state ?? '').trim();
        const country = (data.country ?? '').trim();
        const display = (data.display_name ?? '').trim();

        const name =
          (city && country ? `${city}, ${country}` : '') ||
          (city && state ? `${city}, ${state}` : '') ||
          city ||
          (display ? (display.split(',')[0]?.trim() ?? '') : '');

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await fetchChartsFromDb(user.id);
      } catch {
        // ignore; UI will show empty
      }
    })();
  }, [user, fetchChartsFromDb]);

  const handleSubmit = async (request: KundaliRequest) => {
    setIsLoading(true);
    setError(null);
    setCurrentChartName(''); // Clear chart name when generating new chart
    setInlineSaveName('');
    setNameInputError(false);
    setSelectedChartId('');
    try {
      const response = await axios.post<KundaliResponse>(apiRequest('/api/kundali'), request);
      setKundaliData(response.data);
      setCurrentRequest(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate kundali');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRealtimeChange = useCallback(async (data: KundaliRequest) => {
    // Prevent duplicate API calls, but allow retries after errors.
    const dataKey = JSON.stringify(data);
    setCurrentChartName(''); // Clear chart name when generating new chart via realtime
    if (realtimeInFlightRef.current === dataKey) {
      return;
    }
    if (kundaliData && lastRealtimeSuccessRef.current === dataKey) {
      return;
    }
    lastRealtimeRequestRef.current = dataKey;
    realtimeInFlightRef.current = dataKey;
    
    // If the user changes coordinates, clear the previous city label so we can reverse-geocode.
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
    if (!kundaliData) {
      // If no chart yet, generate one immediately
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.post<KundaliResponse>(apiRequest('/api/kundali'), data);
        setKundaliData(response.data);
        lastRealtimeSuccessRef.current = dataKey;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate kundali');
      } finally {
        if (realtimeInFlightRef.current === dataKey) {
          realtimeInFlightRef.current = '';
        }
        setIsLoading(false);
      }
      return;
    }
    setError(null);
    try {
      const response = await axios.post<KundaliResponse>(apiRequest('/api/kundali'), data);
      setKundaliData(response.data);
      lastRealtimeSuccessRef.current = dataKey;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update kundali');
    } finally {
      if (realtimeInFlightRef.current === dataKey) {
        realtimeInFlightRef.current = '';
      }
    }
  }, [kundaliData, currentRequest]);

  // Generate initial chart on mount
  useEffect(() => {
    if (!hasInitialLoaded.current && currentRequest) {
      hasInitialLoaded.current = true;
      handleRealtimeChange(currentRequest);
    }
  }, [currentRequest, handleRealtimeChange]);

  const handleDownloadJSON = () => {
    if (!kundaliData) return;
    const blob = new Blob([JSON.stringify(kundaliData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kundali_${kundaliData.birth.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  
  const handleLoadCharts = () => {
    setShowLoadChartsModal(true);
  };

  const saveNewChartFromModal = useCallback(async (payload: {
    name: string;
    birthData: KundaliRequest;
    locationName?: string;
  }) => {
    if (!user) {
      throw new Error('Please sign in to save charts');
    }
    
    try {
      await axios.post(
        apiRequest('/api/charts'),
        {
          name: payload.name,
          birthData: payload.birthData,
          locationName: payload.locationName,
        },
        { headers: apiHeaders(user.id) }
      );
      const charts = await fetchChartsFromDb(user.id);

      // Since we always create a new chart, set the newly created chart as selected.
      // Names are unique by design, so this is safe.
      const normalized = normalizeChartName(payload.name);
      const created = charts.find((c) => normalizeChartName(c.name) === normalized);
      if (created) {
        setSelectedChartId(created.id);
        setCurrentChartName(created.name);
      } else {
        // Fallback: at least reflect the saved name
        setCurrentChartName(payload.name);
      }
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      if (status === 409) {
        // Conflict - name already exists
        throw new Error('A chart with this name already exists');
      }
      throw new Error(detail || 'Failed to save chart');
    }
  }, [user, apiHeaders, fetchChartsFromDb, normalizeChartName]);

  const handleSaveChart = useCallback(async () => {
    if (!kundaliData || !currentRequest) return;

    if (!user) {
      setError('Please sign in to save charts');
      setSaveButtonFlash('error');
      return;
    }

    const validation = validateChartName(inlineSaveName);
    if (!validation.ok) {
      setNameInputError(true);
      setSaveButtonFlash('error');
      return;
    }

    try {
      await saveNewChartFromModal({
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
      setSaveButtonFlash('error');
    }
  }, [currentLocationName, currentRequest, inlineSaveName, kundaliData, saveNewChartFromModal, user, validateChartName]);

  const handleLoadChart = async (chartId: string) => {
    const chart = savedCharts.find(c => c.id === chartId);
    
    if (chart) {
      // Restore birthData, but prioritize saved coordinates if they exist
      const restoredRequest = {
        ...chart.birthData,
        latitude: chart.coordinates?.latitude ?? chart.birthData.latitude,
        longitude: chart.coordinates?.longitude ?? chart.birthData.longitude,
        tz_offset_hours: chart.coordinates?.timezone ?? chart.birthData.tz_offset_hours,
      };
      setCurrentRequest(restoredRequest);
      // If this chart doesn't have explicit saved coordinates, its stored locationName might be stale.
      // Clear it so reverse-geocoding can compute a correct name from restored lat/lon.
      const hasExplicitCoords =
        typeof chart.coordinates?.latitude === 'number' &&
        typeof chart.coordinates?.longitude === 'number';
      setCurrentLocationName(hasExplicitCoords ? (chart.locationName || '') : '');
      setCurrentChartName(chart.name);
      setSelectedChartId(chartId);
      
      // Re-fetch kundali data from API to ensure latest calculations
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.post<KundaliResponse>(apiRequest('/api/kundali'), restoredRequest);
        setKundaliData(response.data);
      } catch (err) {
        // Fall back to saved data if API fails
        setKundaliData(chart.kundaliData);
        console.warn('Failed to refresh kundali, using saved data:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteChart = (chartId: string) => {
    deleteChartFromDb(chartId);
    setDeleteConfirmation(false);
    // Reset name-related states when deleting the currently selected chart
    if (selectedChartId === chartId) {
      setSelectedChartId('');
      setCurrentChartName('');
      setInlineSaveName('');
      setNameInputError(false);
      setIsEditingName(false);
    }
  };

  
  return (
    <ErrorBoundary>
      <SEOHead />
      <AuthGuard>
        <div className="min-h-screen flex flex-col bg-black">
          {/* Background gradient - matches homepage */}
          <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(168,85,247,0.15),transparent)] pointer-events-none" />
          
          <Header
            activeView={activeView}
            onViewChange={setActiveView}
          />

      <main className="flex-1 py-4 sm:py-8 px-3 sm:px-4 relative">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="max-w-2xl mx-auto mb-6 bg-error/20 border border-error/50 text-error rounded-xl p-4 text-center">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="max-w-2xl mx-auto mb-6">
              <ChartSkeleton />
            </div>
          )}

          <div className="space-y-8">
            {/* Intro Banner */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <Calendar className="w-6 h-6 text-yellow-500" />
                Vedic Birth Chart Analysis
              </h2>
              <p className="text-neutral-400">Generate and analyze your Vedic birth chart with detailed astrological insights</p>
            </div>

            {activeView === 'kundali' ? (
              <>
                {currentRequest && (
                  <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
                    {/* Birth Details Section */}
                    <div className="bg-neutral-900/60 rounded-xl sm:rounded-2xl border border-neutral-700/50">
                      {/* Mobile Header */}
                      <div className="md:hidden px-4 py-3 bg-neutral-800/50 border-b border-neutral-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-neutral-700/50 border border-neutral-600/50 flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-white" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg font-bold text-white tracking-tight">Birth Details</h3>
                              <p className="text-xs text-neutral-400 mt-0.5">Your birth information</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <span className="text-xs text-white/60">Auto</span>
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={realtimeEnabled}
                                  onChange={(e) => setRealtimeEnabled(e.target.checked)}
                                  className="sr-only"
                                />
                                <div className={`w-7 h-4 rounded-full transition-colors ${realtimeEnabled ? 'bg-white' : 'bg-neutral-800 border border-neutral-700'}`}>
                                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full shadow transition-transform ${realtimeEnabled ? 'translate-x-3 bg-black' : 'bg-neutral-400'}`} />
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 w-40 sm:w-56 md:w-64">
                            {!isEditingName ? (
                              <>
                                <div className="min-w-0 flex-1">
                                  {nameInputError ? (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/25 border border-yellow-500/40 text-yellow-200 rounded-lg text-sm font-medium animate-pulse animate-shake shadow-sm shadow-yellow-500/20">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{!inlineSaveName.trim() ? 'Enter a name' : 'Name already exists'}</span>
                                    </div>
                                  ) : inlineSaveName ? (
                                    <span
                                      className="block truncate px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-white font-medium cursor-pointer hover:border-neutral-700 transition-colors text-sm"
                                      onClick={() => {
                                        setIsEditingName(true);
                                        setNameInputError(false);
                                      }}
                                      title={inlineSaveName}
                                    >
                                      {inlineSaveName}
                                    </span>
                                  ) : currentChartName ? (
                                    <span
                                      className="block truncate px-3 py-1.5 bg-blue-500/25 border border-blue-500/40 text-blue-300 rounded-md text-sm font-medium shadow-sm shadow-blue-500/20 cursor-pointer hover:bg-blue-500/30 transition-colors"
                                      onClick={() => {
                                        setIsEditingName(true);
                                        setNameInputError(false);
                                      }}
                                      title={currentChartName}
                                    >
                                      {currentChartName}
                                    </span>
                                  ) : (
                                    <span
                                      className="block truncate px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-neutral-500 italic text-sm cursor-pointer hover:border-neutral-700 transition-colors"
                                      onClick={() => {
                                        setIsEditingName(true);
                                        setNameInputError(false);
                                      }}
                                      title="Untitled Chart"
                                    >
                                      Untitled Chart
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingName(true);
                                    setNameInputError(false);
                                  }}
                                  className="shrink-0 p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all duration-200"
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
                                  const value = e.target.value;
                                  setInlineSaveName(value);

                                  // Debug: log current state
                                  console.log('Input value:', value);
                                  console.log('Saved charts:', savedCharts.map(c => c.name));
                                  
                                  const validation = validateChartName(value);
                                  console.log('Validation result:', validation);
                                  setNameInputError(!validation.ok);
                                }}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setIsEditingName(false);
                                  }
                                }}
                                placeholder="Enter chart name..."
                                className={`min-w-0 w-full px-3 py-1.5 bg-neutral-900/50 border rounded-lg text-sm font-medium focus:outline-none transition-all ${
                                  nameInputError
                                    ? 'border-yellow-500/50 text-yellow-200 placeholder-yellow-200/50 animate-pulse animate-shake bg-yellow-500/10'
                                    : 'border-neutral-700/60 text-white placeholder-white/40 focus:border-neutral-600/80 focus:bg-neutral-900/60 shadow-sm'
                                }`}
                                autoFocus
                              />
                            )}
                          </div>

                          <div className="flex flex-nowrap justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLoadCharts}
                            aria-label="Open"
                            className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap`}
                          >
                            <FolderOpen className="w-4 h-4" />
                            <span className="hidden sm:inline">Open</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveChart}
                            aria-label="Save"
                            className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap ${(!user || !kundaliData || !currentRequest) ? 'opacity-50 pointer-events-none' : ''} ${
                              saveButtonFlash === 'saved'
                                ? 'bg-green-500/15 border-green-500/40 text-green-200 hover:bg-green-500/20 hover:border-green-500/60'
                                : saveButtonFlash === 'error'
                                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200 animate-pulse'
                                : ''
                            } ${saveButtonFlash === 'error' ? 'animate-shake' : ''}`}
                          >
                            {saveButtonFlash === 'saved' ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span className="hidden sm:inline">Saved</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                <span className="hidden sm:inline">Save</span>
                              </>
                            )}
                          </Button>

                          {selectedChartId ? (
                            deleteConfirmation ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleDeleteChart(selectedChartId);
                                    setDeleteConfirmation(false);
                                  }}
                                  className="bg-red-500/20 border-red-500/50 text-red-200 hover:bg-red-500/30 hover:border-red-500/60 h-8 px-2 text-xs"
                                >
                                  Confirm?
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteConfirmation(false)}
                                  className={`${actionButtonClass} h-8 w-8 p-0`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmation(true)}
                                aria-label="Delete"
                                className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap`}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            )
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              aria-label="Delete"
                              className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap opacity-0 pointer-events-none`}
                              aria-hidden="true"
                              tabIndex={-1}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadJSON}
                            aria-label="Export"
                            className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap ${(!kundaliData) ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Export</span>
                          </Button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Header */}
                      <div className="hidden md:flex items-center justify-between px-5 sm:px-6 py-4 bg-neutral-800/50 border-b border-neutral-700/50">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-neutral-700/50 border border-neutral-600/50 flex items-center justify-center shrink-0">
                                <Calendar className="w-4 h-4 text-white" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Birth Details</h3>
                                <p className="hidden sm:block text-xs text-neutral-400 mt-0.5">Your birth information</p>
                              </div>
                            </div>
                          </div>
                          {!isEditingName ? (
                            <div className="inline-flex items-center gap-2">
                              {nameInputError ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/25 border border-yellow-500/40 text-yellow-200 rounded-lg text-sm font-medium animate-pulse animate-shake shadow-sm shadow-yellow-500/20">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span>{!inlineSaveName.trim() ? 'Enter a name' : 'Name already exists'}</span>
                                </div>
                              ) : inlineSaveName ? (
                                <span 
                                  className="px-3 py-1.5 bg-neutral-900/40 border border-neutral-800/50 rounded-md text-white/90 font-medium cursor-pointer hover:bg-neutral-900/60 hover:border-neutral-700/70 transition-colors"
                                  onDoubleClick={() => {
                                    setIsEditingName(true);
                                    setNameInputError(false);
                                  }}
                                  title="Double-click to edit"
                                >
                                  {inlineSaveName}
                                </span>
                              ) : currentChartName ? (
                                <span 
                                  className="px-3 py-1.5 bg-blue-500/25 border border-blue-500/40 text-blue-300 rounded-md text-sm font-medium shadow-sm shadow-blue-500/20 cursor-pointer hover:bg-blue-500/30 transition-colors"
                                  onDoubleClick={() => {
                                    setIsEditingName(true);
                                    setNameInputError(false);
                                  }}
                                  title="Double-click to edit"
                                >
                                  {currentChartName}
                                </span>
                              ) : (
                                <span 
                                  className="px-3 py-1.5 bg-neutral-900/40 border border-neutral-800/50 rounded-md text-white/50 italic text-sm cursor-pointer hover:bg-neutral-900/60 hover:border-neutral-700/70 transition-colors"
                                  onDoubleClick={() => {
                                    setIsEditingName(true);
                                    setNameInputError(false);
                                  }}
                                  title="Double-click to edit"
                                >
                                  Untitled Chart
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingName(true);
                                  setNameInputError(false);
                                }}
                                className="group relative p-2 rounded-xl bg-neutral-900/40 border border-neutral-800/50 hover:bg-neutral-900/60 hover:border-neutral-700/70 transition-all duration-200 hover:scale-105 shadow-sm"
                                title="Edit chart name"
                              >
                                <Edit3 className="w-4 h-4 text-white/60 group-hover:text-white/80 transition-colors" />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={inlineSaveName}
                                  onChange={(e) => {
                                    setInlineSaveName(e.target.value);
                                    setNameInputError(false);
                                  }}
                                  onBlur={() => setIsEditingName(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setIsEditingName(false);
                                    }
                                  }}
                                  placeholder="Enter chart name..."
                                  className={`px-3 py-1.5 bg-neutral-900/50 border rounded-lg text-sm font-medium focus:outline-none transition-all ${
                                    nameInputError
                                      ? 'border-yellow-500/50 text-yellow-200 placeholder-yellow-200/50 animate-pulse animate-shake bg-yellow-500/10'
                                      : 'border-neutral-700/60 text-white placeholder-white/40 focus:border-neutral-600/80 focus:bg-neutral-900/60 shadow-sm'
                                  }`}
                                  autoFocus
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-white/60">Auto-update</span>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={realtimeEnabled}
                                onChange={(e) => setRealtimeEnabled(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`w-9 h-5 rounded-full transition-colors ${realtimeEnabled ? 'bg-white' : 'bg-neutral-800 border border-neutral-700'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform ${realtimeEnabled ? 'translate-x-4 bg-black' : 'bg-neutral-400'}`} />
                              </div>
                            </div>
                          </label>
                          
                          <div className="h-5 w-px bg-neutral-800"></div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleLoadCharts}
                              className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap`}
                            >
                              <FolderOpen className="w-4 h-4" />
                              Open
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSaveChart}
                              aria-label="Save"
                              className={`${actionButtonClass} ${
                                (!user || !kundaliData || !currentRequest) ? 'opacity-50 pointer-events-none' : ''
                              } ${
                                saveButtonFlash === 'saved'
                                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/30 hover:border-yellow-500/60'
                                  : saveButtonFlash === 'error'
                                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200 animate-pulse'
                                  : ''
                              } ${saveButtonFlash === 'error' ? 'animate-shake' : ''}`}
                            >
                              {saveButtonFlash === 'saved' ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  Saved
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Save
                                </>
                              )}
                            </Button>

                            {selectedChartId ? (
                            deleteConfirmation ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleDeleteChart(selectedChartId);
                                    setDeleteConfirmation(false);
                                  }}
                                  className="bg-red-500/20 border-red-500/50 text-red-200 hover:bg-red-500/30 hover:border-red-500/60 h-8 px-2 text-xs"
                                >
                                  Confirm?
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteConfirmation(false)}
                                  className={`${actionButtonClass} h-8 w-8 p-0`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmation(true)}
                                className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap`}
                                title="Delete"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )
                          ) : null}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDownloadJSON}
                              className={`${actionButtonClass} h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap ${(!kundaliData) ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              <Download className="w-4 h-4" />
                              Export
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 sm:p-4">
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


                    {/* Charts - stack on mobile, side by side on desktop */}
                    {kundaliData && currentRequest && (
                      <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                          <div className="bg-neutral-900/60 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-neutral-700/50 hover:border-neutral-600/80 transition-colors flex flex-col">
                            <div className="flex-1 flex items-center justify-center">
                              <NorthIndianChart data={kundaliData} chartType="rasi" />
                            </div>
                            <h3 className="text-sm sm:text-base font-medium text-center mt-2 sm:mt-3 text-white">Lagna (D1)</h3>
                          </div>

                          <div className="bg-neutral-900/60 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-neutral-700/50 hover:border-neutral-600/80 transition-colors flex flex-col">
                            <div className="flex-1 flex items-center justify-center">
                              <NorthIndianChart data={kundaliData} chartType="navamsa" />
                            </div>
                            <h3 className="text-sm sm:text-base font-medium text-center mt-2 sm:mt-3 text-white">Navamsa (D9)</h3>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!currentRequest && (
                  <div className="bg-neutral-900/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-neutral-700/50 flex flex-col max-w-6xl mx-auto">
                    <h2 className="text-base sm:text-xl font-medium text-center mb-3 sm:mb-4 text-white">North Indian Chart</h2>
                    <div className="flex-1 flex items-center justify-center py-8">
                      <div className="text-neutral-400 text-sm">Generate birth chart to view chart</div>
                    </div>
                  </div>
                )}

                {kundaliData && (
                  <div className="max-w-6xl mx-auto">
                    <div className="bg-neutral-900/60 rounded-xl p-3 sm:p-4 border border-neutral-700/50">
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm">
                        <span className="text-text">{kundaliData.birth.date} {kundaliData.birth.time}</span>
                        <span className="text-text-muted">TZ: {kundaliData.birth.tz_offset_hours}h</span>
                        {kundaliData.birth.dst_applied && (
                          <span className="px-2 py-1 bg-accent/20 border border-accent/50 text-accent rounded-md text-xs font-medium">
                            DST +{kundaliData.birth.dst_adjustment_hours}h
                          </span>
                        )}
                        <span className="text-text-muted hidden sm:inline">Lat: {kundaliData.birth.latitude.toFixed(2)}°</span>
                        <span className="text-text-muted hidden sm:inline">Lon: {kundaliData.birth.longitude.toFixed(2)}°</span>
                      </div>
                    </div>
                  </div>
                )}
                {kundaliData && (
                  <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
                    {/* Strength Analysis - Spider Charts with Combined View */}
                    <StrengthAnalysis 
                      shadBala={kundaliData.shad_bala} 
                      bhavaBala={kundaliData.bhava_bala}
                      planets={kundaliData.planets}
                      upagrahas={kundaliData.upagrahas}
                      lagna={kundaliData.lagna}
                      dashaData={kundaliData.dasha}
                    />
                  </div>
                )}
              </>
            ) : activeView === 'matcher' ? (
              <KundaliMatcher 
                savedCharts={savedCharts}
                onDeleteChart={deleteChartFromDb}
              />
            ) : null}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 sm:mt-12 border-t border-neutral-800/30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col items-center space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-white">Astrova</span>
              <span className="text-white/30">•</span>
              <span className="text-xs text-white/50">© {new Date().getFullYear()}</span>
              <span className="text-white/30">•</span>
              <span className="text-xs text-white/50">Discover Your Cosmic Blueprint</span>
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
        onDelete={deleteChartFromDb}
        onClose={() => setShowLoadChartsModal(false)}
      />
      </div>
    </AuthGuard>
    </ErrorBoundary>
  );
}

export default ChartPage;

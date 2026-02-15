import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Star, FolderOpen, Search, X, ChevronRight, MapPin, Crown, Handshake, Sparkles, PawPrint, Globe2, Users, Orbit, Dna, Save, Heart } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LoadChartsModal } from './LoadChartsModal';
import { calculateKundali, calculateAshtakootMatch, estimateTimezone } from '../lib/vedic-engine';
import type { KundaliRequest, KundaliResponse } from '../types/kundali';

interface MatchedCharts {
  chart1: KundaliResponse;
  chart2: KundaliResponse;
  chart1Name: string;
  chart2Name: string;
}

interface MatchScore {
  category: string;
  score: number;
  maxScore: number;
  description: string;
  color: string;
}

// Match API response removed — using client-side calculateAshtakootMatch instead

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

interface KundaliMatcherProps {
  savedCharts: SavedChart[];
  onDeleteChart?: (chartId: string) => void | Promise<void>;
  onMatchComplete?: (data: { chart1Name: string; chart2Name: string; scores: MatchScore[]; chart1: KundaliResponse; chart2: KundaliResponse }) => void;
  onSaveChart?: (name: string, birthData: KundaliRequest, locationName?: string) => void | Promise<void>;
}

const DEFAULT_FORM_DATA: KundaliRequest = {
  year: 1990,
  month: 1,
  day: 1,
  hour: 12,
  minute: 0,
  second: 0,
  latitude: 28.6139,
  longitude: 77.2090,
  tz_offset_hours: 5.5,
  ayanamsha: 'lahiri',
};

export function KundaliMatcher({ savedCharts, onDeleteChart, onMatchComplete, onSaveChart }: KundaliMatcherProps) {
  const [selectedChart1, setSelectedChart1] = useState<string>('');
  const [selectedChart2, setSelectedChart2] = useState<string>('');
  const [matchedCharts, setMatchedCharts] = useState<MatchedCharts | null>(null);
  const [matchScores, setMatchScores] = useState<MatchScore[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadingForPerson, setLoadingForPerson] = useState<1 | 2>(1);
  const hasAutoLoadedRef = useRef(false);
  const locationSearchTimerRef1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationSearchTimerRef2 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Location search states
  const [locationSearch1, setLocationSearch1] = useState('');
  const [locationSearch2, setLocationSearch2] = useState('');
  const [locationSuggestions1, setLocationSuggestions1] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [locationSuggestions2, setLocationSuggestions2] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching1, setIsSearching1] = useState(false);
  const [isSearching2, setIsSearching2] = useState(false);
  const [showLocationDropdown1, setShowLocationDropdown1] = useState(false);
  const [showLocationDropdown2, setShowLocationDropdown2] = useState(false);
  const [selectedResultIndex1, setSelectedResultIndex1] = useState(-1);
  const [selectedResultIndex2, setSelectedResultIndex2] = useState(-1);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const actionButtonClass = 'gap-1 border border-amber-500/20 bg-[hsl(24,18%,9%)] text-white hover:bg-[hsl(24,20%,12%)] hover:border-amber-500/35 h-9 px-3';
  const bannerClass = 'relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(217,119,6,0.08),rgba(18,11,6,0.9))] p-5 sm:p-6';
  const formPanelClass = 'bg-[linear-gradient(160deg,rgba(14,10,6,0.93),rgba(32,20,10,0.72))] border border-amber-500/15 rounded-xl overflow-hidden hover:border-amber-500/30 transition-colors';
  const fieldLabelClass = 'block text-xs text-neutral-400 mb-1';
  const selectFieldClass = 'w-full h-9 bg-[hsl(24,18%,9%)] border border-amber-500/20 rounded-lg px-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/25 focus:border-amber-500/40 appearance-none transition-colors cursor-pointer';
  
  // Form states for direct input
  const [formData1, setFormData1] = useState<KundaliRequest>(DEFAULT_FORM_DATA);
  
  const [formData2, setFormData2] = useState<KundaliRequest>(DEFAULT_FORM_DATA);
  
  // Dropdown option helpers
  const years = useMemo(() => {
    const start = 1900;
    const end = 2100;
    const list = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return list.includes(formData1.year) ? list : [...list, formData1.year].sort((a, b) => a - b);
  }, [formData1.year]);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const seconds = minutes;
  
  const [name1, setName1] = useState('Person 1');
  const [name2, setName2] = useState('Person 2');

  const handleMatch = () => {
    setMatchError(null);
    setMatchedCharts(null);
    setMatchScores([]);

    if (!formData1 || !formData2) {
      setMatchError('Please enter birth details for both persons.');
      return;
    }
    if (selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2) {
      setMatchError('Please select different charts for each person.');
      return;
    }

    setIsMatching(true);
    try {
      const chart1 = calculateKundali(formData1);
      const chart2 = calculateKundali(formData2);

      const chart1Label = name1.trim() || 'Person 1';
      const chart2Label = name2.trim() || 'Person 2';

      setMatchedCharts({
        chart1,
        chart2,
        chart1Name: chart1Label,
        chart2Name: chart2Label,
      });

      const matchResult = calculateAshtakootMatch(chart1, chart2);
      const scores: MatchScore[] = matchResult.scores.map((s) => ({
        ...s,
        color: getScoreColor(s.score, s.maxScore),
      }));
      // Add overall score
      scores.push({
        category: 'Overall Compatibility',
        score: matchResult.total,
        maxScore: matchResult.maxTotal,
        description: 'Total Ashtakoot score',
        color: getScoreColor(matchResult.total, matchResult.maxTotal),
      });
      setMatchScores(scores);

      // Notify parent (for AI sidebar)
      onMatchComplete?.({
        chart1Name: chart1Label,
        chart2Name: chart2Label,
        scores,
        chart1,
        chart2,
      });
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : 'Unable to match charts');
    } finally {
      setIsMatching(false);
    }
  };

  const handleLocationInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, personNumber: 1 | 2) => {
    const suggestions = personNumber === 1 ? locationSuggestions1 : locationSuggestions2;
    const selectedIndex = personNumber === 1 ? selectedResultIndex1 : selectedResultIndex2;
    const setSelectedIndex = personNumber === 1 ? setSelectedResultIndex1 : setSelectedResultIndex2;

    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((selectedIndex + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const target = suggestions[selectedIndex] || suggestions[0];
      if (target) {
        selectLocation(target, personNumber);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (personNumber === 1) {
        setShowLocationDropdown1(false);
      } else {
        setShowLocationDropdown2(false);
      }
    }
  };

  const applySavedChart = useCallback((chartId: string, personNumber: 1 | 2) => {
    const chart = savedCharts.find((c) => c.id === chartId);
    if (!chart) return;

    if (personNumber === 1) {
      setSelectedChart1(chartId);
      setName1(chart.name);
      setFormData1(chart.birthData);
    } else {
      setSelectedChart2(chartId);
      setName2(chart.name);
      setFormData2(chart.birthData);
    }
  }, [savedCharts]);

  // Auto-load first two saved charts on mount
  useEffect(() => {
    if (hasAutoLoadedRef.current) return;
    if (savedCharts.length === 0) return;
    hasAutoLoadedRef.current = true;
    if (savedCharts.length >= 2) {
      applySavedChart(savedCharts[0].id, 1);
      applySavedChart(savedCharts[1].id, 2);
    } else {
      applySavedChart(savedCharts[0].id, 1);
    }
  }, [savedCharts, applySavedChart]);

  useEffect(() => {
    return () => {
      if (locationSearchTimerRef1.current) clearTimeout(locationSearchTimerRef1.current);
      if (locationSearchTimerRef2.current) clearTimeout(locationSearchTimerRef2.current);
      if (saveToastTimeoutRef.current) clearTimeout(saveToastTimeoutRef.current);
    };
  }, []);

  const handleLoadChart = (chartId: string) => {
    applySavedChart(chartId, loadingForPerson);
    setShowLoadModal(false);
    setMatchError(null);
    // Clear previous match results when person data changes
    if (matchedCharts) {
      setMatchedCharts(null);
      setMatchScores([]);
    }
  };

  const openLoadModal = (personNumber: 1 | 2) => {
    setLoadingForPerson(personNumber);
    setShowLoadModal(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !isMatching) {
        event.preventDefault();
        handleMatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMatching, handleMatch]);

  const handleDeleteChart = async (chartId: string) => {
    await onDeleteChart?.(chartId);
    if (selectedChart1 === chartId) {
      setSelectedChart1('');
      setName1('Person 1');
    }
    if (selectedChart2 === chartId) {
      setSelectedChart2('');
      setName2('Person 2');
    }
  };

  // Location search functions
  const searchLocation = async (query: string, personNumber: 1 | 2) => {
    if (!query.trim()) {
      if (personNumber === 1) {
        setLocationSuggestions1([]);
        setShowLocationDropdown1(false);
      } else {
        setLocationSuggestions2([]);
        setShowLocationDropdown2(false);
      }
      return;
    }

    if (personNumber === 1) {
      setIsSearching1(true);
    } else {
      setIsSearching2(true);
    }

    try {
      // Use direct Nominatim API temporarily until backend is deployed
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const suggestions = Array.isArray(data) ? data.slice(0, 5) : [];
        
        if (personNumber === 1) {
          setLocationSuggestions1(suggestions);
          setShowLocationDropdown1(true);
        } else {
          setLocationSuggestions2(suggestions);
          setShowLocationDropdown2(true);
        }
      }
    } catch (error) {
      console.error('Location search failed:', error);
    } finally {
      if (personNumber === 1) {
        setIsSearching1(false);
      } else {
        setIsSearching2(false);
      }
    }
  };

  const selectLocation = (location: any, personNumber: 1 | 2) => {
    const formData = personNumber === 1 ? formData1 : formData2;
    const setFormData = personNumber === 1 ? setFormData1 : setFormData2;
    const setLocationSearch = personNumber === 1 ? setLocationSearch1 : setLocationSearch2;
    const setShowDropdown = personNumber === 1 ? setShowLocationDropdown1 : setShowLocationDropdown2;

    const lat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
    const lon = typeof location.lon === 'string' ? parseFloat(location.lon) : location.lon;

    // Estimate timezone from longitude (client-side) and update coordinates
    const tz = estimateTimezone(lon);
    setFormData({
      ...formData,
      latitude: lat,
      longitude: lon,
      tz_offset_hours: tz,
    });
    
    setLocationSearch(location.display_name || `${lat}, ${lon}`);
    setShowDropdown(false);
  };

  const clearLocationSearch = (personNumber: 1 | 2) => {
    if (personNumber === 1) {
      setLocationSearch1('');
      setLocationSuggestions1([]);
      setShowLocationDropdown1(false);
      setSelectedResultIndex1(-1);
    } else {
      setLocationSearch2('');
      setLocationSuggestions2([]);
      setShowLocationDropdown2(false);
      setSelectedResultIndex2(-1);
    }
  };

  const handleSavePersonChart = async (personNumber: 1 | 2) => {
    if (!onSaveChart) return;
    const name = (personNumber === 1 ? name1 : name2).trim();
    if (!name) {
      setSaveToast('Please enter a chart name before saving');
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    const data = personNumber === 1 ? formData1 : formData2;
    const locationName = (personNumber === 1 ? locationSearch1 : locationSearch2) || undefined;

    try {
      await onSaveChart(name, data, locationName);
      setSaveToast(`Saved "${name}"`);
    } catch {
      setSaveToast(`Failed to save "${name}"`);
    }
    if (saveToastTimeoutRef.current) clearTimeout(saveToastTimeoutRef.current);
    saveToastTimeoutRef.current = setTimeout(() => {
      setSaveToast(null);
      saveToastTimeoutRef.current = null;
    }, 2500);
  };


  const overallScore = matchScores.find(s => s.category === 'Overall Compatibility');
  const compatibilityLevel = overallScore ? getCompatibilityLevel(overallScore.score, overallScore.maxScore) : null;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className={bannerClass}>
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Heart className="w-6 h-6 text-amber-300" />
            <h2 className="text-2xl font-bold text-white">Kundali Matcher</h2>
          </div>
          <p className="text-sm text-neutral-300 text-center">Compare two Vedic birth charts — all calculations run locally</p>
          <p className="text-neutral-400 text-sm text-center mt-1 hidden sm:block">Date, time and location powered by precision Vedic calculations</p>
          <p className="text-[11px] text-neutral-500 text-center mt-2 hidden sm:block">Fill both birth forms, then run compatibility.</p>
        </div>
      </div>

      {/* Birth Data Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Person 1 Form */}
        <Card className={formPanelClass}>
          <CardHeader className="px-4 py-3 pb-2 border-b border-amber-500/15 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/25 to-yellow-500/25 border border-amber-500/30 flex items-center justify-center">
                <span className="text-amber-300 font-bold text-xs leading-none flex items-center justify-center">♂</span>
              </div>
              <CardTitle className="text-white text-sm sm:text-base">{name1 || 'Person 1'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-end gap-2">
              <div className="w-full">
                <Input
                  id="name1"
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleMatch(); }}
                  className="bg-[hsl(24,18%,9%)] border border-amber-500/20 text-white h-10 sm:h-9 text-sm rounded-lg focus:ring-1 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all w-full"
                  placeholder="Name"
                  aria-label="Person 1 name"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => openLoadModal(1)} className={`${actionButtonClass} px-3 justify-center flex-shrink-0`} title="Load saved chart" aria-label="Load saved chart for person 1">
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-xs ml-1 hidden sm:inline">Saved Charts</span>
                  <span className="text-xs ml-1 sm:hidden">Saved</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/30 border border-white/10 ml-1">{savedCharts.length}</span>
                </Button>
                {onSaveChart && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { void handleSavePersonChart(1); }}
                    className="gap-1 h-9 px-3 justify-center bg-amber-500/12 border border-amber-500/35 text-amber-300 hover:bg-amber-500/20 flex-shrink-0"
                    title="Save chart"
                    disabled={!name1.trim()}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span className="text-xs">Save</span>
                  </Button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className={fieldLabelClass}>Date of Birth</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <select value={formData1.day} onChange={(e) => setFormData1({...formData1, day: parseInt(e.target.value)})} aria-label="Person 1 birth day" className={selectFieldClass}>
                      {days.map(d => (<option key={d} value={d}>{d.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Day</span>
                  </div>
                  <div>
                    <select value={formData1.month} onChange={(e) => setFormData1({...formData1, month: parseInt(e.target.value)})} aria-label="Person 1 birth month" className={selectFieldClass}>
                      {months.map(m => (<option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Month</span>
                  </div>
                  <div>
                    <select value={formData1.year} onChange={(e) => setFormData1({...formData1, year: parseInt(e.target.value)})} aria-label="Person 1 birth year" className={selectFieldClass}>
                      {years.map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Year</span>
                  </div>
                </div>
              </div>
              <div>
                <Label className={fieldLabelClass}>Time of Birth</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <select value={formData1.hour} onChange={(e) => setFormData1({...formData1, hour: parseInt(e.target.value)})} aria-label="Person 1 birth hour" className={selectFieldClass}>
                      {hours.map(h => (<option key={h} value={h}>{h.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Hour</span>
                  </div>
                  <div>
                    <select value={formData1.minute} onChange={(e) => setFormData1({...formData1, minute: parseInt(e.target.value)})} aria-label="Person 1 birth minute" className={selectFieldClass}>
                      {minutes.map(m => (<option key={m} value={m}>{m.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Min</span>
                  </div>
                  <div>
                    <select value={formData1.second} onChange={(e) => setFormData1({...formData1, second: parseInt(e.target.value)})} aria-label="Person 1 birth second" className={selectFieldClass}>
                      {seconds.map(s => (<option key={s} value={s}>{s.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Sec</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className={fieldLabelClass}>Location</Label>
                <div>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
                      <input
                        type="text"
                        value={locationSearch1}
                        onChange={(e) => {
                          setLocationSearch1(e.target.value);
                          setSelectedResultIndex1(-1);
                          if (locationSearchTimerRef1.current) clearTimeout(locationSearchTimerRef1.current);
                          locationSearchTimerRef1.current = setTimeout(() => searchLocation(e.target.value, 1), 400);
                        }}
                        onKeyDown={(e) => handleLocationInputKeyDown(e, 1)}
                        onFocus={() => setShowLocationDropdown1(true)}
                        onBlur={() => window.setTimeout(() => setShowLocationDropdown1(false), 200)}
                        className="w-full h-9 bg-[hsl(24,18%,9%)] border border-amber-500/20 rounded-lg pl-8 pr-8 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-amber-500/25 focus:border-amber-500/40 transition-colors"
                        placeholder="Search city..."
                        aria-label="Search location for person 1"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      
                      {isSearching1 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-300 rounded-full animate-spin"></div>
                        </div>
                      )}
                      
                      {!isSearching1 && locationSearch1 && (
                        <button
                          type="button"
                          onClick={() => clearLocationSearch(1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-neutral-900/50 transition-colors"
                          title="Clear location"
                          aria-label="Clear person 1 location"
                        >
                          <X className="w-3.5 h-3.5 text-white/60 hover:text-white/80" />
                        </button>
                      )}
                    </div>

                    {showLocationDropdown1 && locationSuggestions1.length > 0 && (
                      <div role="listbox" aria-label="Person 1 location suggestions" className="absolute z-[9999] w-full mt-2 bg-neutral-950/95 backdrop-blur-sm border border-amber-500/20 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        <div className="p-2">
                          {locationSuggestions1.map((location, index) => {
                            const lat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
                            const lon = typeof location.lon === 'string' ? parseFloat(location.lon) : location.lon;
                            
                            return (
                              <button
                                key={`${location.lat}-${location.lon}-${location.display_name}`}
                                type="button"
                                onMouseDown={() => selectLocation(location, 1)}
                                onMouseEnter={() => setSelectedResultIndex1(index)}
                                role="option"
                                aria-selected={index === selectedResultIndex1}
                                className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                                  index === selectedResultIndex1
                                    ? 'bg-neutral-900/50 text-white'
                                    : 'text-white/80 hover:bg-neutral-900/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm truncate">
                                      {location.display_name ? location.display_name.split(',')[0] : `${lat.toFixed(2)}, ${lon.toFixed(2)}`}
                                    </div>
                                    <div className="text-xs text-white/50 truncate mt-1">
                                      {location.display_name || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-1" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {locationSearch1 && Number.isFinite(formData1.latitude) && Number.isFinite(formData1.longitude) && (
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-amber-500/20 border border-amber-500/40 rounded flex items-center justify-center">
                            <MapPin className="w-3 h-3 text-amber-300" />
                          </div>
                          <div className="text-xs text-white/60 font-mono">
                            {formData1.latitude.toFixed(4)}°, {formData1.longitude.toFixed(4)}° • TZ {formData1.tz_offset_hours > 0 ? '+' : ''}{formData1.tz_offset_hours}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
          </CardContent>
        </Card>

        {/* Person 2 Form */}
        <Card className={formPanelClass}>
          <CardHeader className="px-4 py-3 pb-2 border-b border-amber-500/15 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/25 to-yellow-500/25 border border-amber-500/30 flex items-center justify-center">
                <span className="text-amber-300 font-bold text-xs leading-none flex items-center justify-center">♀</span>
              </div>
              <CardTitle className="text-white text-sm sm:text-base">{name2 || 'Person 2'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-end gap-2">
              <div className="w-full">
                <Input
                  id="name2"
                  value={name2}
                  onChange={(e) => setName2(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleMatch(); }}
                  className="bg-[hsl(24,18%,9%)] border border-amber-500/20 text-white h-10 sm:h-9 text-sm rounded-lg focus:ring-1 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all w-full"
                  placeholder="Name"
                  aria-label="Person 2 name"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => openLoadModal(2)} className={`${actionButtonClass} px-3 justify-center flex-shrink-0`} title="Load saved chart" aria-label="Load saved chart for person 2">
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-xs ml-1 hidden sm:inline">Saved Charts</span>
                  <span className="text-xs ml-1 sm:hidden">Saved</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/30 border border-white/10 ml-1">{savedCharts.length}</span>
                </Button>
                {onSaveChart && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { void handleSavePersonChart(2); }}
                    className="gap-1 h-9 px-3 justify-center bg-amber-500/12 border border-amber-500/35 text-amber-300 hover:bg-amber-500/20 flex-shrink-0"
                    title="Save chart"
                    disabled={!name2.trim()}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span className="text-xs">Save</span>
                  </Button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className={fieldLabelClass}>Date of Birth</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <select value={formData2.day} onChange={(e) => setFormData2({...formData2, day: parseInt(e.target.value)})} aria-label="Person 2 birth day" className={selectFieldClass}>
                      {days.map(d => (<option key={d} value={d}>{d.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Day</span>
                  </div>
                  <div>
                    <select value={formData2.month} onChange={(e) => setFormData2({...formData2, month: parseInt(e.target.value)})} aria-label="Person 2 birth month" className={selectFieldClass}>
                      {months.map(m => (<option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Month</span>
                  </div>
                  <div>
                    <select value={formData2.year} onChange={(e) => setFormData2({...formData2, year: parseInt(e.target.value)})} aria-label="Person 2 birth year" className={selectFieldClass}>
                      {years.map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Year</span>
                  </div>
                </div>
              </div>
              <div>
                <Label className={fieldLabelClass}>Time of Birth</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <select value={formData2.hour} onChange={(e) => setFormData2({...formData2, hour: parseInt(e.target.value)})} aria-label="Person 2 birth hour" className={selectFieldClass}>
                      {hours.map(h => (<option key={h} value={h}>{h.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Hour</span>
                  </div>
                  <div>
                    <select value={formData2.minute} onChange={(e) => setFormData2({...formData2, minute: parseInt(e.target.value)})} aria-label="Person 2 birth minute" className={selectFieldClass}>
                      {minutes.map(m => (<option key={m} value={m}>{m.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Min</span>
                  </div>
                  <div>
                    <select value={formData2.second} onChange={(e) => setFormData2({...formData2, second: parseInt(e.target.value)})} aria-label="Person 2 birth second" className={selectFieldClass}>
                      {seconds.map(s => (<option key={s} value={s}>{s.toString().padStart(2, '0')}</option>))}
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block text-center">Sec</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className={fieldLabelClass}>Location</Label>
                <div>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
                      <input
                        type="text"
                        value={locationSearch2}
                        onChange={(e) => {
                          setLocationSearch2(e.target.value);
                          setSelectedResultIndex2(-1);
                          if (locationSearchTimerRef2.current) clearTimeout(locationSearchTimerRef2.current);
                          locationSearchTimerRef2.current = setTimeout(() => searchLocation(e.target.value, 2), 400);
                        }}
                        onKeyDown={(e) => handleLocationInputKeyDown(e, 2)}
                        onFocus={() => setShowLocationDropdown2(true)}
                        onBlur={() => window.setTimeout(() => setShowLocationDropdown2(false), 200)}
                        className="w-full h-9 bg-[hsl(24,18%,9%)] border border-amber-500/20 rounded-lg pl-8 pr-8 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-amber-500/25 focus:border-amber-500/40 transition-colors"
                        placeholder="Search city..."
                        aria-label="Search location for person 2"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      
                      {isSearching2 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-300 rounded-full animate-spin"></div>
                        </div>
                      )}
                      
                      {!isSearching2 && locationSearch2 && (
                        <button
                          type="button"
                          onClick={() => clearLocationSearch(2)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-neutral-900/50 transition-colors"
                          title="Clear location"
                          aria-label="Clear person 2 location"
                        >
                          <X className="w-3.5 h-3.5 text-white/60 hover:text-white/80" />
                        </button>
                      )}
                    </div>

                    {showLocationDropdown2 && locationSuggestions2.length > 0 && (
                      <div role="listbox" aria-label="Person 2 location suggestions" className="absolute z-[9999] w-full mt-2 bg-neutral-950/95 backdrop-blur-sm border border-amber-500/20 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        <div className="p-2">
                          {locationSuggestions2.map((location, index) => {
                            const lat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
                            const lon = typeof location.lon === 'string' ? parseFloat(location.lon) : location.lon;
                            
                            return (
                              <button
                                key={`${location.lat}-${location.lon}-${location.display_name}`}
                                type="button"
                                onMouseDown={() => selectLocation(location, 2)}
                                onMouseEnter={() => setSelectedResultIndex2(index)}
                                role="option"
                                aria-selected={index === selectedResultIndex2}
                                className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                                  index === selectedResultIndex2
                                    ? 'bg-neutral-900/50 text-white'
                                    : 'text-white/80 hover:bg-neutral-900/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm truncate">
                                      {location.display_name ? location.display_name.split(',')[0] : `${lat.toFixed(2)}, ${lon.toFixed(2)}`}
                                    </div>
                                    <div className="text-xs text-white/50 truncate mt-1">
                                      {location.display_name || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-1" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {locationSearch2 && Number.isFinite(formData2.latitude) && Number.isFinite(formData2.longitude) && (
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-amber-500/20 border border-amber-500/40 rounded flex items-center justify-center">
                            <MapPin className="w-3 h-3 text-amber-300" />
                          </div>
                          <div className="text-xs text-white/60 font-mono">
                            {formData2.latitude.toFixed(4)}°, {formData2.longitude.toFixed(4)}° • TZ {formData2.tz_offset_hours > 0 ? '+' : ''}{formData2.tz_offset_hours}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
        </CardContent>
      </Card>

      {/* Match Button */}
      <Card className="bg-[linear-gradient(160deg,rgba(14,10,6,0.93),rgba(32,20,10,0.72))] border border-amber-500/15 rounded-xl lg:col-span-2 hover:border-amber-500/30 transition-colors">
        <CardContent className="p-4 sm:p-5 flex flex-col items-center">
            <Button
              onClick={handleMatch}
              disabled={isMatching || !!(selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2)}
              aria-label={isMatching ? 'Calculating compatibility' : 'Analyze compatibility'}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-0 disabled:pointer-events-none px-6 w-full max-w-2xl h-10 text-sm font-semibold bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white border-0 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
            >
              {isMatching ? (
                <div className="w-full flex items-center justify-center gap-3 text-center">
                  <div className="w-5 h-5 border-2 border-amber-100/80 border-t-transparent rounded-full animate-spin" />
                  <span>Calculating compatibility...</span>
                </div>
              ) : (
                <div className="w-full flex items-center justify-center text-center">
                  <span>Analyze</span>
                </div>
              )}
            </Button>
            {selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2 && (
              <p className="text-center text-xs text-yellow-400/90 mt-3 flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Please select two different charts to compare
              </p>
            )}
            <p className="text-center text-[11px] text-neutral-500 mt-2">Tip: Press Ctrl/Cmd + Enter to analyze compatibility</p>
          </CardContent>
        </Card>
      </div>

      {matchError && (
        <Card className="bg-red-500/10 border border-red-500/30 rounded-2xl" role="alert">
          <CardContent className="p-4 text-red-300 text-sm flex items-center justify-between">
            <span>{matchError}</span>
            <button onClick={() => setMatchError(null)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/10 transition-colors shrink-0 ml-2" aria-label="Dismiss match error">
              <X className="w-4 h-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Match Results */}
      {matchedCharts && (
        <div className="space-y-6">
          {/* Overall Compatibility - Hero Card */}
          {compatibilityLevel && overallScore && (
            <div className="relative">
              <Card className={`relative bg-gradient-to-br ${compatibilityLevel.gradient} border-white/20 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-sm`}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent)]" />
                <CardContent className="relative p-6 sm:p-8 text-center">
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <Star className="w-5 h-5 text-yellow-300" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Cosmic Compatibility</h3>
                    <Star className="w-5 h-5 text-yellow-300" />
                  </div>

                  {/* Enhanced Circular Score */}
                  <div className="relative w-40 h-40 mx-auto mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full blur-2xl animate-pulse" />
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="54" fill="none"
                        stroke="url(#scoreGradient)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${(overallScore.score / overallScore.maxScore) * 340} 340`}
                        className="transition-all duration-1500 ease-out"
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={overallScore.color} stopOpacity="1" />
                          <stop offset="100%" stopColor={overallScore.color} stopOpacity="0.6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-white drop-shadow-lg">{Math.round((overallScore.score / overallScore.maxScore) * 100)}%</span>
                      <span className="text-xs text-white/70 font-medium">{overallScore.score}/{overallScore.maxScore} Points</span>
                    </div>
                  </div>

                  <Badge className={`${compatibilityLevel.badgeColor} text-white px-6 py-2 text-sm font-bold rounded-full shadow-lg`}>
                    {compatibilityLevel.label}
                  </Badge>
                  <p className="text-white/90 mt-4 text-sm max-w-lg mx-auto leading-relaxed drop-shadow">{compatibilityLevel.description}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Ashtakoota Guna Milan */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[linear-gradient(145deg,rgba(245,158,11,0.08),rgba(28,17,8,0.62))] p-4 sm:p-6 shadow-[0_12px_26px_rgba(0,0,0,0.22)]">
            <div className="pointer-events-none absolute -top-14 -right-12 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-12 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Ashtakoota Guna Milan</h3>
                <p className="text-[11px] text-neutral-400">Eight-factor compatibility breakdown</p>
              </div>
              <span className="text-[11px] text-amber-200 ml-auto bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30">8 Factors</span>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3">
              {matchScores.filter(s => s.category !== 'Overall Compatibility').map((score, index) => {
                const pct = score.maxScore > 0 ? (score.score / score.maxScore) * 100 : 0;
                const kootIconMap: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
                  'Varna': { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/20' },
                  'Vashya': { icon: Handshake, color: 'text-amber-300', bg: 'bg-amber-500/20' },
                  'Tara': { icon: Sparkles, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
                  'Yoni': { icon: PawPrint, color: 'text-amber-300', bg: 'bg-amber-500/20' },
                  'Graha Maitri': { icon: Globe2, color: 'text-amber-300', bg: 'bg-amber-500/20' },
                  'Gana': { icon: Users, color: 'text-amber-300', bg: 'bg-amber-500/20' },
                  'Bhakoot': { icon: Orbit, color: 'text-amber-300', bg: 'bg-amber-500/20' },
                  'Nadi': { icon: Dna, color: 'text-amber-300', bg: 'bg-amber-500/20' },
                };
                const kootInfo = kootIconMap[score.category];
                const KootIcon = kootInfo?.icon || Star;
                const kootColor = kootInfo?.color || 'text-neutral-400';
                const kootBg = kootInfo?.bg || 'bg-neutral-500/20';

                return (
                  <div key={index} className="rounded-xl border border-amber-500/20 bg-[hsl(24,16%,8%)] p-3.5 hover:border-amber-500/35 transition-colors">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className={`w-9 h-9 ${kootBg} rounded-lg flex items-center justify-center border border-amber-500/25`}>
                        <KootIcon className={`w-4 h-4 ${kootColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">{score.category}</div>
                        <div className="text-[10px] text-neutral-500 truncate">{score.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black tabular-nums leading-none" style={{ color: score.color }}>{score.score}</div>
                        <div className="text-[10px] text-neutral-500">/ {score.maxScore}</div>
                      </div>
                    </div>

                    <div className="w-full bg-black/30 rounded-full h-2.5 overflow-hidden border border-amber-500/15">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: score.color }}
                      />
                    </div>
                    <div className="mt-1.5 text-[10px] text-neutral-500">{pct.toFixed(0)}% matched</div>
                  </div>
                );
              })}
            </div>

            {overallScore && (
              <div className="relative mt-5 pt-5 border-t border-amber-500/20">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-semibold text-white">Total Cosmic Score</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black tabular-nums" style={{ color: overallScore.color }}>{overallScore.score}</span>
                    <span className="text-xs text-neutral-500">/ {overallScore.maxScore}</span>
                  </div>
                </div>
                <div className="w-full bg-black/30 rounded-full h-3.5 overflow-hidden border border-amber-500/15">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(overallScore.score / overallScore.maxScore) * 100}%`, backgroundColor: overallScore.color }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Compatibility Reading Guide */}
          <div className="rounded-2xl border border-amber-500/20 bg-[hsl(24,16%,8%)] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <h4 className="text-sm font-semibold text-white">How to read this match (simple)</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-amber-500/15 bg-[hsl(24,18%,9%)] p-3">
                <div className="text-xs font-semibold text-amber-200 mb-1">1) Start with Total Score</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">Above 70% usually means smoother daily compatibility. 55-70% is workable with communication. Below 55% needs conscious effort.</p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-[hsl(24,18%,9%)] p-3">
                <div className="text-xs font-semibold text-amber-200 mb-1">2) Check low-scoring Kootas</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">Focus on weaker factors first (especially Nadi, Bhakoot, Gana, Yoni). These point to potential friction patterns in lifestyle and temperament.</p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-[hsl(24,18%,9%)] p-3">
                <div className="text-xs font-semibold text-amber-200 mb-1">3) Use it as guidance, not fear</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">A match score is a map, not destiny. Strong communication, values, and timing can improve outcomes beyond raw numbers.</p>
              </div>
            </div>
          </div>

          {/* Enhanced Chart Comparison - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {[
              { chart: matchedCharts.chart1, name: matchedCharts.chart1Name, symbol: '♂' },
              { chart: matchedCharts.chart2, name: matchedCharts.chart2Name, symbol: '♀' },
            ].map(({ chart, name, symbol }) => {
              const panelClass = 'group relative rounded-2xl border border-amber-500/30 p-4 sm:p-5 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/15 overflow-hidden bg-amber-500/5 h-full';
              const iconWrapClass = 'w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/25 border border-amber-500/40 flex items-center justify-center';

              return (
              <div key={name} className={panelClass}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`${iconWrapClass} group-hover:scale-110 transition-transform`}>
                      <span className="text-amber-300 font-bold text-xs leading-none flex items-center justify-center drop-shadow">{symbol}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-base">{name}</h4>
                      <p className="text-[10px] text-neutral-500">{chart.birth.date} • {chart.birth.time}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between py-2 border-b border-neutral-700/40">
                      <span className="text-neutral-400 text-xs font-medium">Lagna</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{chart.lagna.sign}</span>
                        <span className="text-[10px] text-neutral-600">{chart.lagna.sign_sanskrit}</span>
                      </div>
                    </div>
                    {['Moon', 'Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'].map((planet, index) => {
                      const p = chart.planets[planet];
                      if (!p) return null;
                      return (
                        <div key={planet} className="flex items-start justify-between gap-2 py-2 border-b border-neutral-700/20 hover:bg-white/5 px-2 rounded transition-colors" style={{ animationDelay: `${index * 50}ms` }}>
                          <span className="text-neutral-400 text-xs font-medium">{planet}</span>
                          <div className="text-right flex items-center justify-end flex-wrap gap-1.5">
                            <span className="text-white font-bold text-sm">{p.sign}</span>
                            <span className="text-[10px] text-neutral-600">{p.sign_sanskrit}</span>
                            {p.nakshatra && (
                              <span className="bg-neutral-700/50 px-2 py-0.5 rounded text-[9px] text-neutral-300 max-w-[110px] truncate">{p.nakshatra}</span>
                            )}
                            {p.retrograde && <span className="text-red-400 text-[10px] font-bold bg-red-500/20 px-1.5 py-0.5 rounded">R</span>}
                            {p.exalted && <span className="text-amber-300 text-[10px] font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">E</span>}
                            {p.debilitated && <span className="text-orange-400 text-[10px] font-bold bg-orange-500/20 px-1.5 py-0.5 rounded">D</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Load Charts Modal */}
      {saveToast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 bg-[hsl(220,10%,10%)] border border-amber-500/30 rounded-xl shadow-2xl text-sm text-amber-200 flex items-center gap-2">
          <Save className="w-3.5 h-3.5" />
          {saveToast}
          <button type="button" className="ml-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-amber-300 hover:text-amber-100 hover:bg-amber-500/10" onClick={() => setSaveToast(null)} aria-label="Dismiss save message">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <LoadChartsModal
        isOpen={showLoadModal}
        charts={savedCharts}
        onLoad={handleLoadChart}
        onEdit={() => {}}
        onDelete={handleDeleteChart}
        onClose={() => setShowLoadModal(false)}
      />
    </div>
  );
}

// Helper functions for compatibility calculations

function getScoreColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 75) return '#fbbf24'; // amber
  if (percentage >= 50) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function getCompatibilityLevel(score: number, maxScore: number) {
  const percentage = (score / maxScore) * 100;
  
  if (percentage >= 80) {
    return {
      label: 'Excellent Match',
      description: 'Highly compatible with strong astrological harmony',
      gradient: 'from-amber-600/20 to-yellow-600/20',
      badgeColor: 'bg-amber-600'
    };
  } else if (percentage >= 60) {
    return {
      label: 'Good Match',
      description: 'Compatible with good potential for harmony',
      gradient: 'from-amber-600/20 to-yellow-600/20',
      badgeColor: 'bg-amber-600'
    };
  } else if (percentage >= 40) {
    return {
      label: 'Moderate Match',
      description: 'Some compatibility, may require effort and understanding',
      gradient: 'from-amber-600/20 to-orange-600/20',
      badgeColor: 'bg-amber-600'
    };
  } else {
    return {
      label: 'Challenging Match',
      description: 'Lower compatibility, requires conscious effort and compromise',
      gradient: 'from-red-600/20 to-orange-600/20',
      badgeColor: 'bg-red-600'
    };
  }
}

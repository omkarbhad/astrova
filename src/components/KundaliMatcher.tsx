import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Heart, Star, FolderOpen, Search, X, ChevronRight, MapPin } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LoadChartsModal } from './LoadChartsModal';
import { calculateKundali, calculateAshtakootMatch, estimateTimezone } from '../lib/vedic-engine';
import heartLogo from '../assets/heart_logo.png';
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
}

export function KundaliMatcher({ savedCharts, onDeleteChart }: KundaliMatcherProps) {
  const [selectedChart1, setSelectedChart1] = useState<string>('');
  const [selectedChart2, setSelectedChart2] = useState<string>('');
  const [matchedCharts, setMatchedCharts] = useState<MatchedCharts | null>(null);
  const [matchScores, setMatchScores] = useState<MatchScore[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadingForPerson, setLoadingForPerson] = useState<1 | 2>(1);
  const hasAutoLoadedRef = useRef(false);
  
  // Location search states
  const [locationSearch1, setLocationSearch1] = useState('');
  const [locationSearch2, setLocationSearch2] = useState('');
  const [locationSuggestions1, setLocationSuggestions1] = useState<any[]>([]);
  const [locationSuggestions2, setLocationSuggestions2] = useState<any[]>([]);
  const [isSearching1, setIsSearching1] = useState(false);
  const [isSearching2, setIsSearching2] = useState(false);
  const [showLocationDropdown1, setShowLocationDropdown1] = useState(false);
  const [showLocationDropdown2, setShowLocationDropdown2] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  
  // Form states for direct input
  const [formData1, setFormData1] = useState<KundaliRequest>({
    year: 1990,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    latitude: 28.6139,
    longitude: 77.2090,
    tz_offset_hours: 5.5,
    ayanamsha: 'lahiri'
  });
  
  const [formData2, setFormData2] = useState<KundaliRequest>({
    year: 1990,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    latitude: 28.6139,
    longitude: 77.2090,
    tz_offset_hours: 5.5,
    ayanamsha: 'lahiri'
  });
  
  // Dropdown option helpers
  const years = useMemo(() => {
    const start = 1900;
    const end = 2100;
    const list = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return list.includes(formData1.year) ? list : [...list, formData1.year].sort((a, b) => a - b);
  }, [formData1.year]);

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

    if (!formData1 || !formData2) return;
    if (selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2) return;

    setIsMatching(true);
    try {
      const chart1 = calculateKundali(formData1);
      const chart2 = calculateKundali(formData2);

      setMatchedCharts({
        chart1,
        chart2,
        chart1Name: name1,
        chart2Name: name2,
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
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : 'Unable to match charts');
    } finally {
      setIsMatching(false);
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

  const handleLoadChart = (chartId: string) => {
    applySavedChart(chartId, loadingForPerson);
    setShowLoadModal(false);
  };

  const openLoadModal = (personNumber: 1 | 2) => {
    setLoadingForPerson(personNumber);
    setShowLoadModal(true);
  };

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
      setSelectedResultIndex(-1);
    } else {
      setLocationSearch2('');
      setLocationSuggestions2([]);
      setShowLocationDropdown2(false);
      setSelectedResultIndex(-1);
    }
  };


  const overallScore = matchScores.find(s => s.category === 'Overall Compatibility');
  const compatibilityLevel = overallScore ? getCompatibilityLevel(overallScore.score, overallScore.maxScore) : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500/30 to-pink-500/30 border border-red-500/40 flex items-center justify-center">
            <Heart className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Kundali Matching</h2>
        </div>
        <p className="text-neutral-400 text-sm">Ashtakoot Guna Milan • 36 Points Compatibility Analysis</p>
      </div>

      {/* Birth Data Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Person 1 Form */}
        <Card className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-2xl border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/40 flex items-center justify-center">
                <span className="text-blue-300 font-bold text-lg">♂</span>
              </div>
              <div>
                <CardTitle className="text-white text-base">{name1 || 'Person 1'}</CardTitle>
                <p className="text-xs text-neutral-400 mt-0.5">Enter birth details</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="name1" className="text-sm font-medium text-neutral-300 mb-2 block">Name</Label>
                <Input
                  id="name1"
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white h-11 rounded-lg focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  placeholder="Enter name"
                  readOnly
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLoadModal(1)}
                className="gap-1 bg-neutral-200/10 border border-neutral-600/50 text-white hover:bg-neutral-200/20 hover:border-neutral-500/70 transition-all duration-200 h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Open Chart</span>
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-neutral-300 mb-3 block">Birth Date</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="day1" className="text-xs text-neutral-400 mb-1 block">Day</Label>
                    <select
                      id="day1"
                      value={formData1.day}
                      onChange={(e) => setFormData1({...formData1, day: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 text-sm text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {days.map(d => (
                        <option key={d} value={d}>{d.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="month1" className="text-xs text-neutral-400 mb-1 block">Month</Label>
                    <select
                      id="month1"
                      value={formData1.month}
                      onChange={(e) => setFormData1({...formData1, month: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 text-sm text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {months.map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="year1" className="text-xs text-neutral-400 mb-1 block">Year</Label>
                    <select
                      id="year1"
                      value={formData1.year}
                      onChange={(e) => setFormData1({...formData1, year: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 text-sm text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-300 mb-3 block">Birth Time</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="hour1" className="text-xs text-neutral-400 mb-1 block">Hour</Label>
                    <select
                      id="hour1"
                      value={formData1.hour}
                      onChange={(e) => setFormData1({...formData1, hour: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 text-sm text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {hours.map(h => (
                        <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="minute1" className="text-xs text-neutral-400 mb-1 block">Minute</Label>
                    <select
                      id="minute1"
                      value={formData1.minute}
                      onChange={(e) => setFormData1({...formData1, minute: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 text-sm text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {minutes.map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="second1" className="text-xs text-neutral-400 mb-1 block">Second</Label>
                    <select
                      id="second1"
                      value={formData1.second}
                      onChange={(e) => setFormData1({...formData1, second: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 text-sm text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {seconds.map(s => (
                        <option key={s} value={s}>{s.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-300 mb-3 block">Birth Location</Label>
                <div className="space-y-3">
                  {/* Location Search */}
                  <div className="relative mt-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                      <input
                        type="text"
                        value={locationSearch1}
                        onChange={(e) => {
                          setLocationSearch1(e.target.value);
                          searchLocation(e.target.value, 1);
                        }}
                        onFocus={() => setShowLocationDropdown1(true)}
                        onBlur={() => window.setTimeout(() => setShowLocationDropdown1(false), 200)}
                        className="w-full bg-neutral-900/40 border border-violet-500/20 rounded-lg pl-10 pr-10 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500/40 transition-colors"
                        placeholder="Search city or place..."
                      />
                      
                      {isSearching1 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-300 rounded-full animate-spin"></div>
                        </div>
                      )}
                      
                      {!isSearching1 && locationSearch1 && (
                        <button
                          type="button"
                          onClick={() => clearLocationSearch(1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-neutral-900/50 transition-colors"
                          title="Clear location"
                        >
                          <X className="w-4 h-4 text-white/60 hover:text-white/80" />
                        </button>
                      )}
                    </div>

                    {showLocationDropdown1 && locationSuggestions1.length > 0 && (
                      <div className="absolute z-[9999] w-full mt-2 bg-neutral-950/95 backdrop-blur-sm border border-violet-500/20 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        <div className="p-2">
                          {locationSuggestions1.map((location, index) => {
                            const lat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
                            const lon = typeof location.lon === 'string' ? parseFloat(location.lon) : location.lon;
                            
                            return (
                              <button
                                key={index}
                                type="button"
                                onMouseDown={() => selectLocation(location, 1)}
                                onMouseEnter={() => setSelectedResultIndex(index)}
                                className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                                  index === selectedResultIndex
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
                          <div className="w-6 h-6 bg-blue-500/20 border border-blue-500/40 rounded flex items-center justify-center">
                            <MapPin className="w-3 h-3 text-blue-300" />
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
        <Card className="bg-gradient-to-br from-pink-500/5 to-rose-500/5 rounded-2xl border-pink-500/20 hover:border-pink-500/40 transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/30 to-rose-500/30 border border-pink-500/40 flex items-center justify-center">
                <span className="text-pink-300 font-bold text-lg">♀</span>
              </div>
              <div>
                <CardTitle className="text-white text-base">{name2 || 'Person 2'}</CardTitle>
                <p className="text-xs text-neutral-400 mt-0.5">Enter birth details</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="name2" className="text-sm font-medium text-neutral-300 mb-2 block">Name</Label>
                <Input
                  id="name2"
                  value={name2}
                  onChange={(e) => setName2(e.target.value)}
                  className="bg-neutral-800/50 border-violet-500/20 text-white h-11 rounded-lg focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all"
                  placeholder="Enter name"
                  readOnly
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLoadModal(2)}
                className="gap-1 bg-neutral-200/10 border border-neutral-600/50 text-white hover:bg-neutral-200/20 hover:border-neutral-500/70 transition-all duration-200 h-8 w-8 p-0 justify-center sm:w-auto sm:px-2 whitespace-nowrap"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Open Chart</span>
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-neutral-300 mb-3 block">Birth Date</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="day2" className="text-xs text-neutral-400 mb-1 block">Day</Label>
                    <select
                      id="day2"
                      value={formData2.day}
                      onChange={(e) => setFormData2({...formData2, day: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 text-sm text-white focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {days.map(d => (
                        <option key={d} value={d}>{d.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="month2" className="text-xs text-neutral-400 mb-1 block">Month</Label>
                    <select
                      id="month2"
                      value={formData2.month}
                      onChange={(e) => setFormData2({...formData2, month: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 text-sm text-white focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {months.map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="year2" className="text-xs text-neutral-400 mb-1 block">Year</Label>
                    <select
                      id="year2"
                      value={formData2.year}
                      onChange={(e) => setFormData2({...formData2, year: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 text-sm text-white focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-300 mb-3 block">Birth Time</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="hour2" className="text-xs text-neutral-400 mb-1 block">Hour</Label>
                    <select
                      id="hour2"
                      value={formData2.hour}
                      onChange={(e) => setFormData2({...formData2, hour: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 text-sm text-white focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {hours.map(h => (
                        <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="minute2" className="text-xs text-neutral-400 mb-1 block">Minute</Label>
                    <select
                      id="minute2"
                      value={formData2.minute}
                      onChange={(e) => setFormData2({...formData2, minute: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 text-sm text-white focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {minutes.map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="second2" className="text-xs text-neutral-400 mb-1 block">Second</Label>
                    <select
                      id="second2"
                      value={formData2.second}
                      onChange={(e) => setFormData2({...formData2, second: parseInt(e.target.value)})}
                      className="w-full h-10 bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 text-sm text-white focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all appearance-none cursor-pointer"
                    >
                      {seconds.map(s => (
                        <option key={s} value={s}>{s.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-300 mb-3 block">Birth Location</Label>
                <div className="space-y-3">
                  {/* Location Search */}
                  <div className="relative mt-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                      <input
                        type="text"
                        value={locationSearch2}
                        onChange={(e) => {
                          setLocationSearch2(e.target.value);
                          searchLocation(e.target.value, 2);
                        }}
                        onFocus={() => setShowLocationDropdown2(true)}
                        onBlur={() => window.setTimeout(() => setShowLocationDropdown2(false), 200)}
                        className="w-full bg-neutral-900/40 border border-violet-500/20 rounded-lg pl-10 pr-10 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-500/40 transition-colors"
                        placeholder="Search city or place..."
                      />
                      
                      {isSearching2 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-300 rounded-full animate-spin"></div>
                        </div>
                      )}
                      
                      {!isSearching2 && locationSearch2 && (
                        <button
                          type="button"
                          onClick={() => clearLocationSearch(2)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-neutral-900/50 transition-colors"
                          title="Clear location"
                        >
                          <X className="w-4 h-4 text-white/60 hover:text-white/80" />
                        </button>
                      )}
                    </div>

                    {showLocationDropdown2 && locationSuggestions2.length > 0 && (
                      <div className="absolute z-[9999] w-full mt-2 bg-neutral-950/95 backdrop-blur-sm border border-violet-500/20 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        <div className="p-2">
                          {locationSuggestions2.map((location, index) => {
                            const lat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
                            const lon = typeof location.lon === 'string' ? parseFloat(location.lon) : location.lon;
                            
                            return (
                              <button
                                key={index}
                                type="button"
                                onMouseDown={() => selectLocation(location, 2)}
                                onMouseEnter={() => setSelectedResultIndex(index)}
                                className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                                  index === selectedResultIndex
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
                          <div className="w-6 h-6 bg-pink-500/20 border border-pink-500/40 rounded flex items-center justify-center">
                            <MapPin className="w-3 h-3 text-pink-300" />
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
      </div>

      {/* Match Button */}
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-pink-500/20 to-red-500/20 rounded-2xl blur-lg opacity-60" />
        <Card className="relative bg-neutral-900/60 rounded-2xl border-neutral-700/50">
          <CardContent className="p-4">
            <Button
              onClick={handleMatch}
              disabled={isMatching || !!(selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2)}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 border-0 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
              size="lg"
            >
              {isMatching ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  Analyzing Compatibility...
                </div>
              ) : (
                <>
                  <img src={heartLogo} alt="Heart" className="w-5 h-5 mr-2" />
                  Analyze Compatibility
                </>
              )}
            </Button>
            {selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2 && (
              <p className="text-center text-xs text-yellow-400/80 mt-2">Please select two different charts to compare</p>
            )}
          </CardContent>
        </Card>
      </div>

      {matchError && (
        <Card className="bg-red-500/10 border border-red-500/30 rounded-2xl">
          <CardContent className="p-4 text-red-300 text-sm text-center">
            {matchError}
          </CardContent>
        </Card>
      )}

      {/* Match Results */}
      {matchedCharts && (
        <div className="space-y-6">
          {/* Overall Compatibility - Hero Card */}
          {compatibilityLevel && overallScore && (
            <div className="relative">
              <div className={`absolute -inset-1 bg-gradient-to-r ${compatibilityLevel.gradient} rounded-3xl blur-xl opacity-40`} />
              <Card className={`relative bg-gradient-to-br ${compatibilityLevel.gradient} border-neutral-700/30 rounded-2xl shadow-2xl overflow-hidden`}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent)]" />
                <CardContent className="relative p-8 text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-white/80 uppercase tracking-wider">Overall Compatibility</h3>
                    <Star className="w-5 h-5 text-yellow-400" />
                  </div>

                  {/* Circular Score */}
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                      <circle
                        cx="60" cy="60" r="52" fill="none"
                        stroke={overallScore.color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(overallScore.score / overallScore.maxScore) * 327} 327`}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white">{Math.round((overallScore.score / overallScore.maxScore) * 100)}%</span>
                      <span className="text-xs text-white/60">{overallScore.score}/{overallScore.maxScore}</span>
                    </div>
                  </div>

                  <Badge className={`${compatibilityLevel.badgeColor} text-white px-4 py-1.5 text-sm font-semibold rounded-full`}>
                    {compatibilityLevel.label}
                  </Badge>
                  <p className="text-neutral-200/80 mt-3 text-sm max-w-md mx-auto">{compatibilityLevel.description}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Ashtakoota Score Breakdown */}
          <div className="bg-neutral-900/40 rounded-2xl border border-neutral-700/40 p-5">
            <div className="flex items-center gap-2 mb-5">
              <Star className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold text-base">Ashtakoota Guna Milan</h3>
              <span className="text-xs text-neutral-500 ml-auto">8 compatibility factors</span>
            </div>
            <div className="space-y-3">
              {matchScores.filter(s => s.category !== 'Overall Compatibility').map((score, index) => {
                const pct = score.maxScore > 0 ? (score.score / score.maxScore) * 100 : 0;
                const kootIcons: Record<string, string> = {
                  'Varna': '🕉️', 'Vashya': '🤝', 'Tara': '⭐', 'Yoni': '🐾',
                  'Graha Maitri': '🪐', 'Gana': '👤', 'Bhakoot': '💫', 'Nadi': '🧬',
                };
                return (
                  <div key={index} className="group">
                    <div className="flex items-center gap-3">
                      <span className="text-sm w-5 text-center">{kootIcons[score.category] || '•'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{score.category}</span>
                            <span className="text-[10px] text-neutral-500 hidden sm:inline">{score.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tabular-nums" style={{ color: score.color }}>{score.score}</span>
                            <span className="text-[10px] text-neutral-600">/ {score.maxScore}</span>
                          </div>
                        </div>
                        <div className="w-full bg-neutral-800/60 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: score.color }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Total bar */}
            {overallScore && (
              <div className="mt-5 pt-4 border-t border-neutral-700/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">Total Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold" style={{ color: overallScore.color }}>{overallScore.score}</span>
                    <span className="text-sm text-neutral-500">/ {overallScore.maxScore}</span>
                  </div>
                </div>
                <div className="w-full bg-neutral-800/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${(overallScore.score / overallScore.maxScore) * 100}%`, backgroundColor: overallScore.color }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chart Comparison - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Person 1 */}
            <div className="rounded-xl border border-blue-500/20 p-4" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.05), transparent)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <span className="text-blue-300 font-bold text-sm">♂</span>
                </div>
                <span className="text-white font-semibold text-sm">{matchedCharts.chart1Name}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><span className="text-neutral-500">Lagna:</span> <span className="text-white font-medium">{matchedCharts.chart1.lagna.sign}</span></div>
                <div><span className="text-neutral-500">Moon:</span> <span className="text-white font-medium">{matchedCharts.chart1.planets.Moon?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Sun:</span> <span className="text-white font-medium">{matchedCharts.chart1.planets.Sun?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Venus:</span> <span className="text-white font-medium">{matchedCharts.chart1.planets.Venus?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Mars:</span> <span className="text-white font-medium">{matchedCharts.chart1.planets.Mars?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Jupiter:</span> <span className="text-white font-medium">{matchedCharts.chart1.planets.Jupiter?.sign || '?'}</span></div>
                <div className="col-span-2 pt-1 border-t border-neutral-800/40 text-[10px] text-neutral-500">
                  {matchedCharts.chart1.birth.date} • {matchedCharts.chart1.birth.time}
                </div>
              </div>
            </div>
            {/* Person 2 */}
            <div className="rounded-xl border border-pink-500/20 p-4" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.05), transparent)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
                  <span className="text-pink-300 font-bold text-sm">♀</span>
                </div>
                <span className="text-white font-semibold text-sm">{matchedCharts.chart2Name}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><span className="text-neutral-500">Lagna:</span> <span className="text-white font-medium">{matchedCharts.chart2.lagna.sign}</span></div>
                <div><span className="text-neutral-500">Moon:</span> <span className="text-white font-medium">{matchedCharts.chart2.planets.Moon?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Sun:</span> <span className="text-white font-medium">{matchedCharts.chart2.planets.Sun?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Venus:</span> <span className="text-white font-medium">{matchedCharts.chart2.planets.Venus?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Mars:</span> <span className="text-white font-medium">{matchedCharts.chart2.planets.Mars?.sign || '?'}</span></div>
                <div><span className="text-neutral-500">Jupiter:</span> <span className="text-white font-medium">{matchedCharts.chart2.planets.Jupiter?.sign || '?'}</span></div>
                <div className="col-span-2 pt-1 border-t border-neutral-800/40 text-[10px] text-neutral-500">
                  {matchedCharts.chart2.birth.date} • {matchedCharts.chart2.birth.time}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Load Charts Modal */}
      <LoadChartsModal
        isOpen={showLoadModal}
        charts={savedCharts}
        onLoad={handleLoadChart}
        onEdit={() => {}} // No edit functionality in matcher
        onDelete={handleDeleteChart}
        onClose={() => setShowLoadModal(false)}
      />
    </div>
  );
}

// Helper functions for compatibility calculations

function getScoreColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 75) return '#10b981'; // green
  if (percentage >= 50) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function getCompatibilityLevel(score: number, maxScore: number) {
  const percentage = (score / maxScore) * 100;
  
  if (percentage >= 80) {
    return {
      label: 'Excellent Match',
      description: 'Highly compatible with strong astrological harmony',
      gradient: 'from-green-600/20 to-emerald-600/20',
      badgeColor: 'bg-green-600'
    };
  } else if (percentage >= 60) {
    return {
      label: 'Good Match',
      description: 'Compatible with good potential for harmony',
      gradient: 'from-blue-600/20 to-cyan-600/20',
      badgeColor: 'bg-blue-600'
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
      gradient: 'from-red-600/20 to-pink-600/20',
      badgeColor: 'bg-red-600'
    };
  }
}

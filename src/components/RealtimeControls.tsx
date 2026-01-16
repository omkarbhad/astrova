import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clock, MapPin, Calendar, Sliders, Sparkles, Search, X, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { apiRequest } from '../config/api';
import type { KundaliRequest } from '../types/kundali';

interface RealtimeControlsProps {
  data: KundaliRequest;
  onChange: (data: KundaliRequest) => void;
  showHeader?: boolean;
  showLocation?: boolean;
  compact?: boolean;
  onLocationNameChange?: (name: string) => void;
  locationName?: string;
  showSliders?: boolean;
  onGenerate?: () => void;
}

export function RealtimeControls({ data, onChange, showHeader = true, showLocation = true, compact = false, onLocationNameChange, locationName, showSliders = true, onGenerate }: RealtimeControlsProps) {
  const [localData, setLocalData] = useState(data);
  const isDraggingRef = useRef(false);
  const pendingUpdateRef = useRef<KundaliRequest | null>(null);
  const isInternalUpdateRef = useRef(false);
  const lastSentRef = useRef<string>('');

  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Update local data when prop changes (but not if we just sent this update)
  useEffect(() => {
    const dataKey = JSON.stringify(data);
    if (dataKey !== lastSentRef.current) {
      const id = window.setTimeout(() => {
        // A parent-driven data change (e.g. loading a saved chart).
        // Clear any pending/debounced update so we don't overwrite the loaded values.
        pendingUpdateRef.current = null;
        isInternalUpdateRef.current = false;
        isDraggingRef.current = false;
        setLocalData(data);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [data]);

  // Only fire onChange when user actually changes something (not on prop sync)
  const fireUpdate = useCallback((newData: KundaliRequest) => {
    const dataKey = JSON.stringify(newData);
    if (dataKey !== lastSentRef.current) {
      lastSentRef.current = dataKey;
      onChange(newData);
    }
  }, [onChange]);

  const updateField = <K extends keyof KundaliRequest>(field: K, value: KundaliRequest[K]) => {
    isInternalUpdateRef.current = true;
    setLocalData(prev => {
      const newData = { ...prev, [field]: value };
      // For non-slider inputs, debounce the update
      if (!isDraggingRef.current) {
        pendingUpdateRef.current = newData;
      }
      return newData;
    });
  };

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setLocationSearchResults([]);
      setShowLocationResults(false);
      return;
    }
    setLocationSearchLoading(true);
    try {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      searchAbortRef.current = new AbortController();
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { signal: searchAbortRef.current.signal }
      );
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setLocationSearchResults(data);
      setShowLocationResults(true);
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        setLocationSearchResults([]);
        setShowLocationResults(false);
      }
    } finally {
      setLocationSearchLoading(false);
    }
  }, []);

  const handleLocationSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setLocationSearchQuery(q);
    setSelectedResultIndex(-1);
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      searchLocation(q);
    }, 400);
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showLocationResults || locationSearchResults.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedResultIndex(prev => (prev + 1) % locationSearchResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedResultIndex(prev => prev <= 0 ? locationSearchResults.length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedResultIndex >= 0) {
          handleLocationSearchSelect(locationSearchResults[selectedResultIndex]);
        }
        break;
      case 'Escape':
        setShowLocationResults(false);
        setSelectedResultIndex(-1);
        break;
    }
  };

  const clearLocation = () => {
    setLocationSearchQuery('');
    setShowLocationResults(false);
    setSelectedResultIndex(-1);
    onLocationNameChange?.('');
    const newData = { ...localData, latitude: 0, longitude: 0, tz_offset_hours: 0 };
    setLocalData(newData);
    fireUpdate(newData);
  };

  const handleLocationSearchSelect = async (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    onLocationNameChange?.(result.display_name);

    // Lookup timezone for the selected coordinates via backend (accurate, supports half-hour offsets)
    let tz = localData.tz_offset_hours; // fallback to current TZ
    try {
      const query = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        year: String(localData.year),
        month: String(localData.month),
        day: String(localData.day),
        hour: String(localData.hour),
        minute: String(localData.minute),
        second: String(localData.second),
      });
      const tzRes = await fetch(apiRequest(`/api/timezone?${query.toString()}`));
      if (tzRes.ok) {
        const tzData: { tz_offset_hours?: number } = await tzRes.json();
        if (typeof tzData.tz_offset_hours === 'number' && Number.isFinite(tzData.tz_offset_hours)) {
          tz = tzData.tz_offset_hours;
        }
      }
    } catch {
      // ignore timezone lookup errors
    }

    const newData = { ...localData, latitude: lat, longitude: lon, tz_offset_hours: tz };
    // Apply immediately (avoid debounce so Save captures correct coordinates)
    pendingUpdateRef.current = null;
    isInternalUpdateRef.current = false;
    setLocalData(newData);
    fireUpdate(newData);
    setLocationSearchQuery(result.display_name.split(',')[0] ?? '');
    setShowLocationResults(false);
    setSelectedResultIndex(-1);
  };

  // Debounced updates for text inputs only
  useEffect(() => {
    if (isDraggingRef.current || !isInternalUpdateRef.current) {
      return;
    }
    const timeoutId = setTimeout(() => {
      if (pendingUpdateRef.current) {
        fireUpdate(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
      isInternalUpdateRef.current = false;
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [localData, fireUpdate]);

  const handleSliderStart = useCallback(() => {
    isDraggingRef.current = true;
    isInternalUpdateRef.current = true;
  }, []);

  const handleSliderEnd = useCallback(() => {
    isDraggingRef.current = false;
    // Fire update with current local data on slider release
    fireUpdate(localData);
    isInternalUpdateRef.current = false;
  }, [fireUpdate, localData]);

  const containerClassName = compact
    ? 'grid grid-cols-1 lg:grid-cols-3 gap-3'
    : 'grid grid-cols-1 lg:grid-cols-3 gap-4';

  const cardClassName = `bg-neutral-900/60 rounded-xl ${compact ? 'p-2' : 'p-3'} border border-neutral-700/50 hover:border-neutral-600/80 transition-colors`;

  // Dropdown option helpers
  const years = useMemo(() => {
    const start = 1900;
    const end = 2100;
    const list = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return list.includes(localData.year) ? list : [...list, localData.year].sort((a, b) => a - b);
  }, [localData.year]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const seconds = minutes;

  return (
    <div className={containerClassName}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Birth Details</h3>
          </div>
          {!showSliders && onGenerate && (
            <Button onClick={onGenerate} size="sm" className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              Generate Kundali
            </Button>
          )}
        </div>
      )}

      {/* Date Controls */}
      <div className={cardClassName}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-700/50 border border-neutral-600/50 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Date</h4>
              <div className="text-xs text-white/50 mt-0.5">Birth date</div>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg">
            <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-blue-300 tabular-nums`}>
              {localData.day}/{localData.month}/{localData.year}
            </div>
          </div>
        </div>
        <div className={compact ? 'grid grid-cols-3 gap-1 mb-0.5' : 'grid grid-cols-3 gap-1.5 mb-1'}>
          <div>
            <label className="block text-xs text-text-muted mb-1">Year</label>
            <div className="relative">
              <select
                value={localData.year}
                onChange={e => updateField('year', parseInt(e.target.value, 10))}
                className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 appearance-none transition-colors"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Month</label>
            <div className="relative">
              <select
                value={localData.month}
                onChange={e => updateField('month', parseInt(e.target.value, 10))}
                className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 appearance-none transition-colors"
              >
                {months.map(m => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Day</label>
            <div className="relative">
              <select
                value={localData.day}
                onChange={e => updateField('day', parseInt(e.target.value, 10))}
                className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 appearance-none transition-colors"
              >
                {days.map(d => (
                  <option key={d} value={d}>{d.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            </div>
          </div>
        </div>

        {showSliders && (
          <div className={compact ? 'space-y-1' : 'space-y-2'}>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-text-muted">Year</span>
                <input
                  type="range"
                  min="1900"
                  max="2100"
                  value={localData.year}
                  onChange={e => updateField('year', parseInt(e.target.value))}
                  onMouseDown={handleSliderStart}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchEnd={handleSliderEnd}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">Month</span>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={localData.month}
                  onChange={e => updateField('month', parseInt(e.target.value))}
                  onMouseDown={handleSliderStart}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchEnd={handleSliderEnd}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">Day</span>
                <input
                  type="range"
                  min="1"
                  max="31"
                  value={localData.day}
                  onChange={e => updateField('day', parseInt(e.target.value))}
                  onMouseDown={handleSliderStart}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchEnd={handleSliderEnd}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Time Controls */}
      <div className={cardClassName}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-700/50 border border-neutral-600/50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Time</h4>
              <div className="text-xs text-white/50 mt-0.5">Birth time</div>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg">
            <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-blue-300 tabular-nums`}>
              {localData.hour.toString().padStart(2, '0')}:{localData.minute.toString().padStart(2, '0')}:{localData.second.toString().padStart(2, '0')}
            </div>
          </div>
        </div>
        <div className={compact ? 'grid grid-cols-3 gap-1.5 mb-1' : 'grid grid-cols-3 gap-2 mb-2'}>
          <div>
            <label className="block text-xs text-text-muted mb-1">Hour</label>
            <div className="relative">
              <select
                value={localData.hour}
                onChange={e => updateField('hour', parseInt(e.target.value))}
                className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 appearance-none transition-colors"
              >
                {hours.map(h => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Minute</label>
            <div className="relative">
              <select
                value={localData.minute}
                onChange={e => updateField('minute', parseInt(e.target.value))}
                className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 appearance-none transition-colors"
              >
                {minutes.map(m => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Second</label>
            <div className="relative">
              <select
                value={localData.second}
                onChange={e => updateField('second', parseInt(e.target.value))}
                className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 appearance-none transition-colors"
              >
                {seconds.map(s => (
                  <option key={s} value={s}>{s.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            </div>
          </div>
        </div>

        {showSliders && (
          <div className={compact ? 'space-y-1' : 'space-y-2'}>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-text-muted">Hour</span>
                <input
                  type="range"
                  min="0"
                  max="23"
                  value={localData.hour}
                  onChange={e => updateField('hour', parseInt(e.target.value))}
                  onMouseDown={handleSliderStart}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchEnd={handleSliderEnd}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">Min</span>
                <input
                  type="range"
                  min="0"
                  max="59"
                  value={localData.minute}
                  onChange={e => updateField('minute', parseInt(e.target.value))}
                  onMouseDown={handleSliderStart}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchEnd={handleSliderEnd}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">Sec</span>
                <input
                  type="range"
                  min="0"
                  max="59"
                  value={localData.second}
                  onChange={e => updateField('second', parseInt(e.target.value))}
                  onMouseDown={handleSliderStart}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={handleSliderStart}
                  onTouchEnd={handleSliderEnd}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Location Controls */}
      {showLocation && (
        <div className={cardClassName}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-700/50 border border-neutral-600/50 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Location</h4>
                <div className="text-xs text-white/50 mt-0.5">Birth place</div>
              </div>
            </div>
            {locationName && (
              <div className="px-3 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg w-full max-w-[140px] min-w-[80px] sm:max-w-[180px]">
                <div className="text-xs font-bold text-blue-300 leading-tight whitespace-normal">
                  {locationName}
                </div>
              </div>
            )}
          </div>
          
          {/* Search at top */}
          <div className="relative mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                ref={locationInputRef}
                type="text"
                placeholder="Search city or place..."
                value={locationSearchQuery}
                onChange={handleLocationSearchChange}
                onKeyDown={handleLocationKeyDown}
                onFocus={() => setShowLocationResults(true)}
                onBlur={() => window.setTimeout(() => setShowLocationResults(false), 200)}
                className={`w-full bg-neutral-900/40 border border-neutral-800/50 rounded-lg pl-10 pr-10 ${
                  compact ? 'py-2' : 'py-2.5'
                } text-sm text-white placeholder-white/40 focus:outline-none focus:border-neutral-700/60 transition-colors`}
              />
              
              {locationSearchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-neutral-700/60 border-t-white/60 rounded-full animate-spin"></div>
                </div>
              )}
              
              {!locationSearchLoading && locationName && (
                <button
                  type="button"
                  onClick={clearLocation}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-neutral-900/50 transition-colors"
                  title="Clear location"
                >
                  <X className="w-4 h-4 text-white/60 hover:text-white/80" />
                </button>
              )}
            </div>

            {showLocationResults && locationSearchResults.length > 0 && (
              <div className="absolute z-[9999] w-full mt-2 bg-neutral-950/95 backdrop-blur-sm border border-neutral-800 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                <div className="p-2">
                  {locationSearchResults.map((result, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={() => handleLocationSearchSelect(result)}
                      onMouseEnter={() => setSelectedResultIndex(idx)}
                      className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                        idx === selectedResultIndex
                          ? 'bg-neutral-900/50 text-white'
                          : 'text-white/80 hover:bg-neutral-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{result.display_name.split(',')[0]}</div>
                          <div className="text-xs text-white/50 truncate mt-1">{result.display_name}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selected place details */}
          {locationName && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500/20 border border-blue-500/40 rounded flex items-center justify-center">
                  <MapPin className="w-3 h-3 text-blue-300" />
                </div>
                <div className="text-xs text-white/60 font-mono">
                  {localData.latitude.toFixed(4)}°, {localData.longitude.toFixed(4)}° • TZ {localData.tz_offset_hours > 0 ? '+' : ''}{localData.tz_offset_hours}
                </div>
              </div>
            </div>
          )}

          {/* Popular Cities */}
          {!compact && (
            <div className="pt-1">
              <div className="text-xs text-white/50 mb-1.5 font-medium">Popular Cities</div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { name: 'Mumbai', display: 'Mumbai, Maharashtra, India', lat: '19.076', lon: '72.8777' },
                  { name: 'Delhi', display: 'Delhi, India', lat: '28.6139', lon: '77.209' },
                  { name: 'Bangalore', display: 'Bengaluru, Karnataka, India', lat: '12.9716', lon: '77.5946' },
                  { name: 'Kolkata', display: 'Kolkata, West Bengal, India', lat: '22.5726', lon: '88.3639' },
                ].map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() =>
                      handleLocationSearchSelect({
                        display_name: city.display,
                        lat: city.lat,
                        lon: city.lon,
                      })
                    }
                    className="px-2 py-1 text-xs bg-neutral-900/40 border border-neutral-800/50 rounded-lg hover:bg-neutral-900/50 hover:border-neutral-700/60 transition-all text-white/80 hover:text-white"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

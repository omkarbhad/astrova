import { useState } from 'react';
import axios from 'axios';
import { Calculator, Download, TrendingUp, Clock, Calendar, ExternalLink } from 'lucide-react';
import { apiRequest } from '../config/api';

interface BalaCalculatorRequest {
  start_year: number;
  end_year: number;
  latitude: number;
  longitude: number;
  tz_offset_hours: number;
  ayanamsha: string;
  include_hours: boolean;
}

interface BalaResult {
  datetime: string;
  shad_bala: {
    totals: Record<string, number>;
    total: number;
  };
  bhava_bala: {
    totals: Record<string, number>;
    total: number;
  };
}

interface BalaCalculatorResponse {
  request_params: BalaCalculatorRequest;
  total_calculations: number;
  results: BalaResult[];
}

interface BalaCalculatorProps {
  onOpenKundali?: (datetime: string, latitude: number, longitude: number, tzOffset: number) => void;
}

export function BalaCalculator({ onOpenKundali }: BalaCalculatorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BalaCalculatorResponse | null>(null);
  const [selectedPlanets, setSelectedPlanets] = useState<Set<string>>(new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu']));
  const [formData, setFormData] = useState<BalaCalculatorRequest>({
    start_year: 2024,
    end_year: 2024,
    latitude: 19.0760,
    longitude: 72.8777,
    tz_offset_hours: 5.5,
    ayanamsha: 'lahiri',
    include_hours: true
  });

  const ALL_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu'];

  const handlePlanetToggle = (planet: string) => {
    setSelectedPlanets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planet)) {
        newSet.delete(planet);
      } else {
        newSet.add(planet);
      }
      return newSet;
    });
  };

  const handleInputChange = (field: keyof BalaCalculatorRequest, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value as BalaCalculatorRequest[typeof field]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(apiRequest('/api/bala-calculator'), formData);
      setResults(response.data);
    } catch (err: unknown) {
      const message =
        (axios.isAxiosError(err) && (err.response?.data as { detail?: string } | undefined)?.detail) ||
        'Failed to calculate Bala values';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;

    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const tempAnchor = document.createElement('a');
    tempAnchor.href = url;
    tempAnchor.download = `bala-calculator-${formData.start_year}-${formData.end_year}.json`;
    tempAnchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  const getMaxShadBalaTime = () => {
    if (!results?.results.length) return null;
    
    return results.results.reduce((max, current) => 
      current.shad_bala.total > max.shad_bala.total ? current : max
    );
  };

  const getMaxBhavaBalaTime = () => {
    if (!results?.results.length) return null;
    
    return results.results.reduce((max, current) => 
      current.bhava_bala.total > max.bhava_bala.total ? current : max
    );
  };

  const getTopShadBalaTimes = (count: number = 10) => {
    if (!results?.results.length) return [];
    
    return [...results.results]
      .sort((a, b) => b.shad_bala.total - a.shad_bala.total)
      .slice(0, count);
  };

  const getTopBhavaBalaTimes = (count: number = 10) => {
    if (!results?.results.length) return [];
    
    return [...results.results]
      .sort((a, b) => b.bhava_bala.total - a.bhava_bala.total)
      .slice(0, count);
  };

  const getTopCombinedBalaTimes = (count: number = 10) => {
    if (!results?.results.length) return [];
    
    return [...results.results]
      .sort((a, b) => (b.shad_bala.total + b.bhava_bala.total) - (a.shad_bala.total + a.bhava_bala.total))
      .slice(0, count);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-surface/30 rounded-2xl p-6 border border-neutral-800/50">
        <div className="flex items-center gap-3 mb-6">
          <Calculator className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Shad Bala & Bhava Bala Calculator</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Year</label>
              <input
                type="number"
                min="1"
                max="3000"
                value={formData.start_year}
                onChange={(e) => handleInputChange('start_year', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Year</label>
              <input
                type="number"
                min="1"
                max="3000"
                value={formData.end_year}
                onChange={(e) => handleInputChange('end_year', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Latitude</label>
              <input
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={formData.latitude}
                onChange={(e) => handleInputChange('latitude', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Longitude</label>
              <input
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={formData.longitude}
                onChange={(e) => handleInputChange('longitude', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Timezone Offset (hours)</label>
              <input
                type="number"
                step="0.5"
                min="-12"
                max="14"
                value={formData.tz_offset_hours}
                onChange={(e) => handleInputChange('tz_offset_hours', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ayanamsha</label>
              <select
                value={formData.ayanamsha}
                onChange={(e) => handleInputChange('ayanamsha', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="lahiri">Lahiri</option>
                <option value="raman">Raman</option>
                <option value="krishnamurti">Krishnamurti</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="include_hours"
              checked={formData.include_hours}
              onChange={(e) => handleInputChange('include_hours', e.target.checked)}
              className="w-4 h-4 text-primary bg-background border-neutral-800 rounded focus:ring-primary"
            />
            <label htmlFor="include_hours" className="text-sm font-medium">
              Include hourly calculations (warning: may generate large datasets)
            </label>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Calculate Bala
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
            {error}
          </div>
        )}
      </div>

      {results && (
        <div className="space-y-6">
          <div className="bg-surface/30 rounded-2xl p-6 border border-neutral-800/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Calculation Results</h2>
              <button
                onClick={downloadResults}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download JSON
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-text-muted mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Total Calculations</span>
                </div>
                <div className="text-2xl font-bold">{results.total_calculations.toLocaleString()}</div>
              </div>

              <div className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-text-muted mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Date Range</span>
                </div>
                <div className="text-sm">
                  {results.request_params.start_year} - {results.request_params.end_year}
                </div>
              </div>

              <div className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-text-muted mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Max Shad Bala</span>
                </div>
                <div className="text-lg font-semibold">
                  {getMaxShadBalaTime()?.shad_bala.total.toFixed(2)}
                </div>
                <div className="text-xs text-text-muted">
                  {new Date(getMaxShadBalaTime()?.datetime || '').toLocaleString()}
                </div>
              </div>

              <div className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-text-muted mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Max Bhava Bala</span>
                </div>
                <div className="text-lg font-semibold">
                  {getMaxBhavaBalaTime()?.bhava_bala.total.toFixed(2)}
                </div>
                <div className="text-xs text-text-muted">
                  {new Date(getMaxBhavaBalaTime()?.datetime || '').toLocaleString()}
                </div>
              </div>
            </div>

            {/* Planet Selection Filter */}
            <div className="bg-surface/30 rounded-2xl p-4 border border-neutral-800/50">
              <h3 className="text-lg font-semibold mb-4">Select Planets for Scores</h3>
              <div className="grid grid-cols-4 gap-2">
                {ALL_PLANETS.map(planet => (
                  <label key={planet} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPlanets.has(planet)}
                      onChange={() => handlePlanetToggle(planet)}
                      className="rounded border-neutral-800/50 bg-surface/50 text-primary focus:ring-primary/50"
                    />
                    <span className="text-sm text-white">{planet}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => setSelectedPlanets(new Set(ALL_PLANETS))}
                  className="px-3 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 text-sm"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedPlanets(new Set())}
                  className="px-3 py-1 bg-secondary/20 text-secondary rounded hover:bg-secondary/30 text-sm"
                >
                  Clear All
                </button>
                <span className="text-sm text-gray-400">
                  {selectedPlanets.size} planet{selectedPlanets.size !== 1 ? 's' : ''} selected
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Top 10 Shad Bala Scores */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Top 300 Highest Shad Bala Scores
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800/50">
                        <th className="text-left p-2">Rank</th>
                        <th className="text-left p-2">Date & Time</th>
                        <th className="text-right p-2">Total Shad Bala</th>
                        <th className="text-right p-2">Total Bhava Bala</th>
                        <th className="text-right p-2">Combined</th>
                        <th className="text-right p-2">Top 3 Strongest Planets</th>
                        <th className="text-center p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getTopShadBalaTimes(300).map((result, index) => {
                        const sortedPlanets = Object.entries(result.shad_bala.totals)
                          .filter(([planet]) => selectedPlanets.has(planet))
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3);
                        
                        const combined = result.shad_bala.total + result.bhava_bala.total;
                        const dt = new Date(result.datetime);

                        return (
                          <tr key={index} className="border-b border-neutral-800/30 hover:bg-surface/20">
                            <td className="p-2 font-semibold text-primary">#{index + 1}</td>
                            <td className="p-2">{dt.toLocaleString()}</td>
                            <td className="text-right p-2 font-semibold">{result.shad_bala.total.toFixed(2)}</td>
                            <td className="text-right p-2">{result.bhava_bala.total.toFixed(2)}</td>
                            <td className="text-right p-2">{combined.toFixed(2)}</td>
                            <td className="text-right p-2 text-xs">
                              {sortedPlanets.map(([p, b], i) => (
                                <span key={p} className={i === 0 ? 'text-green-400 font-semibold' : ''}>
                                  {p}({b}){i < 2 ? ', ' : ''}
                                </span>
                              ))}
                            </td>
                            <td className="text-center p-2">
                              {onOpenKundali && (
                                <button
                                  onClick={() => onOpenKundali(
                                    result.datetime,
                                    formData.latitude,
                                    formData.longitude,
                                    formData.tz_offset_hours
                                  )}
                                  className="px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 text-xs flex items-center gap-1"
                                  title="Open Kundali for this time"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Kundali
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top 10 Bhava Bala Scores */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-secondary" />
                  Top 300 Highest Bhava Bala Scores
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800/50">
                        <th className="text-left p-2">Rank</th>
                        <th className="text-left p-2">Date & Time</th>
                        <th className="text-right p-2">Total Bhava Bala</th>
                        <th className="text-right p-2">Total Shad Bala</th>
                        <th className="text-right p-2">Combined</th>
                        <th className="text-right p-2">Top 3 Strongest Planets</th>
                        <th className="text-center p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getTopBhavaBalaTimes(300).map((result, index) => {
                        const sortedPlanets = Object.entries(result.shad_bala.totals)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3);
                        
                        const combined = result.shad_bala.total + result.bhava_bala.total;
                        const dt = new Date(result.datetime);

                        return (
                          <tr key={index} className="border-b border-neutral-800/30 hover:bg-surface/20">
                            <td className="p-2 font-semibold text-secondary">#{index + 1}</td>
                            <td className="p-2">{dt.toLocaleString()}</td>
                            <td className="text-right p-2 font-semibold">{result.bhava_bala.total.toFixed(2)}</td>
                            <td className="text-right p-2">{result.shad_bala.total.toFixed(2)}</td>
                            <td className="text-right p-2">{combined.toFixed(2)}</td>
                            <td className="text-right p-2 text-xs">
                              {sortedPlanets.map(([p, b], i) => (
                                <span key={p} className={i === 0 ? 'text-green-400 font-semibold' : ''}>
                                  {p}({b}){i < 2 ? ', ' : ''}
                                </span>
                              ))}
                            </td>
                            <td className="text-center p-2">
                              {onOpenKundali && (
                                <button
                                  onClick={() => onOpenKundali(
                                    result.datetime,
                                    formData.latitude,
                                    formData.longitude,
                                    formData.tz_offset_hours
                                  )}
                                  className="px-2 py-1 bg-secondary/20 text-secondary rounded hover:bg-secondary/30 text-xs flex items-center gap-1"
                                  title="Open Kundali for this time"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Kundali
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top 10 Combined Scores */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  Top 300 Highest Combined (Shad + Bhava) Scores
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800/50">
                        <th className="text-left p-2">Rank</th>
                        <th className="text-left p-2">Date & Time</th>
                        <th className="text-right p-2">Combined Total</th>
                        <th className="text-right p-2">Shad Bala</th>
                        <th className="text-right p-2">Bhava Bala</th>
                        <th className="text-right p-2">Top 3 Strongest Planets</th>
                        <th className="text-center p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getTopCombinedBalaTimes(300).map((result, index) => {
                        const sortedPlanets = Object.entries(result.shad_bala.totals)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3);
                        
                        const combined = result.shad_bala.total + result.bhava_bala.total;
                        const dt = new Date(result.datetime);

                        return (
                          <tr key={index} className="border-b border-neutral-800/30 hover:bg-surface/20">
                            <td className="p-2 font-semibold text-accent">#{index + 1}</td>
                            <td className="p-2">{dt.toLocaleString()}</td>
                            <td className="text-right p-2 font-bold text-lg">{combined.toFixed(2)}</td>
                            <td className="text-right p-2">{result.shad_bala.total.toFixed(2)}</td>
                            <td className="text-right p-2">{result.bhava_bala.total.toFixed(2)}</td>
                            <td className="text-right p-2 text-xs">
                              {sortedPlanets.map(([p, b], i) => (
                                <span key={p} className={i === 0 ? 'text-green-400 font-semibold' : ''}>
                                  {p}({b}){i < 2 ? ', ' : ''}
                                </span>
                              ))}
                            </td>
                            <td className="text-center p-2">
                              {onOpenKundali && (
                                <button
                                  onClick={() => onOpenKundali(
                                    result.datetime,
                                    formData.latitude,
                                    formData.longitude,
                                    formData.tz_offset_hours
                                  )}
                                  className="px-2 py-1 bg-accent/20 text-accent rounded hover:bg-accent/30 text-xs flex items-center gap-1"
                                  title="Open Kundali for this time"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Kundali
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Heart, Star, FolderOpen } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LoadChartsModal } from './LoadChartsModal';
import { apiRequest } from '../config/api';
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

interface MatchApiResponse {
  chart1: KundaliResponse;
  chart2: KundaliResponse;
  chart1_name: string;
  chart2_name: string;
  scores: Array<{
    category: string;
    score: number;
    maxScore: number;
    description: string;
  }>;
  total_score: number;
  total_max: number;
}

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
  
  const [name1, setName1] = useState('Person 1');
  const [name2, setName2] = useState('Person 2');

  const handleMatch = async () => {
    setMatchError(null);
    setMatchedCharts(null);
    setMatchScores([]);

    if (!formData1 || !formData2) return;
    if (selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2) return;

    setIsMatching(true);
    try {
      const resp = await fetch(apiRequest('/api/match'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person1: formData1,
          person2: formData2,
          person1_name: name1,
          person2_name: name2,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Match request failed');
      }

      const data: MatchApiResponse = await resp.json();
      setMatchedCharts({
        chart1: data.chart1,
        chart2: data.chart2,
        chart1Name: data.chart1_name,
        chart2Name: data.chart2_name,
      });

      const scores: MatchScore[] = data.scores.map((s) => ({
        ...s,
        color: getScoreColor(s.score, s.maxScore),
      }));
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


  const overallScore = matchScores.find(s => s.category === 'Overall Compatibility');
  const compatibilityLevel = overallScore ? getCompatibilityLevel(overallScore.score, overallScore.maxScore) : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <Heart className="w-6 h-6 text-red-500" />
          Kundali Matcher
        </h2>
        <p className="text-neutral-400">Compare two birth charts for compatibility analysis</p>
      </div>

      {/* Birth Data Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Person 1 Form */}
        <Card className="bg-neutral-900/60 border-neutral-700/50">
          <CardHeader>
            <CardTitle className="text-white">Person 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="name1" className="text-sm text-neutral-400">Name</Label>
                <Input
                  id="name1"
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  placeholder="Enter name"
                  readOnly
                />
              </div>
              <Button
                variant="outline"
                size="default"
                onClick={() => openLoadModal(1)}
                className="gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Load Chart
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="day1" className="text-xs text-neutral-400">Day</Label>
                <Input
                  id="day1"
                  type="number"
                  value={formData1.day}
                  onChange={(e) => setFormData1({...formData1, day: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="1"
                  max="31"
                />
              </div>
              <div>
                <Label htmlFor="month1" className="text-xs text-neutral-400">Month</Label>
                <Input
                  id="month1"
                  type="number"
                  value={formData1.month}
                  onChange={(e) => setFormData1({...formData1, month: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="1"
                  max="12"
                />
              </div>
              <div>
                <Label htmlFor="year1" className="text-xs text-neutral-400">Year</Label>
                <Input
                  id="year1"
                  type="number"
                  value={formData1.year}
                  onChange={(e) => setFormData1({...formData1, year: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="1900"
                  max="2100"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="hour1" className="text-xs text-neutral-400">Hour</Label>
                <Input
                  id="hour1"
                  type="number"
                  value={formData1.hour}
                  onChange={(e) => setFormData1({...formData1, hour: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="0"
                  max="23"
                />
              </div>
              <div>
                <Label htmlFor="minute1" className="text-xs text-neutral-400">Minute</Label>
                <Input
                  id="minute1"
                  type="number"
                  value={formData1.minute}
                  onChange={(e) => setFormData1({...formData1, minute: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="0"
                  max="59"
                />
              </div>
              <div>
                <Label htmlFor="second1" className="text-xs text-neutral-400">Second</Label>
                <Input
                  id="second1"
                  type="number"
                  value={formData1.second}
                  onChange={(e) => setFormData1({...formData1, second: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="0"
                  max="59"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="lat1" className="text-xs text-neutral-400">Latitude</Label>
                <Input
                  id="lat1"
                  type="number"
                  step="0.0001"
                  value={formData1.latitude}
                  onChange={(e) => setFormData1({...formData1, latitude: parseFloat(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                />
              </div>
              <div>
                <Label htmlFor="lon1" className="text-xs text-neutral-400">Longitude</Label>
                <Input
                  id="lon1"
                  type="number"
                  step="0.0001"
                  value={formData1.longitude}
                  onChange={(e) => setFormData1({...formData1, longitude: parseFloat(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="tz1" className="text-xs text-neutral-400">Timezone Offset (hours)</Label>
              <Input
                id="tz1"
                type="number"
                step="0.5"
                value={formData1.tz_offset_hours}
                onChange={(e) => setFormData1({...formData1, tz_offset_hours: parseFloat(e.target.value)})}
                className="bg-neutral-800/50 border-neutral-700/50 text-white"
              />
            </div>
            
          </CardContent>
        </Card>

        {/* Person 2 Form */}
        <Card className="bg-neutral-900/60 border-neutral-700/50">
          <CardHeader>
            <CardTitle className="text-white">Person 2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="name2" className="text-sm text-text-muted">Name</Label>
                <Input
                  id="name2"
                  value={name2}
                  onChange={(e) => setName2(e.target.value)}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  placeholder="Enter name"
                  readOnly
                />
              </div>
              <Button
                variant="outline"
                size="default"
                onClick={() => openLoadModal(2)}
                className="gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Load Chart
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="day2" className="text-xs text-neutral-400">Day</Label>
                <Input
                  id="day2"
                  type="number"
                  value={formData2.day}
                  onChange={(e) => setFormData2({...formData2, day: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="1"
                  max="31"
                />
              </div>
              <div>
                <Label htmlFor="month2" className="text-xs text-neutral-400">Month</Label>
                <Input
                  id="month2"
                  type="number"
                  value={formData2.month}
                  onChange={(e) => setFormData2({...formData2, month: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="1"
                  max="12"
                />
              </div>
              <div>
                <Label htmlFor="year2" className="text-xs text-neutral-400">Year</Label>
                <Input
                  id="year2"
                  type="number"
                  value={formData2.year}
                  onChange={(e) => setFormData2({...formData2, year: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="1900"
                  max="2100"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="hour2" className="text-xs text-neutral-400">Hour</Label>
                <Input
                  id="hour2"
                  type="number"
                  value={formData2.hour}
                  onChange={(e) => setFormData2({...formData2, hour: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="0"
                  max="23"
                />
              </div>
              <div>
                <Label htmlFor="minute2" className="text-xs text-neutral-400">Minute</Label>
                <Input
                  id="minute2"
                  type="number"
                  value={formData2.minute}
                  onChange={(e) => setFormData2({...formData2, minute: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="0"
                  max="59"
                />
              </div>
              <div>
                <Label htmlFor="second2" className="text-xs text-neutral-400">Second</Label>
                <Input
                  id="second2"
                  type="number"
                  value={formData2.second}
                  onChange={(e) => setFormData2({...formData2, second: parseInt(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                  min="0"
                  max="59"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="lat2" className="text-xs text-neutral-400">Latitude</Label>
                <Input
                  id="lat2"
                  type="number"
                  step="0.0001"
                  value={formData2.latitude}
                  onChange={(e) => setFormData2({...formData2, latitude: parseFloat(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                />
              </div>
              <div>
                <Label htmlFor="lon2" className="text-xs text-neutral-400">Longitude</Label>
                <Input
                  id="lon2"
                  type="number"
                  step="0.0001"
                  value={formData2.longitude}
                  onChange={(e) => setFormData2({...formData2, longitude: parseFloat(e.target.value)})}
                  className="bg-neutral-800/50 border-neutral-700/50 text-white"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="tz2" className="text-xs text-neutral-400">Timezone Offset (hours)</Label>
              <Input
                id="tz2"
                type="number"
                step="0.5"
                value={formData2.tz_offset_hours}
                onChange={(e) => setFormData2({...formData2, tz_offset_hours: parseFloat(e.target.value)})}
                className="bg-neutral-800/50 border-neutral-700/50 text-white"
              />
            </div>
            
          </CardContent>
        </Card>
      </div>

      {/* Match Button */}
      <Card className="bg-neutral-900/60 border-neutral-700/50">
        <CardContent className="p-4">
          <Button
            onClick={handleMatch}
            disabled={isMatching || !!(selectedChart1 && selectedChart2 && selectedChart1 === selectedChart2)}
            className="w-full"
            size="lg"
          >
            <img src={heartLogo} alt="Heart" className="w-4 h-4 mr-2" />
            {isMatching ? 'Analyzing...' : 'Analyze Compatibility'}
          </Button>
        </CardContent>
      </Card>

      {matchError && (
        <Card className="bg-error/20 border border-error/50">
          <CardContent className="p-4 text-error text-sm">
            {matchError}
          </CardContent>
        </Card>
      )}

      {/* Match Results */}
      {matchedCharts && (
        <div className="space-y-6">
          {/* Overall Compatibility */}
          {compatibilityLevel && (
            <Card className={`bg-gradient-to-r ${compatibilityLevel.gradient} border-neutral-800/50`}>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Star className="w-6 h-6 text-yellow-400" />
                  <h3 className="text-xl font-bold text-white">Overall Compatibility</h3>
                  <Star className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {Math.round((overallScore!.score / overallScore!.maxScore) * 100)}%
                </div>
                <Badge className={`${compatibilityLevel.badgeColor} text-white`}>
                  {compatibilityLevel.label}
                </Badge>
                <p className="text-neutral-400 mt-2">{compatibilityLevel.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Detailed Scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchScores.filter(s => s.category !== 'Overall Compatibility').map((score, index) => (
              <Card key={index} className="bg-neutral-900/60 border-neutral-700/50">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-white mb-2">{score.category}</h4>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold" style={{ color: score.color }}>
                      {Math.round((score.score / score.maxScore) * 100)}%
                    </span>
                    <span className="text-sm text-neutral-400">
                      {score.score}/{score.maxScore}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800/50 rounded-full h-2 mb-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(score.score / score.maxScore) * 100}%`,
                        backgroundColor: score.color
                      }}
                    />
                  </div>
                  <p className="text-xs text-neutral-400">{score.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-neutral-900/60 border-neutral-700/50">
              <CardHeader>
                <CardTitle className="text-white">{matchedCharts.chart1Name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Ascendant:</span>
                    <span className="text-white">{matchedCharts.chart1.lagna.sign}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Moon Sign:</span>
                    <span className="text-white">{matchedCharts.chart1.planets.Moon?.sign || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Birth Time:</span>
                    <span className="text-white">{matchedCharts.chart1.birth.time}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-neutral-900/60 border-neutral-700/50">
              <CardHeader>
                <CardTitle className="text-white">{matchedCharts.chart2Name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Ascendant:</span>
                    <span className="text-white">{matchedCharts.chart2.lagna.sign}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Moon Sign:</span>
                    <span className="text-white">{matchedCharts.chart2.planets.Moon?.sign || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Birth Time:</span>
                    <span className="text-white">{matchedCharts.chart2.birth.time}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
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

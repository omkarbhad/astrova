import { useState } from 'react';
import { Trash2, Calendar, MapPin, Clock } from 'lucide-react';
import type { KundaliRequest, KundaliResponse } from '../types/kundali';

interface SavedChart {
  id: string;
  name: string;
  birthData: KundaliRequest;
  kundaliData: KundaliResponse;
  createdAt: string;
}

interface SavedChartsProps {
  onLoadChart: (chartId: string) => void;
  onDeleteChart: (chartId: string) => void;
  refreshKey?: number;
}

export function SavedCharts({ onLoadChart, onDeleteChart, refreshKey }: SavedChartsProps) {
  const [showList, setShowList] = useState(false);

  // Read directly; refreshKey is used by the parent to trigger a re-render when storage changes.
  void refreshKey;
  const savedCharts: SavedChart[] = (() => {
    const raw = localStorage.getItem('astrova_charts') || '[]';
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SavedChart[]) : [];
    } catch {
      return [];
    }
  })();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  return (
    <div className="bg-neutral-900/30 rounded-2xl p-4 border border-neutral-800/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Saved Charts</h2>
        <button
          onClick={() => setShowList(!showList)}
          className="text-xs px-2 py-1 bg-neutral-900/50 rounded hover:bg-neutral-900/70 transition-colors"
        >
          {showList ? "Hide" : "Show"} ({savedCharts.length})
        </button>
      </div>

      {showList && (
        <div className="space-y-2">
          {savedCharts.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <div className="text-sm">No saved charts yet</div>
              <div className="text-xs mt-1">Generate a chart and save it to see it here</div>
            </div>
          ) : (
            savedCharts.map((chart) => (
              <div key={chart.id} className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-white">{chart.name}</div>
                    <div className="text-xs text-neutral-500">
                      Created: {formatDate(chart.createdAt)} at {formatTime(chart.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onLoadChart(chart.id)}
                      className="p-1.5 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                      title="Load Chart"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => onDeleteChart(chart.id)}
                      className="p-1.5 text-xs bg-red-400/20 text-red-400 rounded hover:bg-red-400/30 transition-colors"
                      title="Delete Chart"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {chart.birthData.day}/{chart.birthData.month}/{chart.birthData.year}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {chart.birthData.hour.toString().padStart(2, '0')}:{chart.birthData.minute.toString().padStart(2, '0')}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {chart.birthData.latitude.toFixed(2)}°, {chart.birthData.longitude.toFixed(2)}°
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

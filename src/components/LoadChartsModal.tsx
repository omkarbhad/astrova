import { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { X, CheckCircle2, AlertCircle, Search, Trash2, Pencil, FolderOpen, Check } from 'lucide-react';
import type { KundaliRequest, KundaliResponse } from '../types/kundali';

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

interface LoadChartsModalProps {
  isOpen: boolean;
  charts: SavedChart[];
  onLoad: (chartId: string) => void;
  onEdit: (chartId: string) => void;
  onDelete: (chartId: string) => void | Promise<void>;
  onClose: () => void;
}

export function LoadChartsModal({ isOpen, charts, onLoad, onEdit, onDelete, onClose }: LoadChartsModalProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const sortedCharts = useMemo(() => {
    return [...charts].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [charts]);

  const filteredCharts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedCharts;
    return sortedCharts.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const loc = (c.locationName || '').toLowerCase();
      const date = `${c.birthData.day}/${c.birthData.month}/${c.birthData.year}`.toLowerCase();
      return name.includes(q) || loc.includes(q) || date.includes(q);
    });
  }, [query, sortedCharts]);

  const handleDelete = async (chartId: string) => {
    if (deleteConfirmId !== chartId) {
      setDeleteConfirmId(chartId);
      setDeleteNotice(null);
      return;
    }

    setDeletingId(chartId);
    try {
      await onDelete(chartId);
      setDeleteConfirmId(null);
      setDeleteNotice({ type: 'success', message: 'Deleted successfully.' });
      window.setTimeout(() => setDeleteNotice(null), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete chart.';
      setDeleteNotice({ type: 'error', message: msg || 'Failed to delete chart.' });
      window.setTimeout(() => setDeleteNotice(null), 2000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadAndClose = (chartId: string) => {
    setDeleteConfirmId(null);
    onClose();
    onLoad(chartId);
  };

  const handleEditAndClose = (chartId: string) => {
    setDeleteConfirmId(null);
    onClose();
    onEdit(chartId);
  };

  const handleClose = () => {
    setDeleteConfirmId(null);
    setDeleteNotice(null);
    setDeletingId(null);
    setQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl max-w-2xl mx-4 w-full max-h-[80vh] overflow-hidden shadow-2xl">
          <div className="sticky top-0 z-10 bg-neutral-800/60 backdrop-blur-md border-b border-neutral-700/50 px-6 py-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Saved Charts</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">Load, edit, or delete your saved kundalis</p>
                  </div>
                  {deleteNotice && (
                    <div
                      className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
                        deleteNotice.type === 'success'
                          ? 'border-green-500/50 text-green-200 bg-green-500/10'
                          : 'border-error/50 text-error bg-error/10'
                      }`}
                    >
                      {deleteNotice.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <div>{deleteNotice.message}</div>
                    </div>
                  )}
                  <Button
                    onClick={handleClose}
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-neutral-400 hover:text-white hover:bg-neutral-700/50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-2 bg-neutral-800/60 border border-neutral-700/50 rounded-lg px-3 py-2">
                    <Search className="w-4 h-4 text-neutral-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, location, or date…"
                      className="w-full bg-transparent text-sm text-white placeholder:text-neutral-400 outline-none"
                    />
                    {query.trim() ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="text-xs text-neutral-400 hover:text-white"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-96px)] scrollbar-thin">
          
          {charts.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-800/60 border border-neutral-700/40 flex items-center justify-center mx-auto">
                <FolderOpen className="w-7 h-7 text-neutral-600" />
              </div>
              <p className="text-neutral-400 text-sm">No charts saved yet</p>
              <p className="text-neutral-500 text-xs">Generate a kundali and save it to see it here</p>
            </div>
          ) : filteredCharts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white font-medium">No matches</p>
              <p className="text-neutral-400 text-sm mt-1">Try a different search.</p>
              <Button onClick={() => setQuery('')} variant="outline" className="mt-4 bg-transparent border border-neutral-700 text-white hover:bg-neutral-700/50 hover:border-neutral-600">Clear search</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCharts.map((chart) => (
                <div
                  key={chart.id}
                  className="bg-neutral-800/40 border border-neutral-700/50 rounded-lg p-3 hover:border-neutral-600/80 hover:bg-neutral-800/60 transition-all duration-200"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-700/50 border border-neutral-600/50 flex items-center justify-center text-white font-semibold text-sm">
                        {(chart.name || 'C').trim().slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm leading-4 truncate">{chart.name}</h3>
                        <div className="text-xs text-neutral-400 mt-0.5 space-y-0.5">
                          <div>
                            {chart.birthData.day}/{chart.birthData.month}/{chart.birthData.year}{' '}
                            {chart.birthData.hour.toString().padStart(2, '0')}:{chart.birthData.minute.toString().padStart(2, '0')}
                          </div>
                          {chart.locationName ? <div className="truncate">{chart.locationName}</div> : null}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleLoadAndClose(chart.id)}
                        className="bg-neutral-200 hover:bg-neutral-300 text-black gap-1.5 h-8"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditAndClose(chart.id)}
                        className="h-8 w-8 p-0 bg-transparent border border-neutral-700 text-white hover:bg-neutral-700/50 hover:border-neutral-600"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={deleteConfirmId === chart.id ? 'destructive' : 'outline'}
                        onClick={() => handleDelete(chart.id)}
                        className={`h-8 w-8 p-0 bg-transparent border border-neutral-700 text-white hover:bg-neutral-700/50 hover:border-neutral-600 ${deleteConfirmId === chart.id ? 'animate-pulse' : ''}`}
                        disabled={deletingId === chart.id}
                        title={deleteConfirmId === chart.id ? 'Confirm delete' : 'Delete'}
                        aria-label={deleteConfirmId === chart.id ? 'Confirm delete' : 'Delete'}
                      >
                        {deletingId === chart.id ? (
                          <span className="text-xs">…</span>
                        ) : deleteConfirmId === chart.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          </div>
        </div>
      </div>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
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
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  const actionButtonClass = 'h-8 w-8 p-0 border border-amber-500/20 bg-[hsl(24,18%,9%)] text-white hover:bg-[hsl(24,20%,12%)] hover:border-amber-500/35';

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

  useEffect(() => {
    if (!deleteConfirmId) return;
    if (!filteredCharts.some((c) => c.id === deleteConfirmId)) {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, filteredCharts]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm px-2 sm:px-4 py-[max(0.75rem,env(safe-area-inset-top))] sm:py-6" role="dialog" aria-modal="true" aria-label="Saved charts modal" onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className="w-full max-w-3xl bg-[hsl(24,16%,8%)] border border-amber-500/20 rounded-2xl shadow-2xl overflow-hidden h-[calc(100dvh-1.5rem-env(safe-area-inset-top))] sm:h-auto sm:max-h-[80vh] flex flex-col">
          <div className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(23,23,23,0.9))] backdrop-blur-md border-b border-amber-500/20 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Saved Charts</h2>
                    <p className="text-xs text-neutral-300/80 mt-0.5">Load, edit, or delete your saved kundalis</p>
                  </div>
                  <Button
                    onClick={handleClose}
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-neutral-400 hover:text-white hover:bg-[hsl(24,18%,9%)]"
                    aria-label="Close saved charts modal"
                    onMouseEnter={() => setIsCloseHovered(true)}
                    onMouseLeave={() => setIsCloseHovered(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">Tip: Press Esc to close this modal{isCloseHovered ? ' • or click outside' : ''}</p>

                {deleteNotice && (
                  <div
                    className={`mt-3 rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
                      deleteNotice.type === 'success'
                        ? 'border-amber-500/50 text-amber-200 bg-amber-500/10'
                        : 'border-red-500/50 text-red-200 bg-red-500/10'
                    }`}
                  >
                    {deleteNotice.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <div className="flex-1">{deleteNotice.message}</div>
                    <button type="button" className="text-neutral-300/80 hover:text-white" onClick={() => setDeleteNotice(null)} aria-label="Dismiss chart notice">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="mt-3">
                  <div className="flex items-center gap-2 bg-[hsl(24,18%,9%)] border border-amber-500/20 rounded-lg px-3 h-9">
                    <Search className="w-4 h-4 text-neutral-300/70" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, location, or date…"
                      className="w-full bg-transparent text-sm text-white placeholder:text-neutral-400 outline-none"
                      aria-label="Search saved charts"
                      autoFocus
                    />
                    {query.trim() ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="text-xs text-neutral-300/80 hover:text-white"
                        aria-label="Clear chart search"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-6 overflow-y-auto flex-1 scrollbar-thin">
          <p className="text-neutral-500 text-xs mb-3">{filteredCharts.length} of {charts.length} charts</p>
          
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
              <Button onClick={() => setQuery('')} variant="outline" className="mt-4 border border-amber-500/20 bg-[hsl(24,18%,9%)] text-white hover:bg-[hsl(24,20%,12%)] hover:border-amber-500/35">Clear search</Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCharts.map((chart) => (
                <div
                  key={chart.id}
                  className="bg-[hsl(24,18%,9%)]/80 border border-amber-500/20 rounded-xl p-3 hover:border-amber-500/35 hover:bg-[hsl(24,20%,12%)] transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-100 font-semibold text-sm">
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
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleLoadAndClose(chart.id)}
                        className="bg-amber-400 hover:bg-amber-300 text-black gap-1.5 h-8"
                        aria-label={`Open chart ${chart.name}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditAndClose(chart.id)}
                        className={actionButtonClass}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={deleteConfirmId === chart.id ? 'destructive' : 'outline'}
                        onClick={() => handleDelete(chart.id)}
                        className={`${actionButtonClass} ${deleteConfirmId === chart.id ? 'animate-pulse' : ''}`}
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

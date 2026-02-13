import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, BookOpen, Search, Settings, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllKBArticles, upsertKBArticle, deleteKBArticle, supabase } from '@/lib/supabase';
import type { KBArticle } from '@/lib/supabase';

const ADMIN_EMAILS = ['omkarbhad@gmail.com']; // Add admin emails here

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'kb' | 'config' | 'stats'>('kb');
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingArticle, setEditingArticle] = useState<Partial<KBArticle> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [stats, setStats] = useState<{ totalArticles: number; categories: string[] }>({ totalArticles: 0, categories: [] });

  const isAdmin = isLoaded && user && ADMIN_EMAILS.includes(user.primaryEmailAddress?.emailAddress || '');

  const loadArticles = useCallback(async () => {
    setLoading(true);
    const data = await getAllKBArticles();
    setArticles(data);
    const cats = [...new Set(data.map(a => a.category))];
    setStats({ totalArticles: data.length, categories: cats });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadArticles();
  }, [isAdmin, loadArticles]);

  const handleSaveArticle = async () => {
    if (!editingArticle?.title || !editingArticle?.content || !editingArticle?.category) return;
    setSaveStatus('saving');
    const result = await upsertKBArticle({
      ...editingArticle as KBArticle,
      tags: editingArticle.tags || [],
    });
    if (result) {
      setSaveStatus('saved');
      setEditingArticle(null);
      await loadArticles();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    await deleteKBArticle(id);
    await loadArticles();
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-lg font-semibold">Access Denied</div>
        <p className="text-neutral-500 text-sm">You don't have admin privileges.</p>
        <Button onClick={() => navigate('/chart')} variant="outline" className="gap-2 text-white border-neutral-700">
          <ArrowLeft className="w-4 h-4" /> Back to App
        </Button>
      </div>
    );
  }

  const filteredArticles = searchQuery
    ? articles.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : articles;

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.18),transparent)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-violet-500/15 bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/chart')} variant="ghost" size="sm" className="text-neutral-400 hover:text-white h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Settings className="w-4 h-4 text-violet-300" />
              </div>
              <div>
                <h1 className="text-white font-semibold text-sm">Admin Panel</h1>
                <p className="text-[10px] text-neutral-500">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-900/60 border border-violet-500/20">
            {(['kb', 'config', 'stats'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab ? 'bg-violet-500/20 text-violet-300' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {tab === 'kb' ? 'Knowledge Base' : tab === 'config' ? 'Config' : 'Stats'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 relative">
        {/* Knowledge Base Tab */}
        {activeTab === 'kb' && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full bg-neutral-900/60 border border-violet-500/20 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500/40"
                />
              </div>
              <Button
                onClick={() => setEditingArticle({ title: '', content: '', category: 'general', tags: [] })}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5" /> New Article
              </Button>
              <Button onClick={loadArticles} variant="outline" size="sm" className="h-8 w-8 p-0 border-neutral-700 text-neutral-400 hover:text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Edit Form */}
            {editingArticle && (
              <div className="bg-neutral-900/60 border border-violet-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">{editingArticle.id ? 'Edit Article' : 'New Article'}</h3>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setEditingArticle(null)} variant="ghost" size="sm" className="text-neutral-400 hover:text-white text-xs h-7">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveArticle}
                      size="sm"
                      disabled={saveStatus === 'saving'}
                      className={`gap-1 text-xs h-7 ${
                        saveStatus === 'saved' ? 'bg-green-600' :
                        saveStatus === 'error' ? 'bg-red-600' :
                        'bg-violet-600 hover:bg-violet-700'
                      } text-white`}
                    >
                      <Save className="w-3 h-3" />
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save'}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editingArticle.title || ''}
                    onChange={e => setEditingArticle({ ...editingArticle, title: e.target.value })}
                    placeholder="Title"
                    className="bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500/40"
                  />
                  <select
                    value={editingArticle.category || 'general'}
                    onChange={e => setEditingArticle({ ...editingArticle, category: e.target.value })}
                    className="bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
                  >
                    {['general', 'transits', 'nodes', 'doshas', 'dasha', 'planetary', 'yogas', 'nakshatra', 'houses', 'remedies', 'matching'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={editingArticle.content || ''}
                  onChange={e => setEditingArticle({ ...editingArticle, content: e.target.value })}
                  placeholder="Article content..."
                  rows={6}
                  className="w-full bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500/40 resize-y"
                />
                <input
                  type="text"
                  value={(editingArticle.tags || []).join(', ')}
                  onChange={e => setEditingArticle({ ...editingArticle, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="Tags (comma-separated)"
                  className="w-full bg-neutral-800/50 border border-violet-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500/40"
                />
              </div>
            )}

            {/* Articles List */}
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-neutral-500 text-sm">Loading articles...</div>
              ) : filteredArticles.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  {searchQuery ? 'No articles match your search' : 'No articles yet. Create one!'}
                </div>
              ) : (
                filteredArticles.map(article => (
                  <div key={article.id} className="bg-neutral-900/40 border border-neutral-800/30 rounded-lg p-3 hover:border-violet-500/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          <span className="text-white font-medium text-sm truncate">{article.title}</span>
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[9px] uppercase font-medium shrink-0">{article.category}</span>
                        </div>
                        <p className="text-neutral-500 text-xs line-clamp-2">{article.content}</p>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {article.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[9px]">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          onClick={() => setEditingArticle(article)}
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-neutral-500 hover:text-white"
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteArticle(article.id)}
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="bg-neutral-900/60 border border-violet-500/20 rounded-xl p-6">
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-400" /> Database Connection
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-neutral-800/30">
                  <span className="text-neutral-400">Supabase URL</span>
                  <span className="text-white font-mono text-[10px]">{import.meta.env.VITE_SUPABASE_URL || 'Not configured'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-neutral-800/30">
                  <span className="text-neutral-400">Connection Status</span>
                  <span className={`flex items-center gap-1.5 ${supabase ? 'text-green-400' : 'text-red-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${supabase ? 'bg-green-400' : 'bg-red-400'}`} />
                    {supabase ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-neutral-800/30">
                  <span className="text-neutral-400">Auth Provider</span>
                  <span className="text-white">Clerk</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-neutral-400">AI Model</span>
                  <span className="text-white">google/gemini-2.0-flash-001</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-neutral-900/60 border border-violet-500/20 rounded-xl p-4">
              <div className="text-neutral-500 text-xs mb-1">Total KB Articles</div>
              <div className="text-2xl font-bold text-white">{stats.totalArticles}</div>
            </div>
            <div className="bg-neutral-900/60 border border-violet-500/20 rounded-xl p-4">
              <div className="text-neutral-500 text-xs mb-1">Categories</div>
              <div className="text-2xl font-bold text-white">{stats.categories.length}</div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {stats.categories.map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[9px]">{c}</span>
                ))}
              </div>
            </div>
            <div className="bg-neutral-900/60 border border-violet-500/20 rounded-xl p-4">
              <div className="text-neutral-500 text-xs mb-1">Admin User</div>
              <div className="text-sm font-medium text-white">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

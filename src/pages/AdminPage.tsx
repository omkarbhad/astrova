import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, BookOpen, Search, Settings, Database, RefreshCw, Cpu, Coins, ToggleLeft, ToggleRight, Loader2, Download, Zap, Check, Users, Ban, ShieldCheck, MessageSquare, ArrowUp, PanelRightClose, FileText, X, Copy, Check as CheckIcon, Link2, Paperclip, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { getAllKBArticles, upsertKBArticle, deleteKBArticle, supabase, getEnabledModels, toggleModel, addModelFromOpenRouter, deleteModel, getAdminConfig, setAdminConfig, getAllAstrovaUsers, updateUserCredits, toggleUserBan, setUserRole } from '@/lib/supabase';
import type { KBArticle, EnabledModel, AstrovaUser } from '@/lib/supabase';

export default function AdminPage() {
  const { astrovaUser, isLoaded } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'kb' | 'models' | 'credits' | 'users' | 'config'>('kb');
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingArticle, setEditingArticle] = useState<Partial<KBArticle> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [stats, setStats] = useState<{ totalArticles: number; categories: string[] }>({ totalArticles: 0, categories: [] });

  // Model management state
  const [models, setModels] = useState<EnabledModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.0-flash-001');
  const [fetchingOpenRouter, setFetchingOpenRouter] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; name: string }>>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelSaveStatus, setModelSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Credit settings state
  const [creditCosts, setCreditCosts] = useState({ ai_message: 2, chart_generation: 1, matching: 3 });
  const [defaultCredits, setDefaultCredits] = useState(50);
  const [creditSaveStatus, setCreditSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // User management state
  const [allUsers, setAllUsers] = useState<AstrovaUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [creditAmountInput, setCreditAmountInput] = useState<Record<string, string>>({});

  // AI Article Assistant state - REDESIGNED like AstrovaSidebar
  const [showArticleChat, setShowArticleChat] = useState(false);
  const [articleChatMessages, setArticleChatMessages] = useState<Array<{ 
    role: 'user' | 'assistant'; 
    content: string; 
    id?: string;
    isStreaming?: boolean;
    attachments?: Attachment[];
  }>>([]);
  const [articleChatInput, setArticleChatInput] = useState('');
  const [articleChatLoading, setArticleChatLoading] = useState(false);
  const articleChatEndRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  interface Attachment {
    id: string;
    name: string;
    type: 'pdf' | 'link' | 'doc' | 'image';
    url?: string;
    content?: string;
    size?: number;
  }

  const isAdmin = isLoaded && astrovaUser?.role === 'admin';

  const loadArticles = useCallback(async () => {
    setLoading(true);
    const data = await getAllKBArticles();
    setArticles(data);
    const cats = [...new Set(data.map(a => a.category))];
    setStats({ totalArticles: data.length, categories: cats });
    setLoading(false);
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    const data = await getEnabledModels();
    setModels(data);
    const config = await getAdminConfig('selected_model');
    if (config && typeof config === 'string') setSelectedModel(config);
    const costs = await getAdminConfig('credit_costs');
    if (costs && typeof costs === 'object') setCreditCosts(costs as typeof creditCosts);
    const defCreds = await getAdminConfig('default_credits');
    if (defCreds && typeof defCreds === 'number') setDefaultCredits(defCreds);
    setModelsLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) { loadArticles(); loadModels(); }
  }, [isAdmin, loadArticles, loadModels]);

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

  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  const handleDeleteArticle = async (id: string) => {
    const article = articles.find(a => a.id === id);
    const success = await deleteKBArticle(id);
    if (success) {
      setDeleteToast(`Deleted "${article?.title || 'article'}"`);
      setTimeout(() => setDeleteToast(null), 3000);
    }
    await loadArticles();
  };

  const handleToggleModel = async (id: string, enabled: boolean) => {
    await toggleModel(id, enabled);
    setModels(prev => prev.map(m => m.id === id ? { ...m, is_enabled: enabled } : m));
  };


  const handleSelectModel = async (modelId: string) => {
    setSelectedModel(modelId);
    setModelSaveStatus('saving');
    await setAdminConfig('selected_model', modelId, 'Currently selected AI model');
    setModelSaveStatus('saved');
    setTimeout(() => setModelSaveStatus('idle'), 2000);
  };

  const handleFetchOpenRouterModels = async () => {
    setFetchingOpenRouter(true);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models?supported_parameters=tools');
      const data = await res.json();
      const modelsList = (data.data || []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }));
      setOpenRouterModels(modelsList);
    } catch { setOpenRouterModels([]); }
    setFetchingOpenRouter(false);
  };

  const handleAddModel = async (modelId: string, modelName: string) => {
    await addModelFromOpenRouter(modelId, modelName);
    await loadModels();
  };

  // File handling for admin chat
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isDoc = file.type.includes('word') || file.name.match(/\.(doc|docx)$/i);
      const isText = file.type.includes('text') || file.name.endsWith('.txt');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const attachment: Attachment = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: isPdf ? 'pdf' : isDoc ? 'doc' : 'doc',
          content: content?.slice(0, 50000), // Limit content size
          size: file.size
        };
        setAttachedFiles(prev => [...prev, attachment]);
      };
      
      if (isText) {
        reader.readAsText(file);
      } else {
        // For PDFs/docs, just store the name and indicate it's attached
        const attachment: Attachment = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: isPdf ? 'pdf' : 'doc',
          size: file.size
        };
        setAttachedFiles(prev => [...prev, attachment]);
      }
    });
    
    e.target.value = ''; // Reset input
  };

  const handleLinkAdd = () => {
    const url = prompt('Enter URL:');
    if (!url) return;
    
    const attachment: Attachment = {
      id: Math.random().toString(36).substring(7),
      name: url,
      type: 'link',
      url: url
    };
    setAttachedFiles(prev => [...prev, attachment]);
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(a => a.id !== id));
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setArticleChatLoading(false);
    setArticleChatMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  };

  const clearChat = () => {
    setArticleChatMessages([]);
    setAttachedFiles([]);
  };

  const sendArticleChatMessage = async (text: string) => {
    if (!text.trim() || articleChatLoading) return;
    
    const messageId = Date.now().toString();
    const userMsg = { 
      role: 'user' as const, 
      content: text,
      id: messageId,
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };
    
    setArticleChatMessages(prev => [...prev, userMsg]);
    setArticleChatInput('');
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setArticleChatLoading(true);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const existingArticleTitles = articles.map((a: KBArticle) => `${a.title} [${a.category}]`).join(', ');
      
      // Build attachment context
      let attachmentContext = '';
      if (attachedFiles.length > 0) {
        attachmentContext = '\n\nAttached files:\n' + attachedFiles.map(f => {
          if (f.type === 'link') return `[LINK: ${f.url}]`;
          if (f.content) return `[FILE: ${f.name}]\n${f.content.slice(0, 10000)}`;
          return `[FILE: ${f.name} - ${(f.size || 0 / 1024).toFixed(1)}KB]`;
        }).join('\n---\n');
      }
      
      const systemPrompt = `You are an AI assistant helping an admin write knowledge base articles for an astrology app called Astrova. The app covers Vedic astrology topics: planets, houses, nakshatras, dashas, yogas, doshas, transits, remedies, matching.

Existing articles: ${existingArticleTitles || 'None yet'}${attachmentContext}

When asked to write an article, output it in this format:
---ARTICLE---
Title: [title]
Category: [category]
Tags: [comma-separated tags]
---CONTENT---
[article content]
---END---

The admin can then save it directly. Be concise, factual, and use proper Vedic astrology terminology. If the user asks for suggestions, suggest article topics that are missing from the existing collection. If files or links are attached, reference them when relevant.`;

      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: selectedModel || 'google/gemini-2.0-flash-001',
          messages: [
            { role: 'system', content: systemPrompt },
            ...articleChatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text + attachmentContext },
          ],
          max_tokens: 2000,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('API error');
      
      // Add streaming assistant message
      const assistantId = (Date.now() + 1).toString();
      setArticleChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '',
        id: assistantId,
        isStreaming: true 
      }]);
      
      // Read stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  setArticleChatMessages(prev => prev.map(m => 
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  ));
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
      
      // Finalize
      setArticleChatMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: fullContent || 'I could not generate a response.', isStreaming: false } : m
      ));
      
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setArticleChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error getting response. Please try again.',
        id: (Date.now() + 2).toString()
      }]);
    } finally {
      abortControllerRef.current = null;
      setArticleChatLoading(false);
      setTimeout(() => articleChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const parseArticleFromChat = (content: string) => {
    const articleMatch = content.match(/---ARTICLE---\n?([\s\S]*?)---CONTENT---\n?([\s\S]*?)---END---/);
    if (!articleMatch) return null;
    const meta = articleMatch[1];
    const body = articleMatch[2].trim();
    const title = meta.match(/Title:\s*(.+)/)?.[1]?.trim() || '';
    const category = meta.match(/Category:\s*(.+)/)?.[1]?.trim()?.toLowerCase() || 'general';
    const tags = meta.match(/Tags:\s*(.+)/)?.[1]?.split(',').map(t => t.trim()).filter(Boolean) || [];
    return { title, category, content: body, tags };
  };

  const handleDeleteModel = async (id: string, modelId: string) => {
    if (modelId === selectedModel) {
      setDeleteToast('Cannot delete the currently active model');
      setTimeout(() => setDeleteToast(null), 3000);
      return;
    }
    const model = models.find(m => m.id === id);
    await deleteModel(id);
    setModels(prev => prev.filter(m => m.id !== id));
    setDeleteToast(`Deleted model "${model?.display_name || modelId}"`);
    setTimeout(() => setDeleteToast(null), 3000);
  };

  const handleSaveCreditSettings = async () => {
    setCreditSaveStatus('saving');
    await setAdminConfig('credit_costs', creditCosts, 'Credit costs for actions');
    await setAdminConfig('default_credits', defaultCredits, 'Default credits for new users');
    setCreditSaveStatus('saved');
    setTimeout(() => setCreditSaveStatus('idle'), 2000);
  };

  // User management
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const users = await getAllAstrovaUsers();
    setAllUsers(users);
    setUsersLoading(false);
  }, []);

  const handleToggleBan = async (userId: string, banned: boolean) => {
    await toggleUserBan(userId, banned);
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: banned } : u));
  };

  const handleSetRole = async (userId: string, role: 'user' | 'admin') => {
    await setUserRole(userId, role);
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  const handleAddCredits = async (userId: string) => {
    const amount = parseInt(creditAmountInput[userId] || '0');
    if (!amount) return;
    const user = allUsers.find(u => u.id === userId);
    await updateUserCredits(userId, amount, `Admin credit adjustment`, astrovaUser?.id);
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, credits: u.credits + amount } : u));
    setCreditAmountInput(prev => ({ ...prev, [userId]: '' }));
    setDeleteToast(`${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} credits ${user ? `for ${user.display_name || user.email}` : ''}`);
    setTimeout(() => setDeleteToast(null), 3000);
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'users') loadUsers();
  }, [isAdmin, activeTab, loadUsers]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[hsl(220,10%,6%)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[hsl(220,10%,6%)] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-lg font-semibold">Access Denied</div>
        <p className="text-neutral-500 text-sm">You don't have admin privileges.</p>
        <div className="text-[10px] text-neutral-600 font-mono mt-2 space-y-1 text-center">
          <div>Your email: <span className="text-neutral-400">{astrovaUser?.email || '(none)'}</span></div>
          <div>Role: <span className="text-neutral-400">{astrovaUser?.role || '(none)'}</span></div>
        </div>
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

  const filteredOpenRouterModels = modelSearchQuery
    ? openRouterModels.filter(m => m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()))
    : openRouterModels;

  const existingModelIds = new Set(models.map(m => m.model_id));

  return (
    <div className="min-h-screen bg-[hsl(220,10%,6%)]">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.05),transparent)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[hsl(220,8%,16%)] bg-[hsl(220,10%,6%)]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/chart')} variant="ghost" size="sm" className="text-neutral-400 hover:text-white h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] flex items-center justify-center">
                <Settings className="w-4 h-4 text-neutral-400" />
              </div>
              <div>
                <h1 className="text-white font-semibold text-sm">Admin</h1>
                <p className="text-[10px] text-neutral-500">{astrovaUser?.email}</p>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-0.5 p-0.5 rounded-full bg-[hsl(220,10%,8%)]/80 border border-[hsl(220,8%,18%)] overflow-x-auto scrollbar-none max-w-[60vw] sm:max-w-none">
            {([
              { key: 'kb' as const, label: 'Articles', icon: BookOpen },
              { key: 'models' as const, label: 'Models', icon: Cpu },
              { key: 'credits' as const, label: 'Credits', icon: Coins },
              { key: 'users' as const, label: 'Users', icon: Users },
              { key: 'config' as const, label: 'Config', icon: Database },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  activeTab === tab.key ? 'bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 relative">
        {/* Delete Toast */}
        {deleteToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[hsl(220,10%,12%)] border border-[hsl(220,8%,22%)] text-neutral-300 text-sm shadow-xl animate-in fade-in slide-in-from-bottom-4">
            {deleteToast}
          </div>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === 'kb' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/30"
                />
              </div>
              <Button
                onClick={() => setEditingArticle({ title: '', content: '', category: 'general', tags: [] })}
                className="gap-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-medium"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
              <Button
                onClick={() => setShowArticleChat(!showArticleChat)}
                variant="ghost"
                size="sm"
                className={`gap-1.5 text-xs font-medium h-9 px-3 ${showArticleChat ? 'text-amber-400 bg-amber-500/10' : 'text-neutral-500 hover:text-white'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> AI Assistant
              </Button>
              <Button onClick={loadArticles} variant="ghost" size="sm" className="h-9 w-9 p-0 text-neutral-500 hover:text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {editingArticle && (
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">{editingArticle.id ? 'Edit Article' : 'New Article'}</h3>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setEditingArticle(null)} variant="ghost" size="sm" className="text-neutral-400 hover:text-white text-xs h-7">Cancel</Button>
                    <Button
                      onClick={handleSaveArticle}
                      size="sm"
                      disabled={saveStatus === 'saving'}
                      className={`gap-1 text-xs h-7 ${saveStatus === 'saved' ? 'bg-green-600' : saveStatus === 'error' ? 'bg-red-600' : 'bg-white text-black hover:bg-neutral-200'}`}
                    >
                      <Save className="w-3 h-3" />
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save'}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={editingArticle.title || ''} onChange={e => setEditingArticle({ ...editingArticle, title: e.target.value })} placeholder="Title"
                    className="bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/30" />
                  <select value={editingArticle.category || 'general'} onChange={e => setEditingArticle({ ...editingArticle, category: e.target.value })}
                    className="bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/30">
                    {['general', 'transits', 'nodes', 'doshas', 'dasha', 'planetary', 'yogas', 'nakshatra', 'houses', 'remedies', 'matching'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <textarea value={editingArticle.content || ''} onChange={e => setEditingArticle({ ...editingArticle, content: e.target.value })} placeholder="Article content..." rows={6}
                  className="w-full bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/30 resize-y" />
                <input type="text" value={(editingArticle.tags || []).join(', ')} onChange={e => setEditingArticle({ ...editingArticle, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="Tags (comma-separated)"
                  className="w-full bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/30" />
              </div>
            )}

            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-neutral-500 animate-spin" /></div>
              ) : filteredArticles.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-sm">{searchQuery ? 'No articles match your search' : 'No articles yet'}</div>
              ) : (
                filteredArticles.map(article => (
                  <div key={article.id} className="bg-[hsl(220,10%,8%)]/40 border border-[hsl(220,8%,16%)] rounded-xl p-3.5 hover:border-amber-500/20 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span className="text-white font-medium text-sm truncate">{article.title}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-neutral-400 text-[9px] uppercase font-medium shrink-0">{article.category}</span>
                        </div>
                        <p className="text-neutral-500 text-xs line-clamp-2 ml-5.5">{article.content}</p>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap ml-5.5">
                            {article.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-500 text-[9px]">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => {
                            const chatUrl = `/chart?openChat=true&prompt=${encodeURIComponent(`Tell me about: ${article.title}\n\nContext: ${article.content.slice(0, 300)}`)}`;
                            navigate(chatUrl);
                          }}
                          variant="ghost" size="sm" className="h-7 px-2 text-neutral-500 hover:text-amber-400 text-[10px] gap-1"
                          title="Open in AI Chat"
                        >
                          <img src="/star.png" alt="" className="w-3 h-3" /> Chat
                        </Button>
                        <Button onClick={() => setEditingArticle(article)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-neutral-500 hover:text-white">
                          <Settings className="w-3 h-3" />
                        </Button>
                        <Button onClick={() => handleDeleteArticle(article.id)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-neutral-500 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* AI Article Assistant - Backdrop */}
            {showArticleChat && (
              <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:bg-black/20" onClick={() => setShowArticleChat(false)} />
            )}
            
            {/* AI Article Assistant - Fixed Slide-out Sidebar - MATCHES CHARTPAGE LAYOUT */}
            <div className={`fixed top-14 right-0 bottom-0 w-full sm:w-[400px] z-50 bg-[hsl(220,10%,7%)] border-l border-[hsl(220,8%,18%)] flex flex-col transition-transform duration-300 ${showArticleChat ? 'translate-x-0' : 'translate-x-full'}`}>
              
              {/* Header */}
              <div className="px-3 py-3 border-b border-[hsl(220,8%,18%)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-white text-sm font-semibold">Article Assistant</span>
                      <p className="text-[10px] text-neutral-500">{articles.length} articles in KB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {articleChatMessages.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearChat} className="h-7 px-2 text-[10px] text-neutral-500 hover:text-red-400" title="Clear chat">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setShowArticleChat(false)} className="h-7 w-7 p-0 text-neutral-500 hover:text-white">
                      <PanelRightClose className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {/* Model selector */}
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full h-7 bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,20%)] rounded-lg px-2 text-[10px] text-neutral-400 focus:outline-none focus:border-emerald-500/30 cursor-pointer"
                >
                  {models.filter(m => m.is_enabled).map(m => (
                    <option key={m.model_id} value={m.model_id}>{m.display_name} ({m.provider})</option>
                  ))}
                  <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (default)</option>
                </select>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                {articleChatMessages.length === 0 && (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6 text-emerald-400/60" />
                    </div>
                    <div>
                      <p className="text-neutral-300 text-sm font-medium">Article Assistant</p>
                      <p className="text-neutral-500 text-xs mt-1">Write, edit, and manage KB articles with AI</p>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-4">
                      {[
                        { q: `Suggest ${Math.max(3, 10 - articles.length)} new article topics we're missing`, icon: '💡' },
                        { q: 'Write an article about Vargottama planets and their significance', icon: '📝' },
                        { q: 'Write about the 12 Bhava lords and their effects in different houses', icon: '🏠' },
                        { q: 'Write about Pancha Mahapurusha Yogas with examples', icon: '⭐' },
                        { q: 'Improve and expand the existing article on Shadbala', icon: '🔧' },
                      ].map(({ q, icon }) => (
                        <button key={q} onClick={() => sendArticleChatMessage(q)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,20%)] text-neutral-400 text-xs hover:text-white hover:border-emerald-500/20 transition-colors text-left">
                          <span className="text-sm shrink-0">{icon}</span>
                          <span className="line-clamp-1">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {articleChatMessages.map((msg) => (
                  <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                    {msg.role === 'user' ? (
                      <div className="max-w-[90%] space-y-2">
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {msg.attachments.map(att => (
                              <div key={att.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[hsl(220,10%,14%)] border border-[hsl(220,8%,22%)] text-[10px] text-neutral-400">
                                {att.type === 'pdf' && <FileText className="w-3 h-3 text-red-400" />}
                                {att.type === 'doc' && <FileText className="w-3 h-3 text-blue-400" />}
                                {att.type === 'link' && <Globe className="w-3 h-3 text-emerald-400" />}
                                <span className="truncate max-w-[120px]">{att.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[hsl(220,10%,14%)] border border-[hsl(220,8%,20%)]">
                          <p className="text-white/90 text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 group/msg">
                        <div className="prose prose-invert prose-sm max-w-none text-sm text-neutral-300 leading-relaxed [&_h1]:text-white [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_p]:text-neutral-300 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:text-neutral-300 [&_strong]:text-white [&_strong]:font-semibold">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                          {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-amber-400/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
                        </div>
                        
                        {/* Copy button - hover reveal */}
                        {!msg.isStreaming && (
                          <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <button
                              onClick={() => msg.id && copyMessage(msg.id, msg.content)}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
                            >
                              {msg.id && copiedMessageId === msg.id ? <CheckIcon className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              {msg.id && copiedMessageId === msg.id ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        )}
                        
                        {/* Save / Load article buttons */}
                        {parseArticleFromChat(msg.content) && (() => {
                          const parsed = parseArticleFromChat(msg.content)!;
                          return (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  await upsertKBArticle({ title: parsed.title, content: parsed.content, category: parsed.category, tags: parsed.tags });
                                  await loadArticles();
                                  setDeleteToast(`Saved article: "${parsed.title}"`);
                                  setTimeout(() => setDeleteToast(null), 3000);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                              >
                                <Save className="w-3.5 h-3.5" /> Save to KB
                              </button>
                              <button
                                onClick={() => {
                                  setEditingArticle({ title: parsed.title, content: parsed.content, category: parsed.category, tags: parsed.tags });
                                  setShowArticleChat(false);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" /> Edit first
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Loading indicator */}
                {articleChatLoading && !articleChatMessages.some(m => m.isStreaming) && (
                  <div className="flex items-center gap-2 py-2">
                    <img src="/star.png" alt="" className="w-5 h-5 animate-spin-slow" />
                    <span className="text-amber-300/70 text-sm">Thinking</span>
                    <div className="flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={articleChatEndRef} />
              </div>

              {/* Attached Files Preview */}
              {attachedFiles.length > 0 && (
                <div className="px-3 py-2 border-t border-[hsl(220,8%,15%)] bg-[hsl(220,10%,8%)]">
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map(file => (
                      <div key={file.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[hsl(220,10%,12%)] border border-[hsl(220,8%,20%)] text-[10px]">
                        {file.type === 'pdf' && <FileText className="w-3 h-3 text-red-400" />}
                        {file.type === 'doc' && <FileText className="w-3 h-3 text-blue-400" />}
                        {file.type === 'link' && <Globe className="w-3 h-3 text-emerald-400" />}
                        <span className="text-neutral-400 truncate max-w-[100px]">{file.name}</span>
                        <button onClick={() => removeAttachment(file.id)} className="text-neutral-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area - Same style as AstrovaSidebar */}
              <form onSubmit={(e) => { e.preventDefault(); sendArticleChatMessage(articleChatInput); }} className="px-3 py-3 border-t border-[hsl(220,8%,15%)]">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={articleChatInput}
                      onChange={e => setArticleChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendArticleChatMessage(articleChatInput); } }}
                      placeholder="Ask AI to write an article..."
                      disabled={articleChatLoading}
                      rows={1}
                      className="w-full bg-[hsl(220,10%,11%)] border border-[hsl(220,8%,20%)] rounded-2xl px-4 py-3 pr-20 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15 transition-all resize-none disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] max-h-[120px]"
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                      }}
                    />
                    {/* Attachment buttons inside textarea */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleLinkAdd}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                        title="Add link"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                        title="Attach file (PDF, DOC, TXT)"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {/* Send/Stop button */}
                  <Button 
                    type={articleChatLoading ? 'button' : 'submit'}
                    disabled={!articleChatLoading && !articleChatInput.trim()}
                    onClick={articleChatLoading ? stopGeneration : undefined}
                    className={`h-11 w-11 p-0 rounded-2xl border-0 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition-all shadow-lg ${articleChatLoading ? 'bg-orange-600/70 hover:bg-orange-600 shadow-orange-600/20' : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30'}`}
                  >
                    {articleChatLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[10px] text-neutral-600">PDF, DOC, TXT, links</span>
                  <span className="text-[10px] text-neutral-600">{articleChatMessages.filter(m => m.role === 'user').length} messages</span>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            {/* Current selected model */}
            <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Active Model for Users
                </h3>
                {modelSaveStatus === 'saved' && <span className="text-green-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
              </div>
              <div className="bg-[hsl(220,10%,10%)] rounded-lg p-3 border border-[hsl(220,8%,18%)]">
                <div className="text-white font-mono text-sm">{selectedModel}</div>
                <div className="text-neutral-500 text-xs mt-1">This model is used for all user AI interactions</div>
              </div>
            </div>

            {/* Enabled models list */}
            <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-neutral-400" /> Available Models ({models.length})
                </h3>
                <Button onClick={loadModels} variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-500 hover:text-white">
                  <RefreshCw className={`w-3.5 h-3.5 ${modelsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {modelsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-neutral-500 animate-spin" /></div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {models.map(model => (
                    <div key={model.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                      selectedModel === model.model_id ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[hsl(220,10%,10%)] border-[hsl(220,8%,16%)] hover:border-[hsl(220,8%,24%)]'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{model.display_name}</span>
                          {model.provider && <span className="px-1.5 py-0.5 rounded bg-neutral-500/20 text-neutral-400 text-[9px] font-medium">{model.provider}</span>}
                        </div>
                        <div className="text-neutral-500 text-[10px] font-mono mt-0.5 truncate">{model.model_id}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleModel(model.id, !model.is_enabled)}
                          className={`p-1 rounded-md transition-colors ${model.is_enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-neutral-600 hover:bg-neutral-800'}`}
                          title={model.is_enabled ? 'Disable' : 'Enable'}
                        >
                          {model.is_enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => handleSelectModel(model.model_id)}
                          disabled={selectedModel === model.model_id}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                            selectedModel === model.model_id
                              ? 'bg-amber-500/20 text-amber-300 cursor-default'
                              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                          }`}
                        >
                          {selectedModel === model.model_id ? 'Active' : 'Use'}
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model.id, model.model_id)}
                          className="p-1 rounded-md text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fetch from OpenRouter */}
            <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-neutral-400" /> Import from OpenRouter
                </h3>
                <Button
                  onClick={handleFetchOpenRouterModels}
                  disabled={fetchingOpenRouter}
                  size="sm"
                  className="gap-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-medium"
                >
                  {fetchingOpenRouter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {fetchingOpenRouter ? 'Fetching...' : 'Fetch Models'}
                </Button>
              </div>

              {openRouterModels.length > 0 && (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      value={modelSearchQuery}
                      onChange={e => setModelSearchQuery(e.target.value)}
                      placeholder="Search models..."
                      className="w-full bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,18%)] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/30"
                    />
                  </div>
                  <div className="text-neutral-500 text-xs mb-2">{filteredOpenRouterModels.length} models with tools support</div>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {filteredOpenRouterModels.slice(0, 50).map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,16%)] hover:border-[hsl(220,8%,24%)] transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-medium truncate">{m.name}</div>
                          <div className="text-neutral-500 text-[10px] font-mono truncate">{m.id}</div>
                        </div>
                        {existingModelIds.has(m.id) ? (
                          <span className="text-neutral-500 text-[10px]">Added</span>
                        ) : (
                          <Button
                            onClick={() => handleAddModel(m.id, m.name)}
                            size="sm"
                            className="h-6 px-2 text-[10px] bg-neutral-700 hover:bg-neutral-600 text-white"
                          >
                            <Plus className="w-3 h-3 mr-0.5" /> Add
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" /> Credit Costs
                </h3>
                <Button
                  onClick={handleSaveCreditSettings}
                  size="sm"
                  className={`gap-1 text-xs ${creditSaveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-neutral-200'}`}
                >
                  {creditSaveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {creditSaveStatus === 'saved' ? 'Saved!' : 'Save'}
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'ai_message' as const, label: 'AI Message', desc: 'Cost per AI chat message' },
                  { key: 'chart_generation' as const, label: 'Chart Generation', desc: 'Cost per chart generation' },
                  { key: 'matching' as const, label: 'Kundali Matching', desc: 'Cost per compatibility check' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,16%)]">
                    <div>
                      <div className="text-white text-sm font-medium">{item.label}</div>
                      <div className="text-neutral-500 text-xs">{item.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={creditCosts[item.key]}
                        onChange={e => setCreditCosts(prev => ({ ...prev, [item.key]: parseInt(e.target.value) || 0 }))}
                        className="w-16 h-8 bg-neutral-900 border border-neutral-700/50 rounded-lg text-center text-sm text-white focus:outline-none focus:border-neutral-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Default Credits</h3>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(220,10%,10%)] border border-[hsl(220,8%,16%)]">
                <div>
                  <div className="text-white text-sm font-medium">New User Credits</div>
                  <div className="text-neutral-500 text-xs">Credits given to new users on signup</div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={defaultCredits}
                  onChange={e => setDefaultCredits(parseInt(e.target.value) || 0)}
                  className="w-20 h-8 bg-neutral-900 border border-neutral-700/50 rounded-lg text-center text-sm text-white focus:outline-none focus:border-neutral-600"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-4">
                <div className="text-neutral-500 text-xs mb-1">KB Articles</div>
                <div className="text-2xl font-bold text-white">{stats.totalArticles}</div>
              </div>
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-4">
                <div className="text-neutral-500 text-xs mb-1">Categories</div>
                <div className="text-2xl font-bold text-white">{stats.categories.length}</div>
              </div>
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-4">
                <div className="text-neutral-500 text-xs mb-1">Models</div>
                <div className="text-2xl font-bold text-white">{models.filter(m => m.is_enabled).length}/{models.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/30"
                />
              </div>
              <Button onClick={loadUsers} variant="ghost" size="sm" className="h-9 w-9 p-0 text-neutral-500 hover:text-white">
                <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-3">
                <div className="text-neutral-500 text-[10px] mb-0.5">Total Users</div>
                <div className="text-xl font-bold text-white">{allUsers.length}</div>
              </div>
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-3">
                <div className="text-neutral-500 text-[10px] mb-0.5">Admins</div>
                <div className="text-xl font-bold text-amber-400">{allUsers.filter(u => u.role === 'admin').length}</div>
              </div>
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-3">
                <div className="text-neutral-500 text-[10px] mb-0.5">Banned</div>
                <div className="text-xl font-bold text-red-400">{allUsers.filter(u => u.is_banned).length}</div>
              </div>
              <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-3">
                <div className="text-neutral-500 text-[10px] mb-0.5">Total Credits Used</div>
                <div className="text-xl font-bold text-green-400">{allUsers.reduce((s, u) => s + (u.credits_used || 0), 0)}</div>
              </div>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-neutral-500 animate-spin" /></div>
            ) : (
              <div className="space-y-2">
                {allUsers
                  .filter(u => !userSearchQuery || u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) || (u.display_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()))
                  .map(u => (
                  <div key={u.id} className={`p-4 rounded-xl border transition-colors ${u.is_banned ? 'bg-red-500/5 border-red-500/20' : 'bg-[hsl(220,10%,8%)] border-[hsl(220,8%,18%)] hover:border-[hsl(220,8%,24%)]'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700/50 flex items-center justify-center shrink-0 text-xs font-bold text-white">
                          {(u.display_name?.[0] || u.email[0] || '?').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium truncate">{u.display_name || u.email.split('@')[0]}</span>
                            {u.role === 'admin' && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-medium flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />ADMIN</span>}
                            {u.is_banned && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-medium flex items-center gap-0.5"><Ban className="w-2.5 h-2.5" />BANNED</span>}
                          </div>
                          <div className="text-neutral-500 text-[10px] font-mono truncate">{u.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Credits display */}
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-amber-400" />
                            <span className="text-amber-300 text-sm font-bold">{u.credits}</span>
                          </div>
                          <div className="text-neutral-600 text-[9px]">used: {u.credits_used || 0}</div>
                        </div>

                        {/* Add/Remove credits */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="0"
                            value={creditAmountInput[u.id] || ''}
                            onChange={e => setCreditAmountInput(prev => ({ ...prev, [u.id]: e.target.value }))}
                            className="w-16 h-7 bg-neutral-900 border border-neutral-700/50 rounded text-center text-xs text-white focus:outline-none focus:border-neutral-600"
                          />
                          <Button onClick={() => handleAddCredits(u.id)} size="sm" className="h-7 px-2 text-[10px] bg-green-600/80 hover:bg-green-600 text-white">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* Role toggle */}
                        <button
                          onClick={() => handleSetRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                          className={`p-1.5 rounded-md transition-colors ${u.role === 'admin' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-neutral-600 hover:bg-neutral-800'}`}
                          title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>

                        {/* Ban toggle */}
                        <button
                          onClick={() => handleToggleBan(u.id, !u.is_banned)}
                          className={`p-1.5 rounded-md transition-colors ${u.is_banned ? 'text-red-400 hover:bg-red-500/10' : 'text-neutral-600 hover:bg-neutral-800 hover:text-red-400'}`}
                          title={u.is_banned ? 'Unban user' : 'Ban user'}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {u.last_login_at && (
                      <div className="text-neutral-600 text-[9px] mt-2 ml-12">Last login: {new Date(u.last_login_at).toLocaleDateString()} {new Date(u.last_login_at).toLocaleTimeString()}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="bg-[hsl(220,10%,8%)] border border-[hsl(220,8%,18%)] rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-neutral-400" /> System Configuration
              </h3>
              <div className="space-y-3 text-xs">
                {[
                  { label: 'Supabase URL', value: import.meta.env.VITE_SUPABASE_URL || 'Not configured' },
                  { label: 'Connection', value: supabase ? 'Connected' : 'Not Connected', status: supabase ? 'green' : 'red' },
                  { label: 'Auth Provider', value: 'Supabase Auth' },
                  { label: 'Active AI Model', value: selectedModel },
                  { label: 'Admin Email', value: astrovaUser?.email || '' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-neutral-800/30 last:border-0">
                    <span className="text-neutral-500">{item.label}</span>
                    <span className={`font-mono text-[11px] flex items-center gap-1.5 ${
                      'status' in item ? (item.status === 'green' ? 'text-green-400' : 'text-red-400') : 'text-white'
                    }`}>
                      {'status' in item && <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'green' ? 'bg-green-400' : 'bg-red-400'}`} />}
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

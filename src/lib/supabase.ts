import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn('[Astrova] Supabase client not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars.');
}

// ─── Astrova User ───────────────────────────────────────────────
export interface AstrovaUser {
  id: string;
  auth_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  is_banned: boolean;
  credits: number;
  credits_used: number;
  last_login_at: string | null;
  created_at: string;
}

export async function getOrCreateAstrovaUser(authId: string, email: string, displayName?: string, avatarUrl?: string): Promise<AstrovaUser | null> {
  if (!supabase) return null;
  // Try to find existing user (trigger may have already created it)
  const { data: existing, error: selectErr } = await supabase
    .from('astrova_users')
    .select('*')
    .eq('auth_id', authId)
    .single();
  if (existing) {
    // Update last login and return fresh data
    const { data: updated } = await supabase
      .from('astrova_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    return (updated ?? existing) as AstrovaUser;
  }
  // If SELECT failed for a reason other than "no rows", log and bail
  if (selectErr && selectErr.code !== 'PGRST116') {
    console.error('Fetch astrova user error:', selectErr);
  }
  // Create new user — trigger may race us, so handle conflict gracefully
  const { data: newUser, error } = await supabase
    .from('astrova_users')
    .insert({ auth_id: authId, email, display_name: displayName || email.split('@')[0], avatar_url: avatarUrl, credits: 20 })
    .select()
    .single();
  if (error) {
    // If unique constraint violation (trigger already created), just fetch
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('astrova_users')
        .select('*')
        .eq('auth_id', authId)
        .single();
      return (retry as AstrovaUser) ?? null;
    }
    console.error('Create astrova user error:', error);
    return null;
  }
  return newUser as AstrovaUser;
}

export async function getAstrovaUserById(userId: string): Promise<AstrovaUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('astrova_users').select('*').eq('id', userId).single();
  return (data as AstrovaUser) ?? null;
}

// ─── Admin: User Management ─────────────────────────────────────
export async function getAllAstrovaUsers(): Promise<AstrovaUser[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('astrova_users')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as AstrovaUser[]) ?? [];
}

export async function updateUserCredits(userId: string, amount: number, action: string, adminId?: string): Promise<boolean> {
  if (!supabase) return false;
  // Update credits
  const { error: updateErr } = await supabase.rpc('increment_credits', { row_id: userId, amount });
  if (updateErr) {
    // Fallback: manual update
    const { data: user } = await supabase.from('astrova_users').select('credits').eq('id', userId).single();
    if (!user) return false;
    const newCredits = Math.max(0, (user.credits || 0) + amount);
    await supabase.from('astrova_users').update({ credits: newCredits }).eq('id', userId);
  }
  // Log transaction
  await supabase.from('astrova_credit_log').insert({ user_id: userId, amount, action, description: action, admin_id: adminId });
  return true;
}

export async function toggleUserBan(userId: string, banned: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('astrova_users').update({ is_banned: banned, updated_at: new Date().toISOString() }).eq('id', userId);
  return !error;
}

export async function setUserRole(userId: string, role: 'user' | 'admin'): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('astrova_users').update({ role, updated_at: new Date().toISOString() }).eq('id', userId);
  return !error;
}

export async function getUserCreditLog(userId: string): Promise<{ id: string; amount: number; action: string; created_at: string }[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('astrova_credit_log')
    .select('id, amount, action, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as { id: string; amount: number; action: string; created_at: string }[]) ?? [];
}

export async function deductUserCredits(userId: string, amount: number, action: string): Promise<boolean> {
  if (!supabase || amount <= 0) return true;
  const { data: user } = await supabase.from('astrova_users').select('credits, credits_used').eq('id', userId).single();
  if (!user || user.credits < amount) return false;
  await supabase.from('astrova_users').update({
    credits: user.credits - amount,
    credits_used: (user.credits_used || 0) + amount,
  }).eq('id', userId);
  await supabase.from('astrova_credit_log').insert({ user_id: userId, amount: -amount, action });
  return true;
}

export interface KBArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

export async function searchKnowledgeBase(query: string): Promise<KBArticle[]> {
  if (!supabase) return [];
  
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (keywords.length === 0) return [];

  // Full-text search on title + content
  const tsQuery = keywords.join(' & ');
  const { data, error } = await supabase
    .from('astrova_knowledge_base')
    .select('id, title, category, content, tags')
    .eq('is_active', true)
    .textSearch('title', tsQuery, { config: 'english', type: 'websearch' })
    .limit(5);

  if (error || !data || data.length === 0) {
    // Fallback: tag-based search
    const { data: tagData } = await supabase
      .from('astrova_knowledge_base')
      .select('id, title, category, content, tags')
      .eq('is_active', true)
      .overlaps('tags', keywords)
      .limit(5);
    return (tagData as KBArticle[]) ?? [];
  }

  return data as KBArticle[];
}

export async function getAllKBArticles(): Promise<KBArticle[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('astrova_knowledge_base')
    .select('id, title, category, content, tags')
    .eq('is_active', true)
    .order('category', { ascending: true });
  return (data as KBArticle[]) ?? [];
}

export async function upsertKBArticle(article: Partial<KBArticle> & { title: string; content: string; category: string }): Promise<KBArticle | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('astrova_knowledge_base')
    .upsert({ ...article, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single();
  if (error) { console.error('KB upsert error:', error); return null; }
  return data as KBArticle;
}

export async function deleteKBArticle(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('astrova_knowledge_base')
    .delete()
    .eq('id', id);
  return !error;
}

// Admin config helpers
export async function getAdminConfig(key: string): Promise<unknown> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('astrova_admin_config')
    .select('config_value')
    .eq('config_key', key)
    .single();
  return data?.config_value ?? null;
}

export async function setAdminConfig(key: string, value: unknown): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('astrova_admin_config')
    .upsert({ config_key: key, config_value: value, updated_at: new Date().toISOString() }, { onConflict: 'config_key' });
  return !error;
}

export async function getAllAdminConfig(): Promise<Record<string, unknown>> {
  if (!supabase) return {};
  const { data } = await supabase
    .from('astrova_admin_config')
    .select('config_key, config_value');
  if (!data) return {};
  const config: Record<string, unknown> = {};
  for (const row of data) {
    config[row.config_key] = row.config_value;
  }
  return config;
}

// Enabled models helpers
export interface EnabledModel {
  id: string;
  model_id: string;
  display_name: string;
  provider: string;
  is_enabled: boolean;
  sort_order: number;
}

export async function getEnabledModels(): Promise<EnabledModel[]> {
  if (!supabase) { console.error('[Astrova] Supabase not initialized'); return []; }
  const { data, error } = await supabase
    .from('enabled_models')
    .select('id, model_id, display_name, provider, is_enabled, sort_order')
    .order('sort_order', { ascending: true });
  if (error) console.error('[Astrova] getEnabledModels error:', error.message, error.details);
  return (data as EnabledModel[]) ?? [];
}

export async function toggleModel(id: string, enabled: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('enabled_models')
    .update({ is_enabled: enabled })
    .eq('id', id);
  if (error) console.error('[Astrova] toggleModel error:', error.message, error.details);
  return !error;
}

export async function addModelFromOpenRouter(modelId: string, modelName: string): Promise<boolean> {
  if (!supabase) { console.error('[Astrova] Supabase not initialized'); return false; }
  const provider = modelId.includes('/') ? modelId.split('/')[0] : 'openrouter';
  const { error } = await supabase
    .from('enabled_models')
    .upsert({
      model_id: modelId,
      display_name: modelName,
      provider,
      // Keep imported models immediately usable in production/client environments.
      // Admin can still disable explicitly from the Models tab.
      is_enabled: true,
      sort_order: 99,
    }, { onConflict: 'model_id' });
  if (error) console.error('[Astrova] addModel error:', error.message, error.details);
  return !error;
}

export async function deleteModel(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('enabled_models')
    .delete()
    .eq('id', id);
  if (error) console.error('[Astrova] deleteModel error:', error.message, error.details);
  return !error;
}

// User settings helpers
export async function getUserSetting(userId: string, key: string): Promise<unknown> {
  if (!supabase || !userId) return null;
  // Try user_id first, fallback to clerk_user_id
  let { data } = await supabase
    .from('astrova_user_settings')
    .select('setting_value')
    .eq('user_id', userId)
    .eq('setting_key', key)
    .single();
  if (!data) {
    const res = await supabase
      .from('astrova_user_settings')
      .select('setting_value')
      .eq('clerk_user_id', userId)
      .eq('setting_key', key)
      .single();
    data = res.data;
  }
  if (!data) return null;
  const val = data.setting_value;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

export async function setUserSetting(userId: string, key: string, value: unknown): Promise<boolean> {
  if (!supabase || !userId) return false;
  const { error } = await supabase
    .from('astrova_user_settings')
    .upsert({
      user_id: userId,
      setting_key: key,
      setting_value: typeof value === 'string' ? JSON.stringify(value) : value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,setting_key' });
  return !error;
}

// Chat session helpers
export interface ChatSession {
  id: string;
  user_id: string;
  clerk_user_id?: string;
  title: string;
  messages: unknown[];
  model_used: string | null;
  session_type: 'astrology' | 'admin_article';
  created_at: string;
  updated_at: string;
}

export async function getUserChatSessions(userId: string, type?: string): Promise<ChatSession[]> {
  if (!supabase || !userId) return [];
  let query = supabase
    .from('astrova_chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (type) query = query.eq('session_type', type);
  const { data } = await query.limit(50);
  return (data as ChatSession[]) ?? [];
}

export async function saveChatSession(session: Partial<ChatSession> & { user_id: string }): Promise<ChatSession | null> {
  if (!supabase) return null;
  const now = new Date().toISOString();
  if (session.id) {
    // Update existing session
    const { data, error } = await supabase
      .from('astrova_chat_sessions')
      .update({ ...session, updated_at: now })
      .eq('id', session.id)
      .select()
      .single();
    if (error) { console.error('Chat session update error:', error); return null; }
    return data as ChatSession;
  } else {
    // Insert new session
    const { data, error } = await supabase
      .from('astrova_chat_sessions')
      .insert({ ...session, created_at: now, updated_at: now })
      .select()
      .single();
    if (error) { console.error('Chat session insert error:', error); return null; }
    return data as ChatSession;
  }
}

export async function deleteChatSession(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('astrova_chat_sessions')
    .delete()
    .eq('id', id);
  return !error;
}

// Get enabled models for user selection (only enabled ones)
export async function getUserEnabledModels(): Promise<EnabledModel[]> {
  if (!supabase) { console.error('[Astrova] Supabase not initialized'); return []; }
  const { data, error } = await supabase
    .from('enabled_models')
    .select('id, model_id, display_name, provider, is_enabled, sort_order')
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true });
  if (error) console.error('[Astrova] getUserEnabledModels error:', error.message, error.details);
  return (data as EnabledModel[]) ?? [];
}

// Saved charts in Supabase
export async function getUserSavedCharts(userId: string): Promise<unknown[]> {
  if (!supabase || !userId) return [];
  // Try user_id first, fallback to clerk_user_id
  let { data } = await supabase
    .from('astrova_saved_charts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (!data || data.length === 0) {
    const res = await supabase
      .from('astrova_saved_charts')
      .select('*')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false });
    data = res.data;
  }
  return data ?? [];
}

export async function saveChartToSupabase(userId: string, chart: {
  name: string;
  birth_data: unknown;
  kundali_data?: unknown;
  location_name?: string;
  coordinates?: unknown;
}): Promise<unknown> {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('astrova_saved_charts')
    .insert({ user_id: userId, ...chart })
    .select()
    .single();
  if (error) { console.error('Save chart error:', error); return null; }
  return data;
}

export async function updateChartInSupabase(id: string, updates: { name?: string; kundali_data?: unknown }): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('astrova_saved_charts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deleteChartFromSupabase(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('astrova_saved_charts')
    .delete()
    .eq('id', id);
  return !error;
}

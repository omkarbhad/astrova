// Frontend API client — replaces supabase.ts
// All DB operations go through Vercel Edge Functions at /api/*
// Auth token is injected by AuthContext via setTokenProvider()

// ─── Token Provider ──────────────────────────────────────────────
let _getToken: (() => string | null) | null = null;

export function setTokenProvider(fn: () => string | null) {
  _getToken = fn;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = _getToken?.();
  // All API endpoints require auth — skip the request if no token yet
  if (!token) return null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(path, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> || {}) },
    });
    if (!res.ok) { console.error(`[api] ${path} ${res.status}`); return null; }
    return res.json() as Promise<T>;
  } catch (e) {
    console.error(`[api] ${path}`, e);
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────
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

export interface KBArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

export interface EnabledModel {
  id: string;
  model_id: string;
  display_name: string;
  provider: string;
  is_enabled: boolean;
  sort_order: number;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  messages: unknown[];
  model_used: string | null;
  session_type: 'astrology' | 'admin_article';
  created_at: string;
  updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────
function castUser(data: AstrovaUser): AstrovaUser {
  return { ...data, is_banned: Boolean(data.is_banned) };
}

function parseTagsIfNeeded(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags as string[];
  if (typeof tags === 'string') { try { return JSON.parse(tags); } catch { return []; } }
  return [];
}

// ─── User ─────────────────────────────────────────────────────────
export async function getOrCreateAstrovaUser(
  authId: string, email: string, displayName?: string, avatarUrl?: string
): Promise<AstrovaUser | null> {
  const data = await apiFetch<AstrovaUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ authId, email, displayName, avatarUrl }),
  });
  return data ? castUser(data) : null;
}

export async function getAstrovaUserById(userId: string): Promise<AstrovaUser | null> {
  const data = await apiFetch<AstrovaUser>(`/api/users/${userId}`);
  return data ? castUser(data) : null;
}

// ─── Admin: User Management ───────────────────────────────────────
export async function getAllAstrovaUsers(): Promise<AstrovaUser[]> {
  const data = await apiFetch<AstrovaUser[]>('/api/users/all');
  return (data ?? []).map(castUser);
}

export async function updateUserCredits(
  userId: string, amount: number, action: string, adminId?: string
): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/credits', {
    method: 'POST',
    body: JSON.stringify({ userId, amount, action, adminId, type: 'add' }),
  });
  return !!res?.ok;
}

export async function deductUserCredits(
  userId: string, amount: number, action: string
): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/credits', {
    method: 'POST',
    body: JSON.stringify({ userId, amount, action, type: 'deduct' }),
  });
  return !!res?.ok;
}

export async function getUserCreditLog(
  userId: string
): Promise<{ id: string; amount: number; action: string; created_at: string }[]> {
  const data = await apiFetch<{ id: string; amount: number; action: string; created_at: string }[]>(
    `/api/credits/log?userId=${encodeURIComponent(userId)}`
  );
  return data ?? [];
}

export async function toggleUserBan(userId: string, banned: boolean): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_banned: banned ? 1 : 0 }),
  });
  return !!res?.ok;
}

export async function setUserRole(userId: string, role: 'user' | 'admin'): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return !!res?.ok;
}

// ─── Knowledge Base ───────────────────────────────────────────────
export async function searchKnowledgeBase(query: string): Promise<KBArticle[]> {
  const data = await apiFetch<KBArticle[]>(`/api/kb?search=${encodeURIComponent(query)}`);
  return (data ?? []).map(a => ({ ...a, tags: parseTagsIfNeeded(a.tags) }));
}

export async function getAllKBArticles(): Promise<KBArticle[]> {
  const data = await apiFetch<KBArticle[]>('/api/kb');
  return (data ?? []).map(a => ({ ...a, tags: parseTagsIfNeeded(a.tags) }));
}

export async function upsertKBArticle(
  article: Partial<KBArticle> & { title: string; content: string; category: string }
): Promise<KBArticle | null> {
  return apiFetch<KBArticle>('/api/kb', {
    method: 'POST',
    body: JSON.stringify({ ...article }),
  });
}

export async function deleteKBArticle(id: string): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/kb/${id}`, { method: 'DELETE' });
  return !!res?.ok;
}

// ─── Admin Config ─────────────────────────────────────────────────
export async function getAdminConfig(key: string): Promise<unknown> {
  const res = await apiFetch<{ value: unknown }>(
    `/api/admin/config?key=${encodeURIComponent(key)}`
  );
  return res?.value ?? null;
}

export async function setAdminConfig(key: string, value: unknown): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/admin/config', {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
  return !!res?.ok;
}

export async function getAllAdminConfig(): Promise<Record<string, unknown>> {
  return (await apiFetch<Record<string, unknown>>('/api/admin/config?all=1')) ?? {};
}

// ─── Models ───────────────────────────────────────────────────────
export async function getEnabledModels(): Promise<EnabledModel[]> {
  const data = await apiFetch<EnabledModel[]>('/api/models');
  return (data ?? []).map(m => ({ ...m, is_enabled: Boolean(m.is_enabled) }));
}

export async function getUserEnabledModels(): Promise<EnabledModel[]> {
  const data = await apiFetch<EnabledModel[]>('/api/models?enabled=1');
  return (data ?? []).map(m => ({ ...m, is_enabled: Boolean(m.is_enabled) }));
}

export async function toggleModel(id: string, enabled: boolean): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/models/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_enabled: enabled ? 1 : 0 }),
  });
  return !!res?.ok;
}

export async function addModelFromOpenRouter(modelId: string, modelName: string): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/models', {
    method: 'POST',
    body: JSON.stringify({ modelId, modelName }),
  });
  return !!res?.ok;
}

export async function deleteModel(id: string): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/models/${id}`, { method: 'DELETE' });
  return !!res?.ok;
}

// ─── User Settings ────────────────────────────────────────────────
export async function getUserSetting(userId: string, key: string): Promise<unknown> {
  const res = await apiFetch<{ value: unknown }>(
    `/api/settings?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`
  );
  return res?.value ?? null;
}

export async function setUserSetting(userId: string, key: string, value: unknown): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/settings', {
    method: 'POST',
    body: JSON.stringify({ userId, key, value }),
  });
  return !!res?.ok;
}

// ─── Chat Sessions ────────────────────────────────────────────────
export async function getUserChatSessions(userId: string, type?: string): Promise<ChatSession[]> {
  const q = type ? `&type=${encodeURIComponent(type)}` : '';
  const data = await apiFetch<ChatSession[]>(
    `/api/sessions?userId=${encodeURIComponent(userId)}${q}`
  );
  return (data ?? []).map(s => ({
    ...s,
    messages: Array.isArray(s.messages) ? s.messages : (() => {
      try { return JSON.parse(s.messages as unknown as string); } catch { return []; }
    })(),
  }));
}

export async function saveChatSession(
  session: Partial<ChatSession> & { user_id: string }
): Promise<ChatSession | null> {
  return apiFetch<ChatSession>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}

export async function deleteChatSession(id: string): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/sessions/${id}`, { method: 'DELETE' });
  return !!res?.ok;
}

// ─── Saved Charts ─────────────────────────────────────────────────
export async function getUserSavedCharts(userId: string): Promise<unknown[]> {
  return (await apiFetch<unknown[]>(`/api/charts?userId=${encodeURIComponent(userId)}`)) ?? [];
}

export async function saveChartToSupabase(
  userId: string,
  chart: { name: string; birth_data: unknown; kundali_data?: unknown; location_name?: string; coordinates?: unknown }
): Promise<unknown> {
  return apiFetch('/api/charts', {
    method: 'POST',
    body: JSON.stringify({ userId, ...chart }),
  });
}

export async function updateChartInSupabase(
  id: string, updates: { name?: string; kundali_data?: unknown }
): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/charts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return !!res?.ok;
}

export async function deleteChartFromSupabase(id: string): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>(`/api/charts/${id}`, { method: 'DELETE' });
  return !!res?.ok;
}

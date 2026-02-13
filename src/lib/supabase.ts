import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

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
    .order('sort_order', { ascending: true });
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

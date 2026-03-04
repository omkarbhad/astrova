import { getDb, json } from './_lib/db';
import { requireAuth } from './_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const search = url.searchParams.get('search');

      if (search) {
        const keywords = search.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (keywords.length === 0) return json([]);

        // PostgreSQL full-text search
        try {
          const ftsRows = await sql`
            SELECT id, title, category, content, tags
            FROM astrova_knowledge_base
            WHERE is_active = true
              AND to_tsvector('english', title || ' ' || content) @@ websearch_to_tsquery('english', ${search})
            ORDER BY ts_rank(to_tsvector('english', title || ' ' || content), websearch_to_tsquery('english', ${search})) DESC
            LIMIT 5`;
          if (ftsRows.length > 0) {
            return json(ftsRows);
          }
        } catch { /* FTS unavailable, fall through */ }

        // Tag fallback using PostgreSQL array overlap
        const tagRows = await sql`
          SELECT DISTINCT id, title, category, content, tags
          FROM astrova_knowledge_base
          WHERE is_active = true AND tags && ${keywords}::text[]
          LIMIT 5`;
        return json(tagRows);
      }

      // List all active
      const rows = await sql`
        SELECT id, title, category, content, tags
        FROM astrova_knowledge_base
        WHERE is_active = true
        ORDER BY category ASC`;
      return json(rows);
    }

    if (req.method === 'POST') {
      // Only admins can create/update KB articles
      const adminCheck = await sql`SELECT role FROM astrova_users WHERE auth_id = ${auth.sub} LIMIT 1`;
      if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
        return new Response('Forbidden', { status: 403 });
      }

      const article = await req.json() as {
        id?: string; title: string; category: string; content: string; tags?: string[];
      };
      const tags = article.tags ?? [];

      if (article.id) {
        // Update existing
        const updated = await sql`
          UPDATE astrova_knowledge_base
          SET title = ${article.title}, category = ${article.category}, content = ${article.content},
              tags = ${tags}::text[], updated_at = now()
          WHERE id = ${article.id}
          RETURNING *`;
        return json(updated[0]);
      }

      // Insert new
      const inserted = await sql`
        INSERT INTO astrova_knowledge_base (title, category, content, tags)
        VALUES (${article.title}, ${article.category}, ${article.content}, ${tags}::text[])
        RETURNING *`;
      return json(inserted[0], 201);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[kb]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

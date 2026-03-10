import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth, requireAdmin } from './_lib/auth.js';

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

        // FTS path (works if the backing DB supports these functions).
        try {
          const ftsRows = await sql`
            SELECT id, title, category, content, tags
            FROM knowledge_base
            WHERE is_active = true
              AND to_tsvector('english', title || ' ' || content) @@ websearch_to_tsquery('english', ${search})
            ORDER BY ts_rank(to_tsvector('english', title || ' ' || content), websearch_to_tsquery('english', ${search})) DESC
            LIMIT 5`;
          if (ftsRows.length > 0) {
            return json(ftsRows);
          }
        } catch (ftsErr) {
          console.warn('[kb] FTS search failed, falling back to keyword scan:', ftsErr instanceof Error ? ftsErr.message : 'unknown');
        }

        // Cross-DB fallback: scan active articles in memory and score by keyword hits.
        const allRows = await sql`
          SELECT id, title, category, content, tags
          FROM knowledge_base
          WHERE is_active = true
          ORDER BY updated_at DESC
          LIMIT 200`;

        const scored = allRows.map((row) => {
          const title = String(row.title ?? '').toLowerCase();
          const category = String(row.category ?? '').toLowerCase();
          const content = String(row.content ?? '').toLowerCase();
          const tags = Array.isArray(row.tags) ? row.tags.map((t) => String(t).toLowerCase()) : [];

          let score = 0;
          for (const keyword of keywords) {
            if (title.includes(keyword)) score += 4;
            if (category.includes(keyword)) score += 2;
            if (content.includes(keyword)) score += 1;
            if (tags.some((tag) => tag.includes(keyword))) score += 3;
          }
          return { score, row };
        });

        return json(
          scored
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((item) => item.row),
        );
      }

      // List all active
      const rows = await sql`
        SELECT id, title, category, content, tags
        FROM knowledge_base
        WHERE is_active = true
        ORDER BY category ASC`;
      return json(rows);
    }

    if (req.method === 'POST') {
      // [FIX #39] Use reusable admin check
      await requireAdmin(sql, auth);

      // [FIX #21] Safe JSON parsing
      const article = await parseBody<{
        id?: string; title: string; category: string; content: string; tags?: string[];
      }>(req);

      // [FIX #31, #32] Validate field lengths
      if (!article.title || article.title.length > 500) return jsonError('Title required (max 500 chars)');
      if (!article.category || article.category.length > 200) return jsonError('Category required (max 200 chars)');
      if (!article.content || article.content.length > 100000) return jsonError('Content required (max 100k chars)');

      const tags = (article.tags ?? []).slice(0, 20);

      if (article.id) {
        const updated = await sql`
          UPDATE knowledge_base
          SET title = ${article.title}, category = ${article.category}, content = ${article.content},
              tags = ${tags}::text[], updated_at = now()
          WHERE id = ${article.id}
          RETURNING *`;
        // [FIX #40] Null check
        if (!updated[0]) return jsonError('Article not found', 404);
        return json(updated[0]);
      }

      const inserted = await sql`
        INSERT INTO knowledge_base (title, category, content, tags)
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

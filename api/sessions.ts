import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth, requireOwnership } from './_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId') ?? '';
      const type = url.searchParams.get('type');
      if (!userId) return json([]);
      await requireOwnership(sql, auth, userId);

      const rows = type
        ? await sql`
            SELECT * FROM chat_sessions
            WHERE user_id = ${userId} AND session_type = ${type}
            ORDER BY updated_at DESC LIMIT 50`
        : await sql`
            SELECT * FROM chat_sessions
            WHERE user_id = ${userId}
            ORDER BY updated_at DESC LIMIT 50`;

      return json(rows);
    }

    if (req.method === 'POST') {
      const MAX_MESSAGES = 500;
      const MAX_TITLE_LEN = 500;

      const session = await parseBody<{
        id?: string; user_id: string; title?: string; messages?: unknown[];
        model_used?: string; session_type?: string;
      }>(req);
      await requireOwnership(sql, auth, session.user_id);

      const title = (session.title ?? 'New Chat').slice(0, MAX_TITLE_LEN);
      const messages = Array.isArray(session.messages) ? session.messages.slice(0, MAX_MESSAGES) : [];

      if (session.id) {
        // Verify the session belongs to this user before updating
        const existing = await sql`SELECT user_id FROM chat_sessions WHERE id = ${session.id} LIMIT 1`;
        if (existing[0] && existing[0].user_id !== session.user_id) {
          throw new Response('Forbidden', { status: 403 });
        }

        await sql`
          UPDATE chat_sessions
          SET title = ${title},
              messages = ${JSON.stringify(messages)}::jsonb,
              model_used = ${session.model_used ?? null},
              updated_at = now()
          WHERE id = ${session.id} AND user_id = ${session.user_id}`;
        const rows = await sql`SELECT * FROM chat_sessions WHERE id = ${session.id} LIMIT 1`;
        if (!rows[0]) return jsonError('Session not found', 404);
        return json(rows[0]);
      }

      // Insert new
      const inserted = await sql`
        INSERT INTO chat_sessions
        (user_id, title, messages, model_used, session_type)
        VALUES (
          ${session.user_id},
          ${title},
          ${JSON.stringify(messages)}::jsonb,
          ${session.model_used ?? null},
          ${session.session_type ?? 'astrology'}
        )
        RETURNING *`;
      return json(inserted[0], 201);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[sessions]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

import { getDb, json } from '../_lib/db.js';
import { requireAuth, requireOwnership } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId') ?? '';
      if (!userId) return json([], 400);
      await requireOwnership(sql, auth, userId);

      const rows = await sql`
        SELECT id, amount, action, created_at
        FROM credit_transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 50`;
      return json(rows);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[credits/log]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

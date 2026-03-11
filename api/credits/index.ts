import { getDb, json, jsonError, parseBody } from '../_lib/db.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();
    console.log('[credits] API call:', { method: req.method, userId: auth.id });

    if (req.method === 'POST') {
      const { userId, amount, action, type, description } = await parseBody<{
        userId: string;
        amount: number;
        action: string;
        type: 'deduct' | 'add';
        description?: string;
      }>(req);

      console.log('[credits] POST request:', { userId, amount, action, type });

      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
        return jsonError('Amount must be a non-zero number');
      }
      const safeAmount = Math.abs(Math.floor(amount));
      if (safeAmount > 100000) return jsonError('Amount exceeds maximum');

      if (!action || typeof action !== 'string' || action.length > 100) {
        return jsonError('Action must be a non-empty string (max 100 chars)');
      }

      if (type === 'deduct') {
        if (auth.id !== userId) {
          await requireAdmin(sql, auth);
        }

        console.log('[credits] deducting credits:', { userId, safeAmount });

        const result = await sql`
          UPDATE users
          SET credits = credits - ${safeAmount},
              credits_used = credits_used + ${safeAmount}
          WHERE id = ${userId} AND credits >= ${safeAmount}
          RETURNING credits`;

        console.log('[credits] deduction result:', result);

        if (!result[0]) {
          const check = await sql`SELECT credits FROM users WHERE id = ${userId} LIMIT 1`;
          console.log('[credits] user credits check:', check);
          if (!check[0]) return jsonError('User not found', 404);
          return jsonError('Insufficient credits', 400);
        }

        try {
          await sql`
            INSERT INTO credit_transactions (user_id, amount, type, description)
            VALUES (${userId}, ${-safeAmount}, 'deduct', ${description ?? action})`;
        } catch { }

        return json({ ok: true, credits: (result[0] as { credits: number }).credits });
      }

      if (type === 'add') {
        await requireAdmin(sql, auth);

        const result = await sql`
          UPDATE users SET credits = credits + ${safeAmount}
          WHERE id = ${userId}
          RETURNING credits`;
        if (!result[0]) return jsonError('User not found', 404);

        try {
          await sql`
            INSERT INTO credit_transactions (user_id, amount, type, description)
            VALUES (${userId}, ${safeAmount}, 'add', ${description ?? action})`;
        } catch { }

        return json({ ok: true, credits: (result[0] as { credits: number }).credits });
      }

      return jsonError('Invalid type. Must be "deduct" or "add"');
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[credits]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

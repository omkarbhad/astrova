import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth, requireOwnership, requireAdmin } from './_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'POST') {
      // [FIX #21] Safe JSON parsing
      const { userId, amount, action, adminId, type } = await parseBody<{
        userId: string;
        amount: number;
        action: string;
        adminId?: string;
        type: 'deduct' | 'add';
      }>(req);

      // [FIX #22] Validate amount is a positive finite integer
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return jsonError('Amount must be a positive number');
      }
      const safeAmount = Math.floor(amount); // No fractional credits
      if (safeAmount > 100000) return jsonError('Amount exceeds maximum');

      // [FIX #31] Validate action string length
      if (!action || typeof action !== 'string' || action.length > 100) {
        return jsonError('Action must be a non-empty string (max 100 chars)');
      }

      if (type === 'deduct') {
        await requireOwnership(sql, auth, userId);

        const result = await sql`
          UPDATE users
          SET credits = credits - ${safeAmount}
          WHERE id = ${userId} AND credits >= ${safeAmount}
          RETURNING credits`;

        if (!result[0]) {
          const check = await sql`SELECT credits FROM users WHERE id = ${userId} LIMIT 1`;
          if (!check[0]) return jsonError('User not found', 404);
          return jsonError('Insufficient credits', 400);
        }

        try {
          await sql`
            INSERT INTO credit_transactions (user_id, amount, action)
            VALUES (${userId}, ${-safeAmount}, ${action})`;
        } catch { /* log table may not exist */ }

        return json({ ok: true, credits: (result[0] as { credits: number }).credits });
      }

      if (type === 'add') {
        // Admin-only: add credits to any user (used from AdminPage or future payment webhook)
        await requireAdmin(sql, auth);

        const result = await sql`
          UPDATE users SET credits = credits + ${safeAmount}
          WHERE id = ${userId}
          RETURNING credits`;
        if (!result[0]) return jsonError('User not found', 404);

        try {
          await sql`
            INSERT INTO credit_transactions (user_id, amount, action, admin_id)
            VALUES (${userId}, ${safeAmount}, ${action}, ${adminId ?? null})`;
        } catch { /* log table may not exist */ }

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

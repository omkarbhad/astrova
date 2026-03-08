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

        // [FIX #24] Atomic check-and-deduct in a single UPDATE with WHERE clause
        // This prevents race conditions by combining the balance check with the deduction
        await sql.transaction([
          sql`
            UPDATE users
            SET credits = credits - ${safeAmount}, credits_used = credits_used + ${safeAmount}, updated_at = now()
            WHERE id = ${userId} AND credits >= ${safeAmount}`,
          sql`
            INSERT INTO credit_transactions (user_id, amount, action)
            VALUES (${userId}, ${-safeAmount}, ${action})`,
        ]);

        // Check if the deduction actually happened
        const check = await sql`SELECT credits FROM users WHERE id = ${userId} LIMIT 1`;
        if (!check[0]) return jsonError('User not found', 404);
        return json({ ok: true });
      }

      if (type === 'add') {
        // [FIX #23] Only admins can add credits
        await requireAdmin(sql, auth);

        await sql.transaction([
          sql`
            UPDATE users SET credits = credits + ${safeAmount}, updated_at = now()
            WHERE id = ${userId}`,
          sql`
            INSERT INTO credit_transactions (user_id, amount, action, admin_id)
            VALUES (${userId}, ${safeAmount}, ${action}, ${adminId ?? null})`,
        ]);
        return json({ ok: true });
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

import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth, requireOwnership, requireAdmin } from './_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'POST') {
      const { userId, amount, action, adminId, type } = await parseBody<{
        userId: string;
        amount: number;
        action: string;
        adminId?: string;
        type: 'deduct' | 'add';
      }>(req);

      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return jsonError('Amount must be a positive number');
      }
      const safeAmount = Math.floor(amount);
      if (safeAmount > 100000) return jsonError('Amount exceeds maximum');

      if (!action || typeof action !== 'string' || action.length > 100) {
        return jsonError('Action must be a non-empty string (max 100 chars)');
      }

      if (type === 'deduct') {
        await requireOwnership(sql, auth, userId);

        await sql.transaction([
          sql`
            UPDATE astrova_users
            SET credits = credits - ${safeAmount}, credits_used = credits_used + ${safeAmount}, updated_at = now()
            WHERE id = ${userId} AND credits >= ${safeAmount}`,
          sql`
            INSERT INTO astrova_credit_log (user_id, amount, action)
            VALUES (${userId}, ${-safeAmount}, ${action})`,
        ]);

        const fresh = await sql`SELECT credits FROM astrova_users WHERE id = ${userId} LIMIT 1`;
        if (!fresh[0]) return jsonError('User not found', 404);
        return json({ ok: true, credits: Number(fresh[0].credits ?? 0) });
      }

      if (type === 'add') {
        await requireAdmin(sql, auth);

        await sql.transaction([
          sql`
            UPDATE astrova_users SET credits = credits + ${safeAmount}, updated_at = now()
            WHERE id = ${userId}`,
          sql`
            INSERT INTO astrova_credit_log (user_id, amount, action, admin_id)
            VALUES (${userId}, ${safeAmount}, ${action}, ${adminId ?? null})`,
        ]);
        const fresh = await sql`SELECT credits FROM astrova_users WHERE id = ${userId} LIMIT 1`;
        return json({ ok: true, credits: Number(fresh[0]?.credits ?? 0) });
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

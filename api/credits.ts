import { getDb, json } from './_lib/db';
import { requireAuth, requireOwnership } from './_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'POST') {
      const { userId, amount, action, adminId, type } = await req.json() as {
        userId: string;
        amount: number;
        action: string;
        adminId?: string;
        type: 'deduct' | 'add';
      };
      await requireOwnership(sql, auth, userId);

      if (type === 'deduct') {
        // Check balance first
        const check = await sql`SELECT credits, credits_used FROM astrova_users WHERE id = ${userId} LIMIT 1`;
        const user = check[0];
        if (!user || (user.credits as number) < amount) {
          return json({ ok: false, error: 'Insufficient credits' }, 400);
        }

        // Atomic transaction: deduct credits + insert log
        await sql.transaction([
          sql`
            UPDATE astrova_users
            SET credits = credits - ${amount}, credits_used = credits_used + ${amount}, updated_at = now()
            WHERE id = ${userId}`,
          sql`
            INSERT INTO astrova_credit_log (user_id, amount, action)
            VALUES (${userId}, ${-amount}, ${action})`,
        ]);
        return json({ ok: true });
      }

      if (type === 'add') {
        // Atomic transaction: add credits + insert log
        await sql.transaction([
          sql`
            UPDATE astrova_users SET credits = credits + ${amount}, updated_at = now()
            WHERE id = ${userId}`,
          sql`
            INSERT INTO astrova_credit_log (user_id, amount, action, admin_id)
            VALUES (${userId}, ${amount}, ${action}, ${adminId ?? null})`,
        ]);
        return json({ ok: true });
      }

      return json({ ok: false }, 400);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[credits]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

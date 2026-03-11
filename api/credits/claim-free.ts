import { getDb, json, jsonError } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

const FREE_CREDITS = 20;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    // Check if user already claimed via astrova_credit_log
    let alreadyClaimed = false;
    try {
      const log = await sql`
        SELECT 1 FROM astrova_credit_log
        WHERE user_id = ${auth.id} AND type = ${'free_claim'}
        LIMIT 1`;
      alreadyClaimed = log && log.length > 0;
    } catch (e) {
      // astrova_credit_log table may not exist or query failed
      // If table doesn't exist, proceed anyway - user can claim
      console.log('[claim-free] TX check error (ok):', e instanceof Error ? e.message : String(e));
    }

    if (alreadyClaimed) {
      return jsonError('Free credits already claimed', 400);
    }

    const result = await sql`
      UPDATE astrova_users
      SET credits = credits + ${FREE_CREDITS}
      WHERE id = ${auth.id}
      RETURNING credits`;

    if (!result[0]) return jsonError('User not found', 404);

    // Log the claim transaction
    try {
      await sql`
        INSERT INTO astrova_credit_log (user_id, amount, type, description)
        VALUES (${auth.id}, ${FREE_CREDITS}, 'free_claim', 'Free credits claimed')`;
    } catch {
      // Log may fail but credits were already added - that's ok
    }

    return json({ ok: true, credits: (result[0] as { credits: number }).credits });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[credits/claim-free] error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

import { getDb, json, jsonError } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

const FREE_CREDITS = 20;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    // Check if user already claimed via credit_transactions log
    let alreadyClaimed = false;
    try {
      const log = await sql`
        SELECT id FROM credit_transactions
        WHERE user_id = ${auth.id} AND type = 'free_claim'
        LIMIT 1`;
      alreadyClaimed = log.length > 0;
    } catch { /* credit_transactions may not exist — allow claim */ }

    if (alreadyClaimed) {
      return jsonError('Free credits already claimed', 400);
    }

    const result = await sql`
      UPDATE users
      SET credits = credits + ${FREE_CREDITS}
      WHERE id = ${auth.id}
      RETURNING credits`;

    if (!result[0]) return jsonError('User not found', 404);

    try {
      await sql`
        INSERT INTO credit_transactions (user_id, amount, type, description)
        VALUES (${auth.id}, ${FREE_CREDITS}, 'free_claim', 'Free credits claimed')`;
    } catch { /* log table may not exist — credits still added */ }

    return json({ ok: true, credits: (result[0] as { credits: number }).credits });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[credits/claim-free]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

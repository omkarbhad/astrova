import { getDb, json } from './_lib/db';
import { requireAuth, requireOwnership } from './_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId') ?? '';
      const key = url.searchParams.get('key') ?? '';
      if (!userId || !key) return json({ value: null });
      await requireOwnership(sql, auth, userId);

      const rows = await sql`
        SELECT setting_value FROM astrova_user_settings
        WHERE user_id = ${userId} AND setting_key = ${key} LIMIT 1`;
      if (!rows[0]) return json({ value: null });
      return json({ value: rows[0].setting_value });
    }

    if (req.method === 'POST') {
      const { userId, key, value } = await req.json() as { userId: string; key: string; value: unknown };
      await requireOwnership(sql, auth, userId);

      await sql`
        INSERT INTO astrova_user_settings (user_id, setting_key, setting_value, updated_at)
        VALUES (${userId}, ${key}, ${JSON.stringify(value)}::jsonb, now())
        ON CONFLICT(user_id, setting_key)
        DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[settings]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

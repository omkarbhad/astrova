import { getDb, json } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    // All admin config operations require admin role
    const adminCheck = await sql`SELECT role FROM astrova_users WHERE auth_id = ${auth.sub} LIMIT 1`;
    if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const all = url.searchParams.get('all');
      const key = url.searchParams.get('key');

      if (all) {
        const rows = await sql`SELECT config_key, config_value FROM astrova_admin_config`;
        const cfg: Record<string, unknown> = {};
        for (const row of rows) {
          cfg[row.config_key as string] = row.config_value;
        }
        return json(cfg);
      }

      if (key) {
        const rows = await sql`SELECT config_value FROM astrova_admin_config WHERE config_key = ${key} LIMIT 1`;
        if (!rows[0]) return json({ value: null });
        return json({ value: rows[0].config_value });
      }

      return json({});
    }

    if (req.method === 'POST') {
      const { key, value } = await req.json() as { key: string; value: unknown };
      await sql`
        INSERT INTO astrova_admin_config (config_key, config_value, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
        ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = excluded.updated_at`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[admin/config]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

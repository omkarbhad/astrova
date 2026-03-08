import { getDb, json, jsonError, parseBody } from '../_lib/db.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

const MAX_KEY_LEN = 100;
const MAX_VALUE_SIZE = 50_000;

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    // [FIX #39] Use reusable admin check
    await requireAdmin(sql, auth);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const all = url.searchParams.get('all');
      const key = url.searchParams.get('key');

      if (all) {
        const rows = await sql`SELECT config_key, config_value FROM admin_config`;
        const cfg: Record<string, unknown> = {};
        for (const row of rows) {
          cfg[row.config_key as string] = row.config_value;
        }
        return json(cfg);
      }

      if (key) {
        const rows = await sql`SELECT config_value FROM admin_config WHERE config_key = ${key} LIMIT 1`;
        if (!rows[0]) return json({ value: null });
        return json({ value: rows[0].config_value });
      }

      return json({});
    }

    if (req.method === 'POST') {
      // [FIX #21] Safe JSON parsing
      const { key, value } = await parseBody<{ key: string; value: unknown }>(req);

      // Validate key and value
      if (!key || typeof key !== 'string' || key.length > MAX_KEY_LEN) {
        return jsonError(`Config key must be a string (max ${MAX_KEY_LEN} chars)`);
      }
      const serialized = JSON.stringify(value);
      if (serialized.length > MAX_VALUE_SIZE) {
        return jsonError('Config value too large');
      }

      await sql`
        INSERT INTO admin_config (config_key, config_value, updated_at)
        VALUES (${key}, ${serialized}::jsonb, now())
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

import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth, requireOwnership } from './_lib/auth.js';

export const config = { runtime: 'edge' };

// [FIX #34] Allowed settings keys
const ALLOWED_SETTINGS_KEYS = [
  'theme', 'language', 'notifications', 'default_model',
  'birth_data', 'chart_preferences', 'ai_preferences',
] as const;
const MAX_KEY_LEN = 100;
// [FIX #35] Max value size (50KB serialized)
const MAX_VALUE_SIZE = 50_000;

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
        SELECT setting_value FROM user_settings
        WHERE user_id = ${userId} AND setting_key = ${key} LIMIT 1`;
      if (!rows[0]) return json({ value: null });
      return json({ value: rows[0].setting_value });
    }

    if (req.method === 'POST') {
      // [FIX #21] Safe JSON parsing
      const { userId, key, value } = await parseBody<{ userId: string; key: string; value: unknown }>(req);
      await requireOwnership(sql, auth, userId);

      // [FIX #34] Validate key
      if (!key || typeof key !== 'string' || key.length > MAX_KEY_LEN) {
        return jsonError(`Setting key must be a string (max ${MAX_KEY_LEN} chars)`);
      }
      // [FIX #35] Validate value size
      const serialized = JSON.stringify(value);
      if (serialized.length > MAX_VALUE_SIZE) {
        return jsonError('Setting value too large');
      }

      await sql`
        INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
        VALUES (${userId}, ${key}, ${serialized}::jsonb, now())
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

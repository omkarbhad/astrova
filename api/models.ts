import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth, requireAdmin } from './_lib/auth.js';

export const config = { runtime: 'edge' };

// [FIX #36] Max model ID/name length
const MAX_MODEL_ID = 200;
const MAX_MODEL_NAME = 200;

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const enabledOnly = url.searchParams.get('enabled');

      const rows = enabledOnly
        ? await sql`
            SELECT id, model_id, display_name, provider, is_enabled, sort_order
            FROM enabled_models WHERE is_enabled = true ORDER BY sort_order ASC`
        : await sql`
            SELECT id, model_id, display_name, provider, is_enabled, sort_order
            FROM enabled_models ORDER BY sort_order ASC`;

      return json(rows);
    }

    if (req.method === 'POST') {
      // [FIX #39] Use reusable admin check
      await requireAdmin(sql, auth);

      // [FIX #21] Safe JSON parsing
      const { modelId, modelName } = await parseBody<{ modelId: string; modelName: string }>(req);

      // [FIX #36] Validate model ID and name
      if (!modelId || typeof modelId !== 'string' || modelId.length > MAX_MODEL_ID) {
        return jsonError(`Model ID required (max ${MAX_MODEL_ID} chars)`);
      }
      if (!modelName || typeof modelName !== 'string' || modelName.length > MAX_MODEL_NAME) {
        return jsonError(`Model name required (max ${MAX_MODEL_NAME} chars)`);
      }

      const provider = modelId.includes('/') ? modelId.split('/')[0] : 'openrouter';

      await sql`
        INSERT INTO enabled_models (model_id, display_name, provider, is_enabled, sort_order)
        VALUES (${modelId}, ${modelName}, ${provider}, true, 99)
        ON CONFLICT(model_id) DO UPDATE
        SET display_name = excluded.display_name, provider = excluded.provider`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[models]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

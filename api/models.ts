import { getDb, json } from './_lib/db';
import { requireAuth } from './_lib/auth';

export const config = { runtime: 'edge' };

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
      // Only admins can add models
      const adminCheck = await sql`SELECT role FROM astrova_users WHERE auth_id = ${auth.sub} LIMIT 1`;
      if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
        return new Response('Forbidden', { status: 403 });
      }

      const { modelId, modelName } = await req.json() as { modelId: string; modelName: string };
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

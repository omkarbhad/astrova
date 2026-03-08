import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth, requireOwnership } from './_lib/auth.js';

export const config = { runtime: 'edge' };

const MAX_NAME_LEN = 200;

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId') ?? '';
      if (!userId) return json([]);
      await requireOwnership(sql, auth, userId);

      const rows = await sql`
        SELECT * FROM saved_charts
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`;
      return json(rows);
    }

    if (req.method === 'POST') {
      // [FIX #21] Safe JSON parsing
      const { userId, name, birth_data, kundali_data, location_name, coordinates } = await parseBody<{
        userId: string; name: string; birth_data: unknown;
        kundali_data?: unknown; location_name?: string; coordinates?: unknown;
      }>(req);
      await requireOwnership(sql, auth, userId);

      // [FIX #31] Validate name length
      if (!name || typeof name !== 'string' || name.length > MAX_NAME_LEN) {
        return jsonError(`Chart name required (max ${MAX_NAME_LEN} chars)`);
      }

      const inserted = await sql`
        INSERT INTO saved_charts
        (user_id, name, birth_data, kundali_data, location_name, coordinates)
        VALUES (
          ${userId},
          ${name},
          ${JSON.stringify(birth_data)}::jsonb,
          ${kundali_data ? JSON.stringify(kundali_data) : null}::jsonb,
          ${location_name ?? null},
          ${coordinates ? JSON.stringify(coordinates) : null}::jsonb
        )
        RETURNING *`;
      return json(inserted[0], 201);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[charts]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

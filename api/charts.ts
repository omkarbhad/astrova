import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

export const config = { runtime: 'edge' };

const MAX_NAME_LEN = 200;

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      // Always use the authenticated user's ID from astrova-db
      const rows = await sql`
        SELECT * FROM saved_charts
        WHERE user_id = ${auth.id}
        ORDER BY created_at DESC`;
      return json(rows);
    }

    if (req.method === 'POST') {
      // [FIX #21] Safe JSON parsing
      const { name, birth_data, kundali_data, location_name, coordinates } = await parseBody<{
        name: string; birth_data: unknown;
        kundali_data?: unknown; location_name?: string; coordinates?: unknown;
      }>(req);

      // [FIX #31] Validate name length
      if (!name || typeof name !== 'string' || name.length > MAX_NAME_LEN) {
        return jsonError(`Chart name required (max ${MAX_NAME_LEN} chars)`);
      }

      // Use auth.id (astrova-db user ID) instead of client-provided userId
      const inserted = await sql`
        INSERT INTO saved_charts
        (user_id, name, birth_data, kundali_data, location_name, coordinates)
        VALUES (
          ${auth.id},
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

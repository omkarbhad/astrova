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
      if (!userId) return json([]);
      await requireOwnership(sql, auth, userId);

      const rows = await sql`
        SELECT * FROM astrova_saved_charts
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`;
      return json(rows);
    }

    if (req.method === 'POST') {
      const { userId, name, birth_data, kundali_data, location_name, coordinates } = await req.json() as {
        userId: string; name: string; birth_data: unknown;
        kundali_data?: unknown; location_name?: string; coordinates?: unknown;
      };
      await requireOwnership(sql, auth, userId);

      const inserted = await sql`
        INSERT INTO astrova_saved_charts
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

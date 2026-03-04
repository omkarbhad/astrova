import { getDb, json } from '../_lib/db';
import { requireAuth, requireOwnership } from '../_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    // Verify the chart belongs to the authenticated user
    const chart = await sql`SELECT user_id FROM astrova_saved_charts WHERE id = ${id} LIMIT 1`;
    if (!chart[0]) return json({ error: 'Not found' }, 404);
    await requireOwnership(sql, auth, chart[0].user_id as string);

    if (req.method === 'PATCH') {
      const { name, kundali_data } = await req.json() as { name?: string; kundali_data?: unknown };

      if (name !== undefined && kundali_data !== undefined) {
        await sql`
          UPDATE astrova_saved_charts
          SET name = ${name}, kundali_data = ${JSON.stringify(kundali_data)}::jsonb, updated_at = now()
          WHERE id = ${id}`;
      } else if (name !== undefined) {
        await sql`
          UPDATE astrova_saved_charts SET name = ${name}, updated_at = now()
          WHERE id = ${id}`;
      } else if (kundali_data !== undefined) {
        await sql`
          UPDATE astrova_saved_charts SET kundali_data = ${JSON.stringify(kundali_data)}::jsonb, updated_at = now()
          WHERE id = ${id}`;
      } else {
        await sql`UPDATE astrova_saved_charts SET updated_at = now() WHERE id = ${id}`;
      }

      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM astrova_saved_charts WHERE id = ${id}`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[charts/[id]]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

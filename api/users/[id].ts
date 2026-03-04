import { getDb, json } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const payload = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM astrova_users WHERE id = ${id} LIMIT 1`;
      return json(rows[0] ?? null);
    }

    if (req.method === 'PATCH') {
      // Verify requester is admin
      const adminCheck = await sql`SELECT role FROM astrova_users WHERE auth_id = ${payload.sub} LIMIT 1`;
      if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
        return new Response('Forbidden', { status: 403 });
      }

      const body = await req.json() as Record<string, unknown>;
      const allowedFields = ['is_banned', 'role', 'credits'];
      const setClauses: string[] = [];
      const values: unknown[] = [];

      for (const field of allowedFields) {
        if (field in body) {
          setClauses.push(field);
          values.push(body[field]);
        }
      }
      if (setClauses.length === 0) return json({ ok: false }, 400);

      // Build dynamic update — neon tagged template can't do dynamic column names,
      // so we handle each allowed field explicitly
      if ('is_banned' in body && 'role' in body && 'credits' in body) {
        await sql`UPDATE astrova_users SET is_banned = ${body.is_banned}, role = ${body.role}, credits = ${body.credits}, updated_at = now() WHERE id = ${id}`;
      } else if ('is_banned' in body && 'role' in body) {
        await sql`UPDATE astrova_users SET is_banned = ${body.is_banned}, role = ${body.role}, updated_at = now() WHERE id = ${id}`;
      } else if ('is_banned' in body && 'credits' in body) {
        await sql`UPDATE astrova_users SET is_banned = ${body.is_banned}, credits = ${body.credits}, updated_at = now() WHERE id = ${id}`;
      } else if ('role' in body && 'credits' in body) {
        await sql`UPDATE astrova_users SET role = ${body.role}, credits = ${body.credits}, updated_at = now() WHERE id = ${id}`;
      } else if ('is_banned' in body) {
        await sql`UPDATE astrova_users SET is_banned = ${body.is_banned}, updated_at = now() WHERE id = ${id}`;
      } else if ('role' in body) {
        await sql`UPDATE astrova_users SET role = ${body.role}, updated_at = now() WHERE id = ${id}`;
      } else if ('credits' in body) {
        await sql`UPDATE astrova_users SET credits = ${body.credits}, updated_at = now() WHERE id = ${id}`;
      }

      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[users/[id]]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

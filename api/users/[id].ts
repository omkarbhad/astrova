import { getDb, json, jsonError, parseBody } from '../_lib/db.js';
import { requireAuth, requireAdmin, requireOwnership } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

const VALID_ROLES = ['user', 'admin'] as const;

export default async function handler(req: Request): Promise<Response> {
  try {
    const payload = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    if (req.method === 'GET') {
      await requireOwnership(sql, payload, id);
      const rows = await sql`SELECT * FROM astrova_users WHERE id = ${id} LIMIT 1`;
      return json(rows[0] ?? null);
    }

    if (req.method === 'PATCH') {
      await requireAdmin(sql, payload);

      const body = await parseBody<Record<string, unknown>>(req);

      const isBanned = 'is_banned' in body ? Boolean(body.is_banned) : undefined;
      const role = 'role' in body
        ? (VALID_ROLES.includes(body.role as typeof VALID_ROLES[number]) ? body.role as string : undefined)
        : undefined;
      const credits = 'credits' in body
        ? (typeof body.credits === 'number' && Number.isFinite(body.credits) && body.credits >= 0
            ? Math.floor(body.credits) : undefined)
        : undefined;

      if ('role' in body && role === undefined) return jsonError('Invalid role. Must be "user" or "admin"');
      if ('credits' in body && credits === undefined) return jsonError('Invalid credits. Must be a non-negative number');

      const hasUpdate = isBanned !== undefined || role !== undefined || credits !== undefined;
      if (!hasUpdate) return jsonError('No valid fields to update');

      if (isBanned !== undefined && role !== undefined && credits !== undefined) {
        await sql`UPDATE astrova_users SET is_banned = ${isBanned}, role = ${role}, credits = ${credits}, updated_at = now() WHERE id = ${id}`;
      } else if (isBanned !== undefined && role !== undefined) {
        await sql`UPDATE astrova_users SET is_banned = ${isBanned}, role = ${role}, updated_at = now() WHERE id = ${id}`;
      } else if (isBanned !== undefined && credits !== undefined) {
        await sql`UPDATE astrova_users SET is_banned = ${isBanned}, credits = ${credits}, updated_at = now() WHERE id = ${id}`;
      } else if (role !== undefined && credits !== undefined) {
        await sql`UPDATE astrova_users SET role = ${role}, credits = ${credits}, updated_at = now() WHERE id = ${id}`;
      } else if (isBanned !== undefined) {
        await sql`UPDATE astrova_users SET is_banned = ${isBanned}, updated_at = now() WHERE id = ${id}`;
      } else if (role !== undefined) {
        await sql`UPDATE astrova_users SET role = ${role}, updated_at = now() WHERE id = ${id}`;
      } else if (credits !== undefined) {
        await sql`UPDATE astrova_users SET credits = ${credits}, updated_at = now() WHERE id = ${id}`;
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

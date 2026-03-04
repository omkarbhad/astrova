export interface AuthPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function requireAuth(req: Request): Promise<AuthPayload> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) throw new Response('Unauthorized', { status: 401 });

  try {
    // Validate session with Neon Auth's get-session endpoint
    const authBaseUrl = process.env.NEON_AUTH_BASE_URL!;
    const res = await fetch(`${authBaseUrl}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Invalid session');

    const data = await res.json();
    if (!data?.user?.id) throw new Error('No user in session');

    return {
      sub: data.user.id,
      email: data.user.email,
      name: data.user.name,
      picture: data.user.image,
    };
  } catch {
    throw new Response('Unauthorized', { status: 401 });
  }
}

/**
 * Resolve the authenticated user's internal astrova_users.id from their auth_id,
 * then verify the requested userId matches (or the user is an admin).
 */
export async function requireOwnership(
  sql: import('./db').Sql,
  authPayload: AuthPayload,
  requestedUserId: string,
): Promise<void> {
  const rows = await sql`SELECT id, role FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const me = rows[0] as { id: string; role: string } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.id !== requestedUserId && me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type Sql = NeonQueryFunction<false, false>;

export function getDb(): Sql {
  return neon(process.env.DATABASE_URL!);
}

// [FIX #30] Consistent JSON response helper with proper headers
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// [FIX #30] Consistent error JSON response
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// [FIX #21] Safe JSON body parser — returns 400 on malformed JSON instead of 500
export async function parseBody<T>(req: Request): Promise<T> {
  // [FIX #50] Enforce max body size (1MB)
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    throw new Response(JSON.stringify({ error: 'Request body too large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    return await req.json() as T;
  } catch {
    throw new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

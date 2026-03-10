import { Pool } from '@neondatabase/serverless';

type SqlValue = string | number | boolean | null | unknown[] | Record<string, unknown>;
type SqlRow = Record<string, unknown>;
export type Sql = (strings: TemplateStringsArray, ...values: SqlValue[]) => Promise<SqlRow[]>;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('Missing DATABASE_URL environment variable.');
}

const pool = new Pool({ connectionString: dbUrl });

const JSON_COLUMNS = new Set([
  'messages',
  'birth_data',
  'kundali_data',
  'coordinates',
  'setting_value',
  'config_value',
  'tags',
]);

const BOOLEAN_COLUMNS = new Set([
  'is_banned',
  'is_active',
  'is_enabled',
]);

let initPromise: Promise<void> | null = null;

function mapValue(value: SqlValue): unknown {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || !['{', '['].includes(text[0] ?? '')) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function normalizeRow(row: SqlRow): SqlRow {
  const out: SqlRow = {};
  for (const [key, raw] of Object.entries(row)) {
    let value = raw;
    if (JSON_COLUMNS.has(key)) {
      value = parseMaybeJson(value);
      if (key === 'tags' && !Array.isArray(value)) value = [];
    }
    if (BOOLEAN_COLUMNS.has(key)) {
      if (value === false || value === 0) value = false;
      else if (value === true || value === 1) value = true;
    }
    out[key] = value;
  }
  return out;
}

function buildQuery(strings: TemplateStringsArray, values: SqlValue[]): { text: string; values: unknown[] } {
  let text = strings[0] ?? '';
  const args: unknown[] = [];

  for (let i = 0; i < values.length; i += 1) {
    args.push(mapValue(values[i]!));
    text += `$${i + 1}`;
    text += strings[i + 1] ?? '';
  }

  return { text, values: args };
}

async function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const client = await pool.connect();
    try {
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          firebase_uid TEXT UNIQUE,
          auth_id TEXT UNIQUE,
          email TEXT NOT NULL DEFAULT '',
          name TEXT,
          display_name TEXT,
          avatar_url TEXT,
          role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
          is_banned INTEGER NOT NULL DEFAULT 0,
          credits INTEGER NOT NULL DEFAULT 10,
          credits_used INTEGER NOT NULL DEFAULT 0,
          last_login_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS credit_transactions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL,
          action TEXT NOT NULL,
          admin_id TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC)',
        `CREATE TABLE IF NOT EXISTS knowledge_base (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          content TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS admin_config (
          config_key TEXT PRIMARY KEY,
          config_value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS user_settings (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          setting_key TEXT NOT NULL,
          setting_value TEXT,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, setting_key)
        )`,
        `CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT 'New Chat',
          messages TEXT NOT NULL DEFAULT '[]',
          model_used TEXT,
          session_type TEXT NOT NULL DEFAULT 'astrology' CHECK(session_type IN ('astrology', 'admin_article')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        'CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC)',
        `CREATE TABLE IF NOT EXISTS saved_charts (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          birth_data TEXT NOT NULL,
          kundali_data TEXT,
          location_name TEXT,
          coordinates TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        'CREATE INDEX IF NOT EXISTS idx_saved_charts_user ON saved_charts(user_id, created_at DESC)',
        `CREATE TABLE IF NOT EXISTS enabled_models (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          model_id TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          provider TEXT NOT NULL,
          is_enabled INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 99
        )`,
      ];

      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (e) {
          // Ignore "already exists" errors
          if (!String(e).includes('already exists')) {
            console.error('Schema init error:', e);
          }
        }
      }
    } finally {
      await client.release();
    }
  })();

  return initPromise;
}

export const sql: Sql = async (strings, ...values) => {
  await ensureSchema();
  const query = buildQuery(strings, values);
  const result = await pool.query(query.text, query.values);
  return result.rows.map((row) => normalizeRow(row));
};

export function getDb(): Sql {
  return sql;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function parseBody<T>(req: Request): Promise<T> {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    throw new Response(JSON.stringify({ error: 'Request body too large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    return (await req.json()) as T;
  } catch {
    throw new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/* DentalSpace — conexión a Postgres + migración automática (idempotente).
 *
 * Usa la variable de entorno que Vercel inyecta al conectar un storage de
 * Postgres al proyecto (p. ej. una integración de Neon vía Marketplace):
 * POSTGRES_URL. Se aceptan alias comunes por si la integración usa otro
 * nombre (DATABASE_URL, POSTGRES_URL_NON_POOLING).
 */
const { Pool } = require("pg");

const CONNECTION_STRING =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

function isConfigured() {
  return Boolean(CONNECTION_STRING);
}

let pool = null;
function getPool() {
  if (!pool) {
    if (!CONNECTION_STRING) {
      throw new Error("DB_NOT_CONFIGURED");
    }
    pool = new Pool({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

const SCHEMA_SQL = `
  create table if not exists appointments (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    nombre text not null,
    telefono text not null,
    ars text,
    servicio text not null,
    fecha date not null,
    horario text not null,
    comentario text,
    status text not null default 'pending'
  );

  create table if not exists schedule_overrides (
    fecha date primary key,
    closed boolean not null default true,
    nota text,
    open_time text,
    close_time text,
    updated_at timestamptz not null default now()
  );

  alter table appointments add column if not exists internal_note text not null default '';
  alter table appointments add column if not exists updated_at timestamptz not null default now();
  create index if not exists appointments_fecha_idx on appointments (fecha, created_at);
  create table if not exists appointment_activity (
    id bigint generated always as identity primary key,
    appointment_id uuid not null references appointments(id) on delete cascade,
    created_at timestamptz not null default now(),
    action text not null,
    detail text not null default ''
  );
  create index if not exists appointment_activity_cita_idx on appointment_activity (appointment_id, created_at);
  create table if not exists admin_login_attempts (
    ip text primary key,
    attempts integer not null default 0,
    window_start timestamptz not null default now()
  );
`;

// gen_random_uuid() vive en pgcrypto en versiones viejas de Postgres;
// en Postgres 13+/Neon suele estar disponible vía pgcrypto o nativamente
// (14+ trae gen_random_uuid() en core). Intentamos habilitar la extensión
// por si acaso; si no hay permiso, seguimos (probablemente ya exista).
const EXT_SQL = `create extension if not exists pgcrypto;`;

let migrated = null;
async function ensureSchema() {
  if (!migrated) {
    migrated = (async () => {
      const p = getPool();
      try {
        await p.query(EXT_SQL);
      } catch (_) {
        /* algunas plataformas no permiten crear extensiones; no es fatal */
      }
      await p.query(SCHEMA_SQL);
    })().catch((err) => {
      migrated = null;
      throw err;
    });
  }
  return migrated;
}

async function query(text, params) {
  await ensureSchema();
  return getPool().query(text, params);
}

async function transaction(fn) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction, isConfigured, ensureSchema };

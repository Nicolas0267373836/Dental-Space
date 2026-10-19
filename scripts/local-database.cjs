const { PGlite } = require("@electric-sql/pglite");
// Isolated embedded Postgres for tests/preview. Never connects to Neon.
async function localDatabase() {
  const database = new PGlite();
  await database.waitReady;
  let tail = Promise.resolve();
  async function lock() {
    const previous = tail;
    let release;
    tail = new Promise((r) => (release = r));
    await previous;
    return release;
  }
  async function execute(text, params) {
    if (!params && text.includes(";")) {
      await database.exec(text);
      return { rows: [], rowCount: 0 };
    }
    const r = await database.query(text, params);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  }
  require("pg").Pool = class {
    async query(text, params) {
      const release = await lock();
      try {
        return await execute(text, params);
      } finally {
        release();
      }
    }
    async connect() {
      const release = await lock();
      return { query: execute, release };
    }
  };
  process.env.DATABASE_URL = "postgres://local-preview-only";
  return database;
}
module.exports = { localDatabase };

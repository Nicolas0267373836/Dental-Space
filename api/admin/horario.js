/* GET /api/admin/horario — protegido. Lee los días cerrados / con horario
 *   especial registrados (sin límite de fecha, para que el panel pueda
 *   mostrar también los que ya pasaron si se necesita).
 * PUT  /api/admin/horario — protegido. Guarda varios días a la vez.
 *   Body: { overrides: [ { fecha, closed, nota, open_time, close_time }, ... ] }
 *   Si closed === false y no hay nota ni horario especial, se borra el
 *   override (el día vuelve al horario normal del sitio).
 */
const db = require("../_lib/db");
const { requireAuth } = require("../_lib/auth");
const { getJsonBody } = require("../_lib/http");

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  if (!db.isConfigured()) {
    if (req.method === "GET") return res.status(200).json({ ok: true, overrides: [], dbNotConfigured: true });
    return res.status(503).json({ ok: false, error: "Base de datos no conectada todavía." });
  }

  if (req.method === "GET") {
    try {
      const result = await db.query(
        `select to_char(fecha, 'YYYY-MM-DD') as fecha, closed, nota, open_time, close_time
         from schedule_overrides
         order by fecha asc`
      );
      return res.status(200).json({ ok: true, overrides: result.rows });
    } catch (err) {
      console.error("GET /api/admin/horario", err);
      return res.status(500).json({ ok: false, error: "No se pudo leer el horario." });
    }
  }

  if (req.method === "PUT") {
    const body = getJsonBody(req);
    const overrides = Array.isArray(body.overrides) ? body.overrides : [];
    if (!overrides.length) {
      return res.status(400).json({ ok: false, error: "No hay cambios para guardar." });
    }

    try {
      for (const o of overrides) {
        const fecha = String(o.fecha || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
        const closed = Boolean(o.closed);
        const nota = (o.nota || "").trim() || null;
        const openTime = (o.open_time || "").trim() || null;
        const closeTime = (o.close_time || "").trim() || null;

        if (!closed && !nota && !openTime && !closeTime) {
          await db.query(`delete from schedule_overrides where fecha = $1`, [fecha]);
        } else {
          await db.query(
            `insert into schedule_overrides (fecha, closed, nota, open_time, close_time, updated_at)
             values ($1,$2,$3,$4,$5, now())
             on conflict (fecha) do update set
               closed = excluded.closed, nota = excluded.nota,
               open_time = excluded.open_time, close_time = excluded.close_time,
               updated_at = now()`,
            [fecha, closed, nota, openTime, closeTime]
          );
        }
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("PUT /api/admin/horario", err);
      return res.status(500).json({ ok: false, error: "No se pudo guardar el horario." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Método no permitido" });
};

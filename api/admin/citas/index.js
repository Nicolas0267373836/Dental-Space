/* GET /api/admin/citas — protegido. Lista las solicitudes de cita.
 * Filtro opcional: ?status=pending|confirmed|rejected
 */
const db = require("../../_lib/db");
const { requireAuth } = require("../../_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }
  if (!requireAuth(req, res)) return;

  if (!db.isConfigured()) {
    return res.status(200).json({ ok: true, citas: [], dbNotConfigured: true });
  }

  const status = String(req.query && req.query.status || "").trim();
  const allowed = ["pending", "confirmed", "rejected"];

  try {
    let result;
    if (allowed.includes(status)) {
      result = await db.query(
        `select id, created_at, nombre, telefono, ars, servicio,
                to_char(fecha, 'YYYY-MM-DD') as fecha, horario, comentario, status
         from appointments
         where status = $1
         order by fecha asc, created_at desc`,
        [status]
      );
    } else {
      result = await db.query(
        `select id, created_at, nombre, telefono, ars, servicio,
                to_char(fecha, 'YYYY-MM-DD') as fecha, horario, comentario, status
         from appointments
         order by (status = 'pending') desc, fecha asc, created_at desc`
      );
    }
    return res.status(200).json({ ok: true, citas: result.rows });
  } catch (err) {
    console.error("GET /api/admin/citas", err);
    return res.status(500).json({ ok: false, error: "No se pudieron cargar las citas." });
  }
};

const db = require("../../_lib/db");
const { requireAuth } = require("../../_lib/auth");
const { getJsonBody } = require("../../_lib/http");
const { FIELDS, validateAppointment } = require("../../_lib/appointments");
const availability = require("../../../shared/availability");
module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (!db.isConfigured())
    return res
      .status(503)
      .json({ ok: false, error: "Base de datos no conectada." });
  try {
    if (req.method === "GET") {
      const result = await db.query(
        `select ${FIELDS} from appointments order by fecha desc, created_at desc limit 5001`,
      );
      return res
        .status(200)
        .json({
          ok: true,
          citas: result.rows.slice(0, 5000),
          truncated: result.rows.length > 5000,
        });
    }
    if (req.method === "POST") {
      const { value: a, error } = validateAppointment(getJsonBody(req));
      if (error) return res.status(400).json({ ok: false, error });
      const cita = await db.transaction(async (c) => {
        const closed = await c.query(
          "select closed from schedule_overrides where fecha = $1",
          [a.fecha],
        );
        if (availability.closedReason(a.fecha) || closed.rows[0]?.closed)
          throw Object.assign(new Error("La clínica no abre ese día."), {
            status: 409,
          });
        const r = await c.query(
          `insert into appointments (nombre, telefono, ars, servicio, fecha, horario, comentario)
          values ($1,$2,$3,$4,$5,$6,$7) returning ${FIELDS}`,
          [
            a.nombre,
            a.telefono,
            a.ars,
            a.servicio,
            a.fecha,
            a.horario,
            a.comentario,
          ],
        );
        await c.query(
          "insert into appointment_activity (appointment_id, action, detail) values ($1,'created','Registrada desde el panel')",
          [r.rows[0].id],
        );
        return r.rows[0];
      });
      return res.status(201).json({ ok: true, cita });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Método no permitido." });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({
        ok: false,
        error: err.status ? err.message : "No se pudieron procesar las citas.",
      });
  }
};

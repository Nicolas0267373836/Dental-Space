const db = require("./_lib/db");
const { getJsonBody } = require("./_lib/http");
const { validateAppointment } = require("./_lib/appointments");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido." });
  }
  const { value: a, error } = validateAppointment(getJsonBody(req));
  if (error) return res.status(400).json({ ok: false, error });
  if (!db.isConfigured())
    return res
      .status(503)
      .json({ ok: false, error: "Base de datos no conectada." });
  try {
    const id = await db.transaction(async (c) => {
      const closed = await c.query(
        "select closed from schedule_overrides where fecha = $1",
        [a.fecha],
      );
      if (closed.rows[0]?.closed)
        throw Object.assign(new Error("La clínica no abre ese día."), {
          status: 409,
        });
      const r = await c.query(
        `insert into appointments (nombre,telefono,ars,servicio,fecha,horario,comentario)
        values ($1,$2,$3,$4,$5,$6,$7) returning id`,
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
        "insert into appointment_activity (appointment_id,action,detail) values ($1,'created','Solicitud desde la web')",
        [r.rows[0].id],
      );
      return r.rows[0].id;
    });
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({
        ok: false,
        error: err.status ? err.message : "No se pudo guardar la solicitud.",
      });
  }
};

const db = require("../../_lib/db");
const { requireAuth } = require("../../_lib/auth");
const { getJsonBody } = require("../../_lib/http");
const {
  FIELDS,
  STATUSES,
  STATUS_LABELS,
  validDate,
  UUID,
  today,
} = require("../../_lib/appointments");
module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const id = req.query?.id;
  if (!UUID.test(id || ""))
    return res
      .status(400)
      .json({ ok: false, error: "Identificador inválido." });
  if (!db.isConfigured())
    return res
      .status(503)
      .json({ ok: false, error: "Base de datos no conectada." });
  try {
    if (req.method === "GET") {
      const r = await db.query(
        "select id, created_at, action, detail from appointment_activity where appointment_id = $1 order by created_at desc, id desc",
        [id],
      );
      return res.status(200).json({ ok: true, activity: r.rows });
    }
    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, PATCH");
      return res.status(405).json({ ok: false, error: "Método no permitido." });
    }
    const b = getJsonBody(req),
      sets = [],
      params = [id];
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status))
        return res.status(400).json({ ok: false, error: "Estado inválido." });
      params.push(b.status);
      sets.push("status = $" + params.length);
    }
    if (b.fecha !== undefined || b.horario !== undefined) {
      if (
        !validDate(b.fecha) ||
        b.fecha < today() ||
        typeof b.horario !== "string" ||
        !b.horario.trim() ||
        b.horario.length > 80
      )
        return res
          .status(400)
          .json({ ok: false, error: "Revisa la fecha y la franja horaria." });
      params.push(b.fecha);
      sets.push("fecha = $" + params.length);
      params.push(b.horario.trim());
      sets.push("horario = $" + params.length);
    }
    if (b.internal_note !== undefined) {
      if (typeof b.internal_note !== "string" || b.internal_note.length > 2000)
        return res
          .status(400)
          .json({ ok: false, error: "La nota admite hasta 2,000 caracteres." });
      params.push(b.internal_note.trim());
      sets.push("internal_note = $" + params.length);
    }
    if (!sets.length)
      return res.status(400).json({ ok: false, error: "No hay cambios." });
    const cita = await db.transaction(async (c) => {
      const old = await c.query(
        `select ${FIELDS} from appointments where id = $1 for update`,
        [id],
      );
      if (!old.rows.length)
        throw Object.assign(new Error("Cita no encontrada."), { status: 404 });
      const previous = old.rows[0];
      if (b.fecha !== undefined || b.status === "confirmed") {
        const closed = await c.query(
          "select closed from schedule_overrides where fecha = $1",
          [b.fecha || previous.fecha],
        );
        if (closed.rows[0]?.closed)
          throw Object.assign(new Error("La clínica no abre ese día."), {
            status: 409,
          });
      }
      const r = await c.query(
        `update appointments set ${sets.join(",")}, updated_at = now() where id = $1 returning ${FIELDS}`,
        params,
      );
      const changes = [];
      if (b.status !== undefined && previous.status !== b.status)
        changes.push(
          "Estado: " +
            (STATUS_LABELS[previous.status] || previous.status) +
            " → " +
            STATUS_LABELS[b.status],
        );
      if (
        b.fecha !== undefined &&
        (previous.fecha !== b.fecha || previous.horario !== b.horario.trim())
      )
        changes.push(
          "Reprogramada: " +
            previous.fecha +
            " · " +
            previous.horario +
            " → " +
            b.fecha +
            " · " +
            b.horario.trim(),
        );
      if (
        b.internal_note !== undefined &&
        previous.internal_note !== b.internal_note.trim()
      )
        changes.push("Nota interna actualizada");
      if (changes.length)
        await c.query(
          "insert into appointment_activity (appointment_id,action,detail) values ($1,'updated',$2)",
          [id, changes.join(" / ")],
        );
      return r.rows[0];
    });
    return res.status(200).json({ ok: true, cita });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({
        ok: false,
        error: err.status ? err.message : "No se pudo actualizar la cita.",
      });
  }
};

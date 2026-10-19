const db = require("../_lib/db");
const { requireAuth } = require("../_lib/auth");
const { getJsonBody } = require("../_lib/http");
const { validDate } = require("../_lib/appointments");
module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (!db.isConfigured())
    return res
      .status(503)
      .json({ ok: false, error: "Base de datos no conectada." });
  try {
    if (req.method === "GET") {
      const r = await db.query(
        "select to_char(fecha,'YYYY-MM-DD') as fecha,closed,nota,open_time,close_time from schedule_overrides order by fecha",
      );
      return res.status(200).json({ ok: true, overrides: r.rows });
    }
    if (req.method !== "PUT") {
      res.setHeader("Allow", "GET, PUT");
      return res.status(405).json({ ok: false, error: "Método no permitido." });
    }
    const list = getJsonBody(req).overrides;
    if (!Array.isArray(list) || !list.length || list.length > 90)
      return res
        .status(400)
        .json({ ok: false, error: "Selecciona entre 1 y 90 días." });
    const clean = [];
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const o of list) {
      if (
        !o ||
        !validDate(o.fecha) ||
        typeof o.closed !== "boolean" ||
        (o.nota != null && typeof o.nota !== "string") ||
        (o.nota || "").length > 80 ||
        (o.open_time != null && typeof o.open_time !== "string") ||
        (o.close_time != null && typeof o.close_time !== "string")
      )
        return res
          .status(400)
          .json({
            ok: false,
            error: "Revisa las fechas y las notas (máximo 80 caracteres).",
          });
      const open = o.closed ? "" : (o.open_time || "").trim(),
        close = o.closed ? "" : (o.close_time || "").trim();
      if (!o.closed && (open || close || o.nota) && require("../../shared/availability").closedReason(o.fecha))
        return res.status(400).json({ok:false, error:"Domingos y feriados: clínica cerrada. No se permite abrir esa fecha."});
      if (
        (open || close) &&
        (!time.test(open) || !time.test(close) || open >= close)
      )
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Indica apertura y cierre válidos; la apertura debe ser anterior al cierre.",
          });
      clean.push({
        fecha: o.fecha,
        closed: o.closed,
        nota: (o.nota || "").trim(),
        open,
        close,
      });
    }
    await db.transaction(async (c) => {
      for (const o of clean) {
        if (!o.closed && !o.nota && !o.open && !o.close)
          await c.query("delete from schedule_overrides where fecha=$1", [
            o.fecha,
          ]);
        else
          await c.query(
            `insert into schedule_overrides (fecha,closed,nota,open_time,close_time) values ($1,$2,$3,$4,$5)
          on conflict(fecha) do update set closed=excluded.closed,nota=excluded.nota,open_time=excluded.open_time,close_time=excluded.close_time,updated_at=now()`,
            [o.fecha, o.closed, o.nota, o.open || null, o.close || null],
          );
      }
    });
    return res.status(200).json({ ok: true });
  } catch (_) {
    return res
      .status(500)
      .json({ ok: false, error: "No se pudo procesar el horario." });
  }
};

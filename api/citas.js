/* POST /api/citas — público. Guarda la solicitud de cita (status: pending).
 * No reemplaza el envío por WhatsApp del formulario: es best-effort y
 * adicional. Si la base de datos aún no está conectada, responde 503 sin
 * romper nada en el sitio público (el frontend lo ignora silenciosamente).
 */
const db = require("./_lib/db");
const { getJsonBody } = require("./_lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  if (!db.isConfigured()) {
    return res.status(503).json({ ok: false, error: "Base de datos no conectada todavía." });
  }

  const body = getJsonBody(req);
  const nombre = String(body.nombre || "").trim();
  const telefono = String(body.telefono || "").trim();
  const servicio = String(body.servicio || "").trim();
  const fecha = String(body.fecha || "").trim(); // YYYY-MM-DD
  const horario = String(body.horario || "").trim();
  const ars = String(body.ars || "").trim() || null;
  const comentario = String(body.comentario || "").trim() || null;

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  if (!nombre || nombre.length < 3 || !telefono || !servicio || !fechaValida || !horario) {
    return res.status(400).json({ ok: false, error: "Faltan datos o tienen un formato inválido." });
  }

  try {
    const result = await db.query(
      `insert into appointments (nombre, telefono, ars, servicio, fecha, horario, comentario)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [nombre, telefono, ars, servicio, fecha, horario, comentario]
    );
    return res.status(200).json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("POST /api/citas", err);
    return res.status(500).json({ ok: false, error: "No se pudo guardar la solicitud." });
  }
};

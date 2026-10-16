/* PATCH /api/admin/citas/:id — protegido. Cambia el estado de una cita
 * (pending -> confirmed | rejected). Body: { status: "confirmed" | "rejected" }
 */
const db = require("../../_lib/db");
const { requireAuth } = require("../../_lib/auth");
const { getJsonBody } = require("../../_lib/http");

module.exports = async (req, res) => {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }
  if (!requireAuth(req, res)) return;

  if (!db.isConfigured()) {
    return res.status(503).json({ ok: false, error: "Base de datos no conectada todavía." });
  }

  const { id } = req.query;
  const { status } = getJsonBody(req);
  if (!["confirmed", "rejected"].includes(status)) {
    return res.status(400).json({ ok: false, error: "Estado inválido." });
  }

  try {
    const result = await db.query(
      `update appointments set status = $1 where id = $2 returning id`,
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Cita no encontrada." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/citas/[id]", err);
    return res.status(500).json({ ok: false, error: "No se pudo actualizar la cita." });
  }
};

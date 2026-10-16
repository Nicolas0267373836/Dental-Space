/* GET /api/disponibilidad — público. Devuelve los días cerrados u con
 * horario especial (schedule_overrides) desde hoy en adelante, para que el
 * formulario del sitio bloquee esas fechas y avise de cierres próximos.
 * Si la base de datos no está conectada, devuelve una lista vacía
 * (el calendario público no se bloquea por este motivo).
 */
const db = require("./_lib/db");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  if (!db.isConfigured()) {
    return res.status(200).json({ ok: true, overrides: [] });
  }

  try {
    const result = await db.query(
      `select to_char(fecha, 'YYYY-MM-DD') as fecha, closed, nota, open_time, close_time
       from schedule_overrides
       where fecha >= current_date
       order by fecha asc`
    );
    return res.status(200).json({ ok: true, overrides: result.rows });
  } catch (err) {
    console.error("GET /api/disponibilidad", err);
    // Fallamos "abierto": no bloqueamos el formulario público por un error del servidor.
    return res.status(200).json({ ok: true, overrides: [] });
  }
};

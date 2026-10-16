/* POST /api/admin/logout — cierra la sesión del panel. */
const { clearSessionCookie } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
};

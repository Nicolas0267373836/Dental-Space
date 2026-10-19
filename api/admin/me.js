/* GET /api/admin/me — para que el panel sepa si ya hay una sesión activa
 * al cargar la página (evita mostrar el login si la cookie sigue válida). */
const { isAuthenticated } = require("../_lib/auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  return res
    .status(200)
    .json({ ok: true, authenticated: isAuthenticated(req) });
};

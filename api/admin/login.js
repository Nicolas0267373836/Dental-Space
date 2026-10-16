/* POST /api/admin/login — verifica la contraseña y abre sesión (cookie). */
const { getJsonBody } = require("../_lib/http");
const { verifyPassword, createSessionToken, setSessionCookie } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !process.env.SESSION_SECRET) {
    console.error("ADMIN_PASSWORD_HASH o SESSION_SECRET no configurados");
    return res.status(500).json({ ok: false, error: "El panel no está configurado todavía." });
  }

  const { password } = getJsonBody(req);
  if (!verifyPassword(String(password || ""), hash)) {
    return res.status(401).json({ ok: false, error: "Contraseña incorrecta." });
  }

  const token = createSessionToken();
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true });
};

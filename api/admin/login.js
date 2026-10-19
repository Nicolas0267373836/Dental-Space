const db = require("../_lib/db");
const { getJsonBody } = require("../_lib/http");
const {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
} = require("../_lib/auth");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido." });
  }
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !process.env.SESSION_SECRET || !db.isConfigured())
    return res
      .status(503)
      .json({ ok: false, error: "El panel no está configurado todavía." });
  const pw = getJsonBody(req).password;
  if (typeof pw !== "string" || !pw || pw.length > 200)
    return res
      .status(400)
      .json({ ok: false, error: "Escribe una contraseña válida." });
  const ip = String(
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
  )
    .split(",")[0]
    .trim()
    .slice(0, 64);
  try {
    const r = await db.query(
      `insert into admin_login_attempts (ip,attempts) values ($1,1)
      on conflict(ip) do update set attempts=case when admin_login_attempts.window_start < now()-interval '15 minutes' then 1 else admin_login_attempts.attempts+1 end,
      window_start=case when admin_login_attempts.window_start < now()-interval '15 minutes' then now() else admin_login_attempts.window_start end returning attempts`,
      [ip],
    );
    if (r.rows[0].attempts > 6) {
      res.setHeader("Retry-After", "900");
      return res
        .status(429)
        .json({ ok: false, error: "Demasiados intentos. Espera 15 minutos." });
    }
    if (!verifyPassword(pw, hash))
      return res
        .status(401)
        .json({ ok: false, error: "Contraseña incorrecta." });
    await db.query("delete from admin_login_attempts where ip=$1", [ip]);
    await db.query(
      "delete from admin_login_attempts where window_start < now()-interval '1 day'",
    );
    setSessionCookie(res, createSessionToken());
    return res.status(200).json({ ok: true });
  } catch (_) {
    return res
      .status(503)
      .json({
        ok: false,
        error: "No se pudo iniciar sesión. Intenta de nuevo.",
      });
  }
};

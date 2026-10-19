/* DentalSpace — autenticación del panel admin (una sola administradora).
 *
 * - La contraseña se guarda SOLO como hash (scrypt, módulo nativo de Node,
 *   sin dependencias externas) en la variable de entorno ADMIN_PASSWORD_HASH.
 * - La sesión es una cookie httpOnly firmada con HMAC-SHA256 (SESSION_SECRET),
 *   sin estado en servidor, expira a las 8 horas.
 */
const crypto = require("crypto");

const COOKIE_NAME = "ds_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas

function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  const parts = String(storedHash).split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N: 16384,
      r: 8,
      p: 1,
    });
    return crypto.timingSafeEqual(derived, expected);
  } catch (_) {
    return false;
  }
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createSessionToken() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return false;
  const [payload, sig] = String(token).split(".");
  if (
    !payload ||
    !sig ||
    !/^[0-9a-f]{64}$/.test(sig) ||
    String(token).split(".").length !== 2
  )
    return false;
  const expected = sign(payload, secret);
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  )
    return false;
  try {
    const { exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return typeof exp === "number" && Date.now() < exp;
  } catch (_) {
    return false;
  }
}

function parseCookies(req) {
  if (req.cookies) return req.cookies; // @vercel/node ya los parsea
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch (_) {
      /* cookie inválida */
    }
  });
  return out;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV !== "development";
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

/** Devuelve true si está autenticado; si no, ya envió 401 y hay que `return`. */
function requireAuth(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "HEAD"].includes(req.method) && req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) {
        res.status(403).json({ ok: false, error: "Origen no permitido." });
        return false;
      }
    } catch (_) {
      res.status(403).json({ ok: false, error: "Origen no permitido." });
      return false;
    }
  }
  if (isAuthenticated(req)) return true;
  res
    .status(401)
    .json({ ok: false, error: "No autorizado. Inicia sesión de nuevo." });
  return false;
}

module.exports = {
  COOKIE_NAME,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  requireAuth,
};

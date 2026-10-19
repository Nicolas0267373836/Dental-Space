/* Utilidades mínimas compartidas por las funciones de /api. */

/** @vercel/node ya parsea JSON en req.body cuando Content-Type lo indica;
 * esto es un respaldo si llega como string o sin ese header. */
function getJsonBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "object")
    return req.body && !Array.isArray(req.body) ? req.body : {};
  try {
    const body = JSON.parse(req.body);
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch (_) {
    return {};
  }
}

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = { getJsonBody, sendJson };

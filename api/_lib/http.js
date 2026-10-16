/* Utilidades mínimas compartidas por las funciones de /api. */

/** @vercel/node ya parsea JSON en req.body cuando Content-Type lo indica;
 * esto es un respaldo si llega como string o sin ese header. */
function getJsonBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch (_) {
    return {};
  }
}

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = { getJsonBody, sendJson };

const http = require("node:http"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { localDatabase } = require("./local-database.cjs");
async function createPreview({ seed = true } = {}) {
  const database = await localDatabase();
  process.env.NODE_ENV = "development";
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  const salt = crypto.randomBytes(16);
  process.env.ADMIN_PASSWORD_HASH =
    "scrypt:" +
    salt.toString("hex") +
    ":" +
    crypto.scryptSync("DentalSpace-demo-2026", salt, 64).toString("hex");
  const db = require("../api/_lib/db");
  await db.ensureSchema();
  const M = require("../admin/model");
  if (seed) {
    const services = [
        "Evaluación",
        "Limpieza dental",
        "Ortodoncia",
        "Restauración",
      ],
      names = [
        "Contacto de prueba A",
        "Contacto de prueba B",
        "Contacto de prueba C",
        "Contacto de prueba D",
        "Contacto de prueba E",
        "Contacto de prueba F",
      ];
    for (let i = 0; i < 18; i++)
      await db.query(
        "insert into appointments (nombre,telefono,servicio,fecha,horario,status,ars,comentario) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          names[i % 6],
          "000000000" + (i % 6),
          services[i % 4],
          M.addDays(M.today(), (i % 10) - 2),
          i % 2 ? "3:00–6:00 p. m." : "9:00 a. m.–12:00 m.",
          [
            "pending",
            "confirmed",
            "completed",
            "pending",
            "cancelled",
            "no_show",
          ][i % 6],
          "Por confirmar",
          "Solicitud ficticia para revisión local.",
        ],
      );
    await db.query(
      "insert into schedule_overrides (fecha,closed,nota) values ($1,true,$2)",
      [M.addDays(M.today(), 5), "Cierre de prueba"],
    );
  }
  const routes = {
    "/api/citas": require("../api/citas"),
    "/api/disponibilidad": require("../api/disponibilidad"),
    "/api/admin/login": require("../api/admin/login"),
    "/api/admin/logout": require("../api/admin/logout"),
    "/api/admin/me": require("../api/admin/me"),
    "/api/admin/horario": require("../api/admin/horario"),
    "/api/admin/citas": require("../api/admin/citas/index"),
  };
  const root = path.resolve(__dirname, "..");
  const server = http.createServer(async (req, res) => {
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (data) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(data));
    };
    const u = new URL(req.url, "http://localhost");
    req.query = Object.fromEntries(u.searchParams);
    const match = u.pathname.match(/^\/api\/admin\/citas\/([^/]+)$/);
    if (match) req.query.id = match[1];
    if (u.pathname.startsWith("/api/")) {
      const handler = match
        ? require("../api/admin/citas/[id]")
        : routes[u.pathname];
      if (!handler) return res.status(404).json({ error: "No existe" });
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 24000)
          return res.status(413).json({ error: "Cuerpo demasiado grande" });
      }
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
      try {
        await handler(req, res);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error local" });
      }
      return;
    }
    let pathname = decodeURIComponent(u.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(root, "." + pathname);
    if (
      !file.startsWith(root + path.sep) ||
      pathname.startsWith("/api") ||
      pathname.includes("node_modules") ||
      pathname.includes("/.")
    )
      return res.status(404).end();
    try {
      const ext = path.extname(file);
      if (
        ![".html", ".css", ".js", ".jpg", ".png", ".webp", ".svg"].includes(ext)
      )
        return res.status(404).end();
      let data = await fs.readFile(file);
      if (pathname === "/admin/index.html")
        data = Buffer.from(
          data
            .toString()
            .replace(
              "<body>",
              '<body><div style="padding:8px 20px;background:#fff1d6;text-align:center;font:12px system-ui">Vista local · datos ficticios · sin conexión a producción</div>',
            ),
        );
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".svg": "image/svg+xml",
        }[ext] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.status(404).end();
    }
  });
  return { server, database, db };
}
if (require.main === module)
  createPreview().then(({ server }) =>
    server.listen(4381, "127.0.0.1", () =>
      console.log(
        "DentalSpace local: http://127.0.0.1:4381/admin/ — contraseña de datos ficticios: DentalSpace-demo-2026",
      ),
    ),
  );
module.exports = { createPreview };

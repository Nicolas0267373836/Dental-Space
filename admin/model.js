/* Shared, pure calculations: no patient data is persisted in the browser. */
(function (root) {
  const labels = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    rejected: "Rechazada",
    completed: "Atendida",
    cancelled: "Cancelada",
    no_show: "No asistió",
  };
  const phone = (v) =>
    String(v || "")
      .replace(/\D/g, "")
      .replace(/^(?=\d{10}$)/, "1");
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santo_Domingo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const addDays = (iso, n) => {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const date = (iso, options = { day: "numeric", month: "short" }) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString("es-DO", {
      ...options,
      timeZone: "America/Santo_Domingo",
    });
  const active = (c) => ["pending", "confirmed"].includes(c.status);
  function filter(rows, f = {}) {
    const q = (f.q || "").trim().toLocaleLowerCase("es");
    return rows.filter(
      (c) =>
        (!f.status || c.status === f.status) &&
        (!f.service || c.servicio === f.service) &&
        (!f.from || c.fecha >= f.from) &&
        (!f.to || c.fecha <= f.to) &&
        (!q ||
          [c.nombre, c.telefono, c.servicio, c.ars].some((v) =>
            String(v || "")
              .toLocaleLowerCase("es")
              .includes(q),
          )),
    );
  }
  function contacts(rows) {
    const map = new Map();
    rows.forEach((c) => {
      const key = phone(c.telefono) || c.id;
      if (!map.has(key))
        map.set(key, {
          key,
          nombre: c.nombre,
          telefono: c.telefono,
          citas: [],
        });
      map.get(key).citas.push(c);
    });
    return [...map.values()]
      .map((c) => {
        c.citas.sort((a, b) => b.fecha.localeCompare(a.fecha));
        const latest = [...c.citas].sort((a, b) =>
          String(b.created_at).localeCompare(String(a.created_at)),
        )[0];
        return { ...c, nombre: latest.nombre, telefono: latest.telefono };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  const metrics = (rows, day = today()) => ({
    pending: rows.filter((c) => c.status === "pending").length,
    today: rows.filter((c) => c.fecha === day && active(c)).length,
    upcoming: rows.filter(
      (c) => c.fecha >= day && c.fecha <= addDays(day, 6) && active(c),
    ).length,
    completed: rows.filter((c) => c.status === "completed").length,
    contacts: contacts(rows).length,
  });
  const csvCell = (v) =>
    '"' +
    (/^[=+\-@\t\r\n]/.test(String(v || "")) ? "'" : "") +
    String(v ?? "").replace(/"/g, '""') +
    '"';
  const csv = (rows) =>
    "\uFEFF" +
    [
      [
        "Fecha",
        "Franja horaria",
        "Nombre",
        "Teléfono",
        "Servicio",
        "Seguro",
        "Estado",
      ],
      ...rows.map((c) => [
        c.fecha,
        c.horario,
        c.nombre,
        c.telefono,
        c.servicio,
        c.ars,
        labels[c.status] || c.status,
      ]),
    ]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n");
  const api = {
    labels,
    phone,
    today,
    addDays,
    date,
    active,
    filter,
    contacts,
    metrics,
    csv,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.DentalModel = api;
})(typeof window !== "undefined" ? window : globalThis);

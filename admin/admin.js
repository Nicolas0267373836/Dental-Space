/* DentalSpace — workspace backed by the authenticated API. */
(() => {
  "use strict";
  const M = window.DentalModel,
    $ = (s, c = document) => c.querySelector(s),
    $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const S = {
    rows: [],
    overrides: [],
    page: "resumen",
    loaded: false,
    busy: false,
    session: false,
    q: "",
    status: "",
    service: "",
    from: "",
    to: "",
    n: 1,
    date: M.today(),
    mode: "day",
    month: M.today().slice(0, 7),
    reportFrom: M.today().slice(0, 7) + "-01",
    reportTo: M.today(),
    contactQ: "",
  };
  const titles = {
    resumen: "Resumen",
    agenda: "Agenda",
    solicitudes: "Solicitudes",
    contactos: "Contactos",
    disponibilidad: "Disponibilidad",
    reportes: "Reportes",
  };
  const badge = (c) =>
    `<span class="badge ${esc(c.status)}">${esc(M.labels[c.status] || c.status)}</span>`;
  const button = (label, action, cls = "secondary-button", attrs = "") =>
    `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
  const empty = (title, text) =>
    `<div class="empty"><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
  const heading = (title, sub, actions = "") =>
    `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div><div class="actions">${actions}</div></div>`;
  const metric = (label, n, sub) =>
    `<div class="metric"><span>${label}</span><strong>${n}</strong><small>${sub}</small></div>`;
  function toast(text) {
    $("#toast").textContent = text;
    $("#toast").hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => ($("#toast").hidden = true), 4500);
  }
  function error(text) {
    $("#globalError").textContent = text;
    $("#globalError").hidden = !text;
  }
  function loginView() {
    S.session = false;
    S.loaded = false;
    S.rows = [];
    S.overrides = [];
    $("#panelScreen").hidden = true;
    $("#loginScreen").hidden = false;
    $$("dialog[open]").forEach((d) => d.close());
  }
  async function api(path, o = {}) {
    const r = await fetch(path, {
      method: o.method || "GET",
      credentials: "same-origin",
      headers: o.body ? { "Content-Type": "application/json" } : {},
      body: o.body ? JSON.stringify(o.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && path !== "/api/admin/login") loginView();
      throw new Error(d.error || "No se pudo completar la operación.");
    }
    return d;
  }
  async function refresh(quiet = false) {
    if (S.busy || !S.session) return;
    S.busy = true;
    $("#refreshBtn").disabled = true;
    $("#syncLabel").textContent = "Actualizando…";
    error("");
    if (!S.loaded)
      $("#content").innerHTML =
        '<div class="loading" role="status">Cargando tu espacio de trabajo…</div>';
    try {
      const [a, b] = await Promise.all([
        api("/api/admin/citas"),
        api("/api/admin/horario"),
      ]);
      if (a.dbNotConfigured || b.dbNotConfigured)
        throw new Error("La base de datos no está conectada.");
      S.rows = a.citas || [];
      S.overrides = b.overrides || [];
      S.truncated = a.truncated;
      S.loaded = true;
      $("#syncLabel").textContent =
        "Actualizado " +
        new Date().toLocaleTimeString("es-DO", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Santo_Domingo",
        });
      render();
      if (!quiet) toast("Datos actualizados.");
    } catch (e) {
      error(e.message);
      $("#syncLabel").textContent = "Sin sincronizar";
      if (!S.loaded)
        $("#content").innerHTML = empty(
          "No pudimos cargar los datos",
          "Usa Actualizar para intentar de nuevo.",
        );
    } finally {
      S.busy = false;
      $("#refreshBtn").disabled = false;
    }
  }
  function nav(p) {
    S.page = titles[p] ? p : "resumen";
    location.hash = S.page;
    render();
  }
  function render() {
    if (!S.loaded) return;
    $$("[data-nav]").forEach((b) => {
      if (b.dataset.nav === S.page) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("#breadcrumb").textContent = "Clínica / " + titles[S.page];
    const n = S.rows.filter((c) => c.status === "pending").length;
    $("#pendingBadge").textContent = n;
    $("#pendingBadge").hidden = !n;
    $("#content").innerHTML =
      (S.truncated
        ? '<div class="notice warning">Se muestran las 5,000 solicitudes más recientes. Los conteos corresponden a ese conjunto.</div>'
        : "") +
      {
        resumen: summary,
        agenda,
        solicitudes: requests,
        contactos: contacts,
        disponibilidad: availability,
        reportes: reports,
      }[S.page]();
  }
  function row(c) {
    return `<div class="summary-row"><span class="initials" aria-hidden="true">${esc(
      c.nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((x) => x[0])
        .join("")
        .toUpperCase(),
    )}</span><div><button class="name-button" data-open="${esc(c.id)}">${esc(c.nombre)}</button><p>${esc(M.date(c.fecha))} · ${esc(c.horario)}<br>${esc(c.servicio)}</p></div>${badge(c)}${button("Ver →", "detail", "text-button", `data-id="${esc(c.id)}"`)}</div>`;
  }
  function summary() {
    const day = M.today(),
      m = M.metrics(S.rows),
      pending = S.rows
        .filter((c) => c.status === "pending")
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      next = S.rows
        .filter((c) => M.active(c) && c.fecha >= day)
        .sort(
          (a, b) =>
            a.fecha.localeCompare(b.fecha) ||
            a.horario.localeCompare(b.horario),
        ),
      old = pending.filter((c) => c.fecha < day).length,
      closures = S.overrides.filter(
        (o) => o.closed && o.fecha >= day && o.fecha <= M.addDays(day, 14),
      );
    return (
      heading(
        "Cada cita, en su lugar.",
        esc(
          M.date(day, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        ) + " · Hora de República Dominicana",
        button("+ Nueva solicitud", "new", "primary"),
      ) +
      `<div class="metrics">${metric("Por confirmar", m.pending, "Solicitudes pendientes")}${metric("Agenda de hoy", m.today, "Pendientes y confirmadas")}${metric("Próximos 7 días", m.upcoming, "Citas activas")}${metric("Contactos", m.contacts, "Con solicitudes registradas")}</div>` +
      (old
        ? `<div class="notice warning"><div><strong>${old} ${old === 1 ? "solicitud pendiente de una fecha pasada" : "solicitudes pendientes de fechas pasadas"}</strong><p>Revisa si se atendieron o deben reprogramarse.</p></div>${button("Revisar", "overdue", "text-button")}</div>`
        : "") +
      `<div class="grid-two"><section class="section"><div class="section-head"><div><h2>Próximas citas</h2><p>Solicitudes activas, ordenadas por fecha</p></div>${button("Ver agenda →", "go-agenda", "text-button")}</div><div class="row-list">${next.length ? next.slice(0, 5).map(row).join("") : empty("La agenda está despejada", "Las nuevas solicitudes aparecerán aquí.")}</div></section><div><section class="section"><div class="section-head"><h2>Necesitan respuesta</h2>${button("Ver todas", "go-requests", "text-button")}</div><div class="row-list">${pending.length ? pending.slice(0, 3).map(row).join("") : empty("Todo al día", "No hay solicitudes pendientes.")}</div></section><section class="section"><div class="section-head"><h2>Próximos cierres</h2>${button("Gestionar", "go-availability", "text-button")}</div><div class="section-body">${closures.length ? closures.map((o) => `<p style="margin-bottom:12px"><strong>${esc(M.date(o.fecha))}</strong><br><small>${esc(o.nota || "Clínica cerrada")}</small></p>`).join("") : '<p class="muted">Sin cierres programados en los próximos 14 días.</p>'}</div></section></div></div>`
    );
  }
  function table(rows) {
    const count = rows.length,
      pages = Math.max(1, Math.ceil(count / 12));
    S.n = Math.min(S.n, pages);
    const visible = rows.slice((S.n - 1) * 12, S.n * 12);
    return `<div class="table-wrap cards-mobile"><table class="data-table"><thead><tr><th>Contacto</th><th>Fecha y franja</th><th>Servicio</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>${visible.map((c) => `<tr><td><button class="name-button" data-open="${esc(c.id)}">${esc(c.nombre)}</button><small>${esc(c.telefono)}</small></td><td data-label="Fecha y franja">${esc(M.date(c.fecha, { day: "numeric", month: "short", year: "numeric" }))}<small>${esc(c.horario)}</small></td><td data-label="Servicio">${esc(c.servicio)}<small>${esc(c.ars || "Sin seguro indicado")}</small></td><td data-label="Estado">${badge(c)}</td><td>${button("Abrir →", "detail", "text-button", `data-id="${esc(c.id)}"`)}</td></tr>`).join("")}</tbody></table>${count ? "" : empty("No hay solicitudes en esta vista", "Prueba con otro estado, búsqueda o rango de fechas.")}</div><div class="table-footer"><span>${count} ${count === 1 ? "solicitud" : "solicitudes"}</span>${count ? `<div class="pagination">${button("←", "prev", "", S.n <= 1 ? 'disabled aria-label="Página anterior"' : 'aria-label="Página anterior"')}<span>${S.n} / ${pages}</span>${button("→", "next", "", S.n >= pages ? 'disabled aria-label="Página siguiente"' : 'aria-label="Página siguiente"')}</div>` : ""}</div>`;
  }
  const filtered = () =>
    M.filter(S.rows, {
      q: S.q,
      status: S.status,
      service: S.service,
      from: S.from,
      to: S.to,
    }).sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) || a.horario.localeCompare(b.horario),
    );
  function requests() {
    const services = [...new Set(S.rows.map((c) => c.servicio))].sort();
    return (
      heading(
        "Solicitudes",
        "De la primera solicitud al cierre de la atención.",
        button("Exportar vista", "export") +
          button("+ Nueva solicitud", "new", "primary"),
      ) +
      `<div class="filter-chips">${[["", "Todas"], ...Object.entries(M.labels)].map(([v, l]) => `<button class="chip" data-status="${v}" aria-pressed="${S.status === v}">${l}</button>`).join("")}</div><div class="toolbar"><div class="field grow"><label for="requestSearch">Buscar solicitudes</label><input id="requestSearch" data-filter="q" value="${esc(S.q)}" placeholder="Nombre, teléfono o servicio" type="search"></div><div class="field"><label for="serviceFilter">Servicio</label><select id="serviceFilter" data-filter="service"><option value="">Todos los servicios</option>${services.map((v) => `<option ${v === S.service ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div><div class="field"><label for="filterFrom">Desde</label><input id="filterFrom" type="date" data-filter="from" value="${S.from}"></div><div class="field"><label for="filterTo">Hasta</label><input id="filterTo" type="date" data-filter="to" value="${S.to}"></div>${button("Limpiar", "clear", "text-button")}</div><div id="requestResults">${table(filtered())}</div>`
    );
  }
  function agenda() {
    const day = S.date,
      start = M.addDays(
        day,
        -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7),
      ),
      selected = S.rows
        .filter((c) => c.fecha === day && M.active(c))
        .sort((a, b) => a.horario.localeCompare(b.horario)),
      override = S.overrides.find((o) => o.fecha === day);
    return (
      heading(
        "Agenda",
        "Las franjas son preferencias de horario, no turnos exclusivos.",
        button("+ Nueva solicitud", "new", "primary"),
      ) +
      `<div class="agenda-control">${button("←", "agenda-prev", "icon-button", 'aria-label="Periodo anterior"')}${button("Hoy", "agenda-today")}${button("→", "agenda-next", "icon-button", 'aria-label="Periodo siguiente"')}<div class="field"><label for="agendaDate">Fecha</label><input type="date" id="agendaDate" value="${day}"></div><div class="segment"><button data-mode="day" aria-pressed="${S.mode === "day"}">Día</button><button data-mode="week" aria-pressed="${S.mode === "week"}">Semana</button></div></div>` +
      (S.mode === "day"
        ? `${override?.closed ? `<div class="notice warning"><div><strong>La clínica está cerrada este día</strong><p>${esc(override.nota || "Revisa las citas existentes antes de reprogramar.")}</p></div></div>` : ""}<section class="section"><div class="section-head"><h2>${esc(M.date(day, { weekday: "long", day: "numeric", month: "long" }))}</h2><span class="muted">${selected.length} activas</span></div><div class="row-list">${selected.length ? selected.map(row).join("") : empty("No hay citas activas", "Puedes registrar una solicitud o elegir otra fecha.")}</div></section>`
        : `<div class="week-grid">${Array.from({ length: 7 }, (_, i) => {
            const iso = M.addDays(start, i),
              closed = S.overrides.find((o) => o.fecha === iso && o.closed),
              rows = S.rows.filter((c) => c.fecha === iso && M.active(c));
            return `<section class="week-day ${iso === M.today() ? "is-today" : ""}"><button class="week-title" data-day="${iso}">${esc(M.date(iso, { weekday: "short" }))}<strong>${new Date(iso + "T12:00:00Z").getUTCDate()}</strong></button>${closed ? '<span class="badge rejected">Cerrado</span>' : ""}${rows.length ? rows.map((c) => `<button class="agenda-card" data-open="${esc(c.id)}"><small>${esc(c.horario)}</small><strong>${esc(c.nombre)}</strong><small>${esc(c.servicio)}</small>${badge(c)}</button>`).join("") : "<small>Sin citas activas</small>"}</section>`;
          }).join("")}</div>`)
    );
  }
  function contactTable(list) {
    return `<div class="table-wrap cards-mobile"><table class="data-table"><thead><tr><th>Contacto</th><th>Solicitudes</th><th>Última fecha registrada</th><th>Seguimiento</th></tr></thead><tbody>${list.map((c) => `<tr><td><button class="name-button" data-contact="${esc(c.key)}">${esc(c.nombre)}</button><small>${esc(c.telefono)}</small></td><td data-label="Solicitudes">${c.citas.length}</td><td data-label="Última fecha registrada">${esc(M.date(c.citas[0].fecha))}</td><td>${button("Ver historial →", "contact", "text-button", `data-key="${esc(c.key)}"`)}</td></tr>`).join("")}</tbody></table>${list.length ? "" : empty("Todavía no hay contactos", "Se agrupan automáticamente a partir de las solicitudes recibidas.")}</div>`;
  }
  function contacts() {
    const q = S.contactQ.toLowerCase(),
      list = M.contacts(S.rows).filter((c) =>
        [c.nombre, c.telefono].some((v) => v.toLowerCase().includes(q)),
      );
    return (
      heading(
        "Contactos",
        "Historial de solicitudes agrupado por teléfono. No es un expediente clínico.",
      ) +
      `<div class="toolbar"><div class="field grow"><label for="contactSearch">Buscar contacto</label><input id="contactSearch" type="search" value="${esc(S.contactQ)}" placeholder="Nombre o teléfono"></div><span class="muted">${list.length} contactos</span></div><div id="contactResults">${contactTable(list)}</div>`
    );
  }
  function availability() {
    const month = S.month + "-01",
      d = new Date(month + "T12:00:00Z"),
      offset = (d.getUTCDay() + 6) % 7,
      last = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      ).getUTCDate(),
      future = S.overrides
        .filter((o) => o.fecha >= M.today())
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return (
      heading(
        "Disponibilidad",
        "Lun–vie 9:00–18:00 · Sáb 9:00–14:00. Domingos y feriados: cerrado.",
        button("+ Excepción de horario", "schedule-new", "primary"),
      ) +
      `<div class="calendar-layout"><section class="section calendar"><div class="calendar-head">${button("←", "month-prev", "icon-button", 'aria-label="Mes anterior"')}<strong>${esc(M.date(month, { month: "long", year: "numeric" }))}</strong>${button("→", "month-next", "icon-button", 'aria-label="Mes siguiente"')}</div><div class="calendar-grid">${["L", "M", "X", "J", "V", "S", "D"].map((x) => `<span class="weekday">${x}</span>`).join("")}${"<span></span>".repeat(offset)}${Array.from(
        { length: last },
        (_, i) => {
          const iso = S.month + "-" + String(i + 1).padStart(2, "0"),
            o = DentalAvailability.closedReason(iso) ? {closed:true, nota:DentalAvailability.closedReason(iso)} : S.overrides.find((x) => x.fecha === iso);
          return `<button class="calendar-day ${iso === M.today() ? "is-today" : ""} ${o ? (o.closed ? "is-closed" : "is-special") : ""}" data-schedule="${iso}" aria-label="${esc(M.date(iso, { day: "numeric", month: "long" }))}${o?.closed ? ", cerrado" : o ? ", horario especial" : ""}">${i + 1}${o ? `<small>${o.closed ? "CERRADO" : "ESPECIAL"}</small>` : ""}</button>`;
        },
      ).join(
        "",
      )}</div><div class="legend"><span><i></i>Cerrado</span><span><i class="special"></i>Excepción</span><span>Toca una fecha para editar</span></div></section><section class="section"><div class="section-head"><div><h2>Próximas excepciones</h2><p>Los cierres bloquean nuevas solicitudes</p></div></div><div class="row-list">${future.length ? future.map((o) => `<div class="summary-row"><div><strong>${esc(M.date(o.fecha, { day: "numeric", month: "short", year: "numeric" }))}</strong><p>${esc(o.nota || (o.closed ? "Clínica cerrada" : "Horario especial"))}${!o.closed && o.open_time ? "<br>" + esc(o.open_time) + "–" + esc(o.close_time) : ""}</p></div><span class="badge ${o.closed ? "rejected" : "pending"}">${o.closed ? "Cerrado" : "Especial"}</span><button class="text-button" data-schedule="${o.fecha}">Editar</button></div>`).join("") : empty("Sin excepciones programadas", "El calendario público mantiene su horario habitual.")}</div></section></div>`
    );
  }
  function reports() {
    const rows = M.filter(S.rows, { from: S.reportFrom, to: S.reportTo }),
      m = M.metrics(rows),
      counts = {};
    rows.forEach((c) => (counts[c.servicio] = (counts[c.servicio] || 0) + 1));
    return (
      heading(
        "Reportes",
        "Solicitudes registradas, agrupadas por fecha de cita. Sin estimaciones de ingresos.",
        button("Exportar periodo", "export-report"),
      ) +
      `<div class="toolbar" style="border-radius:7px;margin-bottom:24px"><div class="field"><label for="reportFrom">Desde</label><input id="reportFrom" type="date" value="${S.reportFrom}"></div><div class="field"><label for="reportTo">Hasta</label><input id="reportTo" type="date" value="${S.reportTo}"></div></div><div class="metrics">${metric("Solicitudes", rows.length, "En el periodo seleccionado")}${metric("Contactos", m.contacts, "Teléfonos distintos")}${metric("Atendidas", m.completed, "Marcadas como atendidas")}${metric("No asistieron", rows.filter((c) => c.status === "no_show").length, "Registradas por la clínica")}</div><div class="grid-two"><section class="section"><div class="section-head"><h2>Servicios solicitados</h2><span class="muted">${rows.length} solicitudes</span></div><div class="bars">${
        rows.length
          ? Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(
                ([name, n]) =>
                  `<div class="bar-item"><div class="bar-label"><span>${esc(name)}</span><strong>${n}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / rows.length) * 100)}%"></div></div></div>`,
              )
              .join("")
          : empty("Sin datos en este periodo", "Elige otro rango de fechas.")
      }</div></section><section class="section"><div class="section-head"><h2>Distribución por estado</h2></div><div class="report-states">${Object.entries(
        M.labels,
      )
        .map(
          ([status, label]) =>
            `<div><span class="badge ${status}">${label}</span><strong>${rows.filter((c) => c.status === status).length}</strong></div>`,
        )
        .join("")}</div></section></div>`
    );
  }
  const closeButton = () =>
    '<button type="button" class="icon-button" data-close aria-label="Cerrar ventana">×</button>';
  function open(id, html) {
    $(id === "#detailDialog" ? "#detailContent" : "#editContent").innerHTML =
      html;
    if (!$(id).open) $(id).showModal();
  }
  function formError(form, text) {
    let box = $(".form-error", form);
    if (!box) {
      box = document.createElement("p");
      box.className = "form-error";
      box.setAttribute("role", "alert");
      form.append(box);
    }
    box.textContent = text;
    box.hidden = false;
  }
  async function detail(id) {
    const c = S.rows.find((x) => x.id === id);
    if (!c) return;
    open(
      "#detailDialog",
      `<div class="dialog-head"><div><small>DETALLE DE SOLICITUD</small><h2 id="detailTitle">${esc(c.nombre)}</h2><p>${esc(c.servicio)}</p></div>${closeButton()}</div><div class="dialog-body">${badge(c)}<dl class="detail-grid" style="margin-top:24px"><div><dt>Fecha solicitada</dt><dd>${esc(M.date(c.fecha, { day: "numeric", month: "long", year: "numeric" }))}</dd></div><div><dt>Franja preferida</dt><dd>${esc(c.horario)}</dd></div><div><dt>Teléfono</dt><dd>${esc(c.telefono)}</dd></div><div><dt>Seguro</dt><dd>${esc(c.ars || "No indicado")}</dd></div></dl>${c.comentario ? '<h3>Comentario de la solicitud</h3><div class="note">' + esc(c.comentario) + "</div>" : ""}<div class="actions"><a class="secondary-button" href="https://wa.me/${esc(M.phone(c.telefono))}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp ↗</a>${button("Reprogramar", "reschedule", "secondary-button", `data-id="${id}"`)}</div><form id="updateForm" data-id="${id}" style="margin-top:25px"><div class="field"><label for="appointmentStatus">Estado de la solicitud</label><select id="appointmentStatus" name="status">${Object.entries(
        M.labels,
      )
        .map(
          ([v, l]) =>
            `<option value="${v}" ${v === c.status ? "selected" : ""}>${l}</option>`,
        )
        .join(
          "",
        )}</select></div><div class="field" style="margin-top:18px"><label for="internalNote">Nota interna · solo administración</label><textarea id="internalNote" name="internal_note" maxlength="2000" placeholder="Seguimiento administrativo. Evita registrar información clínica sensible.">${esc(c.internal_note || "")}</textarea></div><button class="primary" style="margin-top:15px">Guardar cambios</button></form><section style="margin-top:30px"><h3>Historial de cambios</h3><div id="activityList" class="muted" style="margin-top:12px">Cargando historial…</div></section></div>`,
    );
    try {
      const d = await api("/api/admin/citas/" + id);
      if ($("#updateForm")?.dataset.id !== id) return;
      $("#activityList").innerHTML = d.activity.length
        ? '<ol class="activity">' +
          d.activity
            .map(
              (a) =>
                `<li>${esc(a.detail)}<small>${esc(new Date(a.created_at).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" }))}</small></li>`,
            )
            .join("") +
          "</ol>"
        : "Sin cambios registrados. Las solicitudes anteriores a esta versión no tienen historial previo.";
    } catch (e) {
      if ($("#activityList")) $("#activityList").textContent = e.message;
    }
  }
  function contactDetail(key) {
    const c = M.contacts(S.rows).find((x) => x.key === key);
    if (c)
      open(
        "#detailDialog",
        `<div class="dialog-head"><div><small>HISTORIAL DE SOLICITUDES</small><h2 id="detailTitle">${esc(c.nombre)}</h2><p>${esc(c.telefono)} · ${c.citas.length} solicitudes</p></div>${closeButton()}</div><div class="dialog-body"><p class="muted">Agrupado por teléfono; un número compartido puede corresponder a varias personas.</p><div class="row-list">${c.citas.map(row).join("")}</div></div>`,
      );
  }
  function newAppointment() {
    open(
      "#editDialog",
      `<form id="newForm"><div class="dialog-head"><div><small>REGISTRO ADMINISTRATIVO</small><h2 id="editTitle">Nueva solicitud</h2><p>Recibida por teléfono o en la clínica.</p></div>${closeButton()}</div><div class="dialog-body form-grid"><div class="field wide"><label for="newName">Nombre</label><input id="newName" name="nombre" required minlength="3" maxlength="80" autocomplete="off"></div><div class="field"><label for="newPhone">Teléfono</label><input id="newPhone" name="telefono" type="tel" required maxlength="30"></div><div class="field"><label for="newInsurance">Seguro (opcional)</label><input id="newInsurance" name="ars" maxlength="100"></div><div class="field wide"><label for="newService">Servicio solicitado</label><input id="newService" name="servicio" required maxlength="120" list="knownServices"><datalist id="knownServices">${[...new Set(S.rows.map((c) => c.servicio))].map((s) => '<option value="' + esc(s) + '"></option>').join("")}</datalist></div><div class="field"><label for="newDate">Fecha</label><input id="newDate" name="fecha" type="date" min="${M.today()}" value="${S.date < M.today() ? M.today() : S.date}" required></div><div class="field"><label for="newTime">Franja u hora preferida</label><input id="newTime" name="horario" placeholder="Ej.: 10:00 a. m." required maxlength="80"></div><div class="field wide"><label for="newComment">Comentario (opcional)</label><textarea id="newComment" name="comentario" maxlength="500"></textarea></div></div><div class="dialog-foot">${button("Cancelar", "close")}<button class="primary">Registrar solicitud</button></div></form>`,
    );
  }
  function reschedule(id) {
    const c = S.rows.find((x) => x.id === id);
    if (!c) return;
    $("#detailDialog").close();
    open(
      "#editDialog",
      `<form id="rescheduleForm" data-id="${id}"><div class="dialog-head"><div><h2 id="editTitle">Reprogramar solicitud</h2><p>${esc(c.nombre)} · ${esc(c.servicio)}</p></div>${closeButton()}</div><div class="dialog-body form-grid"><div class="field"><label for="changeDate">Nueva fecha</label><input id="changeDate" name="fecha" type="date" min="${M.today()}" value="${c.fecha < M.today() ? M.today() : c.fecha}" required></div><div class="field"><label for="changeTime">Franja u hora preferida</label><input id="changeTime" name="horario" value="${esc(c.horario)}" maxlength="80" required></div><p class="muted wide">El cambio se guardará en el historial. Comunica la nueva fecha al contacto; no se envía un mensaje automáticamente.</p></div><div class="dialog-foot">${button("Cancelar", "close")}<button class="primary">Guardar reprogramación</button></div></form>`,
    );
  }
  function schedule(iso = M.today()) {
    const o = S.overrides.find((x) => x.fecha === iso) || {
        fecha: iso,
        closed: true,
      },
      affected = S.rows.filter((c) => c.fecha === iso && M.active(c)).length;
    open(
      "#editDialog",
      `<form id="scheduleForm"><div class="dialog-head"><div><h2 id="editTitle">Excepción de horario</h2><p>Este ajuste se refleja en la web. Domingos y feriados: cerrado.</p></div>${closeButton()}</div><div class="dialog-body form-grid"><div class="field"><label for="scheduleDate">Fecha</label><input id="scheduleDate" type="date" name="fecha" value="${iso}" required></div><div class="field"><label for="scheduleMode">Disponibilidad</label><select id="scheduleMode" name="mode"><option value="closed" ${o.closed ? "selected" : ""}>Clínica cerrada</option><option value="special" ${!o.closed ? "selected" : ""}>Horario especial / nota</option></select></div><div class="field wide"><label for="scheduleNote">Nota pública (máximo 80 caracteres)</label><input id="scheduleNote" name="nota" maxlength="80" value="${esc(o.nota || "")}" placeholder="Ej.: Feriado"></div><div class="field"><label for="scheduleOpen">Apertura especial</label><input id="scheduleOpen" name="open_time" type="time" value="${esc(o.open_time || "")}" ${o.closed ? "disabled" : ""}></div><div class="field"><label for="scheduleClose">Cierre especial</label><input id="scheduleClose" name="close_time" type="time" value="${esc(o.close_time || "")}" ${o.closed ? "disabled" : ""}></div><p class="muted wide">Cerrar un día bloquea nuevas solicitudes; no cancela las existentes. ${affected ? `Hay ${affected} solicitudes activas en esta fecha.` : ""}</p></div><div class="dialog-foot">${button("Restablecer horario habitual", "schedule-reset", "text-button")}<button class="primary">Guardar excepción</button></div></form>`,
    );
    lockClosedDate();
  }
  function lockClosedDate() {
    const reason = DentalAvailability.closedReason($("#scheduleDate").value);
    const mode = $("#scheduleMode");
    $("option[value=special]", mode).disabled = Boolean(reason);
    if (reason) mode.value = "closed";
    $("#scheduleOpen").disabled = $("#scheduleClose").disabled = mode.value === "closed";
  }
  function exportDialog(rows) {
    if (!rows.length) {
      toast("No hay solicitudes para exportar.");
      return;
    }
    open(
      "#editDialog",
      `<form id="exportForm"><div class="dialog-head"><div><h2 id="editTitle">Exportar solicitudes</h2><p>${rows.length} solicitudes en la vista seleccionada</p></div>${closeButton()}</div><div class="dialog-body"><p>El CSV incluye nombres, teléfonos, servicio, seguro, fecha y estado. Descárgalo en un equipo de confianza y compártelo solo con personal autorizado.</p><p class="muted" style="margin-top:14px">No incluye comentarios, notas internas ni historial.</p></div><div class="dialog-foot">${button("Cancelar", "close")}<button class="primary">Descargar CSV</button></div></form>`,
    );
    $("#exportForm").exportRows = rows;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const a = b.dataset.action;
    if (b.matches("[data-close]") || a === "close") {
      b.closest("dialog").close();
      return;
    }
    if (b.dataset.nav) {
      nav(b.dataset.nav);
      return;
    }
    if (b.dataset.open) {
      await detail(b.dataset.open);
      return;
    }
    if (b.dataset.contact) {
      contactDetail(b.dataset.contact);
      return;
    }
    if (b.hasAttribute("data-status")) {
      S.status = b.dataset.status;
      S.n = 1;
      render();
      return;
    }
    if (b.dataset.mode) {
      S.mode = b.dataset.mode;
      render();
      return;
    }
    if (b.dataset.day) {
      S.date = b.dataset.day;
      S.mode = "day";
      render();
      return;
    }
    if (b.dataset.schedule) {
      schedule(b.dataset.schedule);
      return;
    }
    if (a === "detail") await detail(b.dataset.id);
    if (a === "contact") contactDetail(b.dataset.key);
    if (a === "new") newAppointment();
    if (a === "reschedule") reschedule(b.dataset.id);
    if (a === "go-agenda") nav("agenda");
    if (a === "go-availability") nav("disponibilidad");
    if (a === "go-requests") nav("solicitudes");
    if (a === "overdue") {
      S.status = "pending";
      S.to = M.addDays(M.today(), -1);
      S.from = S.q = S.service = "";
      nav("solicitudes");
    }
    if (a === "clear") {
      S.q = S.service = S.status = S.from = S.to = "";
      S.n = 1;
      render();
    }
    if (a === "prev" || a === "next") {
      S.n += a === "next" ? 1 : -1;
      $("#requestResults").innerHTML = table(filtered());
    }
    if (a === "agenda-today") {
      S.date = M.today();
      render();
    }
    if (a === "agenda-prev" || a === "agenda-next") {
      S.date = M.addDays(
        S.date,
        (a === "agenda-next" ? 1 : -1) * (S.mode === "week" ? 7 : 1),
      );
      render();
    }
    if (a === "month-prev" || a === "month-next") {
      const d = new Date(S.month + "-15T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + (a === "month-next" ? 1 : -1));
      S.month = d.toISOString().slice(0, 7);
      render();
    }
    if (a === "schedule-new") schedule();
    if (a === "schedule-reset") {
      const f = $("#scheduleForm");
      if (!f.reportValidity()) return;
      b.disabled = true;
      try {
        await api("/api/admin/horario", {
          method: "PUT",
          body: {
            overrides: [
              {
                fecha: f.elements.fecha.value,
                closed: false,
                nota: "",
                open_time: "",
                close_time: "",
              },
            ],
          },
        });
        $("#editDialog").close();
        await refresh(true);
        toast("Horario habitual restablecido.");
      } catch (err) {
        formError(f, err.message);
        b.disabled = false;
      }
    }
    if (a === "export") exportDialog(filtered());
    if (a === "export-report")
      exportDialog(M.filter(S.rows, { from: S.reportFrom, to: S.reportTo }));
  });
  document.addEventListener("input", (e) => {
    if (e.target.dataset.filter === "q") {
      S.q = e.target.value;
      S.n = 1;
      $("#requestResults").innerHTML = table(filtered());
    }
    if (e.target.id === "contactSearch") {
      S.contactQ = e.target.value;
      const q = S.contactQ.toLowerCase();
      $("#contactResults").innerHTML = contactTable(
        M.contacts(S.rows).filter((c) =>
          [c.nombre, c.telefono].some((v) => v.toLowerCase().includes(q)),
        ),
      );
    }
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.filter && el.dataset.filter !== "q") {
      S[el.dataset.filter] = el.value;
      S.n = 1;
      $("#requestResults").innerHTML = table(filtered());
    }
    if (el.id === "agendaDate") {
      S.date = el.value || M.today();
      render();
    }
    if (el.id === "reportFrom" || el.id === "reportTo") {
      S[el.id] = el.value;
      render();
    }
    if (el.id === "scheduleDate") lockClosedDate();
    if (el.id === "scheduleMode") {
      const off = el.value === "closed";
      $("#scheduleOpen").disabled = off;
      $("#scheduleClose").disabled = off;
    }
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target;
    if (
      ![
        "newForm",
        "updateForm",
        "rescheduleForm",
        "scheduleForm",
        "exportForm",
      ].includes(f.id)
    )
      return;
    e.preventDefault();
    if (!f.reportValidity()) return;
    if (f.id === "exportForm") {
      const url = URL.createObjectURL(
          new Blob([M.csv(f.exportRows)], { type: "text/csv;charset=utf-8" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "DentalSpace_solicitudes_" + M.today() + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $("#editDialog").close();
      toast("Archivo descargado.");
      return;
    }
    const b = $("button.primary", f),
      data = Object.fromEntries(new FormData(f));
    b.disabled = true;
    try {
      let result;
      if (f.id === "newForm")
        result = await api("/api/admin/citas", { method: "POST", body: data });
      if (f.id === "updateForm" || f.id === "rescheduleForm")
        result = await api("/api/admin/citas/" + f.dataset.id, {
          method: "PATCH",
          body: data,
        });
      if (f.id === "scheduleForm")
        await api("/api/admin/horario", {
          method: "PUT",
          body: {
            overrides: [
              {
                fecha: data.fecha,
                closed: data.mode === "closed",
                nota: data.nota,
                open_time: data.open_time || "",
                close_time: data.close_time || "",
              },
            ],
          },
        });
      if (f.id === "updateForm") {
        $("#detailDialog").close();
        await refresh(true);
        await detail(result.cita.id);
      } else {
        $("#editDialog").close();
        await refresh(true);
      }
      toast(
        f.id === "rescheduleForm"
          ? "Solicitud reprogramada."
          : "Cambios guardados.",
      );
    } catch (err) {
      formError(f, err.message);
    } finally {
      b.disabled = false;
    }
  });
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("button", e.target);
    b.disabled = true;
    $("#loginError").hidden = true;
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: { password: $("#password").value },
      });
      $("#password").value = "";
      S.session = true;
      $("#loginScreen").hidden = true;
      $("#panelScreen").hidden = false;
      await refresh(true);
    } catch (err) {
      $("#loginError").textContent = err.message;
      $("#loginError").hidden = false;
    } finally {
      b.disabled = false;
    }
  });
  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", { method: "POST" });
      loginView();
    } catch (e) {
      error("No se pudo cerrar la sesión. Intenta de nuevo.");
    }
  });
  $("#refreshBtn").addEventListener("click", () => refresh());
  window.addEventListener("hashchange", () => {
    S.page = titles[location.hash.slice(1)]
      ? location.hash.slice(1)
      : "resumen";
    render();
  });
  setInterval(() => {
    if (
      S.session &&
      !document.hidden &&
      !$("dialog[open]") &&
      !$("#content input:focus")
    )
      refresh(true);
  }, 60000);
  (async () => {
    S.page = titles[location.hash.slice(1)]
      ? location.hash.slice(1)
      : "resumen";
    try {
      const d = await api("/api/admin/me");
      if (d.authenticated) {
        S.session = true;
        $("#loginScreen").hidden = true;
        $("#panelScreen").hidden = false;
        await refresh(true);
      }
    } catch (e) {
      $("#loginError").textContent =
        "No se pudo comprobar la sesión. Puedes intentar entrar.";
      $("#loginError").hidden = false;
    }
  })();
})();

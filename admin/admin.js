/* DentalSpace — panel administrativo (vanilla JS, sin frameworks). */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const loginScreen = $("#loginScreen"), panelScreen = $("#panelScreen");
  const loginForm = $("#loginForm"), pwInput = $("#pwInput"), loginBtn = $("#loginBtn"), loginError = $("#loginError"), pwField = $("#pwField");

  const api = async (path, opts = {}) => {
    const res = await fetch(path, {
      method: opts.method || "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin"
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* respuesta vacía */ }
    if (!res.ok) throw new Error(data.error || `Error (${res.status})`);
    return data;
  };

  const showPanel = () => { loginScreen.hidden = true; panelScreen.hidden = false; initPanel(); };
  const showLogin = () => { panelScreen.hidden = true; loginScreen.hidden = false; };

  /* ---------- Login ---------- */
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const pw = pwInput.value;
    pwField.classList.toggle("is-invalid", !pw);
    if (!pw) return;
    loginError.classList.remove("is-shown");
    loginBtn.classList.add("is-loading");
    try {
      await api("/api/admin/login", { method: "POST", body: { password: pw } });
      pwInput.value = "";
      showPanel();
    } catch (err) {
      loginError.textContent = err.message || "No se pudo iniciar sesión.";
      loginError.classList.add("is-shown");
    } finally {
      loginBtn.classList.remove("is-loading");
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    try { await api("/api/admin/logout", { method: "POST" }); } catch (_) {}
    showLogin();
  });

  /* ---------- Tabs ---------- */
  $$(".tabs button").forEach(btn => btn.addEventListener("click", () => {
    $$(".tabs button").forEach(b => { b.classList.toggle("is-active", b === btn); b.setAttribute("aria-selected", b === btn); });
    $("#tabHorario").hidden = btn.dataset.tab !== "horario";
    $("#tabCitas").hidden = btn.dataset.tab !== "citas";
    if (btn.dataset.tab === "citas") loadCitas();
  }));

  let panelInited = false;
  function initPanel() {
    if (panelInited) return;
    panelInited = true;
    loadHorario();
    initCitasFilters();
  }

  /* ---------- Horario ---------- */
  const dayList = $("#dayList"), horarioError = $("#horarioError"), saveHorarioBtn = $("#saveHorarioBtn"), horarioSavedMsg = $("#horarioSavedMsg");
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  let overridesByDate = {};
  const dirty = new Set();

  function fmtFecha(iso) {
    const d = new Date(iso + "T12:00");
    return { dow: DIAS[d.getDay()], label: `${d.getDate()} ${MESES[d.getMonth()]}` };
  }

  async function loadHorario() {
    horarioError.classList.remove("is-shown");
    try {
      const data = await api("/api/admin/horario");
      overridesByDate = {};
      (data.overrides || []).forEach(o => { overridesByDate[o.fecha] = o; });
      if (data.dbNotConfigured) {
        horarioError.textContent = "La base de datos todavía no está conectada al proyecto, así que el horario no se puede guardar aún.";
        horarioError.classList.add("is-shown");
      }
      renderDayList();
    } catch (err) {
      horarioError.textContent = err.message || "No se pudo cargar el horario.";
      horarioError.classList.add("is-shown");
      dayList.innerHTML = "";
    }
  }

  function renderDayList() {
    const rows = [];
    const today = new Date(); today.setHours(12, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const o = overridesByDate[iso] || { fecha: iso, closed: false, nota: "", open_time: "", close_time: "" };
      const { dow, label } = fmtFecha(iso);
      rows.push(`
        <div class="day-row" data-fecha="${iso}">
          <div class="day-row__date">${label}<small>${dow}</small></div>
          <div class="day-row__extra">
            <label class="switch">
              <input type="checkbox" name="closed" ${o.closed ? "checked" : ""}>
              <span class="switch__track"></span>
              <span class="switch__label">Cerrado</span>
            </label>
            <input type="text" name="nota" placeholder="Nota (ej. Feriado)" value="${(o.nota || "").replace(/"/g, "&quot;")}" maxlength="80">
            <input type="text" name="open_time" placeholder="Abre (9:00)" value="${o.open_time || ""}" ${o.closed ? "disabled" : ""}>
            <input type="text" name="close_time" placeholder="Cierra (18:00)" value="${o.close_time || ""}" ${o.closed ? "disabled" : ""}>
          </div>
        </div>`);
    }
    dayList.innerHTML = rows.join("");

    dayList.addEventListener("input", onDayRowChange);
    dayList.addEventListener("change", onDayRowChange);
  }

  function onDayRowChange(e) {
    const row = e.target.closest(".day-row");
    if (!row) return;
    dirty.add(row.dataset.fecha);
    if (e.target.name === "closed") {
      const disable = e.target.checked;
      $('input[name="open_time"]', row).disabled = disable;
      $('input[name="close_time"]', row).disabled = disable;
    }
    horarioSavedMsg.classList.remove("is-shown");
  }

  saveHorarioBtn.addEventListener("click", async () => {
    if (!dirty.size) return;
    horarioError.classList.remove("is-shown");
    saveHorarioBtn.classList.add("is-loading");
    const overrides = [...dirty].map(fecha => {
      const row = $(`.day-row[data-fecha="${fecha}"]`);
      return {
        fecha,
        closed: $('input[name="closed"]', row).checked,
        nota: $('input[name="nota"]', row).value.trim(),
        open_time: $('input[name="open_time"]', row).value.trim(),
        close_time: $('input[name="close_time"]', row).value.trim()
      };
    });
    try {
      await api("/api/admin/horario", { method: "PUT", body: { overrides } });
      dirty.clear();
      horarioSavedMsg.classList.add("is-shown");
      await loadHorario();
    } catch (err) {
      horarioError.textContent = err.message || "No se pudo guardar el horario.";
      horarioError.classList.add("is-shown");
    } finally {
      saveHorarioBtn.classList.remove("is-loading");
    }
  });

  /* ---------- Citas ---------- */
  const citasList = $("#citasList"), citasError = $("#citasError");
  let currentStatus = "";

  function initCitasFilters() {
    $$("#citasFilters button[data-status]").forEach(btn => btn.addEventListener("click", () => {
      $$("#citasFilters button[data-status]").forEach(b => b.classList.toggle("is-active", b === btn));
      currentStatus = btn.dataset.status;
      loadCitas();
    }));
    $("#refreshCitasBtn").addEventListener("click", loadCitas);
  }

  const STATUS_LABEL = { pending: "Pendiente", confirmed: "Confirmada", rejected: "Rechazada" };

  function esc(s) { return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }

  function fmtFechaLarga(iso) {
    const d = new Date(iso + "T12:00");
    return d.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" });
  }

  let citasLoaded = false;
  async function loadCitas() {
    citasError.classList.remove("is-shown");
    citasList.innerHTML = `<div class="empty-state">Cargando citas…</div>`;
    try {
      const qs = currentStatus ? `?status=${currentStatus}` : "";
      const data = await api(`/api/admin/citas${qs}`);
      citasLoaded = true;
      if (data.dbNotConfigured) {
        citasError.textContent = "La base de datos todavía no está conectada al proyecto, así que aún no hay citas que mostrar.";
        citasError.classList.add("is-shown");
      }
      renderCitas(data.citas || []);
    } catch (err) {
      citasError.textContent = err.message || "No se pudieron cargar las citas.";
      citasError.classList.add("is-shown");
      citasList.innerHTML = "";
    }
  }

  function renderCitas(citas) {
    if (!citas.length) {
      citasList.innerHTML = `<div class="empty-state">No hay solicitudes en esta vista.</div>`;
      return;
    }
    citasList.innerHTML = citas.map(c => `
      <div class="cita-card" data-id="${c.id}">
        <div class="cita-card__top">
          <div>
            <div class="cita-card__name">${esc(c.nombre)}</div>
            <div class="cita-card__meta"><b>${esc(c.servicio)}</b> · ${esc(fmtFechaLarga(c.fecha))} · ${esc(c.horario)}</div>
            <div class="cita-card__meta">${esc(c.telefono)}${c.ars ? " · " + esc(c.ars) : ""}</div>
          </div>
          <span class="status-pill status-pill--${c.status}">${STATUS_LABEL[c.status] || c.status}</span>
        </div>
        ${c.comentario ? `<div class="cita-card__comment">${esc(c.comentario)}</div>` : ""}
        ${c.status === "pending" ? `
          <div class="cita-card__actions">
            <button class="btn btn--primary" data-action="confirmed">Confirmar</button>
            <button class="btn btn--ghost" data-action="rejected">Rechazar</button>
          </div>` : ""}
      </div>`).join("");
  }

  citasList.addEventListener("click", async e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest(".cita-card");
    const id = card.dataset.id;
    const status = btn.dataset.action;
    btn.disabled = true;
    try {
      await api(`/api/admin/citas/${id}`, { method: "PATCH", body: { status } });
      await loadCitas();
    } catch (err) {
      citasError.textContent = err.message || "No se pudo actualizar la cita.";
      citasError.classList.add("is-shown");
      btn.disabled = false;
    }
  });

  /* ---------- Sesión al cargar ---------- */
  (async () => {
    try {
      const data = await api("/api/admin/me");
      if (data.authenticated) showPanel(); else showLogin();
    } catch (_) {
      showLogin();
    }
  })();
})();

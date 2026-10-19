/* DentalSpace — interacciones */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WA = "18296507713";

  /* ---------- Datos de servicios (confirmados en publicaciones de la clínica) ---------- */
  const tooth = '<path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.3 4.7 2 7.5.6 2.6 1 6 2.5 6s1.8-3.5 2.5-5.5c.4-1 1.6-1 2 0 .7 2 1 5.5 2.5 5.5s1.9-3.4 2.5-6c.7-2.8 2-4.5 2-7.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3Z"/>';
  const icons = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    sparkle: tooth + '<path d="M17.5 1.5v3M16 3h3"/>',
    fill: tooth + '<circle cx="12" cy="9" r="2"/>',
    extract: '<path d="M8 10c-1.7 0-3-1.3-3-3.3S6.3 3 8 3c1.3 0 2 .7 4 .7S14.7 3 16 3c1.7 0 3 1.4 3 3.7S17.7 10 16 10"/><path d="M9 13l3 3 3-3M12 16V8"/><path d="M5 21h14"/>',
    shield: '<path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6Z"/><path d="m9 12 2 2 4-4"/>',
    ortho: '<path d="M3 12c3-4 15-4 18 0"/><path d="M3 12c3 4 15 4 18 0"/><rect x="6.5" y="9.5" width="3" height="5" rx="1"/><rect x="14.5" y="9.5" width="3" height="5" rx="1"/><path d="M9.5 12h5"/>',
    gum: '<path d="M4 9c2-4 14-4 16 0"/><path d="M6.5 9.5c0 4 1 9 2.5 9s1.4-4 3-4 1.5 4 3 4 2.5-5 2.5-9"/>'
  };
  const services = [
    { id: "evaluacion", icon: "search", feature: true, name: "Evaluación odontológica",
      short: "El primer paso: revisamos tu salud bucal y te explicamos, con calma, qué necesitas.",
      lead: "Una revisión completa para conocer el estado de tus dientes, encías y mordida antes de cualquier tratamiento.",
      points: ["Revisión de dientes, encías y mordida", "Conversación sobre molestias e historial", "Explicación clara de opciones y prioridades", "Plan de tratamiento y próximos pasos"] },
    { id: "profilaxis", icon: "sparkle", name: "Profilaxis",
      short: "Limpieza profesional para eliminar placa y sarro.",
      lead: "Limpieza dental profesional que remueve placa y sarro acumulados y ayuda a mantener las encías sanas.",
      points: ["Remoción de placa y sarro", "Pulido dental", "Recomendaciones de higiene en casa"] },
    { id: "restauraciones", icon: "fill", name: "Restauraciones de caries",
      short: "Devolvemos forma y función al diente afectado.",
      lead: "Tratamos las caries y restauramos el diente para recuperar su forma, su función y su aspecto natural.",
      points: ["Eliminación del tejido afectado", "Restauración del color del diente", "Recuperación de forma y mordida"] },
    { id: "extracciones", icon: "extract", name: "Extracciones",
      short: "Cuando es necesario, con cuidado y control del dolor.",
      lead: "Extracciones dentales realizadas con cuidado cuando el diente no puede conservarse, con indicaciones claras para la recuperación.",
      points: ["Evaluación previa del caso", "Procedimiento con anestesia local", "Indicaciones de cuidado posterior"] },
    { id: "preventiva", icon: "shield", name: "Odontología preventiva",
      short: "Evitar problemas es la mejor forma de cuidar tu sonrisa.",
      lead: "Chequeos y hábitos que ayudan a detectar a tiempo caries y problemas de encías, para que tu sonrisa dure.",
      points: ["Chequeos periódicos", "Educación en higiene oral", "Detección temprana de problemas"] },
    { id: "ortopedia", icon: "ortho", name: "Ortopedia maxilar",
      short: "Mordida abierta, apiñamiento, expansores y rejilla lingual.",
      lead: "Tratamientos que guían el desarrollo de los maxilares para corregir problemas de mordida y falta de espacio.",
      points: ["Corrección de mordida abierta", "Corrección de apiñamiento", "Expansor maxilar", "Rejilla lingual"],
      note: "Servicios de ortodoncia: [POR CONFIRMAR con la clínica]." },
    { id: "periodoncia", icon: "gum", name: "Tratamiento periodontal",
      short: "Cuidado de encías con atención especializada.",
      lead: "Diagnóstico y tratamiento de problemas de encías, con atención periodontal a cargo de la Dra. Marisol Carrasco.",
      points: ["Evaluación de encías", "Tratamiento de la enfermedad periodontal", "Mantenimiento y seguimiento"] }
  ];
  const svgIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[k]}</svg>`;
  const pad = n => String(n).padStart(2, "0");

  // Tarjetas
  const grid = $("#servicesGrid");
  grid.innerHTML = services.map((s, i) => `
    <button type="button" class="svc reveal${s.feature ? " svc--feature" : ""}" style="--d:${i % 4}" data-svc="${i}" aria-haspopup="dialog">
      <span class="svc__top"><span class="svc__icon">${svgIcon(s.icon)}</span><span class="num">${pad(i + 1)}</span></span>
      <h3>${s.name}</h3>
      <p>${s.short}</p>
      <span class="svc__more">Ver detalle <span aria-hidden="true">→</span></span>
    </button>`).join("");
  $("#footerServices").innerHTML = services.map(s => `<li><a href="#servicios">${s.name}</a></li>`).join("");
  $("#choices").innerHTML = services.map((s, i) => `
    <label class="choice"><input type="radio" name="servicio" value="${s.name}" ${i === 0 ? "" : ""}><span>${s.name}</span></label>`).join("") +
    `<label class="choice"><input type="radio" name="servicio" value="No estoy seguro/a"><span>No estoy seguro/a<small>Te orientamos en la evaluación</small></span></label>`;

  /* ---------- Modal de servicio ---------- */
  const modal = $("#modal");
  let lastFocus = null, currentSvc = null;
  const openModal = i => {
    const s = services[i]; currentSvc = s;
    $("#mNum").textContent = pad(i + 1);
    $("#mTitle").textContent = s.name;
    $("#mLead").textContent = s.lead;
    $("#mList").innerHTML = s.points.map(p => `<li>${p}</li>`).join("");
    $("#mNote").textContent = s.note || "";
    lastFocus = document.activeElement;
    modal.hidden = false; modal.classList.remove("is-closing");
    document.body.style.overflow = "hidden";
    $(".modal__close", modal).focus();
  };
  const closeModal = (restore = true) => {
    if (modal.hidden) return;
    modal.classList.add("is-closing");
    setTimeout(() => { modal.hidden = true; document.body.style.overflow = ""; if (restore && lastFocus) lastFocus.focus({ preventScroll: true }); }, reduced ? 0 : 240);
  };
  grid.addEventListener("click", e => { const b = e.target.closest("[data-svc]"); if (b) openModal(+b.dataset.svc); });
  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  $("#mBook").addEventListener("click", () => {
    closeModal(false);
    setTimeout(() => $("#fName").focus({ preventScroll: true }), 700);
    const r = $$('input[name="servicio"]').find(x => x.value === currentSvc.name);
    if (r) r.checked = true;
  });
  document.addEventListener("keydown", e => {
    if (modal.hidden) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") { // trampa de foco
      const f = $$("a[href], button", modal); const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Navegación ---------- */
  const nav = $("#nav"), burger = $("#burger"), menu = $("#menu");
  const setMenu = open => { burger.setAttribute("aria-expanded", open); burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú"); menu.classList.toggle("is-open", open); };
  burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

  const links = $$(".nav__links a[href^='#']:not(.btn)");
  const secObs = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) links.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(a => { const s = $(a.getAttribute("href")); s && secObs.observe(s); });

  /* ---------- Revelado + parallax ---------- */
  document.documentElement.classList.add("reveal-init");
  const revObs = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("is-in"); revObs.unobserve(en.target); }
  }), { threshold: 0.1, rootMargin: "50px 0px 50px 0px" });
  $$(".reveal").forEach(el => revObs.observe(el));

  $$(".blur-in").forEach(img => { const done = () => img.classList.add("is-loaded"); img.complete ? requestAnimationFrame(done) : img.addEventListener("load", done); });
  $$("[data-float-delay]").forEach(el => el.style.setProperty("--fd", el.dataset.floatDelay));

  const par = $$("[data-parallax]");
  let ticking = false;
  const onScroll = () => {
    nav.classList.toggle("is-scrolled", scrollY > 8);
    if (!reduced && innerWidth > 640) par.forEach(el => { el.style.transform = `translate3d(0, ${scrollY * el.dataset.parallax}px, 0)`; });
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();

  /* ---------- Estado "abierto ahora" (hora de República Dominicana) ---------- */
  (() => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santo_Domingo", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t).value;
    const day = get("weekday"), h = (+get("hour") % 24) + (+get("minute")) / 60;
    const close = day === "Sat" ? 14 : day === "Sun" ? 0 : 18;
    const open = close && h >= 9 && h < close;
    $("#statusDot").classList.toggle("is-open", open);
    $("#statusTitle").textContent = open ? "Abierto ahora" : "Cerrado en este momento";
    $("#statusText").textContent = open ? `Hoy hasta las ${close === 14 ? "2:00 p. m." : "6:00 p. m."}` : "Lun–Vie 9:00–6:00 · Sáb 9:00–2:00";
  })();

  /* ---------- Antes / después ---------- */
  $$("[data-ba]").forEach(ba => {
    const r = $(".ba__range", ba);
    const set = v => ba.style.setProperty("--pos", v + "%");
    r.addEventListener("input", () => set(r.value));
    set(r.value);
  });

  /* ---------- Testimonios ---------- */
  (() => {
    const track = $("#tTrack"), cards = $$(".tcard", track), dotsBox = $("#tDots");
    let idx = 0, timer = null, paused = false;
    const perView = () => innerWidth <= 640 ? 1 : innerWidth <= 1080 ? 2 : 3;
    const maxIdx = () => Math.max(0, cards.length - perView());
    const renderDots = () => {
      dotsBox.innerHTML = "";
      for (let i = 0; i <= maxIdx(); i++) {
        const b = document.createElement("button");
        b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-label", `Ir al testimonio ${i + 1}`);
        b.addEventListener("click", () => { go(i); pause(); });
        dotsBox.append(b);
      }
    };
    const go = i => {
      idx = (i + maxIdx() + 1) % (maxIdx() + 1);
      const step = cards[0].offsetWidth + 20;
      track.style.transform = `translateX(${-idx * step}px)`;
      $$("button", dotsBox).forEach((d, j) => d.setAttribute("aria-selected", j === idx));
    };
    const start = () => { if (!reduced && !paused) { clearInterval(timer); timer = setInterval(() => go(idx + 1), 6000); } };
    const pause = () => { paused = true; clearInterval(timer); };
    $("#tPrev").addEventListener("click", () => { go(idx - 1); pause(); });
    $("#tNext").addEventListener("click", () => { go(idx + 1); pause(); });
    // arrastrar / deslizar
    let x0 = null, dx = 0;
    track.addEventListener("pointerdown", e => { x0 = e.clientX; dx = 0; track.classList.add("is-dragging"); track.setPointerCapture(e.pointerId); pause(); });
    track.addEventListener("pointermove", e => { if (x0 === null) return; dx = e.clientX - x0; const step = cards[0].offsetWidth + 20; track.style.transform = `translateX(${-idx * step + dx}px)`; });
    const end = () => { if (x0 === null) return; track.classList.remove("is-dragging"); x0 = null; if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1)); else go(idx); };
    track.addEventListener("pointerup", end); track.addEventListener("pointercancel", end);
    $("#tcar").addEventListener("keydown", e => { if (e.key === "ArrowRight") { go(idx + 1); pause(); } if (e.key === "ArrowLeft") { go(idx - 1); pause(); } });
    $("#tcar").tabIndex = 0;
    addEventListener("resize", () => { renderDots(); go(Math.min(idx, maxIdx())); });
    renderDots(); go(0); start();
  })();

  /* ---------- FAQ: una abierta a la vez en móvil ---------- */
  $$(".acc").forEach(d => d.addEventListener("toggle", () => {
    if (d.open && innerWidth <= 640) $$(".acc").forEach(o => { if (o !== d) o.open = false; });
  }));

  /* ---------- Formulario de citas conectado al panel ---------- */
  (() => {
    const form = $("#bform"), steps = $$(".bstep", form), labels = $$(".bform__steps li", form);
    const next = $("#bNext"), back = $("#bBack"), live = $("#bLive"), bar = $("#bProgress");
    const date = $("#fDate");
    let cur = 0;
    // fecha mínima: mañana
    const t = new Date(); t.setDate(t.getDate() + 1);
    date.min = t.toISOString().slice(0, 10);

    // ---------- Días cerrados (panel administrativo) ----------
    // Se cargan desde /api/disponibilidad; si la petición falla o la base
    // de datos aún no está conectada, el formulario simplemente no bloquea
    // ninguna fecha (no rompe el flujo existente).
    let overrides = {};
    const closedNotice = document.createElement("p");
    closedNotice.className = "err err--block closed-notice";
    date.closest(".field").after(closedNotice);

    fetch("/api/disponibilidad").then(r => r.ok ? r.json() : null).then(data => {
      if (!data || !Array.isArray(data.overrides)) return;
      data.overrides.forEach(o => { overrides[o.fecha] = o; });
      const soon = new Date(); soon.setDate(soon.getDate() + 7);
      const soonIso = soon.toISOString().slice(0, 10);
      const next7 = data.overrides.filter(o => o.closed && o.fecha >= date.min && o.fecha <= soonIso);
      if (next7.length) {
        const list = next7.map(o => new Date(o.fecha + "T12:00").toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" }) + (o.nota ? ` (${o.nota})` : "")).join(", ");
        closedNotice.textContent = `Aviso: permaneceremos cerrados el ${list}.`;
        closedNotice.classList.add("is-shown");
      }
      if (date.value) dateChangeCheck();
    }).catch(() => {});

    const fieldOk = (input, ok) => { const f = input.closest(".field"); f.classList.toggle("is-invalid", !ok); f.classList.toggle("is-valid", ok); input.setAttribute("aria-invalid", !ok); return ok; };
    const digits = v => v.replace(/\D/g, "").length;
    const isSunday = v => v && new Date(v + "T12:00").getDay() === 0;
    const isSaturday = v => v && new Date(v + "T12:00").getDay() === 6;
    const isClosedDay = v => !!(v && overrides[v]?.closed);

    const validate = s => {
      if (s === 0) {
        const n = $("#fName"), p = $("#fPhone");
        const a = fieldOk(n, n.value.trim().length >= 3);
        const b = fieldOk(p, digits(p.value) >= 10);
        if (!a) n.focus(); else if (!b) p.focus();
        return a && b;
      }
      if (s === 1) { const ok = !!$('input[name="servicio"]:checked'); $("#svcErr").classList.toggle("is-shown", !ok); return ok; }
      if (s === 2) {
        const slots = DentalAvailability.slots(date.value, overrides[date.value]);
        const okD = fieldOk(date, !!date.value && date.value >= date.min && slots.length > 0);
        const selected = $('input[name="horario"]:checked');
        const okS = !!selected && slots.some(s => s.value === selected.value); $("#slotErr").classList.toggle("is-shown", !okS);
        return okD && okS;
      }
      return true;
    };
    ["#fName", "#fPhone"].forEach(s => $(s).addEventListener("blur", e => { if (e.target.value) validate(0); }));
    form.addEventListener("change", e => { if (e.target.name === "servicio") $("#svcErr").classList.remove("is-shown"); if (e.target.name === "horario") $("#slotErr").classList.remove("is-shown"); });
    // Franjas recortadas al horario habitual o a la excepción de la fecha.
    function dateChangeCheck() {
      const previous = $('input[name="horario"]:checked')?.value;
      const slots = DentalAvailability.slots(date.value, overrides[date.value]);
      $("#slots").replaceChildren(...slots.map(s => {
        const label = document.createElement("label"), input = document.createElement("input"), span = document.createElement("span"), small = document.createElement("small");
        input.type = "radio"; input.name = "horario"; input.value = s.value; input.required = true; input.checked = previous === s.value;
        span.textContent = s.label; small.textContent = s.range; span.append(small); label.append(input, span); return label;
      }));
      let notice = $("#specialHours");
      if (!notice) { notice = document.createElement("p"); notice.id = "specialHours"; notice.setAttribute("aria-live", "polite"); $("#slots").before(notice); }
      const override = overrides[date.value];
      notice.textContent = override && !override.closed ? `Horario especial: ${override.open_time || "habitual"}${override.close_time ? "–" + override.close_time : ""}${override.nota ? " · " + override.nota : ""}` : "";
      const dateErr = $("#dateErr");
      if (isClosedDay(date.value)) {
        const o = overrides[date.value];
        dateErr.textContent = "La clínica no abre ese día" + (o.nota ? ` (${o.nota})` : "") + ". Elige otra fecha.";
        fieldOk(date, false);
      } else if (date.value) {
        dateErr.textContent = "Elige una fecha de lunes a sábado.";
        fieldOk(date, slots.length > 0 && date.value >= date.min);
      }
    }
    date.addEventListener("change", dateChangeCheck);

    const data = () => ({
      nombre: $("#fName").value.trim(), telefono: $("#fPhone").value.trim(), ars: $("#fArs").value || "Sin seguro",
      servicio: ($('input[name="servicio"]:checked') || {}).value, fecha: date.value ? new Date(date.value + "T12:00").toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" }) : "",
      horario: ($('input[name="horario"]:checked') || {}).value, comentario: $("#fNote").value.trim()
    });
    const show = (s, init) => {
      cur = s;
      steps.forEach((el, i) => el.classList.toggle("is-active", i === s));
      labels.forEach((l, i) => { l.classList.toggle("is-current", i === s); l.classList.toggle("is-done", i < s); });
      bar.style.width = Math.min(100, (s + 1) * 25) + "%";
      back.disabled = s === 0;
      $(".btn__label", next).textContent = s === 3 ? "Confirmar solicitud" : "Continuar";
      if (s === 3) {
        const d = data();
        $("#summary").innerHTML = [["Nombre", d.nombre], ["Teléfono", d.telefono], ["Seguro", d.ars], ["Servicio", d.servicio], ["Fecha", d.fecha], ["Horario", d.horario], ["Comentario", d.comentario || "—"]]
          .map(([k, v]) => `<dt>${k}</dt><dd>${String(v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</dd>`).join("");
      }
      live.textContent = s < 4 ? `Paso ${s + 1} de 4` : "Solicitud lista para enviar";
      if (!init) form.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    };
    next.addEventListener("click", async () => {
      if (next.disabled) return;
      if (!validate(cur)) return;
      if (cur < 3) return show(cur + 1);
      // Esperar la confirmación real de la API antes de indicar que se guardó.
      next.disabled = true; back.disabled = true;
      next.classList.add("is-loading"); $(".btn__label", next).textContent = "Preparando…";
        const d = data();
        const msg = `Hola DentalSpace, quisiera solicitar una cita.\n\n• Nombre: ${d.nombre}\n• Teléfono: ${d.telefono}\n• Seguro: ${d.ars}\n• Servicio: ${d.servicio}\n• Fecha preferida: ${d.fecha}\n• Horario: ${d.horario}` + (d.comentario ? `\n• Comentario: ${d.comentario}` : "");
        $("#waSend").href = `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
        let saved = false;
        try {
        const response = await fetch("/api/citas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: d.nombre, telefono: d.telefono, ars: d.ars, servicio: d.servicio, fecha: date.value, horario: d.horario, comentario: d.comentario })
        });
        const result = await response.json();
        if (response.status === 409) {
          const fresh = await fetch("/api/disponibilidad", { cache: "no-store" }).then(r => r.json());
          overrides = Object.fromEntries((fresh.overrides || []).map(o => [o.fecha, o]));
          dateChangeCheck(); show(2);
          $("#dateErr").textContent = result.error || "La disponibilidad cambió. Revisa la fecha y el horario.";
          fieldOk(date, false);
          return;
        }
        saved = response.ok && result.ok;
        } catch (_) { /* Se ofrece WhatsApp sin afirmar que quedó registrada. */ }
        finally { next.disabled = false; back.disabled = false; next.classList.remove("is-loading"); }
        $("h3", steps[4]).textContent = saved ? "¡Solicitud registrada!" : "No pudimos registrar tu solicitud";
        $("p", steps[4]).textContent = saved ? "DentalSpace ya puede verla en su panel. La clínica debe confirmar tu cita; también puedes escribir por WhatsApp." : "Todavía no aparece en el panel. Envíala por WhatsApp para que DentalSpace pueda atenderla.";
        form.classList.add("is-done"); show(4); steps[4].focus();
    });
    back.addEventListener("click", () => cur > 0 && show(cur - 1));
    $("#bRestart").addEventListener("click", () => { form.reset(); $$(".field", form).forEach(f => f.classList.remove("is-valid", "is-invalid")); form.classList.remove("is-done"); show(0); });
    show(0, true);
  })();

  $("#year").textContent = new Date().getFullYear();
})();

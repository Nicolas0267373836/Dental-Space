const test = require("node:test"),
  assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("node:fs"),
  path = require("node:path");
const { createPreview } = require("../scripts/preview.cjs");
const M = require("../admin/model");
test("Interfaz → API → Postgres: registrar, actualizar, filtrar y manejar errores", async () => {
  const { server, database, db } = await createPreview({ seed: false });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "",
    dom;
  const errors = [];

  async function wait(check) {
    for (let i = 0; i < 120; i++) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("La interfaz no alcanzó el estado esperado");
  }
  try {
    const vc = new VirtualConsole();
    vc.on("jsdomError", (e) => {
      if (e.type !== "css-parsing") errors.push(e.message);
    });
    const html = fs
      .readFileSync(path.join(__dirname, "../admin/index.html"), "utf8")
      .replace(
        /<script src="([^"]+)"><\/script>/g,
        (_, file) =>
          "<script>" +
          fs.readFileSync(path.join(__dirname, "../admin", file), "utf8") +
          "</script>",
      );
    dom = new JSDOM(html, {
      url: base + "/admin/",
      runScripts: "dangerously",
      virtualConsole: vc,
      beforeParse(w) {
        w.fetch = async (p, o = {}) => {
          const r = await fetch(new URL(p, base), {
            ...o,
            headers: { ...o.headers, ...(cookie ? { Cookie: cookie } : {}) },
          });
          if (r.headers.get("set-cookie"))
            cookie = r.headers.get("set-cookie").split(";")[0];
          return r;
        };
        w.HTMLDialogElement.prototype.showModal = function () {
          this.setAttribute("open", "");
        };
        w.HTMLDialogElement.prototype.close = function () {
          this.removeAttribute("open");
        };
      },
    });
    const w = dom.window,
      d = w.document;
    await wait(() => d.querySelector("#loginForm") && w.DentalModel);
    d.querySelector("#password").value = "DentalSpace-demo-2026";
    d.querySelector("#loginForm").requestSubmit();
    await wait(
      () =>
        d.querySelector("h1")?.textContent || d.querySelector("#content h1"),
    );
    await wait(() => d.querySelector("#content h1"));
    d.querySelector("[data-action=new]").click();
    const form = d.querySelector("#newForm");
    for (const [key, val] of Object.entries({
      nombre: "Contacto UI <script>",
      telefono: "0000000000",
      servicio: "Evaluación",
      fecha: M.addDays(M.today(), 3),
      horario: "10:00",
      ars: "",
      comentario: "",
    }))
      form.elements[key].value = val;
    form.requestSubmit();
    await wait(() => !d.querySelector("#editDialog").open);
    await wait(() =>
      d.querySelector("#content").textContent.includes("Contacto UI"),
    );
    const saved = await db.query("select id,status from appointments");
    assert.equal(saved.rows.length, 1);
    const id = saved.rows[0].id;
    d.querySelector("[data-nav=solicitudes]").click();
    assert.ok(d.querySelector(".data-table"));
    assert.equal(d.querySelector(".data-table script"), null);
    d.querySelector("#requestSearch").value = "Contacto UI";
    d.querySelector("#requestSearch").dispatchEvent(
      new w.Event("input", { bubbles: true }),
    );
    assert.equal(d.querySelectorAll(".data-table tbody tr").length, 1);
    d.querySelector("[data-open]").click();
    await wait(() =>
      d
        .querySelector("#activityList")
        ?.textContent.includes("Registrada desde el panel"),
    );
    d.querySelector("#appointmentStatus").value = "confirmed";
    d.querySelector("#internalNote").value = "Nota UI";
    d.querySelector("#updateForm").requestSubmit();
    await wait(() =>
      d
        .querySelector("#activityList")
        ?.textContent.includes("Nota interna actualizada"),
    );
    assert.equal(
      (
        await db.query(
          "select status, internal_note from appointments where id=$1",
          [id],
        )
      ).rows[0].internal_note,
      "Nota UI",
    );
    d.querySelector("#detailDialog [data-close]").click();
    d.querySelector("[data-nav=contactos]").click();
    assert.equal(d.querySelectorAll(".data-table tbody tr").length, 1);
    d.querySelector("[data-nav=reportes]").click();
    assert.ok(d.querySelector("#reportFrom"));
    d.querySelector("#reportTo").value = M.addDays(M.today(), 10);
    d.querySelector("#reportTo").dispatchEvent(
      new w.Event("change", { bubbles: true }),
    );
    d.querySelector("[data-action=export-report]").click();
    assert.ok(d.querySelector("#exportForm"));
    assert.match(d.querySelector("#editContent").textContent, /teléfonos/);
    d.querySelector("#editDialog [data-close]").click();
    await db.query(
      "insert into schedule_overrides (fecha,closed) values ($1,true)",
      [M.addDays(M.today(), 4)],
    );
    d.querySelector("[data-nav=solicitudes]").click();
    d.querySelector("[data-action=new]").click();
    const f = d.querySelector("#newForm");
    for (const [key, val] of Object.entries({
      nombre: "Otra prueba UI",
      telefono: "0000000001",
      servicio: "Evaluación",
      fecha: M.addDays(M.today(), 4),
      horario: "11:00",
    }))
      f.elements[key].value = val;
    f.requestSubmit();
    await wait(() => d.querySelector("#newForm .form-error"));
    assert.match(
      d.querySelector("#newForm .form-error").textContent,
      /no abre/,
    );
    assert.equal(f.elements.nombre.value, "Otra prueba UI");
    assert.equal(
      (await db.query("select count(*)::int as n from appointments")).rows[0].n,
      1,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom?.window.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await database.close();
  }
});

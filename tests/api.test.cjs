const test = require("node:test"),
  assert = require("node:assert/strict");
const { createPreview } = require("../scripts/preview.cjs");
const M = require("../admin/model");
test("Flujo real de API con Postgres aislado", async (t) => {
  const { server, database, db } = await createPreview({ seed: false });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  async function call(url, method = "GET", body, auth = true, extra = {}) {
    const r = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  const future = M.addDays(M.today(), 2),
    data = {
      nombre: "Contacto de prueba",
      telefono: "0000000000",
      servicio: "Evaluación",
      fecha: future,
      horario: "10:00",
      ars: "",
      comentario: "",
    };
  let id;
  try {
    await t.test(
      "Privacidad: citas sin sesión devuelven 401 y no-store",
      async () => {
        const r = await call("/api/admin/citas");
        assert.equal(r.status, 401);
        assert.match(r.headers.get("cache-control"), /no-store/);
      },
    );
    await t.test("Login válido genera cookie privada", async () => {
      const r = await call("/api/admin/login", "POST", {
        password: "DentalSpace-demo-2026",
      });
      assert.equal(r.status, 200);
      cookie = r.headers.get("set-cookie").split(";")[0];
      assert.match(r.headers.get("set-cookie"), /HttpOnly/);
    });
    await t.test(
      "Entrada pública fuerza pending, guarda y registra actividad",
      async () => {
        const r = await call("/api/citas", "POST", {
          ...data,
          status: "confirmed",
        });
        assert.equal(r.status, 200);
        id = r.data.id;
        const a = await call("/api/admin/citas");
        assert.equal(a.data.citas[0].status, "pending");
        assert.equal(a.data.citas[0].nombre, data.nombre);
      },
    );
    await t.test(
      "Confirmar, nota y reprogramación persisten con historial",
      async () => {
        const r = await call("/api/admin/citas/" + id, "PATCH", {
          status: "confirmed",
          internal_note: "Llamar antes de la visita",
          fecha: M.addDays(future, 1),
          horario: "11:00",
        });
        assert.equal(r.status, 200);
        assert.equal(r.data.cita.fecha, M.addDays(future, 1));
        assert.equal(r.data.cita.internal_note, "Llamar antes de la visita");
        const h = await call("/api/admin/citas/" + id);
        assert.equal(h.data.activity.length, 2);
        assert.match(h.data.activity[0].detail, /Reprogramada/);
      },
    );
    await t.test(
      "Cerrar fecha persiste y bloquea solicitud pública; reabrir la permite",
      async () => {
        const o = {
          fecha: future,
          closed: true,
          nota: "Prueba",
          open_time: "",
          close_time: "",
        };
        assert.equal(
          (await call("/api/admin/horario", "PUT", { overrides: [o] })).status,
          200,
        );
        const pub = await call("/api/disponibilidad");
        assert.equal(pub.data.overrides[0].closed, true);
        assert.equal((await call("/api/citas", "POST", data)).status, 409);
        assert.equal(
          (
            await call("/api/admin/horario", "PUT", {
              overrides: [{ ...o, closed: false, nota: "" }],
            })
          ).status,
          200,
        );
        assert.equal(
          (await call("/api/disponibilidad")).data.overrides.length,
          0,
        );
      },
    );
    await t.test("Horario especial publica franjas y rechaza solicitudes obsoletas", async () => {
      const override = { fecha: future, closed: false, nota: "Horario especial de prueba", open_time: "10:00", close_time: "13:00" };
      assert.equal((await call("/api/admin/horario", "PUT", { overrides: [override] })).status, 200);
      const pub = await call("/api/disponibilidad");
      assert.match(pub.headers.get("cache-control"), /no-store/);
      const slots = require("../shared/availability").slots(future, pub.data.overrides[0]);
      assert.deepEqual(slots.map(s => s.range), ["10:00–12:00", "12:00–13:00"]);
      assert.equal((await call("/api/citas", "POST", {...data, horario: "Tarde (15:00–18:00)"})).status, 409);
      assert.equal((await call("/api/citas", "POST", {...data, horario: slots[0].value})).status, 200);
      await call("/api/admin/horario", "PUT", { overrides: [{ fecha: future, closed: false }] });
    });
    await t.test("Domingos y feriados bloquean la web, el alta manual y la reapertura", async () => {
      for (const fecha of ['2099-01-01', '2099-10-25']) {
        assert.ok(require('../shared/availability').closedReason(fecha));
        assert.equal((await call('/api/citas','POST',{...data,fecha})).status,409);
        assert.equal((await call('/api/admin/citas','POST',{...data,fecha})).status,409);
        assert.equal((await call('/api/admin/citas/'+id,'PATCH',{fecha,horario:'10:00'})).status,409);
        assert.equal((await call('/api/admin/horario','PUT',{overrides:[{fecha,closed:false,open_time:'10:00',close_time:'12:00'}]})).status,400);
      }
    });
    await t.test("Horario mixto inválido no guarda parcialmente", async () => {
      const r = await call("/api/admin/horario", "PUT", {
        overrides: [
          { fecha: future, closed: true, nota: "Prueba" },
          { fecha: "2026-02-30", closed: true },
        ],
      });
      assert.equal(r.status, 400);
      assert.equal(
        (await call("/api/disponibilidad")).data.overrides.length,
        0,
      );
    });
    await t.test(
      "Datos excesivos, fechas imposibles y origen externo rechazados",
      async () => {
        for (const patch of [
          { nombre: "x".repeat(81) },
          { fecha: "2026-02-30" },
          { telefono: "<script>" },
          { comentario: "x".repeat(501) },
        ])
          assert.equal(
            (await call("/api/citas", "POST", { ...data, ...patch })).status,
            400,
          );
        assert.equal(
          (
            await call(
              "/api/admin/citas/" + id,
              "PATCH",
              { status: "completed" },
              true,
              { Origin: "https://otro.example" },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call("/api/admin/citas/no-es-id", "PATCH", {
              status: "completed",
            })
          ).status,
          400,
        );
      },
    );
    await t.test("La transacción revierte si falla la actividad", async () => {
      await assert.rejects(
        db.transaction(async (c) => {
          await c.query("update appointments set status=$1 where id=$2", [
            "completed",
            id,
          ]);
          throw new Error("fallo simulado");
        }),
      );
      assert.equal(
        (await db.query("select status from appointments where id=$1", [id]))
          .rows[0].status,
        "confirmed",
      );
    });
    await t.test(
      "Estados de seguimiento y registro manual funcionan",
      async () => {
        for (const status of ["completed", "cancelled", "no_show", "rejected"])
          assert.equal(
            (await call("/api/admin/citas/" + id, "PATCH", { status })).data
              .cita.status,
            status,
          );
        assert.equal(
          (await call("/api/admin/citas", "POST", data)).status,
          201,
        );
      },
    );
    await t.test(
      "Límite persistente de login y sesión malformada",
      async () => {
        for (let i = 0; i < 6; i++)
          assert.equal(
            (await call("/api/admin/login", "POST", { password: "incorrecta" }))
              .status,
            401,
          );
        assert.equal(
          (await call("/api/admin/login", "POST", { password: "incorrecta" }))
            .status,
          429,
        );
        const r = await fetch(base + "/api/admin/me", {
          headers: { Cookie: "ds_admin=%broken" },
        });
        assert.equal((await r.json()).authenticated, false);
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    await database.close();
  }
});
test("Cálculos, agrupación de teléfonos y exportación segura", () => {
  const rows = [
    {
      id: "1",
      nombre: '=HYPERLINK("x")',
      telefono: "8291234567",
      servicio: "Evaluación",
      fecha: "2026-10-19",
      horario: "10:00",
      status: "pending",
      created_at: "2026-10-18",
    },
    {
      id: "2",
      nombre: "Contacto A",
      telefono: "+1 829 123 4567",
      servicio: "Limpieza",
      fecha: "2026-10-20",
      horario: "11:00",
      status: "confirmed",
      created_at: "2026-10-19",
    },
  ];
  assert.equal(M.contacts(rows).length, 1);
  assert.equal(
    M.filter(rows, { status: "pending", from: "2026-10-19" }).length,
    1,
  );
  assert.equal(M.metrics(rows, "2026-10-19").upcoming, 2);
  assert.equal(M.addDays("2026-12-31", 1), "2027-01-01");
  assert.match(M.csv(rows), /"'=HYPERLINK/);
  assert.ok(
    !M.csv([{ ...rows[0], internal_note: "PRIVADO" }]).includes("PRIVADO"),
  );
});

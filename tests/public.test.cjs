const test = require('node:test'), assert = require('node:assert/strict');
const {JSDOM} = require('jsdom'), fs = require('node:fs');
const availability = require('../shared/availability');
test('Formulario público aplica horarios, cierres y confirma el guardado real', async () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const source = fs.readFileSync(require.resolve('../script.js'), 'utf8');
  const booking = source.slice(source.indexOf('  /* ---------- Formulario de citas conectado'), source.indexOf('  $("#year")'));
  let override = {fecha: '2099-10-22', closed: false, open_time: '10:00', close_time: '13:00', nota: 'Solo mañana'};
  let posted, status = 200;
  const dom = new JSDOM(html, {url: 'https://dental.test', runScripts: 'outside-only'}), w = dom.window, d = w.document;
  w.HTMLElement.prototype.scrollIntoView = function() {};
  w.DentalAvailability = availability;
  w.fetch = async (url, options) => url === '/api/disponibilidad'
    ? {ok:true, json:async()=>({overrides: [override]})}
    : (posted = JSON.parse(options.body), {ok:status===200, status, json:async()=>({ok:status===200, error:'El horario cambió.'})});
  w.eval('const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)], reduced=true, WA="0000000000";'+booking);
  const tick = () => new Promise(r=>setTimeout(r,0));
  const change = () => d.querySelector('#fDate').dispatchEvent(new w.Event('change',{bubbles:true}));
  const click = () => d.querySelector('#bNext').click();
  try {
    await tick();
    d.querySelector('#fDate').value=override.fecha; change();
    assert.match(d.querySelector('#specialHours').textContent,/10:00–13:00/);
    assert.deepEqual([...d.querySelectorAll('#slots small')].map(s=>s.textContent), ['10:00–12:00','12:00–13:00']);
    d.querySelector('#fName').value='Prueba pública'; d.querySelector('#fPhone').value='0000000000'; click();
    const service = d.createElement('input'); service.type='radio'; service.name='servicio'; service.value='Evaluación'; service.checked=true; d.querySelector('#choices').append(service); click();
    d.querySelector('#slots input').checked=true; click(); click();
    assert.equal(d.querySelector('#bNext').disabled,true);
    await tick(); await tick();
    assert.equal(posted.horario,'Mañana (10:00–12:00)');
    assert.equal(d.querySelector('.bsuccess h3').textContent,'¡Solicitud registrada!');
    d.querySelector('#bRestart').click(); d.querySelector('#fName').value='Prueba pública'; d.querySelector('#fPhone').value='0000000000'; click(); service.checked=true; click();
    d.querySelector('#fDate').value=override.fecha; change(); d.querySelector('#slots input').checked=true; click();
    override={...override,closed:true}; status=409; click(); await tick(); await tick();
    assert.equal(d.querySelector('[data-step="2"]').classList.contains('is-active'),true);
    assert.match(d.querySelector('#dateErr').textContent,/horario cambió/);
    assert.equal(d.querySelectorAll('#slots input').length,0);
  } finally { w.close(); }
});
test('Franjas de sábado terminan a las 14:00 y una excepción puede abrir el domingo', () => {
  assert.equal(availability.slots('2026-10-24').at(-1).range,'12:00–14:00');
  assert.deepEqual(availability.slots('2026-10-25'),[]);
  assert.equal(availability.slots('2026-10-25',{open_time:'08:00',close_time:'11:00'})[0].range,'08:00–11:00');
});

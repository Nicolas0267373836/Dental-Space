(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DentalAvailability = factory();
})(typeof window === "undefined" ? this : window, function () {
  const minutes = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const clock = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  // Feriados nacionales de RD: Ley 139-97 y calendario del Ministerio de Trabajo.
  // Reyes, Duarte, Trabajo y Constitución se trasladan; los demás son inamovibles.
  const cache = new Map();
  function holidays(year) {
    if (cache.has(year)) return cache.get(year);
    const result = {};
    function add(month, day, name, moved = false) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const weekday = date.getUTCDay();
      if (moved && [2, 3, 4, 5].includes(weekday)) date.setUTCDate(date.getUTCDate() + (weekday <= 3 ? 1 - weekday : 8 - weekday));
      result[date.toISOString().slice(0, 10)] = name;
    }
    add(1, 1, "Año Nuevo"); add(1, 6, "Santos Reyes", true);
    add(1, 21, "Nuestra Señora de la Altagracia"); add(1, 26, "Natalicio de Juan Pablo Duarte", true);
    add(2, 27, "Independencia Nacional"); add(5, 1, "Día del Trabajo", true);
    add(8, 16, "Restauración de la República"); add(9, 24, "Nuestra Señora de las Mercedes");
    add(11, 6, "Día de la Constitución", true); add(12, 25, "Navidad");
    // Cómputo gregoriano de Pascua; Viernes Santo = -2 días, Corpus Christi = +60.
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114, month = Math.floor(n / 31), day = n % 31 + 1;
    for (const [offset, name] of [[-2, "Viernes Santo"], [60, "Corpus Christi"]]) {
      const date = new Date(Date.UTC(year, month - 1, day + offset)); result[date.toISOString().slice(0, 10)] = name;
    }
    cache.set(year, result); return result;
  }
  function closedReason(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
    return holidays(Number(date.slice(0, 4)))[date] || (new Date(date + "T12:00:00Z").getUTCDay() === 0 ? "Domingo" : "");
  }
  function slots(date, override) {
    if (!date || closedReason(date) || override?.closed) return [];
    const day = new Date(date + "T12:00:00Z").getUTCDay();
    const special = Boolean(override?.open_time && override?.close_time);
    if (day === 0 && !special) return [];
    const open = special ? minutes(override.open_time) : 540;
    const close = special ? minutes(override.close_time) : day === 6 ? 840 : 1080;
    const points = [open, ...[720, 900].filter(n => n > open && n < close), close];
    return points.slice(0, -1).map((start, i) => {
      const end = points[i + 1], label = start < 720 ? "Mañana" : start < 900 ? "Mediodía" : "Tarde";
      const range = `${clock(start)}–${clock(end)}`;
      return { label, range, value: `${label} (${range})` };
    });
  }
  return { slots, closedReason, holidays };
});

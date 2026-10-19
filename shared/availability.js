(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DentalAvailability = factory();
})(typeof window === "undefined" ? this : window, function () {
  const minutes = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const clock = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  function slots(date, override) {
    if (!date || override?.closed) return [];
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
  return { slots };
});

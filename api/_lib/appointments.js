const STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "completed",
  "cancelled",
  "no_show",
];
const STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  rejected: "Rechazada",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asistió",
};
const FIELDS = `id, created_at, updated_at, nombre, telefono, ars, servicio,
  to_char(fecha, 'YYYY-MM-DD') as fecha, horario, comentario, status, internal_note`;
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function validateAppointment(body) {
  const limits = {
    nombre: [3, 80],
    telefono: [7, 30],
    servicio: [1, 120],
    horario: [1, 80],
    ars: [0, 100],
    comentario: [0, 500],
  };
  const value = {};
  for (const [key, [min, max]] of Object.entries(limits)) {
    const text = body[key] == null ? "" : body[key];
    if (
      typeof text !== "string" ||
      text.trim().length < min ||
      text.trim().length > max
    )
      return { error: "Revisa el campo " + key + "." };
    value[key] = text.trim();
  }
  if (
    !/^[+\d\s().-]+$/.test(value.telefono) ||
    value.telefono.replace(/\D/g, "").length < 10 ||
    value.telefono.replace(/\D/g, "").length > 15
  )
    return { error: "Escribe un teléfono válido." };
  if (!validDate(body.fecha) || body.fecha < today())
    return { error: "Elige una fecha válida, de hoy en adelante." };
  value.fecha = body.fecha;
  return { value };
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports = {
  STATUSES,
  STATUS_LABELS,
  FIELDS,
  validDate,
  validateAppointment,
  UUID,
  today,
};

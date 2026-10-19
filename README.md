# DentalSpace — sitio web estático

Sitio de una página para DentalSpace (Dra. Yelissa Quezada V.), San Pedro de Macorís.
Diseño inspirado en la estructura de reodental.framer.website, adaptado a la marca del Instagram (rosado #D04972 / vino #A4305A).

## Archivos
- `index.html`: contenido y secciones
- `styles.css`: sistema visual, estados de botones y diseño adaptable (1440 / 768 / 390 px)
- `script.js`: servicios (datos editables al inicio), modal, antes/después, carrusel, FAQ y formulario de cita
- `images/`: fotos recortadas y optimizadas a partir del material entregado

La presentación no necesita build. El panel y el registro de solicitudes requieren las funciones de `api/`, Postgres y variables de entorno del servidor.

## Formulario de citas
El formulario registra la solicitud en `/api/citas` y espera la respuesta antes de indicar que quedó registrada. Si falla el guardado, avisa que todavía no aparece en el panel y ofrece WhatsApp al (829) 650-7713. La clínica confirma la fecha y franja disponibles.

La disponibilidad del panel se consulta sin caché. El formulario bloquea cierres y ajusta sus franjas a las horas especiales de cada fecha (domingos y feriados nacionales dominicanos siempre cerrados); los sábados terminan a las 14:00. La API vuelve a validar los horarios especiales al guardar, para rechazar una franja que cambió mientras el formulario estaba abierto. Las excepciones no cambian los textos del horario semanal habitual ni cancelan citas existentes.

## Panel administrativo

Referencia visual: WebFact1. HTML, CSS y JavaScript sin framework; backend de Vercel Functions con `pg` y Neon. El sitio público no se rediseña.

- Resumen: pendientes, agenda de hoy, próximos 7 días, contactos y cierres próximos.
- Agenda diaria/semanal; franjas preferidas, sin inventar cupos ni duraciones por servicio.
- Solicitudes: búsqueda, filtros por estado, servicio y fechas, paginación de 12 filas, alta manual, confirmación, rechazo, atención completada, cancelación y ausencia.
- Detalle: reprogramación, nota administrativa interna, acceso a WhatsApp y actividad persistente. No envía mensajes automáticamente.
- Contactos agrupados por teléfono con historial de solicitudes; no es un expediente clínico. Un teléfono compartido puede agrupar varias personas.
- Disponibilidad: calendario mensual, cierres, notas públicas y horarios excepcionales; restablecer el horario habitual elimina la excepción. Cerrar no cancela citas existentes.
- Reportes por periodo y servicio. CSV de la vista filtrada: excluye notas y comentarios; neutraliza fórmulas de hoja de cálculo.
- Consultas privadas con `no-store`, cookie HttpOnly de 8 horas, validación del origen en escrituras autenticadas, 6 intentos de login por IP en 15 minutos (persistentes en Postgres).

El listado devuelve hasta 5,000 solicitudes recientes; si se alcanza el límite, se avisa y los reportes corresponden a ese conjunto. Los datos de contactos no se guardan en localStorage.

### Datos y compatibilidad

La migración es aditiva: `internal_note`, `updated_at`, `appointment_activity` y `admin_login_attempts`. Mantiene `appointments`, `schedule_overrides` y los contratos públicos. Cita e historial se guardan en una transacción; un lote inválido de horarios no guarda parcialmente. El historial no reconstruye cambios anteriores a esta versión.

### Verificación local

`npm ci` y `npm test` ejecutan pruebas de API e interfaz contra Postgres embebido (PGlite), sin Neon ni datos reales. `npm run dev:preview` abre `http://127.0.0.1:4381/admin/` con datos ficticios y la contraseña de demostración `DentalSpace-demo-2026`. Esta contraseña solo existe en el servidor local de prueba, no en producción. La base de prueba vive en memoria y se reinicia al apagar el servidor. `.vercelignore` excluye las herramientas de prueba del despliegue.

Para cada publicación: ejecutar las pruebas, desplegar de forma explícita y repetir la verificación con la sesión real y Neon. Esta versión no añade facturación, expedientes clínicos, recordatorios automáticos ni usuarios con distintos permisos.

## Pendiente de confirmar con la clínica
- Número de WhatsApp vigente (hoy se usa el (829) 650-7713)
- Lista actual de ARS (tomada de una publicación de 2022)
- Autorización escrita de los pacientes que aparecen en los casos antes/después
- Especialidad de la doctora: el perfil dice “General Dentist” y el uniforme dice “Ortodoncia”
- Si ofrecen ortodoncia (marcado [POR CONFIRMAR] en el detalle de Ortopedia maxilar)
- Foto y credenciales del Dr. Jeffry Francisco Campusano
- Enlace de Instagram (`[URL DE INSTAGRAM]` en el footer)
- Testimonios reales con autorización (hoy son placeholders)

Los feriados se calculan con las reglas de traslado de la Ley 139-97 y las fechas religiosas móviles. Referencia oficial 2026: https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026 . Los cierres extraordinarios adicionales se registran en Disponibilidad.

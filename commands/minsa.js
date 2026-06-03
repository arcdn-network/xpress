const { generateVoucher } = require('../services/minsa');

const COOLDOWN_MS = 10000;
const cooldowns = new Map();
const enProceso = new Set();
const MAX_DIAS = 20;

const RENIEC_URL = 'https://api.azuraperu.app/servicios/reniec_free';
const RENIEC_TOKEN = '0CeQ9Cm0KXqIKiavpy9BpGX6joSJucFjPNqUit2q';

const MSG_HORARIO = '🕙 *El servicio de descanso médico está disponible de 8:00 a.m. a 10:00 p.m.*';
const MSG_USO = `❌ *Formato incorrecto*\n\nUsos válidos del comando /minsa:\n1\\) \`/minsa DNI|CONTINGENCIA|DIAS\`\n   • Autocompleta nombre por DNI\n   • Máximo: ${MAX_DIAS} días\n2\\) \`/minsa DNI|CONTINGENCIA|FECHA|DIAS\`\n   • FECHA en formato: DD\\-MM\\-YYYY\n   • Máximo: ${MAX_DIAS} días\n3\\) \`/minsa DNI|CONTINGENCIA|DIAS|HOSPITAL\`\n   • Hospital opcional \\(si no, se autocompleta con el predeterminado\\)\n   • Máximo: ${MAX_DIAS} días\n4\\) \`/minsa DNI|CONTINGENCIA|FECHA|DIAS|HOSPITAL\`\n   • Formato completo con fecha personalizada \\+ hospital\n   • Máximo: ${MAX_DIAS} días\n\nEjemplo válido:\n\`/minsa 74589632|COVID|5\`\n→ El bot consultará el DNI, autocompletará el nombre y generará el descanso\\.\n\nEjemplo completo:\n\`/minsa 74589632|ACCIDENTE|28\\-11\\-2025|7|HOSPITAL ARZOBISPO LOAYZA\``;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isDentroDeHorario() {
  const hora = new Date().getHours();
  return hora >= 8 && hora < 22;
}

function isCooldown(userId) {
  if (!cooldowns.has(userId)) return false;
  return Date.now() - cooldowns.get(userId) < COOLDOWN_MS;
}

function setCooldown(userId) {
  cooldowns.set(userId, Date.now());
}

function escapeMd(text) {
  return String(text).replace(/[_*`\[\]()~>#+=|{}.!-]/g, '\\$&');
}

function formatFechaFilename() {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear().toString().slice(-2);
  return `${d}${m}${y}`;
}

function isValidFecha(str) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(str)) return false;
  const [dd, mm, yyyy] = str.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

function isFechaArg(str) {
  return /^\d{2}-\d{2}-\d{4}$/.test(str);
}

// ─── Limpiar cooldowns viejos ─────────────────────────────────────────────────
setInterval(() => {
  const ahora = Date.now();
  for (const [userId, timestamp] of cooldowns.entries()) {
    if (ahora - timestamp > COOLDOWN_MS) cooldowns.delete(userId);
  }
}, 60_000);

// ─── Consulta RENIEC ──────────────────────────────────────────────────────────
async function consultarNombrePorDNI(dni) {
  try {
    const res = await fetch(RENIEC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': RENIEC_TOKEN,
      },
      body: JSON.stringify({ documento: dni }),
    });

    if (!res.ok) return null;

    const data = await res.json();

    if (data?.status !== 'success' || !data?.listaAni) return null;

    const { apellido_paterno, apellido_materno, nombres } = data.listaAni;

    return [apellido_paterno, apellido_materno, nombres].filter(Boolean).join(' ').toUpperCase();
  } catch (err) {
    console.error('[RENIEC] Error:', err.message);
    return null;
  }
}

// ─── Parser de argumentos ─────────────────────────────────────────────────────
function parseArgs(input) {
  const parts = input.split('|').map((p) => p.trim());

  if (parts.length < 3 || parts.length > 5) return null;

  const [dni, contingencia, ...rest] = parts;

  if (!dni || !/^\d{8}$/.test(dni)) return null;
  if (!contingencia || contingencia.trim().length < 2) return null;

  let fecha = undefined;
  let dias = undefined;
  let hospital = undefined;

  if (rest.length === 1) {
    dias = parseInt(rest[0], 10);
  } else if (rest.length === 2) {
    if (isFechaArg(rest[0])) {
      fecha = rest[0];
      dias = parseInt(rest[1], 10);
    } else {
      dias = parseInt(rest[0], 10);
      hospital = rest[1];
    }
  } else if (rest.length === 3) {
    fecha = rest[0];
    dias = parseInt(rest[1], 10);
    hospital = rest[2];
  }

  if (!dias || isNaN(dias) || dias < 1 || dias > MAX_DIAS) return null;
  if (fecha && !isValidFecha(fecha)) return null;

  return { dni, contingencia, dias, fecha, hospital };
}

// ─── Handler principal ────────────────────────────────────────────────────────
function registerMinsaCommand(bot) {
  bot.onText(/\/minsa(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1].trim();

    const replyOpts = {
      parse_mode: 'MarkdownV2',
      reply_to_message_id: msg.message_id,
    };

    if (msg.chat.type !== 'private') {
      return bot.sendMessage(chatId, '❌ Este comando solo está disponible en chat privado\\.', replyOpts);
    }

    if (!input) return bot.sendMessage(chatId, MSG_USO, replyOpts);

    const parsed = parseArgs(input);
    if (!parsed) return bot.sendMessage(chatId, MSG_USO, replyOpts);

    if (enProceso.has(userId)) {
      return bot.sendMessage(chatId, '⏳ Ya tienes un descanso generándose, espere un momento\\.', replyOpts);
    }

    if (isCooldown(userId)) {
      const restante = Math.ceil((COOLDOWN_MS - (Date.now() - cooldowns.get(userId))) / 1000);
      return bot.sendMessage(chatId, `⏳ Espera *${restante} segundos* antes de generar otro descanso\\.`, replyOpts);
    }

    if (!isDentroDeHorario()) {
      return bot.sendMessage(chatId, MSG_HORARIO, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
    }

    enProceso.add(userId);
    const loading = await bot.sendMessage(chatId, '⏳ Consultando DNI y generando CITT\\.\\.\\.', replyOpts);

    try {
      const nombre = await consultarNombrePorDNI(parsed.dni);

      if (!nombre) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        enProceso.delete(userId);
        return bot.sendMessage(
          chatId,
          `❌ No se encontró información para el DNI *${escapeMd(parsed.dni)}*\\.\nVerifica el número e intenta de nuevo\\.`,
          replyOpts,
        );
      }

      const base64 = await generateVoucher({
        nombre,
        dni: parsed.dni,
        contingencia: parsed.contingencia.trim().toUpperCase(),
        dias: parsed.dias,
        fecha: parsed.fecha ?? undefined,
        hospital: parsed.hospital?.trim() ?? undefined,
      });

      const buffer = Buffer.from(base64, 'base64');
      setCooldown(userId);
      await bot.deleteMessage(chatId, loading.message_id);

      await bot.sendDocument(
        chatId,
        buffer,
        {
          reply_to_message_id: msg.message_id,
          caption: [
            `✅ *CITT MINSA generado*`,
            ``,
            `👤 *Asegurado:* ${escapeMd(nombre)}`,
            `🪪 *DNI:* ${escapeMd(parsed.dni)}`,
            `🏥 *Contingencia:* ${escapeMd(parsed.contingencia)}`,
            `📅 *Días de descanso:* ${parsed.dias}`,
            ...(parsed.fecha ? [`📆 *Inicio:* ${escapeMd(parsed.fecha)}`] : []),
            ...(parsed.hospital ? [`🏨 *Hospital:* ${escapeMd(parsed.hospital)}`] : []),
          ].join('\n'),
          parse_mode: 'MarkdownV2',
        },
        { filename: `CITT_${formatFechaFilename()}.pdf`, contentType: 'application/pdf' },
      );
    } catch (error) {
      console.error('/minsa error:', error.message);
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      await bot.sendMessage(chatId, '❌ Error al generar el CITT\\.', replyOpts);
    } finally {
      enProceso.delete(userId);
    }
  });
}

module.exports = registerMinsaCommand;

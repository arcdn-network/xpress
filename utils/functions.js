function formatDate(date) {
  if (!date) return '';

  const fecha = new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return `${fecha}`;
}

function formatDateTime(date) {
  if (!date) return '';

  const fecha = new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const hora = new Date(date).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${fecha} ${hora}`;
}

module.exports = { formatDate, formatDateTime };

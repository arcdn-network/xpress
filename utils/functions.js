function formatDate(date) {
  if (!date) return '';

  const fecha = new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return `${fecha}`;
}

module.exports = { formatDate };

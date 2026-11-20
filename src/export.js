function csvCell(value) {
  if (typeof value !== 'string') return String(value);
  const safe = /^[\s\uFEFF]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function ordersCsv(config, run) {
  const rows = [[
    'pedido', 'tamanho', 'chegada_s', 'entrega_s', 'total_s',
    'dentro_da_meta', 'etapa', 'entrada_etapa_s', 'inicio_etapa_s', 'fim_etapa_s', 'espera_etapa_s',
  ]];
  const names = new Map(config.stages.map(({ id, name }) => [id, name]));
  for (const order of run.orders) {
    const total = order.completed - order.time;
    for (const visit of order.visits) {
      rows.push([
        order.id, order.size, order.time, order.completed, total, total <= config.target * 60 ? 'sim' : 'não',
        names.get(visit.stageId), visit.enter, visit.start, visit.end, visit.start - visit.enter,
      ]);
    }
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function downloadOrders(config, run) {
  const url = URL.createObjectURL(new Blob([ordersCsv(config, run)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `hora-do-pico-${config.id}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

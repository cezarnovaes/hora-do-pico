import { LIMITS, POLICIES, PRESETS, PROFILES } from './scenarios.js';
import {
  displayClock, displayDecimal, displayDuration, displayInteger, displayPercent, displayPrecisePercent, escapeHtml, icon, stageIcon,
} from './format.js';

export function layout() {
  return `
    <a href="#conteudo" class="skip-link">Pular para o conteúdo</a>
    <header class="topbar">
      <div class="topbar-inner wrap">
        <a class="brand" href="#simulacao"><span class="brand-icon">${icon('Activity', 21)}</span>Hora do Pico</a>
        <nav class="main-nav" aria-label="Navegação principal">
          <a href="#simulacao" data-route="simulation">${icon('Activity', 17)}<span>Simulação</span></a>
          <a href="#comparar" data-route="comparison">${icon('GitCompareArrows', 17)}<span>Comparar</span></a>
        </nav>
        <button type="button" class="button button-help" data-action="help">${icon('CircleHelp', 19)}<span>Como usar</span></button>
      </div>
    </header>
    <main id="conteudo" class="wrap page" tabindex="-1"></main>
    <div class="sr-only" role="status" id="announcement"></div>
    <dialog id="guide" aria-labelledby="guide-title">
      <div class="dialog-head">
        <h2 id="guide-title">Como usar</h2>
        <form method="dialog"><button class="icon-button soft" aria-label="Fechar guia">${icon('X', 21)}</button></form>
      </div>
      <ol class="guide-steps">
        <li><strong>Veja a operação em movimento.</strong><span>Inicie a simulação ou arraste a linha do tempo. Cada cartão mostra a fila e as pessoas atendendo naquela etapa.</span></li>
        <li><strong>Encontre onde a fila se forma.</strong><span>O resumo considera o turno completo. O tempo médio e o P90 medem da chegada até a entrega. O P90 é o tempo dentro do qual 90% dos pedidos foram concluídos.</span></li>
        <li><strong>Teste uma mudança.</strong><span>Fixe a referência, volte à simulação e ajuste a capacidade ou a ordem dos pedidos. Preserve a configuração da demanda e a meta para comparar com os mesmos pedidos.</span></li>
      </ol>
      <p class="guide-note">Os pedidos são simulados. Na velocidade 1×, um segundo real avança um minuto de operação.</p>
    </dialog>`;
}

function selectOptions(entries, selected) {
  return entries.map(([value, text]) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('');
}

function intro(config, comparison = false) {
  return `
    <div class="intro">
      <div>
        <div class="eyebrow"><span></span> SIMULADOR DE FILAS</div>
        <h1>${comparison ? 'Comparar cenários' : escapeHtml(config.name)}</h1>
        <p>${comparison ? 'Veja o efeito de uma mudança no tempo de atendimento e nas filas.' : escapeHtml(config.description)}</p>
      </div>
      ${comparison ? `<a class="button secondary" href="#simulacao">${icon('Activity', 17)} Voltar à simulação</a>` : `
        <div class="intro-tools"><label class="preset-field">
          <span>Cenário de demonstração</span>
          <span class="select-shell preset-select">${icon('Coffee', 18)}
            <select id="preset" aria-label="Cenário de demonstração">${selectOptions(PRESETS.map(({ id, name }) => [id, name]), config.id)}</select>
            ${icon('ChevronDown', 16)}
          </span>
        </label>
        <button type="button" class="button secondary mobile-edit" data-action="edit">${icon('Settings2', 17)} Configurar</button></div>`}
    </div>`;
}

function operation(config, run, speed) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `
    <section class="operation" aria-labelledby="operation-title">
      <div class="operation-head">
        <div><p class="operation-kicker"><span></span> FLUXO DE PEDIDOS</p><h2 id="operation-title">Operação ao vivo</h2></div>
        <div class="operation-counts" aria-label="Contadores da operação">
          <span><strong id="arrivals">0</strong><small>Chegadas</small></span>
          <span><strong id="completed">0</strong><small>Entregas</small></span>
        </div>
      </div>
      <ol class="station-flow" aria-label="Etapas da operação">
        ${config.stages.map((stage, index) => `
          <li class="station" data-station="${index}">
            <div class="station-header">
              <span class="station-icon ${stage.icon}">${icon(stageIcon[stage.icon], 20)}</span>
              <div><h3>${escapeHtml(stage.name)}</h3><p>${plural(stage.workers, 'pessoa')}</p></div>
            </div>
            <div class="station-queue"><span>Na fila</span><strong data-waiting>0</strong></div>
            <div class="ticket-row" data-tickets aria-hidden="true"></div>
            <div class="station-active" data-active></div>
          </li>`).join('')}
      </ol>
      <div class="transport">
        <div class="transport-buttons">
          <button type="button" class="button play-button" data-action="play">${icon('Play', 17)} Iniciar</button>
          <button type="button" class="icon-button dark-button" aria-label="Reiniciar simulação" title="Reiniciar simulação" data-action="reset">${icon('RotateCcw', 17)}</button>
          <button type="button" class="icon-button dark-button" aria-label="Ir ao fim do turno" title="Ir ao fim do turno" data-action="end">${icon('SkipForward', 18)}</button>
        </div>
        <div class="transport-timeline">
          <div class="timeline-label"><span id="playback-state">Pronta para iniciar</span><span class="timeline-time"><strong id="time">${displayClock(0)}</strong> / ${displayClock(run.end)}</span></div>
          <input type="range" id="timeline" aria-label="Linha do tempo" min="0" max="${run.end}" step="1" value="0" />
        </div>
        <label class="select-shell speed-select">
          <span class="sr-only">Velocidade da simulação</span>
          <select id="speed">${selectOptions([['1', '1×'], ['2', '2×'], ['4', '4×'], ['8', '8×']], String(speed))}</select>
          ${icon('ChevronDown', 13)}
        </label>
      </div>
    </section>`;
}

function summary(config, run) {
  const { stats } = run;
  const items = [
    ['Clock3', 'Tempo médio', displayDuration(stats.meanTime), 'Da chegada à entrega', 'peach'],
    ['Timer', 'Tempo P90', displayDuration(stats.p90), '90% dos pedidos até esse tempo', 'lavender'],
    ['ListOrdered', 'Fila máxima', displayInteger(stats.maxQueue), 'Pedidos esperando ao mesmo tempo', 'sand'],
    ['Target', 'Dentro da meta', displayPercent(stats.targetRate), `Entregues em até ${config.target} min`, 'mint'],
  ];
  return `
    <section class="summary" aria-labelledby="summary-title">
      <div class="section-head summary-head">
        <div><h2 id="summary-title">Resumo do turno</h2><p>${stats.count} ${stats.count === 1 ? 'pedido simulado' : 'pedidos simulados'}${stats.overtime ? ` · ${displayDuration(stats.overtime)} após o fechamento` : ''}</p></div>
        <button type="button" class="button secondary compact" data-action="download">${icon('Download', 16)} Exportar CSV</button>
      </div>
      <div class="kpi-grid">
        ${items.map(([symbol, title, value, caption, style]) => `
          <div class="kpi"><div class="kpi-top"><span class="kpi-icon ${style}">${icon(symbol, 17)}</span><h3>${title}</h3></div>
            <strong>${value}</strong><p>${caption}</p>
          </div>`).join('')}
      </div>
    </section>`;
}

function trajectory(run) {
  const worst = run.stats.bottleneck;
  return `
    <section class="panel chart-panel" aria-labelledby="chart-title">
      <div class="section-head">
        <div><h2 id="chart-title">Fila ao longo do turno</h2><p>Pedidos aguardando em todas as etapas</p></div>
        <div class="chart-legend"><span></span> Total na fila</div>
      </div>
      <div class="chart-shell">
        <canvas id="queue-chart" aria-hidden="true"></canvas>
        <div class="chart-tooltip" id="chart-tooltip" hidden></div>
      </div>
      <p class="chart-readout" id="chart-readout"></p>
      <div class="insight">
        <span class="insight-icon">${icon('Activity', 19)}</span>
        <div><strong>${worst ? `Maior espera em ${escapeHtml(worst.name)}` : 'Nenhuma fila registrada'}</strong>
        <p>${worst ? `A espera média nessa etapa foi de ${displayDuration(worst.meanWait)}.` : 'Nenhum pedido precisou esperar por atendimento nas etapas simuladas.'}</p></div>
      </div>
      <details class="stage-results">
        <summary>Ver desempenho por etapa ${icon('ChevronDown', 17)}</summary>
        <div class="table-wrapper" tabindex="0" role="region" aria-label="Desempenho por etapa">
          <table><thead><tr><th scope="col">Etapa</th><th scope="col">Espera média</th><th scope="col">Espera máxima</th><th scope="col">Ocupação</th></tr></thead>
          <tbody>${run.stats.stages.map((stage) => `<tr><th scope="row">${escapeHtml(stage.name)}</th><td>${displayDuration(stage.meanWait)}</td><td>${displayDuration(stage.maxWait)}</td><td>${displayPercent(stage.occupancy)}</td></tr>`).join('')}</tbody></table>
        </div>
      </details>
    </section>`;
}

const values = (value) => Number.isFinite(value) ? value : '';

function numberField(key, label, value, suffix, extra = '') {
  const [min, max] = LIMITS[key];
  return `
    <label class="field">${label}
      <span class="input-shell"><input type="number" data-field="${key}" value="${values(value)}" min="${min}" max="${max}" required ${extra} />${suffix ? `<span aria-hidden="true">${suffix}</span>` : ''}</span>
    </label>`;
}

export function stageEditor(stages) {
  return stages.map((stage, index) => `
    <div class="edit-stage" data-edit-stage="${index}">
      <div class="edit-stage-head">
        <span draggable="true" class="stage-grip" title="Arrastar para reordenar" aria-hidden="true">${icon('GripVertical', 17)}</span>
        <label class="stage-name"><span class="sr-only">Nome da etapa ${index + 1}</span><input type="text" data-field="name" value="${escapeHtml(stage.name)}" maxlength="28" required /></label>
        <button type="button" class="mini-button" data-action="up" ${index === 0 ? 'disabled' : ''} aria-label="Subir etapa ${index + 1}" title="Subir etapa">${icon('ArrowUp', 14)}</button>
        <button type="button" class="mini-button" data-action="down" ${index === stages.length - 1 ? 'disabled' : ''} aria-label="Descer etapa ${index + 1}" title="Descer etapa">${icon('ArrowDown', 14)}</button>
        <button type="button" class="mini-button delete-stage" data-action="remove" ${stages.length === LIMITS.stages[0] ? 'disabled' : ''} aria-label="Remover etapa ${index + 1}" title="Remover etapa">${icon('Trash2', 14)}</button>
      </div>
      <div class="form-grid">
        ${numberField('workers', 'Pessoas', stage.workers, '', `aria-label="Pessoas na etapa ${index + 1}"`)}
        ${numberField('service', 'Tempo base', stage.service, 's', `aria-label="Tempo base em segundos na etapa ${index + 1}"`)}
      </div>
    </div>`).join('');
}

function editor(draft, advanced) {
  return `
    <aside class="panel editor" aria-labelledby="editor-title" tabindex="-1">
      <div class="editor-head"><span class="editor-icon">${icon('Settings2', 21)}</span><div><h2 id="editor-title">Configurar operação</h2><p>Ajuste a demanda e a capacidade.</p></div></div>
      <form id="scenario-form">
        <fieldset class="settings-group">
          <legend>Demanda</legend>
          <div class="form-grid">
            ${numberField('duration', 'Duração do turno', draft.duration, 'min', 'aria-label="Duração do turno em minutos"')}
            ${numberField('demand', 'Pedidos por hora', draft.demand, '/h')}
          </div>
          <label class="field field-spaced">Perfil de chegadas<span class="select-shell form-select"><select data-field="profile">${selectOptions(Object.entries(PROFILES), draft.profile)}</select>${icon('ChevronDown', 15)}</span></label>
          <details id="advanced"${advanced ? ' open' : ''}>
            <summary>Mais parâmetros ${icon('ChevronDown', 16)}</summary>
            <div class="form-grid">
              ${numberField('target', 'Meta de entrega', draft.target, 'min', 'aria-label="Meta de entrega em minutos"')}
              ${numberField('seed', 'Semente', draft.seed, '')}
            </div>
            <label class="field field-spaced">Disciplina da fila<span class="select-shell form-select"><select data-field="policy">${selectOptions(Object.entries(POLICIES), draft.policy)}</select>${icon('ChevronDown', 15)}</span></label>
            <p class="form-hint">Mantenha a mesma semente e demanda para repetir as chegadas.</p>
          </details>
        </fieldset>
        <fieldset class="settings-group stages-group">
          <legend>Etapas do fluxo</legend>
          <div id="stage-editor">${stageEditor(draft.stages)}</div>
          <button type="button" class="button add-stage" data-action="add" ${draft.stages.length >= LIMITS.stages[1] ? 'disabled' : ''}>${icon('Plus', 17)} Adicionar etapa</button>
        </fieldset>
        <div class="editor-footer">
          <p id="draft-status" role="status">Operação atualizada</p>
          <button class="button primary" id="apply" type="submit" disabled>${icon('Check', 18)} Aplicar mudanças</button>
        </div>
      </form>
    </aside>`;
}

export function simulationView(config, draft, run, speed, advanced) {
  return `${intro(config)}
    <div class="workspace">
      <div class="left-column">
        ${operation(config, run, speed)}
        ${summary(config, run)}
        ${trajectory(run)}
      </div>
      ${editor(draft, advanced)}
    </div>`;
}

function scenarioCard(config, stats, isReference) {
  const totalWorkers = config.stages.reduce((total, stage) => total + stage.workers, 0);
  return `
    <section class="panel compare-card ${isReference ? 'reference-card' : 'current-card'}">
      <div class="eyebrow"><span></span> ${isReference ? 'REFERÊNCIA FIXADA' : 'CENÁRIO ATUAL'}</div>
      <h2>${escapeHtml(config.name)}</h2>
      <p>${stats.count} pedidos · ${config.duration} min de chegadas · ${totalWorkers} ${totalWorkers === 1 ? 'pessoa' : 'pessoas'}</p>
      <p class="stage-line">${config.stages.map((stage) => `<span>${escapeHtml(stage.name)} <strong>${stage.workers}</strong></span>`).join('')}</p>
    </section>`;
}

function delta(previous, current, kind, comparable) {
  if (!comparable || previous === null || current === null) return '<span class="delta neutral">—</span>';
  if (Math.abs(current - previous) < 0.0001) return '<span class="delta neutral">Estável</span>';
  const diff = current - previous;
  const improved = kind === 'rate' ? diff > 0 : diff < 0;
  let value;
  if (kind === 'duration') {
    if (Math.abs(diff) < 0.5) return '<span class="delta neutral">&lt; 1s</span>';
    value = displayDuration(Math.abs(diff));
  } else if (kind === 'rate') {
    value = `${displayDecimal(Math.abs(diff) * 100)} p.p.`;
  } else {
    value = displayInteger(Math.abs(diff));
  }
  return `<span class="delta ${improved ? 'better' : 'worse'}">${diff > 0 ? '+' : '−'}${value}</span>`;
}

export function comparisonView(config, run, reference, referenceRun, comparable, dirty) {
  const sameSetup = reference && JSON.stringify(reference) === JSON.stringify(config);
  const rows = [
    ['Tempo médio', 'meanTime', 'duration', displayDuration],
    ['Tempo P90', 'p90', 'duration', displayDuration],
    ['Fila máxima', 'maxQueue', 'count', displayInteger],
    ['Dentro da meta', 'targetRate', 'rate', displayPrecisePercent],
    ['Tempo após fechamento', 'overtime', 'duration', displayDuration],
  ];
  return `${intro(config, true)}
    ${dirty ? `<p class="compare-notice unmatched draft-notice">${icon('CircleHelp', 18)} Há mudanças pendentes no editor. A comparação usa as configurações aplicadas.</p>` : ''}
    <div class="comparison-grid">
      ${reference ? scenarioCard(reference, referenceRun.stats, true) : `
        <section class="panel compare-card reference-card empty-reference">
          <span class="editor-icon">${icon('Pin', 22)}</span>
          <h2>Fixe uma referência</h2><p>Use o turno atual como ponto de partida para medir as próximas mudanças.</p>
          <button class="button primary" type="button" data-action="pin">${icon('Pin', 17)} Fixar cenário atual</button>
        </section>`}
      ${scenarioCard(config, run.stats, false)}
    </div>
    ${reference ? `
      <section class="panel compare-results" aria-labelledby="compare-title">
        <div class="section-head">
          <div><h2 id="compare-title">Efeito da mudança</h2><p>Resultados do turno completo, até a última entrega.</p></div>
          <button type="button" class="button secondary compact" data-action="replace" ${sameSetup ? 'disabled' : ''}>${icon('Pin', 16)} Atualizar referência</button>
        </div>
        <p class="compare-notice ${comparable ? 'matched' : 'unmatched'}">${icon(comparable ? 'Check' : 'CircleHelp', 18)}
          ${comparable ? (sameSetup ? 'Referência fixada. Aplique uma mudança na operação para medir seu efeito.' : 'Comparação pareada com os mesmos pedidos, duração e meta.') : 'A demanda, a duração ou a meta mudou. Restaure os parâmetros da referência para calcular as diferenças.'}</p>
        <div class="table-wrapper" tabindex="0" role="region" aria-label="Indicadores da comparação">
          <table><thead><tr><th scope="col">Indicador</th><th scope="col">Referência</th><th scope="col">Atual</th><th scope="col">Diferença</th></tr></thead>
          <tbody>${rows.map(([label, key, kind, format]) => `<tr><th scope="row">${label}</th><td>${format(referenceRun.stats[key])}</td><td>${format(run.stats[key])}</td><td>${delta(referenceRun.stats[key], run.stats[key], kind, comparable)}</td></tr>`).join('')}</tbody></table>
        </div>
        ${comparable && !sameSetup ? comparisonChart(Math.max(run.end, referenceRun.end)) : ''}
        <div class="compare-footer">
          <a class="button secondary" href="#simulacao">${icon('Settings2', 17)} Ajustar operação</a>
          ${!comparable ? `<button type="button" class="button secondary" data-action="restore-inputs">${icon('RotateCcw', 17)} Restaurar parâmetros da referência</button>` : ''}
          <button type="button" class="button text-button" data-action="unpin">${icon('Trash2', 16)} Limpar referência</button>
        </div>
      </section>` : ''}
    <dialog id="replace-dialog" aria-labelledby="replace-title">
      <div class="dialog-head"><h2 id="replace-title">Atualizar a referência?</h2><form method="dialog"><button class="icon-button soft" aria-label="Cancelar">${icon('X', 20)}</button></form></div>
      <p>O cenário atual passa a ser o ponto de partida da comparação.</p>
      <button type="button" class="button primary" data-action="pin">${icon('Pin', 17)} Confirmar atualização</button>
    </dialog>`;
}

function comparisonChart(end) {
  return `<section class="compare-chart" aria-labelledby="compare-chart-title">
    <div class="section-head">
      <div><h3 id="compare-chart-title">Fila ao longo do turno</h3><p>Pedidos aguardando em todas as etapas</p></div>
      <div class="series-legend"><div class="chart-legend reference-legend"><span></span> Referência</div><div class="chart-legend"><span></span> Atual</div></div>
    </div>
    <div class="chart-shell">
      <canvas id="compare-chart" aria-hidden="true"></canvas>
      <div class="chart-tooltip" id="compare-tooltip" hidden></div>
    </div>
    <label class="compare-scrub">
      <span id="compare-timeline-label">Instante do turno</span><input type="range" id="compare-timeline" aria-labelledby="compare-timeline-label" min="0" max="${end}" step="1" value="0" />
      <span class="compare-readout" id="compare-readout"></span>
    </label>
  </section>`;
}

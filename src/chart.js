import { displayClock } from './format.js';
import { frameAt } from './simulation.js';

export function queueChart(canvas, tooltip, run, reference = null) {
  const context = canvas.getContext('2d');
  const end = Math.max(run.end, reference?.end ?? 0);
  let cursor = 0;
  let geometry;
  let hover = null;

  function paint() {
    if (!context) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const left = 34;
    const right = width - 15;
    const top = 12;
    const bottom = height - 27;
    const spacing = Math.max(1, Math.ceil(Math.max(run.stats.maxQueue, reference?.stats.maxQueue ?? 0) / 4));
    const maxQueue = spacing * 4;
    const x = (time) => left + (right - left) * time / end;
    const y = (queue) => bottom - (bottom - top) * queue / maxQueue;
    geometry = { left, right, x };

    context.font = '12px "Manrope Variable", sans-serif';
    context.lineWidth = 1;
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillStyle = '#62675c';
    context.strokeStyle = '#e5e6dd';
    for (let queue = 0; queue <= maxQueue; queue += spacing) {
      const ordinate = y(queue);
      context.beginPath();
      context.moveTo(left, ordinate);
      context.lineTo(right, ordinate);
      context.stroke();
      context.fillText(String(queue), left - 10, ordinate);
    }
    context.textBaseline = 'top';
    const ticks = width < 400 ? 3 : 4;
    for (let i = 0; i <= ticks; i++) {
      const tick = Math.round(end * i / ticks);
      context.textAlign = i === ticks ? 'right' : (i === 0 ? 'left' : 'center');
      context.fillText(displayClock(tick), x(tick), bottom + 9);
    }

    function trace(tape) {
      let count = 0;
      context.beginPath();
      context.moveTo(left, y(count));
      for (const frame of tape.frames) {
        context.lineTo(x(frame.time), y(count));
        count = frame.queue;
        context.lineTo(x(frame.time), y(count));
      }
      context.lineTo(right, y(count));
    }

    const gradient = context.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, 'rgba(219, 81, 37, 0.27)');
    gradient.addColorStop(1, 'rgba(242, 118, 72, 0.04)');
    trace(run);
    context.lineTo(right, bottom);
    context.lineTo(left, bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    if (reference) {
      trace(reference);
      context.strokeStyle = '#536851';
      context.lineWidth = 2;
      context.setLineDash([5, 4]);
      context.stroke();
      context.setLineDash([]);
    }
    trace(run);
    context.strokeStyle = '#c74c28';
    context.lineWidth = 2;
    context.stroke();

    if (run.close < end) {
      context.setLineDash([3, 5]);
      marker(run.close, '#70766a', 1);
      context.setLineDash([]);
    }
    marker(hover ?? cursor, '#26332b', 1);
    const point = frameAt(run.frames, hover ?? cursor);
    context.beginPath();
    context.arc(x(hover ?? cursor), y(point.queue), 4, 0, 2 * Math.PI);
    context.fillStyle = '#26332b';
    context.fill();

    function marker(time, color, weight) {
      context.beginPath();
      context.moveTo(x(time), top);
      context.lineTo(x(time), bottom);
      context.strokeStyle = color;
      context.lineWidth = weight;
      context.stroke();
    }
  }

  function inspect(event) {
    if (!geometry) return;
    const { left, right, x } = geometry;
    const position = event.clientX - canvas.getBoundingClientRect().left;
    hover = Math.round(Math.max(0, Math.min(1, (position - left) / (right - left))) * end);
    const count = frameAt(run.frames, hover).queue;
    const before = reference ? frameAt(reference.frames, hover).queue : null;
    tooltip.textContent = reference ? `${displayClock(hover)} · Referência ${before} · Atual ${count}` : `${displayClock(hover)} · ${count} na fila`;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.min(canvas.clientWidth - tooltip.offsetWidth, Math.max(0, x(hover) + 10))}px`;
    paint();
  }

  canvas.addEventListener('pointermove', inspect);
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    tooltip.hidden = true;
    paint();
  });
  const observer = new ResizeObserver(paint);
  observer.observe(canvas);
  return {
    draw(time) {
      cursor = time;
      paint();
    },
    dispose() {
      observer.disconnect();
    },
  };
}

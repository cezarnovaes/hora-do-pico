import { createElement, Activity, ArrowDown, ArrowUp, BarChart3, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Coffee, Download, Flag, GitCompareArrows, GripVertical, ListOrdered, Package,
  Pause, Pin, Play, Plus, RotateCcw, Settings2, SkipForward, Store, Target, Timer, Trash2, Users,
  Utensils, X } from 'lucide';

const icons = {
  Activity, ArrowDown, ArrowUp, BarChart3, Check, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Coffee, Download, Flag, GitCompareArrows, GripVertical, ListOrdered, Package, Pause, Pin, Play,
  Plus, RotateCcw, Settings2, SkipForward, Store, Target, Timer, Trash2, Users, Utensils, X,
};

const iconMarkup = new Map();
export function icon(name, size = 18) {
  const key = `${name}-${size}`;
  if (!iconMarkup.has(key)) {
    iconMarkup.set(key, createElement(icons[name], {
      width: size, height: size, 'aria-hidden': 'true', focusable: 'false', 'stroke-width': '1.8',
    }).outerHTML);
  }
  return iconMarkup.get(key);
}

export const stageIcon = { register: 'Store', kitchen: 'Utensils', pickup: 'Coffee', package: 'Package' };

export function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

const integer = new Intl.NumberFormat('pt-BR');
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const precisePercent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export const displayInteger = (value) => value === null ? '—' : integer.format(value);
export const displayPercent = (value) => value === null ? '—' : percent.format(value);
export const displayPrecisePercent = (value) => value === null ? '—' : precisePercent.format(value);
export const displayDecimal = (value) => decimal.format(value);

export function displayDuration(seconds) {
  if (seconds === null) return '—';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return minutes ? `${minutes}min ${remaining.toString().padStart(2, '0')}s` : `${remaining}s`;
}

export function displayClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

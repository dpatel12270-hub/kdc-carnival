// Small UI helpers shared by every page.
import { CENTER } from './config.js';
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

// ---------- roles ----------
export const ROLES = {
  SUPER: 'SUPER_ADMIN_USER', ADMIN: 'MANDIR_ADMIN_USER', APP: 'APP_USER', GAME: 'GAME_ADMIN_USER',
  GIFT: 'GIFT_ADMIN_USER', PRIZE: 'PRIZE_ADMIN_USER', BOARD: 'LEADERS_BOARD_USER', CHECKIN: 'CHECKIN_USER'
};
export const ROLE_INFO = [
  [ROLES.APP, 'App User', 'Scan badges and give game tickets'],
  [ROLES.PRIZE, 'Prize Admin', 'Redeem and return prizes'],
  [ROLES.GIFT, 'Gift Admin', 'Hand out goody bags'],
  [ROLES.CHECKIN, 'Check-In', 'Check-In Desk, Ticketing Desk and Candy Jar'],
  [ROLES.GAME, 'Game Admin', 'Configure games, I-Side and E-Side prizes, board backgrounds'],
  [ROLES.BOARD, 'Leaders Board', 'Show the Leadership Board and Prize Boards'],
  [ROLES.ADMIN, 'Admin', 'Everything: live stats, game metrics, import, access codes, check-in sheet']
];

export const session = { user: null };
export const hasRole = (...roles) => !!session.user && roles.some(r => (session.user.roles || []).includes(r));
export const isAdmin = () => hasRole(ROLES.SUPER, ROLES.ADMIN);
export const center = () => CENTER;
export const userName = () => session.user?.name || 'Karyakar';

// ---------- dialogs ----------
const ICONS = { success: '✅', error: '⛔', warning: '⚠️', info: 'ℹ️' };
export function alertBox(message, { title, severity = 'info', button = 'Close', html: isHtml = false } = {}) {
  return new Promise(resolve => {
    const t = title || { success: 'Success', error: 'Something went wrong', warning: 'Heads up', info: 'Notice' }[severity];
    const el = html(`<div class="dialog-mask" role="alertdialog" aria-modal="true">
      <div class="dialog"><div class="ic">${ICONS[severity] || ''}</div><h3>${esc(t)}</h3>
      <p>${isHtml ? message : esc(message)}</p>
      <div class="form-actions"><button class="btn" type="button">${esc(button)}</button></div></div></div>`);
    document.body.appendChild(el);
    const btn = $('button', el); btn.focus();
    btn.onclick = () => { el.remove(); resolve(); };
  });
}
export const success = (m, o = {}) => alertBox(m, { ...o, severity: 'success' });
export const error = (m, o = {}) => alertBox(m, { ...o, severity: 'error' });

export function confirmBox(message, { title = 'Are you sure?', ok = 'Yes', cancel = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    const el = html(`<div class="dialog-mask"><div class="dialog"><div class="ic">❓</div><h3>${esc(title)}</h3><p>${esc(message)}</p>
      <div class="form-actions"><button class="btn btn-text" data-v="0" type="button">${esc(cancel)}</button>
      <button class="btn ${danger ? 'btn-danger' : ''}" data-v="1" type="button">${esc(ok)}</button></div></div></div>`);
    document.body.appendChild(el);
    $$('button', el).forEach(b => b.onclick = () => { el.remove(); resolve(b.dataset.v === '1'); });
  });
}

let spinCount = 0; let spinEl = null;
export function spinner(on) {
  spinCount = Math.max(0, spinCount + (on ? 1 : -1));
  if (spinCount && !spinEl) { spinEl = html('<div class="loading-overlay"><div class="spinner"></div></div>'); document.body.appendChild(spinEl); }
  if (!spinCount && spinEl) { spinEl.remove(); spinEl = null; }
}
export async function busy(fn) { spinner(true); try { return await fn(); } finally { spinner(false); } }

export function fmtTime(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
export function fmtDateTime(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

// Fullscreen helpers for the boards
export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

// Keep the screen awake on board displays (where supported).
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported */ }
}

// Load a script from a CDN once (QR scanner, Excel reader).
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); });
  return loaded[src];
}

// Simple CSV parser (quoted fields supported).
export function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export function randomCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; const a = new Uint32Array(6); crypto.getRandomValues(a);
  a.forEach(n => { s += chars[n % chars.length]; });
  return (prefix ? prefix.toUpperCase().replace(/[^A-Z0-9-]/g, '') + '-' : '') + s;
}

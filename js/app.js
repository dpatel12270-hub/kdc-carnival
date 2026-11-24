import api from './backend/index.js';
import { $, esc, session, hasRole, ROLES, error } from './ui.js';
import { CENTER_NAME } from './config.js';
import { resumeNfc, badgeFromUrl } from './nfc.js';

const R = ROLES;
const ANY = null; // any signed-in karyakar
const ADMINS = [R.SUPER, R.ADMIN];
const SCANNERS = [R.APP, R.PRIZE, R.GIFT, ...ADMINS];
const GAME_ADMINS = [R.GAME, ...ADMINS];
const BOARDS = [R.BOARD, ...ADMINS];

// path -> page module + who may open it
export const ROUTES = {
  'login': { page: 'login', public: true },
  'home': { page: 'home', roles: ANY },
  'scan': { page: 'scan', roles: SCANNERS },
  'token-management': { page: 'token', roles: SCANNERS },
  'check-in': { page: 'checkin', roles: [R.CHECKIN, ...ADMINS] },
  'kdc-leadership-board': { page: 'leaderboard', roles: BOARDS, board: true },
  'prize-board-i-side': { page: 'prizeboard', side: 'I-Side', roles: BOARDS, board: true },
  'prize-board-e-side': { page: 'prizeboard', side: 'E-Side', roles: BOARDS, board: true },
  'kdc-game-metrics': { page: 'metrics', roles: ADMINS },
  'kdc-live-stats': { page: 'livestats', roles: ADMINS },
  'kdc-configure-games': { page: 'games', roles: GAME_ADMINS },
  'prizes-i-side': { page: 'prizes', side: 'I-Side', roles: GAME_ADMINS },
  'prizes-e-side': { page: 'prizes', side: 'E-Side', roles: GAME_ADMINS },
  'board-settings': { page: 'boardsettings', roles: GAME_ADMINS },
  'program-badges': { page: 'badges', roles: [R.CHECKIN, R.GAME, ...ADMINS] },
  'access-codes': { page: 'accesscodes', roles: ADMINS },
  'kdc-import-participants': { page: 'import', roles: ADMINS },
  'unauthorized': { page: 'unauthorized', roles: ANY }
};

const MENU = [
  ['home', '⌂', 'Home'],
  ['scan', '⌗', 'Scan Badge'],
  ['check-in', '✔', 'Check-In'],
  ['kdc-live-stats', '📈', 'Live Stats'],
  ['kdc-game-metrics', '📊', 'Game Metrics'],
  ['kdc-configure-games', '🎯', 'Configure Games'],
  ['prizes-i-side', '🎁', 'I-Side Prizes'],
  ['prizes-e-side', '🎁', 'E-Side Prizes'],
  ['board-settings', '🖼', 'Board Backgrounds'],
  ['kdc-leadership-board', '🏆', 'Leadership Board'],
  ['prize-board-i-side', '🦁', 'I-Side Prize Board'],
  ['prize-board-e-side', '🦒', 'E-Side Prize Board'],
  ['program-badges', '🏷', 'Program Badges'],
  ['access-codes', '🔑', 'Access Codes'],
  ['kdc-import-participants', '📥', 'Import Participants']
];

export function go(path) { location.hash = '#/' + path; }
export const canOpen = route => route.public || (session.user && (route.roles === ANY || hasRole(...route.roles)));

const root = $('#app');

// Opened from a badge link (iPhone/Android tapped a badge): remember the badge, clean the address.
{
  const b = badgeFromUrl(location.href);
  if (b) {
    sessionStorage.setItem('kdc-pending-badge', b);
    const u = new URL(location.href); u.searchParams.delete('b');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
}
function takePendingBadge() {
  const b = sessionStorage.getItem('kdc-pending-badge');
  if (b) sessionStorage.removeItem('kdc-pending-badge');
  return b;
}
let cleanup = null;
let ready = false;
let currentPath = '';

function header() {
  const u = session.user;
  return `<header class="topbar no-print">
    <button class="brand-lockup" type="button" data-go="home"><img class="brand-logo" src="assets/kdc-logo.jpg" alt="Kids' Diwali logo"><div><div class="brand-title">KDC Carnival</div><div class="brand-subtitle">Jungle of Sheru · ${esc(CENTER_NAME)}</div></div></button>
    <button class="topbar-user" type="button" id="open-menu"><span class="topbar-user__copy"><span class="topbar-user__name">${esc(u.name)}</span><br><span class="topbar-user__center">${esc(u.label || CENTER_NAME)}</span></span><span class="burger"><span></span></span></button>
  </header>
  <div class="sidebar-mask" id="menu-mask" hidden></div>
  <aside class="sidebar" id="sidebar" aria-hidden="true">
    <button class="sidebar-close" type="button" id="close-menu" aria-label="Close menu">✕</button>
    <div class="sidebar-profile"><div class="sidebar-profile__avatar">${esc((u.name || 'K').charAt(0).toUpperCase())}</div>
      <div><div class="sidebar-profile__name">${esc(u.name)}</div><div class="sidebar-profile__meta">${esc(CENTER_NAME)}${u.label ? ' · ' + esc(u.label) : ''}</div></div></div>
    <nav class="sidebar-section">${MENU.filter(([p]) => canOpen(ROUTES[p]))
      .map(([p, ic, label]) => `<button class="sidebar-link" type="button" data-go="${p}"><span class="ico">${ic}</span><span>${label}</span></button>`).join('')}</nav>
    <div class="sidebar-footer"><button class="sidebar-link sidebar-link--danger" type="button" id="logout"><span class="ico">⎋</span><span>Logout</span></button></div>
  </aside>`;
}

function setMenu(open) {
  const sb = $('#sidebar'), mask = $('#menu-mask');
  if (!sb) return;
  sb.classList.toggle('open', open); sb.setAttribute('aria-hidden', String(!open)); mask.hidden = !open;
}

async function render() {
  if (!ready) return;
  let path = (location.hash.replace(/^#\/?/, '').split('?')[0]) || (session.user ? 'home' : 'login');
  const route = ROUTES[path];
  if (!route) return go(session.user ? 'home' : 'login');
  if (!route.public && !session.user) return go('login');
  if (path === 'login' && session.user) return go('home');
  const target = canOpen(route) ? route : ROUTES.unauthorized;
  currentPath = path;

  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const board = !!target.board;
  root.innerHTML = `<div class="app-shell">${session.user && !target.public && !board ? header() : ''}
    <main class="app-shell__content ${board || target.public ? 'app-shell__content--board' : ''}" id="main">
    ${api.isDemo && !board && !target.public ? '<div class="demo-banner no-print">Demo mode: data is saved only in this browser. Add your Firebase settings to go live. <button class="btn btn-text btn-sm" type="button" id="reset-demo">Reset demo data</button></div>' : ''}
    <div id="page"></div></main></div>`;
  const mod = await import(`./pages/${target.page}.js`);
  const params = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
  cleanup = (await mod.render($('#page'), params, target)) || null;
  window.scrollTo(0, 0);
  // a badge link was opened (badge tapped on a phone): open that kid
  if (session.user && sessionStorage.getItem('kdc-pending-badge') && hasRole(...SCANNERS)) openBadge(takePendingBadge());
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go], #open-menu, #close-menu, #menu-mask, #logout, #reset-demo');
  if (!t) return;
  if (t.dataset.go) { setMenu(false); go(t.dataset.go); }
  else if (t.id === 'open-menu') setMenu(true);
  else if (t.id === 'close-menu' || t.id === 'menu-mask') setMenu(false);
  else if (t.id === 'logout') { setMenu(false); api.logout().then(() => go('login')); }
  else if (t.id === 'reset-demo') api.resetDemo();
});
window.addEventListener('hashchange', render);

// Open a badge from anywhere a scanner is allowed (phone NFC tap or USB reader).
const OPEN_PAGES = new Set(['home', 'scan', 'token-management']);
// One badge at a time: if another is tapped while one is opening, the newest one wins.
let opening = false, queued = null;
async function openBadge(code) {
  if (opening) { queued = code; return; }
  opening = true;
  try {
    const { resolveCode } = await import('./pages/scan.js');
    const rec = await resolveCode(code);
    if (queued) return;
    sessionStorage.setItem('kdc-scan', JSON.stringify(rec));
    const next = 'token-management?id=' + encodeURIComponent(rec.id);
    if (location.hash === '#/' + next) render(); else go(next);
  } catch (err) { if (!queued) error(err.message || 'Invalid badge.'); }
  finally {
    opening = false;
    if (queued) { const q = queued; queued = null; openBadge(q); }
  }
}
window.addEventListener('kdc-badge', e => {
  // let the current page handle it first (e.g. the Ticketing Desk fills its badge box)
  setTimeout(() => {
    if (e.defaultPrevented || !session.user || !hasRole(...SCANNERS)) return;
    if (!OPEN_PAGES.has(currentPath)) return;
    if (document.querySelector('.dialog-mask')) document.querySelectorAll('.dialog-mask').forEach(d => d.remove());
    openBadge(e.detail.code);
  }, 0);
});

// ---------- USB badge readers (keyboard style) ----------
// Readers act like a keyboard: they type the badge number very fast and press Enter.
// When that happens and no text box is being typed in, open that badge from any page.
const WEDGE_PAGES = new Set(['home', 'token-management']);
let buf = '', times = [];
document.addEventListener('keydown', async e => {
  if (!session.user || !WEDGE_PAGES.has(currentPath) || !hasRole(...SCANNERS)) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || document.querySelector('.dialog-mask')) return;
  const t = performance.now();
  if (times.length && t - times[times.length - 1] > 80) { buf = ''; times = []; }
  if (e.key === 'Enter') {
    const fast = times.length >= 4 && (times[times.length - 1] - times[0]) / (times.length - 1) < 50;
    const code = buf; buf = ''; times = [];
    if (!fast || code.length < 4) return;
    e.preventDefault();
    openBadge(code);
    return;
  }
  if (e.key.length === 1) { buf += e.key; times.push(t); }
});

api.onAuth(user => {
  session.user = user;
  ready = true;
  render();
  if (user) resumeNfc();
});

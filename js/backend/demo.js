// Demo backend: stores everything in this browser's localStorage.
// Same interface as firebase.js so pages don't care which one runs.
import { EVENT_YEAR, CENTER } from '../config.js';
import { STARTER_GAMES, STARTER_PRIZES } from '../starter-data.js';

const KEY = 'kdc-demo-db-v2';
const listeners = new Set();
let authCb = null;
const ALL = ['MANDIR_ADMIN_USER', 'APP_USER', 'GAME_ADMIN_USER', 'GIFT_ADMIN_USER', 'PRIZE_ADMIN_USER', 'LEADERS_BOARD_USER', 'CHECKIN_USER'];

function seed() {
  const kids = [
    ['Aarav', 'Patel', 'Nilesh Patel', '3', 'I-Side'], ['Diya', 'Shah', 'Kiran Shah', '5', 'E-Side'],
    ['Vihaan', 'Desai', 'Mehul Desai', 'KG & Below', 'I-Side'], ['Anaya', 'Mehta', 'Rina Mehta', '2', 'E-Side']
  ];
  const participants = {};
  kids.forEach(([firstName, lastName, parentName, grade, wing], i) => {
    const tagId = 'DEMO' + (1001 + i);
    const id = `${EVENT_YEAR}-${CENTER}-${tagId}`;
    participants[id] = { id, tagId, firstName, lastName, parentName, grade, wing, center: CENTER, year: String(EVENT_YEAR),
      assigned: true, tokenCount: 0, totalTokenWon: 0, isGoodBagReceived: false, winningHistory: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  });
  return {
    games: STARTER_GAMES, prizes: { 'I-Side': STARTER_PRIZES, 'E-Side': STARTER_PRIZES }, config: {}, backgrounds: {},
    participants,
    accessCodes: {
      'DEMO-ADMIN': { code: 'DEMO-ADMIN', label: 'Lead / full access', center: CENTER, active: true, roles: ALL },
      'DEMO-GAMES': { code: 'DEMO-GAMES', label: 'Game volunteer', center: CENTER, active: true, roles: ['APP_USER'] },
      'DEMO-PRIZES': { code: 'DEMO-PRIZES', label: 'Prize booth', center: CENTER, active: true, roles: ['APP_USER', 'PRIZE_ADMIN_USER', 'GIFT_ADMIN_USER'] },
      'DEMO-CHECKIN': { code: 'DEMO-CHECKIN', label: 'Check-in desk', center: CENTER, active: true, roles: ['CHECKIN_USER'] }
    },
    checkin: [],
    session: null
  };
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
  const db = seed(); save(db); return db;
}
function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { console.warn('Demo save failed', e); throw new Error('This browser ran out of demo storage space. Try a smaller image.'); }
  listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}
const clone = o => JSON.parse(JSON.stringify(o));
const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));
window.addEventListener('storage', e => { if (e.key === KEY) listeners.forEach(fn => fn()); });

export const isDemo = true;

// ---------------- auth: name + access code ----------------
export function onAuth(cb) {
  authCb = cb;
  const db = load();
  cb(db.session ? clone(db.session) : null);
}
export async function login(name, code) {
  await wait();
  const db = load();
  const ac = db.accessCodes[String(code || '').trim().toUpperCase()];
  if (!ac || ac.active === false) throw new Error("That access code didn't work. Ask the KDC lead for your code.");
  db.session = { uid: 'demo-' + Date.now(), name: String(name).trim(), code: ac.code, center: CENTER, roles: ac.roles, label: ac.label };
  save(db);
  authCb && authCb(clone(db.session));
  return clone(db.session);
}
export async function logout() { const db = load(); db.session = null; save(db); authCb && authCb(null); }

// ---------------- access codes ----------------
export async function listAccessCodes() { await wait(40); return clone(Object.values(load().accessCodes)); }
export async function saveAccessCode(ac) { await wait(); const db = load(); db.accessCodes[ac.code] = clone(ac); save(db); }
export async function deleteAccessCode(code) { await wait(); const db = load(); delete db.accessCodes[code]; save(db); }

// ---------------- games / prizes / config / backgrounds ----------------
export async function getGames() { await wait(40); return clone(load().games || []); }
export async function saveGames(list) { await wait(); const db = load(); db.games = clone(list); save(db); }
export async function getPrizes(side) { await wait(40); return clone((load().prizes || {})[side] || []); }
export async function savePrizes(side, list) { await wait(); const db = load(); db.prizes = db.prizes || {}; db.prizes[side] = clone(list); save(db); }
export async function getConfig() { await wait(20); return clone(load().config || {}); }
export async function saveConfig(cfg) { await wait(); const db = load(); db.config = clone(cfg); save(db); }
export async function getBackground(key) { await wait(20); return (load().backgrounds || {})[key] || null; }
export async function saveBackground(key, dataUrl) {
  await wait(); const db = load(); db.backgrounds = db.backgrounds || {};
  if (dataUrl) db.backgrounds[key] = dataUrl; else delete db.backgrounds[key];
  save(db);
}

// ---------------- participants ----------------
export async function getParticipant(id) { await wait(60); const p = load().participants[id]; return p ? clone(p) : null; }
export async function findParticipantByTag(year, tagId) {
  await wait(60);
  const p = Object.values(load().participants).find(p => String(p.year) === String(year) && String(p.tagId) === String(tagId));
  return p ? clone(p) : null;
}
export async function setParticipant(rec) { await wait(); const db = load(); db.participants[rec.id] = clone(rec); save(db); return clone(rec); }
export async function updateParticipant(id, mutate) {
  await wait();
  const db = load();
  const cur = db.participants[id];
  if (!cur) throw new Error('Participant not found.');
  const next = mutate(clone(cur));
  db.participants[id] = next; save(db);
  return clone(next);
}
export async function listParticipants(year) {
  await wait(60);
  return clone(Object.values(load().participants).filter(p => String(p.year) === String(year)));
}
export function watchParticipants(year, cb) {
  const run = () => cb(clone(Object.values(load().participants).filter(p => String(p.year) === String(year))));
  listeners.add(run); run();
  return () => listeners.delete(run);
}
export async function importParticipants(list) {
  await wait(300); const db = load(); list.forEach(p => { db.participants[p.id] = clone(p); }); save(db); return list.length;
}

// ---------------- practice check-in sheet (only when no real sheet PIN is saved) ----------------
const DEMO_REGS = [
  ['260011234567890', 'Krish', 'Amin', '4th grade', 'Hetal Amin', '540-555-0101', '540-555-0199', 'None'],
  ['260011234567891', 'Siya', 'Amin', '1st grade', 'Hetal Amin', '540-555-0101', '540-555-0199', 'Peanuts'],
  ['260011234567892', 'Dev', 'Joshi', 'KG', 'Amit Joshi', '540-555-0144', '', 'None'],
  ['260011234567893', 'Meera', 'Trivedi', '6th grade', 'Nisha Trivedi', '540-555-0177', '540-555-0178', 'None'],
  ['260011234567894', 'Arjun', 'Bhatt', '3rd grade', 'Ravi Bhatt', '540-555-0122', '', 'Dairy']
].map(([sid, first, last, grade, parent, phone, phone2, allergies]) => ({ sid, first, last, grade, parent, phone, phone2, allergies }));

export const demoSheet = {
  async call(action, args = {}) {
    await wait(150);
    const db = load(); db.checkin = db.checkin || []; const rows = db.checkin;
    const find = sid => rows.find(r => r.sid === sid);
    switch (action) {
      case 'checkPin': return true;
      case 'getState': return clone(rows);
      case 'checkIn': {
        const code = String(args.code || '');
        if (!/^\d{12,22}$/.test(code)) return { result: 'invalid' };
        const r = DEMO_REGS.find(x => x.sid === code);
        if (!r) return { result: 'not_found' };
        const ex = find(code); if (ex) return { result: 'duplicate', rec: clone(ex) };
        const rec = { ...r, guess: '', status: 'Checked in', badge: '', inAt: new Date().toISOString(), addedAt: '' };
        rows.push(rec); save(db); return { result: 'ok', rec: clone(rec) };
      }
      case 'searchByName': {
        const q = String(args.q || '').toLowerCase();
        return DEMO_REGS.filter(r => (r.first + ' ' + r.last + ' ' + r.parent).toLowerCase().includes(q)).map(r => ({ ...r, checked: !!find(r.sid) }));
      }
      case 'undoCheckIn': db.checkin = rows.filter(r => r.sid !== args.rid); save(db); return true;
      case 'markAdded': { const r = find(args.rid); if (r) { r.status = 'Added to ticketing'; r.badge = args.badge || ''; r.addedAt = new Date().toISOString(); save(db); } return true; }
      case 'moveBack': { const r = find(args.rid); if (r) { r.status = 'Checked in'; r.addedAt = ''; save(db); } return true; }
      case 'setGuess': { const r = find(args.rid); if (r) { r.guess = args.guess; save(db); } return true; }
      default: throw new Error('ERROR');
    }
  }
};

export function resetDemo() { localStorage.removeItem(KEY); location.reload(); }

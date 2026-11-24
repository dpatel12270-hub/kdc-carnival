// Firebase backend (Firestore + anonymous sign-in with access codes). Roanoke only.
import { FIREBASE_CONFIG, CENTER } from '../config.js';

const V = '10.12.2';
const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

const app = initializeApp(FIREBASE_CONFIG);
const auth = A.getAuth(app);
const db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });

export const isDemo = false;
const d = (...p) => F.doc(db, ...p);
const col = name => F.collection(db, name);
const now = () => new Date().toISOString();

// ---------------- auth: name + access code ----------------
let authCb = null;
let current = null;
export function onAuth(cb) {
  authCb = cb;
  A.onAuthStateChanged(auth, async user => {
    if (!user) { current = null; return cb(null); }
    try {
      const snap = await F.getDoc(d('sessions', user.uid));
      current = snap.exists() ? { uid: user.uid, ...snap.data() } : null;
    } catch (e) { console.warn(e); current = null; }
    cb(current);
  });
}
export async function login(name, code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) throw new Error('Enter your access code.');
  const cred = auth.currentUser ? { user: auth.currentUser } : await A.signInAnonymously(auth);
  let ac = null;
  try { ac = await F.getDoc(d('accessCodes', code)); } catch (e) { ac = null; }
  if (!ac || !ac.exists() || ac.data().active === false) {
    throw new Error("That access code didn't work. Ask the KDC lead for your code.");
  }
  const a = ac.data();
  const session = { name: String(name).trim(), code, center: a.center || CENTER, roles: a.roles || [], label: a.label || '', createdAt: now() };
  try { await F.deleteDoc(d('sessions', cred.user.uid)); } catch (e) { /* none yet */ }
  await F.setDoc(d('sessions', cred.user.uid), session);
  current = { uid: cred.user.uid, ...session };
  authCb && authCb(current);
  return current;
}
export async function logout() {
  try { if (auth.currentUser) await F.deleteDoc(d('sessions', auth.currentUser.uid)); } catch (e) { /* ignore */ }
  await A.signOut(auth);
}

// ---------------- access codes ----------------
export async function listAccessCodes() { const s = await F.getDocs(col('accessCodes')); return s.docs.map(x => x.data()); }
export async function saveAccessCode(ac) { await F.setDoc(d('accessCodes', ac.code), ac); }
export async function deleteAccessCode(code) { await F.deleteDoc(d('accessCodes', code)); }

// ---------------- games / prizes / config / backgrounds ----------------
export async function getGames() { const s = await F.getDoc(d('games', CENTER)); return s.exists() ? (s.data().games || []) : []; }
export const saveGames = list => F.setDoc(d('games', CENTER), { games: list, updated_at: now() });
export async function getPrizes(side) { const s = await F.getDoc(d('prizes', side)); return s.exists() ? (s.data().prizes || []) : []; }
export const savePrizes = (side, list) => F.setDoc(d('prizes', side), { side, prizes: list, updated_at: now() });
export async function getConfig() { const s = await F.getDoc(d('configs', CENTER)); return s.exists() ? s.data() : {}; }
export const saveConfig = cfg => F.setDoc(d('configs', CENTER), cfg);
export async function getBackground(key) { const s = await F.getDoc(d('backgrounds', key)); return s.exists() ? s.data().data : null; }
export async function saveBackground(key, dataUrl) {
  if (dataUrl) await F.setDoc(d('backgrounds', key), { data: dataUrl, updated_at: now() });
  else await F.deleteDoc(d('backgrounds', key));
}

// ---------------- participants ----------------
export async function getParticipant(id) { const s = await F.getDoc(d('participants', id)); return s.exists() ? s.data() : null; }
export async function findParticipantByTag(year, tagId) {
  const q = F.query(col('participants'), F.where('year', '==', String(year)), F.where('tagId', '==', String(tagId)), F.limit(1));
  const s = await F.getDocs(q);
  return s.empty ? null : s.docs[0].data();
}
export async function setParticipant(rec) { await F.setDoc(d('participants', rec.id), rec); return rec; }
export async function updateParticipant(id, mutate) {
  return F.runTransaction(db, async tx => {
    const ref = d('participants', id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Participant not found.');
    const next = mutate(snap.data());
    tx.set(ref, next);
    return next;
  });
}
const yearQuery = year => F.query(col('participants'), F.where('year', '==', String(year)));
export async function listParticipants(year) { const s = await F.getDocs(yearQuery(year)); return s.docs.map(x => x.data()); }
export function watchParticipants(year, cb, onError) {
  return F.onSnapshot(yearQuery(year), s => cb(s.docs.map(x => x.data())), e => { console.error(e); onError && onError(e); });
}
export async function importParticipants(list) {
  for (let i = 0; i < list.length; i += 400) {
    const b = F.writeBatch(db);
    list.slice(i, i + 400).forEach(p => b.set(d('participants', p.id), p));
    await b.commit();
  }
  return list.length;
}

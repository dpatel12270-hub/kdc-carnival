// Talks to the check-in Google Sheet through its Apps Script web app
// (the same one the old kdc-checkin page used).
import api from './backend/index.js';

export const DEFAULT_SHEET_API = 'https://script.google.com/macros/s/AKfycbx29gtG33gX3z-6jQT_-G4zDZy4NXWeYfM8ume6ENZK3Q__7u3avspcP8vF3yD9ZEmbgg/exec';

const ARGS = { checkIn: ['code'], searchByName: ['q'], undoCheckIn: ['rid'], markAdded: ['rid', 'badge'], moveBack: ['rid'], setGuess: ['rid', 'guess'] };

// Live sheet whenever a PIN is saved. The practice sheet is only for demo mode before a PIN is saved.
export const isLive = cfg => !!cfg.sheetPin;
export function makeSheetClient(cfg) {
  if (!isLive(cfg)) {
    if (!api.isDemo) throw new Error('The check-in sheet is not connected yet.');
    return { call: (fn, ...a) => api.demoSheet.call(fn, Object.fromEntries((ARGS[fn] || []).map((n, i) => [n, a[i]]))) };
  }
  const url = cfg.sheetApiUrl || DEFAULT_SHEET_API;
  const pin = cfg.sheetPin || '';
  return {
    async call(fn, ...a) {
      let qs = 'action=' + encodeURIComponent(fn) + '&pin=' + encodeURIComponent(pin) + '&t=' + Date.now();
      (ARGS[fn] || []).forEach((n, i) => { qs += '&' + n + '=' + encodeURIComponent(a[i] == null ? '' : a[i]); });
      const res = await fetch(url + '?' + qs, { cache: 'no-store' }).then(r => r.json());
      if (res && res.ok) return res.data;
      throw new Error((res && res.error) || 'ERROR');
    }
  };
}

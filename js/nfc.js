// Badge tapping with phones.
//
// iPhone: iPhones read NFC badges on their own. Each badge holds a link like
//   https://…/kdc-carnival/?b=04A23B1C
// Tapping the badge pops up a notification; opening it loads this site, which then
// opens that kid (see app.js). Websites can't read NFC directly on iPhone.
//
// Android (Chrome): the same link works, and the site can also listen for taps directly
// (Web NFC) so badges open without leaving the page. Every tap is sent as a
// "kdc-badge" event: { detail: { code } }. Pages can call e.preventDefault() to handle
// it themselves (the Ticketing Desk does); otherwise the app opens that badge.

export const nfcSupported = () => 'NDEFReader' in window;
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const nfcState = { on: false, error: '' };
let ctrl = null;
let last = '', lastAt = 0;
const listeners = new Set();
export const onNfcChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach(fn => { try { fn(nfcState); } catch (e) { /* ignore */ } });

// "04:a2:3b:1c" -> "04A23B1C"
export const serialToCode = s => String(s || '').replace(/[^0-9a-f]/gi, '').toUpperCase();

// Pull the badge ID out of a badge link (…?b=ID or …#/…?b=ID).
export function badgeFromUrl(url) {
  try {
    const u = new URL(url, location.href);
    const v = u.searchParams.get('b') || new URLSearchParams(u.hash.split('?')[1] || '').get('b');
    return v ? v.trim().toUpperCase() : '';
  } catch (e) { return ''; }
}
export const badgeUrl = code => location.origin + location.pathname + '?b=' + encodeURIComponent(code);

function codeFromReading(e) {
  for (const r of (e.message && e.message.records) || []) {
    if (r.recordType === 'url' || r.recordType === 'absolute-url') {
      try { const c = badgeFromUrl(new TextDecoder().decode(r.data)); if (c) return c; } catch (err) { /* ignore */ }
    }
  }
  return serialToCode(e.serialNumber);
}

export function announceBadge(code) {
  const now = Date.now();
  if (code === last && now - lastAt < 3000) return; // badge still held on the phone
  last = code; lastAt = now;
  if (navigator.vibrate) navigator.vibrate(80);
  window.dispatchEvent(new CustomEvent('kdc-badge', { detail: { code }, cancelable: true }));
}

export async function startNfc() {
  if (!nfcSupported()) {
    nfcState.error = isIOS()
      ? 'On iPhone, hold the badge near the top of the phone and tap the link that pops up.'
      : 'This browser cannot listen for badges. Type the badge number, or use a phone.';
    changed(); throw new Error(nfcState.error);
  }
  if (nfcState.on) return;
  try {
    ctrl = new AbortController();
    const reader = new window.NDEFReader();
    await reader.scan({ signal: ctrl.signal });
    reader.onreadingerror = () => { nfcState.error = "Couldn't read that badge. Hold it flat against the back of the phone."; changed(); };
    reader.onreading = e => {
      if (window.__kdcWriting) return; // the badge writer page is busy
      const code = codeFromReading(e);
      if (!code) { nfcState.error = 'This badge has no readable ID.'; changed(); return; }
      nfcState.error = ''; changed();
      announceBadge(code);
    };
    nfcState.on = true; nfcState.error = ''; localStorage.setItem('kdc-nfc', '1'); changed();
  } catch (err) {
    nfcState.on = false;
    nfcState.error = err && err.name === 'NotAllowedError' ? 'NFC permission was blocked. Allow NFC for this site in Chrome settings, and turn on NFC in the phone settings.'
      : err && err.name === 'NotSupportedError' ? 'NFC is off or not available. Turn on NFC in the phone settings.'
      : (err && err.message) || "Couldn't start the badge reader.";
    changed(); throw new Error(nfcState.error);
  }
}
export function stopNfc() { if (ctrl) ctrl.abort(); ctrl = null; nfcState.on = false; localStorage.removeItem('kdc-nfc'); changed(); }

// Chrome only lets NFC start without a tap if permission was already granted.
export async function resumeNfc() {
  if (!nfcSupported() || nfcState.on || localStorage.getItem('kdc-nfc') !== '1') return;
  try {
    const p = await navigator.permissions.query({ name: 'nfc' });
    if (p.state === 'granted') await startNfc();
  } catch (e) { /* needs a tap */ }
}

// Write this site's badge link onto one tag (Android Chrome only).
// makeCode(serial, existingCode) returns the badge ID to write. Resolves with that ID.
export function writeNextBadge(makeCode, signal) {
  if (!nfcSupported()) return Promise.reject(new Error('Writing badges needs Chrome on an Android phone. On iPhone, use the free "NFC Tools" app (see the steps on this page).'));
  const reader = new window.NDEFReader();
  const ac = new AbortController();
  if (signal) signal.addEventListener('abort', () => ac.abort());
  window.__kdcWriting = true;
  const done = () => { ac.abort(); window.__kdcWriting = false; };
  return new Promise((resolve, reject) => {
    reader.onreading = async e => {
      try {
        const code = makeCode(serialToCode(e.serialNumber), codeFromReading(e));
        await reader.write({ records: [{ recordType: 'url', data: badgeUrl(code) }] });
        done(); resolve(code);
      } catch (err) { done(); reject(new Error("Couldn't write that badge. Hold it still and try again. Locked badges can't be changed.")); }
    };
    reader.scan({ signal: ac.signal }).catch(err => {
      done();
      if (ac.signal.aborted && !(err && err.name === 'NotAllowedError')) return reject(new Error('Stopped.'));
      reject(new Error(err && err.name === 'NotAllowedError' ? 'Allow NFC for this site in Chrome.' : 'Turn on NFC in the phone settings.'));
    });
  });
}

// A small reusable button + status line for pages.
export function nfcControl() {
  const wrap = document.createElement('div');
  wrap.className = 'nfc-ctl';
  const draw = () => {
    if (!nfcSupported() && isIOS()) {
      wrap.innerHTML = '<div class="nfc-live"><span class="nfc-dot"></span><span><b>iPhone:</b> hold the badge near the top of the phone, then tap the link that pops up.</span></div>';
      return;
    }
    if (!nfcSupported()) { wrap.innerHTML = ''; return; } // laptops: type the badge number
    wrap.innerHTML = nfcState.on
      ? '<div class="nfc-live"><span class="nfc-dot"></span><span><b>Phone reader is on.</b> Tap a badge on the back of this phone.</span></div><button class="btn btn-text btn-sm" type="button" data-nfc="stop">Turn off</button>'
      : '<button class="btn btn-orange" type="button" data-nfc="start">📱 Use this phone to read badges</button>';
    if (nfcState.error) wrap.insertAdjacentHTML('beforeend', `<small class="err" style="display:block;width:100%;text-align:center">${nfcState.error}</small>`);
    const b = wrap.querySelector('[data-nfc]');
    if (b) b.onclick = () => (b.dataset.nfc === 'start' ? startNfc().catch(() => {}) : stopNfc());
  };
  draw();
  wrap.cleanup = onNfcChange(draw);
  return wrap;
}

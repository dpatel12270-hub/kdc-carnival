import api from '../backend/index.js';
import { $, error, alertBox, busy, loadScript } from '../ui.js';
import { go } from '../app.js';
import { EVENT_YEAR, CENTER } from '../config.js';
import { nfcControl, nfcSupported } from '../nfc.js';

export const cleanTag = t => String(t || '').trim().replace(/\s+/g, '').toUpperCase();
export const participantIdFor = (year, tagId) => `${year}-${CENTER}-${cleanTag(tagId).replace(/[^A-Z0-9_-]/g, '_')}`;

// Works out which participant a scanned code belongs to.
export async function resolveCode(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Invalid QR code scanned.');
  let qr = null;
  try { qr = JSON.parse(text); } catch (e) { /* not JSON: a badge / tag number */ }
  if (qr && typeof qr === 'object') {
    if (!(qr.center && qr.year && qr.uuid)) throw new Error('Invalid QR code scanned.');
    if (qr.center !== CENTER) { const e = new Error('This QR code belongs to a different center, not Roanoke.'); e.warn = true; throw e; }
    const found = await api.getParticipant(qr.uuid).catch(() => null);
    return found || { id: qr.uuid, uuid: qr.uuid, center: qr.center, year: String(qr.year), assigned: false };
  }
  const tag = cleanTag(text);
  const found = await api.findParticipantByTag(EVENT_YEAR, tag);
  return found || { id: participantIdFor(EVENT_YEAR, tag), tagId: tag, center: CENTER, year: String(EVENT_YEAR), assigned: false };
}

export function render(el) {
  el.innerHTML = `<section class="page-shell narrow"><div class="section-card">
    <div class="section-card__header"><span class="eyebrow">Scan Station</span><h1>Scan a participant badge</h1>
      <p>On an Android phone, tap <b>Use this phone to read badges</b> and hold the badge to the back of the phone. You can also scan a QR code with the camera, or type the badge number and press Enter. We'll validate the center and open ticket management automatically.</p></div>
    <div class="scanner-stage">
      <div id="nfc"></div>
      <form id="scan-form"><input class="input scan-input" id="scan" autocomplete="off" inputmode="text" placeholder="Badge # or QR code" aria-label="Badge number or QR code"></form>
      <div class="form-actions" style="justify-content:center">
        <button class="btn btn-outline" type="button" id="cam-btn">📷 Scan with camera</button>
        <button class="btn" type="button" id="go-btn">Open</button>
      </div>
      <div id="reader" hidden></div>
    </div>
    <div class="form-actions" style="margin-top:1.25rem"><button class="btn btn-text" type="button" data-go="home">← Back to Home</button></div>
  </div></section>`;

  const input = $('#scan', el);
  let cam = null, handling = false;
  const touch = matchMedia('(pointer: coarse)').matches; // don't pop up the phone keyboard
  if (!touch) setTimeout(() => input.focus(), 50);
  const nfc = nfcControl(); $('#nfc', el).appendChild(nfc);

  async function handle(code) {
    if (handling) return; handling = true;
    try {
      const rec = await busy(() => resolveCode(code));
      await stopCam();
      sessionStorage.setItem('kdc-scan', JSON.stringify(rec));
      go('token-management?id=' + encodeURIComponent(rec.id));
    } catch (e) {
      await stopCam();
      if (e.warn) await alertBox(e.message, { severity: 'warning', title: 'Different center' });
      else await error(e.message || 'Invalid QR code scanned.', { title: 'Invalid QR code' });
      input.value = ''; if (!touch) input.focus();
    } finally { handling = false; }
  }

  $('#scan-form', el).addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; if (v.trim()) handle(v); });
  $('#go-btn', el).onclick = () => { const v = input.value; input.value = ''; if (v.trim()) handle(v); else input.focus(); };

  async function startCam() {
    try { await loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'); }
    catch (e) { return error("The camera scanner didn't load. Check the internet connection and reload the page."); }
    $('#reader', el).hidden = false; $('#cam-btn', el).textContent = 'Stop camera';
    cam = new window.Html5Qrcode('reader');
    cam.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, text => handle(text))
      .catch(() => { stopCam(); error("Couldn't open the camera. Allow camera access for this page, or use the badge reader / type the number."); });
  }
  async function stopCam() {
    const c = cam; cam = null;
    if (c) { try { await c.stop(); c.clear(); } catch (e) { /* ignore */ } }
    const r = $('#reader', el); if (r) r.hidden = true;
    const b = $('#cam-btn', el); if (b) b.textContent = '📷 Scan with camera';
  }
  $('#cam-btn', el).onclick = () => (cam ? stopCam() : startCam());
  const refocus = e => { if (!touch && !cam && !e.target.closest('button, a, input') && !document.querySelector('.dialog-mask')) input.focus(); };
  el.addEventListener('click', refocus);
  return () => { stopCam(); el.removeEventListener('click', refocus); nfc.cleanup && nfc.cleanup(); };
}

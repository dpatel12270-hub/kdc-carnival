import api from '../backend/index.js';
import { $, $$, esc, busy, success, error, confirmBox } from '../ui.js';

export const BOARDS = [
  ['leaderboard', 'Leadership Board', 'kdc-leadership-board'],
  ['prizeboard-I-Side', 'I-Side Prize Board', 'prize-board-i-side'],
  ['prizeboard-E-Side', 'E-Side Prize Board', 'prize-board-e-side']
];

// Shrink a photo so it fits in the database (under ~900 KB) but still looks sharp on a TV.
export async function compressImage(file, maxW = 1920, maxH = 1080, limit = 900000) {
  if (!/^image\//.test(file.type)) throw new Error('Pick an image file (JPG or PNG).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That image couldn't be opened. Try a JPG or PNG.")); i.src = url; });
    let scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    for (let attempt = 0; attempt < 8; attempt++) {
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      for (const q of [0.82, 0.72, 0.62, 0.52]) {
        const data = c.toDataURL('image/jpeg', q);
        if (data.length <= limit) return data;
      }
      scale *= 0.8;
    }
    throw new Error('That image is too large. Try a smaller one.');
  } finally { URL.revokeObjectURL(url); }
}

// Used by the boards: background image (or null) plus tint.
export async function boardLook(key) {
  const [bg, cfg] = await Promise.all([api.getBackground(key).catch(() => null), api.getConfig().catch(() => ({}))]);
  return { bg, cfg, tint: Number(cfg.boardTint ?? 25) };
}
export function applyLook(screen, { bg, tint }) {
  if (bg) screen.style.backgroundImage = `linear-gradient(rgba(0,0,0,${tint / 100}), rgba(0,0,0,${tint / 100})), url("${bg}")`;
}

export async function render(el) {
  const cfg = await busy(() => api.getConfig()).catch(() => ({}));
  const bgs = await busy(() => Promise.all(BOARDS.map(([k]) => api.getBackground(k).catch(() => null))));
  el.innerHTML = `<section class="page-shell">
    <div class="section-card"><div class="section-card__header"><span class="eyebrow">Boards</span><h1>Board Backgrounds</h1>
      <p>Upload your own background for each TV board. Big photos are shrunk automatically so they load fast. A wide (16:9) picture looks best.</p></div>
      <div class="bg-grid">${BOARDS.map(([k, label, route], i) => `<div class="bg-card" data-k="${k}">
        <b>${label}</b>
        <div class="bg-preview" ${bgs[i] ? `style="background-image:url('${bgs[i]}')"` : ''}>${bgs[i] ? '' : 'Built-in jungle'}</div>
        <div class="form-actions" style="margin:0"><label class="btn btn-sm" style="cursor:pointer">⬆ Upload<input type="file" accept="image/*" hidden></label>
          <button class="btn btn-outline btn-sm" type="button" data-remove ${bgs[i] ? '' : 'hidden'}>Remove</button>
          <button class="btn btn-text btn-sm" type="button" data-go="${route}">Open board →</button></div></div>`).join('')}</div>
    </div>
    <div class="section-card"><div class="section-card__header"><h2>Board text and look</h2></div>
      <div class="modern-form" style="max-width:560px">
        <div class="form-field"><label for="lt">Leadership Board title</label><input class="input" id="lt" placeholder="Leadership Board" value="${esc(cfg.leadersBoardTitle || '')}"></div>
        <div class="form-field"><label for="tint">Darken the background so text is easy to read: <b id="tint-v">${Number(cfg.boardTint ?? 25)}%</b></label><input id="tint" type="range" min="0" max="70" step="5" value="${Number(cfg.boardTint ?? 25)}"></div>
        <div class="form-field"><label for="top">Space above the prize list (% of screen, for a logo in your background)</label><input class="input" id="top" inputmode="numeric" placeholder="10" value="${esc(cfg.topSpacePct ?? '')}"></div>
        <div class="form-actions"><button class="btn" type="button" id="save">✓ Save</button></div>
      </div></div>
  </section>`;

  $$('.bg-card', el).forEach(card => {
    const key = card.dataset.k, prev = $('.bg-preview', card), rm = $('[data-remove]', card);
    $('input[type=file]', card).onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const data = await busy(async () => { const d = await compressImage(f); await api.saveBackground(key, d); return d; });
        prev.style.backgroundImage = `url('${data}')`; prev.textContent = ''; rm.hidden = false;
        success('Background uploaded. The board picks it up the next time it loads.');
      } catch (err) { error(err.message || 'Upload failed.'); }
    };
    rm.onclick = async () => {
      if (!(await confirmBox('Remove this background and go back to the built-in jungle?', { ok: 'Remove' }))) return;
      try { await busy(() => api.saveBackground(key, null)); prev.style.backgroundImage = ''; prev.textContent = 'Built-in jungle'; rm.hidden = true; }
      catch (err) { error(err.message); }
    };
  });
  $('#tint', el).oninput = () => { $('#tint-v', el).textContent = $('#tint', el).value + '%'; };
  $('#save', el).onclick = async () => {
    const top = $('#top', el).value.trim();
    const latest = await api.getConfig().catch(() => cfg); // keep check-in settings saved by others
    const next = { ...latest, leadersBoardTitle: $('#lt', el).value.trim(), boardTint: Number($('#tint', el).value), topSpacePct: top === '' ? 10 : Math.max(0, Math.min(40, Number(top) || 0)) };
    try { await busy(() => api.saveConfig(next)); success('Board settings saved.'); } catch (e) { error('Could not save board settings.'); }
  };
}

import api from '../backend/index.js';
import { $, $$, esc, html, busy, success, error } from '../ui.js';
import { STARTER_PRIZES } from '../starter-data.js';

// One page per side: #/prizes-i-side and #/prizes-e-side
export async function render(el, params, route) {
  const side = route.side;
  const other = side === 'I-Side' ? 'E-Side' : 'I-Side';
  const prizes = await busy(() => api.getPrizes(side)).catch(() => []);
  el.innerHTML = `<section class="page-shell narrow">
  <div class="section-card">
    <div class="section-card__header"><span class="side-tag ${side === 'E-Side' ? 'e' : ''}">${side}</span><h1>${side} Prizes</h1>
      <p>These prizes are only for <b>${side}</b> kids and show on the <b>${side} Prize Board</b>. <b>📌 Pin to top</b> puts a prize first on the board (pinned ones keep the order below; move them with ▲▼). <b>♾ No stock limit</b> is for raffles: it never sells out and the board shows "Raffle" instead of a count.</p></div>
    <div class="banner-warn" id="empty" style="margin-bottom:1rem;display:${prizes.length ? 'none' : 'flex'};gap:.6rem;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <span>No ${side} prizes yet.</span><span style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-sm" type="button" id="starter">Load the KDC 2026 prizes</button><button class="btn btn-outline btn-sm" type="button" id="copy">Copy from ${other}</button></span></div>
    <div class="row-list" id="rows"></div>
    <div class="form-actions form-actions--between" style="margin-top:1.4rem"><button class="btn btn-outline" type="button" id="add">＋ Add Prize</button>
      <span style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-text" type="button" data-go="prizes-${other === 'I-Side' ? 'i' : 'e'}-side">${other} Prizes →</button><button class="btn" type="button" id="save">✓ Save ${side} prizes</button></span></div>
  </div></section>`;

  const rows = $('#rows', el);
  const addRow = (p = {}) => {
    const r = html(`<div class="cfg-row"><div class="cfg-main"><input class="input" data-k="prize" placeholder="Prize name" value="${esc(p.prize || '')}">
        <div class="cfg-flags"><label><input type="checkbox" data-k="pinned" ${p.pinned ? 'checked' : ''}> 📌 Pin to top</label><label><input type="checkbox" data-k="unlimited" ${p.unlimited ? 'checked' : ''}> ♾ No stock limit (raffle)</label></div></div>
      <div class="cfg-nums"><div class="cfg-num"><span>Tokens</span><input class="input" data-k="tokens" inputmode="numeric" maxlength="3" placeholder="0" value="${esc(p.tokens ?? '')}"></div>
        <div class="cfg-num"><span>Quantity</span><input class="input" data-k="quantity" inputmode="numeric" maxlength="4" placeholder="0" value="${esc(p.unlimited ? '' : p.quantity ?? '')}"></div>
        <div class="cfg-num"><span>Move</span><div style="display:flex;gap:.2rem"><button class="btn btn-text btn-sm" type="button" data-mv="-1" aria-label="Move up">▲</button><button class="btn btn-text btn-sm" type="button" data-mv="1" aria-label="Move down">▼</button></div></div></div>
      <button class="icon-btn" type="button" title="Delete prize" aria-label="Delete prize">🗑</button></div>`);
    const qty = $('[data-k=quantity]', r), unl = $('[data-k=unlimited]', r);
    const sync = () => { qty.disabled = unl.checked; if (unl.checked) { qty.value = ''; qty.placeholder = '∞'; } else qty.placeholder = '0'; };
    unl.onchange = sync; sync();
    $('.icon-btn', r).onclick = () => r.remove();
    $$('[data-mv]', r).forEach(b => b.onclick = () => {
      if (b.dataset.mv === '-1' && r.previousElementSibling) rows.insertBefore(r, r.previousElementSibling);
      if (b.dataset.mv === '1' && r.nextElementSibling) rows.insertBefore(r.nextElementSibling, r);
    });
    rows.appendChild(r);
  };
  [...prizes.filter(p => p.pinned), ...prizes.filter(p => !p.pinned)].forEach(addRow);
  if (!prizes.length) addRow();
  const fill = list => { rows.innerHTML = ''; list.forEach(addRow); $('#empty', el).style.display = 'none'; };
  $('#starter', el).onclick = () => fill(STARTER_PRIZES);
  $('#copy', el).onclick = async () => {
    const list = await busy(() => api.getPrizes(other)).catch(() => []);
    if (!list.length) return error(`${other} has no prizes saved yet.`);
    fill(list);
  };
  $('#add', el).onclick = () => { addRow(); $$('.cfg-row', rows).at(-1).querySelector('input').focus(); };

  $('#save', el).onclick = async () => {
    let ok = true;
    const list = $$('.cfg-row', rows).map(r => {
      const v = k => $(`[data-k=${k}]`, r);
      const p = { prize: v('prize').value.trim(), tokens: v('tokens').value.trim(), quantity: v('quantity').value.trim(), pinned: v('pinned').checked, unlimited: v('unlimited').checked };
      const bad = { prize: !p.prize, tokens: !/^\d{1,3}$/.test(p.tokens), quantity: !p.unlimited && !/^\d{1,4}$/.test(p.quantity) };
      Object.entries(bad).forEach(([k, b]) => { v(k).classList.toggle('invalid', b); if (b) ok = false; });
      return { prize: p.prize, tokens: Number(p.tokens), quantity: p.unlimited ? 0 : Number(p.quantity), pinned: p.pinned, unlimited: p.unlimited };
    });
    if (!ok) return error('Fix the highlighted boxes. Each prize needs a name, 1–3 digit tokens and a 1–4 digit quantity (unless it has no stock limit).');
    const names = list.map(p => p.prize.toLowerCase());
    if (new Set(names).size !== names.length) return error('Two prizes have the same name. Each prize name must be different.');
    try { await busy(() => api.savePrizes(side, list)); success(`${side} prize list is successfully updated.`); }
    catch (e) { console.error(e); error('Error updating prize list. Please try again.'); }
  };
}

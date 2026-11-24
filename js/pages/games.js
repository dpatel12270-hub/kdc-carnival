import api from '../backend/index.js';
import { $, $$, esc, html, busy, success, error } from '../ui.js';
import { STARTER_GAMES } from '../starter-data.js';

const shortCode = g => g.toLowerCase().split(/[\s\-_]+/).map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join('');

export async function render(el) {
  const games = await busy(() => api.getGames()).catch(() => []);
  el.innerHTML = `<section class="page-shell narrow"><div class="section-card">
    <div class="section-card__header"><span class="eyebrow">Admin</span><h1>Configure Games</h1><p>Add, update, or remove games and their ticket award values. Games are shared by I-Side and E-Side. The four numbers show up as quick buttons when giving tickets.</p></div>
    ${games.length ? '' : '<div class="banner-warn" style="margin-bottom:1rem;display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap"><span>No games yet.</span><button class="btn btn-sm" type="button" id="starter">Load the KDC 2026 games</button></div>'}
    <div class="row-list" id="rows"></div>
    <div class="form-actions form-actions--between" style="margin-top:1.4rem"><button class="btn btn-outline" type="button" id="add">＋ Add Game</button><button class="btn" type="button" id="save">✓ Save</button></div>
  </div></section>`;
  const rows = $('#rows', el);
  const addRow = (g = {}) => {
    const r = html(`<div class="cfg-row"><div class="cfg-main"><input class="input" data-k="game" placeholder="Game name" value="${esc(g.game || '')}"><small class="err" hidden>Game name is required.</small></div>
      <div class="cfg-nums">${[1, 2, 3, 4].map(n => `<div class="cfg-num"><span>Score ${n}</span><input class="input" data-k="score${n}" inputmode="numeric" maxlength="3" placeholder="0" value="${esc(g['score' + n] ?? '')}"></div>`).join('')}</div>
      <button class="icon-btn" type="button" title="Delete game" aria-label="Delete game">🗑</button></div>`);
    $('.icon-btn', r).onclick = () => r.remove();
    rows.appendChild(r);
  };
  games.forEach(addRow);
  if (!games.length) addRow();
  const st = $('#starter', el); if (st) st.onclick = () => { rows.innerHTML = ''; STARTER_GAMES.forEach(addRow); st.parentElement.remove(); };
  $('#add', el).onclick = () => { addRow(); $$('.cfg-row', rows).at(-1).querySelector('input').focus(); };
  $('#save', el).onclick = async () => {
    let ok = true;
    const list = $$('.cfg-row', rows).map(r => {
      const g = Object.fromEntries($$('[data-k]', r).map(i => [i.dataset.k, i.value.trim()]));
      const nameBad = !g.game; $('.err', r).hidden = !nameBad; $('[data-k=game]', r).classList.toggle('invalid', nameBad);
      const scores = [1, 2, 3, 4].map(n => g['score' + n]);
      [1, 2, 3, 4].forEach(n => {
        const v = g['score' + n]; const bad = !/^\d{1,3}$/.test(v) || scores.filter(x => x === v).length > 1;
        $(`[data-k=score${n}]`, r).classList.toggle('invalid', bad); if (bad) ok = false;
      });
      if (nameBad) ok = false;
      return { game: g.game, score1: Number(g.score1), score2: Number(g.score2), score3: Number(g.score3), score4: Number(g.score4), shortCode: shortCode(g.game || '') };
    });
    if (!ok) return error('Fix the highlighted boxes. Each game needs a name and four different 1–3 digit scores.');
    if (!list.length) return;
    try { await busy(() => api.saveGames(list.sort((a, b) => a.game.localeCompare(b.game)))); success('Game list is successfully updated.'); }
    catch (e) { console.error(e); error('Error updating game list. Please try again.'); }
  };
}

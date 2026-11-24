import api from '../backend/index.js';
import { $ } from '../ui.js';
import { liveStats } from '../stats.js';
import { EVENT_YEAR, CENTER_NAME } from '../config.js';

export async function render(el) {
  el.innerHTML = `<section class="page-shell">
    <div class="section-card"><div class="section-card__header" style="margin-bottom:.8rem"><span class="eyebrow">Live Stats</span><h1>${CENTER_NAME}</h1>
      <p>Participant activity for ${EVENT_YEAR}. Updates live while this page is open.</p></div>
      <span class="muted small" id="upd"></span></div>
    <div class="live-grid" id="grid"></div></section>`;

  const card = (label, key, hint, headline, s, pct) => {
    const v = o => (pct ? o[key] + '%' : Number(o[key]).toLocaleString());
    return `<div class="live-stat ${headline ? 'live-stat--headline' : ''}"><span class="live-stat__label">${label}</span><span class="live-stat__value">${v(s.total)}</span>
      ${hint ? `<span class="live-stat__hint">${hint}</span>` : ''}
      <div class="live-stat__wings"><div class="live-stat__wing"><span class="live-stat__wing-label">I-Side</span><span class="live-stat__wing-value">${v(s.iSide)}</span></div>
      <div class="live-stat__wing"><span class="live-stat__wing-label">E-Side</span><span class="live-stat__wing-value">${v(s.eSide)}</span></div>
      ${s.unassigned.registered ? `<div class="live-stat__wing" style="opacity:.7"><span class="live-stat__wing-label">No group</span><span class="live-stat__wing-value">${v(s.unassigned)}</span></div>` : ''}</div></div>`;
  };
  const unsub = api.watchParticipants(EVENT_YEAR, list => {
    const s = liveStats(list);
    $('#grid', el).innerHTML = card('Participants with tokens', 'withTokens', 'total tokens won greater than 0', true, s)
      + card('Registered', 'registered', '', false, s) + card('Active', 'activePct', 'with tokens ÷ registered', false, s, true)
      + card('Tokens won', 'tokensWon', '', false, s) + card('Prizes redeemed', 'prizesRedeemed', 'net of returns', false, s)
      + card('Goody bags given', 'goodyBags', `${s.total.goodyPct}% of registered`, false, s);
    $('#upd', el).textContent = 'Updated ' + new Date().toLocaleTimeString();
  });
  return () => unsub && unsub();
}

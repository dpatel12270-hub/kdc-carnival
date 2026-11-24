import api from '../backend/index.js';
import { $, esc, busy, error, fmtDateTime } from '../ui.js';
import { gameMetrics } from '../stats.js';
import { EVENT_YEAR, CENTER_NAME, SIDES } from '../config.js';

export async function render(el) {
  el.innerHTML = `<section class="page-shell">
    <div class="section-card no-print"><div class="section-card__header"><span class="eyebrow">Game Metrics</span><h1>Event Report Dashboard</h1>
      <p>An at-a-glance summary of participation, token movement, game activity and I-Side / E-Side prizes for ${CENTER_NAME}.</p></div>
      <div class="modern-form" style="max-width:520px">
        <label class="check"><input type="checkbox" id="kb"><div><b>Include Karyakar breakdown</b><span>Who gave which tickets and prizes</span></div></label>
        <div class="form-actions"><button class="btn btn-text" type="button" data-go="home">⌂ Home</button><button class="btn" type="button" id="gen">Generate Report</button><button class="btn btn-outline" type="button" id="pdf" hidden>Export PDF</button></div>
      </div></div>
    <div id="report"></div></section>`;

  $('#pdf', el).onclick = () => window.print();
  $('#gen', el).onclick = async () => {
    try {
      const [people, ...lists] = await busy(() => Promise.all([api.listParticipants(EVENT_YEAR), ...SIDES.map(s => api.getPrizes(s))]));
      const per = SIDES.map((s, i) => gameMetrics(people, lists[i], s));
      const m = per[0];
      const chip = (l, v, accent) => `<div class="stat-chip ${accent ? 'stat-chip--accent' : ''}"><span class="stat-chip__label">${l}</span><span class="stat-chip__value">${Number(v).toLocaleString()}</span></div>`;
      const prizeTable = (side, rows) => `<div class="section-card"><div class="section-card__header"><span class="side-tag ${side === 'E-Side' ? 'e' : ''}">${side}</span><h2>${side} Prize Distribution</h2><p>Listed alphabetically so any item can be easily spotted.</p></div>
        <div class="table-wrap"><table class="data"><thead><tr><th>No</th><th>Prize Name</th><th class="num">Total Quantity</th><th class="num">Times Distributed</th><th class="num">Times Returned</th><th class="num">Net Distributed</th><th class="num">Quantity Remaining</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="num">${r.total || '∞'}</td><td class="num">${r.given}</td><td class="num">${r.returned}</td><td class="num">${r.net}</td><td class="num">${r.total ? r.remaining : '—'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No prizes yet.</td></tr>'}</tbody></table></div></div>`;
      const kb = $('#kb', el).checked;
      $('#report', el).innerHTML = `
        <div class="section-card"><div class="section-card__header"><span class="eyebrow">Generated Report</span><h2>${CENTER_NAME} · ${EVENT_YEAR}</h2><p>Current snapshot of participant activity and token performance. Generated ${esc(new Date().toLocaleString())}.</p></div>
          <div class="stats-grid">${chip('Participants', m.participants, true)}${chip('Games Tracked', m.gameRows.length)}${chip('Games Played', m.gamesPlayed)}
          ${chip('I-Side Prizes Given', per[0].prizesDistributed)}${chip('E-Side Prizes Given', per[1].prizesDistributed)}
          ${chip('Tokens Awarded', m.tokensAwarded)}${chip('Tokens Used for Prizes', m.tokensUsed)}${chip('Average Max Tokens Won', m.avgWon)}${chip('Min Tokens Won', m.minWon)}${chip('Max Tokens Won', m.maxWon)}</div></div>
        <div class="section-card"><div class="section-card__header"><span class="eyebrow">Game Activity</span><h2>Games Statistics</h2><p>Most-played games appear first so you can spot trends quickly.</p></div>
          <div class="table-wrap"><table class="data"><thead><tr><th>No</th><th>Game Name</th><th class="num">I-Side Played</th><th class="num">E-Side Played</th><th class="num">Times Played</th><th class="num">Tokens Given</th></tr></thead><tbody>
          ${m.gameRows.map((g, i) => `<tr><td>${i + 1}</td><td>${esc(g.name)}</td><td class="num">${g.i}</td><td class="num">${g.e}</td><td class="num">${g.total}</td><td class="num">${g.tokens}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No games played yet.</td></tr>'}</tbody></table></div></div>
        ${prizeTable('I-Side', per[0].prizeRows)}${prizeTable('E-Side', per[1].prizeRows)}
        ${kb ? `<div class="section-card"><div class="section-card__header"><span class="eyebrow">Karyakar Activity</span><h2>Karyakar Breakdown</h2><p>Tokens awarded for games and prizes given or returned, by karyakar and participant.</p></div>
          <h3>Game Awards by Karyakar</h3><div class="table-wrap"><table class="data"><thead><tr><th>Karyakar</th><th>Game</th><th class="num">Tokens</th><th>Participant</th><th>Date/Time</th></tr></thead><tbody>
          ${m.kGames.map(r => `<tr><td>${esc(r.karyakar)}</td><td>${esc(r.game)}</td><td class="num">${r.tokens}</td><td>${esc(r.participant)}</td><td>${esc(fmtDateTime(r.timestamp))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">None yet.</td></tr>'}</tbody></table></div>
          <h3 style="margin-top:1.5rem">Prize Activity by Karyakar</h3><div class="table-wrap"><table class="data"><thead><tr><th>Karyakar</th><th>Side</th><th>Prize</th><th>Action</th><th class="num">Tokens</th><th>Participant</th><th>Date/Time</th></tr></thead><tbody>
          ${m.kPrizes.map(r => `<tr><td>${esc(r.karyakar)}</td><td>${esc(r.side)}</td><td>${esc(r.prize)}</td><td>${r.action}</td><td class="num">${r.tokens}</td><td>${esc(r.participant)}</td><td>${esc(fmtDateTime(r.timestamp))}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">None yet.</td></tr>'}</tbody></table></div></div>` : ''}`;
      $('#pdf', el).hidden = false;
    } catch (e) { console.error(e); error('Could not generate the report. Please try again.'); }
  };
}

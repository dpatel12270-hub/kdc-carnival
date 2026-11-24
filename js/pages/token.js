import api from '../backend/index.js';
import { $, $$, esc, error, success, alertBox, confirmBox, busy, center, userName, hasRole, ROLES as R, fmtDateTime } from '../ui.js';
import { go } from '../app.js';
import { nfcControl } from '../nfc.js';
import { entryName, entryCount, entryType, prizeBoardRows, returnedName } from '../stats.js';

const GRADES = ['KG & Below', '1', '2', '3', '4', '5', '6', '7', '8'];
const MAX_ADD = 50;

export async function render(el, params) {
  const id = params.id;
  let rec = null;
  try { rec = await busy(() => api.getParticipant(id)); } catch (e) { console.error(e); }
  if (!rec) {
    try { const p = JSON.parse(sessionStorage.getItem('kdc-scan') || 'null'); if (p && p.id === id) rec = p; } catch (e) { /* ignore */ }
  }
  if (!rec) { go('scan'); return; }
  if (!rec.assigned) renderRegister(el, rec); else await renderDetails(el, rec);
  return () => { while (cleanupFns.length) cleanupFns.pop()(); };
}

// ---------------- new participant ----------------
function renderRegister(el, rec) {
  el.innerHTML = `<section class="page-shell narrow"><div class="section-card">
    <div class="section-card__header"><span class="eyebrow">New Participant</span><h1>Register Badge</h1>
    <p>Complete the participant profile once, then the same badge can be used throughout the event.${rec.tagId ? ` Badge <b>${esc(rec.tagId)}</b>.` : ''}</p></div>
    <form class="modern-form" id="reg" novalidate>
      <div class="form-field"><label for="firstName">First Name</label><input class="input" id="firstName" placeholder="First Name"><small class="err" hidden>First Name must be at least 2 characters.</small></div>
      <div class="form-field"><label for="lastName">Last Name</label><input class="input" id="lastName" placeholder="Last Name"><small class="err" hidden>Last Name must be at least 2 characters.</small></div>
      <div class="form-field"><label for="parentName">Parent's Name</label><input class="input" id="parentName" placeholder="Guardian's Name"><small class="err" hidden>Parent's Name must be at least 3 characters.</small></div>
      <div class="form-field"><label for="grade">Grade</label><select class="input" id="grade">${GRADES.map(g => `<option>${g}</option>`).join('')}</select></div>
      <div class="form-field"><span class="lbl">Group</span><div class="seg" id="wing"><button type="button" data-v="I-Side" aria-pressed="false">I-Side</button><button type="button" data-v="E-Side" aria-pressed="false">E-Side</button></div><small class="err" id="wing-err" hidden>Pick a group.</small></div>
      <div class="form-actions form-actions--between"><button class="btn btn-text" type="button" data-go="scan">← Back</button><button class="btn" type="submit">✓ Submit</button></div>
    </form></div></section>`;
  let wing = '';
  $$('#wing button', el).forEach(b => b.onclick = () => { wing = b.dataset.v; $$('#wing button', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  $('#firstName', el).focus();
  $('#reg', el).addEventListener('submit', async e => {
    e.preventDefault();
    const f = k => $('#' + k, el).value.trim();
    const checks = [['firstName', 2], ['lastName', 2], ['parentName', 3]];
    let ok = true;
    checks.forEach(([k, n]) => { const bad = f(k).length < n; $('#' + k, el).classList.toggle('invalid', bad); $('#' + k, el).nextElementSibling.hidden = !bad; if (bad) ok = false; });
    $('#wing-err', el).hidden = !!wing; if (!wing) ok = false;
    if (!ok) return;
    const now = new Date().toISOString();
    const full = { ...rec, firstName: f('firstName'), lastName: f('lastName'), parentName: f('parentName'), grade: f('grade'), wing,
      assigned: true, tokenCount: 0, totalTokenWon: 0, isGoodBagReceived: false, winningHistory: [], created_at: now, updated_at: now };
    try {
      await busy(() => api.setParticipant(full));
      await success('Successfully registered badge.', { title: `${full.firstName} ${full.lastName}` });
      renderDetails(el, full);
    } catch (err) { error('Error registering participant. Please try again.\n' + (err.message || '')); }
  });
}

// ---------------- ticket management ----------------
const cleanupFns = [];
async function renderDetails(el, rec) {
  const canGame = hasRole(R.APP, R.SUPER, R.ADMIN);
  const canPrize = hasRole(R.PRIZE, R.SUPER, R.ADMIN);
  const canGift = hasRole(R.GIFT, R.SUPER, R.ADMIN);
  const sideOK = w => w === 'I-Side' || w === 'E-Side';
  const [games, prizesBySide, everyone] = await busy(() => Promise.all([
    api.getGames().catch(() => []),
    canPrize ? Promise.all(['I-Side', 'E-Side'].map(sd => api.getPrizes(sd).catch(() => []))).then(([i, e]) => ({ 'I-Side': i, 'E-Side': e })) : Promise.resolve({}),
    canPrize ? api.listParticipants(rec.year).catch(() => []) : Promise.resolve([])
  ]));
  const actions = [canGame && ['add', '＋ Add'], canGame && ['deduct', '－ Deduct'], canPrize && ['redeem', '🎁 Redeem Prize'], canPrize && ['return', '↩ Return Prize'], canGift && ['goody', '🛍 Goody Bag']].filter(Boolean);
  let action = '';

  el.innerHTML = `<section class="page-shell"><div class="details-layout">
    <div class="section-card">
      <div class="section-card__header"><span class="eyebrow">Ticket Summary</span><h1 id="who"></h1><p>Manage tickets quickly and keep a clean record of every update.</p></div>
      <div class="stats-grid">
        <div class="stat-chip"><span class="stat-chip__label">Guardian</span><span class="stat-chip__value" style="font-size:1.1rem" id="guardian"></span></div>
        <div class="stat-chip stat-chip--accent"><span class="stat-chip__label">Available Tickets</span><span class="stat-chip__value" id="balance"></span></div>
        <div class="stat-chip"><span class="stat-chip__label">Total Won</span><span class="stat-chip__value" id="won"></span></div>
        <div class="stat-chip"><span class="stat-chip__label">Group · Grade</span><span class="stat-chip__value" style="font-size:1.1rem" id="group"></span></div>
      </div>
      <div class="form-actions" style="margin-top:1.2rem"><button class="btn btn-text" type="button" data-go="home">⌂ Home</button><button class="btn btn-outline" type="button" data-go="scan">⌗ Scan next badge</button></div>
      <div id="nfc" style="margin-top:.8rem"></div>
    </div>
    <div class="section-card">
      <div class="section-card__header"><span class="eyebrow">Ticket Updates</span><h2>Adjust ticket count</h2></div>
      <div class="toggle-row" id="actions">${actions.map(([k, l]) => `<button type="button" data-a="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
      <div id="panel"></div>
    </div>
  </div>
  <div class="section-card"><details id="hist-box"><summary style="cursor:pointer;font-weight:800">Winning History</summary><div class="table-wrap" style="margin-top:1rem" id="hist"></div></details></div>
  </section>`;

  const nfc = nfcControl(); $('#nfc', el).appendChild(nfc);
  const paint = () => {
    $('#who', el).textContent = `${rec.firstName} ${rec.lastName}`;
    $('#guardian', el).textContent = rec.parentName || '—';
    $('#balance', el).textContent = Number(rec.tokenCount) || 0;
    $('#won', el).textContent = Number(rec.totalTokenWon) || 0;
    $('#group', el).textContent = `${rec.wing || '—'} · ${rec.grade || '—'}`;
    const h = (rec.winningHistory || []).slice().reverse();
    $('#hist', el).innerHTML = h.length ? `<table class="data"><thead><tr><th>Game / Prize</th><th class="num">Tickets</th><th>Karyakar</th><th>Time</th></tr></thead><tbody>${h.map(e => {
      const t = entryType(e); const n = entryName(e);
      const label = t === 'D' ? 'Tickets Deducted' : t === 'P' ? '🎁 ' + n : t === 'R' ? '↩ ' + n : n;
      return `<tr><td>${esc(label)}</td><td class="num">${entryCount(e) > 0 ? '+' : ''}${entryCount(e)}</td><td>${esc(Array.isArray(e.karyakarName) ? e.karyakarName[0] : e.karyakarName || '')}</td><td>${esc(fmtDateTime(e.timestamp))}</td></tr>`;
    }).join('')}</tbody></table>` : '<p class="muted" style="padding:1rem;margin:0">No activity yet.</p>';
  };
  paint();

  async function apply(mutate, label) {
    const before = Number(rec.tokenCount) || 0;
    try {
      rec = await busy(() => api.updateParticipant(rec.id, mutate));
      paint(); showPanel(action);
      await alertBox(`${label ? label + '<br>' : ''}Previous token count = ${before}<br><strong>New token count = ${Number(rec.tokenCount) || 0}</strong>`, { severity: 'success', title: `${rec.firstName} ${rec.lastName}`, html: true });
    } catch (e) { error(e.message || 'Error updating tokens. Please try again.'); }
  }
  const entry = (type, name, count) => ({ type, name, count, karyakarName: userName(), timestamp: new Date().toISOString() });

  function showPanel(a) {
    action = a;
    $$('#actions button', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === a)));
    const p = $('#panel', el);
    const bal = Number(rec.tokenCount) || 0;
    if (!a) { p.innerHTML = '<p class="muted">Choose what you want to do above.</p>'; return; }

    if (a === 'add') {
      p.innerHTML = `<form class="modern-form" id="f" novalidate>
        <div class="form-field"><label for="game">Game</label><select class="input" id="game"><option value="">Select a game</option>${games.map((g, i) => `<option value="${i}">${esc(g.game)}</option>`).join('')}</select><small class="err" id="game-err" hidden>Please select a game.</small></div>
        <div class="form-field" id="quick-wrap" hidden><span class="lbl">Quick amounts</span><div class="quick-scores" id="quick"></div></div>
        <div class="form-field"><label for="n">Ticket Count</label><input class="input" id="n" type="number" min="1" step="1" inputmode="numeric" placeholder="Enter ticket count"><small class="err" id="n-err" hidden></small></div>
        <div class="form-actions"><button class="btn" type="submit">＋ Add Tickets</button></div></form>`;
      const lastGame = sessionStorage.getItem('kdc-last-game');
      const gi = games.findIndex(g => g.game === lastGame);
      const sel = $('#game', p);
      const showQuick = () => {
        const g = games[sel.value];
        $('#quick-wrap', p).hidden = !g;
        if (g) $('#quick', p).innerHTML = [g.score1, g.score2, g.score3, g.score4].filter(v => v !== '' && v != null).map(v => `<button type="button" data-v="${esc(v)}" aria-pressed="false">${esc(v)}</button>`).join('');
        $$('#quick button', p).forEach(b => b.onclick = () => { $('#n', p).value = b.dataset.v; $$('#quick button', p).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
      };
      if (gi >= 0) sel.value = String(gi);
      sel.onchange = showQuick; showQuick();
      $('#f', p).onsubmit = e => {
        e.preventDefault();
        const g = games[sel.value]; const n = Number($('#n', p).value);
        $('#game-err', p).hidden = !!g;
        const nErr = !Number.isInteger(n) || n < 1 ? 'Count is required.' : n > MAX_ADD ? `Maximum ${MAX_ADD} tokens can be added at a time.` : '';
        $('#n-err', p).textContent = nErr; $('#n-err', p).hidden = !nErr;
        if (!g || nErr) return;
        sessionStorage.setItem('kdc-last-game', g.game);
        apply(r => ({ ...r, tokenCount: (Number(r.tokenCount) || 0) + n, totalTokenWon: (Number(r.totalTokenWon) || 0) + n,
          winningHistory: [...(r.winningHistory || []), entry('G', g.game, n)], updated_at: new Date().toISOString() }), `${esc(g.game)}: +${n}`);
      };
    }

    if (a === 'deduct') {
      p.innerHTML = `<form class="modern-form" id="f" novalidate>
        <div class="form-field"><label for="n">Ticket Count</label><input class="input" id="n" type="number" min="1" step="1" inputmode="numeric" placeholder="Enter ticket count"><small class="err" id="n-err" hidden></small></div>
        <div class="form-actions"><button class="btn btn-danger" type="submit">－ Deduct Tickets</button></div></form>`;
      $('#f', p).onsubmit = e => {
        e.preventDefault();
        const n = Number($('#n', p).value);
        const err = !Number.isInteger(n) || n < 1 ? 'Count is required.' : n > bal ? 'Can not deduct more than available tokens' : '';
        $('#n-err', p).textContent = err; $('#n-err', p).hidden = !err;
        if (err) return;
        apply(r => {
          if ((Number(r.tokenCount) || 0) < n) throw new Error('Can not deduct more than available tokens');
          return { ...r, tokenCount: (Number(r.tokenCount) || 0) - n, winningHistory: [...(r.winningHistory || []), entry('D', 'Tickets Deducted', -n)], updated_at: new Date().toISOString() };
        });
      };
    }

    if (a === 'redeem' && !sideOK(rec.wing)) {
      p.innerHTML = `<div class="result warn"><div class="status">Pick ${esc(rec.firstName)}'s group first</div><div>I-Side and E-Side have different prizes.</div>
        <div class="seg" style="margin-top:.4rem"><button type="button" data-w="I-Side">I-Side</button><button type="button" data-w="E-Side">E-Side</button></div></div>`;
      $$('[data-w]', p).forEach(b => b.onclick = async () => {
        try { rec = await busy(() => api.updateParticipant(rec.id, r => ({ ...r, wing: b.dataset.w, updated_at: new Date().toISOString() }))); paint(); showPanel('redeem'); } catch (e) { error(e.message); }
      });
      return;
    }
    if (a === 'redeem') {
      const side = rec.wing;
      const rows = prizeBoardRows(prizesBySide[side] || [], everyone.map(x => (x.id === rec.id ? rec : x)).filter(x => x.wing === side), side);
      p.innerHTML = rows.length ? `<p class="muted small" style="margin-top:0"><span class="side-tag ${side === 'E-Side' ? 'e' : ''}">${side} prizes</span> Tap a prize. Greyed-out prizes cost more than ${bal} tickets or are sold out.</p>
        <div class="prize-pick">${rows.map(r => {
          const out = !r.unlimited && r.remaining <= 0; const tooMuch = r.tokens > bal;
          return `<button type="button" class="prize-opt" data-p="${esc(r.prize)}" ${out || tooMuch ? 'disabled' : ''}>
            <span><b>${esc(r.prize)}</b>${r.pinned ? ' <span class="pill blue">Pinned</span>' : ''}<br><span class="small muted">${r.unlimited ? 'No stock limit' : out ? 'Sold out' : r.remaining + ' left'}</span></span><span class="t">${r.tokens} 🎟</span></button>`;
        }).join('')}</div>` : `<p class="muted">No ${side} prizes are set up yet. A Game Admin can add them in ${side} Prizes.</p>`;
      $$('.prize-opt', p).forEach(b => b.onclick = async () => {
        const pr = rows.find(r => r.prize === b.dataset.p);
        if (!(await confirmBox(`Give ${rec.firstName} "${pr.prize}" for ${pr.tokens} tickets?`, { title: 'Redeem prize', ok: 'Redeem' }))) return;
        apply(r => {
          if ((Number(r.tokenCount) || 0) < pr.tokens) throw new Error('Not enough tickets for this prize.');
          return { ...r, tokenCount: (Number(r.tokenCount) || 0) - pr.tokens, winningHistory: [...(r.winningHistory || []), { ...entry('P', pr.prize, -pr.tokens), side }], updated_at: new Date().toISOString() };
        }, `🎁 ${esc(pr.prize)}: −${pr.tokens}`);
        const me = everyone.find(x => x.id === rec.id); if (me) Object.assign(me, rec); else everyone.push(rec);
      });
    }

    if (a === 'return') {
      const net = {};
      (rec.winningHistory || []).forEach(e => {
        const t = entryType(e);
        if (t === 'P') { const n = entryName(e); net[n] = net[n] || { n: 0, tokens: Math.abs(entryCount(e)), side: e.side || rec.wing }; net[n].n++; }
        if (t === 'R') { const n = returnedName(entryName(e)); if (net[n]) net[n].n--; }
      });
      const list = Object.entries(net).filter(([, v]) => v.n > 0);
      p.innerHTML = list.length ? `<p class="muted small" style="margin-top:0">Prizes ${esc(rec.firstName)} has redeemed. Returning one refunds its tickets.</p>
        <div class="prize-pick">${list.map(([n, v]) => `<button type="button" class="prize-opt" data-p="${esc(n)}"><span><b>${esc(n)}</b><br><span class="small muted">${v.n} redeemed</span></span><span class="t">+${v.tokens} 🎟</span></button>`).join('')}</div>`
        : '<p class="muted">This participant has not redeemed any prizes.</p>';
      $$('.prize-opt', p).forEach(b => b.onclick = async () => {
        const n = b.dataset.p, tokens = net[n].tokens;
        if (!(await confirmBox(`Return "${n}" and refund ${tokens} tickets?`, { title: 'Return prize', ok: 'Return' }))) return;
        apply(r => ({ ...r, tokenCount: (Number(r.tokenCount) || 0) + tokens, winningHistory: [...(r.winningHistory || []), { ...entry('R', n + ' Returned', tokens), side: net[n].side }], updated_at: new Date().toISOString() }), `↩ ${esc(n)}: +${tokens}`);
      });
    }

    if (a === 'goody') {
      const got = rec.isGoodBagReceived === true;
      p.innerHTML = `<div class="result ${got ? 'ok' : ''}"><div class="status">${got ? 'Goody bag already given' : 'No goody bag yet'}</div>
        <div class="form-actions"><button class="btn ${got ? 'btn-outline' : 'btn-success'}" type="button" id="gb">${got ? 'Undo goody bag' : '🛍 Mark goody bag given'}</button></div></div>`;
      $('#gb', p).onclick = async () => {
        try { rec = await busy(() => api.updateParticipant(rec.id, r => ({ ...r, isGoodBagReceived: !got, goodyBagBy: userName(), goodyBagAt: new Date().toISOString(), updated_at: new Date().toISOString() }))); paint(); showPanel('goody'); success(!got ? 'Goody bag marked as given.' : 'Goody bag undone.'); }
        catch (e) { error(e.message); }
      };
    }
  }
  $$('#actions button', el).forEach(b => b.onclick = () => showPanel(b.dataset.a));
  cleanupFns.push(() => nfc.cleanup && nfc.cleanup());
  showPanel(actions.length === 1 ? actions[0][0] : (hasRole(R.APP) ? 'add' : actions[0]?.[0] || ''));
}

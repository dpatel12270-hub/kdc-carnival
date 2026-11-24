// Check-In Desk, Ticketing Desk and Candy Jar (from the old kdc-checkin page),
// now inside the carnival app. Registrations still come from the Jotform → Google Sheet.
// New: "Added" on the Ticketing Desk also creates the kid in the carnival system with their badge.
import api from '../backend/index.js';
import { $, $$, esc, busy, error, success, hasRole, ROLES as R, loadScript, fmtTime } from '../ui.js';
import { makeSheetClient, DEFAULT_SHEET_API, isLive } from '../checkin-api.js';
import { participantIdFor, cleanTag } from './scan.js';
import { EVENT_YEAR, CENTER, CENTER_NAME } from '../config.js';

// re-open this page through the app router so its cleanup is tracked
const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const hasAllergy = a => a && !/^(none|no|n\/?a|nope|-)$/i.test(String(a).trim());
export function normGrade(g) {
  const s = String(g || '').trim();
  if (/^(pre|k|kg|kindergarten|pre-?k|preschool|nursery)\b/i.test(s) || /below/i.test(s)) return 'KG & Below';
  const m = s.match(/\d+/); return m ? m[0] : s;
}

export async function render(el) {
  const cfg = await api.getConfig().catch(() => ({}));
  const isAdmin = hasRole(R.SUPER, R.ADMIN);
  const practice = !isLive(cfg) && api.isDemo && localStorage.getItem('kdc-practice') === '1';
  if (!isLive(cfg) && !practice) {
    if (!isAdmin) {
      el.innerHTML = `<section class="page-shell narrow"><div class="section-card"><div class="section-card__header"><span class="eyebrow">Check-In</span><h1>Check-in isn't connected yet</h1><p>Ask the KDC lead to connect the live check-in sheet.</p></div>
        ${api.isDemo ? '<button class="btn btn-outline" type="button" id="practice">Try it with a practice sheet</button>' : ''}</div></section>`;
      const pr = $('#practice', el); if (pr) pr.onclick = () => { localStorage.setItem('kdc-practice', '1'); rerender(); };
      return;
    }
    return renderSetup(el, cfg);
  }
  const sheet = makeSheetClient(cfg);
  const ctr = CENTER;
  let rows = [], view = localStorage.getItem('kdcView') || 'checkin', busyScan = false, cam = null, pollTimer = null, failures = 0, candySig = '';

  el.innerHTML = `<section class="page-shell">
    <div class="section-card" style="padding:1.1rem 1.25rem"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <div><span class="eyebrow">Check-In</span><h1 style="margin:.4rem 0 .3rem">Jungle of Sheru Check-In</h1>
        <span class="pill ${practice ? 'wait' : 'ok'}" id="live">${practice ? 'Practice sheet (not live)' : '● Live: Google Sheet'}</span> <span class="small muted" id="synced"></span></div>
      ${isAdmin ? '<button class="btn btn-text btn-sm" type="button" id="setup">⚙ Sheet settings</button>' : ''}</div>
      <div class="desk-tabs" style="margin-top:1rem"><button type="button" data-v="checkin">Check-In Desk</button><button type="button" data-v="ticketing">Ticketing Desk</button><button type="button" data-v="candy">Candy Jar</button></div>
      <div class="counter-grid" style="margin-top:1rem"><div class="counter"><b id="n-in">0</b><span>Kids checked in</span></div><div class="counter"><b id="n-wait">0</b><span>Waiting for ticketing</span></div><div class="counter"><b id="n-done">0</b><span>Added to ticketing</span></div></div>
      <div class="banner-warn" id="banner" style="margin-top:1rem" hidden></div>
    </div>

    <div id="view-checkin" class="page-shell" style="gap:1.25rem">
      <div class="section-card"><div class="section-card__header" style="margin-bottom:1rem"><h2 style="margin:0">Scan a registration QR</h2></div>
        <form id="scan-form" style="display:flex;gap:.6rem;flex-wrap:wrap"><input class="input" id="scan" style="flex:1;min-width:14rem;font-size:1.1rem" autocomplete="off" placeholder="QR code, registration ID, or name" aria-label="QR code, registration ID, or name">
          <button class="btn" type="submit" id="scan-go">Check in</button><button class="btn btn-outline" type="button" id="cam-btn">📷 Scan with camera</button></form>
        <p class="small muted">Keep this box selected. The QR scanner types the code and presses Enter. No QR? Type the child's or parent's name and press Enter.</p>
        <div id="reader" hidden></div>
        <div class="result" id="result"><div class="status">Ready for the next family</div><div>Each scan checks one child in and sends them to the ticketing desk.</div></div>
      </div>
      <div class="section-card"><h2 style="margin-top:0">Recently checked in</h2><ul class="list" id="recent"></ul></div>
    </div>

    <div id="view-ticketing" class="page-shell" style="gap:1.25rem" hidden>
      <div class="section-card"><div class="section-card__header" style="margin-bottom:1rem"><h2 style="margin:0">Waiting for ticketing</h2>
        <p>Pick the kid's group, type their badge #, then press <b>Added</b>. This also registers the badge in the carnival, so it's ready for games right away.</p></div>
        <ul class="list" id="queue"></ul></div>
      <div class="section-card"><div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center"><h2 style="margin:0">Added to ticketing</h2><input class="input" id="done-search" style="max-width:16rem" placeholder="Search name"></div>
        <ul class="list" id="done" style="margin-top:1rem"></ul></div>
    </div>

    <div id="view-candy" class="page-shell" style="gap:1.25rem" hidden>
      <div class="section-card"><h2 style="margin-top:0">Candy jar results</h2>
        <div class="form-field" style="max-width:16rem"><label for="candy-count">Actual candy count</label><input class="input" id="candy-count" inputmode="numeric" placeholder="Enter once counted"></div>
        <p class="muted small" id="candy-summary"></p><ul class="list" id="candy-board"></ul></div>
      <div class="section-card"><div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center"><h2 style="margin:0">Record a guess</h2><input class="input" id="candy-search" style="max-width:16rem" placeholder="Search name"></div>
        <ul class="list" id="candy-list" style="margin-top:1rem"></ul></div>
    </div>
  </section>`;

  const setResult = (kind, h) => { const r = $('#result', el); r.className = 'result ' + kind; r.innerHTML = h; };
  const banner = msg => { $('#banner', el).textContent = msg || ''; $('#banner', el).hidden = !msg; };
  const setup = $('#setup', el); if (setup) setup.onclick = () => renderSetup(el, cfg);

  function show(v) {
    view = v; localStorage.setItem('kdcView', v);
    ['checkin', 'ticketing', 'candy'].forEach(k => { $('#view-' + k, el).hidden = v !== k; });
    $$('.desk-tabs button', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    if (v !== 'checkin') stopCam(); else setTimeout(() => $('#scan', el)?.focus(), 0);
  }
  $$('.desk-tabs button', el).forEach(b => b.onclick = () => show(b.dataset.v));

  async function refresh() {
    try { rows = (await sheet.call('getState')) || []; failures = 0; banner(); draw(); const sy = $('#synced', el); if (sy) sy.textContent = 'synced ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }); }
    catch (e) { if (/PIN/.test(e.message)) banner("The check-in sheet PIN is wrong. An admin can fix it in Sheet settings."); else if (++failures >= 3) banner("Can't reach the check-in sheet. Check this device's internet connection."); }
  }

  const guessBox = r => `<div class="guess" style="width:100%"><span class="lbl">Candy jar guess (optional)</span><div style="display:flex;gap:.5rem;align-items:center;margin-top:.3rem;flex-wrap:wrap">
    <input class="input guess-in" style="max-width:9rem" data-gid="${esc(r.sid)}" inputmode="numeric" autocomplete="off" placeholder="How many?" value="${esc(r.guess || '')}">
    <button class="btn btn-outline btn-sm" type="button" data-guess="${esc(r.sid)}">Save guess</button>${r.guess !== '' && r.guess != null ? `<span class="pill ok saved">Saved: ${esc(r.guess)}</span>` : ''}</div></div>`;

  function showChecked(r) {
    setResult('ok', `<div class="status">Checked in · send to ticketing</div><div class="kid">${esc(r.first)} ${esc(r.last)}</div>
      ${hasAllergy(r.allergies) ? `<div class="allergy">Food allergy: ${esc(r.allergies)}</div>` : ''}
      <dl class="facts"><div><dt>Grade</dt><dd>${esc(r.grade || '—')}</dd></div><div><dt>Parent</dt><dd>${esc(r.parent || '—')}</dd></div><div><dt>Parent phone</dt><dd>${esc(r.phone || '—')}</dd></div><div><dt>Emergency phone</dt><dd>${esc(r.phone2 || '—')}</dd></div></dl>
      ${guessBox(r)}<div><button class="btn btn-text btn-sm" type="button" data-undo="${esc(r.sid)}">Undo this check-in</button></div>`);
  }

  async function doCheckIn(code) {
    if (busyScan) return; busyScan = true; $('#scan-go', el).disabled = true;
    setResult('', '<div class="status">Looking up…</div>');
    try {
      const res = await sheet.call('checkIn', code);
      if (res.result === 'ok') { showChecked(res.rec); refresh(); }
      else if (res.result === 'duplicate') setResult('warn', `<div class="status">Already checked in at ${esc(fmtTime(res.rec.inAt))}</div><div class="kid">${esc(res.rec.first)} ${esc(res.rec.last)}</div><div>This QR was scanned before. A sibling needs their own registration.</div>${guessBox(res.rec)}`);
      else if (res.result === 'not_found') setResult('bad', '<div class="status">Registration not found</div><div>No registration has this code. New registrations can take up to a minute to reach the sheet, so try again shortly. Otherwise, search their name or send them to the walk-in sign.</div>');
      else setResult('bad', "<div class=\"status\">That isn't a KDC check-in code</div><div>Scan the QR from the thank-you page or email, or type the child's name.</div>");
    } catch (e) {
      setResult('bad', `<div class="status">Couldn't check in</div><div>${/NOREG/.test(e.message) ? 'The sheet has no Jotform registrations tab yet.' : /PIN/.test(e.message) ? 'The check-in sheet PIN is wrong.' : 'Check the internet connection and scan again.'}</div>`);
    } finally { busyScan = false; $('#scan-go', el).disabled = false; if (!cam) $('#scan', el).focus(); }
  }
  async function doSearch(q) {
    setResult('', `<div class="status">Searching “${esc(q)}”…</div>`);
    try {
      const list = await sheet.call('searchByName', q);
      if (!list.length) return setResult('bad', `<div class="status">No registration matches “${esc(q)}”</div><div>Check the spelling, or send them to the walk-in sign to register.</div>`);
      setResult('', `<div class="status">Pick the child</div><ul class="list">${list.map(r => `<li class="item"><div class="who"><div class="nm">${esc(r.first)} ${esc(r.last)}</div><div class="sub">${esc(r.grade)} · parent ${esc(r.parent)}</div></div>
        ${r.checked ? '<span class="pill ok">Checked in</span>' : `<button class="btn btn-sm" type="button" data-pick="${esc(r.sid)}">Check in</button>`}</li>`).join('')}</ul>`);
    } catch (e) { setResult('bad', '<div class="status">Search failed</div><div>Check the internet connection and try again.</div>'); }
  }
  $('#scan-form', el).onsubmit = e => {
    e.preventDefault();
    const v = $('#scan', el).value.trim(); $('#scan', el).value = ''; if (!v) return;
    const digits = (v.match(/\d{12,22}/) || [])[0];
    if (digits) doCheckIn(digits); else if (/[a-z]/i.test(v)) doSearch(v); else doCheckIn(v);
  };

  // camera
  let lastCode = '', lastAt = 0;
  async function startCam() {
    try { await loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'); } catch (e) { return setResult('bad', "<div class=\"status\">The camera scanner didn't load</div><div>Check the internet connection and reload the page.</div>"); }
    $('#reader', el).hidden = false; $('#cam-btn', el).textContent = 'Stop camera';
    cam = new window.Html5Qrcode('reader');
    cam.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 } }, text => {
      const now = Date.now(); if (text === lastCode && now - lastAt < 5000) return; lastCode = text; lastAt = now;
      const d = (String(text).match(/\d{12,22}/) || [])[0];
      if (d) doCheckIn(d); else setResult('bad', "<div class=\"status\">That isn't a KDC check-in code</div><div>Scan the QR from the thank-you page or confirmation email.</div>");
    }).catch(() => { stopCam(); setResult('bad', "<div class=\"status\">Couldn't open the camera</div><div>Allow camera access for this page, then tap Scan with camera again. You can still type a name or use a USB scanner.</div>"); });
  }
  function stopCam() { const c = cam; cam = null; if (c) c.stop().catch(() => {}).then(() => { try { c.clear(); } catch (e) { /* ignore */ } }); const r = $('#reader', el); if (r) r.hidden = true; const b = $('#cam-btn', el); if (b) b.textContent = '📷 Scan with camera'; }
  $('#cam-btn', el).onclick = () => (cam ? stopCam() : startCam());

  // ticketing desk: register the badge in the carnival system, then mark added in the sheet
  async function addToTicketing(sid, btn) {
    const r = rows.find(x => x.sid === sid); if (!r) return;
    const li = btn.closest('li');
    const badge = cleanTag($('.badge-in', li).value);
    const wing = $('.wing-in', li).value;
    if (!badge) { $('.badge-in', li).classList.add('invalid'); $('.badge-in', li).focus(); return; }
    if (!wing) { $('.wing-in', li).classList.add('invalid'); return; }
    btn.disabled = true;
    try {
      await busy(async () => {
        const existing = await api.findParticipantByTag(EVENT_YEAR, badge);
        if (existing && existing.regSid !== sid && existing.assigned) {
          throw new Error(`Badge ${badge} already belongs to ${existing.firstName} ${existing.lastName}. Use a different badge.`);
        }
        const now = new Date().toISOString();
        await api.setParticipant({ ...(existing || {}), id: existing ? existing.id : participantIdFor(EVENT_YEAR, badge), tagId: badge, regSid: sid,
          firstName: r.first, lastName: r.last, parentName: r.parent || '', grade: normGrade(r.grade), wing, center: ctr, year: String(EVENT_YEAR),
          phone: r.phone || '', allergies: hasAllergy(r.allergies) ? r.allergies : '', assigned: true,
          tokenCount: existing?.tokenCount || 0, totalTokenWon: existing?.totalTokenWon || 0, isGoodBagReceived: existing?.isGoodBagReceived || false,
          winningHistory: existing?.winningHistory || [], created_at: existing?.created_at || now, updated_at: now });
        await sheet.call('markAdded', sid, badge);
      });
      refresh();
    } catch (e) { btn.disabled = false; error(e.message || "Couldn't add that kid. Try again."); }
  }

  const arm = (btn, label, reset) => {
    if (btn.dataset.armed === '1') return true;
    btn.dataset.armed = '1'; btn.textContent = label;
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = reset; } }, 4000);
    return false;
  };
  async function saveGuess(sid, btn) {
    const inp = btn.parentNode.querySelector('.guess-in'); if (!inp) return;
    const raw = inp.value.trim();
    if (/\d{12,}/.test(raw)) { inp.value = ''; doCheckIn(raw.match(/\d{12,22}/)[0]); return; }
    const g = raw.replace(/[^0-9]/g, '');
    if (raw && !g) return banner('A guess has to be a number.');
    btn.disabled = true;
    try { await sheet.call('setGuess', sid, g); rows.forEach(x => { if (x.sid === sid) x.guess = g; });
      const row = btn.parentNode; row.querySelector('.saved')?.remove(); if (g) row.insertAdjacentHTML('beforeend', `<span class="pill ok saved">Saved: ${esc(g)}</span>`);
      inp.blur(); candySig = ''; banner(); draw(); if (view === 'checkin' && !cam) $('#scan', el).focus();
    } catch (e) { banner("Couldn't save that guess. Try again."); } finally { btn.disabled = false; }
  }

  const onClick = async e => {
    const t = e.target.closest('button');
    if (!t || !el.contains(t)) { if (view === 'checkin' && !cam && !e.target.closest('input, select, a') && el.contains(e.target)) $('#scan', el)?.focus(); return; }
    if (t.dataset.pick) return doCheckIn(t.dataset.pick);
    if (t.dataset.guess) return saveGuess(t.dataset.guess, t);
    if (t.dataset.undo) { if (!arm(t, 'Tap again to undo', 'Undo this check-in')) return; t.disabled = true; try { await sheet.call('undoCheckIn', t.dataset.undo); setResult('', '<div class="status">Check-in undone</div>'); refresh(); } catch (e2) { t.disabled = false; } $('#scan', el).focus(); return; }
    if (t.dataset.add) return addToTicketing(t.dataset.add, t);
    if (t.dataset.back) { if (!arm(t, 'Tap to confirm', 'Move back')) return; t.disabled = true; try { await sheet.call('moveBack', t.dataset.back); refresh(); } catch (e2) { t.disabled = false; } }
  };
  const onKey = e => {
    if (e.key !== 'Enter' || !e.target.classList) return;
    if (e.target.classList.contains('guess-in')) { e.preventDefault(); e.target.parentNode.querySelector('[data-guess]')?.click(); }
    if (e.target.classList.contains('badge-in')) { e.preventDefault(); const li = e.target.closest('li'); const w = $('.wing-in', li); if (!w.value) w.focus(); else $('[data-add]', li)?.click(); }
  };
  el.addEventListener('click', onClick); el.addEventListener('keydown', onKey);
  $('#done-search', el).oninput = draw;
  $('#candy-search', el).oninput = draw;
  $('#candy-count', el).value = localStorage.getItem('kdcCandy') || '';
  $('#candy-count', el).oninput = () => { localStorage.setItem('kdcCandy', $('#candy-count', el).value); draw(); };

  function drawCandy() {
    const guessed = rows.filter(r => r.guess !== '' && r.guess != null);
    const c = String($('#candy-count', el).value).replace(/[^0-9]/g, ''); const actual = c === '' ? null : Number(c);
    $('#candy-summary', el).textContent = `${guessed.length} of ${rows.length} checked-in kids have guessed.` + (actual == null ? ' Showing all guesses, highest first.' : ` Closest to ${actual} first.`);
    const list = guessed.map(r => ({ r, g: Number(r.guess), d: actual == null ? 0 : Math.abs(Number(r.guess) - actual) }));
    list.sort((a, b) => (actual == null ? b.g - a.g : a.d - b.d || String(a.r.inAt).localeCompare(String(b.r.inAt))));
    const best = list.length && actual != null ? list[0].d : -1;
    $('#candy-board', el).innerHTML = list.length ? list.slice(0, actual == null ? 200 : 15).map((x, i) => { const win = actual != null && x.d === best;
      return `<li class="item ${win ? 'win' : ''}">${actual != null ? `<span class="rank">${i + 1}</span>` : ''}<div class="who"><div class="nm">${esc(x.r.first)} ${esc(x.r.last)}</div><div class="sub">${esc(x.r.grade)}${actual != null ? ' · ' + (x.d === 0 ? 'exactly right' : 'off by ' + x.d) : ''}${win ? ' · <b>Winner</b>' : ''}</div></div><span class="gnum">${esc(x.r.guess)}</span></li>`; }).join('') : '<li class="empty">No guesses yet.</li>';
    const act = document.activeElement;
    if (act && act.classList.contains('guess-in') && $('#candy-list', el).contains(act)) return;
    const sig = $('#candy-search', el).value + '|' + rows.map(r => r.sid + ':' + r.guess).join(',');
    if (sig === candySig) return; candySig = sig;
    const q = $('#candy-search', el).value.trim().toLowerCase();
    const kids = rows.filter(r => !q || (r.first + ' ' + r.last).toLowerCase().includes(q)).sort((a, b) => (a.first + a.last).localeCompare(b.first + b.last));
    $('#candy-list', el).innerHTML = kids.length ? kids.map(r => `<li class="item"><div class="who"><div class="nm">${esc(r.first)} ${esc(r.last)}</div><div class="sub">${esc(r.grade)}</div></div>${guessBox(r)}</li>`).join('')
      : `<li class="empty">${q ? 'No checked-in kid matches that name.' : "Kids show up here once they're checked in."}</li>`;
  }

  function draw() {
    if (!el.isConnected) return;
    drawCandy();
    const waiting = rows.filter(r => r.status !== 'Added to ticketing').sort((a, b) => String(a.inAt).localeCompare(String(b.inAt)));
    const done = rows.filter(r => r.status === 'Added to ticketing').sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
    $('#n-in', el).textContent = rows.length; $('#n-wait', el).textContent = waiting.length; $('#n-done', el).textContent = done.length;
    const recent = rows.slice().sort((a, b) => String(b.inAt).localeCompare(String(a.inAt))).slice(0, 12);
    $('#recent', el).innerHTML = recent.length ? recent.map(r => { const added = r.status === 'Added to ticketing';
      return `<li class="item"><div class="who"><div class="nm">${esc(r.first)} ${esc(r.last)}</div><div class="sub">${esc(fmtTime(r.inAt))} · ${esc(r.grade)}</div></div>${hasAllergy(r.allergies) ? '<span class="pill bad">Allergy</span>' : ''}<span class="pill ${added ? 'ok' : 'wait'}">${added ? 'In ticketing' : 'Waiting'}</span></li>`; }).join('')
      : "<li class=\"empty\">Kids appear here as soon as they're scanned, on every device.</li>";

    // keep what volunteers are typing in badge boxes across refreshes
    const typed = {}; const focused = document.activeElement?.classList.contains('badge-in') ? document.activeElement.dataset.id : null;
    $$('#queue li', el).forEach(li => { const b = $('.badge-in', li), w = $('.wing-in', li); if (b) typed[b.dataset.id] = [b.value, w.value]; });
    const sig = waiting.map(r => r.sid).join(',');
    if ($('#queue', el).dataset.sig !== sig) {
      $('#queue', el).dataset.sig = sig;
      $('#queue', el).innerHTML = waiting.length ? waiting.map(r => `<li class="item"><div class="ticket-row" style="width:100%">
        <div class="who"><div class="nm">${esc(r.first)} ${esc(r.last)}</div><div class="sub">${esc(r.grade)} · parent ${esc(r.parent || '—')} · checked in ${esc(fmtTime(r.inAt))}${hasAllergy(r.allergies) ? ` · <b style="color:#b91c1c">Allergy: ${esc(r.allergies)}</b>` : ''}</div></div>
        <select class="input wing-in" data-id="${esc(r.sid)}" aria-label="Group for ${esc(r.first)}"><option value="">Group…</option><option>I-Side</option><option>E-Side</option></select>
        <input class="input badge-in" data-id="${esc(r.sid)}" placeholder="Badge #" autocomplete="off" aria-label="Badge number for ${esc(r.first)}">
        <button class="btn btn-sm btn-success" type="button" data-add="${esc(r.sid)}">Added</button></div></li>`).join('')
        : '<li class="empty">No one is waiting. New check-ins show up here within a few seconds.</li>';
      $$('#queue li', el).forEach(li => { const b = $('.badge-in', li); if (!b) return; const t = typed[b.dataset.id]; if (t) { b.value = t[0]; $('.wing-in', li).value = t[1]; } if (b.dataset.id === focused) b.focus(); });
    }
    const q = $('#done-search', el).value.trim().toLowerCase();
    const shown = done.filter(r => !q || (r.first + ' ' + r.last).toLowerCase().includes(q));
    $('#done', el).innerHTML = shown.length ? shown.map(r => `<li class="item"><div class="who"><div class="nm">${esc(r.first)} ${esc(r.last)}</div><div class="sub">Added ${esc(fmtTime(r.addedAt))}${r.badge ? ' · badge ' + esc(r.badge) : ''}</div></div><button class="btn btn-text btn-sm" type="button" data-back="${esc(r.sid)}">Move back</button></li>`).join('')
      : `<li class="empty">${q ? 'No added kids match that name.' : 'Nobody added yet.'}</li>`;
  }

  show(/^(ticketing|candy)$/.test(view) ? view : 'checkin');
  draw();
  await refresh();
  pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, 3000);
  return () => { clearInterval(pollTimer); stopCam(); el.removeEventListener('click', onClick); el.removeEventListener('keydown', onKey); };
}

function renderSetup(el, cfg) {
  el.innerHTML = `<section class="page-shell narrow"><div class="section-card">
    <div class="section-card__header"><span class="eyebrow">Check-In</span><h1>Connect the live check-in sheet</h1>
      <p>Check-in reads the Jotform registrations from your Google Sheet live, through the same Apps Script link the old kdc-checkin page used. Enter the sheet PIN once here, and every check-in volunteer can use it with just their access code.</p></div>
    <div class="modern-form">
      <div class="form-field"><label for="pin">Check-in sheet PIN</label><input class="input" id="pin" autocomplete="off" value="${esc(cfg.sheetPin || '')}"></div>
      <div class="form-field"><label for="url">Apps Script web app link</label><input class="input" id="url" value="${esc(cfg.sheetApiUrl || DEFAULT_SHEET_API)}"></div>
      <div class="form-actions form-actions--between"><button class="btn btn-text" type="button" data-go="home">⌂ Home</button>
        <span style="display:flex;gap:.6rem;flex-wrap:wrap">${api.isDemo && !cfg.sheetPin ? '<button class="btn btn-outline" type="button" id="practice">Use a practice sheet</button>' : ''}<button class="btn" type="button" id="save">Test &amp; save</button></span></div>
    </div></div></section>`;
  const pr = $('#practice', el); if (pr) pr.onclick = () => { localStorage.setItem('kdc-practice', '1'); rerender(); };
  $('#save', el).onclick = async () => {
    const pin = $('#pin', el).value.trim();
    if (!pin) return error('Enter the sheet PIN.');
    const latest = await api.getConfig().catch(() => cfg);
    const next = { ...latest, sheetPin: pin, sheetApiUrl: $('#url', el).value.trim() || DEFAULT_SHEET_API };
    try {
      await busy(() => makeSheetClient(next).call('checkPin'));
      await busy(() => api.saveConfig(next));
      localStorage.removeItem('kdc-practice');
      await success('Connected to the live check-in sheet.');
      rerender();
    } catch (e) { error(/PIN/.test(e.message) ? "That PIN didn't work. Use the same PIN as the old check-in page." : "Couldn't reach the sheet. Check the link and this device's internet connection."); }
  };
}

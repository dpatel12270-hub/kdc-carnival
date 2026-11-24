// Program Badges: put this site's link on each NFC badge so any phone (iPhone too) opens the kid by tapping.
import { $, esc, error } from '../ui.js';
import { nfcSupported, isIOS, writeNextBadge, badgeUrl } from '../nfc.js';

export function render(el) {
  const base = badgeUrl('');
  let stop = null, count = 0;
  el.innerHTML = `<section class="page-shell narrow">
    <div class="section-card"><div class="section-card__header"><span class="eyebrow">Badges</span><h1>Program Badges</h1>
      <p>Each badge gets a link to this site with its own badge ID. After that, tapping a badge on <b>any iPhone or Android</b> opens that kid at the games and the prize booth. Do this once per badge before the event.</p></div>

      <div id="android" ${nfcSupported() ? '' : 'hidden'}>
        <div class="form-field"><span class="lbl">Badge ID to write</span>
          <div class="seg" id="mode"><button type="button" data-m="chip" aria-pressed="true">Chip's own ID</button><button type="button" data-m="num" aria-pressed="false">Numbers</button></div></div>
        <div class="cfg-nums" id="num-opts" hidden style="margin-top:.8rem;justify-content:flex-start">
          <div class="cfg-num"><span>Prefix</span><input class="input" id="prefix" value="K" style="width:5rem"></div>
          <div class="cfg-num"><span>Next number</span><input class="input" id="next" inputmode="numeric" value="${esc(localStorage.getItem('kdc-next-badge') || '1')}" style="width:6rem"></div>
        </div>
        <p class="small muted">Use <b>Numbers</b> if you want to write the same number on the badge with a marker (K001, K002…).</p>
        <div class="form-actions"><button class="btn btn-orange" type="button" id="go">📱 Start programming badges</button><button class="btn btn-outline" type="button" id="halt" hidden>Stop</button></div>
        <div class="result" id="status" style="margin-top:1rem"><div class="status">Ready</div><div>Press start, then hold each badge to the back of this phone until it buzzes.</div></div>
        <ul class="list" id="done" style="margin-top:1rem"></ul>
      </div>

      <div id="ios" ${nfcSupported() ? 'hidden' : ''}>
        ${isIOS() ? '<div class="banner-warn" style="margin-bottom:1rem">On iPhone, badges are programmed with the free <b>NFC Tools</b> app (websites can\'t write badges on iPhone). Or use any Android phone with Chrome on this page, which is faster.</div>' : '<div class="banner-warn" style="margin-bottom:1rem">Open this page in Chrome on an Android phone to program badges by tapping, or use the iPhone steps below.</div>'}
        <ol style="line-height:1.9;padding-left:1.2rem;margin:0">
          <li>Install <b>NFC Tools</b> (free) from the App Store.</li>
          <li>Open it → <b>Write</b> → <b>Add a record</b> → <b>URL / URI</b>.</li>
          <li>Paste this link and add the badge number at the end:<br><span class="code-chip" style="word-break:break-all">${esc(base)}K001</span>
            <button class="btn btn-text btn-sm" type="button" id="copy">Copy link</button></li>
          <li>Tap <b>Write</b> and hold the badge to the top of the iPhone. Repeat with K002, K003…</li>
        </ol>
      </div>
    </div>
    <div class="section-card"><h2 style="margin-top:0">How volunteers use it</h2>
      <ul style="line-height:1.8;padding-left:1.2rem;margin:0">
        <li><b>iPhone:</b> keep the KDC site open in Safari. Hold the badge near the top of the phone, then tap the link that pops up.</li>
        <li><b>Android:</b> tap <b>Use this phone to read badges</b> once. After that, badges open right away with no pop-up.</li>
      </ul></div>
  </section>`;

  const copy = $('#copy', el);
  if (copy) copy.onclick = async () => { try { await navigator.clipboard.writeText(base + 'K001'); copy.textContent = 'Copied'; } catch (e) { copy.textContent = 'Select and copy the link'; } };
  if (!nfcSupported()) return;

  let mode = 'chip';
  el.querySelectorAll('#mode button').forEach(b => b.onclick = () => {
    mode = b.dataset.m;
    el.querySelectorAll('#mode button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#num-opts', el).hidden = mode !== 'num';
  });
  const status = (kind, title, body) => { const s = $('#status', el); s.className = 'result ' + kind; s.innerHTML = `<div class="status">${esc(title)}</div><div>${body}</div>`; };
  const makeCode = (serial) => {
    if (mode === 'chip') return serial;
    const n = Math.max(1, parseInt($('#next', el).value, 10) || 1);
    return ($('#prefix', el).value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'K') + String(n).padStart(3, '0');
  };
  async function loop() {
    $('#go', el).hidden = true; $('#halt', el).hidden = false;
    const ac = new AbortController(); stop = () => ac.abort();
    while (!ac.signal.aborted && el.isConnected) {
      status('', 'Waiting for a badge…', 'Hold the next badge to the back of this phone.');
      try {
        const code = await writeNextBadge(makeCode, ac.signal);
        count++;
        if (mode === 'num') { const n = (parseInt($('#next', el).value, 10) || 1) + 1; $('#next', el).value = n; localStorage.setItem('kdc-next-badge', String(n)); }
        $('#done', el).insertAdjacentHTML('afterbegin', `<li class="item"><div class="who"><div class="nm">Badge ${esc(code)}</div><div class="sub">Link written ✓</div></div><span class="pill ok">#${count}</span></li>`);
        status('ok', `Badge ${code} done`, 'Take it off the phone, then hold the next one.');
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        if (ac.signal.aborted) break;
        status('bad', 'Not written', esc(e.message));
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    $('#go', el).hidden = false; $('#halt', el).hidden = true;
    status('', 'Stopped', `${count} badge(s) programmed this session.`);
  }
  $('#go', el).onclick = () => loop().catch(e => error(e.message));
  $('#halt', el).onclick = () => stop && stop();
  return () => stop && stop();
}

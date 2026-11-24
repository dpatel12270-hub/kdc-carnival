import api from '../backend/index.js';
import { $, $$, esc, busy, success, error, confirmBox, ROLE_INFO, ROLES as R, randomCode } from '../ui.js';
import { CENTER } from '../config.js';

const PRESETS = [
  ['Game volunteer', 'GAME', [R.APP]],
  ['Prize booth', 'PRIZE', [R.APP, R.PRIZE, R.GIFT]],
  ['Check-in desk', 'CHECKIN', [R.CHECKIN]],
  ['TV boards', 'TV', [R.BOARD]],
  ['Admin', 'ADMIN', [R.ADMIN, R.APP, R.PRIZE, R.GIFT, R.GAME, R.BOARD, R.CHECKIN]]
];
const roleName = r => (ROLE_INFO.find(x => x[0] === r) || [r, r === 'SUPER_ADMIN_USER' ? 'Admin' : r])[1];

export async function render(el) {
  const ctr = CENTER;
  el.innerHTML = `<section class="page-shell narrow">
  <div class="section-card">
    <div class="section-card__header"><span class="eyebrow">Admin</span><h1>Access Codes</h1>
      <p>Volunteers log in with their name and one of these codes. The code decides what they can do. Share each code only with the people who need it. Turning a code off locks it for new logins.</p></div>
    <div class="modern-form">
      <div class="form-field"><span class="lbl">Start from</span><div class="desk-tabs" id="presets">${PRESETS.map(([l], i) => `<button type="button" data-i="${i}" aria-pressed="false">${l}</button>`).join('')}</div></div>
      <div class="form-field"><label for="label">Label</label><input class="input" id="label" placeholder="e.g. Game volunteers"></div>
      <div class="form-field"><label for="code">Code</label><div style="display:flex;gap:.5rem"><input class="input" id="code" style="text-transform:uppercase;font-family:ui-monospace,monospace;letter-spacing:.05em"><button class="btn btn-outline btn-sm" type="button" id="regen">New code</button></div></div>
      <div class="form-field"><span class="lbl">Permissions</span><div style="display:grid;gap:.5rem">
        ${ROLE_INFO.map(([r, n, d]) => `<label class="check"><input type="checkbox" value="${r}"><div><b>${n}</b><span>${d}</span></div></label>`).join('')}</div></div>
      <div class="form-actions"><button class="btn" type="button" id="create">🔑 Create code</button></div>
    </div>
  </div>
  <div class="section-card"><div class="section-card__header"><span class="eyebrow">Codes</span><h2>All codes</h2></div><div id="list"></div></div>
  </section>`;

  const codeIn = $('#code', el), labelIn = $('#label', el);
  let prefix = 'APP';
  const regen = () => { codeIn.value = randomCode(`ROK-${prefix}`); };
  regen();
  $('#regen', el).onclick = regen;
  $$('#presets button', el).forEach(b => b.onclick = () => {
    const [label, pre, roles] = PRESETS[b.dataset.i];
    $$('#presets button', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    labelIn.value = label; prefix = pre; regen();
    $$('.check input', el).forEach(c => { c.checked = roles.includes(c.value); });
  });

  const load = async () => {
    const codes = await busy(() => api.listAccessCodes()).catch(e => { console.error(e); return []; });
    $('#list', el).innerHTML = codes.length ? `<ul class="list">${codes.sort((a, b) => a.label.localeCompare(b.label)).map(c => `<li class="item">
      <div class="who"><div class="nm">${esc(c.label || 'Untitled')} ${c.active === false ? '<span class="pill bad">Off</span>' : '<span class="pill ok">On</span>'}</div>
      <div class="sub" style="margin:.3rem 0"><span class="code-chip">${esc(c.code)}</span></div><div class="sub">${(c.roles || []).map(roleName).join(' · ')}</div></div>
      <button class="btn btn-outline btn-sm" type="button" data-toggle="${esc(c.code)}">${c.active === false ? 'Turn on' : 'Turn off'}</button>
      <button class="icon-btn" type="button" data-del="${esc(c.code)}" aria-label="Delete code">🗑</button></li>`).join('')}</ul>` : '<p class="muted">No codes yet. Create one above.</p>';
    $$('[data-toggle]', el).forEach(b => b.onclick = async () => {
      const c = codes.find(x => x.code === b.dataset.toggle);
      try { await busy(() => api.saveAccessCode({ ...c, active: c.active === false })); load(); } catch (e) { error(e.message); }
    });
    $$('[data-del]', el).forEach(b => b.onclick = async () => {
      if (!(await confirmBox(`Delete code ${b.dataset.del}? Anyone using it won't be able to log in with it again.`, { ok: 'Delete', danger: true }))) return;
      try { await busy(() => api.deleteAccessCode(b.dataset.del)); load(); } catch (e) { error(e.message); }
    });
  };

  $('#create', el).onclick = async () => {
    const code = codeIn.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const roles = $$('.check input:checked', el).map(c => c.value);
    if (code.length < 8) return error('Codes need at least 8 letters or numbers so they are hard to guess.');
    if (!roles.length) return error('Pick at least one permission.');
    try {
      await busy(() => api.saveAccessCode({ code, label: labelIn.value.trim() || 'Access code', center: ctr, roles, active: true, created_at: new Date().toISOString() }));
      await success(`Code ${code} is ready. Share it with the volunteers who need it.`);
      regen(); load();
    } catch (e) { error(e.message || 'Could not create the code.'); }
  };
  load();
}

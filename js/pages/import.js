import api from '../backend/index.js';
import { $, esc, busy, success, error, confirmBox, loadScript, parseCSV } from '../ui.js';
import { participantIdFor, cleanTag } from './scan.js';
import { EVENT_YEAR, CENTER } from '../config.js';

const HEAD = ['Sequence No', 'Tag ID', 'First Name', 'Last Name', 'Parent Name', 'Grade', 'Group'];
const GROUPS = ['I-Side', 'E-Side'];
const GRADES = ['KG & Below', '1', '2', '3', '4', '5', '6', '7', '8'];
const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';

export function render(el) {
  let rows = [];
  el.innerHTML = `<section class="page-shell">
    <div><span class="eyebrow">Data Management</span><h1 style="margin:.5rem 0">Import Participants</h1><p class="muted" style="margin:0">Download the template, fill in participant data, then upload to bulk-register.</p></div>
    <div class="section-card">
      <div class="section-card__header"><span class="eyebrow">Bulk Import</span><h2>Import Participants</h2><p>Upload an Excel or CSV file to import participant data in one go.</p></div>
      <div class="banner-warn" style="margin-bottom:1rem">⚠️ <b>Existing records will be overwritten.</b> Importing replaces any participant that has the same <b>Tag ID</b> (badge number), including their ticket history. This can't be undone.</div>
      <div class="cfg-row" style="border:1px solid var(--border-soft);border-radius:.9rem;margin-bottom:1rem"><div class="cfg-main"><b>Excel Template</b><span class="small muted">${HEAD.join(' · ')}</span></div><button class="btn btn-outline btn-sm" type="button" id="tpl">Download Template</button></div>
      <label class="check" style="justify-content:center;padding:1.4rem"><input type="file" id="file" accept=".xlsx,.xls,.csv" style="display:none"><span id="file-lbl" style="font-weight:700;color:var(--accent)">📄 Click to select an Excel file (.xlsx / .xls) or .csv</span></label>
      <small class="err" id="perr" hidden></small>
      <div id="preview" style="margin-top:1rem"></div>
      <div class="form-actions form-actions--between" style="margin-top:1.2rem"><button class="btn btn-text" type="button" data-go="home">⌂ Back to Home</button><button class="btn" type="button" id="imp" disabled>Import</button></div>
    </div></section>`;

  $('#tpl', el).onclick = async () => {
    try {
      await loadScript(XLSX_URL);
      const X = window.XLSX; const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([HEAD]), 'Participants');
      X.writeFile(wb, 'kdc-participants-template.xlsx');
    } catch (e) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([HEAD.join(',') + '\n'], { type: 'text/csv' }));
      a.download = 'kdc-participants-template.csv'; a.click();
    }
  };

  const showPreview = () => {
    const badG = rows.filter(r => r.gradeInvalid).length, badW = rows.filter(r => r.groupInvalid).length;
    $('#preview', el).innerHTML = rows.length ? `
      ${badG || badW ? `<div class="banner-warn" style="background:#fee2e2;color:#991b1b;margin-bottom:.8rem">${badG ? `${badG} row(s) have an invalid Grade (use ${GRADES.join(', ')}). ` : ''}${badW ? `${badW} row(s) have an invalid Group (use I-Side or E-Side).` : ''}</div>` : `<p class="small muted">${rows.length} participant(s) ready to import.</p>`}
      <div class="table-wrap" style="max-height:420px;overflow:auto"><table class="data"><thead><tr><th>Seq #</th><th>Tag ID</th><th>First Name</th><th>Last Name</th><th>Parent Name</th><th>Grade</th><th>Group</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.gradeInvalid || r.groupInvalid ? 'invalid' : ''}"><td>${esc(r.seq)}</td><td>${esc(r.tagId)}</td><td>${esc(r.firstName)}</td><td>${esc(r.lastName)}</td><td>${esc(r.parentName)}</td><td>${esc(r.grade)}</td><td>${esc(r.group)}</td></tr>`).join('')}</tbody></table></div>` :
      '<p class="muted">No data rows found. Make sure the file follows the template format.</p>';
    $('#imp', el).disabled = !rows.length || badG > 0 || badW > 0;
  };

  $('#file', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#file-lbl', el).textContent = '📄 ' + f.name; $('#perr', el).hidden = true;
    try {
      let aoa;
      if (/\.csv$/i.test(f.name)) aoa = parseCSV(await f.text());
      else { await busy(() => loadScript(XLSX_URL)); const X = window.XLSX; const wb = X.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); }
      if (aoa.length < 2) throw new Error('The file appears to be empty or has no data rows.');
      rows = aoa.slice(1).filter(c => c.some(v => v !== undefined && String(v).trim() !== '')).map(c => {
        const s = i => String(c[i] ?? '').trim();
        const grade = s(5), group = s(6);
        return { seq: s(0), tagId: cleanTag(s(1)), firstName: s(2), lastName: s(3), parentName: s(4), grade, group,
          gradeInvalid: !GRADES.includes(grade), groupInvalid: !GROUPS.includes(group) };
      });
      showPreview();
    } catch (err) { rows = []; showPreview(); $('#perr', el).textContent = err.message.startsWith('The file') ? err.message : 'Could not read the file. Make sure it is a valid .xlsx, .xls or .csv file.'; $('#perr', el).hidden = false; }
  };

  $('#imp', el).onclick = async () => {
    const missing = rows.filter(r => !r.tagId).length;
    if (missing) return error(`${missing} row(s) have no Tag ID. Every participant needs a badge number.`);
    if (!(await confirmBox(`Import ${rows.length} participant(s)? Anyone with the same Tag ID will be replaced, including ticket history.`, { ok: 'Import', danger: true }))) return;
    const now = new Date().toISOString(); const year = String(EVENT_YEAR);
    const list = rows.map(r => ({ id: participantIdFor(year, r.tagId), excelSeqNo: r.seq, tagId: r.tagId, firstName: r.firstName, lastName: r.lastName, parentName: r.parentName,
      grade: r.grade, wing: r.group, center: CENTER, year, created_at: now, updated_at: now, assigned: true, tokenCount: 0, totalTokenWon: 0, isGoodBagReceived: false, winningHistory: [] }));
    try { const n = await busy(() => api.importParticipants(list)); await success(`${n} participant(s) imported successfully.`); rows = []; showPreview(); $('#file', el).value = ''; $('#file-lbl', el).textContent = '📄 Click to select an Excel file (.xlsx / .xls) or .csv'; }
    catch (e) { error(e.message || 'Import failed. Please try again.'); }
  };
}

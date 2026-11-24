import api from '../backend/index.js';
import { $, $$, esc, toggleFullscreen, keepAwake } from '../ui.js';
import { boardLook, applyLook } from './boardsettings.js';
import { EVENT_YEAR } from '../config.js';

export async function render(el) {
  const look = await boardLook('leaderboard');
  const cfg = look.cfg;
  const t = {
    title: cfg.leadersBoardTitle || 'Leadership Board', name: cfg.nameHeaderTitle || 'Participant Name',
    score: cfg.scoreHeaderTitle || 'Score', current: cfg.currentTokensHeaderTitle || 'Current Tokens',
    font: cfg.fontColor || '#fff', titleColor: cfg.titleFontColor || '#fff'
  };
  let option = localStorage.getItem('scoreBoardOption') || 'combine';
  el.innerHTML = `<div class="board-screen" id="screen" style="color:${esc(t.font)}">
    <div class="wing-select no-print"><div class="seg" id="opt">
      <button type="button" data-v="iWing">I-Side</button><button type="button" data-v="eWing">E-Side</button><button type="button" data-v="combine">Combined</button></div></div>
    <h1 class="board-title" style="color:${esc(t.titleColor)}">${esc(t.title)}</h1>
    <div class="leader-cols" id="cols"></div>
    <div class="board-controls" id="ctl"><button class="board-btn alt" type="button" data-go="home">⌂ Home</button><button class="board-btn alt" type="button" id="pdf">Export PDF</button><button class="board-btn" type="button" id="fs">⛶ Full Screen</button></div></div>`;
  const screen = $('#screen', el);
  applyLook(screen, look);
  $('#fs', el).onclick = toggleFullscreen;
  $('#pdf', el).onclick = () => window.print();
  keepAwake(true);

  let people = [];
  const table = (list, start) => `<div class="leader-table"><table><thead><tr><th class="num">#</th><th>${esc(t.name)}</th><th class="num">${esc(t.score)}</th><th class="num">${esc(t.current)}</th></tr></thead><tbody>
    ${list.map((p, i) => `<tr><td class="num rank">${start + i + 1}</td><td>${esc(p.firstName)} ${esc(p.lastName)}<div class="parent">${esc(p.parentName || '')}</div></td><td class="num">${Number(p.totalTokenWon) || 0}</td><td class="num">${Number(p.tokenCount) || 0}</td></tr>`).join('')
      || `<tr><td colspan="4" style="text-align:center;opacity:.7">No scores yet</td></tr>`}</tbody></table></div>`;
  const draw = () => {
    $$('#opt button', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === option)));
    const wing = option === 'iWing' ? 'I-Side' : option === 'eWing' ? 'E-Side' : null;
    const top = people.filter(p => p.assigned !== false && (!wing || p.wing === wing))
      .sort((a, b) => (Number(b.totalTokenWon) || 0) - (Number(a.totalTokenWon) || 0) || `${a.firstName}`.localeCompare(`${b.firstName}`)).slice(0, 20);
    const first = top.slice(0, 10), second = top.slice(10);
    $('#cols', el).style.gridTemplateColumns = second.length && window.innerWidth >= 900 ? '1fr 1fr' : '1fr';
    $('#cols', el).innerHTML = table(first, 0) + (second.length ? table(second, 10) : '');
  };
  $$('#opt button', el).forEach(b => b.onclick = () => { option = b.dataset.v; localStorage.setItem('scoreBoardOption', option); draw(); });
  const unsub = api.watchParticipants(EVENT_YEAR, list => { people = list; draw(); });
  const ctl = $('#ctl', el); let hideT;
  const show = () => { ctl.classList.remove('hide'); clearTimeout(hideT); hideT = setTimeout(() => ctl.classList.add('hide'), 4000); };
  show(); document.addEventListener('mousemove', show); window.addEventListener('resize', draw);
  return () => { unsub && unsub(); keepAwake(false); clearTimeout(hideT); document.removeEventListener('mousemove', show); window.removeEventListener('resize', draw); };
}

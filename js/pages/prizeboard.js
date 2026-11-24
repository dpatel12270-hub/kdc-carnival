import api from '../backend/index.js';
import { $, $$, esc, toggleFullscreen, keepAwake } from '../ui.js';
import { boardLook, applyLook } from './boardsettings.js';
import { prizeBoardRows, stockLevel } from '../stats.js';
import { EVENT_YEAR } from '../config.js';

export async function render(el, params, route) {
  const side = route.side;
  el.innerHTML = `<div class="board-screen" id="screen">
    <div class="prize-screen" id="ps"><div class="board-msg">Loading prizes…</div></div>
    <p class="board-side" id="side-lbl" style="position:absolute;top:1.2vh;left:0;right:0;z-index:2">${esc(side)} Prizes</p>
    <div class="board-controls" id="ctl"><button class="board-btn alt" type="button" data-go="home">⌂ Home</button><button class="board-btn" type="button" id="fs">⛶ Full Screen</button></div></div>`;
  const screen = $('#screen', el), ps = $('#ps', el), ctl = $('#ctl', el);
  $('#fs', el).onclick = toggleFullscreen;
  keepAwake(true);

  const look = await boardLook('prizeboard-' + side);
  applyLook(screen, look);
  const topPct = Math.max(Number(look.cfg.topSpacePct ?? 10), 7);

  let prizes = [], people = [];
  const draw = () => {
    const rows = prizeBoardRows(prizes, people, side);
    if (!rows.length) { ps.innerHTML = `<div class="board-msg">No ${esc(side)} prizes are set up yet.</div>`; return; }
    const W = window.innerWidth, H = window.innerHeight;
    const cols = W >= 1000 ? Math.min(3, rows.length) : 1;
    const per = Math.ceil(rows.length / cols);
    const columns = []; for (let i = 0; i < rows.length; i += per) columns.push(rows.slice(i, i + per));
    ps.style.paddingTop = `calc(3.5vh + ${H * topPct / 100}px)`;
    ps.innerHTML = `<div class="prize-columns" style="grid-template-columns:repeat(${columns.length},minmax(0,1fr))">${columns.map(c => `<section class="prize-panel">
      <div class="prize-head"><span>Prize</span><span>Tokens</span><span>Remaining</span><span>Total</span></div>
      ${c.map(r => { const lvl = stockLevel(r); return `<div class="prize-row ${r.pinned ? 'prize-row--pinned' : ''} ${lvl === 'out' ? 'prize-row--out' : ''}">
        <span class="prize-name" title="${esc(r.prize)}"><span class="prize-name__text">${esc(r.prize)}</span></span>
        <span>${r.tokens}</span>
        <span><span class="stock-pill stock-pill--${lvl}">${lvl === 'raffle' ? 'Raffle' : lvl === 'out' ? 'Sold out' : r.remaining}</span></span>
        <span>${r.unlimited ? '—' : r.total}</span></div>`; }).join('')}</section>`).join('')}</div>`;
    // size text to fill the screen, then shrink until every name fits on two lines
    const avail = H - 2 * Math.max(16, 0.035 * H) - H * topPct / 100;
    let px = Math.min(Math.max(avail / (per + 0.5) * 0.42, 13), 96);
    for (let i = 0; i < 40; i++) {
      ps.style.setProperty('--pb-font', px + 'px');
      const tooTall = ps.scrollHeight > H + 1;
      const wide = $$('.prize-panel', ps).some(p => p.scrollWidth > p.clientWidth + 1);
      const clipped = $$('.prize-name__text', ps).some(t => t.scrollHeight > t.clientHeight + 1);
      if ((!tooTall && !wide && !clipped) || px <= 13) break;
      px = Math.max(13, px * 0.96);
    }
  };

  const loadPrizes = async () => { prizes = await api.getPrizes(side).catch(() => prizes); draw(); };
  await loadPrizes();
  const unsub = api.watchParticipants(EVENT_YEAR, list => { people = list; draw(); });
  const prizeTimer = setInterval(loadPrizes, 60000);

  let hideT;
  const showControls = () => { ctl.classList.remove('hide'); clearTimeout(hideT); hideT = setTimeout(() => ctl.classList.add('hide'), 4000); };
  showControls();
  let rz; const onResize = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(draw); };
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', showControls); document.addEventListener('touchstart', showControls);
  return () => {
    unsub && unsub(); clearInterval(prizeTimer); clearTimeout(hideT); keepAwake(false);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('mousemove', showControls); document.removeEventListener('touchstart', showControls);
  };
}

import api from '../backend/index.js';
import { $, error, busy } from '../ui.js';
import { go } from '../app.js';

export function render(el) {
  const savedName = localStorage.getItem('kdc-name') || '';
  el.innerHTML = `<div class="auth-wrap"><div class="auth-grid">
    <section class="auth-pitch">
      <img class="auth-logo" src="assets/kdc-logo.jpg" alt="Kids' Diwali logo">
      <h1>KDC Carnival</h1>
      <h2>Jungle of Sheru · Roanoke</h2>
      <p>Sign in to scan badges, update tickets, check families in, and keep the carnival floor moving smoothly.</p>
      <ul><li>RFID badge &amp; QR scanning</li><li>Live check-in from the registration sheet</li><li>Separate I-Side and E-Side prizes</li></ul>
    </section>
    <section class="auth-card">
      <span class="eyebrow">Welcome</span>
      <h2 style="margin:.6rem 0 .3rem">Karyakar Login</h2>
      <p class="muted" style="margin:0 0 1.4rem">Enter your name and the access code you were given.</p>
      <form class="modern-form" id="login-form" novalidate>
        <div class="form-field"><label for="name">Your name</label>
          <input class="input" id="name" autocomplete="name" placeholder="First and last name" value="${savedName.replace(/"/g, '&quot;')}">
          <small class="err" id="name-err" hidden>Name is required.</small></div>
        <div class="form-field"><label for="code">Access code</label>
          <input class="input" id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. ROK-GAME-7KQ4M2" style="text-transform:uppercase;letter-spacing:.05em">
          <small class="err" id="code-err" hidden>Access code is required.</small></div>
        <button class="btn" type="submit" style="width:100%">Login</button>
      </form>
      ${api.isDemo ? '<p class="small muted" style="margin-top:1rem">Demo codes: <b>DEMO-ADMIN</b>, <b>DEMO-GAMES</b>, <b>DEMO-PRIZES</b>, <b>DEMO-CHECKIN</b></p>' : ''}
    </section></div></div>`;
  const name = $('#name', el), code = $('#code', el);
  (savedName ? code : name).focus();
  $('#login-form', el).addEventListener('submit', async e => {
    e.preventDefault();
    const n = name.value.trim(), c = code.value.trim();
    $('#name-err', el).hidden = !!n; $('#code-err', el).hidden = !!c;
    name.classList.toggle('invalid', !n); code.classList.toggle('invalid', !c);
    if (!n || !c) return;
    try {
      await busy(() => api.login(n, c));
      localStorage.setItem('kdc-name', n);
      go('home');
    } catch (err) {
      await error(err.message || 'Login failed', { title: 'Login failed' });
      code.select();
    }
  });
}

import { hasRole, ROLES as R } from '../ui.js';
import { CENTER_NAME, EVENT_NAME } from '../config.js';

export function render(el) {
  const canScan = hasRole(R.APP, R.PRIZE, R.GIFT, R.SUPER, R.ADMIN);
  const canCheckIn = hasRole(R.CHECKIN, R.SUPER, R.ADMIN);
  el.innerHTML = `<section class="page-shell"><div class="home-hero">
    <div class="home-hero__copy">
      <span class="eyebrow">Center Dashboard</span>
      <h1>${CENTER_NAME} Carnival Hub</h1>
      <p>Scan participant badges, update tickets quickly, and keep the ${EVENT_NAME} carnival moving with less clutter and fewer taps.${canScan ? ' Tap a badge on the reader anytime to open it.' : ''}</p>
      <div class="home-actions">
        ${canScan ? '<button class="btn" type="button" data-go="scan">⌗ Scan a badge</button>' : ''}
        ${canCheckIn ? '<button class="btn btn-orange" type="button" data-go="check-in">✔ Check-In Desk</button>' : ''}
      </div>
    </div>
    <div class="home-hero__frame"><div class="banner-art">
      <img class="home-logo" src="assets/kdc-logo.jpg" alt="Kids' Diwali logo">
      <div class="banner-words"><div class="w1">KDC</div><div class="w2">CARNIVAL</div><div class="w3">${EVENT_NAME} · Play · Win · Redeem</div></div>
    </div></div>
  </div></section>`;
}

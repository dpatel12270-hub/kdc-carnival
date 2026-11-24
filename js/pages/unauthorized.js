export function render(el) {
  el.innerHTML = `<section class="page-shell narrow"><div class="section-card" style="text-align:center">
    <div class="section-card__header"><span class="eyebrow">Access Restricted</span><h1>Unauthorized Access</h1>
    <p>You do not have permission to view this page. Please contact your administrator or return to the home screen.</p></div>
    <button class="btn" type="button" data-go="home">Go to Home</button></div></section>`;
}

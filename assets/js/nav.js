// Mobile navigation toggle
(function(){
  const btn = document.querySelector('.nav-toggle');
  if (!btn) return;
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // initialise
  nav.setAttribute('aria-hidden', 'true');
  btn.setAttribute('aria-expanded', 'false');

  function openNav() {
    nav.classList.add('open');
    nav.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    // simple focus move to first focusable in nav
    const first = nav.querySelector('a, button, [tabindex]');
    if (first) first.focus();
    document.body.classList.add('nav-open');
  }

  function closeNav() {
    nav.classList.remove('open');
    nav.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
    document.body.classList.remove('nav-open');
  }

  btn.addEventListener('click', (e)=>{
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) closeNav(); else openNav();
  });

  // close on ESC
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (nav.classList.contains('open')) closeNav();
    }
  });

  // close on click outside
  document.addEventListener('click', (e)=>{
    if (!nav.classList.contains('open')) return;
    if (e.target === btn) return;
    if (!nav.contains(e.target)) closeNav();
  });
})();

// JS for About page overlays: toggle on click/tap, close on outside click or ESC
(function(){
  const cards = Array.from(document.querySelectorAll('.team-card'));
  if (!cards.length) return;

  function closeAll() {
    cards.forEach(c => {
      c.classList.remove('overlay-open');
      c.setAttribute('aria-expanded','false');
      const overlay = c.querySelector('.member-overlay');
      if (overlay) overlay.setAttribute('aria-hidden','true');
    });
  }

  function openCard(card){
    closeAll();
    card.classList.add('overlay-open');
    card.setAttribute('aria-expanded','true');
    const overlay = card.querySelector('.member-overlay');
    if (overlay) overlay.setAttribute('aria-hidden','false');
  }

  cards.forEach(card => {
    card.addEventListener('click', function(e){
      const isOpen = card.classList.contains('overlay-open');
      if (isOpen) { closeAll(); }
      else { openCard(card); }
      e.stopPropagation();
    }, {passive:true});

    card.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const isOpen = card.classList.contains('overlay-open');
        if (isOpen) closeAll(); else openCard(card);
      }
      if (e.key === 'Escape') closeAll();
    });
  });

  // Click outside to close
  document.addEventListener('click', function(){ closeAll(); }, {passive:true});
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeAll(); });
})();

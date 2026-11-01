(() => {
  function initializePublications() {
    const list = document.getElementById('publication-list');
    const toggle = document.getElementById('publication-toggle');
    if (!list || !toggle || toggle.dataset.publicationsReady === 'true') return;

    toggle.addEventListener('click', () => {
      const expanded = list.classList.toggle('is-expanded');
      toggle.textContent = expanded ? 'Collapse list' : 'View all';
      toggle.setAttribute('aria-expanded', String(expanded));
      if (!expanded) list.scrollTop = 0;
    });

    toggle.dataset.publicationsReady = 'true';
    toggle.hidden = false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePublications, { once: true });
  } else {
    initializePublications();
  }
})();

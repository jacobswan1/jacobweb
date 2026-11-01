(() => {
  'use strict';

  function initializeVideoDialog() {
    const dialog = document.getElementById('video-viewer');
    const video = document.getElementById('demo-video');
    const title = document.getElementById('video-title');
    const error = document.getElementById('video-error');
    const close = document.getElementById('video-close');
    if (!dialog || typeof dialog.showModal !== 'function' || !video || !title || !error || !close || dialog.dataset.videoDialogReady === 'true') return;

    const fallbacks = dialog.querySelectorAll('[data-video-fallback]');
    let playAttempt = 0;

    function showFailure(attempt) {
      if (dialog.open && attempt === playAttempt) error.hidden = false;
    }

    document.querySelectorAll('[data-video-demo]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        document.dispatchEvent(new CustomEvent('site:video-open'));

        const attempt = ++playAttempt;
        const label = link.dataset.videoTitle || 'Video demonstration';
        const width = Number(link.dataset.videoWidth);
        const height = Number(link.dataset.videoHeight);
        video.pause();
        error.hidden = true;
        title.textContent = label;
        video.setAttribute('aria-label', label);
        if (Number.isInteger(width) && width > 0) video.width = width;
        if (Number.isInteger(height) && height > 0) video.height = height;
        fallbacks.forEach((fallback) => { fallback.href = link.href; });
        if (video.getAttribute('src') !== link.href) video.src = link.href;
        if (!dialog.open) dialog.showModal();

        try {
          // Keep this synchronous with the click so browser user activation survives.
          const playback = video.play();
          if (playback?.catch) playback.catch(() => showFailure(attempt));
        } catch {
          showFailure(attempt);
        }
      });
    });

    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      playAttempt += 1;
      video.pause();
      if (video.readyState > 0) video.currentTime = 0;
      error.hidden = true;
    });
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    video.addEventListener('error', () => {
      if (video.error) showFailure(playAttempt);
    });
    video.addEventListener('playing', () => { error.hidden = true; });
    dialog.dataset.videoDialogReady = 'true';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVideoDialog, { once: true });
  } else {
    initializeVideoDialog();
  }
})();

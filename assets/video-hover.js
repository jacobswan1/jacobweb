(() => {
  'use strict';

  function initializeHoverPreviews() {
    const roots = [...document.querySelectorAll('.video-showcase')];
    if (!roots.length) return;

    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dialog = document.getElementById('video-viewer');
    let enabled = false;
    let active = null;

    const entries = roots.flatMap((root) => [...root.querySelectorAll('.video-preview[data-video-demo][data-preview-src]')].map((link) => {
      link.dataset.previewState = 'idle';
      return { link, video: null, timer: null, attempt: 0, hovered: false, focused: false };
    }));

    function stop(entry, state = 'idle') {
      if (entry.timer !== null) window.clearTimeout(entry.timer);
      entry.timer = null;
      entry.attempt += 1;
      if (active === entry) active = null;
      entry.link.dataset.previewState = state;
      if (entry.video) {
        entry.video.pause();
        // A clip may still be fetching its first frame when the pointer leaves.
        if (entry.video.readyState > 0) entry.video.currentTime = 0;
      }
    }

    function stopAll() {
      entries.forEach((entry) => {
        entry.hovered = false;
        entry.focused = false;
        stop(entry);
      });
    }

    function canPlay(entry) {
      const bounds = entry.link.getBoundingClientRect();
      return enabled && !document.hidden && !dialog?.open &&
        (entry.hovered || entry.focused) && bounds.bottom > 0 &&
        bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
    }

    function getVideo(entry) {
      if (entry.video) return entry.video;
      const video = document.createElement('video');
      video.className = 'video-hover';
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.tabIndex = -1;
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('playing', () => {
        if (active !== entry || !canPlay(entry)) {
          video.pause();
          return;
        }
        if (video.readyState >= 2) entry.link.dataset.previewState = 'playing';
      });
      video.addEventListener('error', () => {
        if (active === entry) stop(entry, 'error');
      });
      entry.video = video;
      entry.link.append(video);
      video.src = entry.link.dataset.previewSrc;
      return video;
    }

    function start(entry) {
      entry.timer = null;
      if (!canPlay(entry)) return;
      if (active && active !== entry) stop(active);
      active = entry;
      const attempt = ++entry.attempt;
      entry.link.dataset.previewState = 'loading';
      const video = getVideo(entry);

      function failure() {
        if (active === entry && attempt === entry.attempt) stop(entry, 'error');
      }

      try {
        const playback = video.play();
        if (playback?.then) {
          playback.then(() => {
            // A late promise must neither reveal a departed clip nor stop a new attempt.
            if (attempt !== entry.attempt && active !== entry) video.pause();
          }, failure);
        }
      } catch {
        failure();
      }
    }

    function schedule(entry) {
      if (!canPlay(entry) || entry.timer !== null || active === entry) return;
      entry.timer = window.setTimeout(() => start(entry), 120);
    }

    entries.forEach((entry) => {
      entry.link.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        entry.hovered = true;
        schedule(entry);
      });
      entry.link.addEventListener('pointerleave', () => {
        entry.hovered = false;
        if (!entry.focused) stop(entry);
      });
      entry.link.addEventListener('focus', () => {
        entry.focused = entry.link.matches(':focus-visible');
        if (entry.focused) schedule(entry);
      });
      entry.link.addEventListener('blur', () => {
        entry.focused = false;
        if (!entry.hovered) stop(entry);
      });
    });

    if ('IntersectionObserver' in window) {
      const byLink = new Map(entries.map((entry) => [entry.link, entry]));
      const observer = new IntersectionObserver((changes) => {
        changes.forEach((change) => {
          if (!change.isIntersecting) {
            const entry = byLink.get(change.target);
            entry.hovered = false;
            entry.focused = false;
            stop(entry);
          }
        });
      });
      entries.forEach((entry) => observer.observe(entry.link));
    }

    function updatePreferences() {
      enabled = pointer.matches && !motion.matches;
      roots.forEach((root) => { root.dataset.hoverPreviews = String(enabled); });
      if (!enabled) stopAll();
    }

    pointer.addEventListener('change', updatePreferences);
    motion.addEventListener('change', updatePreferences);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAll();
    });
    document.addEventListener('site:video-open', stopAll);
    updatePreferences();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHoverPreviews, { once: true });
  } else {
    initializeHoverPreviews();
  }
})();

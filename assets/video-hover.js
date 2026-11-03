(() => {
  'use strict';

  function initializeAutoPreviews() {
    const roots = [...document.querySelectorAll('.video-showcase')]
      .filter((root) => root.dataset.autoPreviewsReady !== 'true');
    if (!roots.length) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dialogs = [...document.querySelectorAll('#image-viewer, #video-viewer')];
    const toggle = document.getElementById('video-preview-toggle');
    let preference = null;

    const entries = roots.flatMap((root) => [...root.querySelectorAll('.video-preview[data-video-demo][data-preview-src]')].map((link) => {
      link.dataset.previewState = 'idle';
      const requestedRate = Number(link.dataset.previewRate);
      const rate = Number.isFinite(requestedRate) && requestedRate > 0 ? requestedRate : 1;
      return { link, rate, video: null, inView: false, requested: false, blocked: false, attempt: 0 };
    }));

    function enabled() {
      return preference ?? !motion.matches;
    }

    function updateControls() {
      const autoEnabled = enabled();
      roots.forEach((root) => { root.dataset.autoPreviews = String(autoEnabled); });
      if (toggle) {
        toggle.hidden = false;
        toggle.textContent = autoEnabled ? 'Pause previews' : 'Play previews';
      }
    }

    function canPlay(entry) {
      return enabled() && entry.inView && !entry.blocked && !document.hidden &&
        !dialogs.some((dialog) => dialog.open);
    }

    function stop(entry) {
      if (entry.requested) entry.attempt += 1;
      entry.requested = false;
      entry.link.dataset.previewState = entry.blocked ? 'error' : 'idle';
      if (entry.video && !entry.video.paused) entry.video.pause();
    }

    function stopAll() {
      entries.forEach(stop);
    }

    function fail(entry, attempt) {
      if (attempt !== entry.attempt || !entry.requested) return;
      // Visibility or a dialog can cancel an otherwise valid play request.
      if (canPlay(entry)) entry.blocked = true;
      stop(entry);
      updateControls();
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
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('playing', () => {
        if (!entry.requested || !canPlay(entry)) {
          stop(entry);
          return;
        }
        if (video.readyState >= 2) entry.link.dataset.previewState = 'playing';
      });
      video.addEventListener('error', () => fail(entry, entry.attempt));
      entry.video = video;
      entry.link.append(video);
      // Only the small, silent preview is fetched. Full demos stay click-to-open.
      video.src = entry.link.dataset.previewSrc;
      return video;
    }

    function start(entry) {
      if (!canPlay(entry) || entry.requested) return;
      entry.requested = true;
      const attempt = ++entry.attempt;
      const video = getVideo(entry);

      try {
        // Keep the preview's rate through pauses and media reloads.
        video.defaultPlaybackRate = entry.rate;
        video.playbackRate = entry.rate;
        const playback = video.play();
        if (playback?.then) {
          playback.then(() => {
            // An old promise must not pause a newer, eligible play request.
            if (attempt !== entry.attempt) {
              if (!entry.requested || !canPlay(entry)) video.pause();
              return;
            }
            if (!canPlay(entry)) stop(entry);
            else if (!video.paused && video.readyState >= 2) entry.link.dataset.previewState = 'playing';
          }, () => fail(entry, attempt));
        }
      } catch {
        fail(entry, attempt);
      }
    }

    function sync() {
      entries.forEach((entry) => {
        if (canPlay(entry)) start(entry);
        else stop(entry);
      });
      updateControls();
    }

    toggle?.addEventListener('click', () => {
      if (enabled()) {
        preference = false;
      } else {
        preference = true;
        entries.forEach((entry) => {
          entry.blocked = false;
          if (entry.video?.error) entry.video.load();
        });
      }
      // Explicit Play also retries a blocked preview in the click's user gesture.
      sync();
    });

    if ('IntersectionObserver' in window) {
      const byLink = new Map(entries.map((entry) => [entry.link, entry]));
      const observer = new IntersectionObserver((changes) => {
        changes.forEach((change) => {
          const entry = byLink.get(change.target);
          entry.inView = change.isIntersecting && change.intersectionRatio >= 0.15;
        });
        sync();
      }, { threshold: [0, 0.15] });
      entries.forEach((entry) => observer.observe(entry.link));
    } else {
      let frame = null;
      const updateVisibility = () => {
        frame = null;
        entries.forEach((entry) => {
          const bounds = entry.link.getBoundingClientRect();
          entry.inView = bounds.bottom > 0 && bounds.top < window.innerHeight &&
            bounds.right > 0 && bounds.left < window.innerWidth;
        });
        sync();
      };
      const scheduleVisibility = () => {
        if (frame === null) frame = window.requestAnimationFrame(updateVisibility);
      };
      window.addEventListener('scroll', scheduleVisibility, { passive: true });
      window.addEventListener('resize', scheduleVisibility);
      updateVisibility();
    }

    const dialogObserver = new MutationObserver(sync);
    dialogs.forEach((dialog) => {
      dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
      dialog.addEventListener('close', sync);
    });
    document.addEventListener('site:video-open', stopAll);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', stopAll);
    window.addEventListener('pageshow', sync);
    motion.addEventListener('change', sync);
    roots.forEach((root) => { root.dataset.autoPreviewsReady = 'true'; });
    updateControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutoPreviews, { once: true });
  } else {
    initializeAutoPreviews();
  }
})();

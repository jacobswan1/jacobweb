(() => {
  'use strict';

  function initializeLoop(row, { itemSelector, readyKey, motionKey, playingKey, enabled, updateControls }) {
    if (!row || row.dataset[readyKey] === 'true') return null;

    const items = [...row.children];
    if (items.length < 2 || items.some((item) => !item.matches(itemSelector))) return null;

    const printMedia = window.matchMedia('print');
    const speed = 12;
    const idleDelay = 2000;
    const spans = new Map();
    const visualOrder = [...items];
    let keyboardInput = true;
    let keyboardFocus = row.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    let pointerDown = false;
    let dragging = false;
    let dialogOpen = Boolean(document.querySelector('dialog[open]'));
    let printing = printMedia.matches;
    let pageActive = true;
    let inView = false;
    let canLoop = false;
    let idleUntil = 0;
    let position = row.scrollLeft;
    let expectedScroll = position;
    let frame = 0;
    let wakeTimer = 0;
    let lastTime = null;

    function available() {
      return enabled() && canLoop && inView && pageActive && !document.hidden && !printing &&
        !keyboardFocus && !pointerDown && !dragging && !dialogOpen;
    }

    function stop() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
      row.dataset[playingKey] = 'false';
    }

    function synchronize() {
      window.clearTimeout(wakeTimer);
      wakeTimer = 0;
      updateControls?.(canLoop);
      row.dataset[motionKey] = String(canLoop);
      if (!available()) {
        stop();
        return;
      }
      const remaining = idleUntil - performance.now();
      if (remaining > 0) {
        stop();
        wakeTimer = window.setTimeout(synchronize, remaining + 1);
        return;
      }
      if (!frame) {
        position = row.scrollLeft;
        expectedScroll = position;
        lastTime = null;
        row.dataset[playingKey] = 'true';
        frame = window.requestAnimationFrame(advance);
      }
    }

    function advance(time) {
      frame = 0;
      if (!available() || time < idleUntil) {
        synchronize();
        return;
      }
      const elapsed = lastTime === null ? 0 : Math.min(Math.max(time - lastTime, 0), 50);
      lastTime = time;
      position += speed * elapsed / 1000;

      // Reorder only fully departed tiles visually, preserving mounted nodes and focus.
      // DOM order, tab stops, viewer listeners, and mounted video playback stay intact.
      let moves = 0;
      while (moves < items.length && position >= spans.get(visualOrder[0])) {
        const first = visualOrder.shift();
        position -= spans.get(first);
        visualOrder.push(first);
        moves += 1;
      }
      if (moves) visualOrder.forEach((item, index) => { item.style.order = String(index); });
      row.scrollLeft = position;
      expectedScroll = row.scrollLeft;
      frame = window.requestAnimationFrame(advance);
    }

    function measure() {
      const gap = Number.parseFloat(window.getComputedStyle(row).columnGap) || 0;
      items.forEach((item) => spans.set(item, item.getBoundingClientRect().width + gap));
      const longestSpan = Math.max(...spans.values());
      // A full first tile must pass before reaching the native scroll limit.
      canLoop = longestSpan > 0 && row.clientWidth > 0 &&
        row.scrollWidth - row.clientWidth >= longestSpan;
      position = row.scrollLeft;
      expectedScroll = position;
      synchronize();
    }

    function manualInteraction() {
      idleUntil = performance.now() + idleDelay;
      position = row.scrollLeft;
      expectedScroll = position;
      synchronize();
    }

    function updateInView() {
      const bounds = row.getBoundingClientRect();
      inView = bounds.bottom > 0 && bounds.top < window.innerHeight &&
        bounds.right > 0 && bounds.left < window.innerWidth;
      synchronize();
    }

    document.addEventListener('pointerdown', () => {
      keyboardInput = false;
    }, { capture: true, passive: true });
    document.addEventListener('keydown', (event) => {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      keyboardInput = true;
      if (row.contains(document.activeElement)) {
        keyboardFocus = true;
        synchronize();
      }
    }, true);
    row.addEventListener('focusin', () => {
      keyboardFocus = keyboardInput;
      synchronize();
    });
    row.addEventListener('focusout', (event) => {
      if (!row.contains(event.relatedTarget)) {
        keyboardFocus = false;
        manualInteraction();
      }
    });
    row.addEventListener('pointerdown', () => {
      keyboardInput = false;
      keyboardFocus = false;
      pointerDown = true;
      manualInteraction();
    }, { passive: true });
    function endPointerInteraction() {
      if (!pointerDown) return;
      pointerDown = false;
      manualInteraction();
    }
    function releaseInteraction() {
      const active = pointerDown || dragging;
      pointerDown = false;
      dragging = false;
      if (active) manualInteraction();
    }
    window.addEventListener('pointerup', endPointerInteraction, { passive: true });
    window.addEventListener('pointercancel', endPointerInteraction, { passive: true });
    window.addEventListener('blur', releaseInteraction);
    row.addEventListener('dragstart', () => {
      dragging = true;
      manualInteraction();
    });
    row.addEventListener('dragend', releaseInteraction);
    row.addEventListener('wheel', manualInteraction, { passive: true });
    row.addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', ' '].includes(event.key)) manualInteraction();
    });
    row.addEventListener('scroll', () => {
      // Native touch momentum and scrollbar drags extend the idle period; our writes do not.
      if (Math.abs(row.scrollLeft - expectedScroll) > 0.75) manualInteraction();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseInteraction();
      synchronize();
    });
    window.addEventListener('pagehide', () => {
      pageActive = false;
      releaseInteraction();
      synchronize();
    });
    window.addEventListener('pageshow', () => {
      pageActive = true;
      measure();
    });
    printMedia.addEventListener('change', () => {
      printing = printMedia.matches;
      measure();
    });
    window.addEventListener('beforeprint', () => {
      printing = true;
      synchronize();
    });
    window.addEventListener('afterprint', () => {
      printing = false;
      measure();
    });

    const dialogs = new MutationObserver(() => {
      const open = Boolean(document.querySelector('dialog[open]'));
      if (open !== dialogOpen) {
        dialogOpen = open;
        synchronize();
      }
    });
    dialogs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });

    if ('IntersectionObserver' in window) {
      const visibility = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.target === row && entry.isIntersecting);
        synchronize();
      });
      visibility.observe(row);
    } else {
      window.addEventListener('scroll', updateInView, { passive: true });
      window.addEventListener('resize', updateInView, { passive: true });
      updateInView();
    }
    if ('ResizeObserver' in window) {
      const sizes = new ResizeObserver(measure);
      sizes.observe(row);
      items.forEach((item) => sizes.observe(item));
    } else {
      window.addEventListener('resize', measure, { passive: true });
    }

    row.dataset[readyKey] = 'true';
    measure();
    return { synchronize, resume: () => { idleUntil = 0; synchronize(); } };
  }

  function initializeGalleryMotion() {
    const row = document.querySelector('.generation-row');
    const toggle = document.getElementById('gallery-motion-toggle');
    if (!row || !toggle) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let userPaused = false;
    let allowReducedMotion = false;
    const enabled = () => !userPaused && (!reducedMotion.matches || allowReducedMotion);
    const controller = initializeLoop(row, {
      itemSelector: 'a[data-full-image]',
      readyKey: 'galleryMotionReady',
      motionKey: 'galleryMotion',
      playingKey: 'galleryPlaying',
      enabled,
      updateControls: (canLoop) => {
        toggle.textContent = enabled() ? 'Pause slideshow' : 'Play slideshow';
        toggle.hidden = !canLoop;
      },
    });
    if (!controller) return;

    toggle.addEventListener('click', () => {
      if (enabled()) {
        userPaused = true;
        controller.synchronize();
      } else {
        userPaused = false;
        allowReducedMotion = reducedMotion.matches;
        controller.resume();
      }
    });
    reducedMotion.addEventListener('change', () => {
      allowReducedMotion = false;
      controller.synchronize();
    });
  }

  function initializeVideoMotion() {
    const row = document.querySelector('.video-showcase');
    if (!row) return;

    // video-hover owns the shared Play/Pause preference, including reduced-motion opt-in.
    const enabled = () => row.dataset.autoPreviews === 'true';
    const controller = initializeLoop(row, {
      itemSelector: '.video-item',
      readyKey: 'stripMotionReady',
      motionKey: 'stripMotion',
      playingKey: 'stripPlaying',
      enabled,
    });
    if (!controller) return;

    let previousPreference = enabled();
    const preference = new MutationObserver(() => {
      const currentPreference = enabled();
      if (currentPreference === previousPreference) return;
      previousPreference = currentPreference;
      if (currentPreference) controller.resume();
      else controller.synchronize();
    });
    preference.observe(row, { attributes: true, attributeFilter: ['data-auto-previews'] });
  }

  function initializeMotion() {
    initializeGalleryMotion();
    initializeVideoMotion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMotion, { once: true });
  } else {
    initializeMotion();
  }
})();

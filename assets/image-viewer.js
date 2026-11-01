(() => {
  'use strict';

  function initializeImageViewer() {
    const dialog = document.getElementById('image-viewer');
    const image = document.getElementById('viewer-image');
    const canvas = document.getElementById('image-canvas');
    const title = document.getElementById('viewer-title');
    const zoom = document.getElementById('viewer-zoom');
    const close = document.getElementById('viewer-close');
    if (!dialog || typeof dialog.showModal !== 'function' || !image || !canvas || !title || !zoom || !close || dialog.dataset.imageViewerReady === 'true') return;

    let imageReady = false;
    let layoutFrame = 0;

    function resetView() {
      cancelAnimationFrame(layoutFrame);
      dialog.classList.remove('is-zoomed');
      zoom.textContent = 'Actual size';
      zoom.setAttribute('aria-pressed', 'false');
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    }

    function setZoom(zoomed, point = { x: 0.5, y: 0.5 }) {
      if (!imageReady || !dialog.open) return;
      resetView();
      if (!zoomed) return;

      dialog.classList.add('is-zoomed');
      zoom.textContent = 'Fit to window';
      zoom.setAttribute('aria-pressed', 'true');
      layoutFrame = requestAnimationFrame(() => {
        if (!dialog.open || !dialog.classList.contains('is-zoomed')) return;
        const imageRect = image.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        // Keep the selected image detail centered after its native dimensions apply.
        canvas.scrollLeft += imageRect.left - canvasRect.left - canvas.clientLeft + imageRect.width * point.x - canvas.clientWidth / 2;
        canvas.scrollTop += imageRect.top - canvasRect.top - canvas.clientTop + imageRect.height * point.y - canvas.clientHeight / 2;
      });
    }

    function updateImageReady() {
      imageReady = dialog.open && image.complete && image.naturalWidth > 0;
      zoom.disabled = !imageReady;
    }

    document.querySelectorAll('a[data-full-image]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        resetView();
        imageReady = false;
        zoom.disabled = true;
        title.textContent = link.dataset.imageTitle || 'Image preview';
        image.alt = link.querySelector('img')?.alt || title.textContent;
        image.src = link.href;
        if (!dialog.open) dialog.showModal();
        updateImageReady();
      });
    });

    zoom.addEventListener('click', () => {
      setZoom(!dialog.classList.contains('is-zoomed'));
    });
    image.addEventListener('click', (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const point = {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      };
      setZoom(!dialog.classList.contains('is-zoomed'), point);
    });

    image.addEventListener('load', updateImageReady);
    image.addEventListener('error', () => {
      imageReady = false;
      zoom.disabled = true;
      resetView();
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      imageReady = false;
      zoom.disabled = true;
      resetView();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });

    resetView();
    zoom.disabled = true;
    dialog.dataset.imageViewerReady = 'true';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImageViewer, { once: true });
  } else {
    initializeImageViewer();
  }
})();

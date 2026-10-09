/**
 * app.js — Main application controller
 * Wires up tabs, dropzones, sliders, and module calls.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // Tab Switching
  // ============================================================
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      tabPanels.forEach(panel => {
        const isTarget = panel.id === `panel-${target}`;
        panel.hidden = !isTarget;
        if (isTarget) panel.classList.add('active');
        else panel.classList.remove('active');
      });
    });
  });

  // ============================================================
  // Slider Live Update
  // ============================================================

  // Image quality slider
  const imgQualitySlider = document.getElementById('img-quality');
  const imgQualityVal    = document.getElementById('img-quality-val');
  const imgQualityFill   = document.getElementById('img-quality-fill');

  function updateImgQuality() {
    const val = imgQualitySlider.value;
    const pct = ((val - imgQualitySlider.min) / (imgQualitySlider.max - imgQualitySlider.min)) * 100;
    imgQualityVal.textContent = `${val}%`;
    imgQualityFill.style.width = `${pct}%`;
    imgQualitySlider.setAttribute('aria-valuenow', val);
  }
  imgQualitySlider.addEventListener('input', updateImgQuality);

  // Video CRF slider (inverted: lower = better quality)
  const vidCrfSlider = document.getElementById('vid-crf');
  const vidCrfVal    = document.getElementById('vid-crf-val');
  const vidCrfFill   = document.getElementById('vid-crf-fill');

  function updateVidCrf() {
    const val = vidCrfSlider.value;
    const pct = ((val - vidCrfSlider.min) / (vidCrfSlider.max - vidCrfSlider.min)) * 100;
    vidCrfVal.textContent = val;
    vidCrfFill.style.width = `${pct}%`;
    vidCrfSlider.setAttribute('aria-valuenow', val);
  }
  vidCrfSlider.addEventListener('input', updateVidCrf);

  // ============================================================
  // Image Dropzone
  // ============================================================
  const imageDropzone = document.getElementById('image-dropzone');
  const imageInput    = document.getElementById('image-input');

  imageDropzone.addEventListener('click', (e) => {
    // Don't re-trigger if clicking inner button
    if (e.target.classList.contains('drop-link') || e.target === imageDropzone || e.target.closest('.dropzone-inner')) {
      imageInput.click();
    }
  });

  imageDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imageInput.click(); }
  });

  imageInput.addEventListener('change', (e) => {
    if (e.target.files.length) ImageCompressor.addFiles(e.target.files);
    imageInput.value = '';
  });

  setupDragDrop(imageDropzone, (files) => ImageCompressor.addFiles(files));

  // ============================================================
  // Video Dropzone
  // ============================================================
  const videoDropzone = document.getElementById('video-dropzone');
  const videoInput    = document.getElementById('video-input');

  videoDropzone.addEventListener('click', (e) => {
    if (e.target.classList.contains('drop-link') || e.target === videoDropzone || e.target.closest('.dropzone-inner')) {
      videoInput.click();
    }
  });

  videoDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); videoInput.click(); }
  });

  videoInput.addEventListener('change', (e) => {
    if (e.target.files.length) VideoCompressor.addFiles(e.target.files);
    videoInput.value = '';
  });

  setupDragDrop(videoDropzone, (files) => VideoCompressor.addFiles(files));

  // ============================================================
  // Action Buttons & Naming Listeners
  // ============================================================
  document.getElementById('img-compress-all').addEventListener('click', () => {
    ImageCompressor.compressAll();
  });

  document.getElementById('img-clear-all').addEventListener('click', () => {
    ImageCompressor.clearAll();
  });

  document.getElementById('img-download-all').addEventListener('click', () => {
    ImageCompressor.downloadAll();
  });

  document.getElementById('vid-compress-all').addEventListener('click', () => {
    VideoCompressor.compressAll();
  });

  document.getElementById('vid-clear-all').addEventListener('click', () => {
    VideoCompressor.clearAll();
  });

  document.getElementById('vid-download-all').addEventListener('click', () => {
    VideoCompressor.downloadAll();
  });

  // Live preview updates when global naming inputs change
  ['global-name-id', 'global-name-base'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      ImageCompressor.refreshAllPreviews();
      VideoCompressor.refreshAllPreviews();
    });
  });

  document.getElementById('img-format')?.addEventListener('change', () => ImageCompressor.refreshAllPreviews());
  document.getElementById('vid-codec')?.addEventListener('change', () => VideoCompressor.refreshAllPreviews());


  // ============================================================
  // Init FFmpeg (load on first video tab visit)
  // ============================================================
  let ffmpegInitialized = false;

  document.getElementById('tab-video').addEventListener('click', () => {
    if (!ffmpegInitialized) {
      ffmpegInitialized = true;
      VideoCompressor.loadFFmpeg();
    }
  });

  // ============================================================
  // Drag & Drop helper
  // ============================================================
  function setupDragDrop(zone, onDrop) {
    zone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      zone.classList.add('dragging');
    });
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('dragging');
      }
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragging');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onDrop(files);
      }
    });
  }

  // ============================================================
  // Keyboard accessibility — prevent scroll on Space
  // ============================================================
  document.querySelectorAll('.dropzone').forEach(zone => {
    zone.addEventListener('keydown', (e) => {
      if (e.key === ' ') e.preventDefault();
    });
  });

  // ============================================================
  // Welcome toast
  // ============================================================
  setTimeout(() => {
    showToast('MediaLite siap! Drag & drop file untuk mulai.', 'info', 4000);
  }, 600);

});

/**
 * video-compressor.js
 * Handles video compression using FFmpeg.wasm (runs 100% in browser).
 * Features: rename, ID prefix, portrait/landscape detection, batch download.
 *
 * Semua file FFmpeg disimpan lokal di folder vendor/ — tidak butuh internet.
 */

const VideoCompressor = (() => {
  let ffmpeg      = null;
  let ffmpegReady = false;

  /**
   * Queue entry shape:
   * { file, id, status, resultBlob?, orientation?, outputFilename?, seq }
   * @type {Map<string, object>}
   */
  const queue = new Map();

  let seqCounter          = 0;
  let totalOriginalBytes  = 0;
  let totalCompressedBytes = 0;
  let processedCount      = 0;

  /**
   * Load FFmpeg.wasm from local vendor/
   */
  async function loadFFmpeg() {
    const indicator  = document.getElementById('ffmpeg-indicator');
    const statusText = document.getElementById('ffmpeg-status-text');

    try {
      if (typeof FFmpeg === 'undefined' || !FFmpeg.createFFmpeg) {
        throw new Error(
          'FFmpeg library (vendor/ffmpeg.js) tidak ditemukan. ' +
          'Pastikan aplikasi dibuka via HTTP server, bukan file://.'
        );
      }

      const { createFFmpeg } = FFmpeg;
      const base = window.location.origin +
                   window.location.pathname.replace(/\/[^/]*$/, '');

      statusText.textContent = 'Memuat FFmpeg engine lokal...';

      ffmpeg = createFFmpeg({
        log: true,
        corePath: `${base}/vendor/ffmpeg-core.js`,
      });

      await ffmpeg.load();

      ffmpegReady = true;
      indicator.className = 'ffmpeg-indicator ready';
      indicator.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>FFmpeg siap. Kompresi video tersedia (100% offline)</span>
      `;
      showToast('FFmpeg engine berhasil dimuat!', 'success');

    } catch (err) {
      console.error('[FFmpeg load error]', err);
      indicator.className = 'ffmpeg-indicator error';
      indicator.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span id="ffmpeg-err-msg">Gagal: ${err.message}</span>
        <button onclick="VideoCompressor.retryLoad()" style="margin-left:8px;color:inherit;text-decoration:underline;background:none;border:none;cursor:pointer;font-size:inherit;">Coba lagi</button>
      `;
      showToast(`FFmpeg error: ${err.message}`, 'error', 8000);
    }
  }

  /**
   * Add files to video queue
   * @param {FileList|File[]} files
   */
  function addFiles(files) {
    const section = document.getElementById('video-queue-section');
    const listEl  = document.getElementById('video-file-list');

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('video/')) {
        showToast(`Bukan file video: ${file.name}`, 'error');
        return;
      }
      const id = uid();
      seqCounter++;
      queue.set(id, { file, id, status: 'pending', seq: seqCounter, orientation: null });
      const itemEl = createFileItem(id, file);
      listEl.appendChild(itemEl);

      // Detect video orientation
      detectVideoOrientationForItem(id, file);
    });

    if (queue.size > 0) {
      section.hidden = false;
      updateQueueCount();
      updateBatchDownloadBtn();
    }
  }

  /**
   * Detect video orientation and update badge
   */
  function detectVideoOrientationForItem(id, file) {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    detectVideoOrientation(video).then(orientation => {
      URL.revokeObjectURL(url);
      const entry = queue.get(id);
      if (entry) entry.orientation = orientation;

      const badge = document.getElementById(`vid-orient-${id}`);
      if (badge) {
        badge.textContent  = orientation === 'P' ? 'Portrait' : orientation === 'L' ? 'Landscape' : 'Square';
        badge.dataset.orient = orientation;
        badge.hidden = false;
      }
      updateFilenamePreview(id);
    });
  }

  /**
   * Strip extension
   */
  function stripExt(filename) {
    return filename.replace(/\.[^.]+$/, '');
  }

  /**
   * Get the effective base name for a video item.
   * Priority: per-file rename (if changed) > global name > original filename
   */
  function getItemBaseName(id, file) {
    const input        = document.getElementById(`vid-rename-input-${id}`);
    const inputVal     = input ? input.value.trim() : '';
    const originalBase = stripExt(file.name);
    const { baseName: globalBase } = getNamingConfig();

    if (inputVal && inputVal !== originalBase) return inputVal;
    if (globalBase) return globalBase;
    return originalBase;
  }

  /**
   * Update output filename preview for a single item
   */
  function updateFilenamePreview(id) {
    const entry = queue.get(id);
    if (!entry) return;
    const { id: prefix } = getNamingConfig();
    const codec = document.getElementById('vid-codec').value;
    const ext   = codecToExt(codec);
    const name  = buildOutputFilename({
      id:          prefix,
      baseName:    getItemBaseName(id, entry.file),
      seq:         entry.seq,
      orientation: entry.orientation,
      ext,
    });
    const previewEl = document.getElementById(`vid-name-preview-${id}`);
    if (previewEl) previewEl.textContent = name;
  }

  /**
   * Create a file item DOM element for video
   */
  function createFileItem(id, file) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.id = `vid-item-${id}`;
    div.setAttribute('role', 'listitem');

    // Thumbnail (video icon, replaced with frame later)
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'file-thumb';
    thumbDiv.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`;

    const videoEl = document.createElement('video');
    videoEl.src = URL.createObjectURL(file);
    videoEl.muted = true;
    videoEl.currentTime = 1;
    videoEl.addEventListener('loadeddata', () => {
      const c = document.createElement('canvas');
      c.width = 52; c.height = 52;
      c.getContext('2d').drawImage(videoEl, 0, 0, 52, 52);
      thumbDiv.innerHTML = '';
      const tImg = document.createElement('img');
      tImg.src = c.toDataURL();
      tImg.alt = file.name;
      thumbDiv.appendChild(tImg);
      URL.revokeObjectURL(videoEl.src);
    }, { once: true });

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'file-info';
    infoDiv.innerHTML = `
      <div class="file-name-row">
        <div class="file-name" id="vid-orig-name-${id}" title="${file.name}">${file.name}</div>
        <span class="orient-badge" id="vid-orient-${id}" hidden data-orient=""></span>
      </div>
      <div class="file-rename-row" id="vid-rename-row-${id}" hidden>
        <input
          type="text"
          class="file-rename-input"
          id="vid-rename-input-${id}"
          placeholder="Nama baru (tanpa ekstensi)"
          aria-label="Rename file ${file.name}"
          value="${stripExt(file.name)}"
        />
      </div>
      <div class="file-meta">
        <span>${formatBytes(file.size)}</span>
        <span id="vid-meta-after-${id}"></span>
        <span id="vid-ratio-${id}"></span>
      </div>
      <div class="file-output-name" id="vid-output-name-${id}">
        <span class="output-label">Output:</span>
        <span class="output-value" id="vid-name-preview-${id}">...</span>
      </div>
      <div class="file-progress-wrap" id="vid-progress-wrap-${id}" style="display:none">
        <div class="file-progress-bar" id="vid-progress-${id}"></div>
      </div>
      <div id="vid-time-${id}" class="vid-time-display"></div>
    `;

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'file-actions';
    actionsDiv.innerHTML = `
      <span class="file-status pending" id="vid-status-${id}">Menunggu</span>
      <button class="btn-icon rename-toggle" id="vid-rename-btn-${id}" title="Rename file" aria-label="Rename ${file.name}" aria-pressed="false">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon download" id="vid-dl-${id}" title="Download hasil" disabled aria-label="Download ${file.name}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="btn-icon remove" title="Hapus" aria-label="Hapus ${file.name}" data-remove-id="${id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    div.appendChild(thumbDiv);
    div.appendChild(infoDiv);
    div.appendChild(actionsDiv);

    // Rename toggle
    const renameBtn   = actionsDiv.querySelector(`#vid-rename-btn-${id}`);
    const renameRow   = infoDiv.querySelector(`#vid-rename-row-${id}`);
    const renameInput = infoDiv.querySelector(`#vid-rename-input-${id}`);

    renameBtn.addEventListener('click', () => {
      const isOpen = !renameRow.hidden;
      renameRow.hidden = isOpen;
      renameBtn.setAttribute('aria-pressed', String(!isOpen));
      renameBtn.classList.toggle('active', !isOpen);
      if (!isOpen) renameInput.focus();
    });

    renameInput.addEventListener('input', () => updateFilenamePreview(id));

    // Download handler
    actionsDiv.querySelector(`#vid-dl-${id}`).addEventListener('click', () => {
      const entry = queue.get(id);
      if (entry && entry.resultBlob) {
        downloadBlob(entry.resultBlob, entry.outputFilename);
        showToast(`${entry.outputFilename} berhasil diunduh!`, 'success');
      }
    });

    // Remove handler
    actionsDiv.querySelector('[data-remove-id]').addEventListener('click', () => {
      queue.delete(id);
      div.remove();
      updateQueueCount();
      updateBatchDownloadBtn();
      if (queue.size === 0) document.getElementById('video-queue-section').hidden = true;
    });

    return div;
  }

  /**
   * Get effective base name for an item
   */
  function getItemBaseName(id, file) {
    const input = document.getElementById(`vid-rename-input-${id}`);
    const val   = input ? input.value.trim() : '';
    return val || stripExt(file.name);
  }

  /**
   * Build FFmpeg arguments from current settings
   */
  function buildFFmpegArgs(inputName, outputName) {
    const codec      = document.getElementById('vid-codec').value;
    const crf        = document.getElementById('vid-crf').value;
    const resolution = document.getElementById('vid-resolution').value;
    const fps        = document.getElementById('vid-fps').value;
    const audio      = document.getElementById('vid-audio').value;
    const preset     = document.getElementById('vid-preset').value;

    const args = ['-i', inputName];

    if (codec === 'libvpx-vp9') {
      args.push('-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0');
    } else if (codec === 'libaom-av1') {
      args.push('-c:v', 'libaom-av1', '-crf', crf, '-b:v', '0', '-strict', 'experimental');
    } else {
      args.push('-c:v', codec, '-crf', crf);
      if (preset) args.push('-preset', preset);
    }

    if (resolution) args.push('-vf', `scale=${resolution}`);
    if (fps)        args.push('-r', fps);

    if (audio === 'strip')      args.push('-an');
    else if (audio === 'copy')  args.push('-c:a', 'copy');
    else if (audio === 'aac-128k') args.push('-c:a', 'aac', '-b:a', '128k');
    else if (audio === 'aac-192k') args.push('-c:a', 'aac', '-b:a', '192k');

    if (outputName.endsWith('.mp4')) args.push('-movflags', '+faststart');

    args.push(outputName);
    return args;
  }

  /**
   * Compress a single video file using FFmpeg.wasm
   */
  async function compressVideo(id, file) {
    if (!ffmpegReady || !ffmpeg) {
      throw new Error('FFmpeg belum siap. Tunggu hingga engine selesai dimuat.');
    }

    const codec      = document.getElementById('vid-codec').value;
    const ext        = codecToExt(codec);
    const inputName  = `input_${id}.${getExt(file.name)}`;
    const outputName = `output_${id}.${ext}`;

    const inputData = new Uint8Array(await file.arrayBuffer());
    ffmpeg.FS('writeFile', inputName, inputData);

    const startTime = Date.now();
    ffmpeg.setProgress(({ ratio }) => {
      if (typeof ratio === 'number' && !isNaN(ratio)) {
        const pct     = Math.min(Math.round(ratio * 100), 99);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        setProgress(id, pct);
        const timeEl = document.getElementById(`vid-time-${id}`);
        if (timeEl) timeEl.textContent = `${elapsed}s — ${pct}%`;
      }
    });

    const args = buildFFmpegArgs(inputName, outputName);
    await ffmpeg.run(...args);

    const outputData = ffmpeg.FS('readFile', outputName);
    const mimeMap    = { mp4: 'video/mp4', webm: 'video/webm' };
    const blob       = new Blob([outputData.buffer], { type: mimeMap[ext] || 'video/mp4' });

    try { ffmpeg.FS('unlink', inputName); } catch (_) {}
    try { ffmpeg.FS('unlink', outputName); } catch (_) {}

    return blob;
  }

  function setStatus(id, status, label) {
    const el = document.getElementById(`vid-status-${id}`);
    if (!el) return;
    el.className   = `file-status ${status}`;
    el.textContent = label;
  }

  function setProgress(id, pct) {
    const wrap = document.getElementById(`vid-progress-wrap-${id}`);
    const bar  = document.getElementById(`vid-progress-${id}`);
    if (!wrap || !bar) return;
    wrap.style.display = 'block';
    bar.style.width    = `${pct}%`;
  }

  function setResult(id, originalSize, compressedSize) {
    const afterEl = document.getElementById(`vid-meta-after-${id}`);
    const ratioEl = document.getElementById(`vid-ratio-${id}`);
    if (!afterEl || !ratioEl) return;

    const saved = 1 - compressedSize / originalSize;
    const pct   = Math.round(saved * 100);
    afterEl.className   = 'file-size-after';
    afterEl.textContent = `${formatBytes(compressedSize)}`;

    ratioEl.className   = `file-ratio ${pct >= 20 ? 'good' : 'ok'}`;
    ratioEl.textContent = `-${pct}%`;
  }

  /**
   * Compress all pending videos
   */
  async function compressAll() {
    if (!ffmpegReady) {
      showToast('FFmpeg belum siap. Harap tunggu engine selesai dimuat.', 'warning');
      return;
    }

    const compressBtn = document.getElementById('vid-compress-all');
    compressBtn.disabled = true;

    const entries = [...queue.entries()].filter(([, v]) => v.status === 'pending' || v.status === 'error');
    if (entries.length === 0) {
      showToast('Semua video sudah diproses.', 'info');
      compressBtn.disabled = false;
      return;
    }

    const { id: prefix, baseName: globalBase } = getNamingConfig();
    const codec = document.getElementById('vid-codec').value;
    const ext   = codecToExt(codec);

    for (const [id, entry] of entries) {
      entry.status = 'processing';
      setStatus(id, 'processing', 'Memproses...');
      setProgress(id, 5);

      try {
        const blob = await compressVideo(id, entry.file);
        entry.resultBlob = blob;
        entry.status     = 'done';

        const baseName = getItemBaseName(id, entry.file);
        const filename = buildOutputFilename({
          id:          prefix,
          baseName,
          seq:         entry.seq,
          orientation: entry.orientation,
          ext,
        });
        entry.outputFilename = filename;

        setProgress(id, 100);
        setStatus(id, 'done', 'Selesai');
        setResult(id, entry.file.size, blob.size);

        const previewEl = document.getElementById(`vid-name-preview-${id}`);
        if (previewEl) previewEl.textContent = filename;

        const dlBtn = document.getElementById(`vid-dl-${id}`);
        if (dlBtn) dlBtn.disabled = false;

        const timeEl = document.getElementById(`vid-time-${id}`);
        if (timeEl) timeEl.textContent = '';

        totalOriginalBytes  += entry.file.size;
        totalCompressedBytes += blob.size;
        processedCount++;
        updateStats();
        updateBatchDownloadBtn();

        showToast(`${filename} siap!`, 'success');
      } catch (err) {
        entry.status = 'error';
        setStatus(id, 'error', 'Gagal');
        setProgress(id, 0);
        showToast(`Gagal: ${err.message}`, 'error');
        console.error(err);
      }
    }

    compressBtn.disabled = false;
  }

  /**
   * Download all completed videos at once.
   */
  async function downloadAll() {
    const done = [...queue.values()].filter(e => e.status === 'done' && e.resultBlob);
    if (done.length === 0) {
      showToast('Belum ada video yang selesai dikompres.', 'warning');
      return;
    }
    for (const entry of done) {
      await new Promise(r => setTimeout(r, 150));
      downloadBlob(entry.resultBlob, entry.outputFilename);
    }
    showToast(`${done.length} video berhasil diunduh!`, 'success');
  }

  function updateBatchDownloadBtn() {
    const btn = document.getElementById('vid-download-all');
    if (!btn) return;
    const doneCount = [...queue.values()].filter(e => e.status === 'done' && e.resultBlob).length;
    btn.disabled = doneCount === 0;
    btn.title    = doneCount > 0 ? `Download semua (${doneCount} file)` : 'Belum ada file selesai';
  }

  function updateQueueCount() {
    const el = document.getElementById('vid-queue-count');
    if (el) el.textContent = queue.size;
  }

  function updateStats() {
    const banner = document.getElementById('stats-banner');
    banner.hidden = false;
    const saved = totalOriginalBytes - totalCompressedBytes;
    const ratio = totalOriginalBytes > 0
      ? Math.round((1 - totalCompressedBytes / totalOriginalBytes) * 100)
      : 0;
    document.getElementById('stat-files').textContent = processedCount;
    document.getElementById('stat-saved').textContent = formatBytes(saved);
    document.getElementById('stat-ratio').textContent  = `${ratio}%`;
  }

  function refreshAllPreviews() {
    for (const [id] of queue.entries()) {
      updateFilenamePreview(id);
    }
  }

  function clearAll() {
    queue.clear();
    seqCounter = 0;
    document.getElementById('video-file-list').innerHTML = '';
    document.getElementById('video-queue-section').hidden = true;
    updateQueueCount();
    updateBatchDownloadBtn();
  }

  async function retryLoad() {
    ffmpegReady = false;
    ffmpeg      = null;
    const indicator = document.getElementById('ffmpeg-indicator');
    indicator.className = 'ffmpeg-indicator loading';
    indicator.innerHTML = `<span class="spinner"></span><span id="ffmpeg-status-text">Memuat ulang FFmpeg dari lokal...</span>`;
    await loadFFmpeg();
  }

  // Public API
  return { loadFFmpeg, addFiles, compressAll, downloadAll, clearAll, retryLoad, refreshAllPreviews };
})();

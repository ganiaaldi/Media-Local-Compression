/**
 * image-compressor.js
 * Handles image compression using Canvas API + browser-native encoding.
 * Supports: JPEG, WebP, PNG.
 * Features: rename, ID prefix, portrait/landscape detection, batch download.
 */

const ImageCompressor = (() => {
  /**
   * Queue entry shape:
   * { file, id, status, resultBlob?, orientation?, outputFilename? }
   * @type {Map<string, object>}
   */
  const queue = new Map();

  // Sequence counter for this session's naming
  let seqCounter = 0;

  // Stats
  let totalOriginalBytes  = 0;
  let totalCompressedBytes = 0;
  let processedCount      = 0;

  /**
   * Add files to the queue and render them
   * @param {FileList|File[]} files
   */
  function addFiles(files) {
    const section = document.getElementById('image-queue-section');
    const listEl  = document.getElementById('image-file-list');

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        showToast(`Bukan file gambar: ${file.name}`, 'error');
        return;
      }
      const id = uid();
      seqCounter++;
      queue.set(id, { file, id, status: 'pending', seq: seqCounter, orientation: null });
      const itemEl = createFileItem(id, file);
      listEl.appendChild(itemEl);

      // Detect orientation asynchronously after element is in DOM
      detectOrientationForItem(id, file);
    });

    if (queue.size > 0) {
      section.hidden = false;
      updateQueueCount();
      updateBatchDownloadBtn();
    }
  }

  /**
   * Load image and detect orientation, then update the badge in the file item.
   */
  function detectOrientationForItem(id, file) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const orientation = detectImgOrientation(img);
      const entry = queue.get(id);
      if (entry) entry.orientation = orientation;

      // Update badge in UI
      const badge = document.getElementById(`img-orient-${id}`);
      if (badge) {
        badge.textContent  = orientation === 'P' ? 'Portrait' : orientation === 'L' ? 'Landscape' : 'Square';
        badge.dataset.orient = orientation;
        badge.hidden = false;
      }

      // Update preview filename
      updateFilenamePreview(id);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  /**
   * Update the preview of the output filename for a single item.
   */
  function updateFilenamePreview(id) {
    const entry = queue.get(id);
    if (!entry) return;
    const { id: prefix, baseName } = getNamingConfig();
    const format = document.getElementById('img-format').value;
    const ext    = format === 'jpeg' ? 'jpg' : format;
    const name   = buildOutputFilename({
      id:          prefix,
      baseName:    baseName || stripExt(entry.file.name),
      seq:         entry.seq,
      orientation: entry.orientation,
      ext,
    });
    const previewEl = document.getElementById(`img-name-preview-${id}`);
    if (previewEl) previewEl.textContent = name;
  }

  /**
   * Strip extension from filename
   */
  function stripExt(filename) {
    return filename.replace(/\.[^.]+$/, '');
  }

  /**
   * Create a file item DOM element
   */
  function createFileItem(id, file) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.id = `img-item-${id}`;
    div.setAttribute('role', 'listitem');

    // Thumbnail
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'file-thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.onload = () => URL.revokeObjectURL(img.src);
    thumbDiv.appendChild(img);

    // Info section — name + rename input + meta
    const infoDiv = document.createElement('div');
    infoDiv.className = 'file-info';
    infoDiv.innerHTML = `
      <div class="file-name-row">
        <div class="file-name" id="img-orig-name-${id}" title="${file.name}">${file.name}</div>
        <span class="orient-badge" id="img-orient-${id}" hidden data-orient=""></span>
      </div>
      <div class="file-rename-row" id="img-rename-row-${id}" hidden>
        <input
          type="text"
          class="file-rename-input"
          id="img-rename-input-${id}"
          placeholder="Nama baru (tanpa ekstensi)"
          aria-label="Rename file ${file.name}"
          value="${stripExt(file.name)}"
        />
      </div>
      <div class="file-meta">
        <span>${formatBytes(file.size)}</span>
        <span id="img-meta-after-${id}"></span>
        <span id="img-ratio-${id}"></span>
      </div>
      <div class="file-output-name" id="img-output-name-${id}">
        <span class="output-label">Output:</span>
        <span class="output-value" id="img-name-preview-${id}">...</span>
      </div>
      <div class="file-progress-wrap" id="img-progress-wrap-${id}" style="display:none">
        <div class="file-progress-bar" id="img-progress-${id}"></div>
      </div>
    `;

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'file-actions';
    actionsDiv.innerHTML = `
      <span class="file-status pending" id="img-status-${id}">Menunggu</span>
      <button class="btn-icon rename-toggle" id="img-rename-btn-${id}" title="Rename file" aria-label="Rename ${file.name}" aria-pressed="false">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon download" id="img-dl-${id}" title="Download hasil" disabled aria-label="Download ${file.name}">
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
    const renameBtn   = actionsDiv.querySelector(`#img-rename-btn-${id}`);
    const renameRow   = infoDiv.querySelector(`#img-rename-row-${id}`);
    const renameInput = infoDiv.querySelector(`#img-rename-input-${id}`);

    renameBtn.addEventListener('click', () => {
      const isOpen = !renameRow.hidden;
      renameRow.hidden = isOpen;
      renameBtn.setAttribute('aria-pressed', String(!isOpen));
      renameBtn.classList.toggle('active', !isOpen);
      if (!isOpen) renameInput.focus();
    });

    renameInput.addEventListener('input', () => updateFilenamePreview(id));

    // Download handler
    const dlBtn = actionsDiv.querySelector(`#img-dl-${id}`);
    dlBtn.addEventListener('click', () => {
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
      if (queue.size === 0) {
        document.getElementById('image-queue-section').hidden = true;
      }
    });

    return div;
  }

  /**
   * Get the effective base name for an item (rename input or original name).
   */
  function getItemBaseName(id, file) {
    const input = document.getElementById(`img-rename-input-${id}`);
    const val   = input ? input.value.trim() : '';
    return val || stripExt(file.name);
  }

  /**
   * Compress a single image file
   */
  async function compressImage(id, file) {
    const format      = document.getElementById('img-format').value;
    const quality     = parseInt(document.getElementById('img-quality').value) / 100;
    const maxWidthVal = parseInt(document.getElementById('img-max-width').value);

    return new Promise((resolve, reject) => {
      const img       = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let w = img.naturalWidth;
          let h = img.naturalHeight;

          if (maxWidthVal > 0 && w > maxWidthVal) {
            const ratio = maxWidthVal / w;
            w = maxWidthVal;
            h = Math.round(h * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          let mimeType;
          if (format === 'webp')       mimeType = 'image/webp';
          else if (format === 'jpeg')  mimeType = 'image/jpeg';
          else if (format === 'png')   mimeType = 'image/png';
          else                         mimeType = 'image/webp';

          const qualityParam = format === 'png' ? undefined : quality;

          canvas.toBlob(
            (blob) => { if (blob) resolve(blob); else reject(new Error('Canvas toBlob gagal')); },
            mimeType,
            qualityParam
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error(`Gagal memuat gambar: ${file.name}`));
      img.src = objectUrl;
    });
  }

  function setStatus(id, status, label) {
    const el = document.getElementById(`img-status-${id}`);
    if (!el) return;
    el.className  = `file-status ${status}`;
    el.textContent = label;
  }

  function setProgress(id, pct) {
    const wrap = document.getElementById(`img-progress-wrap-${id}`);
    const bar  = document.getElementById(`img-progress-${id}`);
    if (!wrap || !bar) return;
    wrap.style.display = 'block';
    bar.style.width    = `${pct}%`;
  }

  function setResult(id, originalSize, compressedSize) {
    const afterEl = document.getElementById(`img-meta-after-${id}`);
    const ratioEl = document.getElementById(`img-ratio-${id}`);
    if (!afterEl || !ratioEl) return;

    const saved = 1 - compressedSize / originalSize;
    const pct   = Math.round(saved * 100);
    afterEl.className  = 'file-size-after';
    afterEl.textContent = `${formatBytes(compressedSize)}`;

    ratioEl.className  = `file-ratio ${pct >= 30 ? 'good' : 'ok'}`;
    ratioEl.textContent = `-${pct}%`;
  }

  /**
   * Compress all pending files
   */
  async function compressAll() {
    const compressBtn = document.getElementById('img-compress-all');
    compressBtn.disabled = true;

    const entries = [...queue.entries()].filter(([, v]) => v.status === 'pending' || v.status === 'error');
    if (entries.length === 0) {
      showToast('Semua file sudah diproses.', 'info');
      compressBtn.disabled = false;
      return;
    }

    const { id: prefix, baseName: globalBase } = getNamingConfig();
    const format = document.getElementById('img-format').value;
    const ext    = format === 'jpeg' ? 'jpg' : format;

    for (const [id, entry] of entries) {
      entry.status = 'processing';
      setStatus(id, 'processing', 'Memproses...');
      setProgress(id, 30);

      try {
        const blob = await compressImage(id, entry.file);
        entry.resultBlob = blob;
        entry.status     = 'done';

        // Build final output filename
        const itemBase = getItemBaseName(id, entry.file);
        const baseName = itemBase || globalBase || stripExt(entry.file.name);
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

        // Update output name display
        const previewEl = document.getElementById(`img-name-preview-${id}`);
        if (previewEl) previewEl.textContent = filename;

        const dlBtn = document.getElementById(`img-dl-${id}`);
        if (dlBtn) dlBtn.disabled = false;

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
   * Download all completed files at once.
   */
  async function downloadAll() {
    const done = [...queue.values()].filter(e => e.status === 'done' && e.resultBlob);
    if (done.length === 0) {
      showToast('Belum ada file yang selesai dikompres.', 'warning');
      return;
    }
    for (const entry of done) {
      await new Promise(r => setTimeout(r, 120)); // brief delay between downloads
      downloadBlob(entry.resultBlob, entry.outputFilename);
    }
    showToast(`${done.length} file berhasil diunduh!`, 'success');
  }

  function updateBatchDownloadBtn() {
    const btn = document.getElementById('img-download-all');
    if (!btn) return;
    const doneCount = [...queue.values()].filter(e => e.status === 'done' && e.resultBlob).length;
    btn.disabled = doneCount === 0;
    btn.title    = doneCount > 0 ? `Download semua (${doneCount} file)` : 'Belum ada file selesai';
  }

  function updateQueueCount() {
    const el = document.getElementById('img-queue-count');
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

  /**
   * Called when naming inputs change — refresh all previews.
   */
  function refreshAllPreviews() {
    for (const [id, entry] of queue.entries()) {
      updateFilenamePreview(id);
    }
  }

  function clearAll() {
    queue.clear();
    seqCounter = 0;
    document.getElementById('image-file-list').innerHTML = '';
    document.getElementById('image-queue-section').hidden = true;
    updateQueueCount();
    updateBatchDownloadBtn();
  }

  // Public API
  return { addFiles, compressAll, downloadAll, clearAll, refreshAllPreviews };
})();

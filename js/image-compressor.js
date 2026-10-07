/**
 * image-compressor.js
 * Handles image compression using Canvas API + browser-native encoding.
 * Supports: JPEG, WebP, PNG.
 */

const ImageCompressor = (() => {
  /** @type {Map<string, {file: File, id: string, status: string, resultBlob?: Blob}>} */
  const queue = new Map();

  // Stats
  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;
  let processedCount = 0;

  /**
   * Add files to the queue and render them
   * @param {FileList|File[]} files
   */
  function addFiles(files) {
    const section = document.getElementById('image-queue-section');
    const listEl = document.getElementById('image-file-list');

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        showToast(`Bukan file gambar: ${file.name}`, 'error');
        return;
      }
      const id = uid();
      queue.set(id, { file, id, status: 'pending' });
      listEl.appendChild(createFileItem(id, file));
    });

    if (queue.size > 0) {
      section.hidden = false;
      updateQueueCount();
    }
  }

  /**
   * Create a file item DOM element
   * @param {string} id
   * @param {File} file
   * @returns {HTMLElement}
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

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'file-info';
    infoDiv.innerHTML = `
      <div class="file-name" title="${file.name}">${file.name}</div>
      <div class="file-meta">
        <span>${formatBytes(file.size)}</span>
        <span id="img-meta-after-${id}"></span>
        <span id="img-ratio-${id}"></span>
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

    // Download handler (attached after compression)
    const dlBtn = actionsDiv.querySelector(`#img-dl-${id}`);
    dlBtn.addEventListener('click', () => {
      const entry = queue.get(id);
      if (entry && entry.resultBlob) {
        const format = document.getElementById('img-format').value;
        const ext = format === 'jpeg' ? 'jpg' : format;
        downloadBlob(entry.resultBlob, changeExt(file.name, ext));
        showToast(`${file.name} berhasil diunduh!`, 'success');
      }
    });

    // Remove handler
    actionsDiv.querySelector('[data-remove-id]').addEventListener('click', () => {
      queue.delete(id);
      div.remove();
      updateQueueCount();
      if (queue.size === 0) {
        document.getElementById('image-queue-section').hidden = true;
      }
    });

    return div;
  }

  /**
   * Compress a single image file
   * @param {string} id
   * @param {File} file
   * @returns {Promise<Blob>}
   */
  async function compressImage(id, file) {
    const format = document.getElementById('img-format').value;
    const quality = parseInt(document.getElementById('img-quality').value) / 100;
    const maxWidthVal = parseInt(document.getElementById('img-max-width').value);

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let w = img.naturalWidth;
          let h = img.naturalHeight;

          // Resize if needed
          if (maxWidthVal > 0 && w > maxWidthVal) {
            const ratio = maxWidthVal / w;
            w = maxWidthVal;
            h = Math.round(h * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          // High quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          // Determine MIME type
          let mimeType;
          if (format === 'webp') mimeType = 'image/webp';
          else if (format === 'jpeg') mimeType = 'image/jpeg';
          else if (format === 'png') mimeType = 'image/png';
          else mimeType = 'image/webp';

          // PNG is lossless — quality param ignored
          const qualityParam = format === 'png' ? undefined : quality;

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas toBlob gagal'));
            },
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

  /**
   * Update a file item's UI state
   */
  function setStatus(id, status, label) {
    const el = document.getElementById(`img-status-${id}`);
    if (!el) return;
    el.className = `file-status ${status}`;
    el.textContent = label;
  }

  function setProgress(id, pct) {
    const wrap = document.getElementById(`img-progress-wrap-${id}`);
    const bar  = document.getElementById(`img-progress-${id}`);
    if (!wrap || !bar) return;
    wrap.style.display = 'block';
    bar.style.width = `${pct}%`;
  }

  function setResult(id, originalSize, compressedSize) {
    const afterEl = document.getElementById(`img-meta-after-${id}`);
    const ratioEl = document.getElementById(`img-ratio-${id}`);
    if (!afterEl || !ratioEl) return;

    const saved = 1 - compressedSize / originalSize;
    const pct = Math.round(saved * 100);
    afterEl.className = 'file-size-after';
    afterEl.textContent = `→ ${formatBytes(compressedSize)}`;

    ratioEl.className = `file-ratio ${pct >= 30 ? 'good' : 'ok'}`;
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

    for (const [id, entry] of entries) {
      entry.status = 'processing';
      setStatus(id, 'processing', 'Memproses...');
      setProgress(id, 30);

      try {
        const blob = await compressImage(id, entry.file);
        entry.resultBlob = blob;
        entry.status = 'done';

        setProgress(id, 100);
        setStatus(id, 'done', 'Selesai');
        setResult(id, entry.file.size, blob.size);

        // Enable download button
        const dlBtn = document.getElementById(`img-dl-${id}`);
        if (dlBtn) dlBtn.disabled = false;

        // Stats
        totalOriginalBytes += entry.file.size;
        totalCompressedBytes += blob.size;
        processedCount++;
        updateStats();

        showToast(`${entry.file.name} berhasil dikompres!`, 'success');
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
    document.getElementById('stat-ratio').textContent = `${ratio}%`;
  }

  function clearAll() {
    queue.clear();
    document.getElementById('image-file-list').innerHTML = '';
    document.getElementById('image-queue-section').hidden = true;
    updateQueueCount();
  }

  // Public API
  return { addFiles, compressAll, clearAll };
})();

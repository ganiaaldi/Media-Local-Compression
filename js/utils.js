/**
 * utils.js — Shared helper functions
 */

/**
 * Format bytes to human-readable string
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string}
 */
function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} [duration=3500]
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);

  const remove = () => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  setTimeout(remove, duration);
  toast.addEventListener('click', remove);
}

/**
 * Generate a unique ID
 * @returns {string}
 */
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Download a Blob as a file
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Get file extension
 * @param {string} filename
 * @returns {string}
 */
function getExt(filename) {
  return filename.split('.').pop().toLowerCase();
}

/**
 * Change file extension
 * @param {string} filename
 * @param {string} newExt
 * @returns {string}
 */
function changeExt(filename, newExt) {
  const base = filename.replace(/\.[^.]+$/, '');
  return `${base}.${newExt}`;
}

/**
 * Compute output extension from codec
 * @param {string} codec
 * @returns {string}
 */
function codecToExt(codec) {
  const map = {
    'libx264': 'mp4',
    'libx265': 'mp4',
    'libvpx-vp9': 'webm',
    'libaom-av1': 'webm',
  };
  return map[codec] || 'mp4';
}

/**
 * Build output filename from naming config.
 * Format: {ID}.{BaseName}_{seq}_{orientation}.{ext}
 * If ID is empty, skip the "ID." prefix.
 * If orientation is null, skip the orientation suffix.
 *
 * @param {object} opts
 * @param {string} opts.id         - Optional ID prefix, e.g. "012"
 * @param {string} opts.baseName   - Base name, e.g. "Ardi"
 * @param {number} opts.seq        - 1-based sequence number
 * @param {string|null} opts.orientation - "P", "L", or null
 * @param {string} opts.ext        - File extension without dot, e.g. "webp"
 * @returns {string}
 */
function buildOutputFilename({ id, baseName, seq, orientation, ext }) {
  const seqStr = String(seq).padStart(2, '0');
  const nameClean = (baseName || 'output').trim().replace(/\s+/g, '_');
  const idClean   = (id || '').trim().replace(/\s+/g, '');

  let stem = nameClean;
  if (idClean) stem = `${idClean}.${nameClean}`;

  stem += `_${seqStr}`;
  if (orientation) stem += `_${orientation}`;

  return `${stem}.${ext}`;
}

/**
 * Detect image orientation from an Image element
 * @param {HTMLImageElement} img
 * @returns {'P'|'L'|'S'} Portrait, Landscape, or Square
 */
function detectImgOrientation(img) {
  if (img.naturalWidth > img.naturalHeight) return 'L';
  if (img.naturalHeight > img.naturalWidth) return 'P';
  return 'S'; // Square — treat as portrait for naming
}

/**
 * Detect video orientation from a video element
 * @param {HTMLVideoElement} video
 * @returns {Promise<'P'|'L'|'S'>}
 */
function detectVideoOrientation(video) {
  return new Promise((resolve) => {
    const check = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        if (w > h) resolve('L');
        else if (h > w) resolve('P');
        else resolve('S');
      } else {
        resolve('L'); // fallback
      }
    };
    if (video.readyState >= 1) {
      check();
    } else {
      video.addEventListener('loadedmetadata', check, { once: true });
    }
  });
}

/**
 * Read naming config from shared UI inputs.
 * Returns { id, baseName } from the currently active tab's naming panel.
 * @param {'image'|'video'} type
 * @returns {{ id: string, baseName: string }}
 */
function getNamingConfig() {
  const id       = (document.getElementById('global-name-id')?.value || '').trim();
  const baseName = (document.getElementById('global-name-base')?.value || '').trim();
  return { id, baseName };
}

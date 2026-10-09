# 🗜️ MediaLite — Local Media Compressor

Aplikasi web untuk **kompresi foto & video** dari kamera profesional yang berjalan **100% lokal di browser** — tidak ada file yang dikirim ke server.

---

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 🖼️ Kompresi Gambar | JPG, PNG, WEBP, HEIC — canvas-based, cepat |
| 🎬 Kompresi Video | MP4, MOV, MKV, AVI — berbasis FFmpeg.wasm (offline) |
| 📏 Resize Otomatis | Atur resolusi output tanpa distorsi |
| 🔒 100% Offline | Tidak ada upload ke server, privasi terjaga |
| 🗂️ Batch Processing | Drag & drop banyak file sekaligus |
| 📊 Statistik | Tampil ukuran sebelum/sesudah dan % penghematan |
| 🏷️ Strip EXIF | Hapus metadata GPS & kamera otomatis |
| ✏️ Penamaan Pintar | ID Prefix, Nama Dasar, & rename individual |
| 🧭 Deteksi Orientasi| Otomatis mendeteksi Portrait (_P), Landscape (_L), & Square (_S) |
| 📥 Batch Download | Unduh semua hasil kompresi dengan satu klik |

---

## 📁 Struktur Folder

```
media-compression/
├── index.html              # Halaman utama aplikasi
├── css/
│   └── style.css           # Styling & animasi
├── js/
│   ├── app.js              # Inisialisasi & event handler utama
│   ├── image-compressor.js # Modul kompresi gambar (Canvas API)
│   ├── video-compressor.js # Modul kompresi video (FFmpeg.wasm)
│   └── utils.js            # Helper functions (formatBytes, uid, dll)
├── server.js               # Custom HTTP server (COOP/COEP headers)
└── vendor/
    ├── ffmpeg.js              # FFmpeg.wasm library v0.11.6
    ├── ffmpeg-core.js         # FFmpeg core engine
    ├── ffmpeg-core.wasm       # Binary WASM (~24 MB)
    └── ffmpeg-core.worker.js  # Web Worker untuk FFmpeg
```

---

## 🚀 Cara Menjalankan

> **Penting:** Aplikasi **harus** dijalankan melalui HTTP server karena FFmpeg.wasm tidak bisa memuat file `.wasm` dari `file://` protocol.
> Selain itu, FFmpeg.wasm membutuhkan header **COOP/COEP** agar `SharedArrayBuffer` tersedia di browser.

### Opsi 1 — Menggunakan `start.bat` (Direkomendasikan & Paling Mudah)

Untuk pengguna Windows, cukup double-click (klik ganda) file **`start.bat`** di dalam folder `media-compression`. Script ini akan otomatis mengecek instalasi Node.js, menjalankan server, dan membuka browser Anda ke alamat aplikasi.

### Opsi 2 — Menggunakan `node server.js` (Manual Terminal)

Sudah disertakan dalam package — pastikan Anda memiliki Node.js terinstall:

```bash
node server.js
```

Kemudian buka browser dan akses:

```
http://localhost:8787
```

> Server ini otomatis menambahkan header `Cross-Origin-Opener-Policy` dan `Cross-Origin-Embedder-Policy` yang diperlukan FFmpeg.wasm.

### Opsi 2 — Menggunakan Python

```bash
# Python 3
python -m http.server 8787

# Python 2
python -m SimpleHTTPServer 8787
```

Buka: `http://localhost:8787`

### Opsi 3 — Menggunakan VS Code Extension

Install ekstensi **Live Server** di VS Code, kemudian klik kanan `index.html` → **Open with Live Server**.

### Opsi 4 — Menggunakan Node.js `http-server`

```bash
npm install -g http-server
http-server . -p 8787
```

Buka: `http://localhost:8787`

---

## 🖼️ Kompresi Gambar — Cara Penggunaan

1. Pastikan tab **Image** aktif (default saat pertama buka)
2. Atur **ID Prefix** dan **Nama Dasar** secara global di bagian atas halaman (Opsional)
3. Drag & drop file gambar ke area dropzone, atau klik untuk memilih file
4. Format yang didukung: `JPG`, `PNG`, `WEBP`, `HEIC`
5. Atur pengaturan kompresi:
   - **Format Output**: WebP (terkecil), JPEG, atau PNG (lossless)
   - **Kualitas**: Geser slider (10–100%). Rekomendasikan 75–85% untuk web
   - **Maks. Lebar**: Resize otomatis menjaga aspek rasio (default: Full HD 1920px)
   - **Hapus EXIF**: Hapus metadata GPS & kamera untuk privasi
   - **Progressive Loading**: File JPEG dimuat bertahap di browser
6. Klik **Kompres Semua**
7. Klik ikon **Download** (⬇️) di setiap file, atau gunakan tombol **Download Semua** jika ingin mengunduh semua sekaligus.

---

## 🎬 Kompresi Video — Cara Penggunaan

1. Klik tab **Video** di header
2. Tunggu status FFmpeg berubah menjadi **hijau**: *"FFmpeg siap — kompresi video tersedia (100% offline)"*
   - Proses loading pertama membutuhkan beberapa detik untuk mengompilasi WASM
   - Loading hanya dilakukan sekali per sesi browser
3. Drag & drop file video ke area dropzone, atau klik untuk memilih file
4. Format yang didukung: `MP4`, `MOV`, `MKV`, `AVI`, `M4V`
5. Atur pengaturan kompresi:

   | Pengaturan | Pilihan | Keterangan |
   |---|---|---|
   | **Codec** | H.264, H.265, VP9 | H.265 = 50% lebih kecil dari H.264 |
   | **Kualitas (CRF)** | 0–51 | Semakin kecil nilai = kualitas lebih tinggi. Rekomendasi: 23–28 |
   | **Resolusi** | Original, 4K, FHD, HD, 480p | Resize otomatis (aspect ratio terjaga) |
   | **Frame Rate** | Original, 60fps, 30fps, 24fps | Kurangi FPS untuk ukuran lebih kecil |
   | **Audio** | AAC 128k, 192k, Pertahankan, Hapus | Hapus audio untuk pengurangan maksimal |
   | **Preset** | Ultrafast, Fast, Medium, Slow | Semakin lambat = kualitas lebih baik |

6. Klik **Kompres Semua**
7. Kompresi berjalan **satu per satu** (FFmpeg.wasm single-threaded)
8. Setelah selesai, klik ikon **Download** (⬇️) untuk mengunduh hasil secara individual, atau tombol **Download Semua** untuk mengunduh sekaligus.

---

## 🏷️ Penamaan Pintar & Deteksi Orientasi

Aplikasi ini menyertakan sistem penamaan otomatis yang memudahkan kategorisasi media:
- Tentukan **ID Prefix** (contoh: `012`) dan **Nama Dasar** (contoh: `Ardi`) pada kolom pengaturan di atas area dropzone. Pengaturan ini bersifat global (berlaku untuk gambar dan video).
- **Deteksi Orientasi:** Aplikasi akan mendeteksi rasio aspek media Anda dan otomatis memberikan suffix pada akhir nama file:
  - **_P** : Portrait (Vertikal)
  - **_L** : Landscape (Horizontal)
  - **_S** : Square (Persegi / Kotak)
- **Rename Individual:** Anda bisa menekan tombol pensil di daftar antrean untuk mengganti nama dasar file tersebut secara manual tanpa harus mengubah file lainnya.

Contoh output: `012. Ardi_01_P.webp`, `012. Ardi_02_L.mp4`.

---

## ⚙️ Rekomendasi Pengaturan

### Foto Kamera (untuk Web/CMS)
```
Format    : WebP
Kualitas  : 82%
Maks. Lebar: Full HD — 1920px
Hapus EXIF: ✅ Ya
```
Hasil tipikal: File 8MB → 300–600KB (penghematan ~90%)

### Video Kamera 4K (untuk Web)
```
Codec     : H.264 (kompatibilitas luas)
CRF       : 26
Resolusi  : Full HD — 1920px
FPS       : 30
Audio     : AAC 128kbps
Preset    : Medium
```
Hasil tipikal: File 500MB → 50–100MB (penghematan ~80%)

### Video untuk Arsip (kualitas tinggi)
```
Codec     : H.265
CRF       : 20
Resolusi  : Original
FPS       : Original
Audio     : Pertahankan Original
Preset    : Slow
```

---

## ❗ Troubleshooting

### FFmpeg gagal memuat / stuck loading
- Pastikan server lokal sudah berjalan (lihat bagian **Cara Menjalankan** di atas)
- Jangan buka `index.html` langsung sebagai `file://...`
- Coba klik tombol **Coba lagi** yang muncul di status bar
- Coba refresh halaman browser

### Video hasil kosong / error saat kompres
- Codec **H.265** dan **VP9** mungkin tidak didukung di versi FFmpeg.wasm ini untuk semua format input — coba ganti ke **H.264**
- Pastikan format input video didukung (MP4, MOV, MKV, AVI)
- Periksa console browser (F12) untuk melihat detail error

### Gambar HEIC tidak bisa dibuka
- HEIC dari iPhone/kamera Apple membutuhkan dukungan browser
- Disarankan konversi ke JPG terlebih dahulu menggunakan software kamera

---

## 🔧 Teknologi yang Digunakan

| Komponen | Teknologi |
|---|---|
| UI | HTML5, Vanilla CSS, Vanilla JS |
| Kompresi Gambar | Canvas API, `canvas.toBlob()` |
| Kompresi Video | [FFmpeg.wasm v0.11.6](https://github.com/ffmpegwasm/ffmpeg.wasm) |
| Font | Inter, JetBrains Mono (Google Fonts) |
| Server (dev) | `npx serve` |

---

## 📝 Lisensi

Proyek ini untuk penggunaan pribadi/internal. FFmpeg tunduk pada lisensi LGPL v2.1.

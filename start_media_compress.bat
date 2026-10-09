@echo off
title MediaLite Server
echo ===================================================
echo Memulai MediaLite...
echo ===================================================

:: Cek apakah Node.js terinstall
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js tidak ditemukan!
    echo MediaLite membutuhkan Node.js untuk bisa berjalan.
    echo Harap download dan install Node.js dari: https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Buka browser secara otomatis
echo Membuka browser ke http://localhost:8787...
start http://localhost:8787

:: Jalankan server lokal
node server.js

pause

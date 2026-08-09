# PRD — SIMAPAN (Sistem Monitoring Aktivitas Warga Binaan)

## Problem Statement (ringkasan)
Sistem pencatatan aktivitas warga binaan lapas berbasis pemindaian barcode: tabel inmates, users (4 role), activities (dengan approval workflow), audit_log, locations (GPS tag), approvals (riwayat status). Fitur utama: ekspor Excel, kategori yang bisa diedit admin, pusat unduh barcode (warga binaan + lokasi), manajemen akun operator per perangkat/lokasi, dan pencatatan otomatis saat barcode discan di titik lokasi.

## Arsitektur
- Backend: FastAPI + MongoDB (motor), prefix /api, JWT auth (Bearer + cookie), bcrypt
- Frontend: React (CRA + craco), Tailwind + Shadcn, SWR, sonner, html5-qrcode
- Desain: Swiss high-contrast (Chivo + IBM Plex Sans, rounded-none), halaman scan dark mobile-first
- Barcode: QR code (library qrcode), konten = barcode_data (default: no. registrasi, editable)
- Ekspor: openpyxl → StreamingResponse XLSX

## Persona
- Admin: kelola master data, kategori, akun, audit
- Supervisor: menyetujui/menolak aktivitas
- Operator: perangkat scan di lokasi tugas (assigned_location + device_name)
- Read-only: hanya melihat

## Yang Sudah Diimplementasikan (9 Agu 2026)
- Auth JWT lengkap + seeding admin (mypain2406@gmail.com)/supervisor/operator1
- CRUD warga binaan, lokasi (nama + GPS + QR), pengguna (role + lokasi tugas + perangkat)
- Halaman scan 3 langkah (setup lokasi/kategori → kamera/manual → konfirmasi + kondisi/durasi)
- Approval workflow submitted → approved/rejected + riwayat status (tabel approvals)
- Ekspor aktivitas ke Excel dengan filter (status/kategori/lokasi/tanggal)
- Pengaturan: edit judul kategori aktivitas, tipe lokasi, kondisi, identitas aplikasi
- Pusat unduh barcode (grid QR warga binaan + lokasi, download PNG)
- Dashboard statistik real-time, log audit dengan filter
- Testing: 16/16 pytest + e2e Playwright lolos; perbaikan sanitasi _id audit & parens tanggal

## Backlog
- P0: (kosong)
- P1: Upload foto warga binaan & foto bukti aktivitas (object storage); cetak kartu barcode massal (PDF)
- P2: Laporan rekap per periode per lokasi; notifikasi peringatan medis ke supervisor; mode offline scan dengan sinkronisasi

## Next Tasks
1. Konfirmasi kebutuhan cetak kartu barcode massal
2. Integrasi upload foto (perlu playbook object storage)

# PRD — KAWAN PAS (Sistem Monitoring Aktivitas Warga Binaan)

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

## Update 9 Agu 2026 (iterasi 2)
- Rename aplikasi SIMAPAN → KAWAN PAS (DB settings + semua fallback kode)
- Integrasi Claude AI (claude-sonnet-4-6 via Emergent Universal Key): halaman /ai khusus admin & supervisor
  - Asisten Chat: tanya-jawab data sistem real-time, streaming SSE, riwayat sesi persisten di MongoDB (ai_messages)
  - Laporan Otomatis: laporan naratif resmi periode hari ini / 7 hari, streaming, tombol salin
- Testing: 11/11 pytest AI + e2e lolos (role gate operator 403, regresi approvals & Excel OK)

## Update 9 Agu 2026 (iterasi 3)
- Form Tambah/Edit Warga Binaan disederhanakan: Nama, Umur, Blok, Agama, Nomor Register, Perkara/Pidana, Tanggal Bebas, 1/3MP, 1/2MP, 2/3MP, Peringatan Medis, Keterangan/Program Pembinaan (field baru: age, religion, mp_1_3, mp_1_2, mp_2_3, program_notes; update parsial exclude_unset agar barcode_data tidak terhapus)

## Update 9 Agu 2026 (iterasi 4)
- Laporan Otomatis kini berformat LAPORAN ATENSI PIMPINAN (Kepada Yth Kepala Lapas, Dari petugas, I. Peristiwa, II. Uraian kronologis, III. Tempat, IV. Dokumentasi, V. Tindak Lanjut, VI. Penutup, TTD + Nama & NIP); tombol diganti "Buat Laporan Atensi"; input Nama & NIP petugas (tersimpan di localStorage)

## Update 9 Agu 2026 (iterasi 5)
- Laporan Atensi: input tujuan laporan (Kepada Yth., tersimpan di localStorage), filter cakupan per lokasi dan/atau kategori dengan opsi "Semua (Menyeluruh)"; terverifikasi tidak ada kebocoran data lintas lokasi

## Update 9 Agu 2026 (iterasi 6)
- Laporan Atensi: kolom isian Tempat/Kota untuk baris tanggal laporan (tersimpan di localStorage, field `place` di backend); terverifikasi hasil "Palangka Raya, 09 Agustus 2026"

## Backlog
- P0: (kosong)
- P1: Upload foto warga binaan & foto bukti aktivitas (object storage); cetak kartu barcode massal (PDF); cache 30-60s untuk build_ai_context bila chat dipakai intensif
- P2: Laporan rekap per periode per lokasi; notifikasi peringatan medis ke supervisor; mode offline scan dengan sinkronisasi; unduh laporan AI sebagai PDF/DOCX

## Next Tasks
1. Konfirmasi kebutuhan cetak kartu barcode massal
2. Integrasi upload foto (perlu playbook object storage)

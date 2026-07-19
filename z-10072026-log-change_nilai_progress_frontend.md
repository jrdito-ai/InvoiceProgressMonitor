# PLAN LAMA - SUDAH DIREVISI DAN DIEKSEKUSI DENGAN PENDEKATAN BERBEDA

# Log Change Plan: nilai_progress Frontend

Tanggal: 2026-07-10

## Tujuan

User tetap input `nilai_progress` dalam satuan **juta rupiah**, tetapi nilai yang disimpan ke database `monthly_status.nilai_progress` harus dalam **rupiah asli** agar seluruh perhitungan aplikasi tetap konsisten.

Contoh:
- Input user: `1000`
- Arti bisnis: `Rp 1.000.000.000`
- Nilai yang disimpan ke DB: `1000000000`

## Latar Belakang

Kode frontend dan summary saat ini mengasumsikan bahwa `nilai_progress` di database disimpan dalam rupiah asli.

Dampaknya:
- KPI `Total Nilai Progress` menjumlahkan `nilai_progress` secara langsung.
- Tampilan nilai menggunakan formatter IDR.
- Chart `Pipeline - Nilai Progress` membagi nilai dengan `1_000_000` untuk ditampilkan dalam juta rupiah.

Jika database menyimpan angka dalam satuan juta tanpa konversi, maka:
- KPI total menjadi salah.
- Tampilan nilai di tabel menjadi salah.
- Chart dapat terlihat tidak sesuai konteks bisnis.

## Keputusan Implementasi

Standar data yang dipakai:
- Input user: **juta rupiah**
- Penyimpanan DB: **rupiah asli**

Artinya, konversi dilakukan di frontend saat proses simpan dan submit.

## Scope Perubahan Frontend

### 1. Create Modal

Lokasi terkait:
- `src/components/InvoiceProgressMonitor_v2.jsx`

Perubahan yang direncanakan:
- Nilai input `nilai_progress` tetap diisi user dalam satuan juta.
- Sebelum memanggil `createInvoice`, nilai dikonversi:

```text
nilai_progress_db = nilai_progress_input * 1_000_000
```

### 2. Edit / Submit Modal

Lokasi terkait:
- `src/components/InvoiceProgressMonitor_v2.jsx`

Perubahan yang direncanakan:
- Nilai input `nilai_progress` tetap diisi user dalam satuan juta.
- Sebelum memanggil `submitNilaiProgress`, nilai dikonversi:

```text
nilai_progress_db = nilai_progress_input * 1_000_000
```

### 3. Prefill Nilai Saat Edit

Lokasi terkait:
- `src/components/InvoiceProgressMonitor_v2.jsx`

Perubahan yang direncanakan:
- Saat modal edit dibuka, `row.nilai_progress` dari database yang tersimpan dalam rupiah asli perlu ditampilkan kembali ke user dalam satuan juta.
- Konversi tampilan:

```text
nilai_progress_input = nilai_progress_db / 1_000_000
```

Tanpa langkah ini, user akan melihat angka rupiah penuh, padahal input yang diharapkan adalah satuan juta.

### 4. Label dan Hint Input

Lokasi terkait:
- `src/components/InvoiceProgressMonitor_v2.jsx`

Perubahan yang direncanakan:
- Ubah label atau placeholder agar eksplisit menunjukkan satuan input.
- Contoh label:
  - `Nilai Progress (Juta Rp)`

Tujuannya agar user tidak bingung apakah harus input `1000` atau `1000000000`.

## Alur Data Setelah Perubahan

### Create

1. User input `1000`
2. Frontend membaca sebagai `1000` juta
3. Frontend konversi ke `1000000000`
4. Frontend kirim ke `createInvoice`
5. Supabase simpan `1000000000` ke `monthly_status.nilai_progress`

### Edit / Submit

1. DB memiliki `1000000000`
2. Saat modal edit dibuka, frontend tampilkan `1000`
3. User ubah jika perlu
4. Saat submit, frontend konversi lagi ke rupiah asli
5. Supabase simpan hasil konversi

## Dampak yang Diharapkan

Setelah perubahan ini:
- KPI `Total Nilai Progress` akan membaca angka yang benar.
- Tabel nilai progress akan tampil sesuai nominal rupiah.
- Chart `Pipeline - Nilai Progress` akan menghasilkan total juta rupiah yang benar.
- Approval flow tetap berjalan tanpa perubahan struktur proses.

## Hal yang Tidak Diubah

Rencana ini tidak mengubah:
- Struktur tabel Supabase.
- Logika approve / reject.
- Rumus chart summary.
- Backend RPC atau trigger database.

Fokus perubahan hanya pada normalisasi satuan input di frontend.

## Risiko dan Catatan Penting

Risiko utama ada pada data lama di Supabase.

Perlu dipastikan apakah data `monthly_status.nilai_progress` yang sudah ada saat ini:
- seluruhnya disimpan dalam satuan juta, atau
- sudah campuran antara juta dan rupiah asli.

Jika seluruh data lama masih dalam juta, maka perlu migrasi data agar konsisten dengan standar baru.

Contoh migrasi konseptual:

```text
nilai_progress_baru = nilai_progress_lama * 1_000_000
```

Jika datanya campuran, maka perlu audit data terlebih dahulu sebelum migrasi.

## Rekomendasi Lanjutan

Sebelum implementasi kode:
1. Verifikasi satuan data lama di `monthly_status.nilai_progress`.
2. Tentukan apakah perlu migrasi data historis.
3. Setelah itu baru implementasikan perubahan frontend.

## Ringkasan Keputusan

- User tetap input `nilai_progress` dalam satuan juta.
- Frontend bertanggung jawab mengonversi ke rupiah asli saat save/submit.
- Frontend juga mengonversi dari rupiah asli ke juta saat membuka form edit.
- Database tetap menjadi sumber data baku dalam rupiah asli.

---

# EXECUTION UPDATE

Tanggal eksekusi: 2026-07-19

## Ringkasan Revisi Keputusan

Setelah verifikasi data aktual di Supabase, dipastikan bahwa `monthly_status.nilai_progress` **tetap disimpan dalam satuan juta rupiah**, bukan rupiah asli.

Karena itu, plan awal di atas **tidak dijalankan apa adanya**.

Keputusan final yang disepakati:
- Data di database **tidak diubah**.
- Tidak dilakukan migrasi data historis.
- Tidak ada konversi juta -> rupiah saat save/submit.
- Perubahan difokuskan pada **backend aplikasi yang membaca data** dan **tampilan frontend** agar konsisten dengan fakta bahwa data di DB memang dalam satuan juta.

## Hasil Verifikasi Sebelum Implementasi

Hasil pengecekan:
- User mengonfirmasi bahwa nilai di kolom `monthly_status.nilai_progress` memang tersimpan dalam format seperti `1000`, artinya **1000 juta rupiah**.
- Dengan kondisi tersebut, tampilan yang menganggap data sebagai rupiah asli akan menghasilkan satuan yang salah.

## Scope Implementasi Aktual

Lokasi perubahan utama:
- `src/components/InvoiceProgressMonitor_v2.jsx`

Perubahan yang benar-benar diterapkan:

### 1. KPI Total Nilai Progress

Perubahan:
- Label diubah menjadi `Total Nilai Progress (Juta Rp)`.
- Nilai KPI diubah agar tampil dalam format **jutaan**, bukan full rupiah.

Implementasi:
- Dari `formatIDR(...)`
- Menjadi `formatJuta(...)`

Tujuan:
- Agar pembacaan unit pada card KPI konsisten dengan data sumber di database.

### 2. Chart Pipeline - Nilai Progress

Perubahan:
- Nilai chart diperlakukan langsung sebagai **jutaan**.
- Label angka pada bar chart diubah agar tampil tanpa suffix `jt`.
- Tooltip chart diubah agar menampilkan angka lokal Indonesia dengan label `Nilai (juta Rp)`.

Implementasi:
- Format label chart diubah dari bentuk seperti `5000jt` menjadi `5.000`.
- Tooltip diubah dari format seperti `Rp 5000 jt` menjadi angka jutaan yang lebih eksplisit satuannya.

Tujuan:
- Agar judul chart `Pipeline - Nilai Progress (juta Rp)` konsisten dengan angka yang ditampilkan.

### 3. Tampilan Nilai Progress di Tabel dan Watchlist

Perubahan yang ikut masuk dalam file komponen yang sama:
- Tampilan nilai progress pada tabel dibuat eksplisit dalam satuan jutaan dengan suffix `jt`.
- Tampilan nilai pada overdue watchlist diformat ke full IDR dari sumber data jutaan.

Tujuan:
- Menjaga konsistensi tampilan antara tabel detail dan area summary.

### 4. Label Input Form

Perubahan yang ikut diterapkan:
- Label input di create/edit modal menjadi `Nilai Progress (Juta Rp)`.
- Placeholder menjadi `Contoh: 1000`.

Tujuan:
- Menegaskan ke user bahwa input yang dimasukkan tetap dalam satuan juta rupiah.

## Hal yang Tidak Diubah Saat Eksekusi

Bagian berikut **tetap tidak diubah**:
- Struktur tabel Supabase.
- Isi data lama pada database.
- Logic `createInvoice` untuk mengonversi nilai sebelum simpan.
- Logic `submitNilaiProgress` untuk mengonversi nilai sebelum simpan.
- Approval flow admin/editor.
- Trigger dan policy database.

Artinya:
- Save/create/edit tetap menyimpan angka jutaan seperti sebelumnya.
- Deploy ini **tidak menyentuh data existing**.

## Verifikasi Build

Sebelum deploy dilakukan, aplikasi diverifikasi dengan build production:

```bash
npm run build
```

Hasil:
- Build sukses.
- Vite production build selesai tanpa error.
- Ada warning ukuran chunk besar, tetapi **bukan blocker** untuk deploy.

## Commit dan Deploy

Commit yang dibuat:

```text
82ab8e5 fix: align nilai_progress units in UI
```

Langkah deploy:
- Perubahan di-commit ke branch `main`.
- Perubahan di-push ke `origin/main`.
- Netlify auto-deploy terpicu dari branch `main`.

## Dampak Deployment

Setelah deploy:
- KPI `Total Nilai Progress` tampil dalam **jutaan**.
- Chart `Pipeline - Nilai Progress` tampil dalam **jutaan** tanpa suffix `jt`.
- User aktif yang sedang login **tidak mengalami risiko kerusakan data**.
- Efek paling mungkin hanya user perlu refresh browser untuk mendapatkan bundle frontend terbaru.

## Kesimpulan Akhir

Plan awal yang mengarah ke konversi data juta -> rupiah asli **dibatalkan**.

Implementasi final yang dijalankan adalah:
- **DB tetap as-is** dalam satuan juta.
- **Frontend dan pembacaan data** disesuaikan agar satuan tampil benar.
- **Tidak ada perubahan data existing**.
- **Build dan deploy berhasil dijalankan**.

---

# EXECUTION UPDATE 2

Tanggal eksekusi: 2026-07-19

## Latar Belakang Perbaikan Tambahan

Setelah implementasi penyesuaian satuan `nilai_progress`, ditemukan inkonsistensi pada card Summary `Konversi Piutang Usaha`.

Kasus verifikasi:
- Filter periode: `Maret 2026`
- Filter departemen: `E&I`
- Data aktual yang tervalidasi di tab `Input & Edit`: `4 Done` dan `1 Not Done`

Dengan data tersebut, hasil KPI yang benar seharusnya:

```text
4 / 5 x 100 = 80%
```

Namun di Summary sempat tampil `33%`.

## Akar Masalah

Ada dua penyebab utama di frontend:

1. Filter departemen di Summary tidak diterapkan konsisten untuk akun `super viewer`.
2. KPI dan chart Summary masih menghitung seluruh `rows`, termasuk row non-aktif seperti placeholder dengan `id = null`.

Efeknya:
- Summary bisa memakai denominator lebih besar dari jumlah billing event valid.
- Nilai KPI dapat berbeda dari total baris nyata yang user lihat pada `Input & Edit`.

## Perubahan yang Diterapkan

Lokasi perubahan:
- `src/components/InvoiceProgressMonitor_v2.jsx`

### 1. Filter Departemen Summary Disamakan untuk Semua User

Perubahan:
- Derived dataset `rows` sekarang selalu mengikuti filter `Departemen` yang dipilih di UI.
- Tidak ada lagi bypass filter departemen untuk `super viewer` saat user memilih departemen tertentu.

Hasil behavior:
- Jika pilih `Semua`, Summary menghitung seluruh departemen.
- Jika pilih `E&I`, Summary hanya menghitung `E&I`.
- Perlakuan ini sekarang sama untuk seluruh departemen dan seluruh periode.

### 2. Ditambahkan Dataset `activeRows`

Perubahan:
- Summary sekarang membedakan antara seluruh row hasil gabungan (`rows`) dan billing event valid (`activeRows`).
- `activeRows` didefinisikan sebagai row yang benar-benar ada di `monthly_status`, yaitu `row.id !== null`.

Tujuan:
- Menghindari placeholder project kosong ikut masuk denominator KPI.
- Menyamakan dasar hitung Summary dengan billing event yang memang eksis di database.

### 3. KPI `Konversi Piutang Usaha` Dihitung Ulang dari `activeRows`

Formula final:

```text
Jumlah billing event valid dengan piutang_usaha = Done
/
Total billing event valid pada filter aktif
x 100
```

Implementasi dampak:
- Kasus `4 Done` dan `1 Not Done` sekarang menghasilkan `80%`.
- Formula yang sama berlaku konsisten untuk seluruh kombinasi periode dan departemen.

### 4. KPI Summary Lain Diselaraskan ke `activeRows`

Perubahan yang ikut diterapkan:
- `Billing Events`
- `monthly`
- `termin`
- `Total Nilai Progress`
- `Overdue`

Tujuan:
- Seluruh card Summary memakai basis hitung billing event valid yang sama.

### 5. Chart dan Watchlist Summary Diselaraskan ke `activeRows`

Perubahan yang ikut diterapkan:
- `Pipeline - Jumlah Event`
- `Pipeline - Nilai Progress`
- `Status per Departemen`
- `Watchlist Overdue`

Tujuan:
- Menghindari mismatch antara KPI card dan visualisasi Summary.

## Dampak Perubahan

Setelah perbaikan ini:
- Card `Konversi Piutang Usaha` menampilkan hasil yang konsisten dengan data nyata di `Input & Edit`.
- Summary tidak lagi memasukkan row placeholder ke denominator KPI.
- Filter departemen kini benar-benar mempengaruhi Summary, termasuk untuk akun yang memiliki akses lintas departemen.
- Perilaku tersebut berlaku seragam untuk semua departemen dan periode lain.

## Verifikasi yang Perlu Dilakukan

Verifikasi manual utama:
1. Pilih periode `2026-03`.
2. Pilih departemen `E&I`.
3. Klik `Muat Data`.
4. Pastikan card `Konversi Piutang Usaha` tampil `80%`.

## Catatan Tambahan

Perubahan ini tidak mengubah:
- Struktur tabel Supabase.
- Data existing di database.
- Logic update status workflow.
- Approval flow nilai progress.

Perubahan murni dilakukan pada rumus dan sumber data agregasi frontend Summary.

---

# EXECUTION UPDATE 3

Tanggal eksekusi: 2026-07-19

## Latar Belakang

Setelah perbaikan Summary KPI, ada kebutuhan lanjutan agar field:
- `ket_konversi_pu`
- `ket_cash_in`

dapat diedit ulang oleh user yang berwenang.

Behavior sebelumnya:
- Setelah keterangan berhasil disimpan dan sudah memiliki isi di database, field menjadi terkunci.
- Tombol `Simpan Keterangan` hilang.
- Akibatnya user tidak bisa merevisi catatan walaupun kondisi operasional berubah.

## Perubahan yang Diterapkan

Lokasi perubahan:
- `src/components/InvoiceProgressMonitor_v2.jsx`

### 1. Aturan Lock Keterangan Disederhanakan

Perubahan:
- Logic `isKeteranganLocked(...)` diubah agar hanya mengunci row dengan `month_group === "previous"`.

Behavior baru:
- Row periode aktif tetap bisa edit ulang `ket_konversi_pu`.
- Row periode aktif tetap bisa edit ulang `ket_cash_in`.
- User bisa memperbarui isi catatan berkali-kali sesuai kebutuhan.
- User juga bisa mengosongkan keterangan lalu menyimpannya kembali.

### 2. Hak Akses Tetap Sama

Behavior yang dipertahankan:
- `admin` dan `editor` tetap bisa menyimpan perubahan.
- `viewer` tetap read-only.
- Row `previous month` tetap read-only.

## Dampak Perubahan

Setelah perubahan ini:
- Catatan konversi PU dan cash in menjadi lebih fleksibel untuk kebutuhan monitoring.
- Tidak perlu workaround seperti membuat catatan baru di field lain saat hanya ingin merevisi keterangan lama.
- Perubahan tidak menyentuh struktur database maupun logic save yang sudah ada.

## Catatan Teknis

Perubahan ini bersifat minimal:
- Tidak mengubah shape data.
- Tidak mengubah function `saveKeterangan(...)`.
- Tidak mengubah trigger, policy, atau backend Supabase.

Perbaikan hanya mengubah aturan penguncian input pada frontend.

---

# EXECUTION UPDATE 4

Tanggal eksekusi: 2026-07-19

## Latar Belakang

Ada kebutuhan agar proyek yang benar-benar sudah realisasi cash in dapat dikeluarkan dari `Watchlist Overdue` tanpa:
- menghapus `target_cash_in`,
- menghapus histori `ket_cash_in`,
- mengubah struktur database.

Keputusan implementasi yang dipilih:
- Tidak menambah kolom baru di database.
- Tidak menambah stage baru di schema.
- Menambahkan action status cash in di frontend menggunakan dua tombol: `✓` dan `X`.

## Implementasi yang Diterapkan

Lokasi perubahan:
- `src/components/InvoiceProgressMonitor_v2.jsx`

### 1. Marker Internal untuk Status Cash In

Status cash in disimpan menggunakan marker internal pada kolom existing `ket_cash_in`:

```text
[CASH_IN_DONE]
```

Contoh penyimpanan:

```text
[CASH_IN_DONE] Pembayaran diterima 15 Maret 2026
```

Marker ini tidak ditampilkan ke user di field input.

### 2. Dua Tombol Status di Sebelah Kanan Target Cash In

Perubahan UI:
- Ditambahkan tombol `✓` untuk `Cash In Done`.
- Ditambahkan tombol `X` untuk `Cash In Not Done`.
- Letaknya di sebelah kanan field `Target Cash In`.

Behavior:
- Klik `✓` menandai row sebagai `Cash In Done`.
- Klik `X` mengembalikan row ke `Cash In Not Done`.
- `target_cash_in` tetap dipertahankan.
- `ket_cash_in` tetap dipertahankan.

### 3. Scope Akses Mengikuti Opsi A

Behavior yang diterapkan:
- Hanya `admin` dan `editor` yang dapat klik `✓` dan `X`.
- `viewer` tetap read-only.
- Row `previous month` tetap read-only.

### 4. Watchlist Overdue Tidak Lagi Menampilkan Cash In yang Sudah Done

Perubahan logic overdue cash in:
- Row dengan `target_cash_in` yang sudah lewat **tidak lagi masuk overdue** jika sudah ditandai `Cash In Done`.

Efeknya:
- Histori target cash in tetap ada.
- Histori keterangan tetap ada.
- Watchlist benar-benar bersih dari row yang sudah realisasi cash in.

### 5. Input Keterangan Cash In Tetap Bersih

Perubahan tambahan:
- Marker internal `[CASH_IN_DONE]` tidak muncul di input `Keterangan cash in`.
- Saat user menyimpan ulang keterangan cash in, marker status tetap dipertahankan bila status cash in sedang `Done`.

## Dampak

Setelah perubahan ini:
- User dapat menandai cash in selesai tanpa kehilangan data histori.
- `Watchlist Overdue` akan lebih akurat terhadap kondisi realisasi lapangan.
- Tidak ada kebutuhan migrasi atau perubahan schema Supabase.

## Catatan Teknis

Tradeoff implementasi ini:
- Status cash in dan catatan cash in berbagi kolom `ket_cash_in`.
- Jika melihat raw data langsung di database, marker `[CASH_IN_DONE]` akan terlihat.
- Namun di UI aplikasi marker tetap disembunyikan.

## Penyesuaian Layout Lanjutan

Setelah implementasi awal tombol `✓` dan `X`, layout tabel disempurnakan lagi:
- Tombol status cash in dipisahkan dari kolom `Target Cash In`.
- Ditambahkan kolom baru khusus bernama `Status Cash In`.

Hasil akhir:
- Kolom `Target Cash In` hanya memuat tanggal target dan keterangan cash in.
- Kolom `Status Cash In` hanya memuat action `✓` dan `X`.

Tujuan penyesuaian ini:
- Membuat makna action cash in lebih jelas.
- Menghindari kepadatan elemen di dalam satu kolom.
- Menjaga tabel lebih mudah dipindai user saat input dan review data.

## Penegasan Behavior Final

Behavior cash in kemudian ditegaskan lagi sebagai berikut:
- Status realisasi cash in **hanya** ditentukan oleh tombol `✓` dan `X` pada kolom `Status Cash In`.
- `Target Cash In` tidak menjadi syarat untuk menandai cash in sebagai selesai.
- `Target Cash In` diposisikan hanya sebagai histori target / rencana.

Penyesuaian UI yang diterapkan:
- Ditambahkan helper text pada kolom `Target Cash In` bahwa field tersebut bersifat opsional dan hanya sebagai histori target.
- Ditambahkan helper text pada kolom `Status Cash In` bahwa user cukup klik `✓` saat cash in sudah diterima.

Tujuannya:
- Menghindari asumsi bahwa user wajib mengisi tanggal target sebelum bisa menandai cash in selesai.
- Menjadikan action `✓` sebagai trigger utama untuk mengeluarkan row dari `Watchlist Overdue`.

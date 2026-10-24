# Rencana MVP dan 1.0

Dokumen ini menggantikan daftar "what remains" di README sebagai rencana kerja.
README tetap memuat ringkasan cerita; angka, urutan, dan status yang mengikat ada di
sini dan di gate CI.

Aturan yang dipakai menyusun semua urutan di bawah: satu klaim hanya naik status
kalau ada perintah yang gagal ketika klaim itu tidak benar. Karena itu setiap task
punya bukti lulus berupa gate, bukan deskripsi pekerjaan. Task yang belum bisa
dibuatkan gate-nya belum selesai, baru dikerjakan.

---

## 1. Dua definisi yang mengikat

**MVP: 0.2.0.** Kodenya sudah ada di `main` dan belum terbit. Selesainya MVP berarti
satu host nyata bisa memasang paket dari registry, mengirim observasi dari request
sungguhan, menerima treatment beserta alasannya, melihat apa yang diputuskan lewat
event terstruktur, dan tetap mendapat jawaban ketika store-nya mati. MVP tidak
mengklaim kalibrasi. Ukuran lulusnya bukan daftar fitur, tapi: orang lain
menyelesaikannya dalam satu sesi kerja dengan mengikuti dokumen, tanpa membaca
source.

**1.0.0.** Klaim production boleh dibuat karena tiga hal terbukti, bukan dijanjikan:

1. Threshold dipilih dari populasi nyata, dengan angka false positive dan false
   negative yang bisa diperiksa ulang oleh orang lain.
2. Protokol berjalan end-to-end: ada server referensi, fixture interop, dan
   penolakan yang teruji untuk envelope yang dimanipulasi.
3. Permukaan API dan perilaku advisory dibekukan, dengan review keamanan terarah
   yang temuannya ditutup atau dinyatakan terbuka.

Selama salah satu belum ada, versi tetap 0.x. MVP sengaja tidak menuntut populasi
nyata. 1.0 tidak bisa dilewati tanpa itu, dan itu satu-satunya pembatas yang tidak
bisa dipercepat dengan kerja lebih banyak.

---

## 2. Kondisi hari ini

| Kapabilitas | Bukti di repo |
|---|---|
| Model trust, lima tingkat keputusan, trace wajib | `src/core/trust.ts`, `src/core/assess.ts`, `src/core/policy.ts`, D2a, D5, D23 |
| Konjungsi ambang, velocity, diskon intake | `src/core/behavior.ts`, D37, D50, D55 |
| Constraint: lima kelas, invariant dideklarasikan host | `src/core/constraints.ts`, D13, D41 |
| Store: memory, sqlite, KV HTTP, conformance kit | `src/store/`, `src/core/conformance.ts`, D8, D44, D60 |
| Collector browser | `src/collect/` |
| Situs 10 halaman, dibangkitkan dari repo | `site/`, `npm run site:check` |
| Instrumen trafik nyata: proxy, browser, report | `examples/ixfe/live/`, D56, D57 |

Angka yang dipakai gate: 233 test, 63 keputusan, 10 halaman, 0 dependensi runtime,
versi terbit 0.1.0, versi di `main` 0.2.0.

Belum ada sama sekali: server protokol, hook event keputusan, bench, publish gate,
alat kalibrasi, review keamanan.

---

## 3. Semua hole

| ID | Hole | Blokir | Ditutup | Bukti lulus |
|---|---|---|---|---|
| H1 | Tidak ada contoh integrasi yang bisa disalin. Semua contoh adalah proxy pengamat, bukan handler host | MVP | M1.1 | contoh jalan di CI: request masuk, treatment keluar |
| H2 | Tidak ada event keputusan terstruktur. `trace` hanya array string bebas, host harus merangkai sendiri | MVP | M1.2 | schema berversi, satu event per evaluate, tanpa identitas mentah |
| H3 | `kvStore` default `failOpen: true`. Kegagalan transport bisa mereset trust tanpa jejak (T2) | MVP | M1.3 | test error transport: guard tetap menjawab dan event error wajib keluar |
| H4 | Topologi deployment tidak didokumentasikan. `sqlite` mudah disalahpahami sebagai durable multi-instance (T3) | MVP | M1.4 | matriks empat topologi, tiap baris punya contoh konfigurasi |
| H5 | Tidak ada anggaran performa dan tidak ada bench, jadi "murah" masih klaim | MVP | M1.5 | bench di CI, gagal kalau melewati budget hasil pengukuran |
| H6 | 0.2.0 belum terbit. Tidak ada CHANGELOG, publish gate, atau aturan semver untuk perilaku advisory | MVP | M1.6 | install dari registry di CI, isi tarball diperiksa |
| H7 | Drift dokumen tidak dicegah mesin. Bukti: `packageManager` kembali masuk lewat commit penyuntingan massal, dan audit sempat mengklaim field itu sudah dihapus | MVP | M1.0 | gate gagal kalau angka dokumen tidak cocok dengan hasil render, atau manifest tidak cocok dengan lockfile |
| H8 | Classifier anomali tidak ikut memutuskan. Belum ada jalur memilih dari pengukuran (D52) | 1.0 | M2.4 | laporan pemilihan dan D baru |
| H9 | Semua threshold adalah tebakan. Belum ada populasi nyata (T1) | 1.0 | M2.1 sampai M2.3 | kurva FP/FN dari data nyata, plus drift monitor |
| H10 | Protokol belum pernah jalan end-to-end. Tidak ada fixture interop atau server (T4) | 1.0 | M3.1 sampai M3.4 | sender dan receiver lulus fixture yang sama lewat HTTP |
| H11 | Root of trust di luar SG. Entity key yang mudah diganti mengalahkan seluruh pertahanan berbasis riwayat (D1.1) | 1.0 | M4.1 | panduan dan test yang membuktikan batasnya |
| H12 | Poisoning lambat belum terselesaikan. D55 baru menutup farming massal | 1.0 | M4.2 | eksperimen biaya penyerang dibanding waktu deteksi |
| H13 | Belum ada review keamanan terarah. Test fungsional bukan audit (T7) | 1.0 | M4.3 | laporan, temuan ditutup atau dinyatakan terbuka |
| H14 | Browser, edge, dan runtime lain belum diuji. Node floor 22.6 belum jadi positioning (T6) | 1.0 | M5.1 | matriks runtime dan smoke per target |
| H15 | Retention dan erasure belum dibuktikan end-to-end di semua store dan di event log (D1.2, D22) | 1.0 | M5.2 | test: satu entity dilupakan, tidak ada sisa di store maupun log |
| H16 | API belum dibekukan. Tidak ada kebijakan deprecation atau panduan migrasi | 1.0 | M5.3 | semver policy dan panduan migrasi |
| H17 | Klaim di `DECISIONS.md` tidak punya indeks ke test yang membuktikannya | MVP | M1.8 | indeks dibangkitkan, klaim tanpa target muncul sebagai daftar |
| H18 | Tidak ada soak atau load test untuk sweep dan store | 1.0 | M4.4 | soak 24 jam dengan batas memori dan jumlah state |

---

## 4. MVP: M0 dan M1

### M0, matikan drift

| Task | Isi | Status |
|---|---|---|
| M0.1 | Hapus `packageManager` pnpm. Repo memakai npm dan `package-lock.json` adalah sumber kebenaran | selesai |
| M0.2 | Koreksi audit A6 supaya tidak mengklaim sesuatu yang tidak ada di HEAD | selesai |
| M0.3 | Satu sumber angka untuk README, situs, dan audit | pindah ke M1.7 |

### M1, task dan bukti lulus

**M1.1 Contoh integrasi yang bisa disalin.**
`examples/integration/` memakai `node:http` saja, tanpa framework, supaya tidak ada
dependensi yang harus dirawat. Dua rute: login dengan hard constraint, dan baca data
yang advisory. Bukti lulus: `npm run example:integration` menjalankan dua skenario
(entity baru, entity dengan pelanggaran soft), mencetak treatment dan trace, dan
dijalankan di CI.

**M1.2 Event keputusan terstruktur.**
Opsi `onAssessment` di `createGuard`. Event berisi `schemaVersion`, keputusan, stage,
trust, uncertainty, trace, dan durasi. Identitas entity di-hash dengan salt dari host,
atau dimatikan lewat opsi. Bukti lulus: test snapshot schema, test bahwa tidak ada
identitas mentah, test bahwa event tidak mengubah hasil `evaluate`.

**M1.3 Fail-open wajib terlihat.**
Saat `kvStore` fail-open, event error wajib keluar, dan dokumentasi menyebut alert
sebagai syarat deployment. Bukti lulus: test transport error memastikan event terjadi
dan evaluasi tetap mengembalikan treatment.

**M1.4 Matriks deployment.**
`docs/DEPLOYMENT.md` dengan empat baris: satu proses, multi-proses satu host,
serverless, multi-region. Kolom: store, konsistensi, yang hilang saat gagal, dan
status dukungan. Bukti lulus: minimal dua baris punya contoh konfigurasi yang
dijalankan di test.

**M1.5 Bench.**
`scripts/bench.mjs` mengukur `evaluate()` untuk memory, sqlite, dan KV lokal, dengan
p50, p95, p99. Budget ditetapkan setelah pengukuran pertama, lalu CI gagal kalau
melewati dua kali budget. Bukti lulus: bench jalan di CI dan angkanya tercatat di
CHANGELOG.

**M1.6 Rilis 0.2.0.**
CHANGELOG gaya Keep a Changelog. Publish gate: `npm pack`, pasang tarball di direktori
kosong, jalankan smoke terhadap paket terpasang. Aturan semver ditulis eksplisit:
patch tidak boleh mengubah treatment untuk input yang sama, minor boleh dan wajib
dicatat dengan contoh sebelum dan sesudah. Bukti lulus: job CI `pack-and-install`
hijau dan 0.2.0 terbit. README tidak lagi menyebut `unreleased`.

**M1.7 Gate drift.**
`scripts/check-docs.mjs` memeriksa: angka di README (test, keputusan, halaman, versi)
sama dengan hasil render; `package.json` cocok dengan `package-lock.json` pada nama
dan versi; tidak ada `packageManager` selama lockfile npm. Bukti lulus: mengubah satu
angka di README tanpa mengubah kode membuat CI gagal.

**M1.8 Indeks klaim.**
`scripts/claim-index.mjs` memetakan setiap klaim perilaku di `DECISIONS.md` ke test
yang mengujinya. Klaim tanpa target dicetak sebagai daftar yang harus dijawab di
`docs/CLAIMS.md`. Bukti lulus: daftar kosong, atau setiap sisa punya alasan tertulis.

### Exit criteria MVP

Semua harus benar, dan semuanya bisa diperiksa:

1. `npm ci`, `typecheck`, `test`, `build`, `smoke`, `site:check`, `bench`, dan
   `check-docs` hijau di CI.
2. 0.2.0 terpasang dari registry di proyek kosong, README diikuti tanpa membaca
   source.
3. Contoh integrasi menghasilkan ALLOW untuk entity baru, INCREASE_FRICTION untuk
   pelanggaran soft, trace terbaca, dan satu event per evaluate.
4. Store mati: guard tetap menjawab, event error keluar, panduan alert jelas.
5. p99 sesuai budget yang diukur di mesin CI.
6. Dokumen deployment menyatakan empat topologi, termasuk yang tidak didukung.

Di luar MVP, disengaja: kalibrasi, server protokol, review keamanan eksternal,
browser dan edge, dashboard, encoding symptom.

---

## 5. Menuju 1.0: M2 sampai M5

### M2, kalibrasi. Butuh data yang tidak bisa dibuat.

| Task | Isi |
|---|---|
| M2.1 | Kumpulkan data: observer D56 pada satu properti, minimal dua minggu atau 50.000 request, dipisah per segmen: manusia, klien mesin sah, penyerang terkendali |
| M2.2 | `scripts/calibrate.mjs`: dari dataset, hitung FP dan FN untuk grid policy, tolak dataset di bawah ukuran minimum, keluarkan laporan yang bisa diperiksa, bukan satu angka |
| M2.3 | Drift: definisi metrik, ambang alert, prosedur rollback ke policy sebelumnya |
| M2.4 | Keputusan: classifier atau konjungsi ambang yang memutuskan (D52), diambil dari angka |

Exit: laporan FP/FN terbit di situs, policy terpilih punya alasan tertulis, dan segmen
yang belum terwakili disebut namanya.

### M3, protokol end-to-end

| Task | Isi |
|---|---|
| M3.1 | Fixture JSON v0.1 di repo terpisah, termasuk kasus yang harus ditolak |
| M3.2 | Server referensi minimal: terima, validasi, tolak, tanpa menyimpan identitas |
| M3.3 | Interop: sender library, server, receiver, lewat HTTP, termasuk degradasi, replay, dan batching |
| M3.4 | Operasional: cadence, retensi server, abuse control |

Exit: dua implementasi berbeda lulus fixture yang sama, dan envelope yang dimanipulasi
ditolak oleh test, bukan oleh klaim.

### M4, pengerasan

| Task | Isi |
|---|---|
| M4.1 | Root of trust: panduan entity key, plus test yang membuktikan apa yang tidak dilindungi |
| M4.2 | Poisoning: eksperimen biaya penyerang dibanding waktu deteksi, lalu mitigasi yang diuji |
| M4.3 | Review keamanan terarah: adapter failure, poisoning, entity key, DoS, integrasi host |
| M4.4 | Soak 24 jam: memori, GC, sweep, jumlah state |

Exit: laporan review ada, dan tidak ada temuan kritis yang terbuka tanpa alasan
tertulis.

### M5, pembekuan dan 1.0.0

| Task | Isi |
|---|---|
| M5.1 | Matriks runtime: Node 22.6, Node 24, browser bundler, edge. Didukung atau tidak, dengan smoke test |
| M5.2 | Retention dan erasure end-to-end di semua store dan di event log |
| M5.3 | Semver final, panduan migrasi, kebijakan deprecation |
| M5.4 | 1.0.0, dengan halaman jaminan di situs |

Exit: 1.0.0 terbit. Situs punya halaman "apa yang dijamin" dan "apa yang tidak",
berisi angka kalibrasi, bukan daftar fitur.

---

## 6. Urutan dan ketergantungan

| Wave | Isi | Bisa paralel | Prasyarat |
|---|---|---|---|
| 0 | M0, M1.7 | tidak | tidak ada |
| 1 | M1.1, M1.2, M1.3 | ya | M0 |
| 2 | M1.4, M1.5, M1.8 | ya | wave 1 |
| 3 | M1.6, rilis 0.2.0 | tidak | wave 2 |
| 4 | M2 dan M3 | ya, tidak berbagi kode | 0.2.0 terbit |
| 5 | M4 | tidak | M2 dan M3 |
| 6 | M5, lalu 1.0.0 | tidak | M4 |

M2 dan M3 bisa berjalan bersamaan karena kalibrasi menyentuh data dan model,
sementara protokol menyentuh jaringan dan repositori terpisah. M4 menunggu keduanya
karena review keamanan perlu tahu angka FP/FN dan permukaan server.

---

## 7. Gate yang harus ada

| Gate | Perintah | Gagal kalau |
|---|---|---|
| Tipe | `npm run typecheck` | tipe tidak konsisten |
| Test | `npm test` | ada test gagal |
| Build | `npm run build` | output tidak terbentuk |
| Paket | `npm run smoke` dan `pack-and-install` | exports map rusak atau paket terpasang tidak bisa dipakai |
| Situs | `npm run site:check` | halaman gagal dirender |
| Dokumen | `node scripts/check-docs.mjs` | angka dokumen tidak cocok dengan hasil render, atau manifest tidak cocok dengan lockfile |
| Bench | `node scripts/bench.mjs` | melewati dua kali budget |
| Klaim | `node scripts/claim-index.mjs` | ada klaim perilaku tanpa test |

---

## 8. Yang tidak dikerjakan

- Vonis manusia atau bot, dalam bentuk apa pun.
- SaaS, gatekeeper pusat, atau backend milik proyek ini.
- Penegakan di dalam library. Library tetap memberi saran dan tidak memblokir.
- Melatih model pada persona sintetis lalu menyebut hasilnya kalibrasi (D34, D45).
- Dashboard produk dan multi-tenant.
- Encoding skema symptom sebelum protokol berjalan (urutan README tetap dipakai).

---

## 9. Risiko dan aturan keputusannya

| Risiko | Tanda awal | Aturan keputusan |
|---|---|---|
| Populasi nyata tidak pernah cukup | satu properti, sedikit klien mesin sah, data tidak mewakili | 1.0 ditahan. Alternatif yang sah: 1.0 hanya untuk deployment yang mengkalibrasi sendiri, dengan alatnya disertakan. Diputuskan sebelum M2 dimulai, bukan di tengah |
| Beban integrasi tetap tinggi | contoh masih butuh membaca source untuk dipakai | tambah adapter dua framework sebelum 1.0 |
| Protokol tidak dibutuhkan siapa pun | tidak ada pengirim eksternal setelah tiga bulan M3 | 1.0 tetap boleh, dengan halaman yang menyatakan protokol spec-only. Jangan naikkan statusnya jadi kapabilitas |
| Threshold hasil kalibrasi tidak stabil | FP berubah lebih dari dua kali lipat antar minggu | drift jadi masalah produk, bukan catatan: monitor dan rollback harus ada sebelum 1.0 |
| Review keamanan menemukan cacat arsitektur | temuan kritis di poisoning atau entity key | 1.0 ditahan, perbaikan masuk M4, tidak ditunda ke 1.x |

---

## 10. Keputusan yang menunggu jawabanmu

1. Target contoh integrasi MVP: `node:http` murni, Express, atau Next. Rekomendasi
   saya `node:http` ditambah adapter Express, karena keduanya mudah diuji tanpa
   membawa dependensi ke dalam paket.
2. 1.0 wajib punya review keamanan oleh pihak lain, atau cukup review terarah oleh
   dua orang di luar penulis.
3. Protokol pindah ke repo terpisah sekarang, atau setelah M3.3 lulus.
4. Properti mana yang dipakai mengukur populasi, dan berapa lama data dikumpulkan.
   Ini yang menentukan jadwal M2.
5. Perilaku advisory: 0.x boleh mengubah treatment di rilis minor. Rekomendasi saya
   ya, dengan catatan CHANGELOG berisi contoh sebelum dan sesudah.

---

## 11. Tiga task pertama

1. M1.0 sudah selesai hari ini. Lanjut M1.7, karena gate drift murah dan langsung
   menutup kelas kesalahan yang sudah dua kali terjadi.
2. M1.1 contoh integrasi, karena itu satu-satunya task yang mengubah "bisa dipakai"
   dari klaim menjadi kenyataan.
3. M1.2 event keputusan, karena M2 tidak bisa mengkalibrasi apa pun tanpa data yang
   keluar dari produksi dengan bentuk yang stabil.

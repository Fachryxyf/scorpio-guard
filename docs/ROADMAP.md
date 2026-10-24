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

1. Threshold dipilih dari dataset yang bisa direproduksi, dengan komposisi populasi
   dinyatakan terbuka dan angka false positive serta false negative yang bisa
   diperiksa ulang oleh orang lain.
2. Protokol berjalan end-to-end: ada server referensi, fixture interop, dan
   penolakan yang teruji untuk envelope yang dimanipulasi.
3. Permukaan API dan perilaku advisory dibekukan, dengan review keamanan terarah
   yang temuannya ditutup atau dinyatakan terbuka.

Selama salah satu belum ada, versi tetap 0.x. Kalibrasi untuk 1.0 memakai traffic lab
yang dibangun sendiri dengan browser sungguhan, dan bagian M2 mencatat apa yang bisa
serta tidak bisa dibuktikan dengan cara itu. Kalau nanti ada data populasi nyata,
kalibrasi diulang dan halaman jaminan diperbarui.

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
| Gate manifest dan lockfile | `scripts/check-manifest.mjs`, `npm run check:manifest` |

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
| H7 | Drift dokumen tidak dicegah mesin. Bukti: `packageManager` kembali masuk lewat commit penyuntingan massal, dan audit sempat mengklaim field itu sudah dihapus | MVP | M1.7a, M1.7b | gate gagal kalau manifest tidak cocok dengan lockfile, atau angka dokumen tidak cocok dengan hasil render |
| H8 | Classifier anomali tidak ikut memutuskan. Belum ada jalur memilih dari pengukuran (D52) | 1.0 | M2.4 | laporan pemilihan dan D baru |
| H9 | Semua threshold adalah tebakan. Dataset berlabel belum ada, dan populasi nyata tidak bisa ditunggu (T1) | 1.0 | M2.1 sampai M2.5 | confusion matrix dari dataset berlabel, komposisinya tertulis |
| H10 | Protokol belum pernah jalan end-to-end. Tidak ada fixture interop atau server (T4) | 1.0 | M3.1 sampai M3.4 | sender dan receiver lulus fixture yang sama lewat HTTP |
| H11 | Root of trust di luar SG. Entity key yang mudah diganti mengalahkan seluruh pertahanan berbasis riwayat (D1.1) | 1.0 | M4.1 | panduan dan test yang membuktikan batasnya |
| H12 | Poisoning lambat belum terselesaikan. D55 baru menutup farming massal | 1.0 | M4.2 | eksperimen biaya penyerang dibanding waktu deteksi |
| H13 | Belum ada review keamanan terarah. Test fungsional bukan audit (T7) | 1.0 | M4.3 | laporan, temuan ditutup atau dinyatakan terbuka |
| H14 | Browser, edge, dan runtime lain belum diuji. Node floor 22.6 belum jadi positioning (T6) | 1.0 | M5.1 | matriks runtime dan smoke per target |
| H15 | Retention dan erasure belum dibuktikan end-to-end di semua store dan di event log (D1.2, D22) | 1.0 | M5.2 | test: satu entity dilupakan, tidak ada sisa di store maupun log |
| H16 | API belum dibekukan. Tidak ada kebijakan deprecation atau panduan migrasi | 1.0 | M5.3 | semver policy dan panduan migrasi |
| H17 | Klaim di `DECISIONS.md` tidak punya indeks ke test yang membuktikannya | MVP | M1.8 | indeks dibangkitkan, klaim tanpa target muncul sebagai daftar |
| H18 | Tidak ada soak atau load test untuk sweep dan store | 1.0 | M4.4 | soak 24 jam dengan batas memori dan jumlah state |
| H19 | 404 untuk path yang ditautkan build sendiri dibaca sebagai bukti negatif, jadi crawler sah mewarisi link mati situs. Ditemukan lab (F3 di `docs/DATASET.md`) | 1.0 | M2.6 | dua 404 identik: yang tertaut tidak menaikkan stage, yang tidak tertaut menaikkannya |

---

## 4. MVP: M0 dan M1

### M0, matikan drift

| Task | Isi | Status |
|---|---|---|
| M0.1 | Hapus `packageManager` pnpm. Repo memakai npm dan `package-lock.json` adalah sumber kebenaran | selesai |
| M0.2 | Koreksi audit A6 supaya tidak mengklaim sesuatu yang tidak ada di HEAD | selesai |
| M0.3 | Gate yang mencegah kelas kesalahan ini kembali | selesai, lihat M1.7a |

### M1, task dan bukti lulus

**M1.1 Contoh integrasi yang bisa disalin.**
Contoh inti memakai `node:http` saja, tanpa framework, supaya tidak ada dependensi
yang harus dirawat. Adapter Express ditulis di file terpisah dan diuji dengan Express
sebagai `devDependencies`; Express tidak pernah masuk dependensi paket. Dua rute:
login dengan hard constraint, dan baca data yang advisory. Bukti lulus:
`npm run example:integration` menjalankan dua skenario (entity baru, entity dengan
pelanggaran soft), mencetak treatment dan trace, dan dijalankan di CI.

Status: selesai. `examples/integration/` berisi inti tanpa framework, server
`node:http`, adapter Express, dan enam test yang memakai HTTP sungguhan. Demo
menjalankan tiga skenario, bukan dua: entity baru (ALLOW), tiga baca tanpa login
(INCREASE_FRICTION), dan token yang tidak pernah diterbitkan host (RESTRICT).

**M1.2 Event keputusan terstruktur.**
Opsi `onAssessment` di `createGuard`. Event berisi `schemaVersion`, keputusan, stage,
trust, uncertainty, trace, dan durasi. Identitas entity di-hash dengan salt dari host,
atau dimatikan lewat opsi. Bukti lulus: test snapshot schema, test bahwa tidak ada
identitas mentah, test bahwa event tidak mengubah hasil `evaluate`.

Status: selesai, D61. Identitas dimatikan secara default, bukan di-hash tanpa salt:
hash tanpa salt pada ruang id yang kecil bisa dibalik. `src/core/event.test.ts`
menutup bentuk schema, ketiadaan referensi mentah, kestabilan hash per salt, dan
kesetaraan hasil dengan dan tanpa sink.

**M1.3 Fail-open wajib terlihat.**
Saat `kvStore` fail-open, event error wajib keluar, dan dokumentasi menyebut alert
sebagai syarat deployment. Bukti lulus: test transport error memastikan event terjadi
dan evaluasi tetap mengembalikan treatment.

Status: selesai, D62. `onError` wajib di tipe dan saat konstruksi selama fail-open
masih dipakai, jadi diam bukan lagi pilihan default. Alert disebut sebagai syarat di
README dan di `docs/DEPLOYMENT.md`.

**M1.4 Matriks deployment.**
`docs/DEPLOYMENT.md` dengan empat baris: satu proses, multi-proses satu host,
serverless, multi-region. Kolom: store, konsistensi, yang hilang saat gagal, dan
status dukungan. Bukti lulus: minimal dua baris punya contoh konfigurasi yang
dijalankan di test.

Status: selesai. `src/deployment.test.ts` menjalankan dua baris yang bisa dijalankan
(SQLite lintas handle, KV lintas proses) dan satu kegagalan yang disengaja. Baris
multi-region dinyatakan tidak didukung beserta alasannya, bukan diberi adapter palsu.

**M1.5 Bench.**
`scripts/bench.mjs` mengukur `evaluate()` untuk memory, sqlite, dan KV lokal, dengan
p50, p95, p99. Budget ditetapkan setelah pengukuran pertama, lalu CI gagal kalau
melewati dua kali budget. Bukti lulus: bench jalan di CI dan angkanya tercatat di
CHANGELOG.

Status: selesai. Pengukuran pertama pada mesin pengembang, 2000 iterasi per store:
memory p50 0,0115 ms dan p95 0,0207 ms, sqlite p50 0,2241 ms dan p95 0,6043 ms, kv
p50 0,0088 ms dan p95 0,0123 ms. `bench/budget.json` menyimpan dua kali p95 itu, dan
check gagal di dua kali nilai tersebut. Baris di bawah 1 ms memakai lantai 1 ms supaya
derau timer runner CI tidak jadi build merah. Angka ini ada di CHANGELOG.

**M1.6 Rilis 0.2.0.**
CHANGELOG gaya Keep a Changelog. Publish gate: `npm pack`, pasang tarball di direktori
kosong, jalankan smoke terhadap paket terpasang. Aturan semver ditulis eksplisit:
patch tidak boleh mengubah treatment untuk input yang sama, minor boleh dan wajib
dicatat dengan contoh sebelum dan sesudah. Bukti lulus: job CI `pack-and-install`
hijau dan 0.2.0 terbit. README tidak lagi menyebut `unreleased`.

Status: sebagian. `CHANGELOG.md` ada dengan aturan semver tertulis, `npm run
pack:check` memeriksa isi tarball lalu memasang dan menjalankannya di direktori kosong,
dan job CI `pack-and-install` menjalankannya. Yang belum: 0.2.0 belum terbit ke npm,
karena publikasi butuh kredensial yang bukan milik sesi ini. Sampai itu terjadi README
memang masih menyebut 0.2.0 belum dirilis, dan itu benar. Kriteria ini belum lulus.

**M1.7 Gate drift, dua bagian.**
M1.7a, manifest: `scripts/check-manifest.mjs` memastikan `package.json` dan
`package-lock.json` sepakat pada nama dan versi, dan menolak `packageManager` yang
tidak cocok dengan lockfile yang benar-benar ada. Sudah jalan.
M1.7b, angka: `scripts/check-docs.mjs` membandingkan angka di README (test, keputusan,
halaman) dengan hasil render, dan menolak angka yang ditulis tangan. Bukti lulus
keduanya: mengubah satu angka di README tanpa mengubah kode membuat CI gagal.

Status: selesai keduanya. Gate angka diuji dengan empat mutasi: angka kata yang basi
gagal, angka digit yang salah gagal, klaim yang dihapus gagal, angka digit yang benar
lulus. Gate manifest sudah menangkap dua drift nyata dan satu drift ketiga setelah
`npm install` menulis ulang `package.json`.

**M1.8 Indeks klaim.**
`scripts/claim-index.mjs` memetakan setiap klaim perilaku di `DECISIONS.md` ke test
yang mengujinya. Klaim tanpa target dicetak sebagai daftar yang harus dijawab di
`docs/CLAIMS.md`. Bukti lulus: daftar kosong, atau setiap sisa punya alasan tertulis.

Status: selesai. `docs/CLAIMS.md` dibangkitkan, `docs/CLAIMS-NOTES.md` memuat alasan
tertulis, dan gate gagal kalau ada keputusan tanpa test dan tanpa alasan, atau kalau
alasan masih tersisa untuk keputusan yang sudah punya test. Keadaan sekarang: 65
keputusan, 50 dinamai test, 15 beralasan, 0 tanpa alasan.

### Exit criteria MVP

Semua harus benar, dan semuanya bisa diperiksa:

1. `npm ci`, `typecheck`, `test`, `build`, `smoke`, `site:check`, `check:manifest`,
   `check:docs`, `check:claims`, `bench`, `pack:check`, dan `example:integration`
   hijau di CI.
2. 0.2.0 terpasang dari registry di proyek kosong, README diikuti tanpa membaca
   source.
3. Contoh integrasi menghasilkan ALLOW untuk entity baru, INCREASE_FRICTION untuk
   pelanggaran soft, trace terbaca, dan satu event per evaluate.
4. Store mati: guard tetap menjawab, event error keluar, panduan alert jelas.
5. p99 sesuai budget yang diukur di mesin CI.
6. Dokumen deployment menyatakan empat topologi, termasuk yang tidak didukung.

Di luar MVP, disengaja: kalibrasi, server protokol, review keamanan eksternal,
browser dan edge, dashboard, encoding symptom.

Status per 2026-10-24: kriteria 1, 3, 4, 5, dan 6 lulus. Kriteria 2 belum, dan
satu-satunya yang menahannya adalah publikasi ke npm. Empat dari lima hal yang bisa
dikerjakan tanpa kredensial sudah dikerjakan dan punya gate sendiri.

---

## 5. Menuju 1.0: M2 sampai M5

### M2, kalibrasi dari traffic lab. Datanya dibuat sendiri.

Batas yang harus dinyatakan sebelum mulai: traffic yang kita bangkitkan tidak bisa
memberi tahu berapa banyak klien nyata yang menyerupai tiap persona. Itu tetap
tebakan, dan halaman jaminan harus mengatakannya. Yang bisa diberikan justru tiga hal
yang cukup untuk memilih threshold:

1. Label kebenaran yang pasti, karena kita yang menjalankan tiap persona.
2. Lingkungan yang bisa diulang, dengan seed dan versi browser dicatat.
3. Titik operasi yang terukur: false positive pada otomasi sah, false negative pada
   otomasi adversarial.

| Task | Isi |
|---|---|
| M2.1 | Traffic lab: runner yang menggerakkan beberapa instans Chrome sungguhan lewat REA, satu persona per instans dengan `--user-data-dir` sendiri, seed dan versi browser tercatat, label dicap di sink observer. Tujuh persona: manusia lambat, manusia cepat (mobile), monitor uptime, klien mesin sah, penyerang sabar, penyerang burst, dan crawler. Target: dua build statis yang sudah terkirim, plus `--target=ixfe` yang memutar sesi D56/D57. Keluaran: dataset berlabel di `var/` dengan manifest komposisi, dan `docs/DATASET.md` |
| M2.2 | `scripts/calibrate.mjs`: confusion matrix untuk grid policy (half-life, band, uncertainty, velocity, diskon intake). Menolak dataset di bawah ukuran minimum atau dengan segmen kosong. Keluaran: laporan yang bisa diperiksa, bukan satu angka |
| M2.3 | Fixture beku: rekaman sesi lab disimpan sebagai fixture yang diputar di CI, sehingga perubahan model yang mengubah treatment muncul sebagai diff, bukan ditemukan di produksi |
| M2.4 | Keputusan D baru: classifier atau konjungsi ambang yang memutuskan (D52), plus threshold terpilih, dengan komposisi dataset ditulis di samping angkanya |
| M2.5 | Re-kalibrasi dengan campuran nyata begitu ada data produksi. Sampai itu ada, halaman jaminan menyebut batas ini secara eksplisit |
| M2.6 | 404 yang tertaut bukan bukti (H19). Observer mencatat path yang pernah ia sajikan dari `<a href>` di HTML yang lewat, dan 404 untuk path itu tidak menambah bukti negatif |

Status: M2.1 selesai sebagai harness, bukan sebagai kalibrasi (D63). Satu run
terekam: 129 request, 14 persona-run, dua target, 0 false positive, 6 false
negative. Keenam false negative punya satu sebab yang sama dan bukan soal
penempatan threshold: di target yang tidak mendeklarasikan apa pun, satu page view
tidak membawa bukti, jadi mass tetap 2.00, stage tetap `unknown`, dan plafonnya
`ALLOW` berapa pun skor anomalinya (F1 di `docs/DATASET.md`). Karena itu M2.2 belum
bisa menghasilkan threshold: yang bisa dikalibrasi belum ada di dataset ini. Yang
dibutuhkan lebih dulu adalah target yang punya aksi untuk berhasil, yaitu
`npm run lab -- --target=ixfe`, tempat endpoint waitlist dan order membawa bukti.

Status: M2.2 selesai sebagai alat, belum sebagai hasil (D64). `npm run calibrate`
memutar ulang satu run di bawah sembilan sel (half-life 24, 72, 168 jam kali
developingAt 3, 4, 5) dan menghitung dua kesalahan per sel, per persona. Untuk run
yang ada sekarang ia menolak, dan penolakan itu keluarannya: 129 request di bawah
lantai 240, dan dua persona yang hanya membuat satu sampai empat request sebelum
pergi. Menurunkan lantai bukan jawaban; menambah persona dan memakai target yang
punya aksi adalah jawabannya. Gate: `examples/lab/calibration.test.ts`, diverifikasi
dengan tiga mutasi.

Status: M2.3 selesai. `scripts/freeze-lab.mjs` menyimpan satu run ke
`examples/lab/fixtures/`, hanya dengan field yang dibutuhkan replay: waktu relatif,
id entity pendek yang stabil, persona, label, dan observation yang dievaluasi, plus
keputusan model untuk tiap baris. `examples/lab/fixture.test.ts` memutar ulang fixture
itu dengan policy yang dikirim setiap push, jadi perubahan model yang menggeser
treatment gagal di CI dan harus diterima dengan sengaja lewat `npm run freeze:lab`.
Saat dibekukan, replay juga dibandingkan dengan advice yang dicatat observer dan cocok
di keempat belas persona. Batasnya dicatat di D65: ini gate perilaku, bukan gate
parameter, karena menaikkan developingAt dari 3 ke 5 tidak menggeser satu pun keputusan
beku.
Exit: laporan FP/FN terbit di situs, komposisi dataset tertulis, fixture beku diputar
di CI, dan keputusan baru tercatat di `DECISIONS.md`.

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
berisi angka kalibrasi beserta komposisi dataset, bukan daftar fitur.

---

## 6. Urutan dan ketergantungan

| Wave | Isi | Bisa paralel | Prasyarat |
|---|---|---|---|
| 0 | M0, M1.7a | tidak | tidak ada |
| 1 | M1.1, M1.2, M1.3 | ya | M0 |
| 2 | M1.4, M1.5, M1.7b, M1.8 | ya | wave 1 |
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
| Manifest | `npm run check:manifest` | nama atau versi manifest beda dengan lockfile, atau `packageManager` tidak cocok dengan lockfile |
| Dokumen | `node scripts/check-docs.mjs` | angka dokumen tidak cocok dengan hasil render |
| Bench | `node scripts/bench.mjs` | melewati dua kali budget |
| Klaim | `node scripts/claim-index.mjs` | ada klaim perilaku tanpa test |

---

## 8. Yang tidak dikerjakan

- Vonis manusia atau bot, dalam bentuk apa pun.
- SaaS, gatekeeper pusat, atau backend milik proyek ini.
- Penegakan di dalam library. Library tetap memberi saran dan tidak memblokir.
- Melatih model pada persona sintetis lalu menyebut hasilnya kalibrasi populasi.
  Traffic lab dipakai untuk memilih threshold dan mengukur titik operasi, dengan
  komposisinya dinyatakan (D34, D45).
- Dashboard produk dan multi-tenant.
- Encoding skema symptom sebelum protokol berjalan (urutan README tetap dipakai).

---

## 9. Risiko dan aturan keputusannya

| Risiko | Tanda awal | Aturan keputusan |
|---|---|---|
| Komposisi lab tidak mewakili populasi nyata | segmen di lab jauh lebih rapi daripada trafik asli, atau tidak ada data produksi setelah 1.0 | klaim 1.0 dibatasi pada komposisi yang diuji dan ditulis di halaman jaminan. Re-kalibrasi dengan data nyata menjadi syarat 1.x, bukan pekerjaan opsional |
| Beban integrasi tetap tinggi | contoh masih butuh membaca source untuk dipakai | tambah adapter dua framework sebelum 1.0 |
| Protokol tidak dibutuhkan siapa pun | tidak ada pengirim eksternal setelah tiga bulan M3 | 1.0 tetap boleh, dengan halaman yang menyatakan protokol spec-only. Jangan naikkan statusnya jadi kapabilitas |
| Threshold hasil kalibrasi tidak stabil | FP berubah lebih dari dua kali lipat antar putaran lab | fixture beku jadi wajib, dan perubahan model yang menggeser treatment harus disertai alasan tertulis |
| Review keamanan menemukan cacat arsitektur | temuan kritis di poisoning atau entity key | 1.0 ditahan, perbaikan masuk M4, tidak ditunda ke 1.x |

---

## 10. Keputusan yang menunggu jawabanmu

1. Review keamanan 1.0: oleh pihak lain, atau cukup dua orang di luar penulis.
2. Protokol pindah ke repo terpisah sekarang, atau setelah M3.3 lulus.
3. Express sebagai `devDependencies` untuk adapter M1.1. Rekomendasi saya ya, selama
   ia tidak pernah masuk dependensi paket.

---

## 11. Tiga task pertama

1. M1.7a sudah selesai. Lanjut M1.1 dan M1.2, karena keduanya yang mengubah "bisa
   dipakai" dari klaim menjadi kenyataan.
2. M1.7b menyusul setelah M1.1, supaya angka di dokumen ikut dijaga mesin.
3. M2.1 dirancang bersamaan dengan M1.6, karena lab butuh paket yang sudah terbit
   untuk diukur terhadapnya.

# Scorpio Guard, Audit Produk, Teknis, dan Kesiapan

**Tanggal audit:** 2026-10-18  
**Repositori:** `Fachryxyf/scorpio-guard`  
**Versi paket yang diamati:** `0.2.0` pada `main`  
**Jenis penilaian:** audit produk dan rekayasa tingkat repositori, berdasarkan source, pengujian, dokumentasi, contoh, output build, dan konfigurasi CI.

> **Kesimpulan eksekutif:** Scorpio Guard adalah library pra-alfa yang koheren dan terdokumentasi secara tidak biasa dengan baik untuk evaluasi kepercayaan adaptif yang bersifat advisori. Model intinya telah diimplementasikan, diuji, dapat diperluas, dan secara eksplisit menjelaskan batas-batasnya. Produk ini **tepat sebagai komponen pendukung keputusan lokal dan proof of concept berstandar riset**. Produk ini **belum tepat sebagai produk anti-penyalahgunaan production**, karena threshold belum dikalibrasi, protokol jaringan belum memiliki server yang berjalan, loop pembelajaran utama belum operasional, dan masalah root-of-trust/pergantian identitas masih berada di luar library.

## 1. Ikhtisar produk

### 1.1 Apa itu produk ini

Scorpio Guard memperkirakan seberapa besar kepercayaan yang layak diberikan kepada suatu interaksi saat ini. Produk ini tidak mengklasifikasikan permintaan secara sederhana sebagai berasal dari manusia atau bot, dan tidak beroperasi sebagai layanan challenge terpusat. Library ini:

1. menerima referensi entitas opak yang disediakan host;
2. mengakumulasi bukti positif dan negatif seiring waktu;
3. menerapkan peluruhan waktu dan retensi;
4. menggabungkan kepercayaan probabilistik dengan fitur perilaku;
5. mengevaluasi invariant yang dideklarasikan host;
6. mengembalikan keputusan advisori beserta trace yang menjelaskan hasilnya.

Spektrum keputusan publiknya adalah:

`ALLOW → OBSERVE → INCREASE_FRICTION → RESTRICT → BLOCK`

Aplikasi host tetap bertanggung jawab atas tindakan yang diambil. Inilah batasan utama produk: Scorpio Guard adalah lapisan pendukung keputusan, bukan gateway penegakan.

### 1.2 Tesis produk

Tesis produk ini paling kuat ketika memisahkan bukti berdasarkan kualitas epistemiknya:

| Lapisan | Makna | Peran produk |
|---|---|---|
| Hard constraints | Suatu tindakan dinyatakan mustahil berdasarkan invariant yang dimiliki host | Bukti deterministik yang dapat melewati ketidakpastian probabilistik |
| Weak signals | Perilaku tidak lazim atau menyerupai mesin, tetapi tidak mustahil | Hanya bukti negatif; tidak dapat melakukan eskalasi sendirian |
| Trust state | Distribusi bergaya Beta yang diakumulasikan seiring waktu | Memberikan riwayat dan ketidakpastian pada keputusan |
| Behavior/anomaly features | Keragaman cakupan dan bentuk interval kedatangan dalam jendela berbatas | Mencegah volume monoton ditafsirkan sebagai keyakinan yang andal |

Ini adalah posisi produk yang masuk akal untuk sistem yang biaya false positive-nya tinggi dan operatornya menginginkan respons bertahap, bukan pemblokiran biner.

### 1.3 Pengguna dan use case yang dituju

Repositori ini mendukung:

- aplikasi web dengan session, account, device, atau referensi entitas lain yang stabil dan ditentukan host;
- alur yang rentan terhadap penyalahgunaan seperti unlock, checkout, OTP, activation, webhook, scraping, dan endpoint yang mengonsumsi kredit;
- operator yang ingin mengamati keputusan sebelum menghubungkannya ke penegakan;
- deployment yang memerlukan operasi lokal saja, durabilitas SQLite pada satu host, atau network KV yang diinjeksi;
- tim yang bersedia mendeklarasikan invariant aplikasi secara eksplisit.

Produk saat ini kurang sesuai untuk:

- traffic anonim ketika identitas yang diberikan dapat dibuang tanpa biaya;
- sistem yang memerlukan layanan verdict terpusat yang langsung dapat dioperasikan;
- client yang membutuhkan store durable yang kompatibel dengan browser;
- penegakan berisiko tinggi tanpa strategi kalibrasi dan banding lokal;
- lingkungan yang tidak dapat menyediakan observasi dan invariant dari host secara tepercaya.

## 2. Deskripsi produk teknis

### 2.1 Arsitektur

Repositori ini disusun di sekitar core yang agnostik terhadap platform:

```text
Host application
    │
    ├─ entity reference, observation, context
    ├─ declared invariants
    └─ optional collected signals
    │
    ▼
createGuard().evaluate()
    │
    ├─ StateStore: memory | SQLite | injected KV
    ├─ hard/soft invariant evaluation
    ├─ trust update with half-life decay
    ├─ bounded behavior window
    ├─ anomaly/diversity concurrence
    └─ advisory decision + trace
    │
    ▼
Assessment returned to the host
    ├─ decision
    ├─ trust mean/variance/mass/stage
    ├─ violations
    ├─ behavior and anomaly measurements
    ├─ cold-start/farming indicators
    └─ ordered reasoning trace
```

Surface paket publik dibagi menjadi:

- `@fachryxyf/scorpio-guard`: model dan guard inti;
- `@fachryxyf/scorpio-guard/collect`: observasi interaksi sisi browser;
- `@fachryxyf/scorpio-guard/sqlite`: persistence Node `node:sqlite`;
- `@fachryxyf/scorpio-guard/kv`: persistence HTTP/KV yang diinjeksi.

`src/core/` tetap bebas dari API browser dan platform storage. Ini merupakan keputusan arsitektur yang baik: model dapat berjalan di berbagai lingkungan, sementara adapter khusus platform tetap berada di edge.

### 2.2 Model kepercayaan dan keputusan

Implementasi menyimpan massa bukti positif (`a`) dan negatif (`b`) di sekitar prior struktural Beta(1,1). Bukti mengalami decay menggunakan half-life waktu nyata yang dapat dikonfigurasi, dengan default saat ini 24 jam. Retensi terpisah dari decay dan saat ini default-nya tujuh hari tanpa update yang bermakna.

Alur keputusan menggunakan tiga batas:

1. tahap epistemik berdasarkan massa bukti;
2. ketidakpastian berdasarkan varians Beta;
3. konkordansi anomali/keragaman sebelum eskalasi dengan ketidakpastian rendah.

Ini menghasilkan perilaku cold-start yang konservatif: entitas yang tidak dikenal tidak dianggap tidak tepercaya hanya karena tidak memiliki riwayat. Pelanggaran invariant yang keras ditangani secara terpisah dan dapat menyarankan perlakuan yang lebih kuat tanpa berpura-pura bahwa pelanggaran itu merupakan bukti probabilistik.

Model ini juga mendiskon bukti positif untuk timing yang teratur seperti mesin, tetapi tidak pernah mendiskon bukti negatif. Ini merupakan upaya eksplisit untuk menangani trust farming pada saat bukti diterima, bukan melalui pembatasan yang terlambat di lapisan keputusan.

### 2.3 State dan persistence

Kontrak `StateStore` sengaja dibuat kecil:

```ts
get(entity): Promise<EntityState | undefined>
set(entity, state): Promise<void>
delete(entity): Promise<void>
```

Implementasi yang tersedia:

| Store | Kekuatan | Keterbatasan |
|---|---|---|
| In-memory | Tanpa infrastruktur; sesuai untuk satu proses | Reset saat restart; tidak dibagi antar-instance |
| SQLite | Durable pada satu host; tanpa runtime dependency tambahan | Satu filesystem/host; bukan distributed store |
| KV transport | Berfungsi dengan external storage bergaya serverless; transport dapat diinjeksi | Kebijakan kegagalan jaringan merupakan keputusan deployment; default-nya fail-open |

Conformance kit merupakan pilihan rekayasa yang kuat. Kit ini menguji perilaku store, bukan sekadar mempercayai implementasi masing-masing adapter.

### 2.4 Batas collection dan privasi

Collector menghitung kategori interaksi dan tidak merekam nilai key, isi field, koordinat pointer, atau raw payload. Collector mengubah observasi browser menjadi bentuk observasi kecil yang dapat dibaca host. Hal ini selaras dengan batas privasi yang dinyatakan.

Store durable tetap menyimpan riwayat perilaku yang dikunci berdasarkan referensi yang disediakan host. Repositori dengan tepat mengakui bahwa data ini merupakan data pribadi dan menempatkan persetujuan/dasar hukum pada host. `forget(entity)` menyediakan jalur penghapusan eksplisit.

### 2.5 Protokol dan loop pembelajaran

`PROTOCOL.md` dan `src/core/protocol.ts` mendefinisikan draft symptom envelope `sg/0.1` dengan:

- kategori stabil dan detail token yang dapat berkembang;
- jumlah entitas dalam bucket;
- tanpa identity, raw observations, timestamps, trust state, atau free text;
- degradasi unknown-detail yang kompatibel ke depan;
- penolakan terhadap unknown protocol major;
- field yang tidak dikenal diabaikan.

Namun, protokol ini belum diekspor sebagai surface paket, tidak ada transmisi, dan belum ada implementasi server. Karena itu, loop pembelajaran lintas instance masih merupakan komitmen desain yang terdokumentasi, bukan kapabilitas produk yang berfungsi.

## 3. Bukti kualitas implementasi

### 3.1 Yang telah diverifikasi

Validasi berikut berhasil selama audit ini:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run smoke`
- `npm run site:check`

Hasil yang diamati:

- **233 pengujian berhasil**
- **0 gagal, 0 dilewati**
- Build TypeScript selesai
- Import/eksekusi package smoke selesai
- Site check menghasilkan/memvalidasi **9 halaman**, **62 keputusan**, dan **233 pengujian**

CI juga menjalankan typecheck, tests, build, dan smoke test pada Node 22.x.

### 3.2 Pilihan rekayasa yang kuat

Area-area berikut sudah tepat:

| Area | Penilaian | Mengapa sudah tepat |
|---|---|---|
| Batasan model | Kuat | Bukti keras, bukti lunak, dan pengukuran anomali tidak dilebur menjadi satu skor opaque |
| Explainability | Kuat | Setiap assessment berisi field terstruktur dan trace berurutan |
| Extensibility | Kuat | `StateStore`, `Clock` yang diinjeksi, policy override, deklarasi invariant, dan transport injection merupakan seam yang eksplisit |
| Keamanan memori | Baik | Jendela perilaku per entitas berbatas; memory store mendukung sweeping dan batas entitas opsional |
| Correctness persistence | Baik | Adapter SQLite dan KV berbagi kontrak conformance; state dibekukan pada jalur baca/tulis |
| Privacy by construction | Baik | Bentuk collector dan protokol secara struktural mengecualikan raw content dan identity field |
| Kejujuran adversarial | Sangat baik | Kegagalan yang diketahui, saturation, identity churn, celah kalibrasi, dan ketiadaan server didokumentasikan, bukan disembunyikan |
| Disiplin integrasi | Baik | Contoh HealthMe dan IXFE menjalankan alur aplikasi nyata dan persona adversarial yang dibuat |
| Baseline CI | Baik | Typecheck, tests, build, dan package smoke import semuanya terotomatisasi |

## 4. Yang belum tepat

### 4.1 Celah kesiapan produk

| Celah | Dampak | Status |
|---|---|---|
| Tidak ada kalibrasi traffic nyata | Default threshold dapat terlalu permisif atau terlalu ketat untuk populasi nyata | Diakui secara eksplisit; risiko produk tertinggi |
| Tidak ada protocol server yang berjalan | Pembelajaran lintas proyek dan pertukaran prescription belum ada secara operasional | Baru berupa desain |
| Root of trust bersifat eksternal | Referensi entitas yang mudah diganti mengalahkan pertahanan berbasis riwayat | Secara eksplisit masih terbuka; tanggung jawab host |
| Resistansi poisoning terbatas, belum terselesaikan | Adversary yang lambat dapat menggeser trust atau mengeksploitasi riwayat positif yang terakumulasi | Masalah terbuka |
| Tidak ada integrasi penegakan oleh operator | Library mengembalikan saran, tetapi adopsi tetap mengharuskan setiap host memetakan keputusan ke friction/restriction | Disengaja, tetapi meningkatkan pekerjaan integrasi |
| Tidak ada kontrak observability production | Trace tersedia, tetapi metrics, decision logging, alerting, dan alur kalibrasi belum distandardisasi | Memerlukan productization |
| Node floor tinggi | `node >=22.6`, ESM, dan `node:sqlite` mempersempit permukaan adopsi | Tradeoff yang disengaja, perlu ditonjolkan dalam positioning |

### 4.2 Risiko teknis dan temuan

#### Temuan T1, Threshold adalah hipotesis, bukan default production

**Severity:** Tinggi untuk kesiapan production; bukan defect kode.  
Model ini memiliki default yang bermakna untuk half-life, retention, trust bands, uncertainty, diversity, velocity, dan positive-credit discount. Bukti repositori berulang kali melabelinya sebagai tebakan, sementara traffic yang dihasilkan diposisikan sebagai falsification, bukan calibration. Ini merupakan sikap ilmiah yang tepat, tetapi berarti consumer tidak dapat memperlakukan policy default sebagai valid secara umum.

**Rekomendasi:** rilis workflow kalibrasi eksplisit sebelum merekomendasikan penegakan: capture traffic representatif, irisan false-positive/false-negative, replay, pemilihan threshold, pemantauan drift, dan rollback.

#### Temuan T2: Perilaku fail-open KV dapat menghapus perlindungan statistik

**Severity:** Tinggi tergantung threat model deployment.  
`kvStore` default-nya `failOpen: true`. Kegagalan transport ditafsirkan sebagai state yang hilang, dan write yang gagal ditelan setelah `onError` dipanggil. Hal ini mempertahankan ketersediaan host dan menjaga pemeriksaan invariant keras tetap aktif, tetapi attacker yang dapat menyebabkan atau mengeksploitasi ketidaktersediaan KV dapat berulang kali mereset trust statistik ke cold start.

**Rekomendasi:** tampilkan pilihan deployment ini secara menonjol dalam panduan production, wajibkan metric/alert error ketika fail-open digunakan, dan sediakan template policy untuk fail-closed atau friction saat degraded ketika host dapat menoleransinya.

#### Temuan T3, SQLite durable, tetapi bukan solusi deployment terdistribusi

**Severity:** Sedang.  
Adapter ini dengan tepat mendokumentasikan bahwa satu file SQLite mencakup durabilitas setelah restart dan sharing pada satu host, bukan deployment yang didistribusikan secara horizontal. Paket harus membuat keterbatasan ini mustahil terlewatkan pada jalur instalasi utama karena pengguna bisa saja menyimpulkan bahwa “durable” berarti durable multi-instance.

**Rekomendasi:** sertakan contoh topologi deployment dan readiness matrix untuk satu proses, multi-proses pada satu host, serverless, dan multi-region.

#### Temuan T4, Kompatibilitas protokol diuji secara lokal, tetapi belum dijalankan end-to-end

**Severity:** Sedang.  
Encoder/decoder envelope dan aturan degradasi telah diuji, tetapi tidak ada reference server berjaringan, interoperability fixture, implementasi autentikasi/abuse-control, replay defense, batching policy, atau cadence operasional. Jaminan privasi protokol dipikirkan dengan baik, tetapi risiko server-side poisoning masih terbuka.

**Rekomendasi:** pindahkan protokol ke repositori yang direncanakan, publikasikan JSON fixture, implementasikan reference server minimal, dan uji interoperabilitas sender/receiver melalui HTTP sebelum menampilkan pertukaran protokol sebagai kapabilitas produk.

#### Temuan T5, Dokumentasi mengalami drift yang terukur

**Severity:** Sedang untuk kepercayaan pengguna dan kualitas rilis.  
Inkonsistensi yang diamati mencakup:

- `README.md` menyatakan proyek memiliki “two hundred and twenty-two tests”, sementara validasi saat ini melaporkan **233**;
- README mendeskripsikan “Fifty-two entries”, sementara generated site melaporkan **62 decisions**;
- paket berada pada `0.2.0`, sementara README masih memuat contoh instalasi yang diterbitkan untuk `0.1.0` dan menyatakan `0.2.0` belum dirilis;
- `npm run site:check` memodifikasi `index.html` yang dilacak, menunjukkan bahwa generated output belum sepenuhnya bersih atau diperiksa secara reproducible dalam kondisi worktree saat ini.

**Rekomendasi:** buat jumlah dan status rilis dihasilkan dari satu sumber kebenaran, perbarui bagian instalasi README, dan buat `site:check` gagal jika ada generated diff, bukan diam-diam menulis ulang output.

#### Temuan T6, Public API berorientasi Node meskipun memiliki browser collector

**Severity:** Sedang.  
Collector berorientasi browser, tetapi paket memerlukan Node 22.6+ dan menggunakan export paket ESM. Core bersifat framework-agnostic, tetapi kisah distribusi untuk browser bundler, edge runtime, dan Node versi lama belum didemonstrasikan.

**Rekomendasi:** dokumentasikan runtime yang didukung per entry point dan tambahkan browser/edge packaging smoke test jika lingkungan tersebut memang menjadi target.

#### Temuan T7, Security posture transparan, tetapi bukan audit keamanan independen

**Severity:** Sedang.  
`SECURITY.md` repositori menjelaskan scope, isu yang diketahui, privasi, dan pelaporan dengan baik. Pengujian mencakup validasi SQL identifier, penanganan opaque key, isolasi store, dan batasan protokol. Ini merupakan hygiene rekayasa yang baik, tetapi tidak setara dengan security review eksternal atau penetration assessment berbasis threat model terhadap integrasi yang di-deploy.

**Rekomendasi:** sebelum membuat klaim production, lakukan security review terarah terhadap failure mode adapter, state poisoning, penyalahgunaan entity key, batas denial-of-service, dan penyalahgunaan integrasi host. Perlakukan ini sebagai gate terpisah dari functional test suite saat ini.

## 5. Analisis SWOT

| Dimensi | Analisis |
|---|---|
| **Kekuatan** | Diferensiasi produk yang jelas dari layanan bergaya CAPTCHA terpusat; keputusan advisori dan explainable; pemisahan kuat antara proof dan probability; zero runtime dependencies; persistence yang pluggable; collector dan protokol yang memperhatikan privasi; rekam desain yang sangat jujur; 233 pengujian otomatis dan contoh alur nyata |
| **Kelemahan** | Tidak ada policy production yang terkalibrasi; tidak ada server/loop protokol yang berjalan; identity churn pada dasarnya belum terselesaikan; Node 22+/ESM mempersempit adopsi; operator harus membangun enforcement dan observability; fail-open KV dapat mereset riwayat; default publik mengungkap target yang dapat di-tuning |
| **Peluang** | Menjadi policy/evidence engine yang dapat digunakan ulang untuk workflow sensitif; mengemas calibration dan operasi shadow-mode sebagai jalur adopsi; memublikasikan protocol fixture dan reference server; menambahkan adapter untuk session store dan edge platform umum; mengubah decision trace menjadi produk operasi penyalahgunaan yang terukur; berdiferensiasi melalui privasi local-first dan explainability |
| **Ancaman** | Attacker dapat mengganti identitas, meracuni riwayat positif, atau menargetkan external state store; automation yang sah dapat terlihat teratur seperti mesin; pengungkapan threshold memungkinkan evasi adaptif; protocol poisoning dapat menghasilkan prescription yang menyesatkan; layanan pesaing menawarkan enforcement dan telemetry siap pakai; kewajiban hukum/privasi meningkat ketika riwayat perilaku menjadi durable |

## 6. Penilaian prioritas

### P0, Wajib sebelum mengklaim penegakan production

1. Bangun workflow kalibrasi dan shadow-mode menggunakan traffic nyata yang representatif.
2. Tentukan panduan deployment untuk referensi entitas, outage KV, retensi, penghapusan, dan respons insiden.
3. Tambahkan persyaratan observability production: decision rate, cold start, store error, trace sampling, tinjauan false positive, dan versioning policy.
4. Selesaikan drift rilis/dokumentasi dan buat generated docs reproducible.

### P1, Wajib untuk mengubah arsitektur menjadi ekosistem produk

1. Implementasikan dan operasikan reference protocol server minimal.
2. Publikasikan protocol fixture dan HTTP interoperability test.
3. Dokumentasikan topologi single-host, serverless, dan horizontally distributed.
4. Tambahkan perlindungan dan panduan eksplisit untuk poisoning, replay, rate limiting, dan symptom report yang tidak terautentikasi.
5. Sediakan pola integrasi host untuk enforcement, shadow mode, dan rollback.

### P2, Peningkatan strategis

1. Dukung browser/edge packaging jika memang menjadi pasar yang dituju.
2. Tambahkan mekanisme policy registry/versioning agar perubahan model dapat diaudit per keputusan.
3. Kembangkan panduan identity-binding yang lebih kuat atau adapter host opsional tanpa berpura-pura bahwa library dapat menetapkan identitas sendiri.
4. Tinjau kembali klasifikasi anomali hanya setelah traffic nyata yang memadai tersedia untuk membenarkannya.

## 7. Scorecard keseluruhan

Skor bersifat kualitatif dan mencerminkan repositori saat ini, bukan sertifikasi eksternal.

| Dimensi | Rating | Rasional |
|---|---:|---|
| Kejelasan produk | 4.5/5 | Diferensiasi dan batasan sangat jelas |
| Koherensi teknis inti | 4.5/5 | Model, storage, collector, dan trace terintegrasi dengan rapi |
| Kualitas kode dan disiplin pengujian | 4.5/5 | TypeScript type-safe, 233 pengujian berhasil, cakupan build/smoke/CI |
| Explainability | 5/5 | Assessment terstruktur dan trace berurutan merupakan fitur kelas utama |
| Privacy-by-design | 4/5 | Minimisasi data kuat; kontrol operasional/hukum tetap menjadi tanggung jawab host |
| Kesiapan production | 2/5 | Tidak ada kalibrasi, tidak ada reference server, risiko identity dan poisoning belum terselesaikan |
| Kesiapan ekosistem | 2/5 | Protokol telah didraft tetapi belum operasional; dukungan runtime terbatas |
| Konsistensi dokumentasi | 3/5 | Rekam desain sangat baik, tetapi drift jumlah/versi saat ini terlihat |

## 8. Verdict akhir

**Sudah tepat sekarang:** repositori ini merupakan implementasi pra-alfa yang kuat dari adaptive-trust engine lokal dan advisori. Batas arsitektur, explainability, abstraksi storage, tujuan privasi, dan disiplin pengujian dapat dipercaya. Penggunaan terbaik dalam waktu dekat adalah shadow mode dan integrasi terkendali ke aplikasi host ketika operator memiliki referensi entitas dan dapat meninjau hasil.

**Belum tepat:** repositori ini belum siap diposisikan sebagai platform anti-penyalahgunaan lengkap, fraud detector terkalibrasi, atau ekosistem open protocol yang berfungsi. Bagian yang hilang terutama bersifat operasional dan tingkat produk, bukan organisasi kode dasar: traffic nyata yang representatif, kalibrasi threshold, panduan deployment, observability, server aktual, serta respons yang disengaja terhadap kegagalan store dan identity churn.

**Positioning yang direkomendasikan:** “advisor pra-alfa, local-first, untuk
trust engine pada alur web yang terinstrumentasi; sesuai untuk evaluasi
shadow-mode dan integrasi riset.” Hindari klaim tentang pemblokiran otonom,
deteksi bot universal, atau pembelajaran lintas instance sampai seluruh item P0
dan P1 di atas terpenuhi.

## 9. Peta bukti

Bukti utama yang ditinjau:

- `README.md`: premis produk, penggunaan, roadmap, klaim integrasi, keterbatasan
- `package.json`: surface paket, script, runtime floor, versi rilis
- `src/core/guard.ts`: komposisi evaluasi end-to-end dan trace
- `src/core/trust.ts`: state bukti Beta, decay, retention, mass
- `src/core/assess.ts`: decision band dan ceiling
- `src/core/behavior.ts`: fitur perilaku berbatas, deteksi farming, positive credit
- `src/core/constraints.ts`: taksonomi invariant hard/soft
- `src/core/store.ts`: state store in-memory dan batas memori
- `src/store/sqlite.ts`: durable store single-host
- `src/store/kv.ts`: networked store dan failure policy
- `src/collect/interaction.ts`: minimisasi data browser
- `src/core/protocol.ts` dan `PROTOCOL.md`, wire format draft dan aturan degradasi
- `SECURITY.md`: security scope yang dinyatakan dan keterbatasan yang diketahui
- `.github/workflows/ci.yml`: validasi otomatis
- `examples/healthme/` dan `examples/ixfe/`, bukti integrasi dan traffic yang dihasilkan

## 10. Adendum, sesi 2026-10-24

Audit ulang dijalankan pada working tree yang sama. Seluruh gate tetap hijau
(`typecheck`, 233/233 test, `build`, `smoke`), tetapi lima temuan baru muncul dan
salah satunya membatalkan kesimpulan T5 sebelumnya.

### 10.1 Koreksi terhadap T5

T5 menyebut `npm run site:check` "memodifikasi `index.html`" dan menyimpulkan
generated output "belum sepenuhnya bersih". Penyebabnya bukan output kotor, melainkan
desain build:

- `site/build.mjs` mendokumentasikan flag `--check` tetapi **tidak pernah membacanya**
  dari `process.argv`. Mode `--check` identik dengan mode tulis biasa.
- `scripts/research.mjs` menstempel `generatedAt` dari `new Date()`, sehingga setiap
  build menghasilkan tanggal hari itu. Build-nya **tidak mungkin reproducible**;
  `site:check` akan selalu melihat diff, bahkan pada worktree yang bersih.

Karena itu T5 tidak dapat diselesaikan dengan membersihkan output. Yang harus
diperbaiki adalah generatornya.

### 10.2 Temuan baru

| ID | Temuan | Dampak |
|---|---|---|
| A1 | `--check` tidak diimplementasikan; `site:check` menulis sembilan halaman tanpa syarat | Gate CI yang diklaim ada sebenarnya tidak ada |
| A2 | Provenance memakai wall clock | Output berubah setiap hari; drift tidak bisa dibedakan dari berlalunya waktu |
| A3 | Entri `D2a` tidak pernah masuk index karena regex hanya menerima `D[\d.]+` | Satu keputusan desain hilang dari situs; angka 62 seharusnya 63 |
| A4 | CI tidak menjalankan `site:check` | HTML ter-commit bisa basi tanpa ada job yang gagal |
| A5 | README menyebut 222 test / 52 entri / 8 halaman, dan menyatakan anomaly classifier "belum ada" padahal `src/core/anomaly.ts` sudah diekspor; `src/store/kv.ts` tidak terdokumentasi | Dokumen menyangkal kemampuan yang sudah ada |

### 10.3 Perbaikan yang diterapkan

- `--check` tidak lagi menulis apa pun: seluruh halaman dirender di memori. CI
  menjalankannya supaya generator yang rusak gagal di CI, bukan saat deploy.
- Provenance diganti dari tanggal menjadi versi paket, sehingga build deterministik.
- Regex index diperbaiki agar `D2a` ikut terhitung; situs kini melaporkan 63.
- **HTML hasil generate dikeluarkan dari root.** Output pindah ke `site/dist`
  (gitignore) dan diterbitkan oleh `.github/workflows/pages.yml` dengan Pages
  source "GitHub Actions". `CNAME`, `.nojekyll`, dan `404.html` ikut di-generate,
  sehingga tidak ada lagi halaman hand-written di luar generator. Konsekuensinya
  `site:check` tidak lagi membandingkan file ter-commit: tidak ada artefak generate
  yang di-commit, jadi kelas drift ini hilang seluruhnya.
- `site:check` ditambahkan ke CI.
- README disinkronkan: 233 test, 63 entri, 9 halaman, keberadaan classifier (default
  mati, sesuai D52), dan adapter KV beserta kebijakan fail-open-nya (D60).
- Tata letak: artefak runtime observer pindah ke `var/` (di-ignore) dengan default
  path diperbarui di `proxy.ts` dan `report.ts`; catatan desain awal pindah ke
  `docs/design/`; audit ini pindah ke `docs/`.

### 10.4 Verifikasi setelah perbaikan

`typecheck`, 233/233 test, `build`, `smoke`, dan `site:check` (10 halaman dirender
tanpa menulis, 63 keputusan, 233 test) semuanya lolos. `npm run site` menghasilkan
sembilan halaman bab plus `404.html`, `CNAME`, dan `.nojekyll` di `site/dist`.

Halaman `404` dibandingkan byte-per-byte dengan versi hand-written sebelumnya:
satu-satunya perbedaan adalah konsolidasi markup dua bahasa ke konvensi `t()` yang
dipakai seluruh situs. Tema gelap sebagai default tetap dipertahankan.

Temuan P0/P1 di bagian 6 tidak berubah: kalibrasi, reference server, dan
observability tetap pekerjaan yang belum tersentuh.

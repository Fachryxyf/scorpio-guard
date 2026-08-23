/**
 * Front page. D58.
 *
 * The old front page was the README with a stylesheet, and it read like one:
 * premise, product shape, two kinds of signal, open problems, roadmap, in one
 * column, in one scroll. This one answers the three questions a visitor actually
 * arrives with — what is this, is it usable yet, where do I go — and then hands
 * off. Everything else is a chapter.
 */
import { barChart } from '../charts.mjs';
import { CHAPTERS, SEGMENTS, eq, figure, h2, page, t } from '../layout.mjs';

export function overview(data) {
  const { parameters, replay } = data;
  const sections = [
    { id: 'premise', en: 'The premise', id_: 'Premisnya' },
    { id: 'shape', en: 'What it is', id_: 'Bentuknya' },
    { id: 'refuses', en: 'What it refuses to be', id_: 'Yang ia tolak jadi' },
    { id: 'findings', en: 'What has been measured', id_: 'Apa yang sudah diukur' },
    { id: 'state', en: 'Where it stands', id_: 'Posisinya sekarang' },
    { id: 'read', en: 'How to read this site', id_: 'Cara membaca situs ini' },
  ];

  const portals = SEGMENTS.map((segment) => {
    const items = CHAPTERS.filter(
      (chapter) => chapter.segment === segment.id && chapter.file !== 'index.html',
    )
      .map(
        (chapter) =>
          `          <li><a href="${chapter.file}">${t(chapter.titleEn, chapter.titleId)}</a>
            <span class="d">${t(chapter.blurbEn, chapter.blurbId)}</span></li>`,
      )
      .join('\n');
    if (!items) return '';
    return `      <section>
        <h3>${t(segment.en, segment.id_)}</h3>
        <ul>
${items}
        </ul>
      </section>`;
  })
    .filter(Boolean)
    .join('\n');

  const personas = replay.ixfe.personas.length + replay.healthme.personas.length;
  const tenDays = data.headStarts.find((row) => row.days === 10);
  const fastFarm = data.farming.find((row) => row.gapMinutes === 0.5);

  /**
   * The one figure the front page earns: the head start an honest history buys,
   * because it is the thesis in a single reading. Everything else is a chapter.
   */
  const headStartFig = barChart({
    title: 'Abuse calls absorbed before friction, by days of honest history',
    max: Math.max(...data.headStarts.map((row) => row.callsMax)) + 1,
    pad: { top: 16, right: 56, bottom: 26, left: 96 },
    rows: data.headStarts.map((row) => ({
      label: `${row.days} ${row.days === 1 ? 'day' : 'days'}`,
      value: row.callsMedian,
      value_label: `${row.callsMedian} (${row.callsMin}–${row.callsMax})`,
      hollow: row.days === 0,
    })),
    xLabel: 'abuse calls to INCREASE_FRICTION, median of 10 seeds',
    xTicks: [0, 2, 4, 6].map((at) => ({ at, label: String(at) })),
  });

  const body = `
    <aside class="infobox">
      <p class="cap">Scorpio Guard</p>
      <table>
        <tbody>
          <tr><th>${t('Kind', 'Jenis')}</th><td>${t('library', 'library')}</td></tr>
          <tr><th>${t('Stage', 'Tahap')}</th><td>pre-alpha</td></tr>
          <tr><th>${t('Language', 'Bahasa')}</th><td>TypeScript</td></tr>
          <tr><th>${t('Dependencies', 'Dependensi')}</th><td>0</td></tr>
          <tr><th>${t('Runtime', 'Runtime')}</th><td>Node &ge; 22.6</td></tr>
          <tr><th>${t('Tests', 'Test')}</th><td>${data.testCount}</td></tr>
          <tr><th>${t('Decisions', 'Keputusan')}</th><td>${data.decisionCount}</td></tr>
          <tr><th>${t('Personas replayed', 'Persona diputar')}</th><td>${personas}</td></tr>
          <tr><th>${t('Calibrated', 'Terkalibrasi')}</th><td>${t('no', 'belum')}</td></tr>
          <tr><th>${t('Network use', 'Pakai jaringan')}</th><td>${t('none', 'tidak ada')}</td></tr>
          <tr><th>License</th><td>MIT</td></tr>
        </tbody>
      </table>
    </aside>

    <p class="lead">${t(
      '<b>Scorpio Guard</b> is a trust-evaluation library that runs inside your own system. It never answers <i>human or bot</i>. It estimates, continuously, how much trust an interaction currently deserves &mdash; and it advises rather than acts, because every decision belongs to the operator of the system it runs in.',
      '<b>Scorpio Guard</b> adalah library evaluasi trust yang jalan di dalam sistemmu sendiri. Ia tidak pernah menjawab <i>manusia atau bot</i>. Ia menaksir, terus-menerus, seberapa besar trust yang layak diterima sebuah interaksi &mdash; dan ia memberi saran, bukan bertindak, karena setiap keputusan milik operator sistem tempat ia berjalan.',
    )}</p>

    ${h2(1, 'premise', 'The premise', 'Premisnya')}

    <p>${t(
      'No web behavior is inherently human. Mouse movement, dwell time, DOM interaction, navigation order &mdash; every one of them can be recorded, learned and replayed. A detector built on any of them is a detector with a shelf life.',
      'Tidak ada perilaku web yang inheren manusiawi. Gerak mouse, lama berdiam, interaksi DOM, urutan navigasi &mdash; semuanya bisa direkam, dipelajari, dan diputar ulang. Detektor yang dibangun di atas salah satunya adalah detektor yang punya tanggal kedaluwarsa.',
    )}</p>

    <p>${t(
      'So the question is replaced. Not <i>is this a human</i>, which is unanswerable and gets a verdict wrong in both directions, but <i>how much has this party earned</i> &mdash; which is answerable from history, and wrong only by degrees.',
      'Jadi pertanyaannya diganti. Bukan <i>ini manusia atau bukan</i>, yang tak terjawab dan salah di dua arah sekaligus, tapi <i>sudah seberapa banyak pihak ini menghasilkan</i> &mdash; yang bisa dijawab dari riwayat, dan salahnya cuma soal derajat.',
    )}</p>

    ${eq(
      1,
      'T = &Pi;(A, C)',
      '<b>T</b> treatment &mdash; a point on a five-rung spectrum, never a boolean. <b>A</b> accumulated evidence about this entity. <b>C</b> the context this request arrived in. The function is the guard; the treatment is advice.',
      '<b>T</b> treatment &mdash; satu titik di spektrum lima tingkat, bukan boolean. <b>A</b> evidence terakumulasi tentang entitas ini. <b>C</b> konteks kedatangan request. Fungsinya adalah guard-nya; treatment-nya adalah saran.',
    )}

    <p>${t(
      'The goal is not perfect detection. It is <b>asymmetric cost</b>: near-zero friction for a legitimate visitor, and a price that rises for sustained abuse. Those two are the same threshold read from either side, which is why the project treats a false positive as the more serious failure.',
      'Tujuannya bukan deteksi sempurna. Tujuannya <b>biaya asimetris</b>: friksi mendekati nol untuk pengunjung yang sah, dan harga yang naik untuk penyalahgunaan berkelanjutan. Keduanya adalah ambang yang sama dibaca dari dua sisi, dan itu sebabnya proyek ini menganggap false positive sebagai kegagalan yang lebih serius.',
    )}</p>

    ${h2(2, 'shape', 'What it is', 'Bentuknya')}

    <p>${t(
      'A package you install. It holds state for the entities your own system identifies, computes over that state locally, and returns a treatment plus the reasoning behind it. There is no API key, because there is no service to hold one, and no network call anywhere in the current scope.',
      'Sebuah paket yang kamu pasang. Ia menyimpan state untuk entitas yang sistemmu sendiri identifikasi, menghitung di atas state itu secara lokal, dan mengembalikan sebuah treatment beserta alasannya. Tidak ada API key, karena tidak ada layanan yang memegangnya, dan tidak ada panggilan jaringan sama sekali dalam cakupan saat ini.',
    )}</p>

    <p>${t(
      'The eventual communication model is <b>prescription, not diagnosis</b>, and the analogy holds against the code: a patient says <i>&ldquo;I have a headache&rdquo;</i> &mdash; a category of complaint, a few bytes of information, not a transfer of the headache. A deployment reports the abstract <i>shape</i> it saw; it receives a general strategy for that class of shape; it acts locally on local data. That exchange is drafted and tested, and transmits nothing today.',
      'Model komunikasi yang dituju adalah <b>resep, bukan diagnosis</b>, dan analoginya bertahan saat bertemu kode: seorang pasien berkata <i>&ldquo;saya sakit kepala&rdquo;</i> &mdash; sebuah kategori keluhan, beberapa byte informasi, bukan pemindahan sakit kepalanya. Sebuah deployment melaporkan <i>bentuk</i> abstrak yang ia lihat; ia menerima strategi umum untuk kelas bentuk itu; ia bertindak lokal atas data lokal. Pertukaran itu sudah didraf dan diuji, dan hari ini tidak mengirim apa pun.',
    )}</p>

    ${h2(3, 'refuses', 'What it refuses to be', 'Yang ia tolak jadi')}

    <table>
      <caption>${t('The four refusals, and what each costs', 'Empat penolakan, dan biaya masing-masing')}</caption>
      <thead>
        <tr>
          <th>${t('It is not', 'Ia bukan')}</th>
          <th>${t('Because', 'Karena')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${t('a CAPTCHA or a verdict token', 'CAPTCHA atau token putusan')}</td>
          <td>${t('there is no round trip and no central service to issue one. The output is advice on a spectrum, produced locally.', 'tidak ada perjalanan bolak-balik dan tidak ada layanan pusat yang menerbitkannya. Keluarannya adalah saran di sebuah spektrum, dihasilkan secara lokal.')}</td>
        </tr>
        <tr>
          <td>${t('an enforcement layer', 'lapis penegakan')}</td>
          <td>${t('it has no mechanism to block anything and is not entitled to one. Every action belongs to the host.', 'ia tidak punya mekanisme untuk memblokir apa pun dan tidak berhak atasnya. Setiap tindakan milik host.')}</td>
        </tr>
        <tr>
          <td>${t('a fingerprinter', 'pem-fingerprint')}</td>
          <td>${t('the entity key comes from the host and is never parsed. Identity history is the input; identity itself is not the library&rsquo;s business.', 'kunci entitas datang dari host dan tidak pernah diurai. Riwayat identitas adalah masukannya; identitasnya sendiri bukan urusan library ini.')}</td>
        </tr>
        <tr>
          <td>${t('a telemetry client', 'klien telemetri')}</td>
          <td>${t('nothing is sent per request. The wire format that exists carries shapes and bucketed counts, and it carries nothing today because nothing transmits.', 'tidak ada yang dikirim per request. Format wire yang ada membawa bentuk dan hitungan yang di-bucket, dan hari ini ia tidak membawa apa pun karena tidak ada yang mengirim.')}</td>
        </tr>
      </tbody>
    </table>

    ${h2(4, 'findings', 'What has been measured', 'Apa yang sudah diukur')}

    <p>${t(
      'One result, because it is the thesis in a single reading: <b>a memory has a price, and the price is bounded</b>. An entity with ten days of honest history absorbs ' +
        tenDays.callsMedian +
        ' abuse calls before friction is advised, against ' +
        data.headStarts[0].callsMedian +
        ' with no history at all &mdash; and the curve flattens rather than climbing, because decay caps how much a history can be worth.',
      'Satu hasil, karena inilah tesisnya dalam sekali baca: <b>memori punya harga, dan harganya berbatas</b>. Entitas dengan sepuluh hari riwayat jujur menyerap ' +
        tenDays.callsMedian +
        ' panggilan abusif sebelum friksi disarankan, dibanding ' +
        data.headStarts[0].callsMedian +
        ' tanpa riwayat sama sekali &mdash; dan kurvanya mendatar, bukan memanjat, karena decay membatasi seberapa berharga sebuah riwayat bisa jadi.',
    )}</p>

    ${figure(
      headStartFig,
      '<b>Figure 1.</b> The head start honest history buys. Hollow bar is the no-history baseline; the range in brackets is the spread across ten seeds. Bounded, not unbounded: this is what stops a patient farmer from buying immunity. Farming positives at a fixed ' +
        fastFarm.gapMinutes * 60 +
        '-second interval buys ' +
        fastFarm.withDiscount.abuseCallsToFelt +
        ' call' +
        (fastFarm.withDiscount.abuseCallsToFelt === 1 ? '' : 's') +
        ' instead of ' +
        fastFarm.withoutDiscount.abuseCallsToFelt +
        ', because a positive is priced by the shape of the gap it arrived in. Method and full tables in <a href="results.html">Results</a>.',
      '<b>Gambar 1.</b> Keunggulan awal yang dibeli riwayat jujur. Batang kosong adalah baseline tanpa riwayat; rentang dalam tanda kurung adalah sebaran atas sepuluh seed. Berbatas, bukan tak berbatas: inilah yang menahan farmer sabar membeli imunitas. Mem-farming positive pada interval tetap ' +
        fastFarm.gapMinutes * 60 +
        ' detik hanya membeli ' +
        fastFarm.withDiscount.abuseCallsToFelt +
        ' panggilan, bukan ' +
        fastFarm.withoutDiscount.abuseCallsToFelt +
        ', karena sebuah positive dihargai menurut bentuk jeda kedatangannya. Metode dan tabel lengkapnya di <a href="results.html">Hasil</a>.',
    )}

    ${h2(5, 'state', 'Where it stands', 'Posisinya sekarang')}

    <table class="ledger">
      <caption>${t('Honest status, part by part', 'Status jujur, bagian per bagian')}</caption>
      <thead>
        <tr>
          <th>${t('Part', 'Bagian')}</th>
          <th>${t('State', 'Keadaan')}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>${t('Trust model, decay, retention', 'Model trust, decay, retensi')}</td><td class="yes">${t('built, tested', 'dibangun, teruji')}</td></tr>
        <tr><td>${t('Decision layer and its three ceilings', 'Lapis keputusan dan tiga ceiling-nya')}</td><td class="yes">${t('built, tested', 'dibangun, teruji')}</td></tr>
        <tr><td>${t('Constraint taxonomy', 'Taksonomi constraint')}</td><td class="yes">${t('closed \u2014 ' + parameters.constraintClasses.length + ' classes over 6 proof sources', 'tertutup \u2014 ' + parameters.constraintClasses.length + ' kelas di atas 6 sumber bukti')}</td></tr>
        <tr><td>${t('Weak-signal catalogue', 'Katalog weak signal')}</td><td class="yes">${t('closed \u2014 ' + parameters.signals.length + ' signals, no thresholds, a collector each', 'tertutup \u2014 ' + parameters.signals.length + ' sinyal, tanpa ambang, masing-masing punya collector')}</td></tr>
        <tr><td>${t('Durable store + conformance kit', 'Store tahan restart + kit conformance')}</td><td class="yes">${t('two implementations, both conformant', 'dua implementasi, keduanya conform')}</td></tr>
        <tr><td>${t('Anomaly classifier', 'Classifier anomali')}</td><td class="part">${t('built as distance-to-reference, deliberately untrained', 'dibangun sebagai jarak ke rujukan, sengaja tidak dilatih')}</td></tr>
        <tr><td>${t('Wire format', 'Format wire')}</td><td class="part">${t('v0.1 drafted and tested, never round-tripped', 'v0.1 didraf dan diuji, belum pernah di-round-trip')}</td></tr>
        <tr><td>${t('Symptom server', 'Server symptom')}</td><td class="no">${t('does not exist', 'belum ada')}</td></tr>
        <tr><td>${t('Calibration against a real population', 'Kalibrasi terhadap populasi nyata')}</td><td class="no">${t('none, and this is the blocker', 'belum ada, dan ini penghambatnya')}</td></tr>
      </tbody>
    </table>
    <p class="tnote">${t(
      'The last row is the important one. Generated traffic can <i>falsify</i> a threshold &mdash; and has, ' +
        data.falsifiedCount +
        ' times &mdash; but it cannot calibrate one, because the distribution it was drawn from was invented. Legitimate personas currently take no friction (' +
        (replay.ixfe.falsePositives + replay.healthme.falsePositives) +
        ' false positives across ' +
        personas +
        ' personas) and no adversary walks through untouched. Neither fact is evidence about real users.',
      'Baris terakhir yang penting. Trafik buatan bisa <i>memfalsifikasi</i> ambang &mdash; dan sudah, ' +
        data.falsifiedCount +
        ' kali &mdash; tapi tidak bisa mengkalibrasinya, karena distribusi asalnya diciptakan sendiri. Persona yang sah saat ini tidak menerima friksi (' +
        (replay.ixfe.falsePositives + replay.healthme.falsePositives) +
        ' false positive dari ' +
        personas +
        ' persona) dan tak ada adversary yang lolos tanpa terasa. Keduanya bukan bukti tentang pengguna nyata.',
    )}</p>

    ${h2(6, 'read', 'How to read this site', 'Cara membaca situs ini')}

    <p>${t(
      'Seven chapters in four segments. <b>Start</b> is this page and how to install; <b>Theory</b> is the argument and the arithmetic; <b>Findings</b> is what was measured and what those measurements do not cover; <b>Reference</b> is what you look up rather than read.',
      'Tujuh bab dalam empat segmen. <b>Mulai</b> adalah halaman ini dan cara memasang; <b>Teori</b> adalah argumen dan aritmetikanya; <b>Temuan</b> adalah apa yang diukur dan apa yang tidak dicakup pengukuran itu; <b>Rujukan</b> adalah yang kamu cari, bukan yang kamu baca.',
    )}</p>

    <div class="portals">
${portals}
    </div>

    <p class="prov">${t(
      'Generated from the repository at ' +
        data.generatedAt +
        '. Figures and tables come from <code>scripts/research.mjs</code>, which imports the library directly; the live-traffic table from <code>examples/ixfe/live/</code>. No number on this site was typed by hand.',
      'Dihasilkan dari repositori pada ' +
        data.generatedAt +
        '. Gambar dan tabelnya dari <code>scripts/research.mjs</code>, yang mengimpor library-nya langsung; tabel trafik langsung dari <code>examples/ixfe/live/</code>. Tidak ada angka di situs ini yang ditulis tangan.',
    )}</p>
  `;

  return page({
    file: 'index.html',
    titleEn: 'Scorpio Guard',
    titleId: 'Scorpio Guard',
    subtitleEn: 'Trust is a spectrum, not a verdict. A local, advisory trust-evaluation library &mdash; pre-alpha, and calibrated against nothing.',
    subtitleId: 'Trust itu spektrum, bukan putusan. Library evaluasi trust yang lokal dan bersifat saran &mdash; pre-alpha, dan belum dikalibrasi terhadap apa pun.',
    sections,
    body,
  });
}

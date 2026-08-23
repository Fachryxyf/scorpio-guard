import { h2, page, t } from '../layout.mjs';

export function coverage(data) {
  const { replay, testCount, decisionCount, parameters } = data;
  const all = [...replay.ixfe.personas, ...replay.healthme.personas];
  const legit = all.filter((p) => p.legitimate);
  const adversary = all.filter((p) => !p.legitimate);
  const totalFP = replay.ixfe.falsePositives + replay.healthme.falsePositives;
  const totalWalk = replay.ixfe.walkedThrough + replay.healthme.walkedThrough;

  const sections = [
    { id: 'counts', en: 'What the numbers are', id_: 'Apa angka-angkanya' },
    { id: 'tests', en: 'Test coverage', id_: 'Cakupan test' },
    { id: 'personas', en: 'Persona coverage', id_: 'Cakupan persona' },
    { id: 'decisions', en: 'Decision record', id_: 'Rekaman keputusan' },
    { id: 'honest', en: 'What this does not prove', id_: 'Apa yang tidak dibuktikan ini' },
  ];

  const personaRow = (p) => `        <tr>
          <th>${p.persona}</th>
          <td>${p.legitimate ? t('legit', 'sah') : t('adversary', 'adversary')}</td>
          <td><code>${p.worst}</code></td>
          <td class="num">${p.steps}</td>
          <td>${p.falsePositive ? '<b>YES</b>' : t('no', 'tidak')}</td>
          <td>${p.walkedThrough ? '<b>YES</b>' : t('no', 'tidak')}</td>
        </tr>`;

  const body = `
    <p class="lead">${t(
      `The three headline numbers — ${testCount} tests, ${decisionCount} decisions, ${all.length} personas — and what sits behind each one. Every figure here is generated at build time; nothing was typed by hand.`,
      `Tiga angka utama \u2014 ${testCount} test, ${decisionCount} keputusan, ${all.length} persona \u2014 dan apa yang ada di balik masing-masing. Setiap angka di sini dibangkitkan saat build; tidak ada yang diketik manual.`,
    )}</p>

    ${h2(1, 'counts', 'What the numbers are', 'Apa angka-angkanya')}

    <table class="ledger">
      <caption>${t('Headline figures', 'Angka utama')}</caption>
      <thead><tr><th></th><th class="num">${t('count', 'jumlah')}</th></tr></thead>
      <tbody>
        <tr><th>Tests</th><td class="num"><b>${testCount}</b></td></tr>
        <tr><th>${t('Numbered decisions', 'Keputusan bernomor')}</th><td class="num"><b>${decisionCount}</b></td></tr>
        <tr><th>${t('Personas replayed', 'Persona diputar')}</th><td class="num"><b>${all.length}</b></td></tr>
        <tr><th>&mdash; ${t('legitimate', 'sah')}</th><td class="num">${legit.length}</td></tr>
        <tr><th>&mdash; adversary</th><td class="num">${adversary.length}</td></tr>
        <tr><th>${t('False positives across all personas', 'False positive dari semua persona')}</th><td class="num">${totalFP}</td></tr>
        <tr><th>${t('Adversaries that walked through untouched', 'Adversary yang lolos tanpa terasa')}</th><td class="num">${totalWalk}</td></tr>
      </tbody>
    </table>

    ${h2(2, 'tests', 'Test coverage', 'Cakupan test')}

    <p>${t(
      `${testCount} tests run on every push via CI. They are not a coverage percentage; they pin the specific numeric and semantic properties the design argues from \u2014 decay factors, stage boundaries, ceiling behavior, signal mass caps, protocol degradation rules, store conformance. A threshold change that no test pins is a bug in the test suite, not a feature of the library.`,
      `${testCount} test dijalankan di setiap push lewat CI. Mereka bukan persentase coverage; mereka memaku properti numerik dan semantik spesifik yang dipakai desain sebagai argumen \u2014 faktor decay, batas tahap, perilaku ceiling, cap massa sinyal, aturan degradasi protokol, konformansi store. Perubahan ambang yang tak dipaku test mana pun adalah bug dalam test suite-nya, bukan fitur library.`,
    )}</p>

    <table>
      <caption>${t('What the tests actually pin, by area', 'Apa yang dipaku test, per area')}</caption>
      <thead><tr><th>${t('Area', 'Area')}</th><th>${t('Pinned by', 'Dipaku oleh')}</th></tr></thead>
      <tbody>
        <tr><th>${t('Trust model arithmetic', 'Aritmetika model trust')}</th><td>${t('decay compositeness, prior mean/variance, single-observation effects, mass ceilings', 'komposisi decay, prior mean/variansi, efek satu observasi, batas massa')}</td></tr>
        <tr><th>Decision layer</th><td>${t('band boundaries, epistemic stages, uncertainty gates, anomaly concurrence, strongest-wins combination', 'batas band, tahap epistemik, gate uncertainty, concurrence anomali, kombinasi terkuat-menang')}</td></tr>
        <tr><th>${t('Constraint taxonomy', 'Taksonomi constraint')}</th><td>${t('each of the seven classes fires and does not fire on the right inputs; soft violations weigh correctly', 'ketujuh kelas memicu dan tidak memicu pada input yang benar; pelanggaran soft berbobot dengan tepat')}</td></tr>
        <tr><th>Weak signals</th><td>${t('mass caps, catalogue completeness (every collector exists), unknown-id tolerance', 'cap massa, kelengkapan katalog (setiap collector ada), toleransi id tak dikenal')}</td></tr>
        <tr><th>Behavior features</th><td>${t('scope entropy normalisation (D46), gap CV, velocity gate, intake discount (D55)', 'normalisasi entropi scope (D46), CV jeda, gate velocity, diskon intake (D55)')}</td></tr>
        <tr><th>Store conformance</th><td>${t('eleven checks against both memory and SQLite stores; millisecond precision, window persistence, opaque keys', 'sebelas cek atas kedua store; presisi milidetik, persistensi window, kunci opaque')}</td></tr>
        <tr><th>Protocol encoding</th><td>${t('v0.1 encode/decode, bucket ordering, degradation rules 1\u20135, no raw data in any field', 'encode/decode v0.1, urutan bucket, aturan degradasi 1\u20135, tanpa data mentah di field mana pun')}</td></tr>
        <tr><th>${t('Persona assertions', 'Asersi persona')}</th><td>${t(`zero false positives and zero walkthroughs asserted as hard requirements`, `nol false positive dan nol lolos ditegaskan sebagai syarat keras`)}</td></tr>
      </tbody>
    </table>

    ${h2(3, 'personas', 'Persona coverage', 'Cakupan persona')}

    <div class="scroll">
    <table>
      <caption>${t(`All ${all.length} personas, both targets`, `Semua ${all.length} persona, dua target`)}</caption>
      <thead><tr><th>${t('Persona', 'Persona')}</th><th>${t('Kind', 'Jenis')}</th><th>${t('Worst advice', 'Saran terburuk')}</th><th class="num">${t('Steps', 'Langkah')}</th><th>FP?</th><th>${t('Walked?', 'Lolos?')}</th></tr></thead>
      <tbody>
${all.map(personaRow).join('\n')}
      </tbody>
    </table>
    </div>

    <p class="tnote">${t(
      `Every legitimate persona stays at or below OBSERVE. Every adversary is advised something felt. Both facts are asserted in the test suite, so a regression fails CI rather than shipping silently.`,
      `Setiap persona sah tetap di OBSERVE atau lebih lunak. Setiap adversary disarankan sesuatu yang terasa. Kedua fakta ditegaskan dalam test suite, jadi regresi gagal di CI alih-alih terkirim diam-diam.`,
    )}</p>

    ${h2(4, 'decisions', 'Decision record', 'Rekaman keputusan')}

    <p>${t(
      `${decisionCount} numbered decisions in DECISIONS.md, each recording the question, the answer, and what it commits the implementation to. The count is parsed from the file at build time \u2014 adding D59 makes it ${decisionCount + 1} without touching this page.`,
      `${decisionCount} keputusan bernomor di DECISIONS.md, masing-masing merekam pertanyaan, jawaban, dan komitmennya pada implementasi. Jumlahnya diparse dari file saat build \u2014 menambah D59 membuatnya ${decisionCount + 1} tanpa menyentuh halaman ini.`,
    )}</p>

    <table>
      <caption>${t('Decisions by part', 'Keputusan per bagian')}</caption>
      <thead><tr><th>${t('Part', 'Bagian')}</th><th class="num">${t('Entries', 'Entri')}</th></tr></thead>
      <tbody>
${data.design.parts.map((part) => {
  const label = part.part.replace(/^Part ([IVX]+) — (.+)$/, (_m, roman, title) => `${roman}: ${title}`);
  return `        <tr><th>${label}</th><td class="num">${part.entries.length}</td></tr>`;
}).join('\n')}
        <tr class="tot"><th>Total</th><td class="num">${decisionCount}</td></tr>
      </tbody>
    </table>

    ${h2(5, 'honest', 'What this does not prove', 'Apa yang tidak dibuktikan ini')}

    <p>${t(
      `These numbers describe what has been built and tested, not whether it works against real users. The personas are hypotheses about how someone behaves; their distributions were invented. The thresholds they exercise are reasoned guesses set leniently. None of it has been calibrated.`,
      `Angka-angka ini menggambarkan apa yang sudah dibangun dan diuji, bukan apakah ia bekerja terhadap pengguna nyata. Persona-persona itu hipotesis tentang bagaimana seseorang berperilaku; distribusinya diciptakan. Ambang-ambang yang mereka latih tebakan bernaling disetel longgar. Belum ada yang dikalibrasi.`,
    )}</p>

    <table>
      <caption>${t('The honest residue', 'Sisa jujurnya')}</caption>
      <thead><tr><th></th><th>${t('Status', 'Status')}</th></tr></thead>
      <tbody>
        <tr><th>${t('Calibrated against a real population', 'Terkalibrasi terhadap populasi nyata')}</th><td class="no">${t('no', 'belum')}</td></tr>
        <tr><th>${t('Wire format round-tripped', 'Format wire sudah di-round-trip')}</th><td class="no">${t('never \u2014 nothing transmits yet', 'belum pernah \u2014 belum ada yang dikirim')}</td></tr>
        <tr><th>${t('Anomaly reference trained', 'Rujukan anomali dilatih')}</th><td class="no">${t('deliberately untrained', 'sengaja tidak dilatih')}</td></tr>
        <tr><th>${t('Signal false-positive stories', 'Cerita false-positive tiap sinyal')}</th><td class="part">${t('collectors built, stories not earned', 'collector dibangun, ceritanya belum didapat')}</td></tr>
      </tbody>
    </table>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="results.html">${t('Measurements detail', 'Detail pengukuran')}</a>
      <a href="limits.html">${t('Open problems', 'Masalah terbuka')}</a>
      <a href="record.html">${t('Full decision index', 'Indeks keputusan lengkap')}</a>
    </p>
  `;

  return page({
    file: 'coverage.html',
    titleEn: 'Coverage',
    titleId: 'Cakupan',
    subtitleEn: 'What has been tested, decided, and exercised — and what none of that proves.',
    subtitleId: 'Apa yang sudah diuji, diputuskan, dan dilatih — dan apa yang tak dibuktikan oleh semuanya.',
    sections,
    body,
  });
}

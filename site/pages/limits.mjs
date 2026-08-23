import { h2, page, t } from '../layout.mjs';

export function limits(data) {
  const sections = [
    { id: 'calibration', en: 'The one real blocker', id_: 'Satu penghambat sebenarnya' },
    { id: 'unvalidated', en: 'What is still a guess', id_: 'Apa yang masih tebakan' },
    { id: 'signals', en: 'The collectors\u2019 outstanding debt', id_: 'Utang collector yang belum dibayar' },
    { id: 'wire', en: 'What the protocol does not decide yet', id_: 'Apa yang belum diputuskan protokol' },
    { id: 'roadmap', en: 'Order of work', id_: 'Urutan kerja' },
  ];

  const body = `
    <p class="lead">${t(
      'Every numbered question in the design record has been answered. What has not been answered is whether the answers\u2019 <i>values</i> survive contact with a population that was not invented for them.',
      'Setiap pertanyaan bernomor di rekaman desain sudah dijawab. Yang belum terjawab adalah apakah <i>nilai</i>-nilai jawaban itu bertahan saat bertemu populasi yang tidak diciptakan untuk mereka.',
    )}</p>

    ${h2(1, 'calibration', 'The one real blocker', 'Satu penghambat sebenarnya')}

    <p>${t(
      'Generated traffic falsifies; it cannot calibrate. A real browser through the live observer (D57) strengthened the falsification and found four integration bugs generated personas structurally could not. What it still cannot supply is the distribution: how many real clients look like each persona, how many legitimate clients are machine-regular, where honest gap CV actually sits.',
      'Trafik buatan memfalsifikasi; ia tak bisa mengkalibrasi. Browser sungguhan lewat pengamat langsung (D57) memperkuat falsifikasi dan menemukan empat bug integrasi yang tak mungkin ditemukan persona buatan. Apa yang tetap tak bisa ia sediakan adalah distribusinya: berapa banyak klien nyata yang menyerupai tiap persona, berapa banyak klien sah yang teratur seperti mesin, di mana CV jeda jujur sebenarnya berada.',
    )}</p>

    ${h2(2, 'unvalidated', 'What is still a guess', 'Apa yang masih tebakan')}

    <table>
      <caption>${t('Values chosen by reasoning, not measured', 'Nilai dipilih lewat penalaran, bukan diukur')}</caption>
      <thead><tr><th>Ref</th><th>${t('Recorded as', 'Direkam sebagai')}</th><th>${t('Still unvalidated', 'Belum tervalidasi')}</th></tr></thead>
      <tbody>
        <tr><th>D36</th><td>${t('Diversity thresholds', 'Ambang diversity')}</td><td>${t('Every threshold is a guess, set leniently so being wrong withholds escalation.', 'Semua ambang tebakan, disetel longgar agar salahnya menahan eskalasi.')}</td></tr>
        <tr><th>D37</th><td>${t('Anomaly concurrence', 'Concurrence anomali')}</td><td>${t('Cannot be validated against a real adversary from single-user traffic.', 'Tak bisa divalidasi melawan adversary nyata dari trafik satu pengguna.')}</td></tr>
        <tr><th>D40</th><td>${t('Epistemic stage boundaries at n = 3 and n = 7', 'Batas tahap epistemik pada n = 3 dan n = 7')}</td><td>${t('Tied to the D5 trajectory, not to observed populations.', 'Terikat pada trajektori D5, bukan populasi terobservasi.')}</td></tr>
        <tr><th>D3, D4</th><td>H = 24h, w = 0.5 / 2.0</td><td>${t('Policy defaults, locked as tests so revision is visible rather than silent.', 'Default kebijakan, dipaku sebagai test supaya revisinya terlihat bukan diam-diam.')}</td></tr>
        <tr><th>D55</th><td>${t('Intake-discount gate at CV 0.25', 'Gate diskon intake pada CV 0,25')}</td><td>${t('Inherited from D36. Whether real automation clusters below it is unknown.', 'Diwarisi dari D36. Apakah automation nyata berkumpul di bawahnya belum diketahui.')}</td></tr>
        <tr><th>D52</th><td>${t('Anomaly reference profile', 'Profil rujukan anomali')}</td><td>${t('Four expected values and weights, chosen by judgement. Deliberately untrained.', 'Empat nilai harapan dan bobot, dipilih lewat pertimbangan. Sengaja tak dilatih.')}</td></tr>
      </tbody>
    </table>

    ${h2(3, 'signals', 'The collectors\u2019 outstanding debt', 'Utang collector yang belum dibayar')}

    <p>${t(
      'Every catalogued signal now has a collector (D51). Not one has met a real false positive. Each needs its own false-positive story from real traffic before any earns a production threshold \u2014 the catalogue\u2019s promise that every signal has a written innocent cause is kept on paper, not in evidence.',
      'Setiap sinyal di katalog kini punya collector (D51). Belum satu pun bertemu false positive nyata. Masing-masing butuh cerita false-positive-nya sendiri dari trafik nyata sebelum ada yang layak dapat ambang produksi \u2014 janji katalog bahwa setiap sinyal punya sebab tak-bersalah tertulis terpenuhi di atas kertas, bukan dalam bukti.',
    )}</p>

    ${h2(4, 'wire', 'What the protocol does not decide yet', 'Apa yang belum diputuskan protokol')}

    <dl class="compact">
      <dt>${t('Strategy vocabulary', 'Kosakata strategi')}</dt>
      <dd>${t('Deliberately left open. Inventing tokens before a server exists would be guessing.', 'Sengaja dibiarkan terbuka. Mengarang token sebelum ada server berarti menebak.')}</dd>
      <dt>${t('Batching and cadence', 'Batching dan kadensi')}</dt>
      <dd>${t('When an instance reports carries a privacy consequence; undecided before anything transmits.', 'Kapan instance melaporkan punya konsekuensi privasi; belum diputuskan sebelum ada yang dikirim.')}</dd>
      <dt>${t('Replay and poisoning', 'Replay dan poisoning')}</dt>
      <dd>${t('Bucketing limits damage per request but nothing stops a patient attacker from pushing confidence upward. Open problem.', 'Bucketing membatasi kerusakan per request tapi tak ada yang menghentikan penyerang sabar mendorong confidence naik. Masalah terbuka.')}</dd>
    </dl>

    ${h2(5, 'roadmap', 'Order of work', 'Urutan kerja')}

    <ol>
      <li>${t('Find a real population. This is the gate everything else waits behind.', 'Temukan populasi nyata. Ini gerbang yang ditunggu semua hal lain.')}</li>
      <li>${t('Calibrate the intake discount from real machine-client timing.', 'Kalibrasi diskon intake dari timing klien mesin nyata.')}</li>
      <li>${t('Give each signal collector its false-positive story.', 'Beri tiap collector sinyal cerita false-positive-nya.')}</li>
      <li>${t('Calibrate the anomaly reference profile from observed diversity.', 'Kalibrasi profil rujukan anomali dari keragaman terobservasi.')}</li>
      <li>${t('Move the wire format to its own repository and build the first server.', 'Pindahkan format wire ke repositorinya sendiri dan bangun server pertamanya.')}</li>
    </ol>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="results.html#falsified">${t('What traffic already falsified', 'Apa yang sudah difalsifikasi trafik')}</a>
      <a href="record.html">${t('The design record', 'Rekaman desain')}</a>
      <a href="protocol.html#wire">${t('Wire format as drafted', 'Format wire sebagaimana didraf')}</a>
    </p>
  `;

  return page({
    file: 'limits.html',
    titleEn: 'What is not known',
    titleId: 'Yang belum diketahui',
    subtitleEn: 'Open problems, unvalidated numbers, and what remains to be earned from a real population.',
    subtitleId: 'Masalah terbuka, angka yang belum tervalidasi, dan apa yang masih harus didapat dari populasi nyata.',
    sections,
    body,
  });
}

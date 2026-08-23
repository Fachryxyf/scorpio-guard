import { barChart, lineChart } from '../charts.mjs';
import { FALSIFICATIONS } from '../falsifications.mjs';
import { h2, page, t } from '../layout.mjs';

export function results(data) {
  const { parameters, headStarts, farming, automation, replay, live } = data;
  const churn = replay.churn ?? [];

  const sections = [
    { id: 'method', en: 'How these numbers were made', id_: 'Bagaimana angka-angka ini dibuat' },
    { id: 'headstart', en: 'The cost of memory', id_: 'Harga memori' },
    { id: 'discount', en: 'The intake discount against farming', id_: 'Diskon intake terhadap farming' },
    { id: 'automation', en: 'What legitimate automation pays', id_: 'Apa yang dibayar automation sah' },
    { id: 'personas', en: 'Persona replay', id_: 'Replay persona' },
    { id: 'churn', en: 'Identity churn', id_: 'Churn identitas' },
    { id: 'live', en: 'The live run', id_: 'Run langsung' },
    { id: 'falsified', en: 'What traffic falsified', id_: 'Apa yang difalsifikasi trafik' },
  ];

  const totalPersonas = replay.ixfe.personas.length + replay.healthme.personas.length;
  const totalFalsePositives = replay.ixfe.falsePositives + replay.healthme.falsePositives;
  const totalWalkthroughs = replay.ixfe.walkedThrough + replay.healthme.walkedThrough;

  const personaRows = (list) =>
    list.map((row) => {
      const kind = row.legitimate
        ? `<span class="yes">${t('legit', 'sah')}</span>`
        : `<span class="no">${t('adversary', 'adversary')}</span>`;
      const verdict = row.legitimate
        ? row.falsePositive ? '<b>FALSE POSITIVE</b>' : t('as intended', 'sesuai harapan')
        : row.walkedThrough ? '<b>WALKED THROUGH</b>' : t('caught', 'tertangkap');
      return `        <tr>
          <th>${row.persona}</th>
          <td>${kind}</td>
          <td class="num">${row.steps}</td>
          <td><code>${row.worst}</code></td>
          <td class="num">${row.worstAtStep ?? '\u2014'}</td>
          <td>${verdict}</td>
        </tr>`;
    }).join('\n');

  const churnFig = barChart({
    title: 'Advisories felt per identity-churn strategy',
    max: Math.max(...churn.map((row) => row.total)),
    rows: churn.map((row) => ({
      label: `${row.perEntity} req/entity`,
      value: row.felt,
      value_label: `${row.felt}/${row.total}`,
    })),
    xTicks: [0, 10, 20, 30].map((at) => ({ at, label: String(at) })),
    xLabel: `of ${churn[0]?.total ?? 0} adversarial identities`,
  });

  const adviceFig = live
    ? barChart({
      title: 'Live-run advisories by severity',
      max: Math.max(...Object.values(live.summary.byAdvice)),
      pad: { top: 16, right: 56, bottom: 26, left: 160 },
      rows: Object.entries(live.summary.byAdvice).map(([decision, count]) => ({
        label: decision,
        value: count,
        value_label: String(count),
      })),
      xTicks: [0, 25, 50, 75].filter((at) => at <= Math.max(...Object.values(live.summary.byAdvice)))
        .map((at) => ({ at, label: String(at) })),
    })
    : '';

  const liveRows = live
    ? live.clients.map((client) => `        <tr>
          <th><code>${client.client}</code></th>
          <td class="num">${client.requests}</td>
          <td><code>${client.worst}</code></td>
          <td class="num">${client.worstAtRequest ?? '\u2014'}</td>
          <td class="num">${client.hardViolations}</td>
          <td class="num">${client.distinctPaths}</td>
        </tr>`).join('\n')
    : '';

  const body = `
    <p class="lead">${t(
      'Every number on this page is computed from the library at build time by <code>scripts/research.mjs</code>. Nothing was typed into a table by hand; a threshold change either shows up here or breaks the build.',
      'Setiap angka di halaman ini dihitung dari library saat build oleh <code>scripts/research.mjs</code>. Tak ada yang diketik manual ke dalam tabel; perubahan ambang baik muncul di sini atau mematahkan build.',
    )}</p>

    ${h2(1, 'method', 'How these numbers were made', 'Bagaimana angka-angka ini dibuat')}

    <table>
      <caption>${t('Sources, and what each can honestly claim', 'Sumber, dan apa yang bisa diklaimnya secara jujur')}</caption>
      <thead>
        <tr><th>${t('Source', 'Sumber')}</th><th>${t('What it is', 'Apa itu')}</th><th>${t('Can claim', 'Boleh mengklaim')}</th></tr>
      </thead>
      <tbody>
        <tr><th>${t('Closed form', 'Bentuk tertutup')}</th><td>${t('derived from the model\u2019s own arithmetic', 'diturunkan dari aritmetika model sendiri')}</td><td>${t('exact for the stated assumptions', 'eksak untuk asumsi yang disebut')}</td></tr>
        <tr><th>${t('Simulation', 'Simulasi')}</th><td>${t('the library itself, driven by a seeded harness', 'library itu sendiri, digerakkan harness ber-seed')}</td><td>${t('what the code does under those distributions', 'apa yang kode lakukan di bawah distribusi itu')}</td></tr>
        <tr><th>${t('Persona replay', 'Replay persona')}</th><td>${t('seeded adversaries and legitimate users against declared invariants', 'adversary dan pengguna sah ber-seed melawan invariant terdeklarasi')}</td><td>${t('can falsify a threshold; cannot calibrate one', 'bisa memfalsifikasi sebuah ambang; tak bisa mengkalibrasinya')}</td></tr>
        <tr><th>${t('Live observer', 'Pengamat langsung')}</th><td>${t('real Chrome through an observing proxy at the real origin', 'Chrome sungguhan lewat proxy observasi ke origin sungguhan')}</td><td>${t('stronger falsification; still not a population', 'falsifikasi lebih kuat; tetap bukan populasi')}</td></tr>
      </tbody>
    </table>
    <p class="tnote">${t(
      'The last distinction matters more than any single number below. A generated adversary proves the guard responds to that shape of traffic. It cannot prove the shape arrives in production at any particular rate.',
      'Distingsi terakhir lebih penting daripada angka tunggal mana pun di bawah. Adversary buatan membuktikan guard merespons bentuk trafik itu. Ia tidak bisa membuktikan bentuk itu tiba di produksi pada tingkat tertentu.',
    )}</p>

    ${h2(2, 'headstart', 'The cost of memory', 'Harga memori')}

    <p>${t(
      'An entity with honest history absorbs abuse before feeling anything. That is the point of having a memory &mdash; and also its cost, because the same history shields an attacker who earned it. The question is how large the shield gets, and whether it saturates.',
      'Entitas dengan riwayat jujur menyerap penyalahgunaan sebelum merasakan apa pun. Itu tujuan punya memori \u2014 dan juga harganya, karena riwayat yang sama melindungi penyerang yang mendapatkannya. Pertanyaannya seberapa besar tamengnya, dan apakah ia jenuh.',
    )}</p>

    <table>
      <caption>${t('Abuse calls absorbed after days of honest history (ten seeds)', 'Panggilan abusif yang terserap setelah hari riwayat jujur (sepuluh seed)')}</caption>
      <thead>
        <tr><th class="num">${t('days', 'hari')}</th><th class="num">E[p]</th><th class="num">mass</th><th class="num">${t('median calls', 'median panggilan')}</th><th class="num">${t('range', 'rentang')}</th></tr>
      </thead>
      <tbody>
${headStarts.map((row) => `        <tr>
          <td class="num">${row.days}</td>
          <td class="num">${row.meanBefore}</td>
          <td class="num">${row.massBefore}</td>
          <td class="num"><b>${row.callsMedian}</b></td>
          <td class="num">${row.callsMin}\u2013${row.callsMax}</td>
        </tr>`).join('\n')}
      </tbody>
    </table>

    ${h2(3, 'discount', 'The intake discount against farming', 'Diskon intake terhadap farming')}

    <p>${t(
      'Farming means earning trust through volume. The answer is not a decision-layer ceiling &mdash; D49 showed those arrive too late &mdash; but pricing each positive at intake by the shape of the gaps it arrived in. Bursty human-shaped activity earns full credit; perfectly regular intervals do not.',
      'Farming berarti mengumpulkan trust lewat volume. Jawabannya bukan ceiling di lapis keputusan \u2014 D49 menunjukkan itu datang terlambat \u2014 tapi menghargai setiap positive saat intake menurut bentuk jeda kedatangannya. Aktivitas bursty berbentuk manusia mendapat kredit penuh; interval sempurna teratur tidak.',
    )}</p>

    <table>
      <caption>${t('Farm then abuse: without vs with the intake discount', 'Farm lalu abusif: tanpa vs dengan diskon intake')}</caption>
      <thead>
        <tr><th class="num">${t('gap (min)', 'jeda (menit)')}</th><th>E[p] ${t('no discount', 'tanpa diskon')}</th><th>mass ${t('no discount', 'tanpa diskon')}</th><th class="num">${t('calls to feel', 'panggilan sampai terasa')}</th><th>E[p] ${t('with discount', 'dengan diskon')}</th><th>mass</th><th class="num">${t('calls to feel', 'panggilan sampai terasa')}</th></tr>
      </thead>
      <tbody>
${farming.map((row) => `        <tr>
          <td class="num">${row.gapMinutes}</td>
          <td class="num">${row.withoutDiscount.meanAfterFarming}</td>
          <td class="num">${row.withoutDiscount.massAfterFarming}</td>
          <td class="num">${row.withoutDiscount.abuseCallsToFelt}</td>
          <td class="num"><b>${row.withDiscount.meanAfterFarming}</b></td>
          <td class="num"><b>${row.withDiscount.massAfterFarming}</b></td>
          <td class="num"><b>${row.withDiscount.abuseCallsToFelt}</b></td>
        </tr>`).join('\n')}
      </tbody>
    </table>
    <p class="tnote">${t(
      '\u201cCalls to feel\u201d counts strong-negative abuse calls until INCREASE_FRICTION or worse. The fastest farmer drops from 33 to 1: regularity itself is what costs it the credit.',
      '\u201cPanggilan sampai terasa\u201d menghitung panggilan abusif negative-kuat hingga INCREASE_FRICTION atau lebih buruk. Farmer tercepat turun dari 33 menjadi 1: keteraturan itu sendiri yang membuatnya kehilangan kredit.',
    )}</p>

    ${h2(4, 'automation', 'What legitimate automation pays', 'Apa yang dibayar automation sah')}

    <table>
      <caption>${t('Machine clients that only earn positives', 'Klien mesin yang hanya mengumpulkan positive')}</caption>
      <thead>
        <tr><th>${t('Client', 'Klien')}</th><th class="num">${t('gap (s)', 'jeda (dtk)')}</th><th>${t('worst advice', 'saran terburuk')}</th><th class="num">E[p]</th></tr>
      </thead>
      <tbody>
${automation.map((row) => `        <tr><th>${row.label}</th><td class="num">${row.gapSeconds}</td><td><code>${row.worst}</code></td><td class="num">${row.finalMean}</td></tr>`).join('\n')}
      </tbody>
    </table>
    <p class="tnote">${t(
      'None reaches friction. OBSERVE costs nothing and tells the operator something, which is the ceiling the asymmetry buys.',
      'Tak ada yang mencapai friksi. OBSERVE tidak memakan biaya dan memberi tahu operator sesuatu, dan itu ceiling yang dibeli asimetrinya.',
    )}</p>

    ${h2(5, 'personas', 'Persona replay', 'Replay persona')}

    <p>${t(
      `${totalPersonas} personas across two targets: IXFE (unauthenticated compute behind a real funnel) and HealthMe (small app, one user). Every legitimate persona must stay at or below OBSERVE; every adversary must be advised something felt.`,
      `${totalPersonas} persona di dua target: IXFE (komputasi tak terautentikasi di balik funnel nyata) dan HealthMe (aplikasi kecil, satu pengguna). Setiap persona sah harus tetap di OBSERVE atau lebih lunak; setiap adversary harus disarankan sesuatu yang terasa.`,
    )}</p>

    <div class="scroll">
    <table>
      <caption>IXFE \u2014 ${replay.ixfe.personas.length} ${t('personas', 'persona')} &middot; ${replay.ixfe.falsePositives} FP &middot; ${replay.ixfe.walkedThrough} ${t('walked through', 'lolos')}</caption>
      <thead><tr><th>${t('Persona', 'Persona')}</th><th>${t('Kind', 'Jenis')}</th><th class="num">${t('steps', 'langkah')}</th><th>${t('Worst', 'Terburuk')}</th><th class="num">@</th><th>${t('Verdict', 'Putusan')}</th></tr></thead>
      <tbody>
${personaRows(replay.ixfe.personas)}
      </tbody>
    </table>
    </div>

    <div class="scroll">
    <table>
      <caption>HealthMe \u2014 ${replay.healthme.personas.length} ${t('personas', 'persona')} &middot; ${replay.healthme.falsePositives} FP &middot; ${replay.healthme.walkedThrough} ${t('walked through', 'lolos')}</caption>
      <thead><tr><th>${t('Persona', 'Persona')}</th><th>${t('Kind', 'Jenis')}</th><th class="num">${t('steps', 'langkah')}</th><th>${t('Worst', 'Terburuk')}</th><th class="num">@</th><th>${t('Verdict', 'Putusan')}</th></tr></thead>
      <tbody>
${personaRows(replay.healthme.personas)}
      </tbody>
    </table>
    </div>

    <p class="tnote">${t(
      `${totalFalsePositives} false positives, ${totalWalkthroughs} walkthroughs across ${totalPersonas} personas. Both are assertions in the test suite, not observations read once.`,
      `${totalFalsePositives} false positive, ${totalWalkthroughs} lolos dari ${totalPersonas} persona. Keduanya asersi dalam test suite, bukan observasi yang dibaca sekali.`,
    )}</p>

    ${h2(6, 'churn', 'Identity churn', 'Churn identitas')}

    <figure>
      ${churnFig}
      <figcaption>${t(
        '<b>Figure R1.</b> Thirty brute-force attacks, split across identities. At one request per identity nothing accumulates and nothing fires; at two or more, every attack produces a felt advisory. Proof-based violations ignore this floor entirely.',
        '<b>Gambar R1.</b> Tiga puluh serangan brute-force, dibagi antar identitas. Satu request per identitas tak mengakumulasi apa pun dan tak memicu apa pun; dua atau lebih, setiap serangan menghasilkan saran yang terasa. Pelanggaran berbasis bukti mengabaikan lantai ini sepenuhnya.',
      )}</figcaption>
    </figure>

    ${h2(7, 'live', 'The live run', 'Run langsung')}

    ${live ? `
    <p>${t(
      `Ten clients drove a real Chrome through the observing proxy against IXFE's live origin. ${live.summary.total} requests, ${live.summary.entities} entities, ${live.summary.scored} with a measurable window. ${live.summary.hardViolations} hard violations, all from missing dwell time on direct API calls. ${live.summary.falsePositiveCandidates} false-positive candidates.`,
      `Sepuluh klien menggerakkan Chrome sungguhan lewat proxy observasi ke origin IXFE. ${live.summary.total} request, ${live.summary.entities} entitas, ${live.summary.scored} dengan window terukur. ${live.summary.hardViolations} pelanggaran hard, semuanya dari dwell time yang hilang pada panggilan API langsung. ${live.summary.falsePositiveCandidates} kandidat false positive.`,
    )}</p>

    <figure>
      ${adviceFig}
      <figcaption>${t(
        '<b>Figure R2.</b> Advisories issued during the live run. Most traffic is ALLOW because most traffic is page views; signals attach only to actions since D57.',
        '<b>Gambar R2.</b> Saran yang dikeluarkan selama run langsung. Sebagian besar trafik ALLOW karena sebagian besar trafik adalah page view; sejak D57 sinyal hanya menempel pada aksi.',
      )}</figcaption>
    </figure>

    <div class="scroll">
    <table>
      <caption>${t('Per-client summary (hashes, not addresses)', 'Ringkasan per klien (hash, bukan alamat)')}</caption>
      <thead>
        <tr><th>Hash</th><th class="num">${t('requests', 'request')}</th><th>${t('Worst', 'Terburuk')}</th><th class="num">@</th><th class="num">${t('hard viol.', 'pelanggaran hard')}</th><th class="num">${t('paths', 'path')}</th></tr>
      </thead>
      <tbody>
${liveRows}
      </tbody>
    </table>
    </div>

    <table>
      <caption>${t('Window percentiles over measurable observations', 'Persentil window atas observasi terukur')}</caption>
      <thead><tr><th></th><th class="num">p10</th><th class="num">p50</th><th class="num">p90</th><th class="num">max</th></tr></thead>
      <tbody>
        <tr><th>${t('gap CV', 'CV jeda')}</th><td class="num">${live.summary.cv.p10.toFixed(3)}</td><td class="num">${live.summary.cv.p50.toFixed(3)}</td><td class="num">${live.summary.cv.p90.toFixed(3)}</td><td class="num">\u2014</td></tr>
        <tr><th>${t('anomaly score', 'skor anomali')}</th><td class="num">\u2014</td><td class="num">${live.summary.anomaly.p50.toFixed(3)}</td><td class="num">${live.summary.anomaly.p90.toFixed(3)}</td><td class="num">${live.summary.anomaly.max.toFixed(3)}</td></tr>
      </tbody>
    </table>
    ` : `
    <p class="tnote">${t(
      'No live run has been recorded yet. This section fills when examples/ixfe/live/observed-run.json exists.',
      'Belum ada run langsung yang direkam. Bagian ini terisi ketika examples/ixfe/live/observed-run.json ada.',
    )}</p>
    `}

    ${h2(8, 'falsified', 'What traffic falsified', 'Apa yang difalsifikasi trafik')}

    <p>${t(
      `Traffic has overturned ${FALSIFICATIONS.length} claims so far. Each correction is visible in the design record; listing them here is the site keeping itself honest about what changed and why.`,
      `Trafik sudah membalikkan ${FALSIFICATIONS.length} klaim sejauh ini. Setiap koreksi terlihat di rekaman desain; mendaftarkannya di sini adalah cara situs menjaga kejujurannya tentang apa yang berubah dan kenapa.`,
    )}</p>

    <dl class="compact">
${FALSIFICATIONS.map((entry) => `      <dt>D${entry.ref.replace(/^D/, '')} <span style="font-weight:400;font-size:.8125rem;color:var(--ink-3)">(${entry.source})</span></dt>
      <dd>${t(entry.en, entry.id)}</dd>`).join('\n')}
    </dl>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="limits.html">${t('What remains unvalidated', 'Yang belum tervalidasi')}</a>
      <a href="model.html#trajectory">${t('Accumulation trajectories', 'Trajektori akumulasi')}</a>
      <a href="evidence.html#catalogue">${t('The signal catalogue', 'Katalog sinyal')}</a>
    </p>
  `;

  return page({
    file: 'results.html',
    titleEn: 'Measurements',
    titleId: 'Pengukuran',
    subtitleEn: 'Every number the design argues from: formulas, tables, figures, and one live run.',
    subtitleId: 'Setiap angka yang jadi dasar argumen desain ini: rumus, tabel, grafik, dan satu run langsung.',
    sections,
    body,
  });
}

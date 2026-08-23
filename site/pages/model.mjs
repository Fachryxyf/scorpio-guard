import { lineChart, stepChart } from '../charts.mjs';
import { h2, page, t } from '../layout.mjs';

export function model(data) {
  const { parameters, prior, singleObservation, decayCurve, trajectories } = data;
  const bands = parameters.trustBands;

  const sections = [
    { id: 'entity', en: 'The entity', id_: 'Entitasnya' },
    { id: 'distribution', en: 'Trust as a distribution', id_: 'Trust sebagai distribusi' },
    { id: 'evidence', en: 'What one observation is worth', id_: 'Nilai satu observasi' },
    { id: 'decay', en: 'Decay, and the bound it implies', id_: 'Decay, dan batas yang ia bawa' },
    { id: 'spectrum', en: 'The decision spectrum', id_: 'Spektrum keputusannya' },
    { id: 'ceilings', en: 'Three ceilings', id_: 'Tiga ceiling' },
    { id: 'trajectory', en: 'What accumulation looks like', id_: 'Bentuk akumulasinya' },
  ];

  const decayFig = lineChart({
    title: 'Decay factor over 72 hours',
    domain: [0, 72],
    range: [0, 1],
    xLabel: 'hours elapsed',
    yLabel: 'λ',
    xTicks: [0, 12, 24, 36, 48, 60, 72].map((at) => ({ at, label: String(at) })),
    yTicks: [0, 0.25, 0.5, 0.75, 1].map((at) => ({ at, label: at.toFixed(2) })),
    series: [
      {
        points: decayCurve.map((point) => [point.hours, point.factor]),
        label: '2^(−Δt/H)',
      },
    ],
  });

  const trustFig = lineChart({
    title: 'Trust mean over twenty interactions',
    domain: [1, 20],
    range: [0, 1],
    xLabel: 'interaction n',
    yLabel: 'E[p]',
    xTicks: [1, 5, 10, 15, 20].map((at) => ({ at, label: String(at) })),
    yTicks: [0, 0.2, 0.4, 0.6, 0.8, 1].map((at) => ({ at, label: at.toFixed(1) })),
    bands: bands
      .map((band, index) => ({
        from: band.atLeast,
        to: index === 0 ? 1 : bands[index - 1].atLeast,
        label: band.band,
        opacity: index % 2 === 0 ? 0.45 : 0,
      }))
      .filter((band) => band.to > band.from),
    series: trajectories.map((run) => ({
      points: run.points.map((point) => [point.n, point.mean]),
      label: run.label === 'regular-positive' ? 'regular +' : run.label,
      dash: run.label === 'adversary' ? '5 3' : run.label === 'regular-positive' ? '2 3' : null,
      marks: true,
      hollow: run.label !== 'honest',
    })),
  });

  const rungs = parameters.decisions;
  const stepFig = stepChart({
    title: 'Advice over twenty interactions',
    domain: [1, 20],
    rungs,
    xLabel: 'interaction n',
    xTicks: [1, 5, 10, 15, 20].map((at) => ({ at, label: String(at) })),
    series: trajectories.map((run) => ({
      points: run.points.map((point) => [point.n, rungs.indexOf(point.decision)]),
      label: run.label === 'regular-positive' ? 'regular +' : run.label,
      dash: run.label === 'adversary' ? '5 3' : run.label === 'regular-positive' ? '2 3' : null,
    })),
  });

  const body = `
    <p class="lead">${t(
      'The model has four dimensions and one output. This chapter is the arithmetic: what state is held per entity, how an observation changes it, how it fades, and how a distribution becomes advice. Every number quoted here is generated from the code that implements it.',
      'Modelnya punya empat dimensi dan satu keluaran. Bab ini adalah aritmetikanya: state apa yang disimpan per entitas, bagaimana sebuah observasi mengubahnya, bagaimana ia memudar, dan bagaimana sebuah distribusi menjadi saran. Setiap angka di sini dihasilkan dari kode yang mengimplementasikannya.',
    )}</p>

    ${h2(1, 'entity', 'The entity', 'Entitasnya')}

    <p>${t(
      'The unit of reference is an <b>entity</b>, and the library never decides what one is. The host supplies an opaque key &mdash; a session id, an account id, a salted hash of whatever it considers stable &mdash; and the guard holds one state per key. That is deliberate: choosing the key is choosing who you are willing to be wrong about, and the host is the only party that can make that choice legitimately.',
      'Unit rujukannya adalah <b>entity</b>, dan library ini tidak pernah menentukan apa itu. Host memberi kunci opaque &mdash; id sesi, id akun, hash bersalt dari apa pun yang dianggapnya stabil &mdash; dan guard menyimpan satu state per kunci. Itu disengaja: memilih kuncinya berarti memilih tentang siapa kamu bersedia salah, dan host adalah satu-satunya pihak yang bisa membuat pilihan itu secara sah.',
    )}</p>

    <p>${t(
      'One state per entity, not per entity-and-endpoint. Splitting it per endpoint would make an attacker\u2019s first request to every endpoint free, which is the opposite of accumulation.',
      'Satu state per entitas, bukan per entitas-dan-endpoint. Memecahnya per endpoint akan membuat request pertama penyerang ke setiap endpoint jadi gratis, yang justru kebalikan dari akumulasi.',
    )}</p>

    <p>${t(
      'The root of trust is outside the library. Scorpio Guard cannot verify that a key means what the host thinks it means; it measures behavior <i>attributed</i> to a key. A host that hands it a forgeable key gets measurements of a forgeable key.',
      'Akar kepercayaannya di luar library. Scorpio Guard tidak bisa memverifikasi bahwa sebuah kunci berarti seperti yang host pikirkan; ia mengukur perilaku yang <i>diatribusikan</i> ke sebuah kunci. Host yang memberi kunci yang bisa dipalsukan akan mendapat pengukuran atas kunci yang bisa dipalsukan.',
    )}</p>

    ${h2(2, 'distribution', 'Trust as a distribution, not a number', 'Trust sebagai distribusi, bukan angka')}

    <p>${t(
      'Trust is stored as a Beta distribution and read as two numbers. A single scalar cannot distinguish <i>this party has behaved well fifty times</i> from <i>this party has never been seen</i>, and those two demand opposite treatments.',
      'Trust disimpan sebagai distribusi Beta dan dibaca sebagai dua angka. Satu skalar tidak bisa membedakan <i>pihak ini sudah berperilaku baik lima puluh kali</i> dari <i>pihak ini belum pernah terlihat</i>, dan keduanya menuntut perlakuan yang berlawanan.',
    )}</p>

    <div class="eq"><span class="eq-n">(1)</span>
      p ~ Beta(α, β),&nbsp;&nbsp; α = 1 + a,&nbsp;&nbsp; β = 1 + b<br>
      E[p] = α / (α + β)<br>
      Var[p] = αβ / ((α + β)² (α + β + 1))<br>
      n = α + β
      <span class="where">${t(
        '<b>a</b>, <b>b</b> accumulated positive and negative evidence mass. The Beta(1,1) prior is <i>structural</i> and sits outside them, so a fresh entity is exactly (0, 0) and reads as exactly flat. <b>n</b> is evidence mass, which is how the model knows whether it knows anything.',
        '<b>a</b>, <b>b</b> massa evidence positif dan negatif yang terakumulasi. Prior Beta(1,1) bersifat <i>struktural</i> dan berada di luar keduanya, jadi entitas baru tepat (0, 0) dan terbaca tepat rata. <b>n</b> adalah massa evidence, yaitu cara model tahu apakah ia tahu apa-apa.',
      )}</span>
    </div>

    <p>${t(
      'A fresh entity therefore reads <code>E[p] = ' + prior.mean + '</code>, <code>Var[p] = 1/12 = ' + prior.variance +
        '</code>, <code>n = ' + prior.mass +
        '</code>. Note what the mean does <i>not</i> say: 0.5 is not mild suspicion, it is the absence of information. The model distinguishes those through <code>n</code>, and the decision layer refuses to act on a mean until <code>n</code> justifies reading it.',
      'Karena itu entitas baru terbaca <code>E[p] = ' + prior.mean + '</code>, <code>Var[p] = 1/12 = ' + prior.variance +
        '</code>, <code>n = ' + prior.mass +
        '</code>. Perhatikan apa yang <i>tidak</i> dikatakan mean-nya: 0,5 bukan kecurigaan ringan, melainkan ketiadaan informasi. Model membedakan keduanya lewat <code>n</code>, dan lapis keputusan menolak bertindak atas sebuah mean sampai <code>n</code> membuatnya layak dibaca.',
    )}</p>

    ${h2(3, 'evidence', 'What one observation is worth', 'Nilai satu observasi')}

    <table>
      <caption>${t('A fresh entity, after exactly one observation', 'Entitas baru, setelah tepat satu observasi')}</caption>
      <thead>
        <tr>
          <th>${t('Observation', 'Observasi')}</th>
          <th class="num">${t('mass', 'massa')}</th>
          <th class="num">E[p]</th>
          <th class="num">Var[p]</th>
          <th class="num">n</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>${t('nothing yet (the prior)', 'belum ada (prior-nya)')}</th>
          <td class="num">&mdash;</td>
          <td class="num">${prior.mean}</td>
          <td class="num">${prior.variance}</td>
          <td class="num">${prior.mass}</td>
        </tr>
${singleObservation
  .map((row) => {
    const mass =
      row.label === 'one weak positive' || row.label === 'one weak negative'
        ? parameters.weights.weak
        : row.label === 'every weak signal at once'
          ? parameters.signalMassCap
          : parameters.weights.strong;
    return `        <tr>
          <th>${row.label}</th>
          <td class="num">${mass}</td>
          <td class="num">${row.mean}</td>
          <td class="num">${row.variance}</td>
          <td class="num">${row.mass}</td>
        </tr>`;
  })
  .join('\n')}
      </tbody>
    </table>
    <p class="tnote">${t(
      'Weights are symmetric and ' +
        parameters.weights.strong / parameters.weights.weak +
        ':1 strong to weak. Symmetry is a claim: nothing is learned faster in the punishing direction than in the forgiving one. The last row is the guarantee that measurement cannot manufacture a verdict &mdash; an interaction that trips <i>every</i> signal in the catalogue contributes ' +
        parameters.signalMassCap +
        ', which leaves n = ' +
        (prior.mass + parameters.signalMassCap) +
        ', still inside the stage where the trust dimension asks for nothing.',
      'Bobotnya simetris dan ' +
        parameters.weights.strong / parameters.weights.weak +
        ':1 antara strong dan weak. Simetri itu sebuah klaim: tak ada yang dipelajari lebih cepat ke arah menghukum daripada ke arah memaafkan. Baris terakhir adalah jaminan bahwa pengukuran tak bisa memproduksi putusan &mdash; interaksi yang memicu <i>semua</i> sinyal di katalog menyumbang ' +
        parameters.signalMassCap +
        ', yang menyisakan n = ' +
        (prior.mass + parameters.signalMassCap) +
        ', masih di dalam tahap di mana dimensi trust tidak menuntut apa pun.',
    )}</p>

    ${h2(4, 'decay', 'Decay, and the bound it implies', 'Decay, dan batas yang ia bawa')}

    <p>${t(
      'Evidence loses weight over <i>real elapsed time</i>, on a half-life. Not over a request count, because a party that goes quiet for a week has not been vouched for by its silence, and not on a fixed window, because a window has an edge that an attacker can wait behind.',
      'Evidence kehilangan bobot seiring <i>waktu nyata yang berlalu</i>, dengan half-life. Bukan berdasarkan hitungan request, karena pihak yang diam seminggu tidak dijamin oleh kediamannya, dan bukan dengan window tetap, karena window punya tepi yang bisa ditunggui penyerang.',
    )}</p>

    <div class="eq"><span class="eq-n">(2)</span>
      λ(Δt) = 2<sup>−Δt/H</sup>,&nbsp;&nbsp; H = ${parameters.halfLifeHours}h
      <span class="where">${t(
        'Composable: λ(Δt₁ + Δt₂) = λ(Δt₁)·λ(Δt₂). That is why decaying once across a whole gap is exact rather than an approximation, and why the store needs no timer.',
        'Bisa dikomposisi: λ(Δt₁ + Δt₂) = λ(Δt₁)·λ(Δt₂). Itu sebabnya melakukan decay sekali untuk seluruh jeda bersifat eksak, bukan aproksimasi, dan sebabnya store tidak butuh timer.',
      )}</span>
    </div>

    <figure>
      ${decayFig}
      <figcaption>${t(
        '<b>Figure 1.</b> The decay factor. At H = ' +
          parameters.halfLifeHours +
          'h a day-old observation is worth half of a fresh one, and a three-day-old observation ' +
          decayCurve[72].factor +
          ' of it. Retention is a separate boundary: state with no meaningful update for ' +
          parameters.retentionHours +
          'h is deleted outright rather than decayed towards zero.',
        '<b>Gambar 1.</b> Faktor decay-nya. Pada H = ' +
          parameters.halfLifeHours +
          'j, observasi berumur sehari bernilai setengah dari yang baru, dan yang berumur tiga hari ' +
          decayCurve[72].factor +
          ' darinya. Retensi adalah batas terpisah: state tanpa pembaruan berarti selama ' +
          parameters.retentionHours +
          'j dihapus langsung, bukan didecay menuju nol.',
      )}</figcaption>
    </figure>

    <p>${t(
      'Evidence is applied <i>decay-then-add</i>, and the order is load-bearing. It bounds accumulated mass for a party arriving at a steady interval, where add-then-decay-on-read would let it grow without limit &mdash; which is what would make trust farmable by patience alone.',
      'Evidence diterapkan <i>decay-lalu-tambah</i>, dan urutannya menentukan. Itu membatasi massa terakumulasi untuk pihak yang datang pada interval tetap, sementara tambah-lalu-decay-saat-dibaca akan membuatnya tumbuh tanpa batas &mdash; yang justru membuat trust bisa di-farming hanya dengan kesabaran.',
    )}</p>

    <div class="eq"><span class="eq-n">(3)</span>
      m<sub>∞</sub> = w / (1 − λ(T))
      <span class="where">${t(
        '<b>w</b> mass per arrival, <b>T</b> the interval between arrivals. Verified against the code rather than asserted: the table below simulates 500 arrivals and compares.',
        '<b>w</b> massa per kedatangan, <b>T</b> jeda antar kedatangan. Diverifikasi terhadap kodenya, bukan sekadar dinyatakan: tabel di bawah menyimulasikan 500 kedatangan lalu membandingkannya.',
      )}</span>
    </div>

    <table>
      <caption>${t('Mass ceiling for weak positives at a steady interval', 'Batas massa untuk weak positive pada interval tetap')}</caption>
      <thead>
        <tr>
          <th class="num">T</th>
          <th class="num">λ(T)</th>
          <th class="num">${t('closed form', 'bentuk tertutup')}</th>
          <th class="num">${t('simulated, 500 arrivals', 'simulasi, 500 kedatangan')}</th>
          <th class="num">${t('ceiling E[p]', 'E[p] di batas')}</th>
        </tr>
      </thead>
      <tbody>
${data.massBound
  .map(
    (row) => `        <tr>
          <td class="num">${row.intervalHours}h</td>
          <td class="num">${row.lambda}</td>
          <td class="num">${row.closedForm}</td>
          <td class="num">${row.simulated}</td>
          <td class="num">${row.ceilingMean}</td>
        </tr>`,
  )
  .join('\n')}
      </tbody>
    </table>
    <p class="tnote">${t(
      'Closed form and simulation agree to three decimals at every interval, which is the only reason the formula is published here. A closed form that does not match the code it describes is worse than no closed form.',
      'Bentuk tertutup dan simulasinya sepakat hingga tiga desimal di setiap interval, dan itu satu-satunya alasan rumusnya dipublikasikan di sini. Bentuk tertutup yang tidak cocok dengan kode yang ia gambarkan lebih buruk daripada tidak ada bentuk tertutup.',
    )}</p>

    ${h2(5, 'spectrum', 'The decision spectrum', 'Spektrum keputusannya')}

    <p>${t(
      'The output is one of five rungs. Not a boolean, because a boolean forces every uncertain case into one of two wrong answers, and the interesting cases are all uncertain.',
      'Keluarannya salah satu dari lima tingkat. Bukan boolean, karena boolean memaksa setiap kasus tak pasti ke salah satu dari dua jawaban yang salah, dan kasus-kasus menariknya semua tak pasti.',
    )}</p>

    <dl class="compact">
      <dt>ALLOW</dt><dd>${t('Proceed. The default, and where a legitimate visitor should live permanently.', 'Lanjut. Default-nya, dan tempat pengunjung yang sah semestinya tinggal permanen.')}</dd>
      <dt>OBSERVE</dt><dd>${t('Proceed, and record. Costs the user nothing and tells the host something &mdash; the only rung that influences without intervening.', 'Lanjut, dan catat. Tidak memakan biaya pengguna dan memberi tahu host sesuatu &mdash; satu-satunya tingkat yang memengaruhi tanpa mengintervensi.')}</dd>
      <dt>INCREASE_FRICTION</dt><dd>${t('The first rung a real user would <i>feel</i>. It is therefore both the false-positive line and the line at which abuse starts to cost something &mdash; one threshold, read from two sides.', 'Tingkat pertama yang benar-benar <i>terasa</i> oleh pengguna nyata. Karena itu ia sekaligus garis false positive dan garis di mana penyalahgunaan mulai memakan biaya &mdash; satu ambang, dibaca dari dua sisi.')}</dd>
      <dt>RESTRICT</dt><dd>${t('Withhold the expensive or dangerous part, serve the rest.', 'Tahan bagian yang mahal atau berbahaya, layani sisanya.')}</dd>
      <dt>BLOCK</dt><dd>${t('Refuse. Advice only &mdash; the library has no mechanism to enforce it and is not entitled to one.', 'Tolak. Hanya saran &mdash; library ini tak punya mekanisme untuk menegakkannya dan tidak berhak atasnya.')}</dd>
    </dl>

    <table>
      <caption>${t('Trust bands over E[p], and what each proposes', 'Band trust atas E[p], dan apa yang diusulkan masing-masing')}</caption>
      <thead>
        <tr>
          <th>${t('Band', 'Band')}</th>
          <th class="num">${t('E[p] at least', 'E[p] minimal')}</th>
          <th>${t('Proposes', 'Mengusulkan')}</th>
        </tr>
      </thead>
      <tbody>
${bands
  .map((band, index) => {
    const proposes = ['ALLOW', 'OBSERVE', 'INCREASE_FRICTION', 'RESTRICT', 'BLOCK'][index];
    return `        <tr><th>${band.band}</th><td class="num">${band.atLeast}</td><td><code>${proposes}</code></td></tr>`;
  })
  .join('\n')}
      </tbody>
    </table>
    <p class="tnote">${t(
      'Each band is read at its <i>least</i> interventionist rung, because a ceiling can only lower a decision &mdash; starting at the gentler end is what leaves the ceilings able to express themselves at all.',
      'Setiap band dibaca pada tingkat yang <i>paling sedikit</i> mengintervensi, karena ceiling hanya bisa menurunkan keputusan &mdash; memulai dari ujung yang lebih lunak itulah yang membuat ceiling masih bisa berbicara.',
    )}</p>

    ${h2(6, 'ceilings', 'Three ceilings, and the lowest binds', 'Tiga ceiling, dan yang terendah yang mengikat')}

    <p>${t(
      'What the band proposes is not what the guard advises. Three independent ceilings apply, and the lowest wins.',
      'Apa yang diusulkan band bukanlah apa yang disarankan guard. Tiga ceiling independen berlaku, dan yang terendah menang.',
    )}</p>

    <table>
      <caption>${t('The epistemic stage: has enough arrived to read the mean at all', 'Tahap epistemik: sudah cukupkah yang datang untuk membaca mean-nya')}</caption>
      <thead>
        <tr><th>${t('Stage', 'Tahap')}</th><th class="num">n ${t('at least', 'minimal')}</th><th>${t('Permits at most', 'Maksimal memperbolehkan')}</th></tr>
      </thead>
      <tbody>
        <tr><th>unknown</th><td class="num">0</td><td><code>ALLOW</code></td></tr>
        <tr><th>developing</th><td class="num">${parameters.epistemicStages.find((s) => s.stage === 'developing').atLeast}</td><td><code>OBSERVE</code></td></tr>
        <tr><th>established</th><td class="num">${parameters.epistemicStages.find((s) => s.stage === 'established').atLeast}</td><td><code>BLOCK</code></td></tr>
      </tbody>
    </table>
    <p class="tnote">${t(
      'An unknown entity contributes nothing: with no evidence, the trust dimension has no standing to ask for anything. It does not force <code>ALLOW</code> either &mdash; a proven violation still reaches the decision layer on its own authority. The <code>developing</code> ceiling was <code>INCREASE_FRICTION</code> until generated traffic gave two mistyped PINs and an autofilled password manager exactly that; see the Results chapter.',
      'Entitas unknown tidak menyumbang apa pun: tanpa evidence, dimensi trust tak berhak menuntut apa pun. Ia juga tidak memaksa <code>ALLOW</code> &mdash; pelanggaran yang terbukti tetap sampai ke lapis keputusan atas otoritasnya sendiri. Ceiling <code>developing</code> dulunya <code>INCREASE_FRICTION</code> sampai trafik buatan memberikan tepat itu pada dua PIN salah ketik dan satu password manager yang autofill; lihat bab Hasil.',
    )}</p>

    <table>
      <caption>${t('Uncertainty: is the distribution tight enough to act on', 'Uncertainty: cukup rapatkah distribusinya untuk ditindaki')}</caption>
      <thead>
        <tr><th>${t('Level', 'Tingkat')}</th><th class="num">Var[p] ${t('at most', 'maksimal')}</th><th>${t('Permits at most', 'Maksimal memperbolehkan')}</th></tr>
      </thead>
      <tbody>
${parameters.uncertaintyBands
  .map((band) => {
    const permits = band.level === 'low' ? 'BLOCK' : 'INCREASE_FRICTION';
    return `        <tr><th>${band.level}</th><td class="num">${band.atMost === null ? '&infin;' : band.atMost}</td><td><code>${permits}</code></td></tr>`;
  })
  .join('\n')}
      </tbody>
    </table>

    <p>${t(
      'The third ceiling is <b>anomaly concurrence</b>, and it exists because low variance is cheap to fake: uniform, high-volume traffic drives variance down while proving almost nothing. So low uncertainty only unlocks the full ceiling if observed behavior was varied enough to believe it. When it is not, escalation is withheld at <code>INCREASE_FRICTION</code>.',
      'Ceiling ketiga adalah <b>concurrence anomali</b>, dan ia ada karena variance rendah murah untuk dipalsukan: trafik seragam bervolume tinggi menekan variance turun sambil membuktikan hampir tak ada apa-apa. Jadi uncertainty rendah hanya membuka ceiling penuh kalau perilaku yang terobservasi cukup bervariasi untuk dipercaya. Kalau tidak, eskalasi ditahan di <code>INCREASE_FRICTION</code>.',
    )}</p>

    <p>${t(
      'That rule has a consequence the project records rather than hides: it protects a broken-but-legitimate client &mdash; a cron with a stale token, retrying uniformly &mdash; from <code>BLOCK</code>, which is the central constraint working. It also leaves a deliberate bot at <code>INCREASE_FRICTION</code> instead of <code>RESTRICT</code>, <i>because</i> behaving mechanically is what withholds the escalation. Which effect dominates is a question about real populations, so the behavior is left alone and the claim it was introduced under has been withdrawn.',
      'Aturan itu punya konsekuensi yang proyek ini catat, bukan sembunyikan: ia melindungi klien yang rusak-tapi-sah &mdash; cron dengan token kedaluwarsa yang mencoba ulang secara seragam &mdash; dari <code>BLOCK</code>, dan itu constraint utamanya bekerja. Ia juga meninggalkan bot yang sengaja di <code>INCREASE_FRICTION</code> alih-alih <code>RESTRICT</code>, <i>karena</i> berperilaku mekanis itulah yang menahan eskalasinya. Efek mana yang dominan adalah pertanyaan tentang populasi nyata, jadi perilakunya dibiarkan dan klaim yang menyertainya ditarik.',
    )}</p>

    ${h2(7, 'trajectory', 'What accumulation actually looks like', 'Bentuk akumulasinya sebenarnya')}

    <figure>
      ${trustFig}
      <figcaption>${t(
        '<b>Figure 2.</b> Three parties over twenty interactions. <i>honest</i> earns weak positives across three scopes with bursty gaps; <i>adversary</i> earns weak negatives in one scope; <i>regular +</i> earns the same positives as <i>honest</i> but at a perfectly regular interval. The gap between <i>honest</i> and <i>regular +</i> is the intake discount, drawn rather than asserted: a positive is priced by the shape of the gaps it arrived in. Shaded strips are the trust bands.',
        '<b>Gambar 2.</b> Tiga pihak selama dua puluh interaksi. <i>honest</i> mendapat weak positive di tiga scope dengan jeda bursty; <i>adversary</i> mendapat weak negative di satu scope; <i>regular +</i> mendapat positive yang sama dengan <i>honest</i> tapi pada interval yang sempurna teratur. Jarak antara <i>honest</i> dan <i>regular +</i> adalah diskon intake, digambar alih-alih dinyatakan: sebuah positive dihargai menurut bentuk jeda kedatangannya. Strip berbayang adalah band trust.',
      )}</figcaption>
    </figure>

    <figure>
      ${stepFig}
      <figcaption>${t(
        '<b>Figure 3.</b> The same three parties, as advice. The staircase is the point: nothing is smooth, because the output is a rung. The adversary crosses into <code>INCREASE_FRICTION</code> at interaction ' +
          (data.firstReached.find((run) => run.label === 'adversary').firstReached.INCREASE_FRICTION ?? '\u2014') +
          ', and neither positive-earning party ever leaves the gentle end.',
        '<b>Gambar 3.</b> Tiga pihak yang sama, sebagai saran. Bentuk tangganya itulah intinya: tak ada yang mulus, karena keluarannya adalah tingkat. Adversary-nya menyeberang ke <code>INCREASE_FRICTION</code> pada interaksi ' +
          (data.firstReached.find((run) => run.label === 'adversary').firstReached.INCREASE_FRICTION ?? '\u2014') +
          ', dan tak satu pun pihak yang mengumpulkan positive pernah meninggalkan ujung yang lunak.',
      )}</figcaption>
    </figure>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="evidence.html">${t('Proof and measurement', 'Bukti dan pengukuran')}</a>
      <a href="results.html">${t('Measurements', 'Pengukuran')}</a>
      <a href="usage.html#policy">${t('Every tunable value', 'Semua nilai yang bisa disetel')}</a>
      <a href="limits.html">${t('What is not known', 'Yang belum diketahui')}</a>
    </p>
  `;

  return page({
    file: 'model.html',
    titleEn: 'The trust model',
    titleId: 'Model trust',
    subtitleEn: 'Beta-Bernoulli state, decay as a half-life, five rungs of advice, and the three ceilings that keep a tight distribution from being trusted too readily.',
    subtitleId: 'State Beta-Bernoulli, decay sebagai half-life, lima tingkat saran, dan tiga ceiling yang menahan distribusi rapat agar tidak terlalu cepat dipercaya.',
    sections,
    body,
  });
}

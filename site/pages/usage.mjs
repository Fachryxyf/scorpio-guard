import { h2, page, t } from '../layout.mjs';

export function usage(data) {
  const { parameters, testCount } = data;
  const sections = [
    { id: 'install', en: 'Install', id_: 'Pasang' },
    { id: 'quickstart', en: 'Quickstart', id_: 'Mulai cepat' },
    { id: 'invariants', en: 'Declare an invariant', id_: 'Deklarasikan invariant' },
    { id: 'signals', en: 'Report a signal', id_: 'Laporkan sinyal' },
    { id: 'stores', en: 'Durable state', id_: 'State tahan restart' },
    { id: 'policy', en: 'Every tunable number', id_: 'Semua angka yang bisa disetel' },
    { id: 'recipes', en: 'Recipes', id_: 'Resep' },
  ];

  const policyRows = [
    ['halfLifeHours', parameters.halfLifeHours, t('How fast the past stops counting. Shorter forgives faster and forgets earned trust faster.', 'Seberapa cepat masa lalu berhenti dihitung. Lebih pendek memaafkan lebih cepat dan melupakan trust lebih cepat.')],
    ['retentionHours', parameters.retentionHours, t('When state is deleted outright. Also the purge path with the horizon forced to zero.', 'Kapan state dihapus sama sekali. Juga jalur purge dengan horizon dipaksa nol.')],
    ['weights.weak / .strong', `${parameters.weights.weak} / ${parameters.weights.strong}`, t('How much one observation moves the distribution. Symmetric on purpose.', 'Seberapa jauh satu observasi menggeser distribusi. Simetris dengan sengaja.')],
    ['softViolationWeight', parameters.softViolationWeight, t('What a soft violation weighs. Strong, not faint: the host declared this should not happen.', 'Bobot pelanggaran soft. Kuat, bukan samar: host menyatakan ini seharusnya tidak terjadi.')],
    ['windowSize', parameters.windowSize, t('Observations retained for anomaly features. Bounded on purpose.', 'Observasi yang disimpan untuk fitur anomali. Dibatasi dengan sengaja.')],
    ['signalMassCap', parameters.signalMassCap, t('The most all weak signals of one interaction may contribute — one weak observation\u2019s worth.', 'Batas sumbangan semua weak signal dalam satu interaksi \u2014 setara satu observasi lemah.')],
  ];

  const body = `
    <p class="lead">${t(
      'Install it, declare what is impossible in your own flow, evaluate each interaction, and read the trace. Start observational: the guard advises; it never acts.',
      'Pasang, deklarasikan apa yang mustahil di alurmu sendiri, evaluasi tiap interaksi, lalu baca jejaknya. Mulai secara observasional: guard memberi saran; ia tidak pernah bertindak.',
    )}</p>

    ${h2(1, 'install', 'Install', 'Pasang')}

    <pre>npm install @fachryxyf/scorpio-guard@0.1.0</pre>

    <p class="tnote">${t(
      'Pin the exact version rather than a caret range. No threshold in this library is calibrated, so a minor bump can change advisory behavior and <code>^0.1.0</code> would pull that in silently. Installing from source also works: <code>npm install github:Fachryxyf/scorpio-guard</code>.',
      'Patok versi tepat alih-alih rentang caret. Tak ada ambang di library ini yang terkalibrasi, jadi kenaikan minor bisa mengubah perilaku saran dan <code>^0.1.0</code> akan menariknya diam-diam. Memasang dari sumber juga bisa: <code>npm install github:Fachryxyf/scorpio-guard</code>.',
    )}</p>

    <table>
      <caption>${t('Requirements and entry points', 'Kebutuhan dan titik masuk')}</caption>
      <thead><tr><th></th><th></th></tr></thead>
      <tbody>
        <tr><th>npm</th><td><code>@fachryxyf/scorpio-guard</code> &middot; 0.1.0 &middot; MIT</td></tr>
        <tr><th>Node</th><td>&ge; 22.6 &middot; ESM &middot; ${t('zero runtime dependencies', 'tanpa dependensi runtime')}</td></tr>
        <tr><th>.</th><td>${t('the model', 'modelnya')}</td></tr>
        <tr><th>./collect</th><td>${t('the browser collector', 'collector peramban')}</td></tr>
        <tr><th>./sqlite</th><td>${t('durable store over node:sqlite, one host', 'store tahan restart di atas node:sqlite, satu host')}</td></tr>
        <tr><th>./kv</th><td>${t('networked store over HTTP, for serverless — unreleased', 'store jaringan lewat HTTP, untuk serverless — belum dirilis')}</td></tr>
      </tbody>
    </table>

    ${h2(2, 'quickstart', 'Quickstart', 'Mulai cepat')}

<pre>import { createGuard } from '@fachryxyf/scorpio-guard';

const guard = createGuard({ invariants: [checkoutOrder] });

const result = await guard.evaluate({
  entity: sessionId,
  observation: {
    scope: 'checkout',
    data: { from: 'cart', to: 'payment' },
  },
});

result.decision;     // 'RESTRICT' — advice, never enforcement
result.trust.stage;  // 'unknown' | 'developing' | 'established'
result.hardViolated; // true when a proof decided it
result.coldStart;    // true when no retained state existed
result.trace;        // why, in the order that decided it</pre>

    ${h2(3, 'invariants', 'Declare an invariant', 'Deklarasikan invariant')}

    <p>${t(
      'Declaring <code>hard</code> asserts two things at once: violations are deterministic, and your edge set is <i>complete</i> for that scope. If you cannot enumerate the legitimate set honestly, declare <code>soft</code> \u2014 evidence rather than proof.',
      'Mendeklarasikan <code>hard</code> menegaskan dua hal sekaligus: pelanggarannya deterministik, dan himpunan edge-mu <i>lengkap</i> untuk scope itu. Kalau kamu tak bisa mendaftar himpunan yang sah dengan jujur, deklarasikan <code>soft</code> \u2014 evidence, bukan bukti.',
    )}</p>

<pre>import { transitionGraph } from '@fachryxyf/scorpio-guard';

const checkoutOrder = transitionGraph({
  id: 'checkout-order',
  scope: 'checkout',
  strength: 'hard',
  allowed: [
    { from: 'cart', to: 'address' },
    { from: 'address', to: 'payment' },
  ],
});</pre>

    ${h2(4, 'signals', 'Report a signal', 'Laporkan sinyal')}

    <p>${t(
      'Signals go by catalogue id and become negative evidence \u2014 nothing more. Unknown ids are ignored, not treated as suspicious, so a host cannot widen the vocabulary by inventing tokens.',
      'Sinyal dikirim lewat id katalog dan menjadi evidence negatif \u2014 tidak lebih. ID yang tak dikenal diabaikan, bukan dianggap mencurigakan, jadi host tak bisa melebarkan kosakata dengan mengarang token.',
    )}</p>

<pre>import { WEAK_SIGNALS } from '@fachryxyf/scorpio-guard';

await guard.evaluate({
  entity: sessionId,
  observation: { signals: ['SIG_UNIFORM_DELAY_SHAPE'] },
});</pre>

    ${h2(5, 'stores', 'Durable state', 'State tahan restart')}

<pre>import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';

const guard = createGuard({ store: sqliteStore({ path: './trust.db' }) });</pre>

    <p>${t(
      'Still zero dependencies: node:sqlite is standard library. Treat that file as personal data, because that is what it holds.',
      'Tetap tanpa dependensi: node:sqlite ada di pustaka standar. Perlakukan file itu sebagai data pribadi, karena memang isinya begitu.',
    )}</p>

    <h3>${t('On serverless, use the networked store', 'Di serverless, pakai store jaringan')}</h3>

    <p class="tnote">${t(
      '<b>Unreleased.</b> This ships in 0.2.0, which is on <code>main</code> and not yet on npm. Install from source to use it: <code>npm install github:Fachryxyf/scorpio-guard</code>.',
      '<b>Belum dirilis.</b> Ini ada di 0.2.0, yang sudah di <code>main</code> tapi belum di npm. Pasang dari sumber untuk memakainya: <code>npm install github:Fachryxyf/scorpio-guard</code>.',
    )}</p>

    <p>${t(
      'A serverless filesystem is as ephemeral as the process on it, so neither store above survives a cold start &mdash; which is exactly what stopped the trust model from ever accumulating in production (D59). The KV store talks HTTP through <code>fetch</code>, so there is still nothing to install.',
      'Filesystem serverless sama sementaranya dengan prosesnya, jadi kedua store di atas tak bertahan melewati cold start &mdash; dan itu tepat yang menghentikan model trust dari pernah berakumulasi di produksi (D59). Store KV bicara HTTP lewat <code>fetch</code>, jadi tetap tak ada yang perlu dipasang.',
    )}</p>

<pre>import { kvStore, upstashTransport } from '@fachryxyf/scorpio-guard/kv';

const guard = createGuard({
  store: kvStore({
    transport: upstashTransport({
      url: process.env.KV_URL,
      token: process.env.KV_TOKEN,
    }),
    onError: (error, op) =&gt; log.warn({ error, op }, 'trust store degraded'),
  }),
});</pre>

    <p class="tnote">${t(
      'A transport failure reads as a cold start rather than throwing, because the guard is advisory and a KV outage must not take your request path down with it. Pass <code>onError</code> so you find out: a store silently failing open looks exactly like one that works. Prove any store you write with <code>checkStoreConformance</code> before trusting it.',
      'Kegagalan transport terbaca sebagai cold start alih-alih melempar error, karena guard bersifat saran dan gangguan KV tak boleh menjatuhkan jalur request-mu. Berikan <code>onError</code> supaya kamu tahu: store yang diam-diam fail-open tampak persis seperti yang bekerja. Buktikan store apa pun yang kamu tulis dengan <code>checkStoreConformance</code> sebelum mempercayainya.',
    )}</p>

    <p>${t(
      'Deleting one entity is one call:',
      'Menghapus satu entitas cukup satu panggilan:',
    )}</p>

    <pre>await guard.forget(entity);</pre>

    ${h2(6, 'policy', 'Every tunable number', 'Semua angka yang bisa disetel')}

    <table>
      <caption>${t('Defaults, generated from source', 'Default, dibangkitkan dari kode sumber')}</caption>
      <thead><tr><th>${t('Value', 'Nilai')}</th><th class="num">${t('Default', 'Bawaan')}</th><th>${t('Changing it means', 'Mengubahnya berarti')}</th></tr></thead>
      <tbody>
${policyRows.map(([name, value, meaning]) => `        <tr><th><code>${name}</code></th><td class="num">${value}</td><td>${meaning}</td></tr>`).join('\n')}
      </tbody>
    </table>
    <p class="tnote">${t(
      'Every default is locked by a test that names the decision behind it. Revising one is visible, not silent drift.',
      'Setiap default dipaku oleh test yang menyebut keputusan di belakangnya. Merevisinya terlihat, bukan pergeseran diam-diam.',
    )}</p>

    ${h2(7, 'recipes', 'Recipes', 'Resep')}

    <dl class="compact">
      <dt>${t('Run observationally', 'Jalankan observasional')}</dt>
      <dd>${t(`Log advised vs actual alongside the trace. Decide later whether to wire it to behavior.`, `Catat saran vs yang dilakukan bersama jejaknya. Putuskan nanti apakah disambungkan ke perilaku.`)}</dd>
      <dt>Honour a deletion request</dt>
      <dd><code>guard.forget(entity)</code> \u2014 ${t('same code path retention uses, horizon forced to zero.', 'jalur kode yang sama dipakai retensi, horizon dipaksa nol.')}</dd>
      <dt>${t('Collect interaction in the browser', 'Kumpulkan interaksi di peramban')}</dt>
      <dd><code>watchInteraction(element)</code> \u2192 counts events, never values. Call <code>stop()</code> on unmount.</dd>
      <dt>${t('Survive more than one process', 'Bertahan lebih dari satu proses')}</dt>
      <dd>${t('The durable store covers restart durability and multi-process sharing on one host. Multi-host still needs a networked store behind the same three methods.', 'Store tahan restart menutup ketahanan restart dan berbagi antar proses di satu host. Multi-host masih butuh store jaringan di belakang tiga metode yang sama.')}</dd>
    </dl>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="results.html">${t('Measurements', 'Pengukuran')}</a>
      <a href="evidence.html#catalogue">${t('Signal catalogue', 'Katalog sinyal')}</a>
      <a href="record.html#glossary">${t('Glossary', 'Glosarium')}</a>
      <a href="https://github.com/Fachryxyf/scorpio-guard/issues">${t('Report a false positive', 'Laporkan false positive')}</a>
    </p>
  `;

  return page({
    file: 'usage.html',
    titleEn: 'Using the library',
    titleId: 'Memakai library-nya',
    subtitleEn: 'Install, evaluate, read a trace, declare an invariant, write a store, tune a policy.',
    subtitleId: 'Pasang, evaluasi, baca trace, deklarasikan invariant, tulis store, setel policy.',
    sections,
    body,
  });
}

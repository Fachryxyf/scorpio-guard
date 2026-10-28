import { h2, page, t } from '../layout.mjs';

export function usage(data) {
  const { parameters, testCount } = data;
  const stageAt = (name) =>
    parameters.epistemicStages.find((entry) => entry.stage === name)?.atLeast ?? 'n/a';

  const sections = [
    { id: 'install', en: 'Install', id_: 'Pasang' },
    { id: 'quickstart', en: 'Quickstart', id_: 'Mulai cepat' },
    { id: 'decisions', en: 'What to do with the advice', id_: 'Apa yang dilakukan dengan saran' },
    { id: 'invariants', en: 'Declare an invariant', id_: 'Deklarasikan invariant' },
    { id: 'signals', en: 'Signals, and the bridge from the browser', id_: 'Sinyal, dan jembatan dari browser' },
    { id: 'policy', en: 'Every tunable number', id_: 'Semua angka yang bisa disetel' },
    { id: 'stores', en: 'Where the state lives', id_: 'Di mana state disimpan' },
    { id: 'recipes', en: 'Recipes', id_: 'Resep' },
  ];

  const policyRows = [
    ['policy.halfLifeHours', parameters.halfLifeHours, t('Hours for half of the evidence mass to decay.', 'Jam sampai separuh massa bukti meluruh.')],
    ['policy.retentionHours', parameters.retentionHours, t('When state is deleted. Deleted, not hidden.', 'Kapan state dihapus. Dihapus, bukan disembunyikan.')],
    ['policy.weights', parameters.weights.weak + ' / ' + parameters.weights.strong, t('Mass of one weak observation, and of one strong one.', 'Massa satu observasi lemah, dan satu observasi kuat.')],
    ['policy.softViolationWeight', parameters.softViolationWeight, t('Mass one soft violation contributes.', 'Massa yang disumbang satu pelanggaran soft.')],
    ['policy.developingAt / policy.establishedAt', stageAt('developing') + ' / ' + stageAt('established'), t('Evidence mass where the epistemic stage moves.', 'Massa bukti saat tahap epistemiknya berpindah.')],
    ['policy.hardViolationDecision', 'RESTRICT', t('The rung a proven violation asks for, unless the ceiling is lower.', 'Tingkat yang diminta pelanggaran terbukti, kecuali plafonnya lebih rendah.')],
    ['windowSize', parameters.windowSize, t('Observations kept for the behavior features.', 'Observasi yang disimpan untuk fitur perilaku.')],
    ['diversity', parameters.diversity.minObservations + ' obs, ' + parameters.diversity.minDistinctScopes + ' scopes', t('When low variance is believable at all.', 'Kapan variansi rendah bisa dipercaya.')],
    ['velocity', parameters.velocity.maxObsPerHour + ' per hour', t('The burst threshold.', 'Ambang ledakan permintaan.')],
    ['signalMassCap', parameters.signalMassCap, t('Not settable. It is weights.weak, so no pile of signals outvotes one host declaration.', 'Tidak bisa disetel. Nilainya weights.weak, supaya tumpukan sinyal tidak mengalahkan satu deklarasi host.')],
  ];

  const classes = [
    ['IMPOSSIBLE_SEGMENT_JUMP', 'reachability', t('A jump inside a flow that skips a declared step.', 'Lompatan di dalam alur yang melewati langkah yang dideklarasikan.')],
    ['IMPOSSIBLE_STATE_TRANSITION', 'reachability', t('An edge your state machine does not have.', 'Sisi yang tidak ada di state machine Anda.')],
    ['IMPOSSIBLE_IDLE_ACTION', 'causality', t('An action with no interaction that could have produced it.', 'Aksi tanpa interaksi yang bisa menghasilkannya.')],
    ['IMPOSSIBLE_TEMPORAL_ORDER', 'order', t('B before A, or faster than the clock you recorded allows.', 'B sebelum A, atau lebih cepat dari yang clock Anda catat.')],
    ['IMPOSSIBLE_ACTION_PREREQUISITE', 'precondition', t('An action whose precondition your records say was never met.', 'Aksi yang prasyaratnya, menurut catatan Anda, tak pernah terpenuhi.')],
    ['IMPOSSIBLE_UNISSUED_REFERENCE', 'issuance', t('A token or id your system never handed out.', 'Token atau id yang tak pernah diterbitkan sistem Anda.')],
    ['IMPOSSIBLE_EXCLUSIVE_STATE', 'exclusivity', t('Two facts that cannot both be true, both true.', 'Dua fakta yang tak bisa benar bersamaan, sama-sama benar.')],
  ];

  const catalogue = [
    ['SIG_SUBHUMAN_LATENCY', 'timing', 'notable', t('collector or host', 'collector atau host'), t('autofill, a password manager, a paste, real keyboard fluency', 'autofill, password manager, tempel, atau jari yang memang cepat')],
    ['SIG_UNIFORM_DELAY_SHAPE', 'timing', 'pronounced', t('derived from the window', 'diturunkan dari jendela'), t('a polling widget, a fixed-interval sync', 'widget polling, sinkronisasi berinterval tetap')],
    ['SIG_OFF_WINDOW_ACCESS', 'timing', 'faint', t('collector or host', 'collector atau host'), t('travel, shift work, insomnia', 'perjalanan, kerja shift, susah tidur')],
    ['SIG_REPEATED_PATTERN', 'repetition', 'notable', t('derived from the window', 'diturunkan dari jendela'), t('one routine task, a single-purpose page', 'satu tugas rutin, halaman satu fungsi')],
    ['SIG_IMMEDIATE_REPEAT', 'repetition', 'faint', t('derived from the window', 'diturunkan dari jendela'), t('a retry after a failure, an impatient refresh', 'mencoba ulang setelah gagal, refresh karena tak sabar')],
    ['SIG_UNINTERACTED_INPUT', 'interaction', 'pronounced', t('browser collector', 'collector browser'), t('assistive technology, autofill, a browser with no interaction API', 'teknologi bantu, autofill, browser tanpa API interaksi')],
    ['SIG_UNUSUAL_SEQUENCE', 'sequence', 'notable', t('browser collector', 'collector browser'), t('a first visit to a real feature', 'kunjungan pertama ke fitur yang memang ada')],
    ['SIG_BREADTH_OF_TARGET', 'target', 'notable', t('collector or host', 'collector atau host'), t('legitimate research, a shared exit address', 'riset yang wajar, satu alamat keluar bersama')],
    ['SIG_SENSITIVE_TARGET', 'target', 'faint', t('host', 'host'), t('the endpoint exists to be used', 'endpoint itu memang untuk dipakai')],
    ['SIG_ENVIRONMENT_MISMATCH', 'environment', 'faint', t('browser collector', 'collector browser'), t('privacy tooling, an unusual browser, a managed device', 'alat privasi, browser tak biasa, perangkat kantor')],
  ];

  const body = `
    <p class="lead">${t(
      'This page is the whole integration: one file that runs, what to do with each advice value, how the browser collector reaches the server, where every number is set, and four recipes you can paste. The samples marked as run were executed against the 0.2.0 tarball from the registry on 2026-10-28, and the output shown is that run output, not a sketch.',
      'Halaman ini memuat integrasi utuh: satu file yang langsung jalan, apa yang harus dilakukan pada setiap nilai saran, bagaimana collector di browser sampai ke server, di mana setiap angka disetel, dan empat resep yang bisa ditempel. Contoh yang ditandai sudah dijalankan dieksekusi terhadap tarball 0.2.0 dari registry pada 2026-10-28, dan keluaran yang ditampilkan adalah keluaran run itu, bukan sketsa.',
    )}</p>

    ${h2(1, 'install', 'Install', 'Pasang')}

    <pre>npm install @fachryxyf/scorpio-guard
npm install @fachryxyf/scorpio-guard@0.2.1   # pin what you tested</pre>

    <p>${t(
      '<code>0.2.1</code> is what the registry served on 2026-10-28, a documentation-only patch over 0.2.0. This page is generated from the repository, so it cannot promise what the registry serves tomorrow: the <a href="versions.html">versions page</a> holds that record. Pin the exact version, not a caret range. No threshold here is calibrated against a real population, so a minor bump may move advice, and <code>^0.2.1</code> would pull that in silently.',
      '<code>0.2.1</code> adalah versi yang dilayani registry pada 2026-10-28, patch khusus dokumentasi di atas 0.2.0. Halaman ini dibangkitkan dari repositori, jadi ia tidak bisa menjanjikan apa yang dilayani registry besok: <a href="versions.html">halaman versi</a> yang memegang catatan itu. Patok versi tepat, bukan rentang caret. Tak ada ambang di sini yang terkalibrasi terhadap populasi nyata, jadi kenaikan minor bisa menggeser saran, dan <code>^0.2.1</code> akan menariknya diam-diam.',
    )}</p>

    <div class="scroll">
    <table>
      <caption>${t('What you are installing', 'Apa yang Anda pasang')}</caption>
      <thead><tr><th>${t('Item', 'Butir')}</th><th>${t('Value', 'Nilai')}</th></tr></thead>
      <tbody>
        <tr><th>Node</th><td>22.13 ${t('or newer, ESM only', 'atau lebih baru, hanya ESM')}</td></tr>
        <tr><th>${t('Runtime dependencies', 'Dependensi runtime')}</th><td>0 (D59)</td></tr>
        <tr><th>${t('Entry points', 'Titik masuk')}</th><td><code>.</code> ${t('the model', 'model')}, <code>./collect</code> ${t('browser collectors', 'collector browser')}, <code>./sqlite</code> ${t('durable store', 'store tahan restart')}, <code>./kv</code> ${t('networked store', 'store lewat jaringan')}</td></tr>
        <tr><th>${t('Provenance', 'Provenance')}</th><td>${t('0.2.0 carries a publish attestation and SLSA provenance, which <code>npm audit signatures</code> verifies in a clean install. 0.1.0 has neither and cannot gain it.', '0.2.0 membawa attestation publish dan provenance SLSA, yang diverifikasi <code>npm audit signatures</code> di instalasi bersih. 0.1.0 tidak punya keduanya dan tak bisa mendapatkannya.')}</td></tr>
        <tr><th>${t('Tests', 'Test')}</th><td>${testCount}</td></tr>
      </tbody>
    </table>
    </div>

    ${h2(2, 'quickstart', 'Quickstart', 'Mulai cepat')}

    <p>${t(
      'One file, top to bottom. Nothing used here is defined in a later section: the invariant, the entity key, the evaluation, and the reaction to the advice are all in this block. Save it as <code>quickstart.mjs</code> in a directory where the package is installed, then run <code>node quickstart.mjs</code>.',
      'Satu file, dari atas ke bawah. Tidak ada yang dipakai di sini didefinisikan di bagian berikutnya: invariant, kunci entitas, evaluasi, dan reaksi terhadap saran semuanya ada di blok ini. Simpan sebagai <code>quickstart.mjs</code> di direktori tempat paketnya terpasang, lalu jalankan <code>node quickstart.mjs</code>.',
    )}</p>

<pre>import { createGuard } from '@fachryxyf/scorpio-guard';

// 1. What is impossible in this flow. The host owns this list, not SG.
const steps = [
  { from: 'cart', to: 'address' },
  { from: 'address', to: 'payment' },
];

const checkoutOrder = {
  id: 'checkout-order',
  class: 'IMPOSSIBLE_STATE_TRANSITION',
  strength: 'hard',
  scope: 'checkout',
  // Called with observation.data. Return false when the transition is impossible.
  holds: (data) =&gt; steps.some((step) =&gt; step.from === data.from &amp;&amp; step.to === data.to),
};

// 2. One guard per process is enough. Its store is memory unless you pass one.
const guard = createGuard({ invariants: [checkoutOrder] });

// 3. The entity key belongs to the host. SG measures it, never issues or proves it.
const entity = 'session_9f2c';

// 4. Evaluate one interaction. Cart to payment skips the address step.
const result = await guard.evaluate({
  entity,
  observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
  context: { route: 'POST /checkout' },
});

// 5. The advice is a rung, not an action. This map is your policy, not SG's.
const status = {
  ALLOW: 200,
  OBSERVE: 200,
  INCREASE_FRICTION: 429,
  RESTRICT: 403,
  BLOCK: 403,
}[result.decision];

console.log('decision        ', result.decision, '-&gt; http', status);
console.log('hardViolated    ', result.hardViolated);
console.log('stage           ', result.trust.stage, '| band', result.trust.band);
console.log('trust.reason    ', result.trust.reason);
console.log('trace           ', result.trace);</pre>

    <p class="cap">${t('Run output, 0.2.0 from the registry, 2026-10-28 (0.2.1 is documentation only)', 'Keluaran run, 0.2.0 dari registry, 2026-10-28 (0.2.1 hanya dokumentasi)')}</p>

<pre>decision         RESTRICT -&gt; http 403
hardViolated     true
stage            unknown | band friction
trust.reason     unknown entity (n=2): lack of evidence is not evidence of distrust
trace            [
  'cold start: no retained state, prior is Beta(1,1)',
  'diversity undetermined: 1 observation(s), needs 8',
  'trust: unknown entity (n=2): lack of evidence is not evidence of distrust',
  'hard violation of checkout-order: advises RESTRICT, ceiling bypassed'
]</pre>

    <p>${t(
      'Three things in that output are worth reading twice. The stage is <code>unknown</code> although a rule was broken, because stage counts evidence mass and a proof is not evidence: the entity is new, and SG does not pretend to know it. The mass reads <code>n=2</code> because a hard violation weighs <code>weights.strong</code>. And <code>coldStart</code> is true, which says SG had nothing to go on, not that the entity is bad.',
      'Tiga hal di keluaran itu layak dibaca dua kali. Tahapnya <code>unknown</code> meski ada aturan yang dilanggar, karena tahap menghitung massa bukti dan bukti keras bukan bukti statistik: entitasnya baru, dan SG tidak berpura-pura mengenalnya. Massa terbaca <code>n=2</code> karena pelanggaran hard berbobot <code>weights.strong</code>. Dan <code>coldStart</code> bernilai true, yang berarti SG tidak punya apa pun untuk dijadikan dasar, bukan bahwa entitasnya buruk.',
    )}</p>

    ${h2(3, 'decisions', 'What to do with the advice', 'Apa yang dilakukan dengan saran')}

    <p>${t(
      'The library returns one of five strings. It never sends a status code, never opens a socket, and never throws because the news is bad: <code>evaluate</code> resolves with the advice and a trace. The mapping from a rung to an action is your policy. Keep it in one table in one file, so a reviewer can read it without opening yours.',
      'Library mengembalikan satu dari lima string. Ia tidak mengirim status code, tidak membuka socket, dan tidak melempar error karena beritanya buruk: <code>evaluate</code> selesai dengan saran dan trace. Pemetaan dari tingkat ke aksi adalah kebijakan Anda. Simpan di satu tabel di satu file, supaya peninjau bisa membacanya tanpa membuka file Anda.',
    )}</p>

    <div class="scroll">
    <table>
      <caption>${t('Five rungs, and what a host usually does with each', 'Lima tingkat, dan apa yang biasanya dilakukan host')}</caption>
      <thead><tr><th>${t('Advice', 'Saran')}</th><th>${t('What it claims', 'Apa yang diklaim')}</th><th>${t('A host action that fits', 'Aksi host yang cocok')}</th></tr></thead>
      <tbody>
        <tr><th>ALLOW</th><td>${t('Nothing counted against this entity, no proven violation.', 'Tidak ada yang dihitung memberatkan entitas ini, tak ada pelanggaran terbukti.')}</td><td>${t('Proceed as your application already would. This is not authentication.', 'Lanjut seperti aplikasi Anda biasa. Ini bukan autentikasi.')}</td></tr>
        <tr><th>OBSERVE</th><td>${t('Evidence leans low, not enough to act.', 'Bukti cenderung rendah, belum cukup untuk bertindak.')}</td><td>${t('Serve normally and record the event. No user-visible cost.', 'Layani normal dan catat event-nya. Tanpa beban terlihat bagi pengguna.')}</td></tr>
        <tr><th>INCREASE_FRICTION</th><td>${t('Enough accumulated evidence to add cost to this action.', 'Bukti terkumpul cukup untuk menambah biaya pada aksi ini.')}</td><td>${t('Rate-limit, add a challenge, re-verify something already known (an OTP, a password).', 'Batasi laju, tambah tantangan, verifikasi ulang sesuatu yang sudah diketahui (OTP, kata sandi).')}</td></tr>
        <tr><th>RESTRICT</th><td>${t('A proven violation, or evidence the ceiling allows refusing on.', 'Pelanggaran terbukti, atau bukti yang plafonnya mengizinkan penolakan.')}</td><td>${t('Refuse this action with 403. Keep the session for the flows you still allow.', 'Tolak aksi ini dengan 403. Biarkan sesinya untuk alur yang masih Anda izinkan.')}</td></tr>
        <tr><th>BLOCK</th><td>${t('The ceiling allows refusing everything for this entity.', 'Plafon mengizinkan penolakan untuk semua hal dari entitas ini.')}</td><td>${t('Refuse all actions for it and put it in front of a human.', 'Tolak semua aksinya dan bawa ke manusia.')}</td></tr>
      </tbody>
    </table>
    </div>

    <p>${t(
      'The table above is prose. This is the code, and the only place the status numbers appear:',
      'Tabel di atas masih prosa. Ini kodenya, dan satu-satunya tempat angka status muncul:',
    )}</p>

<pre>// One row per rung. SG never picks a row for you, and never acts on one.
const action = {
  ALLOW: { status: 200 },
  OBSERVE: { status: 200, headers: { 'x-guard': 'observe' } },
  INCREASE_FRICTION: { status: 429, headers: { 'retry-after': '2' } },
  RESTRICT: { status: 403 },
  BLOCK: { status: 403 },
};

const advice = action[result.decision];

if (advice.status !== 200) {
  response.set(advice.headers ?? {}).status(advice.status).json({
    error: 'refused',
    decision: result.decision,
    reason: result.trust.reason,
  });
  return;
}</pre>

    <p>${t(
      'Three fields make the decision reviewable later, and all three are on the result: <code>result.trust.capped</code> says the band wanted more than the ceiling allowed, <code>result.trust.proposed</code> says what the band wanted, and <code>result.hardViolated</code> says a proof rather than a probability decided it. A RESTRICT with <code>capped: false</code> came from the trust band. One with <code>hardViolated: true</code> came from your own declaration. They deserve different conversations.',
      'Tiga field membuat keputusan bisa ditinjau nanti, dan ketiganya ada di hasil: <code>result.trust.capped</code> menandakan band ingin lebih dari yang diizinkan plafon, <code>result.trust.proposed</code> menandakan apa yang band inginkan, dan <code>result.hardViolated</code> menandakan yang memutuskan adalah bukti, bukan probabilitas. RESTRICT dengan <code>capped: false</code> datang dari band trust. Yang <code>hardViolated: true</code> datang dari deklarasi Anda sendiri. Dua hal itu pantas dibicarakan berbeda.',
    )}</p>

    <p>${t(
      'Start observational: record <code>result.decision</code> next to what your existing defences actually did, wire nothing, and read the two columns a week later. <a href="https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/TESTING.md">docs/TESTING.md</a> has the checklist, including the two mistakes that make the results meaningless.',
      'Mulai dari observasi: catat <code>result.decision</code> di sebelah apa yang sebenarnya dilakukan pertahanan Anda, jangan sambungkan apa pun, lalu baca kedua kolom itu seminggu kemudian. <a href="https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/TESTING.md">docs/TESTING.md</a> memuat daftar periksanya, termasuk dua kesalahan yang membuat hasilnya tak berarti.',
    )}</p>

    ${h2(4, 'invariants', 'Declare an invariant', 'Deklarasikan invariant')}

    <p>${t(
      'An invariant is one claim about your own system that a violation would prove. It is a plain object: five fields, one function. SG never invents one for you and ships no catalogue of them, because only you hold the facts that make a violation provable.',
      'Invariant adalah satu klaim tentang sistem Anda sendiri yang pelanggarannya bisa dibuktikan. Bentuknya objek biasa: lima field, satu fungsi. SG tidak mengarangnya untuk Anda dan tidak mengirim katalognya, karena hanya Anda yang memegang fakta yang membuat pelanggaran bisa dibuktikan.',
    )}</p>

<pre>const invariant = {
  id: 'checkout-order',                 // yours; appears in the trace and the event
  class: 'IMPOSSIBLE_STATE_TRANSITION', // one of the seven below
  strength: 'hard',                     // proof, or evidence
  scope: 'checkout',                    // the completeness claim covers this scope only
  holds: (data) =&gt; true,                // false means: this happened, and it cannot have
};</pre>

    <div class="scroll">
    <table>
      <caption>${t('The seven classes, and the fact that proves each', 'Tujuh kelas, dan fakta yang membuktikan masing-masing')}</caption>
      <thead><tr><th>${t('Class', 'Kelas')}</th><th>${t('Proof source', 'Sumber bukti')}</th><th>${t('What it says', 'Isinya')}</th></tr></thead>
      <tbody>
        ${classes.map(([name, source, meaning]) => '<tr><th>' + name + '</th><td>' + source + '</td><td>' + meaning + '</td></tr>').join('\n        ')}
      </tbody>
    </table>
    </div>

    <p>${t(
      '<code>hard</code> is two claims at once: violations are deterministic, and the declaration is complete for its scope, so anything not declared legitimate inside that scope is provably wrong. <code>soft</code> claims only the first: it contributes evidence, never proof. If you cannot enumerate the allowed edges honestly, declare <code>soft</code>. A wrong <code>hard</code> is not a loose threshold, it is a false accusation with a trace attached.',
      '<code>hard</code> adalah dua klaim sekaligus: pelanggarannya deterministik, dan deklarasinya lengkap untuk scope-nya, jadi apa pun yang tidak dinyatakan sah di dalam scope itu terbukti salah. <code>soft</code> hanya mengklaim yang pertama: ia menyumbang bukti, bukan bukti keras. Kalau Anda tak bisa menyebutkan seluruh sisi yang sah dengan jujur, deklarasikan <code>soft</code>. <code>hard</code> yang salah bukan ambang yang longgar, itu tuduhan palsu dengan trace terlampir.',
    )}</p>

    <p>${t(
      'Two declarations do most of the work in practice. A transition graph, when you have an edge set:',
      'Dua bentuk deklarasi yang paling sering dipakai. Graf transisi, kalau Anda punya himpunan sisinya:',
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

    <p>${t(
      'And a predicate, when the fact lives in your own records. This one is <code>soft</code> on purpose: the host knows whether the client logged in, but not every read path passes through that check, so the declaration cannot claim completeness.',
      'Dan predikat, kalau faktanya ada di catatan Anda sendiri. Yang ini sengaja <code>soft</code>: host tahu kliennya sudah login atau belum, tapi tidak semua jalur baca melewati pemeriksaan itu, jadi deklarasinya tidak bisa mengklaim kelengkapan.',
    )}</p>

<pre>const readAfterLogin = {
  id: 'data-read-before-login',
  class: 'IMPOSSIBLE_TEMPORAL_ORDER',
  strength: 'soft',
  scope: 'data',
  holds: (data) =&gt; data.afterLogin !== false,
};</pre>

    <p>${t(
      'Scope gates everything. An observation whose scope has no invariant produces the trace line <code>scope "x" has no declared invariants: unknown, not forbidden</code> and no violation, which is D32 keeping a partial declaration from silently becoming a global one.',
      'Scope menggerbangi semuanya. Observasi yang scope-nya tidak punya invariant menghasilkan baris trace <code>scope "x" has no declared invariants: unknown, not forbidden</code> dan tanpa pelanggaran, itulah D32 yang mencegah deklarasi sebagian diam-diam menjadi global.',
    )}</p>

    ${h2(5, 'signals', 'Signals, and the bridge from the browser', 'Sinyal, dan jembatan dari browser')}

    <p>${t(
      'Signals are measurement, never proof. Ten ids exist, they arrive as <code>observation.signals</code>, and the mass they can add is capped at <code>weights.weak</code>, ' + parameters.signalMassCap + ' by default. Two things follow from the cap: an id SG does not know is ignored rather than guessed at, and stacking signals cannot outvote a declaration you made.',
      'Sinyal adalah pengukuran, bukan bukti. Ada sepuluh id, dikirim sebagai <code>observation.signals</code>, dan massa yang bisa mereka tambahkan dibatasi <code>weights.weak</code>, yaitu ' + parameters.signalMassCap + ' secara bawaan. Dua hal mengikuti batas itu: id yang tidak dikenal SG diabaikan bukan ditebak, dan menumpuk sinyal tidak bisa mengalahkan deklarasi yang Anda buat.',
    )}</p>

    <div class="scroll">
    <table>
      <caption>${t('The catalogue, from the source that decides mass', 'Katalog, dari sumber yang menentukan massa')}</caption>
      <thead><tr><th>Id</th><th>${t('Source', 'Sumber')}</th><th>${t('Weight', 'Bobot')}</th><th>${t('Arrives from', 'Datang dari')}</th><th>${t('Innocent cause it must survive', 'Sebab polos yang harus ia lewati')}</th></tr></thead>
      <tbody>
        ${catalogue.map(([id, source, weight, from, cause]) => '<tr><th>' + id + '</th><td>' + source + '</td><td>' + weight + '</td><td>' + from + '</td><td>' + cause + '</td></tr>').join('\n        ')}
      </tbody>
    </table>
    </div>

    <p>${t(
      'The four derived ids are computed from the retained window for the anomaly dimensions. They still only become negative mass if you pass the id: the feature space and the mass are separate on purpose (D42, D67). The other six come from <code>./collect</code> or straight from your own request handling.',
      'Empat id turunan dihitung dari jendela yang tersimpan untuk dimensi anomali. Ia tetap hanya menjadi massa negatif kalau Anda mengirim id-nya: ruang fitur dan massa memang dipisah (D42, D67). Enam sisanya datang dari <code>./collect</code> atau langsung dari penanganan permintaan Anda.',
    )}</p>

    <p>${t(
      'The bridge is HTTP, and you own it. The collector reports counts, never values: it can say a field saw four interactions and no injected input, and it cannot say what was typed, because it never reads it (D7). Browser side:',
      'Jembatannya HTTP, dan itu milik Anda. Collector melaporkan hitungan, bukan nilai: ia bisa bilang sebuah field melihat empat interaksi tanpa input yang disuntikkan, dan ia tidak bisa bilang apa yang diketik, karena ia tidak membacanya (D7). Sisi browser:',
    )}</p>

<pre>import { watchInteraction, toObservation } from '@fachryxyf/scorpio-guard/collect';

const field = document.querySelector('#card-number');
const collector = watchInteraction(field, { hasValue: () =&gt; field.value.length !== 0 });

// Read once, at submit: toObservation keeps four facts and drops the raw counters.
const interaction = toObservation(collector.counts());
collector.stop();

await fetch('/api/purchase', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ interaction }),
});</pre>

    <p>${t(
      'Server side, the collectors reduce to catalogue ids, and the ids join the observation. This is the whole bridge, and no raw traffic crosses it:',
      'Sisi server, collector mereduksi menjadi id katalog, lalu id-nya ikut ke observasi. Inilah seluruh jembatannya, dan tak ada lalu lintas mentah yang menyeberang:',
    )}</p>

<pre>import { createGuard } from '@fachryxyf/scorpio-guard';
import { collectSignalIds, measureLatency } from '@fachryxyf/scorpio-guard/collect';

const guard = createGuard({ invariants: [fieldWasTouched] });

const latency = measureLatency(Date.now() - 12, { floorMs: 50 });
const signals = collectSignalIds({ latency });

const result = await guard.evaluate({
  entity: sessionId,
  observation: {
    scope: 'purchase',
    data: { interaction: request.body.interaction },
    signals,
  },
  context: { route: 'POST /api/purchase' },
});

// signals: ['SIG_SUBHUMAN_LATENCY'] -- measured, capped, never a verdict on its own</pre>

    <p>${t(
      'If you want the catalogue in code, for a legend or an admin filter, read it instead of hardcoding strings. What adds mass is passing the ids, not importing the list:',
      'Kalau Anda ingin katalognya di kode, untuk legenda atau filter admin, bacalah dari katalognya alih-alih menulis string sendiri. Yang menambah massa adalah mengirim id-nya, bukan mengimpor daftarnya:',
    )}</p>

<pre>import { WEAK_SIGNALS } from '@fachryxyf/scorpio-guard';

for (const signal of WEAK_SIGNALS) {
  console.log(signal.id, signal.source, signal.weight, signal.innocentCause);
}</pre>

    ${h2(6, 'policy', 'Every tunable number', 'Semua angka yang bisa disetel')}

    <p>${t(
      'There are two places to set a number, and the split is deliberate. Anything that changes advice lives under <code>policy</code>. The knobs that shape what SG observes sit at the top level of <code>createGuard</code>. This table is generated from the defaults in the source, so it cannot drift from what the code does.',
      'Ada dua tempat untuk menyetel angka, dan pembagiannya disengaja. Apa pun yang mengubah saran ada di bawah <code>policy</code>. Tombol yang membentuk apa yang diamati SG ada di level teratas <code>createGuard</code>. Tabel ini dibangkitkan dari nilai bawaan di sumber, jadi ia tidak bisa melenceng dari yang dilakukan kode.',
    )}</p>

    <div class="scroll">
    <table>
      <caption>${t('Defaults, and the exact key each one lives under', 'Nilai bawaan, dan kunci persisnya')}</caption>
      <thead><tr><th>${t('Key', 'Kunci')}</th><th>${t('Default', 'Bawaan')}</th><th>${t('What it moves', 'Apa yang digeser')}</th></tr></thead>
      <tbody>
        ${policyRows.map(([name, value, what]) => '<tr><th><code>' + name + '</code></th><td>' + value + '</td><td>' + what + '</td></tr>').join('\n        ')}
      </tbody>
    </table>
    </div>

<pre>import { createGuard } from '@fachryxyf/scorpio-guard';

const guard = createGuard({
  invariants: [checkoutOrder],

  // Advice changes live here.
  policy: {
    halfLifeHours: 12,
    retentionHours: 48,
    weights: { weak: 0.5, strong: 2 },
    softViolationWeight: 2,
  },

  // Observation shape lives here.
  windowSize: 24,
  diversity: { minObservations: 8, minDistinctScopes: 2 },

  // Injection, for tests and for a store you own.
  store: sqliteStore({ path: './var/trust.db' }),

  onAssessment: (event) =&gt; journal.push(event),
});</pre>

    <p>${t(
      'A partial object is merged over the defaults, so you set only what you mean to change. Changing any of these changes the advice for the same input: write the policy you shipped next to the version you shipped, or a decision you cannot reproduce later becomes a mystery with no owner.',
      'Objek sebagian digabung di atas nilai bawaan, jadi setel hanya yang memang ingin diubah. Mengubah salah satunya mengubah saran untuk input yang sama: tulis kebijakan yang Anda kirim di sebelah versi yang Anda kirim, atau keputusan yang tak bisa direproduksi nanti menjadi misteri tanpa pemilik.',
    )}</p>

    ${h2(7, 'stores', 'Where the state lives', 'Di mana state disimpan')}

    <p>${t(
      'The default store is memory, inside the guard, per process. Two processes behind a load balancer do not share history unless you give them a store. Three are shipped, and they implement the same small interface: <code>get</code>, <code>set</code>, <code>delete</code>.',
      'Store bawaan adalah memori, di dalam guard, per proses. Dua proses di belakang load balancer tidak berbagi riwayat kecuali Anda memberi mereka store. Tersedia tiga, dan semuanya mengimplementasikan antarmuka kecil yang sama: <code>get</code>, <code>set</code>, <code>delete</code>.',
    )}</p>

<pre>import { createGuard, memoryStore, checkStoreConformance, assertConformant } from '@fachryxyf/scorpio-guard';
import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';

// Default: bounded by a cap and a retention horizon, swept as it writes.
const memory = memoryStore({ maxEntities: 100_000 });

// One host, one disk. No server to run, and state survives a restart.
const sqlite = sqliteStore({ path: './var/trust.db', table: 'sg_trust_state', retentionHours: 168 });

// Before you trust a store you wrote yourself:
assertConformant(await checkStoreConformance(() =&gt; sqliteStore({ path: ':memory:' })));</pre>

    <p>${t(
      '<code>sqliteStore</code> does not create the parent directory, so create <code>var/</code> first. Retention deletes rather than hides, which is what makes <code>guard.forget(entity)</code> a real erasure and not a flag.',
      '<code>sqliteStore</code> tidak membuat direktori induknya, jadi buat <code>var/</code> lebih dulu. Retensi menghapus, bukan menyembunyikan, dan itulah yang membuat <code>guard.forget(entity)</code> benar-benar menghapus, bukan memasang bendera.',
    )}</p>

    <p>${t(
      'The third store is for serverless, where there is no disk to keep state on. It needs a transport, and every evaluation then costs a network round trip:',
      'Store ketiga untuk serverless, tempat tak ada disk untuk menyimpan state. Ia butuh transport, dan setiap evaluasi lalu berbiaya satu perjalanan jaringan:',
    )}</p>

<pre>import { kvStore, upstashTransport } from '@fachryxyf/scorpio-guard/kv';

const store = kvStore({
  transport: upstashTransport({
    url: process.env.KV_URL,     // Upstash REST endpoint; Vercel KV exposes the same shape
    token: process.env.KV_TOKEN,
  }),
});</pre>

    <p>${t(
      'Be careful with this one. The soak runs cover the memory and sqlite stores; no deployment of this project has run <code>./kv</code> in production yet, and the <a href="limits.html">limits page</a> records what that means. If you have a disk, use the disk.',
      'Hati-hati dengan yang ini. Run soak mencakup store memori dan sqlite; belum ada deployment proyek ini yang menjalankan <code>./kv</code> di produksi, dan <a href="limits.html">halaman batas</a> mencatat artinya. Kalau Anda punya disk, pakai disk.',
    )}</p>

    ${h2(8, 'recipes', 'Recipes', 'Resep')}

    <p>${t(
      'Four complete files, not fragments. The first is the Express middleware, and it runs as shown: the output under it is what it printed against the published tarball.',
      'Empat file utuh, bukan potongan. Yang pertama adalah middleware Express, dan ia jalan seperti tertulis: keluaran di bawahnya adalah yang ia cetak terhadap tarball yang terbit.',
    )}</p>

    <p class="cap">${t('Recipe 1: Express, advisory wired to a response', 'Resep 1: Express, saran disambungkan ke respons')}</p>

<pre>import express from 'express';
import { createGuard } from '@fachryxyf/scorpio-guard';

// Same invariant as the quickstart, declared inline so this file stands alone.
const checkoutOrder = {
  id: 'checkout-order',
  class: 'IMPOSSIBLE_STATE_TRANSITION',
  strength: 'hard',
  scope: 'checkout',
  holds: (data) =&gt; data.from === 'cart' &amp;&amp; data.to === 'address'
    || data.from === 'address' &amp;&amp; data.to === 'payment',
};

const guard = createGuard({ invariants: [checkoutOrder] });

// Your policy, one row per rung. SG never picks a row for you.
const action = {
  ALLOW: { status: 200 },
  OBSERVE: { status: 200, headers: { 'x-guard': 'observe' } },
  INCREASE_FRICTION: { status: 429, headers: { 'retry-after': '2' } },
  RESTRICT: { status: 403 },
  BLOCK: { status: 403 },
};

const app = express();
app.use(express.json());

app.post('/checkout', async (request, response) =&gt; {
  const result = await guard.evaluate({
    entity: String(request.header('x-session') ?? 'anonymous'),
    observation: { scope: 'checkout', data: request.body },
    context: { route: 'POST /checkout' },
  });

  const advice = action[result.decision];
  if (advice.status !== 200) {
    response.set(advice.headers ?? {}).status(advice.status).json({
      error: 'refused',
      decision: result.decision,
      reason: result.trust.reason,
    });
    return;
  }
  response.set(advice.headers ?? {}).status(200).json({ ok: true, decision: result.decision });
});

app.listen(3000);</pre>

    <p class="cap">${t('Run output, two requests, same session', 'Keluaran run, dua permintaan, sesi sama')}</p>

<pre>cart to address =&gt; 200 { ok: true, decision: 'ALLOW' }
cart to payment =&gt; 403 {
  error: 'refused',
  decision: 'RESTRICT',
  reason: 'unknown entity (n=2): lack of evidence is not evidence of distrust'
}</pre>

    <p class="cap">${t('Recipe 2: React, a collector whose cleanup actually stops it', 'Resep 2: React, collector yang pembersihannya benar-benar menghentikannya')}</p>

<pre>import { useEffect, useRef } from 'react';
import { watchInteraction, toObservation } from '@fachryxyf/scorpio-guard/collect';

export function useInteraction(ref) {
  const collector = useRef(null);

  useEffect(() =&gt; {
    const element = ref.current;
    if (!element) return undefined;

    collector.current = watchInteraction(element, { hasValue: () =&gt; element.value.length !== 0 });

    return () =&gt; {
      collector.current?.stop();
      collector.current = null;
    };
  }, [ref]);

  // Call on submit. Returns null once the component is unmounted.
  return () =&gt; (collector.current ? toObservation(collector.current.counts()) : null);
}</pre>

    <p>${t(
      'This is the only block on the page a machine did not run: it needs a DOM and a renderer. It is transcribed from the collector signatures in <code>src/collect/interaction.ts</code>, and the same calls are exercised by the collector tests.',
      'Ini satu-satunya blok di halaman ini yang tidak dijalankan mesin: ia butuh DOM dan renderer. Ia disalin dari tanda tangan collector di <code>src/collect/interaction.ts</code>, dan panggilan yang sama diuji oleh test collector.',
    )}</p>

    <p class="cap">${t('Recipe 3: a journal you own, and durable state', 'Resep 3: jurnal milik Anda, dan state yang tahan restart')}</p>

<pre>import { createGuard } from '@fachryxyf/scorpio-guard';
import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';

const store = sqliteStore({ path: './var/trust.db' });
const journal = [];

const guard = createGuard({
  store,
  onAssessment: (event) =&gt; {
    // Your table, your columns. SG sends the event, never the traffic.
    journal.push(event);
  },
});

await guard.evaluate({ entity: 'user_41', observation: { scope: 'api' } });

const event = journal.at(-1);
event.schemaVersion; // 1, bumped only when a field changes meaning
event.decision;      // the advice
event.trust;         // { mean, variance, mass, band, proposed, ceiling, capped }
event.violations;    // [] -- which invariant, which class, which strength
event.durationMs;    // measured, not inferred from the clock
event.entity;        // absent unless identity asks for a hash</pre>

    <p>${t(
      'The entity stays out of the event by default. If your collector needs a stable key on the other side, ask for a hash and hold the salt: <code>identity: { kind: \'hash\', salt: process.env.GUARD_SALT }</code>. SG never puts the raw reference in an event on its own.',
      'Entitas tidak ikut ke event secara bawaan. Kalau collector Anda butuh kunci stabil di sisi lain, minta hash dan pegang salt-nya: <code>identity: { kind: \'hash\', salt: process.env.GUARD_SALT }</code>. SG tidak pernah memasukkan referensi mentah ke event atas inisiatifnya sendiri.',
    )}</p>

    <p class="cap">${t('Recipe 4: erasure that is an erasure', 'Resep 4: penghapusan yang benar-benar menghapus')}</p>

<pre>await guard.forget('user_41');
await store.get('user_41'); // undefined, not an empty record</pre>

    <p>${t(
      'That is the whole deletion path: the store row is gone, the behavior window goes with it, and the next evaluation for that entity is a cold start again.',
      'Itulah seluruh jalur penghapusan: baris store hilang, jendela perilakunya ikut hilang, dan evaluasi berikutnya untuk entitas itu adalah cold start lagi.',
    )}</p>

    <p>${t(
      'Where to read next: the <a href="guarantees.html">guarantees page</a> for what is enforced by a test and what is only priced, the <a href="limits.html">limits page</a> for what has not been proven, <a href="versions.html">versions</a> for dates, and <a href="https://github.com/Fachryxyf/scorpio-guard/tree/main/examples/integration">examples/integration</a> for the same shapes with TypeScript types and tests.',
      'Mau baca apa berikutnya: <a href="guarantees.html">halaman jaminan</a> untuk apa yang ditegakkan test dan apa yang hanya diberi harga, <a href="limits.html">halaman batas</a> untuk apa yang belum terbukti, <a href="versions.html">versi</a> untuk tanggal, dan <a href="https://github.com/Fachryxyf/scorpio-guard/tree/main/examples/integration">examples/integration</a> untuk bentuk yang sama dengan tipe TypeScript dan test.',
    )}</p>
  `;

  return page({
    file: 'usage.html',
    titleEn: 'Using the library',
    titleId: 'Memakai library',
    subtitleEn:
      'A quickstart that runs on its own, what to do with each advice value, where the browser bridge is, and every number you can set.',
    subtitleId:
      'Mulai cepat yang jalan sendiri, apa yang dilakukan pada tiap nilai saran, di mana jembatan browser-nya, dan setiap angka yang bisa disetel.',
    sections,
    body,
  });
}

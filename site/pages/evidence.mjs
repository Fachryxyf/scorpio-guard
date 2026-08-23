import { h2, page, t } from '../layout.mjs';

export function evidence(data) {
  const { parameters } = data;
  const sections = [
    { id: 'split', en: 'Two kinds of evidence', id_: 'Dua jenis evidence' },
    { id: 'classes', en: 'Seven classes of proof', id_: 'Tujuh kelas bukti' },
    { id: 'completeness', en: 'Declaring hard is a claim', id_: 'Mendeklarasikan hard itu sebuah klaim' },
    { id: 'catalogue', en: 'The weak-signal catalogue', id_: 'Katalog weak signal' },
    { id: 'nothresholds', en: 'Why it holds no thresholds', id_: 'Kenapa ia tak memuat ambang' },
    { id: 'closed', en: 'Both lists are closed', id_: 'Kedua daftarnya tertutup' },
  ];

  const sourceLabel = {
    reachability: t('the flow graph the host declared', 'graf alur yang dideklarasikan host'),
    precondition: t('state that must hold before an action exists', 'state yang harus berlaku sebelum sebuah aksi ada'),
    causality: t('the input that must have produced an effect', 'masukan yang mesti menghasilkan sebuah efek'),
    order: t('timestamps the system itself recorded', 'timestamp yang sistemnya sendiri catat'),
    issuance: t('values the system itself handed out', 'nilai yang sistemnya sendiri keluarkan'),
    exclusivity: t('facts that cannot both be true', 'fakta yang tak bisa benar bersamaan'),
  };

  const bySource = new Map();
  for (const entry of parameters.constraintClasses) {
    const list = bySource.get(entry.source) ?? [];
    list.push(entry.class);
    bySource.set(entry.source, list);
  }

  const signalRows = parameters.signals
    .map(
      (signal) => `        <tr>
          <th>${signal.id.replace('SIG_', '')}</th>
          <td>${signal.source}</td>
          <td>${signal.weight}</td>
          <td class="num">${signal.mass}</td>
          <td>${signal.computed ? t('derived', 'diturunkan') : t('supplied', 'disuplai')}</td>
        </tr>`,
    )
    .join('\n');

  const innocentRows = parameters.signals
    .map(
      (signal) => `      <dt>${signal.id}</dt>
      <dd><b>${t('Measures', 'Mengukur')}:</b> ${signal.measures}<br>
      <b>${t('Innocent cause', 'Sebab tak bersalah')}:</b> ${signal.innocentCause}</dd>`,
    )
    .join('\n');

  const body = `
    <p class="lead">${t(
      'The one structural idea the project would keep if it had to discard everything else: <b>proof and measurement are different kinds of thing, and must never be averaged together</b>. A violated invariant is not a very strong signal. A signal is not a weak proof. They enter the decision by different routes and neither can be converted into the other.',
      'Satu gagasan struktural yang akan proyek ini pertahankan kalau harus membuang semua yang lain: <b>bukti dan pengukuran itu dua jenis hal yang berbeda, dan tak boleh dirata-ratakan bersama</b>. Invariant yang dilanggar bukanlah sinyal yang sangat kuat. Sinyal bukanlah bukti yang lemah. Keduanya masuk ke keputusan lewat rute berbeda dan tak bisa saling dikonversi.',
    )}</p>

    ${h2(1, 'split', 'Two kinds of evidence', 'Dua jenis evidence')}

    <table>
      <caption>${t('The split, and what follows from it', 'Pemisahannya, dan konsekuensinya')}</caption>
      <thead>
        <tr>
          <th></th>
          <th>${t('Hard constraint', 'Hard constraint')}</th>
          <th>${t('Weak signal', 'Weak signal')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>${t('Is', 'Adalah')}</th>
          <td>${t('a declared invariant, violated', 'invariant terdeklarasi yang dilanggar')}</td>
          <td>${t('a measurement of shape', 'pengukuran atas bentuk')}</td>
        </tr>
        <tr>
          <th>${t('Origin', 'Asal')}</th>
          <td>${t('the host declares it, from facts it already holds', 'host mendeklarasikannya, dari fakta yang sudah ia pegang')}</td>
          <td>${t('the library or a collector observes it', 'library atau collector mengobservasinya')}</td>
        </tr>
        <tr>
          <th>${t('Certainty', 'Kepastian')}</th>
          <td>${t('proven &mdash; the request could not have come from the system', 'terbukti &mdash; request itu tak mungkin berasal dari sistem')}</td>
          <td>${t('inconclusive by construction', 'tidak konklusif secara konstruksi')}</td>
        </tr>
        <tr>
          <th>${t('Route to a decision', 'Rute ke keputusan')}</th>
          <td>${t('its own dimension, bypassing the uncertainty ceiling', 'dimensinya sendiri, melewati ceiling uncertainty')}</td>
          <td>${t('negative evidence mass, subject to every ceiling', 'massa evidence negatif, terkena semua ceiling')}</td>
        </tr>
        <tr>
          <th>${t('Can act alone', 'Bisa bertindak sendiri')}</th>
          <td>${t('yes, on request one, with no history', 'ya, pada request pertama, tanpa riwayat')}</td>
          <td>${t('never', 'tidak pernah')}</td>
        </tr>
        <tr>
          <th>${t('Learned?', 'Dipelajari?')}</th>
          <td>${t('never. Nothing becomes impossible for being rare.', 'tidak pernah. Tak ada yang jadi mustahil karena jarang.')}</td>
          <td>${t('no thresholds ship at all &mdash; see below', 'tidak ada ambang yang dikirim sama sekali &mdash; lihat di bawah')}</td>
        </tr>
      </tbody>
    </table>

    <p>${t(
      'The design notes use a biological analogy that survives contact with the code. Hard constraints are the <b>skeleton</b>: few, rigid, and a break is unambiguous. Weak signals are the <b>flora</b>: many, individually meaningless, diagnostic only in combination and over time. A skeleton that tried to be flora would break on every unusual visitor; flora that tried to be a skeleton would convict on a hunch.',
      'Catatan desainnya memakai analogi biologis yang bertahan saat bertemu kode. Hard constraint adalah <b>kerangka</b>: sedikit, kaku, dan retaknya tak ambigu. Weak signal adalah <b>flora</b>: banyak, satu-satu tak bermakna, diagnostik hanya dalam kombinasi dan seiring waktu. Kerangka yang mencoba jadi flora akan patah pada setiap pengunjung tak biasa; flora yang mencoba jadi kerangka akan menghukum atas dasar praduga.',
    )}</p>

    <p>${t(
      'One asymmetry is worth stating plainly, because it is where the certainty lives. <b>&ldquo;Hard&rdquo; describes the certainty of the violation, never the severity of the response.</b> A proven impossibility means <i>something is wrong</i> &mdash; it does not prove the caller did it, since an internal accounting bug looks identical from outside. So the default advice for a proven violation is <code>RESTRICT</code> rather than <code>BLOCK</code>: withholding the expensive part until a human looks is correct whether the cause is an attacker or your own ledger.',
      'Satu asimetri perlu dinyatakan terang, karena di sanalah kepastiannya berada. <b>&ldquo;Hard&rdquo; menggambarkan kepastian pelanggarannya, bukan keparahan responsnya.</b> Ketidakmungkinan yang terbukti berarti <i>ada yang salah</i> &mdash; itu tidak membuktikan si pemanggil yang melakukannya, karena bug pembukuan internal tampak identik dari luar. Jadi saran default untuk pelanggaran terbukti adalah <code>RESTRICT</code>, bukan <code>BLOCK</code>: menahan bagian yang mahal sampai ada manusia yang melihat itu benar, entah penyebabnya penyerang atau ledger-mu sendiri.',
    )}</p>

    ${h2(2, 'classes', 'Seven classes of proof', 'Tujuh kelas bukti')}

    <p>${t(
      'The taxonomy is closed, and it is closed by the right question. Not <i>what do attacks look like</i>, which is an open-ended list that grows forever, but <i>what can a host actually prove</i>. A host can only prove impossibility from facts it already holds, and those facts come in six kinds. Enumerate the kinds and the classes follow.',
      'Taksonominya tertutup, dan tertutup lewat pertanyaan yang tepat. Bukan <i>seperti apa bentuk serangan</i>, yang merupakan daftar terbuka dan tumbuh selamanya, tapi <i>apa yang sebenarnya bisa dibuktikan host</i>. Host hanya bisa membuktikan ketidakmungkinan dari fakta yang sudah ia pegang, dan fakta itu ada dalam enam jenis. Enumerasikan jenisnya, maka kelasnya menyusul.',
    )}</p>

    <table>
      <caption>${t('Proof sources, and the classes they license', 'Sumber bukti, dan kelas yang mereka izinkan')}</caption>
      <thead>
        <tr>
          <th>${t('Proof source', 'Sumber bukti')}</th>
          <th>${t('What the host holds', 'Apa yang host pegang')}</th>
          <th>${t('Class', 'Kelas')}</th>
        </tr>
      </thead>
      <tbody>
${[...bySource.entries()]
  .map(
    ([source, classes]) => `        <tr>
          <th>${source}</th>
          <td>${sourceLabel[source] ?? source}</td>
          <td>${classes.map((cls) => `<code>${cls}</code>`).join('<br>')}</td>
        </tr>`,
  )
  .join('\n')}
      </tbody>
    </table>
    <p class="tnote">${t(
      'Six sources, ' +
        parameters.constraintClasses.length +
        ' classes &mdash; <code>reachability</code> licenses two, because a forbidden jump between page segments and a forbidden state transition are proved the same way but declared differently. The seventh class, <code>IMPOSSIBLE_UNISSUED_REFERENCE</code>, is the one the original five could not express: a reference the system never issued cannot have come from the system.',
      'Enam sumber, ' +
        parameters.constraintClasses.length +
        ' kelas &mdash; <code>reachability</code> mengizinkan dua, karena lompatan terlarang antar segmen halaman dan transisi state terlarang dibuktikan dengan cara yang sama tapi dideklarasikan berbeda. Kelas ketujuh, <code>IMPOSSIBLE_UNISSUED_REFERENCE</code>, adalah yang tak bisa diungkapkan lima kelas awal: referensi yang sistemnya sendiri tak pernah keluarkan tak mungkin berasal dari sistem itu.',
    )}</p>

    ${h2(3, 'completeness', 'Declaring <code>hard</code> is itself a claim', 'Mendeklarasikan <code>hard</code> itu sendiri sebuah klaim')}

    <p>${t(
      'Marking an invariant <code>hard</code> asserts <i>completeness over its scope</i>: that no legitimate client, ever, under any condition, produces this. That is a stronger claim than it looks, and the project got it wrong once in a way worth publishing.',
      'Menandai sebuah invariant sebagai <code>hard</code> berarti menyatakan <i>kelengkapan atas scope-nya</i>: bahwa tak ada klien sah, kapan pun, dalam kondisi apa pun, yang menghasilkan ini. Itu klaim yang lebih kuat daripada tampaknya, dan proyek ini pernah salah soal itu dengan cara yang layak dipublikasikan.',
    )}</p>

    <blockquote>${t(
      '&ldquo;Paid work requires enough credits&rdquo; looks provable and is not. The client\u2019s view of its balance is stale by construction &mdash; jobs bill asynchronously, another tab may have spent the difference, and a lapsed subscription changes the answer without the open page hearing about it. One refused request is how a person discovers their balance; a hundred is a script.',
      '&ldquo;Kerja berbayar butuh kredit yang cukup&rdquo; tampak bisa dibuktikan, dan ternyata tidak. Pandangan klien atas saldonya usang secara konstruksi &mdash; job ditagih asinkron, tab lain mungkin sudah membelanjakan selisihnya, dan langganan yang lewat mengubah jawabannya tanpa halaman yang terbuka mendengarnya. Satu request yang ditolak adalah cara seseorang menemukan saldonya; seratus adalah skrip.',
    )}</blockquote>

    <p>${t(
      'It is now <code>soft</code>. The lesson generalises: <b>being enforced by the server is not the same as being provable.</b> The server returning 402 is a correct refusal; it is not proof that the caller is illegitimate.',
      'Sekarang jadi <code>soft</code>. Pelajarannya bisa digeneralisasi: <b>ditegakkan oleh server tidak sama dengan bisa dibuktikan.</b> Server yang mengembalikan 402 adalah penolakan yang benar; itu bukan bukti bahwa pemanggilnya tidak sah.',
    )}</p>

    <p>${t(
      'A violated <code>soft</code> invariant is worth <code>' +
        parameters.softViolationWeight +
        '</code> &mdash; the same as strong negative evidence, not weak. The host deliberately declared that this should not happen; that it is not <i>provable</i> does not make it faint. Weak weight is reserved for signals the library inferred on its own.',
      'Invariant <code>soft</code> yang dilanggar bernilai <code>' +
        parameters.softViolationWeight +
        '</code> &mdash; sama dengan evidence negatif kuat, bukan lemah. Host sengaja mendeklarasikan bahwa ini seharusnya tak terjadi; bahwa ia tak <i>terbukti</i> tidak membuatnya samar. Bobot lemah disimpan untuk sinyal yang library simpulkan sendiri.',
    )}</p>

    <p>${t(
      'And an undeclared shape is <b>unknown, never forbidden</b>. Every invariant ignores observations that are not its business, so a host that declares nothing about a scope gets silence about that scope rather than suspicion.',
      'Dan bentuk yang tak dideklarasikan itu <b>tidak diketahui, bukan terlarang</b>. Setiap invariant mengabaikan observasi yang bukan urusannya, jadi host yang tak mendeklarasikan apa pun tentang sebuah scope mendapat kesunyian tentang scope itu, bukan kecurigaan.',
    )}</p>

    ${h2(4, 'catalogue', 'The weak-signal catalogue', 'Katalog weak signal')}

    <table>
      <caption>${t(
        parameters.signals.length + ' signals over 6 sources',
        parameters.signals.length + ' sinyal di atas 6 sumber',
      )}</caption>
      <thead>
        <tr>
          <th>SIG_</th>
          <th>${t('Source', 'Sumber')}</th>
          <th>${t('Weight', 'Bobot')}</th>
          <th class="num">${t('mass', 'massa')}</th>
          <th>${t('Origin', 'Asal')}</th>
        </tr>
      </thead>
      <tbody>
${signalRows}
      </tbody>
    </table>
    <p class="tnote">${t(
      'Three coarse weights rather than a per-signal number, because a continuous weight would imply calibration nobody has done &mdash; and the <i>ordering</i> is the only part likely to survive contact with real traffic. <b>Derived</b> means the library computes it from the retained window; <b>supplied</b> means it arrives from the browser collector or from the host. Total contribution per interaction is capped at ' +
        parameters.signalMassCap +
        ', so the whole catalogue firing at once is worth exactly one weak observation.',
      'Tiga bobot kasar alih-alih angka per sinyal, karena bobot kontinu akan menyiratkan kalibrasi yang belum dilakukan siapa pun &mdash; dan <i>urutannya</i> adalah satu-satunya bagian yang mungkin bertahan saat bertemu trafik nyata. <b>Diturunkan</b> berarti library menghitungnya dari window yang disimpan; <b>disuplai</b> berarti ia datang dari collector browser atau dari host. Total sumbangan per interaksi dibatasi ' +
        parameters.signalMassCap +
        ', jadi seluruh katalog yang menyala sekaligus bernilai tepat satu observasi lemah.',
    )}</p>

    <h3 id="innocent">${t('Every signal owes an innocent cause', 'Setiap sinyal berutang satu sebab tak bersalah')}</h3>

    <p>${t(
      'A catalogue entry is not admitted without a written answer to <i>why would a legitimate user trigger this</i>. The rule is procedural rather than decorative: a signal whose author cannot name its false-positive path has not finished thinking about it.',
      'Sebuah entri katalog tidak diterima tanpa jawaban tertulis atas <i>kenapa pengguna yang sah bisa memicu ini</i>. Aturannya prosedural, bukan hiasan: sinyal yang penulisnya tak bisa menyebut jalur false-positive-nya berarti belum selesai dipikirkan.',
    )}</p>

    <dl>
${innocentRows}
    </dl>

    ${h2(5, 'nothresholds', 'Why the catalogue holds no thresholds', 'Kenapa katalognya tak memuat ambang')}

    <p>${t(
      'Every entry names what is measured and what observing it is worth. Not one names <i>when it fires</i>. That is not an omission to be filled in later &mdash; it is the design.',
      'Setiap entri menyebut apa yang diukur dan berapa nilainya kalau terobservasi. Tak satu pun menyebut <i>kapan ia menyala</i>. Itu bukan kekosongan yang akan diisi nanti &mdash; itu memang desainnya.',
    )}</p>

    <ul>
      <li>${t(
        '<b>Publishing a number hands it over.</b> An open-source library that ships <code>flag if interval &lt; 220ms</code> has told every attacker the exact value to route around. The mechanism can be public; the trigger point cannot be, and it belongs to the deployment anyway.',
        '<b>Mempublikasikan angkanya berarti menyerahkannya.</b> Library open source yang mengirim <code>tandai kalau interval &lt; 220ms</code> sudah memberi tahu setiap penyerang nilai tepat yang harus dihindari. Mekanismenya boleh publik; titik pemicunya tidak, dan itu memang milik deployment-nya.',
      )}</li>
      <li>${t(
        '<b>The right number is a property of the application.</b> A minimum plausible fill time for a two-field newsletter form and for a twelve-field insurance quote are not the same number, and no library default is correct for both.',
        '<b>Angka yang benar adalah properti aplikasinya.</b> Waktu isi minimum yang masuk akal untuk form newsletter dua kolom dan untuk formulir asuransi dua belas kolom bukan angka yang sama, dan tak ada default library yang benar untuk keduanya.',
      )}</li>
      <li>${t(
        '<b>Nobody has calibrated one.</b> Shipping a number would imply otherwise. The collectors take their threshold as a parameter and the catalogue stays a vocabulary.',
        '<b>Belum ada yang mengkalibrasi satu pun.</b> Mengirim sebuah angka akan menyiratkan sebaliknya. Collector-nya menerima ambangnya sebagai parameter dan katalognya tetap sebuah kosakata.',
      )}</li>
    </ul>

    <p>${t(
      'There is one consequence worth being explicit about: the library cannot be dropped in and expected to catch anything subtle. Signals it cannot observe, a host must supply. That is the honest cost of refusing to guess.',
      'Ada satu konsekuensi yang perlu dinyatakan terang: library ini tak bisa sekadar dipasang lalu diharapkan menangkap hal-hal halus. Sinyal yang tak bisa ia observasi harus disuplai host. Itu biaya jujur dari menolak menebak.',
    )}</p>

    ${h2(6, 'closed', 'Both lists are closed, and closed the same way', 'Kedua daftarnya tertutup, dan tertutup dengan cara yang sama')}

    <p>${t(
      'Neither list is closed by exhausting attack shapes &mdash; that set is infinite and adversarial. Both are closed by exhausting <i>what can be observed at all</i>.',
      'Kedua daftar tidak ditutup dengan menghabiskan bentuk-bentuk serangan &mdash; himpunan itu tak terbatas dan bersifat adversarial. Keduanya ditutup dengan menghabiskan <i>apa yang bisa diobservasi sama sekali</i>.',
    )}</p>

    <div class="eq"><span class="eq-n">(4)</span>
      ${t('constraints', 'constraint')} = f(${t('proof sources', 'sumber bukti')}),&nbsp;&nbsp; |${t('sources', 'sumber')}| = 6<br>
      ${t('signals', 'sinyal')} = g(${t('observation sources', 'sumber observasi')}),&nbsp;&nbsp; |${t('sources', 'sumber')}| = 6
      <span class="where">${t(
        'A proof the host cannot derive is not a constraint it can declare. A signal the library cannot observe is not a signal it can carry. Both lists are therefore finite, and adding to either requires arguing that a <i>source</i> was missed.',
        'Bukti yang tak bisa diturunkan host bukanlah constraint yang bisa ia deklarasikan. Sinyal yang tak bisa diobservasi library bukanlah sinyal yang bisa ia bawa. Karena itu kedua daftarnya berhingga, dan menambah salah satunya menuntut argumen bahwa ada <i>sumber</i> yang terlewat.',
      )}</span>
    </div>

    <p>${t(
      'The observation sources are timing, repetition, interaction, sequence, target and environment. The proof sources are reachability, precondition, causality, order, issuance and exclusivity. They are duals: one names where a measurement can come from, the other where a certainty can.',
      'Sumber observasinya adalah timing, repetition, interaction, sequence, target, dan environment. Sumber buktinya adalah reachability, precondition, causality, order, issuance, dan exclusivity. Keduanya dual: yang satu menyebut dari mana sebuah pengukuran bisa datang, yang lain dari mana sebuah kepastian bisa datang.',
    )}</p>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="model.html#ceilings">${t('The three ceilings', 'Tiga ceiling-nya')}</a>
      <a href="results.html#personas">${t('What the personas found', 'Apa yang ditemukan persona')}</a>
      <a href="usage.html#invariants">${t('Declaring an invariant', 'Mendeklarasikan invariant')}</a>
      <a href="limits.html#signals">${t('The catalogue\u2019s outstanding debt', 'Utang katalog yang belum dibayar')}</a>
    </p>
  `;

  return page({
    file: 'evidence.html',
    titleEn: 'Proof and measurement',
    titleId: 'Bukti dan pengukuran',
    subtitleEn: 'Seven classes of provable impossibility, ten weak signals, and the rule that they may never be averaged together.',
    subtitleId: 'Tujuh kelas ketidakmungkinan yang bisa dibuktikan, sepuluh weak signal, dan aturan bahwa keduanya tak boleh dirata-ratakan bersama.',
    sections,
    body,
  });
}

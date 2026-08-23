import { h2, page, t } from '../layout.mjs';

export function record(data) {
  const sections = [
    { id: 'index', en: 'Decision index', id_: 'Indeks keputusan' },
    { id: 'glossary', en: 'Glossary', id_: 'Glosarium' },
  ];

  const parts = data.design.parts
    .map((part) => {
      const rows = part.entries
        .map(
          (entry) => `        <tr>
          <th><a href="https://github.com/Fachryxyf/scorpio-guard/blob/main/DECISIONS.md#${entry.anchor}">${entry.id}</a></th>
          <td>${entry.superseded ? `<s>${entry.title}</s> <em>${t('superseded', 'digantikan')}</em>` : entry.title}</td>
          <td><code>${entry.files || '\u2014'}</code></td>
        </tr>`,
        )
        .join('\n');
      return `
    <table>
      <caption>${part.part.replace(/^Part ([IVX]+) — (.+)$/, (_m, roman, title) => `${t('Part', 'Bagian')} ${roman}: ${title}`)}</caption>
      <thead><tr><th>#</th><th>${t('Decision', 'Keputusan')}</th><th>${t('Files', 'File')}</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
    })
    .join('\n');

  const glossary = [
    ['entity', 'Entity', 'Entitas',
      t('The unit trust is measured against: an opaque string the host supplies. SG never interprets it and never treats it as proof of identity.',
        'Satuan yang diukur trust-nya: string opaque yang disuplai host. SG tak pernah menafsirkannya dan tak pernah menganggapnya bukti identitas.')],
    ['root-of-trust', 'Root of trust', 'Akar trust',
      t('Whatever makes an entity reference expensive to obtain or replace. Explicitly outside the library: supplying a strong one is the host\u2019s responsibility.',
        'Apa pun yang membuat referensi entitas mahal didapat atau diganti. Eksplisit di luar library: menyediakan yang kuat tanggung jawab host.')],
    ['observation', 'Observation', 'Observasi',
      t('One interaction handed to evaluate(): a scope, whatever data the host\u2019s invariants read, and optional attributed evidence. SG never inspects data itself.',
        'Satu interaksi yang diberikan ke evaluate(): sebuah scope, data apa pun yang dibaca invariant host, dan evidence terkait opsional. SG tak pernah memeriksa datanya sendiri.')],
    ['scope', 'Scope', 'Scope',
      t('The area a declaration covers, so a partial declaration is not silently global. An observation in an undeclared scope yields no violations: unknown, not forbidden.',
        'Area yang dicakup sebuah deklarasi, agar deklarasi sebagian tidak diam-diam jadi global. Observasi di scope yang tak dideklarasikan tidak menghasilkan pelanggaran: belum diketahui, bukan dilarang.')],
    ['evidence-mass', 'Evidence mass', 'Massa evidence',
      t('How much has accumulated, n = α + β after decay. Mass is the amount of belief; trust is its direction.',
        'Seberapa banyak yang sudah terkumpul, n = α + β setelah decay. Massa adalah banyak keyakinan; trust adalah arahnya.')],
    ['stage', 'Epistemic stage', 'Tahap epistemik',
      t('unknown, developing, established — how much do I know? — read before trust answers what do I believe?',
        'unknown, developing, established \u2014 seberapa banyak saya tahu? \u2014 dibaca sebelum trust menjawab apa yang saya yakini?')],
    ['hard-constraint', 'Hard constraint', 'Constraint hard',
      t('A violation that is a proof, not a probability. Declaring hard claims both determinism and completeness over its scope.',
        'Pelanggaran yang merupakan bukti, bukan probabilitas. Mendeklarasikan hard menegaskan determinisme dan kelengkapan atas scope-nya sekaligus.')],
    ['weak-signal', 'Weak signal', 'Weak signal',
      t('Unusual but not impossible; meaningful only in combination. Becomes negative evidence, subject to every ceiling, never acts alone.',
        'Tak biasa tapi tak mustahil; berarti hanya dalam kombinasi. Menjadi evidence negatif, terkena semua ceiling, tak pernah bertindak sendiri.')],
    ['decision', 'Decision', 'Keputusan',
      t('One of five rungs returned as advice. Strongest wins when layers disagree: a maximum, never an average.',
        'Salah satu dari lima tingkat yang dikembalikan sebagai saran. Yang terkuat menang saat lapis berbeda: maksimum, bukan rata-rata.')],
    ['advisory', 'Advisory', 'Advisory',
      t('The guard returns a decision and never performs one. The host owns the consequences, so the host owns the action.',
        'Guard mengembalikan keputusan dan tak pernah melakukannya. Host memilik konsekuensinya, jadi host memilik tindakannya.')],
  ];

  const body = `
    <p class="lead">${t(
      `${data.decisionCount} numbered decisions, each with its reasoning, its answer, and what it commits the implementation to. This index points at the record rather than restating it.`,
      `${data.decisionCount} keputusan bernomor, masing-masing dengan penalaran, jawabannya, dan komitmennya pada implementasi. Indeks ini menunjuk ke rekamannya alih-alih mengulanginya.`,
    )}</p>

    ${h2(1, 'index', 'Decision index', 'Indeks keputusan')}
${parts}

    ${h2(2, 'glossary', 'Glossary', 'Glosarium')}

    <dl class="compact">
${glossary.map(([id, en, idText, meaning]) => `      <dt id="${id}">${t(en, idText)}</dt>
      <dd>${meaning}</dd>`).join('\n')}
    </dl>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="https://github.com/Fachryxyf/scorpio-guard/blob/main/DECISIONS.md">${t('Full design record', 'Rekaman desain lengkap')}</a>
      <a href="limits.html#unvalidated">${t('What remains unvalidated', 'Yang belum tervalidasi')}</a>
      <a href="usage.html#policy">${t('Policy defaults', 'Default policy')}</a>
    </p>
  `;

  return page({
    file: 'record.html',
    titleEn: 'Design record and glossary',
    titleId: 'Rekaman desain dan glosarium',
    subtitleEn: 'Every numbered decision, the file it became, and the vocabulary this project uses narrowly.',
    subtitleId: 'Setiap keputusan bernomor, file yang ia jadi, dan kosakata yang dipakai proyek ini secara sempit.',
    sections,
    body,
  });
}

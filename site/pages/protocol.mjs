import { h2, page, t } from '../layout.mjs';

export function protocol(data) {
  const { parameters } = data;
  const sections = [
    { id: 'shape', en: 'The shape', id_: 'Bentuknya' },
    { id: 'vocabulary', en: 'Two-tier vocabulary', id_: 'Kosakata dua lapis' },
    { id: 'wire', en: 'Wire format', id_: 'Format wire' },
    { id: 'degrade', en: 'Degradation rules', id_: 'Aturan degradasi' },
    { id: 'conformance', en: 'Conformance', id_: 'Konformansi' },
  ];

  const vocabRows = parameters.symptoms
    .map(
      (entry) => `        <tr>
          <th><code>${entry.category}</code></th>
          <td>${entry.details.map((detail) => `<code>${detail}</code>`).join('<br>')}</td>
        </tr>`,
    )
    .join('\n');

  const body = `
    <p class="lead">${t(
      'The protocol is the one part designed to outlive this library. It defines what may cross a network between deployments that share nothing but vocabulary \u2014 and it transmits nothing today, by design.',
      'Protokol adalah satu bagian yang dirancang untuk hidup lebih lama dari library ini. Ia mendefinisikan apa yang boleh melintasi jaringan antar deployment yang tak berbagi apa pun kecuali kosakata \u2014 dan hari ini tidak mengirim apa pun, memang disengaja.',
    )}</p>

    ${h2(1, 'shape', 'The shape', 'Bentuknya')}

    <p>${t(
      'A deployment reports abstract shapes it observed; it receives strategies for handling that class of shape. The prescription travels; the patient does not. No entity key, no raw observation, no trust state, no free text. The constraint is structural rather than a policy: the message type has no field in which raw data would fit.',
      'Sebuah deployment melaporkan bentuk abstrak yang ia observasi; ia menerima strategi untuk menangani kelas bentuk itu. Resepnya yang berpindah; pasiennya tidak. Tanpa kunci entitas, tanpa observasi mentah, tanpa state trust, tanpa teks bebas. Kendalanya struktural, bukan kebijakan: tipe pesannya tidak punya field tempat data mentah bisa muat.',
    )}</p>

    <pre>POST /v0/symptoms
Content-Type: application/json

{
  "protocol": "${parameters.protocolVersion}",
  "schema": ${parameters.symptomSchema},
  "reports": [
    { "category": "SYM_TIMING",
      "detail": "SYM_UNIFORM_DELAY_SHAPE",
      "entities": "few" }
  ]
}</pre>

    ${h2(2, 'vocabulary', 'Two-tier vocabulary', 'Kosakata dua lapis')}

    <p>${t(
      'The category tier is stable and expected never to grow. The detail tier is free to grow release to release. An unrecognised detail degrades to its stated category rather than failing; an unrecognised category is rejected because there is nothing left to fall back to.',
      'Lapis kategori stabil dan diharapkan tidak pernah bertambah. Lapis detail bebas bertambah setiap rilis. Detail yang tak dikenali turun ke kategori yang dinyatakan bersamanya alih-alih gagal; kategori yang tak dikenali ditolak karena tak ada lagi tempat jatuhnya.',
    )}</p>

    <table>
      <caption>${t('Stable categories and their current details (generated from source)', 'Kategori stabil dan detail terkininya (dibangkitkan dari sumber)')}</caption>
      <thead>
        <tr><th>${t('Category — stable', 'Kategori — stabil')}</th><th>${t('Details — evolve', 'Detail — berkembang')}</th></tr>
      </thead>
      <tbody>
${vocabRows}
      </tbody>
    </table>

    <h3>${t('Entity counts are buckets, not numbers', 'Hitungan entitas adalah bucket, bukan angka')}</h3>

    <table>
      <caption>${t('Ordered labels, deliberately coarse', 'Label berurutan, sengaja kasar')}</caption>
      <thead><tr><th>${t('Bucket', 'Bucket')}</th><th>${t('Meaning', 'Arti')}</th></tr></thead>
      <tbody>
${parameters.entityBuckets
  .map((bucket) => `        <tr><th><code>${bucket}</code></th><td>${t('a sender-side bucketed count; boundaries unpublished', 'hitungan ber-bucket dari sisi pengirim; batasnya tidak dipublikasikan')}</td></tr>`)
  .join('\n')}
      </tbody>
    </table>

    ${h2(3, 'wire', 'Wire format', 'Format wire')}

    <p>${t(
      'HTTP POST, JSON, one object per request. Boring on purpose: symptom reporting is low-rate, low-urgency, tolerant of loss. Requests are unauthenticated and idempotent; rate limiting is by transport-level address only.',
      'HTTP POST, JSON, satu objek per request. Sengaja membosankan: pelaporan symptom bervolume rendah, rendah urgensi, toleran terhadap kehilangan. Request tanpa autentikasi dan idempoten; rate limiting hanya lewat alamat transport.',
    )}</p>

    <pre>{
  "protocol": "${parameters.protocolVersion}",
  "prescriptions": [
    {
      "category": "SYM_TIMING",
      "detail": "SYM_UNIFORM_DELAY_SHAPE",
      "strategy": "TIGHTEN_TIMING_TOLERANCE",
      "confidence": "provisional"
    }
  ]
}</pre>

    <p>${t(
      'A prescription is advice about a class of shape, never a verdict about an entity \u2014 the server has never been told which entities were involved. A receiver must ignore an unrecognised strategy rather than escalate on it.',
      'Resep adalah saran tentang kelas bentuk, bukan putusan tentang entitas \u2014 server tak pernah diberi tahu entitas mana yang terlibat. Penerima harus mengabaikan strategi yang tak dikenalinya alih-alih mengeskalasi karena itu.',
    )}</p>

    ${h2(4, 'degrade', 'Degradation rules', 'Aturan degradasi')}

    <table>
      <caption>${t('What a receiver must do', 'Apa yang harus dilakukan penerima')}</caption>
      <thead><tr><th>${t('Case', 'Kasus')}</th><th>${t('Rule', 'Aturan')}</th></tr></thead>
      <tbody>
        <tr><th>${t('Unknown detail, known category', 'Detail tak dikenal, kategori dikenal')}</th><td>${t('accept, act on the category. Normal forward compatibility.', 'terima, bertindak atas kategorinya. Kompatibilitas maju normal.')}</td></tr>
        <tr><th>${t('Unknown category', 'Kategori tak dikenal')}</th><td>${t('reject that report. Nothing left to fall back to.', 'tolak laporan itu. Tak ada lagi yang bisa jadi cadangan.')}</td></tr>
        <tr><th>${t('Newer schema number', 'Nomor skema lebih baru')}</th><td>${t('accept. New details are already covered by rule one.', 'terima. Detail baru sudah tercakup aturan pertama.')}</td></tr>
        <tr><th>${t('Unknown protocol major', 'Protokol mayor tak dikenal')}</th><td>${t('reject the whole message.', 'tolak seluruh pesan.')}</td></tr>
        <tr><th>${t('Unknown fields', 'Field tak dikenal')}</th><td>${t('ignore them; reject only on missing required ones.', 'abaikan; tolak hanya jika yang wajib hilang.')}</td></tr>
      </tbody>
    </table>

    ${h2(5, 'conformance', 'Conformance', 'Konformansi')}

    <p>${t(
      'An implementation conforms when it sends only tokens it shipped with, carries the category alongside every detail, buckets entity counts, applies every degradation rule, ignores unrecognised strategies, and includes no field carrying raw observation or identity. That last point is worth testing adversarially: it is the guarantee the privacy argument rests on, and the only one whose violation is invisible to the sender.',
      'Implementasi konform ketika ia hanya mengirim token yang dikirimnya saat rilis, menyertakan kategori bersama setiap detail, membuat hitungan entitas jadi bucket, menerapkan semua aturan degradasi, mengabaikan strategi tak dikenal, dan tidak memuat field pembawa observasi mentah atau identitas. Poin terakhir layak diuji secara adversarial: itu jaminan tempat argumen privasi berdiri, dan satu-satunya yang pelanggarannya tak terlihat oleh pengirim.',
    )}</p>

    <p class="seealso"><b>${t('See also', 'Lihat juga')}</b>
      <a href="https://github.com/Fachryxyf/scorpio-guard/blob/main/PROTOCOL.md">${t('Full protocol draft', 'Draf protokol lengkap')}</a>
      <a href="evidence.html#catalogue">${t('Weak-signal catalogue', 'Katalog weak signal')}</a>
      <a href="limits.html#wire">${t('What the protocol does not yet decide', 'Apa yang belum diputuskan protokol')}</a>
    </p>
  `;

  return page({
    file: 'protocol.html',
    titleEn: 'Symptom and prescription',
    titleId: 'Symptom dan prescription',
    subtitleEn: 'What may cross the wire, what structurally cannot, and why nothing transmits yet.',
    subtitleId: 'Apa yang boleh lewat kabel, apa yang secara struktural tak bisa, dan kenapa belum ada yang dikirim.',
    sections,
    body,
  });
}

/**
 * Every claim traffic overturned, in the order it fell. D58.
 *
 * The count appears on the front page, and typing it there is how a page starts
 * lying: the list grows and the number does not. So the list is the source and the
 * number is `FALSIFICATIONS.length`.
 *
 * `source` is the traffic that did it, because the two kinds are not equivalent —
 * generated personas exercise the model, and real-browser traffic through the live
 * observer exercises the *integration*, which is where the last four lived.
 */
export const FALSIFICATIONS = [
  {
    ref: 'D46',
    source: 'personas',
    en: 'The <code>developing</code> stage ceiling was one rung too high. Two mistyped PINs and an autofilled password manager were all advised <code>INCREASE_FRICTION</code>. The middle stage is meant to let trust influence a treatment without driving it, and <code>OBSERVE</code> is the only rung that does that.',
    id: 'Ceiling tahap <code>developing</code> satu tingkat terlalu tinggi. Dua PIN salah ketik dan satu password manager yang autofill semuanya disarankan <code>INCREASE_FRICTION</code>. Tahap tengah seharusnya membiarkan trust memengaruhi perlakuan tanpa menentukannya, dan <code>OBSERVE</code> satu-satunya tingkat yang begitu.',
  },
  {
    ref: 'D46',
    source: 'personas',
    en: 'Scope entropy was normalised against the window size, which made it measure how many scopes the <i>application</i> has rather than how varied the <i>entity</i> was. A two-scope app could not reach the diversity threshold at all, so its most honest user scored monotonous for an entire run.',
    id: 'Entropi scope dinormalisasi terhadap ukuran window, sehingga yang terukur adalah berapa banyak scope yang dimiliki <i>aplikasi</i>, bukan seberapa beragam <i>entitas</i>-nya. Aplikasi dua scope tak bisa mencapai ambang diversity sama sekali, jadi penggunanya yang paling jujur terbaca monoton sepanjang run.',
  },
  {
    ref: 'D48',
    source: 'personas',
    en: 'A <code>hard</code> declaration that was not provable. &ldquo;Paid work requires enough credits&rdquo; looks provable and is not: the client&rsquo;s view of its balance is stale by construction. Being enforced by the server is not the same as being provable, so it is <code>soft</code> now.',
    id: 'Sebuah deklarasi <code>hard</code> yang ternyata tak terbuktikan. &ldquo;Pekerjaan berbayar butuh kredit cukup&rdquo; tampak terbuktikan tapi tidak: pandangan klien atas saldonya kedaluwarsa secara konstruksi. Ditegakkan server tidak sama dengan bisa dibuktikan, jadi sekarang ia <code>soft</code>.',
  },
  {
    ref: 'D49',
    source: 'personas',
    en: 'The saturation guard did not do what it claimed. Farming produces a high mean, a high mean proposes <code>ALLOW</code>, and a ceiling can only lower a decision &mdash; so the D37 gate was unobservable for exactly the entity it targeted. Measured: 300 uniform positives absorbed 17 strong negatives before the advice moved.',
    id: 'Saturation guard tidak melakukan apa yang diklaimnya. Farming menghasilkan mean tinggi, mean tinggi mengusulkan <code>ALLOW</code>, dan ceiling hanya bisa menurunkan keputusan &mdash; jadi gate D37 tak teramati justru bagi entitas yang ia sasar. Terukur: 300 positive seragam menyerap 17 negative kuat sebelum sarannya bergerak.',
  },
  {
    ref: 'D57',
    source: 'live',
    en: 'A 200 is not a success. The origin answers unknown <code>/api/*</code> paths with its SPA fallback, so a path scanner asking for <code>/api/admin/users</code> was <i>credited with a positive</i> and ended with more trust than it started with. An API route answering a document is a 404 the origin failed to say.',
    id: 'Status 200 bukan berarti sukses. Origin menjawab path <code>/api/*</code> yang tak dikenal dengan fallback SPA-nya, jadi pemindai path yang meminta <code>/api/admin/users</code> justru <i>dikreditkan positive</i> dan berakhir dengan trust lebih tinggi daripada saat mulai. Route API yang menjawab dokumen adalah 404 yang gagal diucapkan origin.',
  },
  {
    ref: 'D57',
    source: 'live',
    en: 'One scope for every page reproduced the entropy bug in a new place. All page views shared a single scope, so <code>scopeEntropy</code> was 0 and <code>distinctScopes</code> was 1 for every visitor who only browsed: honest readers scored monotonous by construction. The feature was measuring the integration&rsquo;s coarseness, not the visitor.',
    id: 'Satu scope untuk semua halaman mengulang bug entropi di tempat baru. Semua page view memakai satu scope, jadi <code>scopeEntropy</code> 0 dan <code>distinctScopes</code> 1 untuk setiap pengunjung yang cuma membaca: pembaca jujur terbaca monoton secara konstruksi. Fiturnya mengukur kekasaran integrasinya, bukan pengunjungnya.',
  },
  {
    ref: 'D57',
    source: 'live',
    en: 'Weak signals on page views made the operator&rsquo;s own uptime check a false positive &mdash; a 20-request monitor reached <code>INCREASE_FRICTION</code> at step 15. Over HTTP alone an uptime monitor and a crawler are the same client. Signals are attached only to actions now, and the cost is stated rather than hidden: a crawler that only reads public pages walks through at <code>ALLOW</code>.',
    id: 'Weak signal pada page view membuat uptime check operatornya sendiri jadi false positive &mdash; monitor 20 request mencapai <code>INCREASE_FRICTION</code> di langkah 15. Lewat HTTP saja, uptime monitor dan crawler adalah klien yang sama. Sinyal sekarang hanya menempel pada aksi, dan biayanya dinyatakan bukan disembunyikan: crawler yang cuma membaca halaman publik lolos di <code>ALLOW</code>.',
  },
  {
    ref: 'D57',
    source: 'live',
    en: 'Two harness bugs that would have read as model behavior. <code>scrollIntoView</code> and <code>getBoundingClientRect</code> in one expression yields pre-scroll coordinates, so every form click landed on empty space and looked like &ldquo;the persona did not convert&rdquo;. And an unbounded protocol command hung a whole run on one unreachable redirect.',
    id: 'Dua bug harness yang akan terbaca sebagai perilaku model. <code>scrollIntoView</code> dan <code>getBoundingClientRect</code> dalam satu ekspresi menghasilkan koordinat sebelum scroll, jadi setiap klik form mendarat di ruang kosong dan tampak seperti &ldquo;persona-nya tidak konversi&rdquo;. Dan satu perintah protokol tanpa batas waktu menggantung seluruh run karena satu redirect yang tak terjangkau.',
  },
];

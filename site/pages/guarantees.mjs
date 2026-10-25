import { h2, page, t } from "../layout.mjs";

export function guarantees(data) {
  const { version, testCount } = data;
  const sections = [
    { id: "held", en: "What is held right now", id_: "Yang dipegang sekarang" },
    { id: "measured", en: "What is measured", id_: "Yang diukur" },
    { id: "not", en: "What is not guaranteed", id_: "Yang tidak dijamin" },
    { id: "exit", en: "What 1.0.0 adds", id_: "Apa yang ditambah 1.0.0" },
  ];

  const held = [
    ["Advice, never an action", t("The library returns a decision and a trace. The host decides what to do with it.", "Library mengembalikan keputusan dan trace. Host yang memutuskan apa yang dilakukan."), "src/core/guard.test.ts"],
    ["No runtime dependencies", "D59", "npm run pack:check"],
    ["The core touches no Node-only API", "D12, M5.1", "src/core/runtime-surface.test.ts"],
    ["No identity in the decision event by default", "D61", "src/core/event.test.ts, src/core/erasure.test.ts"],
    ["Erasure is counted, not assumed", "D69", "src/core/erasure.test.ts, over three stores"],
    ["State is bounded: a cap, a retention horizon, a sweep", t("The cap evicts the stalest first, and retention deletes rather than hides.", "Cap mengusir yang paling lama dulu, dan retensi menghapus bukan menyembunyikan."), "src/core/store.test.ts, npm run soak"],
    ["A failing store is loud or refused", "D62", t("Fail-open is refused without an onError sink, at construction.", "Fail-open ditolak tanpa sink onError, saat konstruksi.")],
    ["A forbidden field is a rejection, nested and case-insensitive", "D70", "npm run protocol:check"],
    ["Binary limits on the wire", "D71", t("64 KiB body, 60 requests per minute per address, hourly aggregates.", "Body 64 KiB, 60 permintaan per menit per alamat, agregat per jam.")],
    ["The anomaly score is reported and never decides", "D67", "src/core/anomaly.test.ts"],
    ["The API surface cannot move by accident", "D74", "npm run check:api, api/v0.2.json"],
    ["The same input and the same state give the same advice", t("No randomness in the core, and the clock is injected.", "Tanpa keacakan di core, dan clock-nya disuntikkan."), "src/core/clock.ts, src/core/trust.test.ts"],
  ];

  const not = [
    ["A rotated entity key is invisible to the library", "D72", t("A per-request proof the host issues, which only the host can want.", "Bukti per-permintaan yang diterbitkan host, dan hanya host yang bisa menginginkannya.")],
    ["Poisoning is priced, not prevented", "D73", t("A mechanism beyond the intake discount, and the price table says what it would buy.", "Mekanisme di luar diskon intake, dan tabel harganya menunjukkan apa yang akan dibeli.")],
    ["The first-seen-rate diagnostic is not implemented", "D72", t("A new signal with its own calibration.", "Sinyal baru dengan kalibrasinya sendiri.")],
    ["Thresholds are not calibrated on a real population", "docs/DATASET.md", t("Real mixed traffic. The lab runs falsify; they do not calibrate.", "Trafik nyata yang campur. Run lab memfalsifikasi; ia tidak mengkalibrasi.")],
    ["The protocol endpoint is unauthenticated", "D17", t("A key, a rotation policy, and an argument about where the key lives.", "Kunci, kebijakan rotasi, dan argumen tentang di mana kunci itu tinggal.")],
    ["The framework integration is one example, not an adapter set", "M1.1", t("A support matrix and the tests behind it.", "Matriks dukungan dan test di belakangnya.")],
    ["Browser fingerprinting is the host call", t("The collector reports what the page reports.", "Collector melaporkan apa yang dilaporkan halaman."), t("Nothing here measures what the page does not report.", "Tidak ada di sini yang mengukur apa yang tidak dilaporkan halaman.")],
  ];

  const body = `
    <p class="lead">${t(
      "A guarantee is a claim with a test behind it, or it is marketing. Every row in the first table is enforced by something that runs on every push. Every row in the second table is a risk the project has measured, priced, or written down instead of solving, and the third column says what closing it would take.",
      "Jaminan adalah klaim dengan test di belakangnya, atau ia cuma pemasaran. Setiap baris di tabel pertama ditegakkan oleh sesuatu yang berjalan di tiap push. Setiap baris di tabel kedua adalah risiko yang sudah diukur, diberi harga, atau dituliskan alih-alih diselesaikan, dan kolom ketiga menjelaskan apa yang dibutuhkan untuk menutupnya.",
    )}</p>

    ${h2(1, "held", "What is held right now", "Yang dipegang sekarang")}

    <table>
      <caption>${t("Checked against version " + version + " and " + testCount + " tests", "Diperiksa terhadap versi " + version + " dan " + testCount + " test")}</caption>
      <thead><tr><th>${t("Guarantee", "Jaminan")}</th><th>${t("Reference", "Rujukan")}</th><th>${t("Enforced by", "Ditegakkan oleh")}</th></tr></thead>
      <tbody>
        ${held.map(([claim, ref, how]) => `<tr><td>${claim}</td><th>${ref}</th><td>${how}</td></tr>`).join("\n        ")}
      </tbody>
    </table>

    ${h2(2, "measured", "What is measured", "Yang diukur")}

    <p>${t(
      "Two lab runs are recorded, with their composition: 129 requests over two targets with fourteen persona runs, then 1656 requests over three targets with twenty four personas at eight instances each. Both runs end with zero false positives. The false negatives are six and seven, and every one is named in the dataset document rather than summarised.",
      "Dua run lab tercatat, dengan komposisinya: 129 permintaan di dua target dengan empat belas run persona, lalu 1656 permintaan di tiga target dengan dua puluh empat persona masing masing delapan instance. Kedua run berakhir tanpa false positive. False negative-nya enam dan tujuh, dan semuanya disebut namanya di dokumen dataset, bukan diringkas.",
    )}</p>

    <p>${t(
      "A number without a composition is a slogan, so the composition travels with it: which persona, how many requests, which seed, which browser, which machine, and the trust store beside the records so any decision can be replayed against the state that made it.",
      "Angka tanpa komposisi hanyalah slogan, jadi komposisinya ikut: persona mana, berapa permintaan, seed mana, browser mana, mesin mana, dan trust store di samping rekamannya sehingga keputusan mana pun bisa diputar ulang terhadap state yang membuatnya.",
    )}</p>

    <p>${t(
      "What these runs cannot do is calibrate. The personas were invented for the test, so a zero here says the policy does not punish the behaviour this project imagined as normal. It does not say the policy will not punish yours. That sentence is the reason 1.0.0 is still ahead, and it is cheaper to write it here than to discover it in production.",
      "Yang tidak bisa dilakukan run ini adalah kalibrasi. Persona-nya diciptakan untuk test, jadi nol di sini berarti policy tidak menghukum perilaku yang dibayangkan proyek ini sebagai normal. Ia tidak berarti policy tidak akan menghukum perilaku Anda. Kalimat itu alasan 1.0.0 masih di depan, dan lebih murah menuliskannya di sini daripada menemukannya di produksi.",
    )}</p>

    ${h2(3, "not", "What is not guaranteed", "Yang tidak dijamin")}

    <p>${t(
      "These are not oversights that slipped through. Each one has a decision, a measurement, or a document behind it, and the honest version of the claim is in the middle column.",
      "Ini bukan kelalaian yang lolos. Tiap baris punya keputusan, pengukuran, atau dokumen di belakangnya, dan versi jujur dari klaimnya ada di kolom tengah.",
    )}</p>

    <table>
      <caption>${t("Measured, priced, or declared, not solved", "Diukur, diberi harga, atau dinyatakan, bukan diselesaikan")}</caption>
      <thead><tr><th>${t("Risk", "Risiko")}</th><th>${t("Reference", "Rujukan")}</th><th>${t("What closing it would take", "Apa yang dibutuhkan untuk menutupnya")}</th></tr></thead>
      <tbody>
        ${not.map(([risk, ref, how]) => `<tr><td>${risk}</td><th>${ref}</th><td>${how}</td></tr>`).join("\n        ")}
      </tbody>
    </table>

    ${h2(4, "exit", "What 1.0.0 adds", "Apa yang ditambah 1.0.0")}

    <p>${t(
      "1.0.0 is not a date. It is three proofs, listed in the roadmap: a calibration dataset with its composition published, the protocol running end to end with a reference receiver and interop fixtures, and a frozen API after a directed security review. Two of the three are already in place or in part: the protocol runs end to end and is checked on every push, and the freeze is enforced by the API gate. The calibration dataset and the review by someone other than the author are the ones still missing.",
      "1.0.0 bukan tanggal. Ia tiga bukti, tercantum di roadmap: dataset kalibrasi dengan komposisi yang diterbitkan, protokol yang berjalan end to end dengan reference receiver dan fixture interop, dan API yang dibekukan setelah review keamanan terarah. Dua dari tiga sudah ada atau sebagian: protokol berjalan end to end dan diperiksa tiap push, dan pembekuannya ditegakkan gerbang API. Yang masih kurang adalah dataset kalibrasi dan review oleh orang selain penulisnya.",
    )}</p>

    <p>${t(
      "What 1.0.0 will not do: weaken a row in the first table without saying so in the CHANGELOG, or promote a row from the second table to the first by moving a number. A guarantee that quietly becomes a wish is worse than a risk that was named on the day it was accepted.",
      "Yang tidak akan dilakukan 1.0.0: melemahkan baris di tabel pertama tanpa mengatakannya di CHANGELOG, atau menaikkan baris dari tabel kedua ke tabel pertama dengan menggeser angka. Jaminan yang diam diam berubah jadi harapan lebih buruk daripada risiko yang disebutkan di hari ia diterima.",
    )}</p>

    <p>${t(
      "This page is written at 0.2.0 on purpose. A promise published before the release is one that someone else can check while it is still cheap to change, which is the only moment a promise is worth anything.",
      "Halaman ini ditulis di 0.2.0 dengan sengaja. Janji yang terbit sebelum rilis adalah janji yang bisa diperiksa orang lain saat masih murah untuk diubah, dan itulah satu satunya saat sebuah janji bernilai.",
    )}</p>

    <p class="seealso"><b>${t("See also", "Lihat juga")}</b>
      <a href="limits.html">${t("What is not known yet", "Yang belum diketahui")}</a>
      <a href="versions.html">${t("Versions and support", "Versi dan dukungan")}</a>
      <a href="usage.html">${t("Using the library", "Memakai library")}</a>
      <a href="record.html">${t("The design record", "Rekaman desain")}</a>
    </p>
  `;

  return page({
    file: "guarantees.html",
    titleEn: "What is guaranteed",
    titleId: "Apa yang dijamin",
    subtitleEn: "The claims that a test enforces today, the risks that are priced instead of solved, and what 1.0.0 is waiting for.",
    subtitleId: "Klaim yang ditegakkan test hari ini, risiko yang diberi harga alih alih diselesaikan, dan apa yang ditunggu 1.0.0.",
    sections,
    body,
  });
}

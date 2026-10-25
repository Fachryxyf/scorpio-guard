import { h2, page, t } from "../layout.mjs";

export function versions(data) {
  const { version } = data;
  const sections = [
    { id: "now", en: "Where the package is", id_: "Posisi paket" },
    { id: "policy", en: "What a number promises", id_: "Apa arti nomor versi" },
    { id: "deprecation", en: "Deprecation", id_: "Deprecation" },
    { id: "migration", en: "Migrating from 0.1.0", id_: "Migrasi dari 0.1.0" },
    { id: "freeze", en: "The API gate", id_: "Gerbang API" },
  ];

  const rows = [
    ["patch", t("unchanged", "tidak berubah"), t("unchanged for the same input and the same stored state", "tidak berubah untuk input dan state tersimpan yang sama")],
    ["minor", t("additions only, no removals and no kind changes", "hanya penambahan, tanpa penghapusan dan tanpa perubahan jenis"), t("may change, and each change is recorded with a before and after", "boleh berubah, dan tiap perubahan dicatat dengan sebelum dan sesudah")],
    ["major", t("removals, kind changes, a protocol major, a decision vocabulary change", "penghapusan, perubahan jenis, major protokol, perubahan kosakata keputusan"), t("anything", "apa pun")],
  ];

  const migrated = [
    ["D40, D46", t("An epistemic stage precedes trust; <code>developing</code> permits at most <code>OBSERVE</code>", "Tahap epistemik mendahului trust; <code>developing</code> paling jauh <code>OBSERVE</code>"), t("A third observation could turn silence into friction", "Observasi ketiga bisa mengubah diam menjadi friction")],
    ["D38", t("A soft invariant violation is strong negative evidence", "Pelanggaran invariant soft menjadi bukti negatif kuat"), t("It was its own decision input", "Ia adalah input keputusan tersendiri")],
    ["D39", t("The cold-start band is gone: no history is <code>unknown</code>", "Band cold-start hilang: tanpa riwayat berarti <code>unknown</code>"), t("It landed in a suspicion band", "Ia mendarat di band curiga")],
    ["D54, D55", t("Positives at machine-regular gaps are discounted; the farming rate floor reports but no longer escalates", "Positif dengan jeda teratur seperti mesin didiskon; lantai rate farming melapor tapi tak lagi menaikkan" ), t("Regular volume built trust at full weight, and a rate threshold produced friction", "Volume teratur membangun trust penuh, dan ambang rate menghasilkan friction")],
  ];

  const body = `
    <p class="lead">${t(
      "Two versions exist: 0.1.0, which the registry serves, and " + version + ", which is tagged on main and blocked from publishing. This page says what each number promises, what the upgrade moves, and how the freeze is enforced.",
      "Ada dua versi: 0.1.0 yang dilayani registry, dan " + version + " yang sudah ditandai di main dan tertahan publikasinya. Halaman ini menjelaskan arti tiap nomor, apa yang berubah saat naik versi, dan bagaimana pembekuannya ditegakkan.",
    )}</p>

    ${h2(1, "now", "Where the package is", "Posisi paket")}

    <table>
      <caption>${t("As of 2026-10-25", "Per 2026-10-25")}</caption>
      <thead><tr><th>${t("Version", "Versi")}</th><th>${t("State", "Keadaan")}</th></th><tr></thead>
      <tbody>
        <tr><th>0.1.0</th><td>${t("Published. What <code>npm install</code> gets today.", "Terbit. Yang didapat <code>npm install</code> hari ini.")}</td></tr>
        <tr><th>${version}</th><td>${t("Tagged on main, not published. The npm account behind the package is suspended for 72 hours as of 2026-10-25, so publishing is blocked until roughly 2026-10-28. The code is not the blocker: every gate is green.", "Ditandai di main, belum terbit. Akun npm di balik paket ini disuspend 72 jam per 2026-10-25, jadi publikasi tertahan sampai sekitar 2026-10-28. Kodenya bukan penghambat: semua gate hijau.")}</td></tr>
        <tr><th>${t("Node", "Node")}</th><td>22.13 ${t("or newer. The sqlite entry needs it because it uses <code>node:sqlite</code>.", "atau lebih baru. Entri sqlite memerlukannya karena memakai <code>node:sqlite</code>.")}</td></tr>
      </tbody>
    </table>

    <p>${t(
      "The dated note above is part of the record, not decoration. It is removed in the same commit that publishes, because a status line that outlives its cause is the same kind of slow-motion lie as a hand-copied number.",
      "Catatan bertanggal di atas adalah bagian dari rekaman, bukan hiasan. Ia dihapus di commit yang sama dengan publikasi, karena baris status yang hidup lebih lama dari sebabnya adalah kebohongan lambat yang sama dengan angka yang disalin tangan.",
    )}</p>

    ${h2(2, "policy", "What a number promises", "Apa arti nomor versi")}

    <table>
      <caption>${t("The rule, in force from 0.2.0", "Aturannya, berlaku sejak 0.2.0")}</caption>
      <thead><tr><th>${t("Bump", "Kenaikan")}</th><th>${t("API", "API")}</th><th>${t("Advice", "Saran")}</th></tr></thead>
      <tbody>
        ${rows.map(([bump, api, advice]) => `<tr><th>${bump}</th><td>${api}</td><td>${advice}</td></tr>`).join("\n        ")}
      </tbody>
    </table>

    <p>${t(
      "A behaviour change is an API change, but it is a minor one. This library exists to give advice, so freezing the advice would freeze the product; what a minor promises is that the change is written where an adopter can find it. Removals are major even in 0.x, which is stricter than semver asks and the only version of this that a 0.x user can upgrade through without reading the source.",
      "Perubahan perilaku adalah perubahan API, tapi ia minor. Library ini ada untuk memberi saran, jadi membekukan sarannya berarti membekukan produknya; yang dijanjikan minor adalah perubahannya tertulis di tempat yang bisa ditemukan adopter. Penghapusan tetap major walau masih 0.x, lebih ketat dari semver dan satu-satunya bentuk yang bisa dinaiki pengguna 0.x tanpa membaca sumbernya.",
    )}</p>

    ${h2(3, "deprecation", "Deprecation", "Deprecation")}

    <ul>
      <li>${t("A name is deprecated in its JSDoc with the replacement and the version that deprecated it, and it survives at least one minor release.", "Nama dideprecate di JSDoc-nya dengan pengganti dan versi yang mendeptecate-nya, dan ia bertahan minimal satu rilis minor.")}</li>
      <li>${t("No runtime warnings. The library never writes to the host standard output or error stream, because a dependency that logs into someone else process gets removed.", "Tanpa peringatan runtime. Library tak pernah menulis ke stdout atau stderr host, karena dependensi yang menulis ke proses orang lain akan dicabut.")}</li>
      <li>${t("Types count. Removing a field from an exported type is a removal and needs a major, whether or not the runtime still ignores it.", "Tipe dihitung. Menghapus field dari tipe yang diekspor adalah penghapusan dan butuh major, terlepas runtime masih mengabaikannya.")}</li>
    </ul>

    ${h2(4, "migration", "Migrating from 0.1.0", "Migrasi dari 0.1.0")}

    <p>${t(
      "The surface moved additively: seven names added to the root entry, the whole <code>./kv</code> entry point added with eight names, nothing removed, no name changed kind. The advice is where the upgrade is felt.",
      "Permukaannya bertambah saja: tujuh nama ditambahkan ke entri akar, seluruh entri <code>./kv</code> ditambahkan dengan delapan nama, tak ada yang dihapus, tak ada nama yang berubah jenis. Yang terasa saat naik versi adalah sarannya.",
    )}</p>

    <table>
      <caption>${t("Advice changes an adopter can feel", "Perubahan saran yang terasa oleh adopter")}</caption>
      <thead><tr><th>${t("Ref", "Rujukan")}</th><th>${t("Now", "Sekarang")}</th><th>${t("Before", "Sebelumnya")}</th></tr></thead>
      <tbody>
        ${migrated.map(([ref, now, before]) => `<tr><th>${ref}</th><td>${now}</td><td>${before}</td></tr>`).join("\n        ")}
      </tbody>
    </table>

    <p>${t(
      "There is no state migration step. <code>EntityState</code> has the same fields in both versions and the SQLite table is the same three columns, so a database written by 0.1.0 is readable by 0.2.0. What differs after the upgrade is the advice computed from that state.<br><br>The full list, including the erasure, anomaly, and observer changes, is in <code>docs/MIGRATION.md</code> in the repository, with the commands that reproduce the surface diff.",
      "Tidak ada langkah migrasi state. <code>EntityState</code> punya field yang sama di kedua versi dan tabel SQLite-nya sama-sama tiga kolom, jadi database yang ditulis 0.1.0 bisa dibaca 0.2.0. Yang berbeda setelah naik versi adalah saran yang dihitung dari state itu.<br><br>Daftar lengkapnya, termasuk perubahan erasure, anomali, dan observer, ada di <code>docs/MIGRATION.md</code> di repositori, beserta perintah untuk mereproduksi selisih permukaannya.",
    )}</p>

    ${h2(5, "freeze", "The API gate", "Gerbang API")}

    <p>${t(
      "Every exported name per entry point is recorded in <code>api/v0.2.json</code>: 140 names across four entries, 102 in the root, 27 in the collector, 8 in the key-value store, 3 in SQLite. <code>npm run check:api</code> reads the built declarations with the TypeScript checker and fails on any added, removed, or re-kinded name, so a new export is never accidental and a removal is never quiet.",
      "Setiap nama yang diekspor per titik masuk dicatat di <code>api/v0.2.json</code>: 140 nama di empat entri, 102 di akar, 27 di collector, 8 di penyimpanan key-value, 3 di SQLite. <code>npm run check:api</code> membaca deklarasi hasil build dengan checker TypeScript dan gagal pada nama yang ditambah, dihapus, atau berubah jenis, jadi ekspor baru tak pernah tak sengaja dan penghapusan tak pernah senyap.",
    )}</p>

    <p>${t(
      "The gate records names and kinds, not the members of exported types: narrowing a field is visible in the declaration diff and invisible to the check. That review is a person reading the diff, and the snapshot is not a substitute for it.",
      "Gerbang ini mencatat nama dan jenis, bukan anggota tipe yang diekspor: mempersempit sebuah field terlihat di selisih deklarasi dan tak terlihat oleh cek. Review itu adalah orang yang membaca selisihnya, dan snapshot bukan penggantinya.",
    )}</p>

    <p class="seealso"><b>${t("See also", "Lihat juga")}</b>
      <a href="usage.html#install">${t("Install", "Pasang")}</a>
      <a href="limits.html">${t("What is not known yet", "Yang belum diketahui")}</a>
      <a href="record.html">${t("The design record", "Rekaman desain")}</a>
    </p>
  `;

  return page({
    file: "versions.html",
    titleEn: "Versions and support",
    titleId: "Versi dan dukungan",
    subtitleEn: "What each number promises, what the upgrade moves, how the freeze is enforced, and why " + version + " is not on the registry yet.",
    subtitleId: "Arti tiap nomor, apa yang berubah saat naik versi, bagaimana pembekuannya ditegakkan, dan kenapa " + version + " belum ada di registry.",
    sections,
    body,
  });
}

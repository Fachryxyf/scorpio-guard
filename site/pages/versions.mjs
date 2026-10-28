import { h2, page, t } from "../layout.mjs";

export function versions(data) {
  // Registry facts, not tree facts: this is the newest version npm has accepted, and it is
  // updated in the release commit that records the upload, never by a version bump alone.
  const latest = "0.2.1";
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
      "Three versions are on the registry: 0.1.0, 0.2.0, and " + latest + ", a documentation-only patch and the default. This page says what each number promises, what the upgrade moves, and how the freeze is enforced.",
      "Ada tiga versi di registry: 0.1.0, 0.2.0, dan " + latest + ", patch khusus dokumentasi dan sekarang jadi bawaan. Halaman ini menjelaskan arti tiap nomor, apa yang berubah saat naik versi, dan bagaimana pembekuannya ditegakkan.",
    )}</p>

    ${h2(1, "now", "Where the package is", "Posisi paket")}

    <table>
      <caption>${t("As of 2026-10-28", "Per 2026-10-28")}</caption>
      <thead><tr><th>${t("Version", "Versi")}</th><th>${t("State", "Keadaan")}</th></th><tr></thead>
      <tbody>
        <tr><th>0.1.0</th><td>${t("Published on 2026-08-24 and still installable: the way back if 0.2.0 disagrees with your traffic. No attestation, because it was uploaded by hand and tagged two months later.", "Terbit 2026-08-24 dan masih bisa dipasang: jalan kembali kalau 0.2.0 tidak cocok dengan trafik Anda. Tanpa attestation, karena diunggah dengan tangan dan baru diberi tag dua bulan kemudian.")}</td></tr>
        <tr><th>0.2.0</th><td>${t("Published on 2026-10-28, and what <code>npm install</code> gets today. Uploaded by <code>release.yml</code> from the tag <code>v0.2.0</code> on commit <code>0f426b1</code>, so the registry holds a provenance attestation tying the tarball to that commit.", "Terbit 2026-10-28, dan yang didapat <code>npm install</code> hari ini. Diunggah oleh <code>release.yml</code> dari tag <code>v0.2.0</code> pada commit <code>0f426b1</code>, jadi registry menyimpan attestation provenance yang mengikat tarball ke commit itu.")}</td></tr>
        <tr><th>${latest}</th><td>${t("Published on 2026-10-28 as well, and what <code>npm install</code> gets today. Documentation only: no code, no exported name, and no advice change. Uploaded by <code>release.yml</code> from the tag <code>v0.2.1</code> on commit <code>b85294a</code>, shasum <code>361cd94a</code>.", "Juga terbit 2026-10-28, dan yang didapat <code>npm install</code> hari ini. Hanya dokumentasi: tanpa perubahan kode, nama ekspor, atau saran. Diunggah oleh <code>release.yml</code> dari tag <code>v0.2.1</code> pada commit <code>b85294a</code>, shasum <code>361cd94a</code>.")}</td></tr>
        <tr><th>${t("Node", "Node")}</th><td>22.13 ${t("or newer. The sqlite entry needs it because it uses <code>node:sqlite</code>.", "atau lebih baru. Entri sqlite memerlukannya karena memakai <code>node:sqlite</code>.")}</td></tr>
      </tbody>
    </table>

    <p>${t(
      "The dates above are part of the record, not decoration. Publishing by hand left 0.1.0 with no attestation and no tag until two months had passed; 0.2.0 was pushed by the workflow from the tag, which is why the registry can say where that tarball came from. 0.2.1 followed the same path minutes after it was tagged, and it carries the same kind of attestation for a tarball that only changed documents.",
      "Tanggal di atas adalah bagian dari rekaman, bukan hiasan. Publikasi dengan tangan meninggalkan 0.1.0 tanpa attestation dan tanpa tag sampai dua bulan berlalu; 0.2.0 didorong oleh workflow dari tag, karena itu registry bisa menyebut dari mana tarball itu berasal.",
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
    subtitleEn: "What each number promises, what the upgrade moves, how the freeze is enforced, and what the registry recorded for " + latest + ".",
    subtitleId: "Arti tiap nomor, apa yang berubah saat naik versi, bagaimana pembekuannya ditegakkan, dan apa yang registry catat untuk " + latest + ".",
    sections,
    body,
  });
}

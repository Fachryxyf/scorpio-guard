/**
 * Shared page shell for the site. D58.
 *
 * The site was one 2,600-line scroll containing every section of the README, and it
 * read like exactly that. The fix is not styling — it is that a reference work has
 * *pages*, and that its navigation is segmented: a reader who wants a number should
 * not have to walk through the premise to reach it.
 *
 * Typography is a reference-work model rather than a product-page one: an ordinary
 * sans text face at an ordinary reading size for the prose, a serif for headings,
 * and no colour at all. Colour was doing the work that structure should do — one
 * accent hue made every heading, link and label compete, and nothing on a site
 * about *uncertainty* should be shouting. Black on white; emphasis by weight, rule
 * and space.
 */

export const CSS = String.raw`
  :root {
    --ink: #101010;
    --ink-2: #4a4a4a;
    --ink-3: #6f6f6f;
    --paper: #ffffff;
    --paper-2: #f5f5f5;
    --paper-3: #ebebeb;
    --line: #9c9c9c;
    --line-2: #d6d6d6;
    --serif: 'Linux Libertine', Georgia, 'Times New Roman', serif;
    --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, system-ui, sans-serif;
    --mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
    --measure: 42rem;
    --side: 15rem;
  }
  html[data-theme="dark"] {
    --ink: #ededed;
    --ink-2: #b4b4b4;
    --ink-3: #8e8e8e;
    --paper: #0d0d0d;
    --paper-2: #171717;
    --paper-3: #202020;
    --line: #5e5e5e;
    --line-2: #2e2e2e;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  html[lang="en"] [data-lang="id"], html[lang="id"] [data-lang="en"] { display: none; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 0.9375rem/1.65 var(--sans);
  }
  a { color: var(--ink); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
  a:hover { text-decoration-thickness: 2px; }
  :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  code, pre, kbd, samp { font-family: var(--mono); font-size: 0.86em; }
  code { background: var(--paper-2); padding: 0.06em 0.28em; border: 1px solid var(--line-2); border-radius: 2px; }
  pre code { background: none; padding: 0; border: 0; font-size: 1em; }
  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: 1rem; top: 1rem; background: var(--paper-2); padding: .6rem 1rem; z-index: 30; }

  /* ---- masthead: a title block over a segmented menu, not a hero ---- */
  header.mast { position: sticky; top: 0; z-index: 20; background: var(--paper); border-bottom: 1px solid var(--line); }
  .mast .row {
    display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap;
    padding: .8rem 2rem .55rem;
  }
  .mast .title {
    font: 400 1.25rem/1.1 var(--serif); margin-right: auto;
    text-decoration: none; color: var(--ink);
  }
  .mast .title b { font-weight: 700; }
  .mast .title span { color: var(--ink-3); font: italic 400 .875rem/1 var(--serif); }
  .mast .tools { display: flex; gap: .4rem; }
  .mast button {
    font: .75rem/1 var(--sans); color: var(--ink-2); background: var(--paper);
    border: 1px solid var(--line); border-radius: 2px; padding: .35rem .5rem; cursor: pointer;
    min-width: 2.5rem; min-height: 1.9rem;
  }
  .mast button:hover { color: var(--ink); border-color: var(--ink); }

  /* segmented menu: right-aligned dropdowns, no dead labels */
  .mast nav.seg {
    display: flex; justify-content: flex-end; gap: .4rem; flex-wrap: wrap;
    padding: 0 2rem .55rem;
    border-top: 1px solid var(--line-2);
    padding-top: .5rem;
  }
  .mast nav.seg details { position: relative; }
  .mast nav.seg summary {
    list-style: none; cursor: pointer; user-select: none;
    font: 700 .75rem/1 var(--sans); letter-spacing: .08em; text-transform: uppercase;
    color: var(--ink-2); background: transparent; border: 1px solid transparent; border-radius: 2px;
    padding: .45rem .7rem;
  }
  .mast nav.seg summary::-webkit-details-marker { display: none; }
  .mast nav.seg summary::after {
    content: "\25BE"; font-size: .55rem; margin-left: .35rem; vertical-align: middle;
  }
  .mast nav.seg summary:hover { color: var(--ink); border-color: var(--line); }
  .mast nav.seg details[open] > summary,
  .mast nav.seg details.active > summary {
    color: var(--ink); background: var(--paper-2); border-color: var(--line);
  }
  .mast nav.seg .drop {
    position: absolute; right: 0; top: calc(100% + 4px); z-index: 30;
    min-width: 12rem; background: var(--paper); border: 1px solid var(--line);
    box-shadow: 0 2px 8px rgba(0,0,0,.12);
  }
  html[data-theme="dark"] .mast nav.seg .drop { box-shadow: 0 2px 8px rgba(0,0,0,.5); }
  .mast nav.seg .drop a {
    display: block; font: 400 .8125rem/1.4 var(--sans); color: var(--ink-2);
    text-decoration: none; padding: .45rem .8rem;
  }
  .mast nav.seg .drop a:hover { color: var(--ink); background: var(--paper-2); }
  .mast nav.seg .drop a[aria-current="page"] {
    color: var(--ink); font-weight: 700; background: var(--paper-3);
  }

  /* ---- body grid ---- */
  .wrap { display: grid; grid-template-columns: var(--side) minmax(0, 1fr); gap: 0; align-items: start; }
  aside.toc {
    position: sticky; top: 6.5rem; align-self: start;
    padding: 1.75rem 1.25rem 3rem; border-right: 1px solid var(--line-2);
    max-height: 100vh; overflow-y: auto;
  }
  aside.toc .lbl {
    font: 700 .625rem/1 var(--sans); letter-spacing: .11em; text-transform: uppercase;
    color: var(--ink-3); margin: 0 0 .6rem;
  }
  aside.toc ol { list-style: none; margin: 0 0 1.25rem; padding: 0; counter-reset: toc; }
  aside.toc li { counter-increment: toc; margin: 0; }
  aside.toc ol > li > a::before {
    content: counter(toc, decimal-leading-zero); color: var(--ink-3);
    font-variant-numeric: tabular-nums; font-size: .6875rem;
    float: left; width: 1.5rem; margin-left: -1.5rem;
    text-align: right; box-sizing: border-box; padding-right: .4rem;
  }
  aside.toc a {
    display: block; padding: .28rem 0; font-size: .8125rem; line-height: 1.45;
    color: var(--ink-2); text-decoration: none;
    border-left: 2px solid transparent; padding-left: .65rem;
  }
  aside.toc a:hover { color: var(--ink); text-decoration: underline; }
  aside.toc a[aria-current="true"] { color: var(--ink); font-weight: 700; border-left-color: var(--ink); }
aside.toc a[aria-current="true"]::before { color: var(--ink); }
  aside.toc ul { list-style: none; margin: 0 0 0 .9rem; padding: 0; }
  aside.toc ul a { font-size: .78125rem; color: var(--ink-3); }
  aside.toc .seg { border-top: 1px solid var(--line-2); padding-top: .9rem; margin-top: .25rem; }
  aside.toc .seg + .seg { margin-top: 1rem; }

  main { padding: 1.75rem 2.5rem 4.5rem; min-width: 0; }
  main > * { max-width: var(--measure); }
  main > .wide, main > figure, main > table, main > .eq, main > pre, main > .tnote { max-width: min(48rem, 100%); }

  h1 { font: 400 1.875rem/1.2 var(--serif); margin: 0 0 .3rem; }
  .subtitle {
    font: 400 1rem/1.55 var(--sans); color: var(--ink-2);
    margin: 0 0 1.4rem; padding-bottom: 1rem; border-bottom: 1px solid var(--line);
    max-width: min(48rem, 100%);
  }
  h2 {
    font: 400 1.375rem/1.3 var(--serif); margin: 2.25rem 0 .6rem;
    padding-bottom: .25rem; border-bottom: 1px solid var(--line-2);
    scroll-margin-top: 1rem; max-width: min(48rem, 100%);
  }
  h3 { font: 700 1rem/1.35 var(--sans); margin: 1.5rem 0 .4rem; scroll-margin-top: 1rem; }
  h4 {
    font: 700 .6875rem/1.4 var(--sans); letter-spacing: .09em; text-transform: uppercase;
    color: var(--ink-2); margin: 1.4rem 0 .35rem;
  }
  h2 .n, h3 .n { color: var(--ink-3); font-variant-numeric: tabular-nums; }
  p { margin: 0 0 .9rem; text-align: justify; hyphens: auto; -webkit-hyphens: auto; }
  .lead { font-size: 1.0625rem; line-height: 1.6; }
  ul, ol { margin: 0 0 .9rem; padding-left: 1.5rem; }
  li, dd { margin: 0 0 .3rem; text-align: justify; hyphens: auto; -webkit-hyphens: auto; }
  li > ul, li > ol { margin-top: .3rem; }
  strong, b { font-weight: 700; }

  blockquote {
    margin: 1.1rem 0; padding: .1rem 0 .1rem 1rem; border-left: 3px solid var(--line-2);
    color: var(--ink-2);
  }
  hr { border: 0; border-top: 1px solid var(--line-2); margin: 2.25rem 0; }

  pre {
    background: var(--paper-2); border: 1px solid var(--line-2);
    padding: .8rem .9rem; overflow-x: auto; margin: 0 0 1.1rem;
    font-size: .8125rem; line-height: 1.55; color: var(--ink);
  }

  /* ---- tables: the reference-work table. Ruled, shaded header, no colour. ---- */
  table {
    border-collapse: collapse; margin: 0 0 .4rem; width: 100%;
    font-size: .875rem; font-variant-numeric: tabular-nums;
    border: 1px solid var(--line);
  }
  caption {
    caption-side: top; text-align: left; margin-bottom: .4rem;
    font: 700 .6875rem/1.4 var(--sans); letter-spacing: .07em; text-transform: uppercase;
    color: var(--ink-2);
  }
  th, td { text-align: left; vertical-align: top; padding: .35rem .6rem; border: 1px solid var(--line-2); }
  thead th { background: var(--paper-2); border-bottom: 1px solid var(--line); font: 700 .8125rem/1.35 var(--sans); }
  tbody th { font: 400 .8125rem/1.4 var(--mono); background: var(--paper-2); }
  td.num, th.num { text-align: right; }
  tr.tot td, tr.tot th { border-top: 1px solid var(--line); font-weight: 700; }
  .tnote { font-size: .8125rem; color: var(--ink-2); margin: 0 0 1.4rem; line-height: 1.55; }
  .scroll { overflow-x: auto; max-width: min(48rem, 100%); margin-bottom: .4rem; }
  .scroll table { margin-bottom: 0; }

  /* ---- figures ---- */
  figure { margin: 1.3rem 0; }
  figure svg.chart { display: block; width: 100%; height: auto; max-width: 100%; }
  figcaption {
    font-size: .8125rem; color: var(--ink-2); margin-top: .45rem;
    padding-top: .45rem; border-top: 1px solid var(--line-2); line-height: 1.55;
  }
  figcaption b { color: var(--ink); }
  .chart .c-axis { stroke: var(--ink); stroke-width: 1; }
  .chart .c-grid { stroke: var(--line-2); stroke-width: 1; stroke-dasharray: 2 3; }
  .chart .c-hatch { stroke: var(--line); stroke-width: 1; }
  .chart .c-line { stroke: var(--ink); }
  .chart .c-dot { fill: var(--ink); }
  .chart .c-dot-hollow { fill: var(--paper); stroke: var(--ink); stroke-width: 1; }
  .chart .c-bar { fill: var(--ink); }
  .chart .c-bar-hollow { fill: none; stroke: var(--ink); stroke-width: 1; }
  .chart text { fill: var(--ink-2); }
  .chart .c-tick { font-size: 10px; }
  .chart .c-series { font-size: 11px; fill: var(--ink); font-style: italic; }
  .chart .c-value { font-size: 10px; fill: var(--ink); }
  .chart .c-band { font-size: 9px; fill: var(--ink-3); letter-spacing: .04em; }

  /* ---- display formulas ---- */
  .eq {
    margin: 1.1rem 0; padding: .8rem 1rem; background: var(--paper-2);
    border: 1px solid var(--line-2);
    font-family: var(--mono); font-size: .875rem; line-height: 1.75;
    overflow-x: auto;
  }
  .eq .where {
    display: block; margin-top: .55rem; padding-top: .5rem;
    border-top: 1px solid var(--line-2);
    font: .75rem/1.6 var(--sans); color: var(--ink-2);
  }
  .eq-n { float: right; color: var(--ink-3); font-size: .8125rem; }

  /* ---- infobox: the one wiki habit that earns its place ---- */
  .infobox {
    float: right; clear: right; width: 18rem; max-width: 100%;
    margin: .2rem 0 1.1rem 1.5rem;
    border: 1px solid var(--line); background: var(--paper-2);
    font-size: .8125rem;
  }
  .infobox > .cap {
    margin: 0; padding: .45rem .7rem; border-bottom: 1px solid var(--line);
    font: 700 .8125rem/1.3 var(--sans); text-align: center; background: var(--paper-3);
  }
  .infobox table { margin: 0; border: 0; font-size: .8125rem; }
  .infobox th, .infobox td { padding: .3rem .7rem; border: 0; border-top: 1px solid var(--line-2); }
  .infobox tbody tr:first-child th, .infobox tbody tr:first-child td { border-top: 0; }
  .infobox th { width: 7rem; font: 400 .75rem/1.4 var(--sans); color: var(--ink-2); background: none; }
  .infobox td { font-family: var(--mono); font-size: .75rem; }

  /* ---- definition lists ---- */
  dl { margin: 0 0 1.1rem; }
  dt { font-weight: 700; margin-top: .8rem; scroll-margin-top: 1rem; }
  dt:first-child { margin-top: 0; }
  dd { margin: .1rem 0 0; color: var(--ink-2); }
  dl.compact dt { font: 700 .875rem/1.4 var(--mono); }

  /* ---- the status ledger ---- */
  table.ledger td:first-child { width: 55%; }
  .yes::before { content: "\2713\00a0"; }
  .no::before { content: "\2014\00a0"; }
  .part::before { content: "\00bd\00a0"; }

  /* ---- segmented chapter portals on the front page ---- */
  .portals { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 0 1.75rem; max-width: min(48rem, 100%); }
  .portals section { margin: 0 0 1.25rem; }
  .portals h3 {
    margin: 0 0 .4rem; padding-bottom: .25rem; border-bottom: 1px solid var(--line-2);
    font: 700 .6875rem/1.4 var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2);
  }
  .portals ul { list-style: none; margin: 0; padding: 0; }
  .portals li { margin: 0 0 .5rem; }
  .portals a { font-weight: 700; text-decoration: none; }
  .portals a:hover { text-decoration: underline; }
  .portals .d { display: block; color: var(--ink-2); font-size: .8125rem; line-height: 1.5; }

  /* ---- cross references ---- */
  .seealso {
    margin: 2rem 0 0; padding-top: .7rem; border-top: 1px solid var(--line-2);
    font-size: .875rem; color: var(--ink-2); max-width: min(48rem, 100%);
  }
  .seealso b {
    display: block; font: 700 .6875rem/1.4 var(--sans);
    letter-spacing: .1em; text-transform: uppercase; margin-bottom: .2rem;
  }
  .seealso a + a::before { content: " \00b7 "; color: var(--line); text-decoration: none; }

  /* ---- provenance line ---- */
  .prov {
    font-size: .75rem; color: var(--ink-3); line-height: 1.6;
    border-top: 1px solid var(--line-2); padding-top: .6rem; margin-top: 2rem;
    max-width: min(48rem, 100%);
  }

  footer {
    border-top: 1px solid var(--line); margin-top: 3.5rem;
    padding: 1.1rem 2.5rem 2.5rem;
    font-size: .8125rem; color: var(--ink-2); line-height: 1.65;
  }
  footer a { color: var(--ink-2); }

  @media (max-width: 62rem) {
    .wrap { grid-template-columns: 1fr; }
    aside.toc {
      position: static; max-height: none; border-right: 0;
      border-bottom: 1px solid var(--line-2); padding: 1rem 1.5rem;
    }
    aside.toc details > summary {
      font: 700 .6875rem/1 var(--sans); letter-spacing: .1em; text-transform: uppercase;
      color: var(--ink-2); cursor: pointer; padding: .3rem 0;
    }
    .mast .row, .mast nav.seg { padding-left: 1.5rem; padding-right: 1.5rem; }
    .mast nav.seg { gap: 0 1.25rem; }
    main { padding: 1.5rem 1.5rem 3rem; }
    footer { padding: 1.1rem 1.5rem 2.5rem; }
    .infobox { float: none; width: 100%; margin: 1.1rem 0; }
  }
  @media print {
    aside.toc, .mast nav.seg, .mast .tools, footer { display: none; }
    body { background: #fff; color: #000; font-size: 10pt; }
    main { padding: 0; }
    h2 { page-break-after: avoid; }
    figure, table, pre { page-break-inside: avoid; }
  }
`;

/**
 * Every chapter, in reading order, grouped into the four segments the menu shows.
 *
 * The grouping is the navigation: eight equal tabs is a list, and a reader with a
 * question does not know which of eight to try. `Start` is for someone who arrived
 * from a link, `Theory` is the argument, `Findings` is what was measured and what
 * it does not cover, `Reference` is what you look up rather than read.
 */
export const CHAPTERS = [
  { file: 'index.html', segment: 'start', en: 'Overview', id: 'Ringkasan',
    titleEn: 'Scorpio Guard', titleId: 'Scorpio Guard',
    blurbEn: 'What it is, what it refuses to be, and how far along it is.',
    blurbId: 'Apa ini, apa yang ia tolak jadi, dan sudah sampai mana.' },
  { file: 'usage.html', segment: 'start', en: 'Usage', id: 'Pemakaian',
    titleEn: 'Using the library', titleId: 'Memakai library-nya',
    blurbEn: 'Install, evaluate, read a trace, declare an invariant, write a store, tune a policy.',
    blurbId: 'Pasang, evaluasi, baca trace, deklarasikan invariant, tulis store, setel policy.' },
  { file: 'model.html', segment: 'theory', en: 'Model', id: 'Model',
    titleEn: 'The trust model', titleId: 'Model trust',
    blurbEn: 'Beta-Bernoulli state, decay as a half-life, and the four dimensions that reach a decision.',
    blurbId: 'State Beta-Bernoulli, decay sebagai half-life, dan empat dimensi yang sampai ke keputusan.' },
  { file: 'evidence.html', segment: 'theory', en: 'Evidence', id: 'Evidence',
    titleEn: 'Proof and measurement', titleId: 'Bukti dan pengukuran',
    blurbEn: 'Seven classes of provable impossibility, ten weak signals, and why they may never be mixed.',
    blurbId: 'Tujuh kelas ketidakmungkinan yang bisa dibuktikan, sepuluh weak signal, dan kenapa keduanya tak boleh dicampur.' },
  { file: 'results.html', segment: 'findings', en: 'Results', id: 'Hasil',
    titleEn: 'Measurements', titleId: 'Pengukuran',
    blurbEn: 'Every number the design argues from: formulas, tables, figures, and one live run.',
    blurbId: 'Setiap angka yang jadi dasar argumen desain ini: rumus, tabel, grafik, dan satu run langsung.' },
  { file: 'limits.html', segment: 'findings', en: 'Limits', id: 'Batas',
    titleEn: 'What is not known', titleId: 'Yang belum diketahui',
    blurbEn: 'Open problems, unvalidated numbers, and the claims that have been withdrawn.',
    blurbId: 'Masalah terbuka, angka yang belum tervalidasi, dan klaim yang sudah ditarik.' },
  { file: 'protocol.html', segment: 'reference', en: 'Protocol', id: 'Protokol',
    titleEn: 'Symptom and prescription', titleId: 'Symptom dan prescription',
    blurbEn: 'What may cross the wire, what structurally cannot, and why nothing transmits yet.',
    blurbId: 'Apa yang boleh lewat kabel, apa yang secara struktural tak bisa, dan kenapa belum ada yang dikirim.' },
  { file: 'record.html', segment: 'reference', en: 'Record', id: 'Rekaman',
    titleEn: 'Design record and glossary', titleId: 'Rekaman desain dan glosarium',
    blurbEn: 'Every numbered decision, the file it became, and the vocabulary this project uses narrowly.',
    blurbId: 'Setiap keputusan bernomor, file yang ia jadi, dan kosakata yang dipakai proyek ini secara sempit.' },
];

/** The menu segments, in order. */
export const SEGMENTS = [
  { id: 'start', en: 'Start', id_: 'Mulai' },
  { id: 'theory', en: 'Theory', id_: 'Teori' },
  { id: 'findings', en: 'Findings', id_: 'Temuan' },
  { id: 'reference', en: 'Reference', id_: 'Rujukan' },
];

export const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `en` / `id` pair. Everything user-facing goes through this. */
export function t(en, id) {
  return `<span data-lang="en">${en}</span><span data-lang="id">${id}</span>`;
}

/** Section heading with a stable anchor and a chapter-relative number. */
export function h2(index, id, en, idText) {
  return `<h2 id="${id}"><span class="n">${index}.</span> ${t(en, idText)}</h2>`;
}

/** A numbered display formula with its `where` clause. */
export function eq(number, lines, whereEn, whereId) {
  return `<div class="eq"><span class="eq-n">(${number})</span>
      ${lines}
      <span class="where">${t(whereEn, whereId)}</span>
    </div>`;
}

/** A figure: chart markup plus a numbered caption. */
export function figure(svg, captionEn, captionId) {
  return `<figure>
      ${svg}
      <figcaption>${t(captionEn, captionId)}</figcaption>
    </figure>`;
}

export function page({ file, titleEn, titleId, subtitleEn, subtitleId, sections, body, extraHead = '' }) {
  // Dropdown menus: the segment name is a button that opens a chapter list.
  // No dead labels — every visible word is either a trigger or a destination.
  const nav = SEGMENTS.map((segment) => {
    const chapters = CHAPTERS.filter((chapter) => chapter.segment === segment.id);
    const active = chapters.some((chapter) => chapter.file === file);
    const links = chapters
      .map(
        (chapter) =>
          `          <a href="${chapter.file}"${chapter.file === file ? ' aria-current="page"' : ''}>${t(chapter.en, chapter.id)}</a>`,
      )
      .join('\n');
    return `      <details class="dropdown"${active ? ' data-active' : ''}>
        <summary aria-haspopup="true">${t(segment.en, segment.id_)}</summary>
        <nav class="drop" aria-label="${escape(segment.en)}">
${links}
        </nav>
      </details>`;
  }).join('\n');

  const toc = sections.length
    ? `<p class="lbl">${t('On this page', 'Di halaman ini')}</p>
      <ol>
${sections
  .map(
    (section) =>
      `        <li><a href="#${section.id}">${t(section.en, section.id_)}</a>${
        section.sub
          ? `\n          <ul>${section.sub
              .map((sub) => `<li><a href="#${sub.id}">${t(sub.en, sub.id_)}</a></li>`)
              .join('')}</ul>`
          : ''
      }</li>`,
  )
  .join('\n')}
      </ol>`
    : '';



  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(titleEn)}${file === 'index.html' ? ' — adaptive trust evaluation for web interactions' : ' — Scorpio Guard'}</title>
<meta name="description" content="${escape(subtitleEn.replace(/<[^>]+>/g, ''))}">
<meta name="color-scheme" content="light dark">
<link rel="canonical" href="https://scorpio-guard.fachryxyf.com/${file === 'index.html' ? '' : file}">
<meta property="og:title" content="${escape(titleEn)}">
<meta property="og:description" content="${escape(subtitleEn.replace(/<[^>]+>/g, ''))}">
<meta property="og:url" content="https://scorpio-guard.fachryxyf.com/${file === 'index.html' ? '' : file}">
<meta property="og:type" content="${file === 'index.html' ? 'website' : 'article'}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23ffffff'/><text y='24' x='7' font-size='22' font-family='Georgia,serif'>S</text></svg>">
<script>
  (function () {
    try {
      var t = localStorage.getItem('sg-theme');
      if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      var l = localStorage.getItem('sg-lang');
      if (!l) l = (navigator.language || 'en').toLowerCase().startsWith('id') ? 'id' : 'en';
      document.documentElement.lang = l;
    } catch (e) {}
  })();
</script>
<style>${CSS}</style>${extraHead}
</head>
<body>
<a class="skip" href="#main">${t('Skip to content', 'Lompat ke konten')}</a>

<header class="mast">
  <div class="row">
    <a class="title" href="index.html"><b>Scorpio Guard</b> <span>${t('adaptive trust evaluation', 'evaluasi trust adaptif')}</span></a>
    <div class="tools">
      <button id="lang" type="button" aria-label="Switch language / Ganti bahasa">ID</button>
      <button id="theme" type="button" aria-label="Switch theme / Ganti tema">◐</button>
    </div>
  </div>
  <nav class="seg" aria-label="${escape('Chapters')}">
      ${nav}
  </nav>
</header>

<div class="wrap">
  <aside class="toc" aria-label="${escape('Table of contents')}">
    <details open>
      <summary>${t('Contents', 'Daftar isi')}</summary>
      ${toc}
    </details>
  </aside>

  <main id="main">
    <h1>${t(titleEn, titleId)}</h1>
    <p class="subtitle">${t(subtitleEn, subtitleId)}</p>
${body}
  </main>
</div>

<footer>
  <p>
    ${t(
      'Scorpio Guard is pre-alpha and calibrated against nothing. Every number on this site is generated from the code that produces it; none of it has met a real population.',
      'Scorpio Guard masih pre-alpha dan belum dikalibrasi terhadap apa pun. Setiap angka di situs ini dihasilkan dari kode yang memproduksinya; belum ada satu pun yang bertemu populasi nyata.',
    )}
  </p>
  <p>
    <a href="https://github.com/Fachryxyf/scorpio-guard">${t('Source', 'Sumber')}</a> ·
    <a href="https://github.com/Fachryxyf/scorpio-guard/blob/main/DECISIONS.md">${t('Design record', 'Rekaman desain')}</a> ·
    <a href="https://github.com/Fachryxyf/scorpio-guard/blob/main/PROTOCOL.md">${t('Protocol draft', 'Draf protokol')}</a> ·
    <a href="https://github.com/Fachryxyf/scorpio-guard/issues">${t('Issues', 'Isu')}</a>
    · MIT · <a href="https://github.com/Fachryxyf">@Fachryxyf</a>
  </p>
</footer>

<script>
  (function () {
    var root = document.documentElement;
    var langBtn = document.getElementById('lang');
    var themeBtn = document.getElementById('theme');

    function paintLang() { langBtn.textContent = root.lang === 'id' ? 'EN' : 'ID'; }
    paintLang();
    langBtn.addEventListener('click', function () {
      root.lang = root.lang === 'id' ? 'en' : 'id';
      try { localStorage.setItem('sg-lang', root.lang); } catch (e) {}
      paintLang();
    });
    themeBtn.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('sg-theme', root.dataset.theme); } catch (e) {}
    });

    // Dropdown: opening one closes the others; clicking outside closes all.
    var drops = [].slice.call(document.querySelectorAll('.mast nav.seg details'));
    if (drops.length) {
      document.addEventListener('click', function (e) {
        var inside = drops.some(function (d) { return d.contains(e.target); });
        if (!inside) drops.forEach(function (d) { d.removeAttribute('open'); });
      });
      drops.forEach(function (d) {
        d.querySelector('summary').addEventListener('click', function () {
          drops.forEach(function (other) { if (other !== d && other.hasAttribute('open')) other.removeAttribute('open'); });
        });
      });
    }

    // Mark the section being read. Progressive: the TOC works without it.
    var links = [].slice.call(document.querySelectorAll('aside.toc ol a'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var current = byId[entry.target.id];
        if (current) current.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-10% 0px -75% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  })();
</script>
</body>
</html>
`;
}

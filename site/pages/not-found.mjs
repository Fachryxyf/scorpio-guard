/**
 * The 404 page. D58.
 *
 * Deliberately not put through the chapter shell: it is the one page a reader
 * reaches by accident, so it gets its own panel rather than a table of contents for
 * a site they were not looking for. What it does share with every other page is the
 * theme and language bootstrap, so a preference set elsewhere survives arriving here.
 *
 * Generated like every other page. It used to be a hand-written file at the repo
 * root, which meant it carried its own copy of that bootstrap and drifted silently.
 */
import { headBootstrap, t } from '../layout.mjs';

const CSS = String.raw`
  :root {
    --bg: #101211;
    --bg-2: #171a18;
    --ink: #e6e4dd;
    --ink-2: #9a9890;
    --line: #2b2f2c;
    --accent: #d9a05b;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
  }
  html[data-theme="light"] {
    --bg: #f5f2ec;
    --bg-2: #ebe7de;
    --ink: #1b1a17;
    --ink-2: #635f57;
    --line: #d6d1c5;
    --accent: #a35c14;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem 1.5rem;
    background: var(--bg);
    color: var(--ink);
    font: 1rem/1.65 var(--sans);
  }
  html[lang="en"] [data-lang="id"], html[lang="id"] [data-lang="en"] { display: none; }

  .box {
    width: 100%;
    max-width: 34rem;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: var(--bg-2);
  }
  .chrome {
    display: flex; align-items: center; gap: .75rem;
    border-bottom: 1px solid var(--line);
    padding: .55rem .875rem;
    font: .6875rem/1 var(--mono);
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--ink-2);
  }
  .chrome .dots { letter-spacing: .2em; color: var(--line); }
  .chrome .grow { margin-left: auto; }
  button.ctl {
    font: .6875rem/1 var(--mono); letter-spacing: .06em;
    color: var(--ink-2); background: transparent;
    border: 1px solid var(--line); border-radius: 2px;
    padding: .4rem .55rem; cursor: pointer;
    min-width: 2.5rem; min-height: 2rem;
  }
  button.ctl:hover { color: var(--ink); border-color: var(--ink-2); }
  .pad { padding: 2rem 1.75rem 1.75rem; }

  .code {
    font: 400 clamp(3.25rem, 2rem + 9vw, 5.5rem)/.85 var(--mono);
    letter-spacing: -.04em;
    margin: 0;
    color: var(--accent);
  }
  .code span { color: var(--line); }
  .label {
    font: .6875rem/1 var(--mono); letter-spacing: .18em;
    text-transform: uppercase; color: var(--ink-2);
    margin: .875rem 0 1.25rem;
  }
  p { margin: 0 0 1rem; max-width: 44ch; }
  p.aside { color: var(--ink-2); font: .8125rem/1.6 var(--mono); }
  .home {
    display: inline-block; margin-top: .5rem;
    font: .8125rem/1 var(--mono); letter-spacing: .04em;
    color: var(--accent); text-decoration: none;
    border: 1px solid var(--accent); border-radius: 2px;
    padding: .7rem 1rem;
  }
  .home:hover { background: var(--accent); color: var(--bg); }
  .caret { color: var(--accent); animation: blink 1.15s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`;

export function notFound() {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 — nothing here | Scorpio Guard</title>
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark light">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='25' x='3' font-size='24' font-family='monospace'>%26gt;</text></svg>">
${headBootstrap({ defaultTheme: 'dark' })}
<style>${CSS}</style>
</head>
<body>
<main class="box">
  <div class="chrome">
    <span class="dots">• • •</span>
    ${t('trust.eval — no route', 'trust.eval — rute kosong')}
    <span class="grow"></span>
    <button class="ctl" id="lang" type="button" aria-label="Switch language / Ganti bahasa"></button>
    <button class="ctl" id="theme" type="button" aria-label="Switch theme / Ganti tema"></button>
  </div>

  <div class="pad">
    <p class="code">40<span>4</span></p>
    <p class="label">${t('Route not found', 'Rute tidak ditemukan')}</p>

    <p>${t(
      'This whole site is one page. One. So the honest question here is not what broke — it is how you managed to get <em>this</em> far off the path.',
      'Situs ini isinya cuma satu halaman. Satu. Jadi pertanyaannya bukan apa yang rusak, tapi gimana caranya kamu bisa nyasar sejauh <em>ini</em>.',
    )}</p>

    <p class="aside">${t(
      'verdict: unknown, not untrusted — Beta(1,1)<span class="caret">_</span>',
      'putusan: belum diketahui, bukan tak dipercaya — Beta(1,1)<span class="caret">_</span>',
    )}</p>

    <a class="home" href="/">${t('&larr; back to homepage', '&larr; balik ke halaman utama')}</a>
  </div>
</main>

<script>
  (function () {
    var root = document.documentElement;
    var themeBtn = document.getElementById('theme');
    var langBtn = document.getElementById('lang');

    function paint() {
      themeBtn.textContent = root.dataset.theme === 'dark' ? 'LIGHT' : 'DARK';
      langBtn.textContent = root.lang === 'en' ? 'ID' : 'EN';
      themeBtn.setAttribute('aria-pressed', root.dataset.theme === 'dark');
    }
    function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    themeBtn.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      store('sg-theme', root.dataset.theme);
      paint();
    });
    langBtn.addEventListener('click', function () {
      root.lang = root.lang === 'en' ? 'id' : 'en';
      store('sg-lang', root.lang);
      paint();
    });
    paint();
  })();
</script>
</body>
</html>
`;
}

/**
 * Drive a real browser at the live site, through the observer. D57.
 *
 * The honest reason this exists: the observer (D56) is built and pointed at a live
 * deployment that nobody visits, and promoting the site to produce visitors is not
 * work this project can do. So the visits are produced.
 *
 * **This is still generated traffic, and D45's limit applies unchanged.** Every
 * persona below is a hypothesis about how someone behaves. It falsifies; it does not
 * calibrate. What it adds over `examples/ixfe/personas.ts` is that nothing about the
 * *client* is invented any more:
 *
 * | | persona replay (D45) | this |
 * |---|---|---|
 * | `dwell` | a number chosen in a file | Chrome's own `Date.now()` difference |
 * | keystrokes | not present | real `Input.dispatchKeyEvent` per character |
 * | inter-arrival gaps | scheduled by a fake clock | actual elapsed wall time |
 * | page state | assumed | rendered, with the site's own scripts running |
 * | the request | constructed by the test | issued by the page's own `fetch` |
 *
 * So a threshold that fires here fires on a real browser's timing, which is a
 * stronger falsification than one that fires on invented numbers. The distributions
 * of *which* browsers and *how many* remain invented, and that is what still cannot
 * be calibrated from.
 *
 * The adversaries are `fetch`-based on purpose: an attacker who bothered to drive a
 * real browser would produce human-shaped timing, and the whole design premise (§1)
 * is that this is possible. These are the cheap attacks, which is what actually
 * arrives.
 *
 * Usage:
 *   node --experimental-strip-types examples/ixfe/live/visitors.ts \
 *     --target http://127.0.0.1:4100 --sessions 12
 */
import { connect, launch, sleep, type Browser, type Page } from './cdp.ts';

const CHROME_PORT = 9444;

/**
 * One user-agent per persona, all of them real strings.
 *
 * Necessary rather than decorative: the observer keys an entity on IP *and* UA
 * (D56), and every session here arrives from the same loopback address — so two
 * personas sharing a UA would be merged into one entity and the report would be
 * about a chimera. Reusing a UA is exactly the identity-churn case, in reverse.
 */
const AGENTS = {
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  desktopSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
  desktopFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  desktopEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  uptimeRobot: 'Mozilla/5.0+(compatible; UptimeRobot/2.0; https://uptimerobot.com/)',
  curl: 'curl/8.7.1',
  pythonBot: 'python-requests/2.32.3',
  scanner: 'Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)',
} as const;

export type VisitorSession = {
  readonly id: string;
  readonly legitimate: boolean;
  readonly what: string;
  /** `browser` sessions render the page; `client` sessions issue bare HTTP. */
  readonly kind: 'browser' | 'client';
  run(context: { target: string; browser: Browser }): Promise<void>;
};

/** Human reading pauses. Exponential, because attention is bursty (D54). */
function readPause(meanMs: number): Promise<void> {
  return sleep(-Math.log(1 - Math.random()) * meanMs);
}

async function openPage(browser: Browser, agent: string, mobile: boolean): Promise<Page> {
  return browser.newPage({
    userAgent: agent,
    viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 900 },
    mobile,
  });
}

/* ------------------------------------------------------------------ *
 * Legitimate visitors. None of these may be given friction.
 * ------------------------------------------------------------------ */

/** Lands, scrolls a bit, decides it is not for them, leaves. Most traffic is this. */
const skimmer: VisitorSession = {
  id: 'skimmer',
  legitimate: true,
  what: 'lands, scrolls, leaves without acting',
  kind: 'browser',
  async run({ target, browser }) {
    const page = await openPage(browser, AGENTS.desktopChrome, false);
    try {
      await page.goto(target);
      for (let i = 0; i < 4; i += 1) {
        await page.scrollBy(700 + Math.random() * 500);
        await readPause(1400);
      }
    } finally {
      await page.close();
    }
  },
};

/**
 * Reads the whole page, checks pricing, follows the order link, does not buy.
 *
 * Post-launch, `/order` 302s to `app.ixfe.pro/register`, so the pre-order form is not
 * reachable from a browser at all any more. That is left as-is rather than routed
 * around: a real visitor clicking "or order now" gets exactly this, and the redirect
 * is a request the observer should see.
 */
const researcher: VisitorSession = {
  id: 'researcher',
  legitimate: true,
  what: 'reads pricing, opens the order page, does not submit',
  kind: 'browser',
  async run({ target, browser }) {
    const page = await openPage(browser, AGENTS.desktopSafari, false);
    try {
      await page.goto(target);
      for (let i = 0; i < 6; i += 1) {
        await page.scrollBy(600 + Math.random() * 700);
        await readPause(2200);
      }
      await page.goto(`${target}/order?plan=pro`);
      await readPause(3500);
      await page.scrollBy(500);
      await readPause(2800);
      // Comparing plans is clicking, which is interaction the page can see.
      await page.click('[data-plan="starter"]').catch(() => {});
      await readPause(1900);
      await page.click('[data-plan="business"]').catch(() => {});
      await readPause(2400);
      await page.goto(`${target}/privacy`);
      await readPause(2000);
    } finally {
      await page.close();
    }
  },
};

/** Phone, one hand, fast scrolling, short attention. */
const mobileVisitor: VisitorSession = {
  id: 'mobile-visitor',
  legitimate: true,
  what: 'phone, fast scroll, short session',
  kind: 'browser',
  async run({ target, browser }) {
    const page = await openPage(browser, AGENTS.androidChrome, true);
    try {
      await page.goto(target);
      for (let i = 0; i < 7; i += 1) {
        await page.scrollBy(900 + Math.random() * 600);
        await readPause(700);
      }
      await page.goto(`${target}/order`);
      await readPause(1600);
    } finally {
      await page.close();
    }
  },
};

/**
 * Types an email into the waiting-list form and submits it, from a page that still
 * thinks the product is pre-launch.
 *
 * This is the most valuable legitimate case here, and the least obvious. The site is
 * live now, so `/api/waitlist` answers 410 — an honest visitor, honestly refused,
 * accruing negative evidence they did nothing to deserve. Whether SG escalates on
 * that is exactly the false-positive question D51 owes an answer to, and it did not
 * have to be invented: the site's own comment explains that a CDN- or
 * browser-cached copy carries the old phase, which is why the endpoint has to refuse
 * rather than the form being hidden.
 *
 * `data-phase` is set back to `prelaunch` to reproduce that cached copy — the form
 * and its `dwell` timer are in the DOM either way, and the attribute is the only
 * thing the live page changes. Everything after that is real: real keystrokes, real
 * `dwell` measured by the page's own clock, and the page's own `fetch`.
 */
const staleBookmark: VisitorSession = {
  id: 'stale-bookmark',
  legitimate: true,
  what: 'joins the waiting list from a cached pre-launch page, and is refused',
  kind: 'browser',
  async run({ target, browser }) {
    const page = await openPage(browser, AGENTS.iphoneSafari, true);
    try {
      await page.goto(target);
      await page.evaluate(`document.documentElement.dataset.phase = 'prelaunch'`);
      await readPause(2400);
      await page.scrollBy(1200);
      await readPause(1800);
      await page.type('#wlEmail', 'rangga.prasetya@example.co.id', { delayMs: 120 });
      await readPause(1600);
      await page.click('#wlSubmit').catch(() => {});
      await readPause(2600);
    } finally {
      await page.close();
    }
  },
};

/** Comes back a second time after a gap. Two sessions, one entity. */
const returningVisitor: VisitorSession = {
  id: 'returning-visitor',
  legitimate: true,
  what: 'two visits separated by a real gap',
  kind: 'browser',
  async run({ target, browser }) {
    for (const visit of [0, 1]) {
      const page = await openPage(browser, AGENTS.desktopFirefox, false);
      try {
        await page.goto(visit === 0 ? target : `${target}/order?plan=pro`);
        await readPause(2600);
        await page.scrollBy(800);
        await readPause(2200);
      } finally {
        await page.close();
      }
      if (visit === 0) await sleep(9000);
    }
  },
};

/* ------------------------------------------------------------------ *
 * Adversaries. Each must cost something.
 * ------------------------------------------------------------------ */

/** Shoots the waitlist endpoint directly. No page, so no `dwell` — a proof (D47). */
const endpointShooter: VisitorSession = {
  id: 'endpoint-shooter',
  legitimate: false,
  what: 'posts the waitlist endpoint directly, no page involved',
  kind: 'client',
  async run({ target }) {
    for (let i = 0; i < 12; i += 1) {
      await fetch(`${target}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': AGENTS.pythonBot },
        body: JSON.stringify({ email: `lead${i}@throwaway.test`, locale: 'en' }),
      }).catch(() => {});
      await sleep(280);
    }
  },
};

/** Fills the hidden field, which nothing that can see the page does. Soft (D47). */
const honeypotFiller: VisitorSession = {
  id: 'honeypot-filler',
  legitimate: false,
  what: 'fills the hidden website field with a plausible dwell',
  kind: 'client',
  async run({ target }) {
    for (let i = 0; i < 10; i += 1) {
      await fetch(`${target}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': AGENTS.curl },
        body: JSON.stringify({
          plan: 'pro',
          name: `Agen SEO ${i}`,
          email: `seo${i}@throwaway.test`,
          phone: '08100000000',
          website: 'https://cheap-backlinks.example',
          dwell: 4200,
        }),
      }).catch(() => {});
      await sleep(340);
    }
  },
};

/** Walks the paths every scanner walks. IXFE's own sentinel expects these. */
const pathScanner: VisitorSession = {
  id: 'path-scanner',
  legitimate: false,
  what: 'walks scanner paths at machine pace',
  kind: 'client',
  async run({ target }) {
    const paths = [
      '/.env', '/.git/config', '/wp-login.php', '/wp-admin/', '/phpmyadmin/',
      '/api/admin/users', '/internal/stats', '/backup.zip', '/xmlrpc.php', '/.aws/credentials',
    ];
    for (const path of paths) {
      await fetch(`${target}${path}`, { headers: { 'User-Agent': AGENTS.scanner } }).catch(() => {});
      await sleep(200);
    }
  },
};

/** Reads every page in order at a fixed interval. A crawler that declares nothing. */
const silentCrawler: VisitorSession = {
  id: 'silent-crawler',
  legitimate: false,
  what: 'crawls every page at a fixed interval',
  kind: 'client',
  async run({ target }) {
    const paths = ['/', '/order', '/privacy', '/terms', '/', '/order', '/privacy', '/terms', '/', '/order'];
    for (const path of paths) {
      await fetch(`${target}${path}`, { headers: { 'User-Agent': AGENTS.desktopEdge } }).catch(() => {});
      await sleep(500);
    }
  },
};

/**
 * An uptime monitor: `GET /` on a fixed interval, forever. Legitimate by definition —
 * the operator set it up.
 *
 * Here to test the one innocent cause `SIG_UNIFORM_DELAY_SHAPE` names in the
 * catalogue: "a polling widget on a fixed interval". D55 measured that case and it
 * topped out at `OBSERVE`, but every automated client it tested *earned positives*.
 * This one cannot: it only loads a page, and D56 decided page views earn no evidence.
 */
const uptimeMonitor: VisitorSession = {
  id: 'uptime-monitor',
  legitimate: true,
  what: 'GET / on a fixed interval, like any uptime check',
  kind: 'client',
  async run({ target }) {
    for (let i = 0; i < 20; i += 1) {
      await fetch(target, { headers: { 'User-Agent': AGENTS.uptimeRobot } }).catch(() => {});
      await sleep(600);
    }
  },
};

export const LEGITIMATE: readonly VisitorSession[] = [
  skimmer,
  researcher,
  mobileVisitor,
  staleBookmark,
  returningVisitor,
  uptimeMonitor,
];

export const ADVERSARIES: readonly VisitorSession[] = [
  endpointShooter,
  honeypotFiller,
  pathScanner,
  silentCrawler,
];

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

if (process.argv[1]?.endsWith('visitors.ts')) {
  const target = arg('target', 'http://127.0.0.1:4100');
  const rounds = Number(arg('rounds', '1'));
  const only = arg('only', '');

  const sessions = [...LEGITIMATE, ...ADVERSARIES].filter(
    (session) => only === '' || session.id === only,
  );
  if (sessions.length === 0) {
    console.error(`  no session matches "${only}"`);
    process.exit(1);
  }

  console.log(`\n  Generated visitors against ${target}`);
  console.log(`    ${sessions.length} session type(s), ${rounds} round(s)`);
  console.log(`    still generated traffic — this falsifies, it does not calibrate (D45)\n`);

  const kill = await launch({ port: CHROME_PORT, profileDir: '/tmp/sg-visitors-profile' });
  const browser = await connect(CHROME_PORT);

  try {
    for (let round = 1; round <= rounds; round += 1) {
      for (const session of sessions) {
        const started = Date.now();
        process.stdout.write(`  ${session.id.padEnd(20)} ${session.what}`);
        try {
          await session.run({ target, browser });
          console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s`);
        } catch (error) {
          console.log(`  failed: ${(error as Error).message}`);
        }
        // Real visitors do not arrive back to back.
        await readPause(1200);
      }
      if (round < rounds) console.log('');
    }
  } finally {
    await browser.close();
    kill();
  }

  console.log(`\n  Done. Read what the observer made of it:  npm run observed\n`);
}

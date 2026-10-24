/**
 * Who visits the lab targets, and what the lab knows about them beforehand. M2.1.
 *
 * Every persona here has a declared label, which is the whole reason a generated
 * dataset can be used for calibration at all: the ground truth is known by
 * construction. What that does not buy is D45's warning, restated because it is easy
 * to forget once there are numbers: this composition says nothing about how many
 * real visitors resemble each persona. It is a lab, not a census.
 *
 * The personas are generic over the target for the two static sites, discovering
 * links instead of hardcoding selectors, because a persona that only works on one
 * page would measure that page and nothing else.
 */
import { sleep, type Browser, type Page } from '../ixfe/live/cdp.ts';

export type PersonaLabel = 'legitimate' | 'adversarial';

export type RunContext = {
  /** Origin of the proxy, without a trailing slash. */
  readonly base: string;
  readonly browser: Browser;
  /** Seeded, so a run can be repeated exactly. */
  readonly rng: () => number;
};

export type LabPersona = {
  readonly id: string;
  readonly label: PersonaLabel;
  readonly what: string;
  readonly userAgent: string;
  readonly mobile?: boolean;
  /** Absolute URL this persona lands on, given the proxy base. */
  readonly entry: (base: string) => string;
  run(context: RunContext): Promise<void>;
};

const AGENTS = {
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  uptimeRobot: 'Mozilla/5.0+(compatible; UptimeRobot/2.0; https://uptimerobot.com/)',
  crawler:
    'Mozilla/5.0 (compatible; LabCrawler/1.0; +https://scorpio-guard.fachryxyf.com/)',
  scanner: 'Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)',
  pythonBot: 'python-requests/2.32.3',
  patient: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
} as const;

/** Exponential gaps, because human attention is bursty (D54). */
function pause(rng: () => number, meanMs: number): Promise<void> {
  return sleep(-Math.log(1 - rng()) * meanMs);
}

function openPage(browser: Browser, userAgent: string, mobile: boolean): Promise<Page> {
  return browser.newPage({
    userAgent,
    viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 900 },
    mobile,
  });
}

/**
 * A scroll the instrument can see.
 *
 * Scripted rather than a real wheel event, and that is not laziness: the observer in
 * this lab reads the server side, so a wheel event that no one records only adds a way
 * for the flow to hang. The first recorded run lost a persona's fourth request to
 * `Input.dispatchMouseEvent: no reply in 15000 ms` for exactly that reason.
 */
function scroll(page: Page, pixels: number): Promise<void> {
  return page.evaluate('window.scrollBy(0, ' + String(Math.round(pixels)) + ')').then(() => undefined);
}

/** Same-origin links the page offers, so a persona can browse a site it never saw. */
async function discoveredLinks(page: Page): Promise<string[]> {
  const hrefs = await page.evaluate<string[]>(
    "Array.from(document.querySelectorAll('a[href]')).map((anchor) => anchor.getAttribute('href') ?? '')",
  );
  return (hrefs ?? []).filter(
    (href) => href !== '' && !href.startsWith('#') && !href.startsWith('mailto:') && !/^[a-z]+:/i.test(href),
  );
}

const sensitivePaths = [
  '/admin',
  '/admin/users',
  '/wp-login.php',
  '/.env',
  '/.git/config',
  '/api/users',
  '/api/v1/admin/keys',
  '/server-status',
] as const;

function landing(path: string) {
  return (base: string): string => base + path;
}

export function staticPersonas(): LabPersona[] {
  return [
    {
      id: 'reader',
      label: 'legitimate',
      what: 'lands, reads, follows three links, leaves without converting',
      userAgent: AGENTS.desktopChrome,
      entry: landing('/index.html'),
      async run({ base, browser, rng }) {
        const page = await openPage(browser, AGENTS.desktopChrome, false);
        try {
          await page.goto(base + '/index.html');
          await pause(rng, 1800);
          const links = (await discoveredLinks(page)).slice(0, 3);
          for (const href of links) {
            await scroll(page, 400 + rng() * 600);
            await page.goto(base + (href.startsWith('/') ? href : '/' + href));
            await pause(rng, 2200);
          }
        } finally {
          await page.close();
        }
      },
    },
    {
      id: 'skimmer',
      label: 'legitimate',
      what: 'lands, scrolls a little, decides it is not for them',
      userAgent: AGENTS.androidChrome,
      mobile: true,
      entry: landing('/index.html'),
      async run({ base, browser, rng }) {
        const page = await openPage(browser, AGENTS.androidChrome, true);
        try {
          await page.goto(base + '/index.html');
          for (let step = 0; step < 3; step += 1) {
            await scroll(page, 500 + rng() * 400);
            await pause(rng, 1200);
          }
        } finally {
          await page.close();
        }
      },
    },
    {
      id: 'monitor',
      label: 'legitimate',
      what: 'uptime monitor: eight fixed-interval reads of the landing page',
      userAgent: AGENTS.uptimeRobot,
      entry: landing('/index.html'),
      async run({ base, browser }) {
        const page = await openPage(browser, AGENTS.uptimeRobot, false);
        try {
          for (let check = 0; check < 8; check += 1) {
            await page.goto(base + '/index.html');
            // Fixed, not exponential: that regularity is what the monitor looks like,
            // and pricing it would charge the operator for their own instrumentation.
            await sleep(700);
          }
        } finally {
          await page.close();
        }
      },
    },
    {
      id: 'crawler',
      label: 'legitimate',
      what: 'indexer reading every link it finds, quickly, and nothing else',
      userAgent: AGENTS.crawler,
      entry: landing('/index.html'),
      async run({ base, browser }) {
        const page = await openPage(browser, AGENTS.crawler, false);
        try {
          await page.goto(base + '/index.html');
          const links = (await discoveredLinks(page)).slice(0, 8);
          for (const href of links) {
            await page.goto(base + (href.startsWith('/') ? href : '/' + href));
            await sleep(150);
          }
        } finally {
          await page.close();
        }
      },
    },
    {
      id: 'scanner',
      label: 'adversarial',
      what: 'asks for eight paths no page links to, looking for an exposed surface',
      userAgent: AGENTS.scanner,
      entry: landing('/admin'),
      async run({ base, browser }) {
        const page = await openPage(browser, AGENTS.scanner, false);
        try {
          for (const path of sensitivePaths) {
            await page.goto(base + path);
            await sleep(120);
          }
        } finally {
          await page.close();
        }
      },
    },
    {
      id: 'patient',
      label: 'adversarial',
      what: 'probes slowly, blending with page views, staying under any velocity rule',
      userAgent: AGENTS.patient,
      entry: landing('/index.html'),
      async run({ base, browser, rng }) {
        const page = await openPage(browser, AGENTS.patient, false);
        try {
          // Sixteen requests spread over roughly half a minute: no burst to see, which
          // is the point. A rule that only counts requests per second reads this as a
          // reader, and the four hidden paths are asked for between real page views.
          const paths = [...sensitivePaths.slice(0, 4)];
          for (let step = 0; step < 16; step += 1) {
            const path = step % 3 === 2 ? (paths[step % paths.length] ?? '/') : '/index.html';
            await page.goto(base + path);
            await pause(rng, 1800);
          }
        } finally {
          await page.close();
        }
      },
    },
    {
      id: 'hammer',
      label: 'adversarial',
      what: 'twenty reads of the same URL back to back, no dwell',
      userAgent: AGENTS.pythonBot,
      entry: landing('/index.html'),
      async run({ base, browser }) {
        const page = await openPage(browser, AGENTS.pythonBot, false);
        try {
          for (let request = 0; request < 20; request += 1) {
            await page.goto(base + '/index.html');
          }
        } finally {
          await page.close();
        }
      },
    },
  ];
}

/** mulberry32: four lines, seeded, and good enough to make a run repeatable. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

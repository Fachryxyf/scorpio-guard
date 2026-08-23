/**
 * Minimal Chrome DevTools Protocol client. D57.
 *
 * Written rather than installed: `puppeteer` is ~80MB and downloads its own
 * Chromium, and this needs six commands against a Chrome that is already on the
 * machine. The zero-dependency promise is not negotiable for the library, and it
 * would be odd to break it in the examples that argue for it.
 *
 * `WebSocket` is a Node 22 global, so there is no `ws` dependency either.
 *
 * ponytail: one page at a time, no event subscription beyond load. Enough to drive
 * a form. Upgrade path: install puppeteer if this ever needs frames, downloads or
 * network interception.
 */

type Reply = { id?: number; result?: unknown; error?: { message: string } };

type Pending = (message: Reply) => void;

export type Page = {
  goto(url: string): Promise<void>;
  /** Evaluate in the page and return the value, or `undefined` if it is not serialisable. */
  evaluate<T = unknown>(expression: string): Promise<T | undefined>;
  /** Click a selector's centre with a real mouse event pair. */
  click(selector: string): Promise<void>;
  /** Type into the focused element one key event at a time, with human-ish gaps. */
  type(selector: string, text: string, options?: { delayMs?: number }): Promise<void>;
  scrollBy(pixels: number): Promise<void>;
  close(): Promise<void>;
};

export type Browser = {
  newPage(options?: { userAgent?: string; viewport?: { width: number; height: number }; mobile?: boolean }): Promise<Page>;
  close(): Promise<void>;
};

/** Connect to a Chrome already listening with `--remote-debugging-port`. */
export async function connect(port: number): Promise<Browser> {
  const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as {
    webSocketDebuggerUrl: string;
  };
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  const pending = new Map<number, Pending>();
  let nextId = 0;

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('could not attach to Chrome')), { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as Reply;
    if (message.id !== undefined) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });

  /**
   * Every command is bounded, and that is not defensive padding — it is the bug the
   * first D57 run hit. The post-launch site 302s `/order` to `app.ixfe.pro`, which is
   * not reachable from here, and Chrome answers nothing at all while it waits on the
   * connection. An unbounded `Runtime.evaluate` then hangs the whole run rather than
   * failing one visitor.
   */
  function send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
    timeoutMs = 15_000,
  ): Promise<T> {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method}: no reply in ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result as T);
      });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  return {
    async newPage(options = {}) {
      const { targetId } = await send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });

      await send('Page.enable', {}, sessionId);
      await send('Runtime.enable', {}, sessionId);
      if (options.userAgent || options.viewport) {
        await send(
          'Emulation.setDeviceMetricsOverride',
          {
            width: options.viewport?.width ?? 1440,
            height: options.viewport?.height ?? 900,
            deviceScaleFactor: 1,
            mobile: options.mobile ?? false,
          },
          sessionId,
        );
      }
      if (options.userAgent) {
        await send('Emulation.setUserAgentOverride', { userAgent: options.userAgent }, sessionId);
      }

      async function evaluate<T>(expression: string): Promise<T | undefined> {
        const { result } = await send<{ result: { value?: T } }>(
          'Runtime.evaluate',
          { expression, returnByValue: true, awaitPromise: true },
          sessionId,
          10_000,
        );
        return result.value;
      }

      return {
        async goto(url) {
          await send('Page.navigate', { url }, sessionId);
          // Polling `readyState` rather than awaiting `Page.loadEventFired`, because
          // that needs event subscription this client deliberately does not have.
          // A navigation that never completes gives up rather than blocking: the
          // requests it already made are recorded, which is the point of the visit.
          const deadline = Date.now() + 20_000;
          while (Date.now() < deadline) {
            const state = await evaluate<string>('document.readyState').catch(() => undefined);
            if (state === 'complete') return;
            await sleep(150);
          }
        },
        evaluate,
        async click(selector) {
          const found = await evaluate<boolean>(
            `(() => { const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return false;
              el.scrollIntoView({ block: 'center', behavior: 'instant' });
              return true; })()`,
          );
          if (!found) throw new Error(`no element matches ${selector}`);
          // Scrolling and reading the rectangle have to be two steps. Doing both in
          // one expression returns pre-scroll coordinates, and a click at those
          // coordinates lands on whatever happens to be there — which is how the
          // first D57 run produced focus events but no form submission.
          await sleep(150);
          const box = await evaluate<{ x: number; y: number } | null>(
            `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
              return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
          );
          if (!box) throw new Error(`${selector} disappeared before it could be clicked`);
          const shared = { x: box.x, y: box.y, button: 'left', clickCount: 1 };
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y }, sessionId);
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...shared }, sessionId);
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...shared }, sessionId);
        },
        async type(selector, text, typeOptions = {}) {
          await evaluate(`document.querySelector(${JSON.stringify(selector)})?.focus()`);
          const delay = typeOptions.delayMs ?? 90;
          for (const character of text) {
            // Real key events, so the page's own interaction counters see them.
            await send('Input.dispatchKeyEvent', { type: 'keyDown', text: character }, sessionId);
            await send('Input.dispatchKeyEvent', { type: 'keyUp' }, sessionId);
            await sleep(delay * (0.6 + Math.random() * 0.8));
          }
        },
        async scrollBy(pixels) {
          await send(
            'Input.dispatchMouseEvent',
            { type: 'mouseWheel', x: 400, y: 400, deltaX: 0, deltaY: pixels },
            sessionId,
          );
        },
        async close() {
          await send('Target.closeTarget', { targetId });
        },
      };
    },
    async close() {
      socket.close();
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Launch a headless Chrome and wait for its debugging port. Returns a kill function. */
export async function launch(options: { port: number; binary?: string; profileDir: string }): Promise<() => void> {
  const { spawn } = await import('node:child_process');
  const binary = options.binary ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const child = spawn(
    binary,
    [
      '--headless=new',
      `--remote-debugging-port=${options.port}`,
      `--user-data-dir=${options.profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );

  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${options.port}/json/version`);
      if (res.ok) return () => child.kill('SIGKILL');
    } catch { /* not listening yet */ }
    await sleep(200);
  }
  child.kill('SIGKILL');
  throw new Error(`Chrome did not open a debugging port on ${options.port}`);
}

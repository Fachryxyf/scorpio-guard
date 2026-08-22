/**
 * Generate SVG chart data for the site. D50.
 * Output: JSON printed to stdout; paste into the chart-data JS in index.html.
 *
 *   node --experimental-strip-types scripts/chartdata.mjs > /tmp/chartdata.json
 */
import { createGuard } from '../src/core/guard.ts';
import { decayFactor } from '../src/core/trust.ts';
import { DEFAULT_TRUST_BANDS, DEFAULT_POLICY } from '../src/core/policy.ts';

const HOUR = 3_600_000;

async function trajectory(label, opts) {
  let t = 0;
  const guard = createGuard({ clock: { now: () => t } });
  const points = [];
  for (let i = 0; i < opts.steps; i += 1) {
    const r = await guard.evaluate({
      entity: 'e',
      observation: {
        scope: 'scope-' + (i % opts.scopes),
        evidence: opts.evidence,
      },
    });
    points.push({ n: i + 1, mean: +r.trust.mean.toFixed(4), mass: +r.trust.mass.toFixed(2), stage: r.trust.stage, decision: r.decision });
    t += (opts.gapHours || 1) * HOUR;
  }
  return { label, points };
}

// 1. Honest user: weak positives, varied scopes
const honest = await trajectory('Honest user (weak +, 3 scopes)', { steps: 20, scopes: 3, evidence: { positive: 'weak' }, gapHours: 1 });

// 2. Attacker: weak negatives
const attacker = await trajectory('Attacker (weak -, 1 scope)', { steps: 20, scopes: 1, evidence: { negative: 'weak' }, gapHours: 0.5 });

// 3. Decay curve
const decay = [];
for (let h = 0; h <= 72; h += 1) {
  decay.push({ hours: h, factor: +decayFactor(h * HOUR).toFixed(4) });
}

// 4. Trust bands (for drawing band regions)
const bands = DEFAULT_TRUST_BANDS.map(b => ({ band: b.band, atLeast: b.atLeast }));

// 5. Pentest results (from the live run)
const pentest = {
  total: 63,
  hardViolations: 38,
  disagreements: 0,
  entities: [
    { id: 'endpoint-shooter', reqs: 10, worst: 'RESTRICT', hard: 10 },
    { id: 'honeypot-filler', reqs: 10, worst: 'INCREASE_FRICTION', hard: 0 },
    { id: 'login-brute', reqs: 15, worst: 'INCREASE_FRICTION', hard: 0 },
    { id: 'webhook-forger', reqs: 12, worst: 'RESTRICT', hard: 12 },
    { id: 'rotating-ips', reqs: 16, worst: 'RESTRICT', hard: 16 },
  ],
};

console.log(JSON.stringify({ honest, attacker, decay, bands, pentest }, null, 2));

/**
 * Traffic for HealthMe. D45.
 *
 * D34 recorded that HealthMe cannot validate the thesis because it has one user.
 * That is true of its *production* traffic and not of its *flow* — the flow is
 * real, declared, and can be driven by more than one kind of visitor. So rather
 * than wait for an unauthenticated target to appear, this generates the traffic
 * the statistical layer needs, against the same invariants the real app supplied.
 *
 * What this can settle, and what it cannot:
 *
 * - It **can** falsify. If a persona built from HealthMe's own honest usage gets
 *   escalated, a threshold is wrong, and that is a finding regardless of where the
 *   traffic came from. Same for an adversary that walks through untouched.
 * - It **cannot** calibrate. Real populations are not drawn from these
 *   distributions, and an attacker who reads this file can shape traffic around
 *   it. Numbers derived here are hypotheses to test against a real population,
 *   never conclusions.
 *
 * Every persona is seeded, so a run is reproducible and a regression is a diff
 * rather than an anecdote.
 */
import { API_SCOPE, UNLOCK_SCOPE, type ApiCall } from './invariants.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Deterministic PRNG. `Math.random()` would make a failing run impossible to
 * reproduce, which is the one thing a traffic generator must not be.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Exponential gaps: bursty, which is what human activity actually looks like. */
function burstyGap(random: () => number, meanMs: number): number {
  return -Math.log(1 - random()) * meanMs;
}

export type Step = {
  /** Milliseconds to wait *before* this step. */
  readonly afterMs: number;
  readonly event: string;
  readonly scope: typeof UNLOCK_SCOPE | typeof API_SCOPE;
  readonly data: ApiCall | { from: string; to: string };
  /** What HealthMe's own defences do with it. */
  readonly hostDid: 'allowed' | 'rejected' | 'locked-out' | 'rate-limited';
  readonly evidence?: { positive?: 'weak' | 'strong'; negative?: 'weak' | 'strong' };
  /** Weak signals a collector would have reported. D42. */
  readonly signals?: readonly string[];
};

export type Persona = {
  readonly id: string;
  /** True when this traffic is legitimate and must never be escalated. */
  readonly legitimate: boolean;
  readonly what: string;
  readonly steps: readonly Step[];
};

/* ------------------------------------------------------------------ *
 * Legitimate personas. Escalating any of these is a false positive,
 * which the design calls the central constraint.
 * ------------------------------------------------------------------ */

/** The actual HealthMe user: opens it once a day, types the PIN, reads the vault. */
export function dailyRitual(days: number, seed = 1): Persona {
  const random = seeded(seed);
  const steps: Step[] = [];

  for (let day = 0; day < days; day += 1) {
    steps.push({
      afterMs: day === 0 ? 0 : DAY + burstyGap(random, 2 * HOUR) - HOUR,
      event: 'lock screen submitted',
      scope: UNLOCK_SCOPE,
      data: { from: 'locked', to: 'attempting' },
      hostDid: 'allowed',
    });
    steps.push({
      afterMs: 700 + random() * 1800,
      event: 'unlock succeeded',
      scope: UNLOCK_SCOPE,
      data: { from: 'attempting', to: 'unlocked' },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    });
    // Reading the vault: a few API calls, varied, at human pace.
    const calls = 2 + Math.floor(random() * 4);
    for (let call = 0; call < calls; call += 1) {
      steps.push({
        afterMs: burstyGap(random, 20 * SECOND),
        event: 'vault read',
        scope: API_SCOPE,
        data: { state: 'unlocked', unlockedThisSession: true, vaultLoaded: true },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      });
    }
  }

  return {
    id: 'daily-ritual',
    legitimate: true,
    what: 'the real HealthMe user: once a day, PIN, then reads the vault',
    steps,
  };
}

/** Same person, thumbs. Mistypes the PIN twice before getting it right. */
export function fatFinger(seed = 2): Persona {
  const random = seeded(seed);
  const steps: Step[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    steps.push({
      afterMs: attempt === 0 ? 0 : 2 * SECOND + random() * 3 * SECOND,
      event: `mistyped PIN ${attempt + 1}`,
      scope: UNLOCK_SCOPE,
      data: { from: 'attempting', to: 'locked' },
      hostDid: 'rejected',
      evidence: { negative: 'weak' },
    });
  }
  steps.push({
    afterMs: 4 * SECOND,
    event: 'correct PIN',
    scope: UNLOCK_SCOPE,
    data: { from: 'attempting', to: 'unlocked' },
    hostDid: 'allowed',
    evidence: { positive: 'weak' },
  });

  return {
    id: 'fat-finger',
    legitimate: true,
    what: 'a legitimate user who mistypes twice, then succeeds',
    steps,
  };
}

/** A password manager fills the PIN: no keystrokes, correct on the first try. */
export function passwordManager(seed = 3): Persona {
  const random = seeded(seed);
  return {
    id: 'password-manager',
    legitimate: true,
    what: 'autofill: a populated field with no interaction, and a correct PIN',
    steps: [
      {
        afterMs: 0,
        event: 'autofilled submit',
        scope: UNLOCK_SCOPE,
        // Exactly the shape the soft invariant watches for, produced innocently.
        data: {
          state: 'attempting',
          unlockedThisSession: false,
          fieldPopulated: true,
          interactions: 0,
          lockScreenRendered: true,
        },
        hostDid: 'allowed',
        signals: ['SIG_UNINTERACTED_INPUT', 'SIG_SUBHUMAN_LATENCY'],
      },
      {
        afterMs: 300 + random() * 400,
        event: 'unlock succeeded',
        scope: UNLOCK_SCOPE,
        data: { from: 'attempting', to: 'unlocked' },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      },
    ],
  };
}

/** Reopening the tab: HealthMe restores from sessionStorage without a PIN. */
export function sessionRestore(times: number, seed = 4): Persona {
  const random = seeded(seed);
  const steps: Step[] = [];

  for (let i = 0; i < times; i += 1) {
    steps.push({
      afterMs: i === 0 ? 0 : burstyGap(random, 40 * MINUTE),
      event: 'auto-unlock from sessionStorage',
      scope: API_SCOPE,
      data: { state: 'unlocked', unlockedThisSession: true, vaultLoaded: true },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    });
  }

  return {
    id: 'session-restore',
    legitimate: true,
    what: 'tab reopened repeatedly; HealthMe restores the session hash',
    steps,
  };
}

/** Someone who genuinely uses it a lot: many reads in one sitting. */
export function powerUser(reads: number, seed = 5): Persona {
  const random = seeded(seed);
  const steps: Step[] = [
    {
      afterMs: 0,
      event: 'lock screen submitted',
      scope: UNLOCK_SCOPE,
      data: { from: 'locked', to: 'attempting' },
      hostDid: 'allowed',
    },
    {
      afterMs: 900 + random() * 1200,
      event: 'unlock succeeded',
      scope: UNLOCK_SCOPE,
      data: { from: 'attempting', to: 'unlocked' },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    },
  ];

  for (let read = 0; read < reads; read += 1) {
    steps.push({
      afterMs: burstyGap(random, 12 * SECOND),
      event: 'vault read',
      scope: API_SCOPE,
      data: { state: 'unlocked', unlockedThisSession: true, vaultLoaded: true },
      hostDid: read < 10 ? 'allowed' : 'rate-limited',
      evidence: { positive: 'weak' },
    });
  }

  return {
    id: 'power-user',
    legitimate: true,
    what: 'heavy legitimate use in one sitting, past HealthMe\u2019s 10/hour IP limit',
    steps,
  };
}

/* ------------------------------------------------------------------ *
 * Adversaries. Walking through untouched is the finding.
 * ------------------------------------------------------------------ */

/** The forged API call: HealthMe allows it, the guard should not. */
export function forgedApiCall(): Persona {
  return {
    id: 'forged-api-call',
    legitimate: false,
    what: 'POST /api/chat with no unlock in the session; passes origin and IP checks',
    steps: [
      {
        afterMs: 0,
        event: 'POST /api/chat',
        scope: API_SCOPE,
        data: { state: 'locked', unlockedThisSession: false },
        hostDid: 'allowed',
      },
    ],
  };
}

/**
 * A PIN brute force with a fixed sleep. The naive script.
 *
 * HealthMe stops this after three tries — with client-side state the attacker
 * controls, so in practice it stops after three tries *per cleared localStorage*.
 */
export function scriptedBruteForce(attempts: number, gapMs = 1500): Persona {
  const steps: Step[] = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    steps.push({
      afterMs: attempt === 0 ? 0 : gapMs,
      event: `scripted attempt ${attempt + 1}`,
      scope: UNLOCK_SCOPE,
      data: {
        state: 'attempting',
        unlockedThisSession: false,
        fieldPopulated: true,
        interactions: 0,
        lockScreenRendered: true,
      },
      hostDid: attempt < 3 ? 'rejected' : 'allowed', // localStorage cleared each round
      evidence: { negative: 'weak' },
      signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_UNINTERACTED_INPUT', 'SIG_SUBHUMAN_LATENCY'],
    });
  }

  return {
    id: 'scripted-brute-force',
    legitimate: false,
    what: 'PIN brute force at a fixed interval, clearing localStorage to reset the lockout',
    steps,
  };
}

/**
 * The same brute force with `uniform(1.2, 2.3)` jitter — the design notes name
 * this exact distribution as the tell that is *not* the delay but its shape.
 */
export function jitteredBruteForce(attempts: number, seed = 6): Persona {
  const random = seeded(seed);
  const steps: Step[] = [];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    steps.push({
      afterMs: attempt === 0 ? 0 : 1200 + random() * 1100,
      event: `jittered attempt ${attempt + 1}`,
      scope: UNLOCK_SCOPE,
      data: {
        state: 'attempting',
        unlockedThisSession: false,
        fieldPopulated: true,
        interactions: 0,
        lockScreenRendered: true,
      },
      hostDid: attempt < 3 ? 'rejected' : 'allowed',
      evidence: { negative: 'weak' },
      signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_UNINTERACTED_INPUT'],
    });
  }

  return {
    id: 'jittered-brute-force',
    legitimate: false,
    what: 'the same brute force with uniform(1.2s, 2.3s) jitter, to look human',
    steps,
  };
}

/**
 * Identity churn: the open problem, made measurable.
 *
 * The same attacker as `scriptedBruteForce`, spending three attempts per entity
 * and then discarding the reference. Every request is a cold start, so nothing
 * accumulates — this exists to *show* the hole rather than to pass.
 */
export function churningBruteForce(entities: number, perEntity = 3): readonly Persona[] {
  return Array.from({ length: entities }, (_, index) => {
    const steps: Step[] = [];
    for (let attempt = 0; attempt < perEntity; attempt += 1) {
      steps.push({
        afterMs: attempt === 0 ? 0 : 1500,
        event: `churn ${index}.${attempt + 1}`,
        scope: UNLOCK_SCOPE,
        data: {
          state: 'attempting',
          unlockedThisSession: false,
          fieldPopulated: true,
          interactions: 0,
          lockScreenRendered: true,
        },
        hostDid: 'rejected',
        evidence: { negative: 'weak' },
        signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_UNINTERACTED_INPUT'],
      });
    }
    return {
      id: `churn-${index}`,
      legitimate: false,
      what: 'a fresh identity every few attempts, so history never accumulates',
      steps,
    };
  });
}

/**
 * Slow poisoning: build trust honestly, then misuse it.
 *
 * Every step is individually legitimate, which is what makes it the hard case
 * recorded as an open problem. The question this asks is narrow and answerable:
 * once the abuse starts, how long before the guard notices?
 */
export function slowPoisoner(honestDays: number, abuseCalls: number, seed = 7): Persona {
  const random = seeded(seed);
  const steps: Step[] = [];

  for (let day = 0; day < honestDays; day += 1) {
    steps.push({
      afterMs: day === 0 ? 0 : DAY,
      event: `honest day ${day + 1}`,
      scope: UNLOCK_SCOPE,
      data: { from: 'attempting', to: 'unlocked' },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    });
    steps.push({
      afterMs: burstyGap(random, 30 * SECOND),
      event: 'vault read',
      scope: API_SCOPE,
      data: { state: 'unlocked', unlockedThisSession: true, vaultLoaded: true },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    });
  }

  for (let call = 0; call < abuseCalls; call += 1) {
    steps.push({
      afterMs: 900,
      event: `abuse call ${call + 1}`,
      scope: API_SCOPE,
      data: { state: 'unlocked', unlockedThisSession: true, vaultLoaded: true },
      hostDid: 'allowed',
      signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_BREADTH_OF_TARGET', 'SIG_REPEATED_PATTERN'],
    });
  }

  return {
    id: 'slow-poisoner',
    legitimate: false,
    what: 'earns trust over days, then drains the paid endpoint at machine pace',
    steps,
  };
}

export const LEGITIMATE_PERSONAS: readonly Persona[] = [
  dailyRitual(14),
  fatFinger(),
  passwordManager(),
  sessionRestore(6),
  powerUser(24),
];

export const ADVERSARY_PERSONAS: readonly Persona[] = [
  forgedApiCall(),
  scriptedBruteForce(30),
  jitteredBruteForce(30),
  slowPoisoner(10, 40),
];

/**
 * IXFE traffic. D47.
 *
 * Where the HealthMe personas had to invent an adversary, these are drawn from what
 * IXFE's own code already defends against — every mitigation in `landing-service/`
 * and `server/index.js` is a record of an attack its author expected. The honeypot,
 * the time-trap, the disposable-email blocklist, the per-code OTP cap, the 404 for
 * unknown `external_id`: each one names a persona.
 *
 * That is the difference D47 records. HealthMe's threat model was hypothetical;
 * IXFE's is written down in its own defences, and it has paid compute behind a
 * public endpoint.
 */
import {
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  burstyGap,
  seeded,
  type Persona,
  type Step,
} from '../harness/persona.ts';
import {
  AUTH_SCOPE,
  BILLING_SCOPE,
  ORDER_SCOPE,
  WAITLIST_SCOPE,
  WORK_SCOPE,
} from './invariants.ts';

/** A submission that came from the page: dwell present, honeypot empty. */
function fromPage(dwellMs: number, interactions = 12) {
  return { dwellMs, honeypot: '', fieldsFilled: 4, interactions };
}

/* ------------------------------------------------------------------ *
 * Legitimate. Escalating any of these is a false positive.
 * ------------------------------------------------------------------ */

/** Someone lands, reads, picks a plan, and pre-orders. The funnel working. */
export function preOrderBuyer(seed = 11): Persona {
  const random = seeded(seed);
  return {
    id: 'preorder-buyer',
    legitimate: true,
    what: 'lands, reads pricing, picks a plan, pre-orders — the funnel as designed',
    steps: [
      {
        afterMs: 0,
        event: 'landing',
        scope: ORDER_SCOPE,
        data: { from: 'landing', to: 'order-page' },
        hostDid: 'allowed',
      },
      {
        afterMs: burstyGap(random, 40 * SECOND),
        event: 'plan chosen',
        scope: ORDER_SCOPE,
        data: { from: 'order-page', to: 'plan-selected' },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      },
      {
        afterMs: burstyGap(random, 25 * SECOND),
        event: 'reconsiders, changes plan',
        scope: ORDER_SCOPE,
        data: { from: 'plan-selected', to: 'order-page' },
        hostDid: 'allowed',
      },
      {
        afterMs: burstyGap(random, 20 * SECOND),
        event: 'plan chosen again',
        scope: ORDER_SCOPE,
        data: { from: 'order-page', to: 'plan-selected' },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      },
      {
        afterMs: burstyGap(random, 90 * SECOND),
        event: 'details filled',
        scope: ORDER_SCOPE,
        data: { from: 'plan-selected', to: 'details-filled' },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      },
      {
        afterMs: burstyGap(random, 30 * SECOND),
        event: 'submitted',
        scope: WAITLIST_SCOPE,
        data: fromPage(3 * MINUTE),
        hostDid: 'allowed',
        evidence: { positive: 'strong' },
      },
    ],
  };
}

/**
 * A careful buyer who fills the form slowly, gets an email typo wrong, and retries.
 *
 * IXFE screens for undeliverable domains and answers honestly rather than silently,
 * so a real person can legitimately submit twice. Nothing about that is suspicious.
 */
export function typoRetryBuyer(seed = 12): Persona {
  const random = seeded(seed);
  const steps: Step[] = [
    {
      afterMs: 0,
      event: 'landing',
      scope: ORDER_SCOPE,
      data: { from: 'landing', to: 'order-page' },
      hostDid: 'allowed',
    },
    {
      afterMs: burstyGap(random, 60 * SECOND),
      event: 'plan chosen',
      scope: ORDER_SCOPE,
      data: { from: 'order-page', to: 'plan-selected' },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    },
    {
      afterMs: burstyGap(random, 2 * MINUTE),
      event: 'submit with a typo in the domain',
      scope: WAITLIST_SCOPE,
      data: fromPage(4 * MINUTE),
      // Refused, and correctly: the domain cannot receive mail.
      hostDid: 'rejected',
    },
    {
      afterMs: burstyGap(random, 40 * SECOND),
      event: 'submit again, spelled right',
      scope: WAITLIST_SCOPE,
      data: fromPage(30 * SECOND),
      hostDid: 'allowed',
      evidence: { positive: 'strong' },
    },
  ];

  return {
    id: 'typo-retry',
    legitimate: true,
    what: 'mistypes the email domain, is told so, and retries — an honest second try',
    steps,
  };
}

/** An operator actually working: varied actions across the app, over days. */
export function workingCustomer(days: number, seed = 13): Persona {
  const random = seeded(seed);
  const steps: Step[] = [];
  const actions = [
    { action: 'discover', cost: 1 },
    { action: 'scout', cost: 1 },
    { action: 'audit', cost: 2 },
    { action: 'harvest', cost: 3 },
    { action: 'marketplace', cost: 5 },
  ];
  let balance = 350;

  for (let day = 0; day < days; day += 1) {
    steps.push({
      afterMs: day === 0 ? 0 : DAY + burstyGap(random, 3 * HOUR) - 90 * MINUTE,
      event: 'login',
      scope: AUTH_SCOPE,
      data: { from: 'anonymous', to: 'login-attempted' },
      hostDid: 'allowed',
    });
    steps.push({
      afterMs: 2 * SECOND + random() * 3 * SECOND,
      event: 'session started',
      scope: AUTH_SCOPE,
      data: { from: 'login-attempted', to: 'session' },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    });

    const jobs = 2 + Math.floor(random() * 4);
    for (let job = 0; job < jobs; job += 1) {
      const pick = actions[Math.floor(random() * actions.length)]!;
      balance -= pick.cost;
      steps.push({
        afterMs: burstyGap(random, 4 * MINUTE),
        event: `${pick.action} run`,
        scope: WORK_SCOPE,
        data: {
          action: pick.action,
          balance: balance + pick.cost,
          cost: pick.cost,
          subscription: 'active' as const,
          authenticated: true,
        },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      });
    }
  }

  return {
    id: 'working-customer',
    legitimate: true,
    what: 'a paying operator running varied jobs across the app, daily',
    steps,
  };
}

/**
 * A customer who runs out of credits mid-session and tries once more before topping
 * up. One refused request is not an attack; it is how a person discovers a balance.
 */
export function ranOutOfCredits(seed = 14): Persona {
  const random = seeded(seed);
  return {
    id: 'ran-out-of-credits',
    legitimate: true,
    what: 'hits a zero balance, is refused once, tops up — the honest 402',
    steps: [
      {
        afterMs: 0,
        event: 'login',
        scope: AUTH_SCOPE,
        data: { from: 'anonymous', to: 'login-attempted' },
        hostDid: 'allowed',
      },
      {
        afterMs: 3 * SECOND,
        event: 'session started',
        scope: AUTH_SCOPE,
        data: { from: 'login-attempted', to: 'session' },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      },
      {
        afterMs: burstyGap(random, 3 * MINUTE),
        event: 'harvest with 1 credit left',
        scope: WORK_SCOPE,
        // Refused by requireCredits: this violates the declared precondition, and
        // the point of the persona is that ONE of these must cost nothing.
        data: {
          action: 'harvest',
          balance: 1,
          cost: 3,
          subscription: 'active' as const,
          authenticated: true,
        },
        hostDid: 'rejected',
      },
      {
        afterMs: burstyGap(random, 90 * SECOND),
        event: 'tops up',
        scope: BILLING_SCOPE,
        data: {
          kind: 'order-id' as const,
          id: 'ord_real',
          wasIssued: true,
          alreadyConsumed: false,
        },
        hostDid: 'allowed',
        evidence: { positive: 'strong' },
      },
    ],
  };
}

/** Activation from the waiting list: token in the email, used once. */
export function activatedFounder(seed = 15): Persona {
  const random = seeded(seed);
  return {
    id: 'activated-founder',
    legitimate: true,
    what: 'redeems a real activation token once, registers, starts a session',
    steps: [
      {
        afterMs: 0,
        event: 'activation link clicked',
        scope: BILLING_SCOPE,
        data: {
          kind: 'activation-token' as const,
          id: 'jti_real',
          wasIssued: true,
          alreadyConsumed: false,
        },
        hostDid: 'allowed',
        evidence: { positive: 'weak' },
      },
      {
        afterMs: burstyGap(random, 30 * SECOND),
        event: 'otp requested',
        scope: AUTH_SCOPE,
        data: { from: 'anonymous', to: 'otp-requested' },
        hostDid: 'allowed',
      },
      {
        afterMs: burstyGap(random, 70 * SECOND),
        event: 'otp entered correctly',
        scope: AUTH_SCOPE,
        data: {
          codeWasRequested: true,
          purpose: 'register' as const,
          attemptsSoFar: 0,
          maxAttempts: 5,
        },
        hostDid: 'allowed',
        evidence: { positive: 'strong' },
      },
      {
        afterMs: burstyGap(random, 45 * SECOND),
        event: 'registered',
        scope: AUTH_SCOPE,
        data: { from: 'otp-verified', to: 'registered' },
        hostDid: 'allowed',
        evidence: { positive: 'strong' },
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Adversaries, each one named by a defence IXFE already wrote.
 * ------------------------------------------------------------------ */

/**
 * The endpoint-shooter: POSTs straight at `/api/waitlist` with no page involved.
 *
 * IXFE absorbs these silently — it answers `{ slot: 0 }` so the bot cannot tell it
 * failed. Excellent for the bot's operator to be confused by, and it leaves IXFE
 * with no accumulating record of who did it. That is the gap SG fills: the missing
 * `dwell` is a *proof*, not a guess.
 */
export function endpointShooter(requests: number, gapMs = 400): Persona {
  const steps: Step[] = [];
  for (let i = 0; i < requests; i += 1) {
    steps.push({
      afterMs: i === 0 ? 0 : gapMs,
      event: `direct POST /api/waitlist ${i + 1}`,
      scope: WAITLIST_SCOPE,
      // No dwell at all: the field the page always sends is absent.
      data: { dwellMs: undefined, honeypot: '', fieldsFilled: 1, interactions: 0 },
      hostDid: 'allowed', // silently absorbed, indistinguishable from success
      signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_SUBHUMAN_LATENCY', 'SIG_UNINTERACTED_INPUT'],
    });
  }

  return {
    id: 'endpoint-shooter',
    legitimate: false,
    what: 'POSTs the waitlist endpoint directly; IXFE absorbs it silently and learns nothing',
    steps,
  };
}

/** A form-filling bot that fills every input it can see, including the honeypot. */
export function honeypotFiller(requests: number, seed = 21): Persona {
  const random = seeded(seed);
  const steps: Step[] = [];

  for (let i = 0; i < requests; i += 1) {
    steps.push({
      afterMs: i === 0 ? 0 : 900 + random() * 600,
      event: `bot submission ${i + 1}`,
      scope: WAITLIST_SCOPE,
      // It renders the page, so it has a dwell — but it fills what it should not see.
      data: { dwellMs: 2200 + random() * 500, honeypot: 'https://seo-backlinks.example', fieldsFilled: 5, interactions: 3 },
      hostDid: 'allowed',
      signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_REPEATED_PATTERN'],
    });
  }

  return {
    id: 'honeypot-filler',
    legitimate: false,
    what: 'a headless browser filling every field it finds, honeypot included',
    steps,
  };
}

/**
 * OTP brute force. IXFE's per-code attempt cap is the real fix and it works; what it
 * does not do is remember the caller across codes.
 *
 * So this persona requests a fresh code every five guesses, which resets the cap
 * legitimately. Each individual burst is inside the rules; the pattern is not.
 */
export function otpGrinder(codes: number, perCode = 6): Persona {
  const steps: Step[] = [];

  for (let code = 0; code < codes; code += 1) {
    steps.push({
      afterMs: code === 0 ? 0 : 20 * SECOND,
      event: `request code ${code + 1}`,
      scope: AUTH_SCOPE,
      data: { from: 'anonymous', to: 'otp-requested' },
      hostDid: 'allowed',
    });

    for (let guess = 0; guess < perCode; guess += 1) {
      steps.push({
        afterMs: 1200,
        event: `guess ${guess + 1} on code ${code + 1}`,
        scope: AUTH_SCOPE,
        data: {
          codeWasRequested: true,
          purpose: 'register' as const,
          attemptsSoFar: guess,
          maxAttempts: 5,
        },
        hostDid: guess < 5 ? 'rejected' : 'rejected',
        evidence: { negative: 'weak' },
        signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_REPEATED_PATTERN'],
      });
    }
  }

  return {
    id: 'otp-grinder',
    legitimate: false,
    what: 'grinds OTP codes, requesting a fresh one each time the per-code cap burns',
    steps,
  };
}

/**
 * The forged payment callback. `external_id` is a value IXFE issued, so a callback
 * naming one it never issued is provably not from a real invoice.
 *
 * IXFE already answers 404. This persona exists because a 404 is not a memory: the
 * caller can keep trying different ids forever, and nothing accumulates.
 */
export function webhookForger(attempts: number): Persona {
  const steps: Step[] = [];
  for (let i = 0; i < attempts; i += 1) {
    steps.push({
      afterMs: i === 0 ? 0 : 2 * SECOND,
      event: `forged callback ${i + 1}`,
      scope: BILLING_SCOPE,
      data: {
        kind: 'invoice-external-id' as const,
        id: `ord_guess_${i}`,
        wasIssued: false,
      },
      hostDid: 'rejected',
      signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_BREADTH_OF_TARGET'],
    });
  }

  return {
    id: 'webhook-forger',
    legitimate: false,
    what: 'guesses external_id at the payment webhook; each 404 is forgotten by the host',
    steps,
  };
}

/** A leaked activation link, replayed to mint more discounted accounts. */
export function activationReplayer(attempts: number): Persona {
  const steps: Step[] = [];
  for (let i = 0; i < attempts; i += 1) {
    steps.push({
      afterMs: i === 0 ? 0 : 8 * SECOND,
      event: `replay activation ${i + 1}`,
      scope: BILLING_SCOPE,
      data: {
        kind: 'activation-token' as const,
        id: 'jti_leaked',
        wasIssued: true,
        // First use is legitimate; every one after it is a replay.
        alreadyConsumed: i > 0,
      },
      hostDid: i === 0 ? 'allowed' : 'rejected',
      ...(i > 0 ? { evidence: { negative: 'weak' as const } } : {}),
    });
  }

  return {
    id: 'activation-replayer',
    legitimate: false,
    what: 'a leaked founder activation link, replayed to mint more 40%-forever accounts',
    steps,
  };
}

/**
 * Credit draining: the one that costs real money.
 *
 * A paying account, or a compromised one, running the most expensive action in a
 * tight loop. `marketplace_global` is 12 credits and makes one Google Places call
 * per market — so this is billed to the operator in cash, not just in credits.
 *
 * Every request is individually authorised. Nothing here violates an invariant,
 * which is the point: this persona has to be caught by the statistical layer or not
 * at all.
 */
export function creditDrainer(calls: number, seed = 24): Persona {
  const random = seeded(seed);
  const steps: Step[] = [
    {
      afterMs: 0,
      event: 'login',
      scope: AUTH_SCOPE,
      data: { from: 'anonymous', to: 'login-attempted' },
      hostDid: 'allowed',
    },
    {
      afterMs: 900,
      event: 'session started',
      scope: AUTH_SCOPE,
      data: { from: 'login-attempted', to: 'session' },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    },
  ];

  let balance = 1000;
  for (let call = 0; call < calls; call += 1) {
    balance -= 12;
    steps.push({
      // Machine-paced, with a little jitter to look less obvious.
      afterMs: 1400 + random() * 400,
      event: `marketplace_global ${call + 1}`,
      scope: WORK_SCOPE,
      data: {
        action: 'marketplace_global',
        balance: balance + 12,
        cost: 12,
        subscription: 'active' as const,
        authenticated: true,
      },
      hostDid: 'allowed',
      signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_REPEATED_PATTERN', 'SIG_BREADTH_OF_TARGET', 'SIG_SENSITIVE_TARGET'],
    });
  }

  return {
    id: 'credit-drainer',
    legitimate: false,
    what: 'authorised account draining the most expensive action in a loop — real money, no invariant broken',
    steps,
  };
}

/**
 * Replaying a recorded pre-launch session after launch.
 *
 * The premise of the whole design, made concrete: any behavior a human produces can
 * be recorded and replayed. This is a captured waitlist submission — correct dwell,
 * empty honeypot, plausible everything — resent after the product went live.
 */
export function postLaunchReplayer(attempts: number): Persona {
  const steps: Step[] = [];
  for (let i = 0; i < attempts; i += 1) {
    steps.push({
      afterMs: i === 0 ? 0 : 30 * SECOND,
      event: `replayed waitlist join ${i + 1}`,
      scope: WAITLIST_SCOPE,
      data: { launched: true, intent: 'join-waitlist' as const },
      hostDid: 'rejected', // IXFE answers 410
      signals: ['SIG_REPEATED_PATTERN'],
    });
  }

  return {
    id: 'post-launch-replayer',
    legitimate: false,
    what: 'a recorded pre-launch submission replayed after launch — the premise, concretely',
    steps,
  };
}

/**
 * Free work from a pending account.
 *
 * `provisionPending()` grants zero credits, so paid work from a pending
 * subscription means the balance came from somewhere it should not have.
 */
export function pendingFreeloader(calls: number): Persona {
  const steps: Step[] = [];
  for (let i = 0; i < calls; i += 1) {
    steps.push({
      afterMs: i === 0 ? 0 : 3 * SECOND,
      event: `work on a pending subscription ${i + 1}`,
      scope: WORK_SCOPE,
      data: {
        action: 'harvest',
        balance: 40,
        cost: 3,
        subscription: 'pending' as const,
        authenticated: true,
      },
      hostDid: 'allowed',
      signals: ['SIG_UNIFORM_DELAY_SHAPE'],
    });
  }

  return {
    id: 'pending-freeloader',
    legitimate: false,
    what: 'a pending subscription with credits it was never provisioned',
    steps,
  };
}

/**
 * The same endpoint-shooter, rotating the entity between requests.
 *
 * D45 measured this on HealthMe and found the floor is two requests per identity.
 * Here it matters more: IXFE's rate limiter is keyed on `CF-Connecting-IP`, so an
 * attacker with addresses to spare rotates past both defences at once.
 */
export function rotatingShooter(entities: number, perEntity = 2): Persona {
  const steps: Step[] = [];

  for (let index = 0; index < entities; index += 1) {
    for (let attempt = 0; attempt < perEntity; attempt += 1) {
      steps.push({
        afterMs: steps.length === 0 ? 0 : 700,
        event: `rotating shot ${index}.${attempt + 1}`,
        scope: WAITLIST_SCOPE,
        data: { dwellMs: undefined, honeypot: '', fieldsFilled: 1, interactions: 0 },
        hostDid: 'allowed',
        entity: `rotating-${index}`,
        signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_UNINTERACTED_INPUT'],
      });
    }
  }

  return {
    id: 'rotating-shooter',
    legitimate: false,
    what: 'the same bot rotating its entity reference every few requests',
    steps,
  };
}

export const IXFE_LEGITIMATE: readonly Persona[] = [
  preOrderBuyer(),
  typoRetryBuyer(),
  workingCustomer(14),
  ranOutOfCredits(),
  activatedFounder(),
];

export const IXFE_ADVERSARIES: readonly Persona[] = [
  endpointShooter(30),
  honeypotFiller(20),
  otpGrinder(5),
  webhookForger(25),
  activationReplayer(10),
  creditDrainer(40),
  postLaunchReplayer(12),
  pendingFreeloader(15),
];

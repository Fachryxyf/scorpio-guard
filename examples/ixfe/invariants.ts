/**
 * Declared invariants for IXFE. D47.
 *
 * IXFE (`ixfe.pro`) is a competitor-intelligence platform: three deployables, an
 * unauthenticated pre-launch funnel, and a credit ledger where one request can
 * spend real money — Puppeteer scrapes and Google Places calls are billed to the
 * operator whether or not the caller was legitimate.
 *
 * That last property is why it replaces HealthMe as the primary target (D47). A
 * PIN-gated personal app has nothing an attacker wants; IXFE has public endpoints,
 * paid compute behind them, and a payment webhook.
 *
 * Every invariant below is declared at one of the six proof sources in D41, and the
 * `strength` is chosen by whether IXFE can honestly claim *completeness* over the
 * scope (D32) — not by how bad a violation feels.
 */
import type { Invariant } from '../../src/core/constraints.ts';
import { transitionGraph } from '../../src/core/transitions.ts';

export const WAITLIST_SCOPE = 'ixfe.waitlist';
export const ORDER_SCOPE = 'ixfe.order';
export const AUTH_SCOPE = 'ixfe.auth';
export const BILLING_SCOPE = 'ixfe.billing';
export const WORK_SCOPE = 'ixfe.work';

/* ------------------------------------------------------------------ *
 * reachability — the flow graph IXFE declared
 * ------------------------------------------------------------------ */

/**
 * The pre-order funnel, exhaustively.
 *
 * `order.html` is a three-part form on one page: choose a plan, fill details,
 * submit. So the reachable states are few and enumerable, which is what makes this
 * `hard` — a submission claiming to arrive from a state the page cannot produce did
 * not come from the page.
 */
export const orderFunnel: Invariant = transitionGraph({
  id: 'ixfe.order-funnel',
  scope: ORDER_SCOPE,
  strength: 'hard',
  class: 'IMPOSSIBLE_SEGMENT_JUMP',
  allowed: [
    { from: 'landing', to: 'order-page' },
    { from: 'order-page', to: 'plan-selected' },
    { from: 'plan-selected', to: 'details-filled' },
    { from: 'details-filled', to: 'submitted' },
    // Going back to fix something is legitimate and common.
    { from: 'details-filled', to: 'plan-selected' },
    { from: 'plan-selected', to: 'order-page' },
  ],
});

/**
 * The auth flow. Registration during pre-launch is gated on an activation token,
 * so `otp-verified -> registered` is only reachable through it.
 */
export const authFlow: Invariant = transitionGraph({
  id: 'ixfe.auth-flow',
  scope: AUTH_SCOPE,
  strength: 'hard',
  class: 'IMPOSSIBLE_STATE_TRANSITION',
  allowed: [
    { from: 'anonymous', to: 'otp-requested' },
    { from: 'otp-requested', to: 'otp-requested' }, // a resend
    { from: 'otp-requested', to: 'otp-verified' },
    { from: 'otp-verified', to: 'registered' },
    { from: 'anonymous', to: 'login-attempted' },
    { from: 'login-attempted', to: 'anonymous' }, // wrong password
    { from: 'login-attempted', to: 'session' },
    { from: 'session', to: 'anonymous' }, // logout
    { from: 'registered', to: 'session' },
  ],
});

/* ------------------------------------------------------------------ *
 * precondition — state that must hold before an action exists
 * ------------------------------------------------------------------ */

export type WorkRequest = {
  /** `discover` | `scout` | `harvest` | `audit` | `marketplace`. */
  readonly action: string;
  /** Credit balance at the moment of the call. */
  readonly balance: number;
  /** What the action costs, from the server-side catalogue. */
  readonly cost: number;
  readonly subscription: 'pending' | 'active' | 'lapsed' | 'cancelled';
  readonly authenticated: boolean;
};

/**
 * Credit-spending work requires credits to spend.
 *
 * `requireCredits()` already enforces this and returns 402. Declared here because
 * SG is being asked whether the *pattern of trying anyway* means something: a client
 * that has seen its own balance does not repeatedly ask for work it cannot afford,
 * so a stream of these says something about the caller even though each one is
 * correctly refused.
 *
 * `soft`, and the first draft got this wrong — see D48. Declaring `hard` asserts
 * completeness (D32): that *no* legitimate client ever asks for work it cannot
 * afford. That claim is false. The client's view of its balance is stale by
 * construction — jobs are queued and billed asynchronously, another tab may have
 * spent the difference, and a lapsed subscription changes the answer without the
 * open page hearing about it. So the honest reading is negative evidence, not proof:
 * one refused request is how a person discovers their balance, and a hundred is a
 * script.
 */
export const workRequiresCredits: Invariant = {
  id: 'ixfe.work-requires-credits',
  class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
  strength: 'soft',
  scope: WORK_SCOPE,
  holds: (observation) => {
    if (!isWorkRequest(observation)) return true;
    return observation.balance >= observation.cost;
  },
};

/**
 * A pending subscription has no credit allowance at all — `provisionPending()`
 * writes zero, and only a paid callback calls `activateSubscription()`. So paid work
 * from a pending account cannot have been legitimately funded.
 *
 * Kept `hard`, with one thing worth naming: a violation here proves *something is
 * wrong*, not necessarily that the **caller** did it — an internal accounting bug
 * would look identical. D14 covers this exactly, because "hard" describes the
 * certainty of the violation and never the severity of the response. `RESTRICT` is
 * right either way: withholding paid compute until a human looks is correct whether
 * the cause is an attacker or IXFE's own ledger.
 */
export const workRequiresActiveSubscription: Invariant = {
  id: 'ixfe.work-requires-active-subscription',
  class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
  strength: 'hard',
  scope: WORK_SCOPE,
  holds: (observation) => {
    if (!isWorkRequest(observation)) return true;
    if (observation.subscription !== 'pending') return true;
    return observation.balance === 0;
  },
};

/* ------------------------------------------------------------------ *
 * causality — the input that must have produced an effect
 * ------------------------------------------------------------------ */

export type FormSubmission = {
  /** `dwell` as the page reports it: ms from form-ready to submit. */
  readonly dwellMs: number | undefined;
  /** The hidden honeypot field. Non-empty means a bot filled everything it saw. */
  readonly honeypot: string;
  readonly fieldsFilled: number;
  readonly interactions: number | undefined;
};

/**
 * A submission with no `dwell` at all did not come from the form.
 *
 * `hard`, and unusually so for a timing-shaped claim: this is not "too fast to be
 * human", it is *the field the page always sends is missing*. Both `index.html` and
 * `order.html` compute `dwell` unconditionally at page load, so its absence proves
 * the request bypassed the page rather than suggesting the human was quick.
 *
 * The threshold version of this — `dwell < 1500ms` — is deliberately **not** here.
 * That is a calibrated number about human speed, so it belongs to the weak-signal
 * catalogue (`SIG_SUBHUMAN_LATENCY`), not to a proof.
 */
export const submissionCameFromForm: Invariant = {
  id: 'ixfe.submission-came-from-form',
  class: 'IMPOSSIBLE_IDLE_ACTION',
  strength: 'hard',
  scope: WAITLIST_SCOPE,
  holds: (observation) => {
    if (!isFormSubmission(observation)) return true;
    return observation.dwellMs !== undefined;
  },
};

/**
 * The honeypot: a field no rendered layout shows, so nothing that can see the page
 * fills it.
 *
 * `soft` rather than `hard`, deliberately. IXFE's own comment calls this "serap
 * diam-diam" — absorb silently — and the reason to keep it a signal is that a
 * password manager or an over-eager autofill extension can populate a hidden input
 * it found in the DOM. Rare, and not impossible, which is the definition of soft.
 */
export const honeypotUntouched: Invariant = {
  id: 'ixfe.honeypot-untouched',
  class: 'IMPOSSIBLE_IDLE_ACTION',
  strength: 'soft',
  scope: WAITLIST_SCOPE,
  holds: (observation) => {
    if (!isFormSubmission(observation)) return true;
    return observation.honeypot === '';
  },
};

/* ------------------------------------------------------------------ *
 * order — timestamps the system itself recorded
 * ------------------------------------------------------------------ */

export type OtpAttempt = {
  /** Whether IXFE ever issued a code for this address, for this purpose. */
  readonly codeWasRequested: boolean;
  readonly purpose: 'register' | 'reset';
  /** Guesses already made against the live code. `otp_codes.attempts`. */
  readonly attemptsSoFar: number;
  readonly maxAttempts: number;
};

/**
 * A code cannot be submitted before it was requested.
 *
 * `/api/auth/otp/request` writes the row; `verifyOtp()` reads it. A submission for
 * an address with no issued code is not a wrong guess — it is a guess at a code
 * that does not exist, which only a script does.
 */
export const otpWasRequestedFirst: Invariant = {
  id: 'ixfe.otp-requested-first',
  class: 'IMPOSSIBLE_TEMPORAL_ORDER',
  strength: 'hard',
  scope: AUTH_SCOPE,
  holds: (observation) => {
    if (!isOtpAttempt(observation)) return true;
    return observation.codeWasRequested;
  },
};

/**
 * Guessing past the per-code attempt cap.
 *
 * `verifyOtp()` burns the code at `OTP_MAX_ATTEMPTS`, so any further guess is
 * against something already dead. IXFE's own comment notes the per-code cap is the
 * fix that survives IP rotation while the rate limiter does not — this is the same
 * fact, expressed where SG can accumulate it against the caller.
 */
export const otpWithinAttemptCap: Invariant = {
  id: 'ixfe.otp-within-attempt-cap',
  class: 'IMPOSSIBLE_TEMPORAL_ORDER',
  strength: 'hard',
  scope: AUTH_SCOPE,
  holds: (observation) => {
    if (!isOtpAttempt(observation)) return true;
    return observation.attemptsSoFar < observation.maxAttempts;
  },
};

/* ------------------------------------------------------------------ *
 * issuance — values the system itself handed out
 * ------------------------------------------------------------------ */

export type IssuedReference = {
  readonly kind: 'activation-token' | 'order-id' | 'invoice-external-id';
  /** The identifier presented by the caller. */
  readonly id: string;
  /** Whether IXFE's own records contain it. */
  readonly wasIssued: boolean;
  /** Whether it has already been used, where single-use applies. */
  readonly alreadyConsumed?: boolean;
};

/**
 * A reference IXFE never issued cannot have come from IXFE.
 *
 * This is the class the original five could not express (D41), and IXFE has three
 * instances of it at once: the activation `jti` in `activation_consumed`, the
 * `order_id` in `payments`, and the `external_id` a Xendit callback claims. The
 * webhook case is the one with money attached — `/api/billing/xendit/callback`
 * already answers 404 for an unknown `external_id`, and this is what turns that
 * refusal into evidence about the caller rather than a discarded log line.
 */
export const referenceWasIssued: Invariant = {
  id: 'ixfe.reference-was-issued',
  class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
  strength: 'hard',
  scope: BILLING_SCOPE,
  holds: (observation) => {
    if (!isIssuedReference(observation)) return true;
    return observation.wasIssued;
  },
};

/**
 * Single-use means once. `activation_consumed` is a primary key on `jti` precisely
 * so a replayed activation link cannot mint a second discounted account.
 */
export const singleUseNotReplayed: Invariant = {
  id: 'ixfe.single-use-not-replayed',
  class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
  strength: 'hard',
  scope: BILLING_SCOPE,
  holds: (observation) => {
    if (!isIssuedReference(observation)) return true;
    return observation.alreadyConsumed !== true;
  },
};

/* ------------------------------------------------------------------ *
 * exclusivity — facts that cannot both be true
 * ------------------------------------------------------------------ */

export type LaunchClaim = {
  /** Whether IXFE has passed its launch moment. `launched()`. */
  readonly launched: boolean;
  /** What the caller is trying to do. */
  readonly intent: 'join-waitlist' | 'pre-order' | 'register' | 'login';
};

/**
 * The waiting list and being live are mutually exclusive.
 *
 * IXFE returns 410 for both after launch, and its comment explains why the check
 * cannot live in the UI: the form is hidden, but the endpoint can still be shot at
 * directly. A caller asking to join a waiting list for a product that is already
 * live is holding two contradictory facts — most likely a replayed request from a
 * recorded session, which is exactly what the premise of this whole design says an
 * attacker can do.
 */
export const launchClaimConsistent: Invariant = {
  id: 'ixfe.launch-claim-consistent',
  class: 'IMPOSSIBLE_EXCLUSIVE_STATE',
  strength: 'hard',
  scope: WAITLIST_SCOPE,
  holds: (observation) => {
    if (!isLaunchClaim(observation)) return true;
    if (!observation.launched) return true;
    return observation.intent !== 'join-waitlist' && observation.intent !== 'pre-order';
  },
};

/** Every invariant, and the scopes they cover. */
export const ixfeInvariants: readonly Invariant[] = [
  orderFunnel,
  authFlow,
  workRequiresCredits,
  workRequiresActiveSubscription,
  submissionCameFromForm,
  honeypotUntouched,
  otpWasRequestedFirst,
  otpWithinAttemptCap,
  referenceWasIssued,
  singleUseNotReplayed,
  launchClaimConsistent,
];

/* ------------------------------------------------------------------ *
 * Shape guards. Each invariant must ignore observations that are not its
 * business — D32 says an undeclared shape is unknown, never forbidden.
 * ------------------------------------------------------------------ */

function isWorkRequest(value: unknown): value is WorkRequest {
  return isRecord(value) && typeof value.action === 'string' && typeof value.balance === 'number';
}

function isFormSubmission(value: unknown): value is FormSubmission {
  return isRecord(value) && typeof value.honeypot === 'string';
}

function isOtpAttempt(value: unknown): value is OtpAttempt {
  return isRecord(value) && typeof value.codeWasRequested === 'boolean';
}

function isIssuedReference(value: unknown): value is IssuedReference {
  return isRecord(value) && typeof value.kind === 'string' && typeof value.wasIssued === 'boolean';
}

function isLaunchClaim(value: unknown): value is LaunchClaim {
  return isRecord(value) && typeof value.launched === 'boolean' && typeof value.intent === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

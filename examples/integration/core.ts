/**
 * A host integration, reduced to what it actually takes to adopt Scorpio Guard.
 *
 * Three things live here and nothing else: the invariants the host declares, the
 * observation it sends, and what it does with the advice it gets back. HTTP is a
 * detail, so both servers below share this file instead of restating it.
 *
 * The booleans in the observation stand in for facts the host already holds: its own
 * issuance record for a token, and its own record of whether this client logged in.
 * SG never infers either, and never learns them.
 */
import { createGuard, type Assessment, type Decision, type Invariant } from '../../src/index.ts';

export const LOGIN_SCOPE = 'login';
export const DATA_SCOPE = 'data';

export const integrationInvariants: readonly Invariant[] = [
  {
    id: 'login-token-unissued',
    class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
    strength: 'hard',
    scope: LOGIN_SCOPE,
    holds: (observation) => (observation as { tokenWasIssued?: boolean }).tokenWasIssued !== false,
  },
  {
    id: 'data-read-before-login',
    class: 'IMPOSSIBLE_TEMPORAL_ORDER',
    strength: 'soft',
    scope: DATA_SCOPE,
    holds: (observation) => (observation as { afterLogin?: boolean }).afterLogin !== false,
  },
];

export type HostRoute = 'login' | 'data';

export type RawRequest = {
  readonly body?: Record<string, unknown>;
  readonly headers?: Record<string, string | undefined>;
};

/** The observation the host sends. Shape belongs to SG, content belongs to the host. */
export function dataFor(route: HostRoute, raw: RawRequest): Record<string, unknown> {
  if (route === 'login') return { tokenWasIssued: raw.body?.tokenWasIssued !== false };
  return { afterLogin: raw.headers?.['x-after-login'] === '1' };
}

export function createIntegrationGuard() {
  return createGuard({ invariants: integrationInvariants });
}

export type Handler = ReturnType<typeof createIntegrationGuard>;

export type HostAction = {
  readonly status: number;
  readonly host: string;
  readonly headers: Record<string, string>;
};

/**
 * What the host does with the advice. SG stops at the advice; this switch is the whole
 * reason the library is advisory, and every host writes its own. D14.
 */
export function actOn(decision: Decision): HostAction {
  if (decision === 'ALLOW') return { status: 200, host: 'serve', headers: {} };
  if (decision === 'OBSERVE') {
    return { status: 200, host: 'serve and record', headers: { 'x-guard-observed': '1' } };
  }
  if (decision === 'INCREASE_FRICTION') {
    return { status: 429, host: 'serve later, slower', headers: { 'retry-after': '2' } };
  }
  if (decision === 'RESTRICT') {
    return { status: 403, host: 'refuse this action, keep the session', headers: {} };
  }
  return { status: 403, host: 'refuse and end the session', headers: {} };
}

export type GuardedResponse = {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: {
    readonly decision: Decision;
    readonly reason: string;
    readonly host: string;
    readonly trace: readonly string[];
  };
  readonly assessment: Assessment;
};

export async function decide(
  guard: Handler,
  input: {
    readonly entity: string;
    readonly route: HostRoute;
    readonly raw?: RawRequest;
    readonly signals?: readonly string[];
  },
): Promise<GuardedResponse> {
  const observation = {
    scope: input.route === 'login' ? LOGIN_SCOPE : DATA_SCOPE,
    data: dataFor(input.route, input.raw ?? {}),
    signals: input.signals ?? [],
  };
  const assessment = await guard.evaluate({
    entity: input.entity,
    observation,
    context: { route: input.route },
  });
  const action = actOn(assessment.decision);
  return {
    status: action.status,
    headers: action.headers,
    body: {
      decision: assessment.decision,
      reason: assessment.trust.reason,
      host: action.host,
      trace: assessment.trace,
    },
    assessment,
  };
}

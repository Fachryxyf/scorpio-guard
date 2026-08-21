/**
 * Declared invariants for HealthMe. D34, and D16/D32 in the design record.
 *
 * These describe HealthMe's actual unlock flow, not a synthetic fixture. Scope is
 * kept narrow on purpose: declaring a constraint `hard` asserts the edge set is
 * *complete* for that scope (D32), and the unlock flow is small enough to
 * enumerate honestly. Navigation inside the unlocked app is not, so it is absent
 * rather than guessed at.
 */
import type { Invariant } from '../../src/core/constraints.ts';
import { transitionGraph } from '../../src/core/transitions.ts';

/** Coarse application states, observable from either side of the wire. */
export const UNLOCK_SCOPE = 'healthme.unlock';
export const API_SCOPE = 'healthme.api';

/**
 * The unlock flow, exhaustively.
 *
 *   locked -> attempting   the PIN form was submitted
 *   attempting -> locked   the attempt failed
 *   attempting -> unlocked the hash matched and the vault loaded
 *   unlocked -> locked     the tab closed, or the session hash was cleared
 *
 * No other transition exists in the application. Notably `locked -> unlocked`
 * does not: reaching the unlocked state without an attempt in between is the
 * impossible segment jump this declaration exists to catch.
 */
export const unlockFlow: Invariant = transitionGraph({
  id: 'healthme.unlock-flow',
  scope: UNLOCK_SCOPE,
  strength: 'hard',
  class: 'IMPOSSIBLE_SEGMENT_JUMP',
  allowed: [
    { from: 'locked', to: 'attempting' },
    { from: 'attempting', to: 'locked' },
    { from: 'attempting', to: 'unlocked' },
    { from: 'unlocked', to: 'locked' },
  ],
});

export type ApiCall = {
  /** Application state at the moment of the call. */
  readonly state: 'locked' | 'attempting' | 'unlocked';
  /** Whether an unlock has ever succeeded in this session. */
  readonly unlockedThisSession: boolean;
  /** Whether the vault script has been fetched. */
  readonly vaultLoaded?: boolean;
  /** Whether the lock screen was ever rendered before the attempt. */
  readonly lockScreenRendered?: boolean;
  /** Pointer or keyboard interactions observed for a submitted field. */
  readonly interactions?: number;
  readonly fieldPopulated?: boolean;
};

/**
 * `api/chat.js` cannot legitimately be reached before an unlock succeeds.
 *
 * `js/core.js` holds the only caller, and it is not fetched until the PIN
 * verifies. So a call with no successful unlock in the session did not come from
 * the application \u2014 provable from the app's own structure, not inferred from
 * how unusual it looks.
 */
export const apiRequiresUnlock: Invariant = {
  id: 'healthme.api-requires-unlock',
  class: 'IMPOSSIBLE_TEMPORAL_ORDER',
  strength: 'hard',
  scope: API_SCOPE,
  holds: (observation) => {
    if (!isApiCall(observation)) return true;
    return observation.unlockedThisSession;
  },
};

/**
 * The vault is not fetched while locked.
 *
 * `handleUnlock` fetches `js/core.js` only after the hash comparison passes, so a
 * request for it from a locked state skipped the prerequisite.
 */
export const vaultRequiresUnlock: Invariant = {
  id: 'healthme.vault-prerequisite',
  class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
  strength: 'hard',
  scope: UNLOCK_SCOPE,
  holds: (observation) => {
    if (!isApiCall(observation)) return true;
    if (!observation.vaultLoaded) return true;
    return observation.state !== 'locked';
  },
};

/**
 * An unlock attempt presupposes the lock screen was rendered.
 *
 * The PIN can only be submitted through a form that exists after render. A
 * populated field with zero interactions is the impossible idle action named in
 * the design notes \u2014 consistent with direct scripting rather than human input.
 *
 * Declared `soft`, not `hard`: assistive technology, password managers and paste
 * can all produce a populated field with few interaction events. The claim that
 * this cannot happen legitimately is one this scope cannot honestly make, so it
 * contributes evidence instead of proof.
 */
export const attemptRequiresInteraction: Invariant = {
  id: 'healthme.attempt-interaction',
  class: 'IMPOSSIBLE_IDLE_ACTION',
  strength: 'soft',
  scope: UNLOCK_SCOPE,
  holds: (observation) => {
    if (!isApiCall(observation)) return true;
    if (!observation.fieldPopulated) return true;
    if (observation.lockScreenRendered === false) return false;
    return (observation.interactions ?? 0) > 0;
  },
};

export const healthmeInvariants: readonly Invariant[] = [
  unlockFlow,
  apiRequiresUnlock,
  vaultRequiresUnlock,
  attemptRequiresInteraction,
];

function isApiCall(value: unknown): value is ApiCall {
  return typeof value === 'object' && value !== null && 'state' in value;
}

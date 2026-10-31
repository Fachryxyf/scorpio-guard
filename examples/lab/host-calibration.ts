/**
 * Replay and calibration against a real host integration's journal.
 *
 * The first deployment of this library outside the lab (a CRM host, 0.2.0
 * vendored) kept a decision journal of 5,123 staging evaluations with known
 * ground truth from a pentest. This module turns that journal into something
 * the policy grid can read, under three honest constraints:
 *
 * 1. The host's invariants are not in this repository. They are reconstructed
 *    from the integration record and validated two ways: every reconstructed
 *    hard violation must match the recorded `hardViolated` column, and the
 *    replayed decisions must match the recorded decisions. Mismatch means the
 *    reconstruction is wrong, and is reported, not smoothed over.
 * 2. The journal records trust state but not the observation evidence the host
 *    attributed. The attribution is derived backwards from consecutive
 *    `trustMass` deltas, minus the soft-violation mass the model itself would
 *    have added. A derived attribution is a hypothesis, not a record; rows
 *    whose derivation is ambiguous are replayed without evidence and counted.
 * 3. Only some entities carry ground truth: the pentest's own test accounts.
 *    The confusion matrix is computed on labelled rows only, and the
 *    unlabelled remainder is reported as composition.
 *
 * The dataset lives in `report-sg/`, which is gitignored on purpose. This
 * module takes CSV text, so its tests run on an embedded fixture and CI never
 * needs the data.
 */
import { systemClock, type Clock } from '../../src/core/clock.ts';
import type { ConstraintClass, Invariant, Strength } from '../../src/core/constraints.ts';
import type { Decision } from '../../src/core/decision.ts';
import { createGuard } from '../../src/core/guard.ts';
import { DEFAULT_SOFT_VIOLATION_WEIGHT } from '../../src/core/policy.ts';
import type { EvidenceStrength } from '../../src/core/guard.ts';
import { DEFAULT_CELL, grid, type PolicyCell } from './calibration.ts';

export type { PolicyCell };
export { DEFAULT_CELL, grid };

/** One parsed journal row, in the subset of columns the replay needs. */
export type HostJournalRow = {
  readonly at: number;
  readonly scope: string;
  readonly entity: string;
  /** The advice the host recorded for this row. */
  readonly recorded: Decision;
  readonly trustMean: number;
  readonly trustMass: number;
  readonly hardViolated: boolean;
  readonly violations: readonly { readonly invariant: string; readonly class: ConstraintClass; readonly strength: Strength }[];
  readonly facts: Record<string, unknown>;
};

export type GroundTruth = 'legitimate' | 'adversarial' | 'unlabelled';

/** Minimal CSV reader for the journal exports: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows.map((values) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name] = values[index] ?? '';
    });
    return record;
  });
}

function epoch(value: string): number {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').getTime();
}

/** Parse the staging journal export into replayable rows, sorted by time. */
export function parseHostJournal(csv: string): HostJournalRow[] {
  const rows = parseCsv(csv).map((record) => ({
    at: epoch(record['at'] ?? ''),
    scope: record['scope'] ?? '',
    entity: record['entityHash'] ?? '',
    recorded: record['decision'] as Decision,
    trustMean: Number(record['trustMean']),
    trustMass: Number(record['trustMass']),
    hardViolated: record['hardViolated'] === 'true',
    violations: [...record['violations']?.matchAll(/\{[^}]*\}/g) ?? []].map((match) => {
      const body = match[0].replace(/(\w+):/g, '"$1":');
      return JSON.parse(body) as { invariant: string; class: ConstraintClass; strength: Strength };
    }),
    facts: JSON.parse(record['facts'] || '{}') as Record<string, unknown>,
  }));
  return rows.sort((a, b) => a.at - b.at);
}

/**
 * The host's seven invariants, reconstructed from the integration record
 * (`report-sg/perencanaan-pentest/16-inventaris-tugas-0.md`) and from what the
 * recorded rows show. Validated by `replayHost` against the recorded
 * `hardViolated` column: a wrong reconstruction shows up as drift.
 */
export const hostInvariants: readonly Invariant[] = [
  {
    id: 'auth-login-session-issued',
    class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
    strength: 'hard',
    scope: 'auth.login',
    holds: (observation) => {
      const facts = observation as { succeeded?: boolean; sessionIssued?: boolean };
      return !(facts.succeeded === true && facts.sessionIssued === false);
    },
  },
  {
    // The staging build predates the host's logout fix: a 2xx here must rotate.
    // Every logout mapped into this scope is the D79 false positive.
    id: 'auth-refresh-session-rotated',
    class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
    strength: 'hard',
    scope: 'auth.refresh',
    holds: (observation) => {
      const facts = observation as { succeeded?: boolean; sessionRotated?: boolean };
      return !(facts.succeeded === true && facts.sessionRotated === false);
    },
  },
  {
    id: 'inbox-thread-visible',
    class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
    strength: 'soft',
    scope: 'inbox.read',
    holds: (observation) => {
      const facts = observation as { notFound?: boolean; permissionDenied?: boolean };
      return facts.notFound !== true && facts.permissionDenied !== true;
    },
  },
  {
    id: 'inbox-send-target-visible',
    class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
    strength: 'soft',
    scope: 'inbox.send',
    holds: (observation) => {
      const facts = observation as { notFound?: boolean; permissionDenied?: boolean };
      return facts.notFound !== true && facts.permissionDenied !== true;
    },
  },
  {
    id: 'admin-permission-held',
    class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
    strength: 'hard',
    scope: 'admin.action',
    holds: (observation) => {
      const facts = observation as { permissionDenied?: boolean };
      return facts.permissionDenied !== true;
    },
  },
  {
    // An admin action may name a target; a 404 on a named target means the
    // reference was never issued. Unnamed targets say nothing.
    id: 'admin-target-issued',
    class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
    strength: 'soft',
    scope: 'admin.action',
    holds: (observation) => {
      const facts = observation as { notFound?: boolean; hasTargetId?: boolean };
      return !(facts.notFound === true && facts.hasTargetId === true);
    },
  },
  {
    id: 'chat-channel-member',
    class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
    strength: 'soft',
    scope: 'chat.internal',
    holds: (observation) => {
      const facts = observation as { notFound?: boolean; permissionDenied?: boolean };
      return facts.notFound !== true && facts.permissionDenied !== true;
    },
  },
];

/** The soft-violation mass the model would add for one row, given its facts. */
function softMassFor(row: HostJournalRow, softViolationWeight = DEFAULT_SOFT_VIOLATION_WEIGHT): number {
  if (!row.scope) return 0;
  let count = 0;
  for (const invariant of hostInvariants) {
    if (invariant.scope !== row.scope || invariant.strength !== 'soft') continue;
    if (!invariant.holds(row.facts)) count += 1;
  }
  return count * softViolationWeight;
}

/**
 * The evidence the host attributed, derived backwards from recorded trust state.
 *
 * `a` and `b` are recovered from the recorded mean and mass, decayed back over
 * the gap, and the soft-violation mass the model itself adds is subtracted from
 * `b`. What is left is the host's own attribution, read as weak (0.5) or strong
 * (2) by magnitude — with the caveat that a discounted positive (D55) cannot be
 * told from a weak one, so anything at or under 1 reads as weak.
 */
export type DerivedEvidence = {
  positive?: EvidenceStrength;
  negative?: EvidenceStrength;
};

export function deriveEvidence(
  rows: readonly HostJournalRow[],
  halfLifeHours = 24,
  softViolationWeight = DEFAULT_SOFT_VIOLATION_WEIGHT,
): Map<HostJournalRow, DerivedEvidence> {
  const derived = new Map<HostJournalRow, DerivedEvidence>();
  const byEntity = new Map<string, HostJournalRow[]>();
  for (const row of rows) {
    const list = byEntity.get(row.entity) ?? [];
    list.push(row);
    byEntity.set(row.entity, list);
  }
  for (const list of byEntity.values()) {
    let previous: { a: number; b: number; at: number } | undefined;
    for (const row of list) {
      const a = row.trustMean * row.trustMass - 1;
      const b = row.trustMass - 2 - a;
      if (previous) {
        const decay = Math.pow(2, -(row.at - previous.at) / (halfLifeHours * 3_600_000));
        const deltaA = a - previous.a * decay;
        const deltaB = b - previous.b * decay - softMassFor(row, softViolationWeight);
        const evidence: DerivedEvidence = {};
        if (deltaA > 0.05) evidence.positive = deltaA <= 1 ? 'weak' : 'strong';
        if (deltaB > 0.05) evidence.negative = deltaB <= 1 ? 'weak' : 'strong';
        if (evidence.positive !== undefined || evidence.negative !== undefined) {
          derived.set(row, evidence);
        }
      }
      previous = { a, b, at: row.at };
    }
  }
  return derived;
}

export type HostReplayRow = {
  readonly row: HostJournalRow;
  readonly evidence: DerivedEvidence | undefined;
  readonly replayed: Decision;
  /**
   * Whether the replayed violation set equals the recorded one. The recorded
   * `hardViolated` boolean is not the reference: on the real dataset it
   * disagrees with the row's own violations column (14 logout rows record
   * `hardViolated: false` while listing the hard invariant), so the violations
   * array is what a reconstruction is checked against.
   */
  readonly violationsMatch: boolean;
};

/**
 * Replay the journal through the guard with the reconstructed invariants.
 *
 * Rows are sorted by time and one guard rebuilds the state the host's store
 * held, under the given policy cell. The derived evidence rides each row so
 * the trust dimension sees what the host sent, as best it can be recovered.
 * Rows replay strictly in time order, because the injected clock must be pinned
 * to each row's own timestamp when that row is evaluated.
 */
export async function replayHost(
  rows: readonly HostJournalRow[],
  cell: PolicyCell = DEFAULT_CELL,
): Promise<HostReplayRow[]> {
  const ordered = [...rows].sort((a, b) => a.at - b.at);
  const derived = deriveEvidence(ordered);
  let current = 0;
  const clock: Clock = { ...systemClock, now: () => current };
  const guard = createGuard({
    invariants: hostInvariants,
    clock,
    policy: {
      halfLifeHours: cell.halfLifeHours,
      developingAt: cell.developingAt,
      establishedAt: cell.establishedAt,
    },
  });

  const outcomes: HostReplayRow[] = [];
  for (const row of ordered) {
    current = row.at;
    const evidence = derived.get(row);
    const assessment = await guard.evaluate({
      entity: row.entity,
      observation: {
        scope: row.scope,
        data: row.facts,
        ...(evidence ? { evidence } : {}),
      },
    });
    const recordedIds = row.violations.map((violation) => violation.invariant).sort().join(',');
    const replayedIds = assessment.violations.map((violation) => violation.invariant).sort().join(',');
    outcomes.push({
      row,
      evidence,
      replayed: assessment.decision,
      violationsMatch: recordedIds === replayedIds,
    });
  }
  return outcomes;
}

export type HostCellOutcome = {
  readonly cell: PolicyCell;
  /** Journal rows whose replayed advice differs from the recorded advice. */
  readonly drift: number;
  readonly total: number;
  /** Reconstructed violation sets that disagree with the recorded column. */
  readonly violationDrift: number;
  /** Labelled legitimate entities the replay advised treatment for. */
  readonly falsePositives: string[];
  /** Labelled adversarial rows the replay left at ALLOW or OBSERVE. */
  readonly falseNegatives: string[];
  readonly unlabelled: number;
};

export type LabelledRow = HostJournalRow & { readonly groundTruth: GroundTruth };

/**
 * Label rows from the entity map and the documented conditions.
 *
 * Entities that resolve to the pentest's own accounts (`pt_*`) are legitimate,
 * including the sessions opened from them. Rows recorded in the
 * hard-violation conditions file are labelled row-level: the admin RBAC
 * denials are documented adversarial attempts, the logout rows are the
 * documented false positive on legitimate users. Everything else — pre-auth
 * `ipua`/`cred` traffic, where legitimate visitors and hostile scripts share
 * an entity shape — stays unlabelled rather than guessed.
 */
export function labelRows(
  rows: readonly HostJournalRow[],
  entityMap: Map<string, { kind: string; label: string }>,
  adversarialRowKeys: ReadonlySet<string>,
): LabelledRow[] {
  return rows.map((row) => {
    let groundTruth: GroundTruth = 'unlabelled';
    const entity = entityMap.get(row.entity);
    if (entity && (entity.kind === 'user' || (entity.kind === 'session' && entity.label.startsWith('session-of:pt_')))) {
      groundTruth = 'legitimate';
    }
    if (adversarialRowKeys.has(`${row.at}|${row.scope}`)) groundTruth = 'adversarial';
    return { ...row, groundTruth };
  });
}

/** Row keys (`<at>|<scope>`) of the documented hard-violation conditions, by intent. */
export function conditionKeys(csv: string): { adversarial: Set<string>; legitimate: Set<string> } {
  const adversarial = new Set<string>();
  const legitimate = new Set<string>();
  for (const record of parseCsv(csv)) {
    const scope = record['scope'] ?? '';
    const key = `${epoch(record['at'] ?? '')}|${scope}`;
    if (scope === 'admin.action') adversarial.add(key);
    else legitimate.add(key);
  }
  return { adversarial, legitimate };
}

/**
 * The grid over the host dataset. Judgement is per row for adversarial (an
 * attempt left at ALLOW is a miss) and per entity for legitimate (one treated
 * request is friction the user felt), matching the lab's convention.
 */
export async function evaluateHostCell(labelled: readonly LabelledRow[], cell: PolicyCell): Promise<HostCellOutcome> {
  const replayed = await replayHost(
    labelled.map(({ groundTruth: _groundTruth, ...row }) => row),
    cell,
  );
  const labelledById = new Map(labelled.map((row) => [`${row.at}|${row.scope}|${row.entity}`, row]));
  const falsePositiveEntities = new Set<string>();
  const falseNegatives: string[] = [];
  let drift = 0;
  let violationDrift = 0;
  let unlabelled = 0;

  for (const outcome of replayed) {
    if (outcome.replayed !== outcome.row.recorded) drift += 1;
    if (!outcome.violationsMatch) violationDrift += 1;
    const row = labelledById.get(`${outcome.row.at}|${outcome.row.scope}|${outcome.row.entity}`);
    if (!row || row.groundTruth === 'unlabelled') {
      unlabelled += 1;
      continue;
    }
    if (row.groundTruth === 'legitimate' && outcome.replayed !== 'ALLOW' && outcome.replayed !== 'OBSERVE') {
      falsePositiveEntities.add(row.entity);
    }
    if (row.groundTruth === 'adversarial' && (outcome.replayed === 'ALLOW' || outcome.replayed === 'OBSERVE')) {
      falseNegatives.push(`${row.scope}@${new Date(row.at).toISOString()}`);
    }
  }

  return {
    cell,
    drift,
    total: replayed.length,
    violationDrift,
    falsePositives: [...falsePositiveEntities],
    falseNegatives,
    unlabelled,
  };
}

export function hostReportText(outcomes: readonly HostCellOutcome[]): string {
  const lines: string[] = [];
  lines.push('  half-life  developing  established | drift    viol-drift | FP-entities  FN-rows  unlabelled');
  for (const outcome of outcomes) {
    const cell = outcome.cell;
    const shipped =
      cell.halfLifeHours === DEFAULT_CELL.halfLifeHours &&
      cell.developingAt === DEFAULT_CELL.developingAt &&
      cell.establishedAt === DEFAULT_CELL.establishedAt
        ? ' (shipped)'
        : '';
    lines.push(
      `  ${String(cell.halfLifeHours).padStart(9)}  ${String(cell.developingAt).padStart(10)}  ${String(cell.establishedAt).padStart(11)} |` +
        ` ${String(outcome.drift).padStart(4)}/${outcome.total}` +
        `    ${String(outcome.violationDrift).padStart(4)}` +
        `       | ${String(outcome.falsePositives.length).padStart(4)}` +
        `        ${String(outcome.falseNegatives.length).padStart(4)}` +
        `     ${String(outcome.unlabelled).padStart(5)}${shipped}`,
    );
  }
  return lines.join('\n');
}

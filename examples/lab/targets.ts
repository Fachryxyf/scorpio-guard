/**
 * The targets the lab can observe, and what each one can prove. M2.1.
 *
 * Two rows, both live sites, both owned by the maintainer: aufsicht.dev and talkhere.life.
 * Neither declares invariants, because a marketing page cannot prove that an order was
 * skipped or a token was replayed. Whatever the lab records there is statistical, and the
 * dataset says so instead of borrowing the authority of a target that could prove one.
 *
 * A third row was removed on 2026-10-25: ixfe.pro, the application that declared invariants
 * and carried the strongest evidence in the dataset. The deployment stopped answering, so a
 * row that can never run is a row that lies about what the lab observes. The recording, the
 * frozen fixture, and the invariant declarations stay where they are, labelled as the record
 * of a site that is offline, and D47 keeps the reasoning that chose it.
 *
 * Both live targets can also be served from a local build, which is what the two LAB_ root
 * variables are for. A build directory that does not exist is reported as an unavailable
 * target instead of being silently skipped, and the live origin is used when no build is
 * given.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { LiveProfile } from '../ixfe/live/proxy.ts';
import { ixfeInvariants } from '../ixfe/invariants.ts';
import type { Invariant } from '../../src/core/constraints.ts';

export type LabTarget = {
  readonly id: string;
  readonly label: string;
  /** Absolute directory served as the site; absent for a live origin. */
  readonly root?: string;
  /** Live origin, when the target is a deployment rather than a local build. */
  readonly origin?: string;
  /** Path the personas land on. */
  readonly entry: string;
  /** Where the build under test came from, so a reader can tell what was measured. */
  readonly source: string;
  readonly profile: LiveProfile;
};

const ASSET = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|txt|xml|json)$/i;

/** Sections worth separating, so browsing across them is visible as diversity. */
const SECTIONS = new Set(['blog', 'docs', 'about', 'pricing', 'komunitas', 'app']);

/**
 * A profile for a site that can prove nothing.
 *
 * One scope per section rather than one per path: scopes exist so the diversity
 * dimension can tell a reader who crosses sections from a script that hammers one
 * URL, and collapsing every path into a single scope would erase exactly that.
 */
export function staticProfile(id: string): LiveProfile {
  return {
    id,
    invariants: [],
    scopeFor: (method, path) => {
      if (method !== 'GET') return undefined;
      if (ASSET.test(path)) return undefined;
      const section = (path.split('/').filter(Boolean)[0] ?? '').toLowerCase();
      return id + '.' + (SECTIONS.has(section) ? section : 'page');
    },
    isPageView: () => true,
  };
}

/**
 * Where a static build lives on this machine. The repository does not carry those paths:
 * they are one person disk layout, they differ per contributor, and a public repository
 * that hardcodes them hands every reader a description of the maintainer machine. An
 * environment variable wins, then `var/lab-paths.json`, which git ignores, then nothing, and
 * the target reports itself unavailable instead of quietly disappearing from the run.
 */
function localPath(id: string, envName: string): string | undefined {
  const fromEnv = process.env[envName];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const file = resolve('var/lab-paths.json');
  if (!existsSync(file)) return undefined;
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const value = parsed[id];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Absent, not undefined: exactOptionalPropertyTypes is on, and a target with no root is
 * a target with no root rather than one whose root is undefined. */
function withRoot(root: string | undefined): { root?: string } {
  return root === undefined ? {} : { root };
}

export function labTargets(): LabTarget[] {
  return [
    {
      id: 'aufsicht',
      label: 'aufsicht.dev',
      origin: process.env.LAB_AUFSICHT_ORIGIN ?? 'https://aufsicht.dev',
      ...withRoot(localPath('aufsicht', 'LAB_AUFSICHT_ROOT')),
      entry: '/',
      source:
        'the live deployment at aufsicht.dev, or the build in LAB_AUFSICHT_ROOT when one is set',
      profile: staticProfile('aufsicht'),
    },
    {
      id: 'talkhere',
      label: 'talkhere.life',
      origin: process.env.LAB_TALKHERE_ORIGIN ?? 'https://talkhere.life',
      ...withRoot(localPath('talkhere', 'LAB_TALKHERE_ROOT')),
      entry: '/',
      source:
        'the live deployment at talkhere.life, or the build in LAB_TALKHERE_ROOT when one is set',
      profile: staticProfile('talkhere'),
    },
  ];
}

export function unavailableReason(target: LabTarget): string | undefined {
  if (target.root !== undefined && !existsSync(target.root)) {
    return 'no build at ' + target.root + ' (set LAB_' + target.id.toUpperCase() + '_ROOT)';
  }
  if (target.root === undefined && target.origin === undefined) {
    return (
      'no build root (set LAB_' + target.id.toUpperCase() + '_ROOT, or put a path in var/lab-paths.json)'
    );
  }
  return undefined;
}

/**
 * The invariants a recorded profile declared, by the id the fixture carries.
 *
 * A replay that judges a row against no invariants cannot reproduce a hard violation,
 * and the missing RESTRICT then looks exactly like drift in the model. The declarations
 * are code, so the fixture stores the profile id and this resolves it; a change to the
 * declarations therefore shows up as a fixture diff, which is the point of freezing.
 */
export function invariantsFor(profileId: string): readonly Invariant[] {
  if (profileId === 'ixfe') return ixfeInvariants;
  return [];
}

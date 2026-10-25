/**
 * The targets the lab can observe, and what each one can prove. M2.1.
 *
 * Three rows, and their differences are the point:
 *
 * - IXFE declares invariants, so a proven violation is available to the observer.
 * - The two static sites declare none, because a marketing page cannot prove that an
 *   order was skipped or a token was replayed. Whatever the lab records there is
 *   statistical, and the dataset says so rather than borrowing IXFE's authority.
 *
 * The static builds live outside this repository, so a missing directory is reported
 * as an unavailable target instead of being silently skipped.
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
      id: 'ixfe',
      label: 'the IXFE landing service, the app D56 and D57 observed',
      origin: process.env.LAB_IXFE_ORIGIN ?? 'https://ixfe.pro',
      entry: '/',
      source: 'the live deployment, driven by the personas in examples/ixfe/live/visitors.ts',
      // Replaced by IXFE_PROFILE in the runner: the type would otherwise have to
      // import the invariants here, and this file should stay a catalogue.
      profile: staticProfile('ixfe'),
    },
    {
      id: 'aufsicht',
      label: 'aufsicht.dev',
      ...withRoot(localPath('aufsicht', 'LAB_AUFSICHT_ROOT')),
      entry: '/index.html',
      source: 'the static build in ARBITERAI/landing, served locally',
      profile: staticProfile('aufsicht'),
    },
    {
      id: 'talkhere',
      label: 'talkhere.life',
      ...withRoot(localPath('talkhere', 'LAB_TALKHERE_ROOT')),
      entry: '/index.html',
      source: 'the static build in TalkHere/dist, served locally',
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

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
import { existsSync } from 'node:fs';

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

export function labTargets(): LabTarget[] {
  return [
    {
      id: 'ixfe',
      label: 'ixfe.pro, the deployment D56 and D57 observed',
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
      root: process.env.LAB_AUFSICHT_ROOT ?? '/Users/user/XYF TECH SOLUTION/PRODUK/ARBITERAI/landing',
      entry: '/index.html',
      source: 'the static build in ARBITERAI/landing, served locally',
      profile: staticProfile('aufsicht'),
    },
    {
      id: 'talkhere',
      label: 'talkhere.life',
      root: process.env.LAB_TALKHERE_ROOT ?? '/Users/user/XYF TECH SOLUTION/PRODUK/TalkHere/dist',
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
  if (target.root === undefined && target.origin === undefined) return 'no root and no origin';
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

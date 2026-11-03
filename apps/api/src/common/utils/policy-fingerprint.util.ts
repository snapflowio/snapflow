/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.util';

const FINGERPRINT_ALGORITHM = 'sha256';
const FINGERPRINT_ENCODING = 'hex';
const REVISION_HEX_DIGITS = 8;
const REVISION_RADIX = 16;
const POSITIVE_INT32_MASK = 0x7f_ff_ff_ff;
const MINIMUM_REVISION = 1;

export function policyFingerprint(policy: unknown): string {
	return createHash(FINGERPRINT_ALGORITHM)
		.update(canonicalJson(policy))
		.digest(FINGERPRINT_ENCODING);
}

export function policyRevision(policy: unknown): number {
	const revision =
		Number.parseInt(
			policyFingerprint(policy).slice(0, REVISION_HEX_DIGITS),
			REVISION_RADIX
		) & POSITIVE_INT32_MASK;
	return Math.max(MINIMUM_REVISION, revision);
}

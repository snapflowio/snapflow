/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { canonicalJson } from '../../common/utils/canonical-json.util';
import { IDEMPOTENCY_FINGERPRINT_SCHEMA_VERSION } from '../constants/idempotency.constants';

function canonicalValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalValue);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, child]) => child !== undefined)
				.map(([key, child]) => [key, canonicalValue(child)])
		);
	}
	return value;
}

export function idempotencyFingerprintSubject(input: unknown): string {
	return canonicalJson({
		schemaVersion: IDEMPOTENCY_FINGERPRINT_SCHEMA_VERSION,
		input: canonicalValue(input),
	});
}

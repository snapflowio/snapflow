/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, timingSafeEqual } from 'node:crypto';

const SECRET_DIGEST_ALGORITHM = 'sha256';

function secretDigest(value: string): Buffer {
	return createHash(SECRET_DIGEST_ALGORITHM).update(value).digest();
}

export function secretsEqual(expected: string, actual: string): boolean {
	return timingSafeEqual(secretDigest(expected), secretDigest(actual));
}

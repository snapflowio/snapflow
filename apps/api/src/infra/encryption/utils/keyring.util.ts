/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ENCRYPTION_ENCODING } from '../constants/encryption.constants';
import type { Keyring } from '../schemas/encryption.schema';

export function keyringBuffers(keyring: Keyring): Map<string, Buffer> {
	return new Map(
		Object.entries(keyring.keys).map(([keyId, encoded]) => [
			keyId,
			Buffer.from(encoded, ENCRYPTION_ENCODING),
		])
	);
}

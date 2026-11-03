/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Provider } from '@nestjs/common';
import { readVaultKvField } from '../../../common/utils/vault-client.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ENCRYPTION_KEYRING_MAXIMUM_BYTES } from '../constants/encryption.constants';
import { type Keyring, keyringSchema } from '../schemas/encryption.schema';

export const KEYRINGS = Symbol('KEYRINGS');

export const KeyringVaultPath = {
	ENCRYPTION: 'snapflow/api/encryption-keyring',
	HMAC: 'snapflow/api/hmac-keyring',
} as const;
export const KEYRING_FIELD = 'keyring';

export type Keyrings = Readonly<{ encryption: Keyring; hmac: Keyring }>;

export const KeyringsProvider: Provider<Promise<Keyrings>> = {
	provide: KEYRINGS,
	useFactory: async (config: TypedConfigService): Promise<Keyrings> => {
		const access = { address: config.get('vault.proxyUrl') };
		const read = async (path: string): Promise<Keyring> => {
			const payload = await readVaultKvField(access, path, KEYRING_FIELD);
			if (payload === null) {
				throw new Error(`Vault has no keyring at ${path}`);
			}
			if (Buffer.byteLength(payload) > ENCRYPTION_KEYRING_MAXIMUM_BYTES) {
				throw new Error(
					`The keyring at ${path} exceeds ${ENCRYPTION_KEYRING_MAXIMUM_BYTES} bytes`
				);
			}
			return keyringSchema.parse(JSON.parse(payload));
		};
		const [encryption, hmac] = await Promise.all([
			read(KeyringVaultPath.ENCRYPTION),
			read(KeyringVaultPath.HMAC),
		]);
		return { encryption, hmac };
	},
	inject: [TypedConfigService],
};

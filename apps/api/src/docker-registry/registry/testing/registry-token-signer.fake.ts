/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { type JWTPayload, jwtVerify, SignJWT } from 'jose';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { REGISTRY_TOKEN } from '../constants/registry-token.constants';
import { RegistryTokenService } from '../services/registry-token.service';
import {
	RegistryTokenSigner,
	registryKeyId,
} from '../services/registry-token-signer.service';
import { SnapshotManagerRegistryService } from '../services/snapshot-manager-registry.service';

const TEST_KEY_VERSION = 1;
export const SNAPSHOT_MANAGER_TEST_URL = 'http://localhost:5001';

export type FakeRegistryTokens = Readonly<{
	tokens: RegistryTokenService;
	snapshotManager: SnapshotManagerRegistryService;
	verify: (token: string) => Promise<JWTPayload>;
}>;

function fakeSigner(privateKey: KeyObject): RegistryTokenSigner {
	return fakeInstance(RegistryTokenSigner, {
		sign: (claims: Readonly<Record<string, unknown>>) =>
			new SignJWT({ ...claims })
				.setProtectedHeader({
					alg: REGISTRY_TOKEN.ALGORITHM,
					typ: REGISTRY_TOKEN.TYPE,
					kid: registryKeyId(TEST_KEY_VERSION),
				})
				.sign(privateKey),
	});
}

/** Real Ed25519 tokens without OpenBao, verifiable with `verify`. */
export function fakeRegistryTokens(): FakeRegistryTokens {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');
	const config = fakeInstance(TypedConfigService, {
		getOrThrow: () => ({ url: SNAPSHOT_MANAGER_TEST_URL }),
	});
	const snapshotManager = new SnapshotManagerRegistryService(config);
	return {
		tokens: new RegistryTokenService(fakeSigner(privateKey), snapshotManager),
		snapshotManager,
		verify: async (token) =>
			(
				await jwtVerify(token, publicKey, {
					issuer: REGISTRY_TOKEN.ISSUER,
					audience: REGISTRY_TOKEN.AUDIENCE,
					algorithms: [REGISTRY_TOKEN.ALGORITHM],
				})
			).payload,
	};
}

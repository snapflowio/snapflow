/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, it, mock } from 'node:test';
import { createLocalJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { fakeInstance } from '../../common/testing/instance.fake';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { REGISTRY_TOKEN } from '../constants/registry-token.constants';
import {
	RegistryTokenSigner,
	registryKeyId,
} from './registry-token-signer.service';

const VAULT_PROXY_URL = 'http://127.0.0.1:8100';
const CURRENT_VERSION = 2;
const RAW_ED25519_PUBLIC_KEY_BYTES = 32;

function rawPublicKey(
	key: ReturnType<typeof generateKeyPairSync>['publicKey']
): string {
	const der = key.export({ format: 'der', type: 'spki' });
	return der
		.subarray(der.length - RAW_ED25519_PUBLIC_KEY_BYTES)
		.toString('base64');
}

function transit(): { signer: RegistryTokenSigner; signedVersions: number[] } {
	const previous = generateKeyPairSync('ed25519');
	const current = generateKeyPairSync('ed25519');
	const signedVersions: number[] = [];
	mock.method(globalThis, 'fetch', async (input: URL, init: RequestInit) => {
		if (
			input.pathname.endsWith(`/transit/keys/${REGISTRY_TOKEN.TRANSIT_KEY}`)
		) {
			return Response.json({
				data: {
					type: 'ed25519',
					latest_version: CURRENT_VERSION,
					keys: {
						'1': { public_key: rawPublicKey(previous.publicKey) },
						[String(CURRENT_VERSION)]: {
							public_key: rawPublicKey(current.publicKey),
						},
					},
				},
			});
		}
		const body = JSON.parse(String(init.body)) as {
			input: string;
			key_version: number;
		};
		signedVersions.push(body.key_version);
		const signature = sign(
			null,
			Buffer.from(body.input, 'base64'),
			current.privateKey
		);
		return Response.json({
			data: {
				signature: `vault:v${body.key_version}:${signature.toString('base64')}`,
			},
		});
	});
	const config = fakeInstance(TypedConfigService, {
		get: () => ({ proxyUrl: VAULT_PROXY_URL }),
	});
	return { signer: new RegistryTokenSigner(config), signedVersions };
}

describe('RegistryTokenSigner', () => {
	afterEach(() => mock.restoreAll());

	it('signs with the latest transit key version and verifies against its JWKS', async () => {
		const { signer, signedVersions } = transit();
		const token = await signer.sign({
			sub: 'machine:1',
			aud: REGISTRY_TOKEN.AUDIENCE,
		});

		assert.deepEqual(signedVersions, [CURRENT_VERSION]);
		assert.equal(
			decodeProtectedHeader(token).kid,
			registryKeyId(CURRENT_VERSION)
		);
		const keySet = await signer.keySet();
		assert.deepEqual(
			keySet.keys.map((key) => key.kid),
			[registryKeyId(CURRENT_VERSION), registryKeyId(1)]
		);
		const verified = await jwtVerify(
			token,
			createLocalJWKSet({ keys: keySet.keys }),
			{
				algorithms: [REGISTRY_TOKEN.ALGORITHM],
				audience: REGISTRY_TOKEN.AUDIENCE,
			}
		);
		assert.equal(verified.payload.sub, 'machine:1');
	});
});

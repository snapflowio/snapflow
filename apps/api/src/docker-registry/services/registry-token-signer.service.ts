/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import {
	requiredVaultRequest,
	type VaultAccess,
	VaultRequestError,
} from '../../common/utils/vault-client.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	REGISTRY_JWK,
	REGISTRY_TOKEN,
} from '../constants/registry-token.constants';
import {
	RegistryJsonWebKeyDto,
	RegistryJsonWebKeySetDto,
} from '../dto/registry-jwks.dto';

const BASE64URL = 'base64url';
const BASE64 = 'base64';
const TOKEN_PART_SEPARATOR = '.';

const transitKeySchema = z.object({
	data: z.object({
		type: z.literal(REGISTRY_JWK.TRANSIT_KEY_TYPE),
		latest_version: z.number().int().positive(),
		keys: z.record(z.string(), z.object({ public_key: z.string().min(1) })),
	}),
});

const transitSignatureSchema = z.object({
	data: z.object({
		signature: z.string().regex(REGISTRY_JWK.TRANSIT_SIGNATURE_PATTERN),
	}),
});

type TransitKey = z.infer<typeof transitKeySchema>['data'];

type CachedKey = Readonly<{ key: TransitKey; expiresAt: number }>;

const transitPath = (operation: string): string =>
	[REGISTRY_TOKEN.TRANSIT_MOUNT, operation, REGISTRY_TOKEN.TRANSIT_KEY].join(
		'/'
	);

export function registryKeyId(version: number): string {
	return `${REGISTRY_TOKEN.TRANSIT_KEY}${REGISTRY_TOKEN.KEY_ID_VERSION_SEPARATOR}${version}`;
}

function encodeSegment(value: Readonly<Record<string, unknown>>): string {
	return Buffer.from(JSON.stringify(value)).toString(BASE64URL);
}

/**
 * Signs registry tokens with the OpenBao transit key so the private key never
 * leaves OpenBao, and publishes every key version as a JWKS.
 */
@Injectable()
export class RegistryTokenSigner {
	private cached: CachedKey | null = null;

	constructor(private readonly config: TypedConfigService) {}

	async sign(claims: Readonly<Record<string, unknown>>): Promise<string> {
		const key = await this.currentKey();
		const version = key.latest_version;
		const signingInput = [
			encodeSegment({
				alg: REGISTRY_TOKEN.ALGORITHM,
				typ: REGISTRY_TOKEN.TYPE,
				kid: registryKeyId(version),
			}),
			encodeSegment(claims),
		].join(TOKEN_PART_SEPARATOR);
		const response = await this.request(
			transitPath('sign'),
			transitSignatureSchema,
			{
				input: Buffer.from(signingInput).toString(BASE64),
				key_version: version,
			}
		);
		const match = REGISTRY_JWK.TRANSIT_SIGNATURE_PATTERN.exec(
			response.data.signature
		);
		if (!match || Number(match[1]) !== version) {
			throw new ServiceUnavailableException(
				`Registry token signer used a key version other than ${version}`
			);
		}
		const signature = Buffer.from(match[2], BASE64).toString(BASE64URL);
		return [signingInput, signature].join(TOKEN_PART_SEPARATOR);
	}

	async keySet(): Promise<RegistryJsonWebKeySetDto> {
		const key = await this.currentKey();
		const keys = Object.entries(key.keys)
			.map(([version, entry]) => ({ version: Number(version), entry }))
			.filter(({ version }) => Number.isSafeInteger(version))
			.sort((left, right) => right.version - left.version)
			.map(
				({ version, entry }) =>
					new RegistryJsonWebKeyDto(
						registryKeyId(version),
						Buffer.from(entry.public_key, BASE64).toString(BASE64URL)
					)
			);
		return new RegistryJsonWebKeySetDto(keys);
	}

	private async currentKey(): Promise<TransitKey> {
		const now = Date.now();
		if (this.cached && this.cached.expiresAt > now) return this.cached.key;
		const response = await this.request(transitPath('keys'), transitKeySchema);
		this.cached = {
			key: response.data,
			expiresAt: now + REGISTRY_TOKEN.KEY_CACHE_MILLISECONDS,
		};
		return response.data;
	}

	private async request<Schema extends z.ZodType>(
		path: string,
		schema: Schema,
		body?: Readonly<Record<string, unknown>>
	): Promise<z.infer<Schema>> {
		const access: VaultAccess = { address: this.config.get('vault').proxyUrl };
		try {
			return await requiredVaultRequest(access, path, schema, { body });
		} catch (error: unknown) {
			if (!(error instanceof VaultRequestError)) throw error;
			throw new ServiceUnavailableException(
				`Registry token signer request failed (${error.status})`,
				{ cause: error }
			);
		}
	}
}

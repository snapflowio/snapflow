/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { bytesToHex, hexToBytes } from 'viem';
import {
	generatePrivateKey,
	type PrivateKeyAccount,
	privateKeyToAccount,
} from 'viem/accounts';
import { z } from 'zod';
import {
	requiredVaultRequest,
	type VaultAccess,
	VaultRequestError,
} from '../../../common/utils/vault-client.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { DELEGATED_SIGNER_TRANSIT } from '../../constants/delegated-signer.constants';
import { SettlementErrorCode } from '../../constants/payment-channel.constants';

const BASE64 = 'base64';

const encryptResponseSchema = z.object({
	data: z.object({
		ciphertext: z.string().regex(DELEGATED_SIGNER_TRANSIT.CIPHERTEXT_PATTERN),
	}),
});

const decryptResponseSchema = z.object({
	data: z.object({ plaintext: z.string().min(1) }),
});

const transitPath = (operation: string): string =>
	[
		DELEGATED_SIGNER_TRANSIT.MOUNT,
		operation,
		DELEGATED_SIGNER_TRANSIT.KEY,
	].join('/');

interface GeneratedSignerKey {
	address: PrivateKeyAccount['address'];
	ciphertext: string;
}

@Injectable()
export class DelegatedSignerKeyService {
	constructor(private readonly config: TypedConfigService) {}

	async generate(): Promise<GeneratedSignerKey> {
		const privateKey = generatePrivateKey();
		const plaintext = Buffer.from(hexToBytes(privateKey));
		try {
			const response = await this.request(
				transitPath(DELEGATED_SIGNER_TRANSIT.ENCRYPT),
				encryptResponseSchema,
				{ plaintext: plaintext.toString(BASE64) }
			);
			return {
				address: privateKeyToAccount(privateKey).address,
				ciphertext: response.data.ciphertext,
			};
		} finally {
			plaintext.fill(0);
		}
	}

	async withAccount<Result>(
		ciphertext: string,
		use: (account: PrivateKeyAccount) => Promise<Result>
	): Promise<Result> {
		const response = await this.request(
			transitPath(DELEGATED_SIGNER_TRANSIT.DECRYPT),
			decryptResponseSchema,
			{ ciphertext }
		);
		const plaintext = Buffer.from(response.data.plaintext, BASE64);
		try {
			return await use(privateKeyToAccount(bytesToHex(plaintext)));
		} finally {
			plaintext.fill(0);
		}
	}

	private async request<Schema extends z.ZodType>(
		path: string,
		schema: Schema,
		body: Readonly<Record<string, unknown>>
	): Promise<z.infer<Schema>> {
		const access: VaultAccess = { address: this.config.get('vault').proxyUrl };
		try {
			return await requiredVaultRequest(access, path, schema, { body });
		} catch (error: unknown) {
			if (!(error instanceof VaultRequestError)) throw error;
			throw new ServiceUnavailableException(
				{
					code: SettlementErrorCode.DELEGATED_SIGNER_UNAVAILABLE,
					message: `The delegated signer vault request failed (${error.status})`,
				},
				{ cause: error }
			);
		}
	}
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	BadRequestException,
	ServiceUnavailableException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { HttpRequestError, type PublicClient, verifyMessage } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { fakeInstance, fakeValue } from '../../common/testing/instance.fake';
import { SETTLEMENT_CHAIN_ID } from '../../config/constants/settlement-chain.constants';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	PaymentWalletErrorCode,
	WALLET_CHALLENGE_STATEMENT,
	WALLET_CHALLENGE_TTL_MILLISECONDS,
} from '../constants/payment-wallet.constants';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { WalletChallengeService } from './wallet-challenge.service';

const ORGANIZATION_ID = 'organization-id';
const OTHER_ORGANIZATION_ID = 'other-organization-id';
const DASHBOARD_URL = 'https://snapflow.test/dashboard';
const RPC_URL = 'https://rpc.snapflow.test';

// Verifies like the public client does for an externally owned account, but
// locally, so the tests exercise real signatures without an RPC endpoint.
async function verifyLocally({
	message,
	signature,
}: Parameters<PublicClient['verifySiweMessage']>[0]): Promise<boolean> {
	const fields = parseSiweMessage(message);
	return (
		fields.address !== undefined &&
		validateSiweMessage({ message: fields }) &&
		verifyMessage({ address: fields.address, message, signature })
	);
}

function harness(
	verifySiweMessage: PublicClient['verifySiweMessage'] = verifyLocally
) {
	const stored = new Map<string, string>();
	const expiries: number[] = [];
	const redis = fakeValue<Redis>({
		set: async (key: string, value: string, mode: string, ttl: number) => {
			stored.set(key, value);
			expiries.push(ttl);
			return mode;
		},
		getdel: async (key: string) => {
			const value = stored.get(key) ?? null;
			stored.delete(key);
			return value;
		},
	});
	const config = fakeInstance(TypedConfigService, {
		get: () => SETTLEMENT_CHAIN_ID.LOCAL,
		getOrThrow: () => DASHBOARD_URL,
	});
	const client = fakeValue<PublicClient>({ verifySiweMessage });
	return {
		stored,
		expiries,
		service: new WalletChallengeService(redis, client, config),
	};
}

async function rejectsWith(
	promise: Promise<unknown>,
	code: PaymentWalletErrorCode
): Promise<void> {
	await assert.rejects(promise, (error: unknown) => {
		assert.ok(error instanceof BadRequestException);
		const response = error.getResponse();
		assert.ok(typeof response === 'object' && 'code' in response);
		assert.equal(response.code, code);
		return true;
	});
}

describe('WalletChallengeService', () => {
	it('issues a SIWE message for the dashboard origin, chain and purpose', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const { service, stored, expiries } = harness();

		const challenge = await service.issue(
			ORGANIZATION_ID,
			PaymentWalletPurpose.PAYOUT,
			account.address
		);

		const fields = parseSiweMessage(challenge.message);
		assert.equal(fields.domain, new URL(DASHBOARD_URL).host);
		assert.equal(fields.uri, DASHBOARD_URL);
		assert.equal(fields.chainId, SETTLEMENT_CHAIN_ID.LOCAL);
		assert.equal(fields.address, account.address);
		assert.equal(
			fields.statement,
			WALLET_CHALLENGE_STATEMENT[PaymentWalletPurpose.PAYOUT]
		);
		assert.equal(
			fields.expirationTime?.getTime(),
			challenge.expiresAt.getTime()
		);
		assert.deepEqual([...stored.values()], [challenge.message]);
		assert.deepEqual(expiries, [WALLET_CHALLENGE_TTL_MILLISECONDS]);
	});

	it('returns the signer of an issued challenge and consumes it', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const { service } = harness();
		const { message } = await service.issue(
			ORGANIZATION_ID,
			PaymentWalletPurpose.FUNDING,
			account.address
		);
		const proof = {
			purpose: PaymentWalletPurpose.FUNDING,
			message,
			signature: await account.signMessage({ message }),
		};

		assert.equal(await service.verify(ORGANIZATION_ID, proof), account.address);
		await rejectsWith(
			service.verify(ORGANIZATION_ID, proof),
			PaymentWalletErrorCode.CHALLENGE_NOT_FOUND
		);
	});

	it('refuses a challenge issued to another organization or purpose', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const { service } = harness();
		const { message } = await service.issue(
			ORGANIZATION_ID,
			PaymentWalletPurpose.PAYOUT,
			account.address
		);
		const signature = await account.signMessage({ message });

		await rejectsWith(
			service.verify(OTHER_ORGANIZATION_ID, {
				purpose: PaymentWalletPurpose.PAYOUT,
				message,
				signature,
			}),
			PaymentWalletErrorCode.CHALLENGE_NOT_FOUND
		);
		await rejectsWith(
			service.verify(ORGANIZATION_ID, {
				purpose: PaymentWalletPurpose.FUNDING,
				message,
				signature,
			}),
			PaymentWalletErrorCode.CHALLENGE_NOT_FOUND
		);
	});

	it('refuses a message altered after it was issued', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const { service } = harness();
		const { message } = await service.issue(
			ORGANIZATION_ID,
			PaymentWalletPurpose.PAYOUT,
			account.address
		);
		const altered = message.replace(
			new URL(DASHBOARD_URL).host,
			'attacker.test'
		);

		await rejectsWith(
			service.verify(ORGANIZATION_ID, {
				purpose: PaymentWalletPurpose.PAYOUT,
				message: altered,
				signature: await account.signMessage({ message: altered }),
			}),
			PaymentWalletErrorCode.CHALLENGE_NOT_FOUND
		);
	});

	it('refuses a signature from another key', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const impostor = privateKeyToAccount(generatePrivateKey());
		const { service } = harness();
		const { message } = await service.issue(
			ORGANIZATION_ID,
			PaymentWalletPurpose.PAYOUT,
			account.address
		);

		await rejectsWith(
			service.verify(ORGANIZATION_ID, {
				purpose: PaymentWalletPurpose.PAYOUT,
				message,
				signature: await impostor.signMessage({ message }),
			}),
			PaymentWalletErrorCode.SIGNATURE_INVALID
		);
	});

	it('refuses a message that is not a SIWE message', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const message = 'link my wallet';

		await rejectsWith(
			harness().service.verify(ORGANIZATION_ID, {
				purpose: PaymentWalletPurpose.PAYOUT,
				message,
				signature: await account.signMessage({ message }),
			}),
			PaymentWalletErrorCode.MESSAGE_INVALID
		);
	});

	it('reports an unreachable chain instead of an invalid signature', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const { service } = harness(async () => {
			throw new HttpRequestError({ url: RPC_URL });
		});
		const { message } = await service.issue(
			ORGANIZATION_ID,
			PaymentWalletPurpose.PAYOUT,
			account.address
		);

		await assert.rejects(
			service.verify(ORGANIZATION_ID, {
				purpose: PaymentWalletPurpose.PAYOUT,
				message,
				signature: await account.signMessage({ message }),
			}),
			ServiceUnavailableException
		);
	});
});

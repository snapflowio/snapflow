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
import { recoverVoucherSigner, voucherTypedData } from '@snapflow/contracts';
import { keccak256, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_SECOND,
} from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { VoucherRejection } from '../enums/voucher-rejection.enum';
import {
	CUSTOMER_ADDRESS,
	ESCROW_ADDRESS,
	HOST_ADDRESS,
	KEY_ADDRESS,
} from '../testing/escrow-log.fixtures';
import type { SessionKeyLimits } from './session-allowance.util';
import { channelDomain, voucherMessage } from './voucher-message.util';
import {
	type SubmittedSignature,
	signatureRejection,
} from './voucher-signature.util';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const OTHER_ADDRESS = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

const SESSION_KEY: SessionKeyLimits = {
	spendCapMicroUsd: '1000',
	hourlyCapMicroUsd: '100',
	activatedAt: NOW,
	expiresAt: new Date(NOW.getTime() + MILLISECONDS_PER_HOUR),
	revokedAt: null,
};

const BY_SESSION_KEY: SubmittedSignature = {
	customerAddress: CUSTOMER_ADDRESS,
	signerAddress: KEY_ADDRESS,
	recoveredAddress: KEY_ADDRESS,
	sessionKey: SESSION_KEY,
	committedMicroUsd: MicroUsd.of(100n),
	now: NOW,
};

describe('signatureRejection', () => {
	it('accepts a session key within its limits', () => {
		assert.equal(signatureRejection(BY_SESSION_KEY), null);
	});

	it('refuses a signature that recovers to another address', () => {
		assert.equal(
			signatureRejection({
				...BY_SESSION_KEY,
				recoveredAddress: OTHER_ADDRESS,
			}),
			VoucherRejection.SIGNATURE_INVALID
		);
	});

	it('accepts the funding wallet itself without a session key', () => {
		assert.equal(
			signatureRejection({
				...BY_SESSION_KEY,
				signerAddress: CUSTOMER_ADDRESS,
				recoveredAddress: CUSTOMER_ADDRESS,
				sessionKey: null,
				committedMicroUsd: MicroUsd.of(1_000_000n),
			}),
			null
		);
	});

	it('refuses a signer the customer never made a session key', () => {
		assert.equal(
			signatureRejection({ ...BY_SESSION_KEY, sessionKey: null }),
			VoucherRejection.SIGNER_NOT_AUTHORIZED
		);
	});

	it('refuses a session key past its limits or expiry', () => {
		assert.equal(
			signatureRejection({
				...BY_SESSION_KEY,
				committedMicroUsd: MicroUsd.of(101n),
			}),
			VoucherRejection.SESSION_HOURLY_CAP_EXCEEDED
		);
		assert.equal(
			signatureRejection({
				...BY_SESSION_KEY,
				now: new Date(SESSION_KEY.expiresAt.getTime() + 1),
			}),
			VoucherRejection.SESSION_KEY_INACTIVE
		);
	});
});

describe('voucherMessage', () => {
	const channel = {
		chainId: 31_337,
		contractAddress: ESCROW_ADDRESS,
		channelId: keccak256(toHex('channel')),
		customerAddress: CUSTOMER_ADDRESS,
		hostAddress: HOST_ADDRESS,
	};
	const voucher = {
		sequence: 3,
		hostAmountMicroUsd: '1000',
		feeAmountMicroUsd: '250',
		serviceAmountMicroUsd: '7',
		expiresAt: new Date('2026-11-06T12:00:00.000Z'),
	};

	it('recovers the key that signed the stored voucher', async () => {
		const account = privateKeyToAccount(generatePrivateKey());
		const message = voucherMessage(channel, voucher);
		assert.equal(
			message.expiry,
			BigInt(voucher.expiresAt.getTime() / MILLISECONDS_PER_SECOND)
		);
		const signature = await account.signTypedData(
			voucherTypedData(channelDomain(channel), message)
		);
		assert.equal(
			await recoverVoucherSigner(channelDomain(channel), message, signature),
			account.address
		);
		assert.notEqual(
			await recoverVoucherSigner(
				channelDomain(channel),
				voucherMessage(channel, { ...voucher, feeAmountMicroUsd: '251' }),
				signature
			),
			account.address
		);
	});
});

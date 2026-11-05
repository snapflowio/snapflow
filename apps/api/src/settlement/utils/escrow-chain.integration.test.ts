/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type Address,
	createPublicClient,
	createWalletClient,
	erc20Abi,
	type Hash,
	http,
	type PublicClient,
	type WalletClient,
} from 'viem';
import { foundry } from 'viem/chains';
import {
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_HOUR,
} from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { integrationChain } from '../testing/integration-chain.util';
import type { EscrowLog } from '../types/escrow.types';
import { escrowEventRecord } from './escrow-event-record.util';
import {
	EMPTY_ESCROW_ACCOUNT,
	escrowAccountAddress,
	projectEscrowAccount,
	sessionKeyChange,
} from './escrow-projection.util';

const CHAIN = integrationChain();
const DEPOSIT_MICRO_USD = 5_000_000n;
const WITHDRAWAL_MICRO_USD = 2_000_000n;
const SPEND_CAP_MICRO_USD = 1_000_000n;
const HOURLY_CAP_MICRO_USD = 100_000n;
const CUSTOMER_ACCOUNT_INDEX = 1;
const SESSION_KEY_ACCOUNT_INDEX = 2;

describe('escrow events read from a local chain', {
	skip: CHAIN ? false : 'SETTLEMENT_INTEGRATION_RPC_URL is not configured',
}, () => {
	let publicClient: PublicClient;
	let walletClient: WalletClient;
	let customer: Address;
	let sessionKey: Address;
	let logs: EscrowLog[];
	let openingBalance: bigint;

	async function send(hash: Promise<Hash>): Promise<void> {
		const receipt = await publicClient.waitForTransactionReceipt({
			hash: await hash,
		});
		assert.equal(receipt.status, 'success');
	}

	before(async () => {
		if (!CHAIN) return;
		const transport = http(CHAIN.rpcUrl);
		publicClient = createPublicClient({ chain: foundry, transport });
		walletClient = createWalletClient({ chain: foundry, transport });
		const accounts = await walletClient.getAddresses();
		const customerAccount = accounts[CUSTOMER_ACCOUNT_INDEX];
		const keyAccount = accounts[SESSION_KEY_ACCOUNT_INDEX];
		if (!customerAccount || !keyAccount) {
			throw new Error('The chain has too few unlocked accounts');
		}
		customer = customerAccount;
		sessionKey = keyAccount;
		const escrow = { address: CHAIN.escrowAddress, abi: snapflowEscrowAbi };
		openingBalance = await publicClient.readContract({
			...escrow,
			functionName: 'balanceOf',
			args: [customer],
		});
		const fromBlock =
			(await publicClient.getBlockNumber({ cacheTime: 0 })) + 1n;
		const latest = await publicClient.getBlock();
		const write = { account: customer, chain: foundry } as const;
		await send(
			walletClient.writeContract({
				...write,
				address: CHAIN.usdcAddress,
				abi: erc20Abi,
				functionName: 'approve',
				args: [CHAIN.escrowAddress, DEPOSIT_MICRO_USD],
			})
		);
		await send(
			walletClient.writeContract({
				...write,
				...escrow,
				functionName: 'deposit',
				args: [DEPOSIT_MICRO_USD],
			})
		);
		await send(
			walletClient.writeContract({
				...write,
				...escrow,
				functionName: 'setSessionKey',
				args: [
					sessionKey,
					SPEND_CAP_MICRO_USD,
					HOURLY_CAP_MICRO_USD,
					latest.timestamp + BigInt(SECONDS_PER_HOUR),
				],
			})
		);
		await send(
			walletClient.writeContract({
				...write,
				...escrow,
				functionName: 'requestWithdrawal',
				args: [WITHDRAWAL_MICRO_USD],
			})
		);
		await send(
			walletClient.writeContract({
				...write,
				...escrow,
				functionName: 'revokeSessionKey',
				args: [sessionKey],
			})
		);
		const confirmed = await publicClient.getContractEvents({
			address: CHAIN.escrowAddress,
			abi: snapflowEscrowAbi,
			fromBlock,
			toBlock: await publicClient.getBlockNumber({ cacheTime: 0 }),
			strict: true,
		});
		logs = confirmed;
	});

	it('decodes every customer event through the generated ABI', () => {
		assert.deepEqual(
			logs.map((log) => log.eventName),
			['Deposited', 'SessionKeySet', 'WithdrawalRequested', 'SessionKeyRevoked']
		);
		const deposit = logs[0];
		assert.ok(deposit);
		const record = escrowEventRecord(deposit);
		assert.equal(record.customerAddress, customer);
		assert.equal(record.args.amount, DEPOSIT_MICRO_USD.toString());
	});

	it('projects the same account the contract reports', async () => {
		if (!CHAIN) return;
		const projected = logs
			.filter((log) => escrowAccountAddress(log) === customer)
			.reduce(projectEscrowAccount, {
				...EMPTY_ESCROW_ACCOUNT,
				balanceMicroUsd: MicroUsd.of(openingBalance),
			});
		const escrow = { address: CHAIN.escrowAddress, abi: snapflowEscrowAbi };
		const balance = await publicClient.readContract({
			...escrow,
			functionName: 'balanceOf',
			args: [customer],
		});
		const withdrawal = await publicClient.readContract({
			...escrow,
			functionName: 'withdrawalOf',
			args: [customer],
		});
		assert.deepEqual(projected.balanceMicroUsd, MicroUsd.of(balance));
		assert.deepEqual(
			projected.pendingWithdrawalMicroUsd,
			MicroUsd.of(withdrawal.amount)
		);
		assert.equal(
			projected.withdrawalReadyAt?.getTime(),
			Number(withdrawal.readyAt) * MILLISECONDS_PER_SECOND
		);
	});

	it('reads session key grants and revocations', () => {
		const changes = logs.flatMap((log) => {
			const change = sessionKeyChange(log, new Date(0));
			return change ? [change] : [];
		});
		assert.equal(changes.length, 2);
		const [granted, revoked] = changes;
		assert.ok(granted && 'granted' in granted);
		assert.equal(granted.granted.keyAddress, sessionKey);
		assert.equal(
			granted.granted.spendCapMicroUsd,
			SPEND_CAP_MICRO_USD.toString()
		);
		assert.ok(revoked && 'revoked' in revoked);
		assert.equal(revoked.revoked.customerAddress, customer);
	});
});

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { snapflowEscrowAbi } from '@snapflow/contracts';
import { type Address, erc20Abi, type PublicClient } from 'viem';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { EscrowAccount } from '../../entities/escrow-account.entity';
import { microUsd } from './escrow-amount.util';

export const RECONCILED_BALANCES = [
	'freeMicroUsd',
	'pendingMicroUsd',
	'hostBalanceMicroUsd',
	'feesAccruedMicroUsd',
	'frozenMicroUsd',
] as const;

export const TOTAL_HELD = 'totalHeld';

export type ReconciledBalance = (typeof RECONCILED_BALANCES)[number];

export type EscrowBalances = Record<ReconciledBalance, bigint>;

export type ProjectedEscrowAccount = Pick<
	EscrowAccount,
	'address' | ReconciledBalance
>;

export function projectedBalances(
	account: ProjectedEscrowAccount
): EscrowBalances {
	return {
		freeMicroUsd: microUsd(account.freeMicroUsd),
		pendingMicroUsd: microUsd(account.pendingMicroUsd),
		hostBalanceMicroUsd: microUsd(account.hostBalanceMicroUsd),
		feesAccruedMicroUsd: microUsd(account.feesAccruedMicroUsd),
		frozenMicroUsd: microUsd(account.frozenMicroUsd),
	};
}

export function heldBalance(balances: EscrowBalances): bigint {
	return RECONCILED_BALANCES.reduce(
		(total, balance) => total + balances[balance],
		0n
	);
}

export function escrowDrift(
	subject: Address | typeof TOTAL_HELD,
	balance: ReconciledBalance | typeof TOTAL_HELD,
	projected: bigint,
	onChain: bigint
) {
	return { subject, balance, projected, onChain };
}

export type EscrowDrift = ReturnType<typeof escrowDrift>;

export function balanceDrifts(
	address: Address,
	projected: EscrowBalances,
	onChain: EscrowBalances
): EscrowDrift[] {
	return RECONCILED_BALANCES.flatMap((balance) =>
		projected[balance] === onChain[balance]
			? []
			: [escrowDrift(address, balance, projected[balance], onChain[balance])]
	);
}

function driftSize(drift: EscrowDrift): bigint {
	const difference = drift.onChain - drift.projected;
	return difference < 0n ? -difference : difference;
}

export function largestDrifts(
	drifts: readonly EscrowDrift[],
	count: number
): EscrowDrift[] {
	return [...drifts]
		.sort((left, right) =>
			Math.sign(Number(driftSize(right) - driftSize(left)))
		)
		.slice(0, count);
}

export function describeDrift(drift: EscrowDrift): string {
	return `${drift.subject} ${drift.balance}: projected ${MicroUsd.of(drift.projected).toUsd()}, on chain ${MicroUsd.of(drift.onChain).toUsd()}`;
}

export async function escrowHeldTotals(
	client: PublicClient,
	escrowAddress: Address,
	tokenAddress: Address,
	blockNumber: bigint
) {
	const [totalHeld, tokenBalance] = await Promise.all([
		client.readContract({
			address: escrowAddress,
			abi: snapflowEscrowAbi,
			functionName: 'totalHeld',
			blockNumber,
		}),
		client.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [escrowAddress],
			blockNumber,
		}),
	]);
	return { totalHeld, tokenBalance };
}

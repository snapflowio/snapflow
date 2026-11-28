/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Address, isAddressEqual, zeroAddress } from 'viem';
import type { EscrowAccount } from '../../entities/escrow-account.entity';
import { EscrowBucket } from '../../enums/escrow-bucket.enum';
import type {
	EscrowMovement,
	ProjectedEscrowEvent,
} from '../../types/escrow.types';
import { accountBlocked } from './account-block.util';
import { microUsd, minBigInt } from './escrow-amount.util';

type AmountFields<Entity> = {
	[Field in keyof Entity]: Entity[Field] extends string ? Field : never;
}[keyof Entity];

export function adjustAmount<Entity extends object>(
	entity: Entity,
	field: AmountFields<Entity>,
	delta: bigint
): void {
	const current = entity[field] as string;
	(entity[field] as string) = (microUsd(current) + delta).toString();
}

export function movement(
	from: EscrowBucket,
	to: EscrowBucket,
	amount: bigint
): EscrowMovement[] {
	return amount > 0n ? [{ from, to, amount: amount.toString() }] : [];
}

interface BucketAmount {
	bucket: EscrowBucket;
	amount: bigint;
}

export function pairedMovements(
	sources: readonly BucketAmount[],
	sinks: readonly BucketAmount[]
): EscrowMovement[] {
	const left = sources.map((source) => ({ ...source }));
	const movements: EscrowMovement[] = [];
	for (const sink of sinks) {
		let owed = sink.amount;
		for (const source of left) {
			const moved = minBigInt(owed, source.amount);
			movements.push(...movement(source.bucket, sink.bucket, moved));
			source.amount -= moved;
			owed -= moved;
		}
		if (owed > 0n) {
			throw new Error('An escrow movement takes more than its sources hold');
		}
	}
	return movements;
}

export function projected(
	parties: Partial<ProjectedEscrowEvent> = {}
): ProjectedEscrowEvent {
	return {
		customerAddress: null,
		hostAddress: null,
		channelId: null,
		movements: [],
		...parties,
	};
}

export function creditBucket(
	account: Pick<EscrowAccount, 'blockedAt' | 'blockedUntil'>,
	bucket: EscrowBucket,
	at: Date
): EscrowBucket {
	return accountBlocked(account, at) ? EscrowBucket.FROZEN : bucket;
}

export function blockedMovements(account: EscrowAccount): EscrowMovement[] {
	return [
		...movement(
			EscrowBucket.FREE,
			EscrowBucket.FROZEN,
			microUsd(account.freeMicroUsd)
		),
		...movement(
			EscrowBucket.PENDING,
			EscrowBucket.FROZEN,
			microUsd(account.pendingMicroUsd)
		),
		...movement(
			EscrowBucket.HOST_CREDITED,
			EscrowBucket.FROZEN,
			microUsd(account.hostBalanceMicroUsd)
		),
		...movement(
			EscrowBucket.FEES_ACCRUED,
			EscrowBucket.FROZEN,
			microUsd(account.feesAccruedMicroUsd)
		),
	];
}

export function signerHostRestriction(host: Address): Address | null {
	return isAddressEqual(host, zeroAddress) ? null : host;
}

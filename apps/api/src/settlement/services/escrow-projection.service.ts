/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { EscrowSessionKey } from '../entities/escrow-session-key.entity';
import type { EscrowIdentity, EscrowLog } from '../types/escrow.types';
import {
	EMPTY_ESCROW_ACCOUNT,
	type EscrowAccountState,
	escrowAccountAddress,
	projectEscrowAccount,
	sessionKeyChange,
} from '../utils/escrow-projection.util';

function accountState(account: EscrowAccount): EscrowAccountState {
	return {
		balanceMicroUsd: MicroUsd.parse(account.balanceMicroUsd),
		pendingWithdrawalMicroUsd: MicroUsd.parse(
			account.pendingWithdrawalMicroUsd
		),
		withdrawalReadyAt: account.withdrawalReadyAt,
		blocked: account.blocked,
	};
}

function accountColumns(
	state: EscrowAccountState
): Pick<
	EscrowAccount,
	| 'balanceMicroUsd'
	| 'pendingWithdrawalMicroUsd'
	| 'withdrawalReadyAt'
	| 'blocked'
> {
	return {
		balanceMicroUsd: state.balanceMicroUsd.toString(),
		pendingWithdrawalMicroUsd: state.pendingWithdrawalMicroUsd.toString(),
		withdrawalReadyAt: state.withdrawalReadyAt,
		blocked: state.blocked,
	};
}

// Keeps the account and session key mirrors in step with each stored event,
// inside the transaction that stores it.
@Injectable()
export class EscrowProjectionService {
	async apply(
		manager: EntityManager,
		escrow: EscrowIdentity,
		log: EscrowLog,
		blockTimestamp: Date
	): Promise<void> {
		await this.projectAccount(manager, escrow, log);
		await this.projectSessionKey(manager, escrow, log, blockTimestamp);
	}

	private async projectAccount(
		manager: EntityManager,
		escrow: EscrowIdentity,
		log: EscrowLog
	): Promise<void> {
		const address = escrowAccountAddress(log);
		if (address === null) return;
		const account = await this.account(manager, escrow, address);
		manager.assign(
			account,
			accountColumns(projectEscrowAccount(accountState(account), log))
		);
	}

	// New rows are flushed at once so a later event of the same batch finds
	// them by address instead of creating a duplicate.
	private async account(
		manager: EntityManager,
		escrow: EscrowIdentity,
		address: Address
	): Promise<EscrowAccount> {
		const existing = await manager.findOne(EscrowAccount, {
			...escrow,
			address,
		});
		if (existing) return existing;
		const created = manager.create(EscrowAccount, {
			...escrow,
			address,
			...accountColumns(EMPTY_ESCROW_ACCOUNT),
		});
		await manager.flush();
		return created;
	}

	private async projectSessionKey(
		manager: EntityManager,
		escrow: EscrowIdentity,
		log: EscrowLog,
		blockTimestamp: Date
	): Promise<void> {
		const change = sessionKeyChange(log, blockTimestamp);
		if (change === null) return;
		if ('revoked' in change) {
			const { customerAddress, keyAddress, revokedAt } = change.revoked;
			const key = await manager.findOne(EscrowSessionKey, {
				...escrow,
				customerAddress,
				keyAddress,
			});
			if (key) key.revokedAt = revokedAt;
			return;
		}
		const { customerAddress, keyAddress } = change.granted;
		const key = await manager.findOne(EscrowSessionKey, {
			...escrow,
			customerAddress,
			keyAddress,
		});
		if (key) {
			manager.assign(key, { ...change.granted, revokedAt: null });
			return;
		}
		manager.create(EscrowSessionKey, {
			...escrow,
			...change.granted,
			revokedAt: null,
		});
		await manager.flush();
	}
}

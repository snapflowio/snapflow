/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Address } from 'viem';
import { PaymentWalletErrorCode } from '../../constants/payment-wallet.constants';
import { SANCTIONS_LIST_SYNC_ID } from '../../constants/sanctions.constants';
import type { PaymentWallet } from '../../entities/payment-wallet.entity';
import { SanctionedAddress } from '../../entities/sanctioned-address.entity';
import { SanctionsListSync } from '../../entities/sanctions-list-sync.entity';
import { SanctionsStatus } from '../../enums/sanctions-status.enum';

export type SanctionsScreening = Pick<
	PaymentWallet,
	'sanctionsStatus' | 'sanctionsCheckedAt'
>;

@Injectable()
export class SanctionsScreeningService {
	constructor(private readonly entityManager: EntityManager) {}

	screen(address: Address): Promise<SanctionsScreening> {
		return this.lookup(this.entityManager.fork(), address, LockMode.NONE);
	}

	screenLocked(
		manager: EntityManager,
		address: Address
	): Promise<SanctionsScreening> {
		return this.lookup(manager, address, LockMode.PESSIMISTIC_READ);
	}

	private async lookup(
		manager: EntityManager,
		address: Address,
		lockMode: LockMode
	): Promise<SanctionsScreening> {
		const sync = await manager.findOne(
			SanctionsListSync,
			{ id: SANCTIONS_LIST_SYNC_ID },
			{ lockMode, fields: ['id'] }
		);
		if (!sync) {
			throw new ServiceUnavailableException({
				code: PaymentWalletErrorCode.SANCTIONS_SCREENING_UNAVAILABLE,
				message: 'Sanctions screening is unavailable; retry shortly',
			});
		}
		const listed = await manager.count(SanctionedAddress, {
			address: address.toLowerCase() as Address,
		});
		return {
			sanctionsStatus:
				listed > 0 ? SanctionsStatus.BLOCKED : SanctionsStatus.CLEAR,
			sanctionsCheckedAt: new Date(),
		};
	}
}

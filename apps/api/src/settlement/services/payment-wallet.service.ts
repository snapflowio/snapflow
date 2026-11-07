/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import type { Address } from 'viem';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { PaymentWalletErrorCode } from '../constants/payment-wallet.constants';
import type { LinkPaymentWalletDto } from '../dto/payment-wallet.dto';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import type { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { SanctionsStatus } from '../enums/sanctions-status.enum';
import { EscrowAttributionService } from './escrow-attribution.service';
import {
	type SanctionsScreening,
	SanctionsScreeningService,
} from './sanctions-screening.service';
import { WalletChallengeService } from './wallet-challenge.service';

function addressInUse(): ConflictException {
	return new ConflictException({
		code: PaymentWalletErrorCode.ADDRESS_IN_USE,
		message: 'Another organization already linked this wallet',
	});
}

@Injectable()
export class PaymentWalletService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly challenges: WalletChallengeService,
		private readonly sanctions: SanctionsScreeningService,
		private readonly attribution: EscrowAttributionService
	) {}

	list(organizationId: string): Promise<PaymentWallet[]> {
		return this.entityManager
			.fork()
			.find(
				PaymentWallet,
				{ organizationId },
				{ orderBy: { purpose: QueryOrder.ASC } }
			);
	}

	async link(
		organizationId: string,
		proof: LinkPaymentWalletDto
	): Promise<PaymentWallet> {
		const address = await this.challenges.verify(organizationId, proof);
		const screening = await this.sanctions.screen(address);
		if (screening.sanctionsStatus === SanctionsStatus.BLOCKED) {
			throw new ForbiddenException({
				code: PaymentWalletErrorCode.ADDRESS_SANCTIONED,
				message: 'The wallet appears on a sanctions list and cannot be linked',
			});
		}
		return this.record(organizationId, proof.purpose, address, screening);
	}

	// Stores a wallet whose control was already proven, replacing the
	// organization's previous wallet for the same purpose, and claims the
	// escrow events the address took part in while nobody had linked it.
	async record(
		organizationId: string,
		purpose: PaymentWalletPurpose,
		address: Address,
		screening: SanctionsScreening
	): Promise<PaymentWallet> {
		try {
			return await this.entityManager.fork().transactional(async (manager) => {
				const holder = await manager.findOne(PaymentWallet, {
					purpose,
					address,
				});
				if (holder && holder.organizationId !== organizationId) {
					throw addressInUse();
				}
				const fields = {
					...screening,
					address,
					verifiedAt: await databaseNow(manager),
				};
				const current = await manager.findOne(
					PaymentWallet,
					{ organizationId, purpose },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const wallet = current
					? manager.assign(current, fields)
					: manager.create(PaymentWallet, {
							organizationId,
							purpose,
							...fields,
						});
				await this.attribution.attributeWallet(
					manager,
					organizationId,
					purpose,
					address
				);
				return wallet;
			});
		} catch (error) {
			if (isUniqueViolation(error)) throw addressInUse();
			throw error;
		}
	}

	async unlink(
		organizationId: string,
		purpose: PaymentWalletPurpose
	): Promise<void> {
		await this.entityManager
			.fork()
			.nativeDelete(PaymentWallet, { organizationId, purpose });
	}
}

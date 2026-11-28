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
import { type Address, isAddressEqual } from 'viem';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { HostNoticeKind } from '../../../notification/constants/notice.constants';
import { HostNoticeEvent } from '../../../notification/events/host-notice.event';
import {
	enqueueHostNotice,
	noticeKey,
} from '../../../notification/utils/notice-outbox.util';
import {
	HELD_FUND,
	HELD_FUND_LABEL,
	HeldFundsErrorCode,
} from '../../constants/held-funds.constants';
import { PaymentWalletErrorCode } from '../../constants/payment-wallet.constants';
import type { LinkPaymentWalletDto } from '../../dto/payment-wallet.dto';
import { PaymentWallet } from '../../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import { SanctionsStatus } from '../../enums/sanctions-status.enum';
import { hostFundsHeld } from '../../queries/held-funds.query';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { EscrowAttributionService } from '../escrow/escrow-attribution.service';
import { SettlementWakeService } from '../settlement-wake.service';
import {
	type SanctionsScreening,
	SanctionsScreeningService,
} from './sanctions-screening.service';
import { SiweLinkService } from './siwe-link.service';

function addressInUse(): ConflictException {
	return new ConflictException({
		code: PaymentWalletErrorCode.ADDRESS_IN_USE,
		message: 'Another organization already linked this wallet',
	});
}

const UNSCREENED: SanctionsScreening = {
	sanctionsStatus: SanctionsStatus.UNCHECKED,
	sanctionsCheckedAt: null,
};

function assertNotSanctioned(screening: SanctionsScreening): void {
	if (screening.sanctionsStatus !== SanctionsStatus.BLOCKED) return;
	throw new ForbiddenException({
		code: PaymentWalletErrorCode.ADDRESS_SANCTIONED,
		message: 'The wallet appears on a sanctions list and cannot be linked',
	});
}

function payoutEarningsHeld(): ConflictException {
	const heldFunds = [HELD_FUND.HOST_EARNINGS];
	return new ConflictException({
		code: HeldFundsErrorCode.PAYOUT_WALLET_HOLDS_FUNDS,
		message: `The organization still holds ${heldFunds.map((fund) => HELD_FUND_LABEL[fund]).join(', ')}. Pay them out, or link a different payout wallet instead of unlinking this one.`,
		heldFunds,
	});
}

@Injectable()
export class PaymentWalletService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly siwe: SiweLinkService,
		private readonly sanctions: SanctionsScreeningService,
		private readonly attribution: EscrowAttributionService,
		private readonly settlementWakes: SettlementWakeService
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
		const address = await this.siwe.verify(organizationId, proof);
		return this.linkAddress(organizationId, proof.purpose, address);
	}

	async linkAddress(
		organizationId: string,
		purpose: PaymentWalletPurpose,
		address: Address
	): Promise<PaymentWallet> {
		assertNotSanctioned(await this.sanctions.screen(address));
		return this.record(organizationId, purpose, address, async (manager) => {
			const screening = await this.sanctions.screenLocked(manager, address);
			assertNotSanctioned(screening);
			return screening;
		});
	}

	recordUnscreened(
		organizationId: string,
		purpose: PaymentWalletPurpose,
		address: Address
	): Promise<PaymentWallet> {
		return this.record(
			organizationId,
			purpose,
			address,
			async () => UNSCREENED
		);
	}

	private async record(
		organizationId: string,
		purpose: PaymentWalletPurpose,
		address: Address,
		screen: (manager: EntityManager) => Promise<SanctionsScreening>
	): Promise<PaymentWallet> {
		try {
			return await this.entityManager.fork().transactional(async (manager) => {
				const screening = await screen(manager);
				const holder = await manager.findOne(PaymentWallet, {
					purpose,
					address,
				});
				if (holder && holder.organizationId !== organizationId) {
					throw addressInUse();
				}
				const verifiedAt = await databaseNow(manager);
				const fields = { ...screening, address, verifiedAt };
				const current = await manager.findOne(
					PaymentWallet,
					{ organizationId, purpose },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (
					purpose === PaymentWalletPurpose.PAYOUT &&
					current &&
					!isAddressEqual(current.address, address)
				) {
					await this.notifyPayoutWalletChanged(
						manager,
						organizationId,
						current.id,
						address,
						verifiedAt
					);
				}
				const wallet = current
					? manager.assign(current, fields)
					: manager.create(PaymentWallet, {
							organizationId,
							purpose,
							...fields,
						});
				if (purpose === PaymentWalletPurpose.FUNDING) {
					await this.attribution.attributeFundingWallet(
						manager,
						organizationId,
						address
					);
				} else {
					await this.settlementWakes.wakeOrganizationMachines(
						manager,
						organizationId
					);
				}
				return wallet;
			});
		} catch (error) {
			if (isUniqueViolation(error)) throw addressInUse();
			throw error;
		}
	}

	private notifyPayoutWalletChanged(
		manager: EntityManager,
		organizationId: string,
		walletId: string,
		address: Address,
		changedAt: Date
	): Promise<void> {
		const kind = HostNoticeKind.PAYOUT_WALLET_CHANGED;
		return enqueueHostNotice(
			manager,
			new HostNoticeEvent(
				organizationId,
				noticeKey(kind, walletId, address, changedAt.getTime()),
				{ kind, payoutAddress: address },
				changedAt
			)
		);
	}

	async unlink(
		organizationId: string,
		purpose: PaymentWalletPurpose
	): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			const wallet = await manager.findOne(
				PaymentWallet,
				{ organizationId, purpose },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!wallet) return;
			if (
				purpose === PaymentWalletPurpose.PAYOUT &&
				(await hostFundsHeld(
					manager,
					configuredEscrow(this.config),
					organizationId
				))
			) {
				throw payoutEarningsHeld();
			}
			await manager.nativeDelete(PaymentWallet, { id: wallet.id });
			if (purpose === PaymentWalletPurpose.PAYOUT) {
				await this.settlementWakes.wakeOrganizationMachines(
					manager,
					organizationId
				);
			}
		});
	}
}

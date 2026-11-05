/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import type {
	EscrowAccountDto,
	EscrowEventPageDto,
	ListEscrowEventsQueryDto,
} from '../dto/escrow.dto';
import { EscrowEventDto } from '../dto/escrow.dto';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { SettlementChainCursor } from '../entities/settlement-chain-cursor.entity';
import { EscrowEventParty } from '../enums/escrow-event-party.enum';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { configuredEscrow } from '../utils/escrow-identity.util';

const PARTY_FILTER: Readonly<
	Record<EscrowEventParty, (organizationId: string) => FilterQuery<EscrowEvent>>
> = {
	[EscrowEventParty.CUSTOMER]: (organizationId) => ({
		customerOrganizationId: organizationId,
	}),
	[EscrowEventParty.HOST]: (organizationId) => ({
		hostOrganizationId: organizationId,
	}),
};

@Injectable()
export class EscrowAccountService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService
	) {}

	async account(organizationId: string): Promise<EscrowAccountDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const wallet = await manager.findOne(PaymentWallet, {
			organizationId,
			purpose: PaymentWalletPurpose.FUNDING,
		});
		const account = wallet
			? await manager.findOne(EscrowAccount, {
					...escrow,
					address: wallet.address,
				})
			: null;
		const cursor = await manager.findOne(SettlementChainCursor, escrow);
		return {
			chainId: escrow.chainId,
			escrowAddress: escrow.contractAddress,
			usdcAddress: this.config.get('settlement.usdcAddress'),
			fundingWalletAddress: wallet?.address ?? null,
			balanceMicroUsd: account?.balanceMicroUsd ?? MicroUsd.ZERO.toString(),
			pendingWithdrawalMicroUsd:
				account?.pendingWithdrawalMicroUsd ?? MicroUsd.ZERO.toString(),
			withdrawalReadyAt: account?.withdrawalReadyAt ?? null,
			blocked: account?.blocked ?? false,
			indexedThroughBlock: cursor?.lastIndexedBlock ?? null,
		};
	}

	// Newest first; the organization sees the events it took part in through
	// the roles the caller may read.
	async events(
		organizationId: string,
		parties: readonly EscrowEventParty[],
		query: ListEscrowEventsQueryDto
	): Promise<EscrowEventPageDto> {
		const page = await findCursorPage(this.entityManager.fork(), EscrowEvent, {
			where: {
				...configuredEscrow(this.config),
				$or: parties.map((party) => PARTY_FILTER[party](organizationId)),
			},
			orderBy: { blockNumber: QueryOrder.DESC, logIndex: QueryOrder.DESC },
			cursor: query.cursor,
			limit: query.limit,
		});
		return {
			items: page.items.map((event) =>
				EscrowEventDto.from(event, organizationId)
			),
			nextCursor: page.nextCursor,
		};
	}
}

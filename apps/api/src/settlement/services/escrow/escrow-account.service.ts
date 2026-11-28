/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { BillingRunwayService } from '../../../billing/services/billing-runway.service';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { addSeconds } from '../../../common/utils/time.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { WITHDRAWAL_REQUESTED_EVENT } from '../../constants/escrow.constants';
import {
	type EscrowAccountDto,
	EscrowEventDto,
	type EscrowEventPageDto,
	EscrowWindowsDto,
	type ListEscrowEventsQueryDto,
} from '../../dto/escrow.dto';
import { EscrowAccount } from '../../entities/escrow-account.entity';
import { EscrowEvent } from '../../entities/escrow-event.entity';
import { PaymentWallet } from '../../entities/payment-wallet.entity';
import { SettlementChainCursor } from '../../entities/settlement-chain-cursor.entity';
import { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import type { SettlementParty } from '../../enums/settlement-party.enum';
import { escrowUnfrozenClock } from '../../queries/escrow-unfrozen-time.query';
import {
	accountBlocked,
	activeBlockedAt,
} from '../../utils/escrow/account-block.util';
import { secondsUntil } from '../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { partyFilter } from '../../utils/settlement-party.util';
import { ChainClockService } from './chain-clock.service';
import { EscrowPolicyService } from './escrow-policy.service';

const ZERO = '0';

@Injectable()
export class EscrowAccountService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly escrowPolicy: EscrowPolicyService,
		private readonly runway: BillingRunwayService,
		private readonly chainClock: ChainClockService
	) {}

	async account(organizationId: string): Promise<EscrowAccountDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const wallet = await manager.findOne(PaymentWallet, {
			organizationId,
			purpose: PaymentWalletPurpose.FUNDING,
		});
		const address = wallet?.address;
		const now = await this.chainClock.now();
		const [account, cursor, policy, runway, clock, depositRoom, latestRequest] =
			await Promise.all([
				address ? manager.findOne(EscrowAccount, { ...escrow, address }) : null,
				manager.findOne(SettlementChainCursor, escrow),
				this.escrowPolicy.policy(),
				this.runway.runway(this.entityManager.fork(), organizationId),
				escrowUnfrozenClock(this.entityManager.fork(), escrow, now),
				this.escrowPolicy.depositRoom(address),
				address
					? this.entityManager.fork().findOne(
							EscrowEvent,
							{
								...escrow,
								kind: WITHDRAWAL_REQUESTED_EVENT,
								customerAddress: address,
							},
							{
								orderBy: {
									blockNumber: QueryOrder.DESC,
									logIndex: QueryOrder.DESC,
								},
								fields: ['blockTimestamp'],
							}
						)
					: null,
			]);
		const withdrawalPending =
			runway.funding.pendingWithdrawalMicroUsd.isPositive();
		const withdrawalUnlockAt = account?.withdrawalUnlockAt ?? null;
		const unlocksInSeconds = secondsUntil(
			withdrawalUnlockAt,
			clock.unfrozenSeconds
		);
		const unlockClockPaused = clock.frozen || accountBlocked(account, now);
		return {
			chainId: escrow.chainId,
			escrowAddress: escrow.contractAddress,
			usdcAddress: this.config.get('settlement.usdcAddress'),
			fundingWalletAddress: address ?? null,
			freeMicroUsd: runway.funding.freeMicroUsd.toString(),
			pendingMicroUsd: runway.funding.pendingWithdrawalMicroUsd.toString(),
			withdrawalUnlockAt,
			withdrawalUnlocksInSeconds: unlocksInSeconds,
			withdrawalRequestedAt: withdrawalPending
				? (latestRequest?.blockTimestamp ?? null)
				: null,
			withdrawalAvailableAt:
				withdrawalPending && unlocksInSeconds !== null && !unlockClockPaused
					? addSeconds(now, unlocksInSeconds)
					: null,
			withdrawalCancellable: withdrawalPending,
			outstandingMicroUsd: runway.funding.outstandingMicroUsd.toString(),
			availableMicroUsd: runway.funding.spendableMicroUsd.toString(),
			burnMicroUsdPerHour: runway.burnMicroUsdPerHour.toString(),
			runwaySeconds: runway.runwaySeconds?.toString() ?? null,
			frozenMicroUsd: account?.frozenMicroUsd ?? ZERO,
			blockedAt: activeBlockedAt(account, now),
			blockedUntil: accountBlocked(account, now)
				? (account?.blockedUntil ?? null)
				: null,
			depositRoomMicroUsd: depositRoom?.toString() ?? null,
			windows: EscrowWindowsDto.from(policy),
			indexedThroughBlock: cursor?.lastIndexedBlock ?? null,
		};
	}

	async events(
		organizationId: string,
		parties: readonly SettlementParty[],
		query: ListEscrowEventsQueryDto
	): Promise<EscrowEventPageDto> {
		const page = await findCursorPage(this.entityManager.fork(), EscrowEvent, {
			where: {
				...configuredEscrow(this.config),
				...partyFilter(organizationId, parties),
				...(query.kind ? { kind: { $in: query.kind } } : {}),
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

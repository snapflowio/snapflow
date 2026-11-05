/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { channelIdFor } from '@snapflow/contracts';
import { BillingAdmissionBlocker } from '../../billing/constants/billing.constants';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import type { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SETTLEMENT_VOUCHER_WAKE_TOPIC } from '../constants/payment-channel.constants';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { PayoutReadiness } from '../enums/payout-readiness.enum';
import { configuredEscrow } from '../utils/escrow-identity.util';
import { payoutReadiness } from '../utils/payout-readiness.util';

// Opens a lease's payment channel when the lease starts and starts closing
// it when the lease ends, in the transaction that starts or ends the lease.
@Injectable()
export class PaymentChannelService {
	constructor(
		private readonly config: TypedConfigService,
		private readonly wakes: ControlWakeService
	) {}

	// Self-use leases cost nothing and get no channel. Any other lease is
	// paid from the customer's funding wallet to the host's payout wallet, so
	// it cannot start without both.
	async open(manager: EntityManager, lease: SandboxLease): Promise<void> {
		if (lease.priceCardId === null) return;
		const funding = await this.wallet(
			manager,
			lease.customerOrganizationId,
			PaymentWalletPurpose.FUNDING
		);
		if (!funding) {
			throw new ConflictException({
				code: BillingAdmissionBlocker.FUNDING_REQUIRED,
				message: 'Link a funding wallet to pay for sandboxes on this machine',
			});
		}
		const payout = await this.wallet(
			manager,
			lease.hostOrganizationId,
			PaymentWalletPurpose.PAYOUT
		);
		if (!payout || payoutReadiness(payout) !== PayoutReadiness.READY) {
			throw new ConflictException({
				code: MarketplaceErrorCode.PAYOUT_WALLET_REQUIRED,
				message: 'The machine host has no payout wallet to be paid into',
			});
		}
		const sandbox = await manager.findOneOrFail(
			Sandbox,
			{ id: lease.sandboxId },
			{ fields: ['voucherSigning'] }
		);
		manager.create(PaymentChannel, {
			...configuredEscrow(this.config),
			channelId: channelIdFor(funding.address, payout.address, lease.id),
			leaseId: lease.id,
			sandboxId: lease.sandboxId,
			machineId: lease.machineId,
			customerOrganizationId: lease.customerOrganizationId,
			hostOrganizationId: lease.hostOrganizationId,
			customerAddress: funding.address,
			hostAddress: payout.address,
			signingMode: sandbox.voucherSigning,
			state: PaymentChannelState.OPEN,
			openedAt: lease.startedAt,
			closedAt: null,
			coveredAt: lease.startedAt,
			nextIssueAt: lease.startedAt,
			voucherError: null,
			claimedSequence: 0,
			claimSequence: null,
			claimTransactionHash: null,
			claimAttemptedAt: null,
			claimError: null,
		});
		await manager.flush();
		this.notify(manager, lease);
	}

	// The channel keeps issuing vouchers for usage billed after the end until
	// its final voucher closes it.
	async close(manager: EntityManager, lease: SandboxLease): Promise<void> {
		if (lease.endedAt === null) {
			throw new Error(`Lease ${lease.id} has not ended`);
		}
		const channel = await manager.findOne(
			PaymentChannel,
			{ leaseId: lease.id },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (channel?.state !== PaymentChannelState.OPEN) return;
		channel.state = PaymentChannelState.CLOSING;
		channel.closedAt = lease.endedAt;
		channel.nextIssueAt = lease.endedAt;
		await manager.flush();
		this.notify(manager, lease);
	}

	private wallet(
		manager: EntityManager,
		organizationId: string,
		purpose: PaymentWalletPurpose
	): Promise<PaymentWallet | null> {
		return manager.findOne(PaymentWallet, { organizationId, purpose });
	}

	private notify(manager: EntityManager, lease: SandboxLease): void {
		this.wakes.notifyAfterCommit(manager, SETTLEMENT_VOUCHER_WAKE_TOPIC, [
			lease.machineId,
		]);
	}
}

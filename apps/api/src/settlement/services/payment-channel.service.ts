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
import type { Address } from 'viem';
import { BillingAdmissionBlocker } from '../../billing/constants/billing.constants';
import type { BillingPeriod } from '../../billing/utils/billing-period.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SETTLEMENT_VOUCHER_WAKE_TOPIC } from '../constants/payment-channel.constants';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { PayoutReadiness } from '../enums/payout-readiness.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import { configuredEscrow } from '../utils/escrow-identity.util';
import { platformServiceReference } from '../utils/payment-channel-kind.util';
import { payoutReadiness } from '../utils/payout-readiness.util';
import { EscrowFeePolicyService } from './escrow-fee-policy.service';

type ChannelParties = Pick<
	PaymentChannel,
	| 'kind'
	| 'leaseId'
	| 'sandboxId'
	| 'machineId'
	| 'servicePeriodStart'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
	| 'signingMode'
	| 'openedAt'
>;

// Opens a lease's payment channel when the lease starts and starts closing
// it when the lease ends, in the transaction that starts or ends the lease,
// and opens the platform service channel of an organization's month.
@Injectable()
export class PaymentChannelService {
	constructor(
		private readonly config: TypedConfigService,
		private readonly wakes: ControlWakeService,
		private readonly feePolicy: EscrowFeePolicyService
	) {}

	// Self-use leases cost nothing and get no channel. Any other lease is
	// paid from the customer's funding wallet to the host's payout wallet, so
	// it cannot start without both, nor at a markup the escrow would refuse.
	async open(manager: EntityManager, lease: SandboxLease): Promise<void> {
		if (lease.priceCardId === null) return;
		await this.feePolicy.assertMarkupAllowed(lease.markupBasisPoints);
		const funding = await this.funding(manager, lease.customerOrganizationId);
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
		this.create(manager, funding.address, payout.address, lease.id, {
			kind: PaymentChannelKind.LEASE,
			leaseId: lease.id,
			sandboxId: lease.sandboxId,
			machineId: lease.machineId,
			servicePeriodStart: null,
			customerOrganizationId: lease.customerOrganizationId,
			hostOrganizationId: lease.hostOrganizationId,
			signingMode: sandbox.voucherSigning,
			openedAt: lease.startedAt,
		});
		await manager.flush();
		this.notify(manager, lease.machineId);
	}

	// The escrow pays a platform service channel's fees to its fee recipient,
	// which stands as the channel's host and is never paid a host amount.
	// Snapflow signs its vouchers like any other once the customer delegated.
	async openPlatformService(
		manager: EntityManager,
		organizationId: string,
		period: BillingPeriod
	): Promise<void> {
		const funding = await this.funding(manager, organizationId);
		const { feeRecipient } = await this.feePolicy.policy();
		this.create(
			manager,
			funding.address,
			feeRecipient,
			platformServiceReference(organizationId, period),
			{
				kind: PaymentChannelKind.PLATFORM_SERVICE,
				leaseId: null,
				sandboxId: null,
				machineId: null,
				servicePeriodStart: period.start,
				customerOrganizationId: organizationId,
				hostOrganizationId: null,
				signingMode: VoucherSigningMode.DELEGATED,
				openedAt: await databaseNow(manager),
			}
		);
		await manager.flush();
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
		this.notify(manager, lease.machineId);
	}

	private create(
		manager: EntityManager,
		customerAddress: Address,
		hostAddress: Address,
		reference: string,
		parties: ChannelParties
	): void {
		manager.create(PaymentChannel, {
			...configuredEscrow(this.config),
			...parties,
			channelId: channelIdFor(customerAddress, hostAddress, reference),
			customerAddress,
			hostAddress,
			state: PaymentChannelState.OPEN,
			closedAt: null,
			coveredAt: parties.openedAt,
			nextIssueAt: parties.openedAt,
			voucherError: null,
			claimedSequence: 0,
			claimSequence: null,
			claimTransactionHash: null,
			claimAttemptedAt: null,
			claimError: null,
		});
	}

	private async funding(
		manager: EntityManager,
		organizationId: string
	): Promise<PaymentWallet> {
		const funding = await this.wallet(
			manager,
			organizationId,
			PaymentWalletPurpose.FUNDING
		);
		if (!funding) {
			throw new ConflictException({
				code: BillingAdmissionBlocker.FUNDING_REQUIRED,
				message: 'Link a funding wallet to pay for sandboxes on this machine',
			});
		}
		return funding;
	}

	private wallet(
		manager: EntityManager,
		organizationId: string,
		purpose: PaymentWalletPurpose
	): Promise<PaymentWallet | null> {
		return manager.findOne(PaymentWallet, { organizationId, purpose });
	}

	private notify(manager: EntityManager, machineId: string): void {
		this.wakes.notifyAfterCommit(manager, SETTLEMENT_VOUCHER_WAKE_TOPIC, [
			machineId,
		]);
	}
}

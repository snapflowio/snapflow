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
import {
	ConflictException,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import {
	channelIdOf,
	escrowDomain,
	feeBpsForMarkup,
} from '@snapflow/contracts';
import type { Address, Hex } from 'viem';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import type { PlacementPrice } from '../../../marketplace/entities/placement-price.entity';
import { MarketplaceErrorCode } from '../../../marketplace/enums/marketplace-error-code.enum';
import { Sandbox } from '../../../sandbox/entities/sandbox.entity';
import {
	SETTLEMENT_WAKE_TOPIC,
	SettlementErrorCode,
} from '../../constants/payment-channel.constants';
import { PaymentWalletErrorCode } from '../../constants/payment-wallet.constants';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { PaymentChannelCharge } from '../../entities/payment-channel-charge.entity';
import { PaymentWallet } from '../../entities/payment-wallet.entity';
import { PaymentChannelKind } from '../../enums/payment-channel-kind.enum';
import { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import { PayoutReadiness } from '../../enums/payout-readiness.enum';
import { SanctionsStatus } from '../../enums/sanctions-status.enum';
import { VoucherSigningMode } from '../../enums/voucher-signing-mode.enum';
import { currentHostKey } from '../../queries/host-keys.query';
import {
	platformChannelSalt,
	sandboxChannelSalt,
} from '../../utils/channels/channel-salt.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { payoutReadiness } from '../../utils/payouts/payout-readiness.util';

const ZERO = '0';

function activate(channel: PaymentChannel, at: Date): void {
	if (channel.nextIssueAt !== null) return;
	channel.nextIssueAt = at;
	channel.coveredAt = at;
}

type ChannelParties = Pick<
	PaymentChannel,
	| 'kind'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
	| 'machineId'
	| 'customerAddress'
	| 'hostAddress'
	| 'feeBps'
	| 'salt'
	| 'signingMode'
>;

@Injectable()
export class PaymentChannelService {
	constructor(
		private readonly config: TypedConfigService,
		private readonly wakes: ControlWakeService
	) {}

	async attach(
		manager: EntityManager,
		placementPrice: PlacementPrice
	): Promise<void> {
		if (placementPrice.priceCardId === null) return;
		const customerAddress = await this.fundingAddress(
			manager,
			placementPrice.customerOrganizationId
		);
		const payout = await manager.findOne(PaymentWallet, {
			organizationId: placementPrice.hostOrganizationId,
			purpose: PaymentWalletPurpose.PAYOUT,
		});
		if (!payout || payoutReadiness(payout) !== PayoutReadiness.READY) {
			throw new ConflictException({
				code: MarketplaceErrorCode.PAYOUT_WALLET_REQUIRED,
				message: 'The machine host has no payout wallet to be paid into',
			});
		}
		const hostAddress = await currentHostKey(manager, placementPrice.machineId);
		if (!hostAddress) {
			throw new ConflictException({
				code: SettlementErrorCode.HOST_KEY_REQUIRED,
				message: 'The machine has not enrolled a host key to be paid at',
			});
		}
		const { voucherSigning } = await manager.findOneOrFail(
			Sandbox,
			{ id: placementPrice.sandboxId },
			{ fields: ['voucherSigning'] }
		);
		const channel = await this.channel(
			manager,
			{
				kind: PaymentChannelKind.SANDBOX,
				customerOrganizationId: placementPrice.customerOrganizationId,
				hostOrganizationId: placementPrice.hostOrganizationId,
				machineId: placementPrice.machineId,
				customerAddress,
				hostAddress,
				feeBps: feeBpsForMarkup(placementPrice.markupBasisPoints),
				salt: sandboxChannelSalt(placementPrice.machineId, voucherSigning),
				signingMode: voucherSigning,
			},
			placementPrice.startedAt
		);
		activate(channel, placementPrice.startedAt);
		manager.create(PaymentChannelCharge, {
			paymentChannelId: channel.id,
			placementPriceId: placementPrice.id,
			sandboxId: placementPrice.sandboxId,
			chargedMicroUsd: ZERO,
			endedAt: null,
			settledAt: null,
		});
		await manager.flush();
		this.notify(manager, placementPrice.machineId);
	}

	async end(
		manager: EntityManager,
		placementPrice: PlacementPrice
	): Promise<void> {
		if (placementPrice.endedAt === null) {
			throw new Error(`Placement price ${placementPrice.id} has not ended`);
		}
		const link = await manager.findOne(
			PaymentChannelCharge,
			{ placementPriceId: placementPrice.id },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!link) return;
		link.endedAt = placementPrice.endedAt;
		const channel = await manager.findOneOrFail(
			PaymentChannel,
			{ id: link.paymentChannelId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		channel.nextIssueAt = placementPrice.endedAt;
		await manager.flush();
		this.notify(manager, placementPrice.machineId);
	}

	async recordPlatformCharges(
		manager: EntityManager,
		organizationId: string,
		chargedMicroUsd: bigint,
		at: Date
	): Promise<void> {
		const platformReceiver = this.config.get('settlement.feeReceiverAddress');
		const channel = await this.channel(
			manager,
			{
				kind: PaymentChannelKind.PLATFORM,
				customerOrganizationId: organizationId,
				hostOrganizationId: null,
				machineId: null,
				customerAddress: await this.fundingAddress(manager, organizationId),
				hostAddress: platformReceiver,
				feeBps: 0,
				salt: platformChannelSalt(organizationId),
				signingMode: VoucherSigningMode.DELEGATED,
			},
			at
		);
		if (BigInt(channel.chargedMicroUsd) >= chargedMicroUsd) return;
		activate(channel, at);
		channel.chargedMicroUsd = chargedMicroUsd.toString();
		await manager.flush();
	}

	private async channel(
		manager: EntityManager,
		parties: ChannelParties,
		at: Date
	): Promise<PaymentChannel> {
		const escrow = configuredEscrow(this.config);
		const feeReceiverAddress = this.config.get('settlement.feeReceiverAddress');
		const channelId = this.channelId(parties, feeReceiverAddress);
		await manager.upsert(
			PaymentChannel,
			{
				...escrow,
				...parties,
				channelId,
				feeReceiverAddress,
				chargedMicroUsd: ZERO,
				issuedMicroUsd: ZERO,
				signedMicroUsd: ZERO,
				claimedMicroUsd: ZERO,
				refundedMicroUsd: ZERO,
				coveredAt: at,
				nextIssueAt: null,
				voucherError: null,
				lastClaimedAt: null,
			},
			{
				onConflictFields: ['chainId', 'contractAddress', 'channelId'],
				onConflictAction: 'ignore',
			}
		);
		return manager.findOneOrFail(
			PaymentChannel,
			{ ...escrow, channelId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true }
		);
	}

	private channelId(parties: ChannelParties, feeReceiver: Address): Hex {
		const escrow = configuredEscrow(this.config);
		return channelIdOf(escrowDomain(escrow.chainId, escrow.contractAddress), {
			customer: parties.customerAddress,
			host: parties.hostAddress,
			feeReceiver,
			feeBps: parties.feeBps,
			salt: parties.salt,
		});
	}

	private async fundingAddress(
		manager: EntityManager,
		organizationId: string
	): Promise<Address> {
		const funding = await manager.findOne(PaymentWallet, {
			organizationId,
			purpose: PaymentWalletPurpose.FUNDING,
		});
		if (!funding) {
			throw new ConflictException({
				code: SettlementErrorCode.FUNDING_WALLET_REQUIRED,
				message: 'Link a funding wallet to pay for sandboxes on this machine',
			});
		}
		if (funding.sanctionsStatus === SanctionsStatus.BLOCKED) {
			throw new ForbiddenException({
				code: PaymentWalletErrorCode.ADDRESS_SANCTIONED,
				message:
					'The funding wallet failed sanctions screening, so new sandboxes cannot be billed to it. Contact support.',
			});
		}
		return funding.address;
	}

	private notify(manager: EntityManager, machineId: string): void {
		this.wakes.notifyAfterCommit(manager, SETTLEMENT_WAKE_TOPIC, [machineId]);
	}
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { escrowDomain, MAX_BATCH_SIZE } from '@snapflow/contracts';
import { type Address, isAddressEqual } from 'viem';
import { canonicalJson } from '../../common/utils/canonical-json.util';
import { errorMessage } from '../../common/utils/error/error.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { Machine } from '../../machine/entities/machine.entity';
import {
	HostNoticeKind,
	NOTICE_COOLDOWN_SECONDS,
} from '../../notification/constants/notice.constants';
import { HostNoticeEvent } from '../../notification/events/host-notice.event';
import {
	cooldownNoticeKey,
	enqueueHostNotice,
} from '../../notification/utils/notice-outbox.util';
import { SettingsService } from '../../settings/services/settings.service';
import { HOST_WITHDRAWAL_SIGNATURE_SECONDS } from '../constants/host-settlement.constants';
import { MACHINE_SETTLEMENT_DOCUMENT_VERSION } from '../constants/payment-channel.constants';
import { EscrowWindowsDto } from '../dto/escrow.dto';
import { EscrowDomainDto } from '../dto/escrow-domain.dto';
import { HostSettlementDto } from '../dto/host-settlement.dto';
import type {
	MachineRelayFeeQuoteDto,
	MachineSettlementChannelDto,
	MachineSettlementDocumentDto,
	MachineVoucherSignerDto,
} from '../dto/machine-settlement.dto';
import { VoucherMessageDto } from '../dto/payment-voucher.dto';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { EscrowSigner } from '../entities/escrow-signer.entity';
import { HostSettlement } from '../entities/host-settlement.entity';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentChannelCharge } from '../entities/payment-channel-charge.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import { currentHostKey } from '../queries/host-keys.query';
import {
	latestVouchers,
	VoucherSelection,
} from '../queries/latest-vouchers.query';
import { readyPayoutWallet } from '../queries/payout-wallet.query';
import type { EscrowIdentity } from '../types/escrow.types';
import { microUsd } from '../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../utils/escrow/escrow-identity.util';
import { ChainClockService } from './escrow/chain-clock.service';
import { EscrowPolicyService } from './escrow/escrow-policy.service';
import { RelayFeeQuoteService } from './relay/relay-fee-quote.service';
import { HostSettlementChainService } from './settlements/host-settlement-chain.service';

const DIGEST_ALGORITHM = 'sha256';
const DIGEST_ENCODING = 'hex';
const ZERO = '0';

type StableDocument = Omit<MachineSettlementDocumentDto, 'digest'>;

@Injectable()
export class MachineSettlementService {
	private readonly logger = new Logger(MachineSettlementService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly escrowPolicy: EscrowPolicyService,
		private readonly quotes: RelayFeeQuoteService,
		private readonly settlementChain: HostSettlementChainService,
		private readonly chainClock: ChainClockService
	) {}

	async document(
		machine: Pick<Machine, 'id' | 'organizationId'>
	): Promise<MachineSettlementDocumentDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const settings = await this.settings.get();
		const hostAddress = await currentHostKey(manager, machine.id);
		const latestSettlement = hostAddress
			? await manager.findOne(
					HostSettlement,
					{ ...escrow, hostAddress },
					{ orderBy: { createdAt: QueryOrder.DESC } }
				)
			: null;
		const document: StableDocument = {
			schemaVersion: MACHINE_SETTLEMENT_DOCUMENT_VERSION,
			domain: EscrowDomainDto.from(
				escrowDomain(escrow.chainId, escrow.contractAddress)
			),
			windows: EscrowWindowsDto.from(await this.escrowPolicy.policy()),
			voucherIntervalSeconds: settings.voucherIntervalSeconds,
			voucherGraceIntervals: settings.voucherGraceIntervals,
			hostAddress,
			payoutAddress: await readyPayoutWallet(manager, machine.organizationId),
			payoutMinimumMicroUsd: MicroUsd.fromCents(
				settings.hostPayoutMinimumCents
			).toString(),
			creditedAmount: hostAddress
				? await this.credited(manager, escrow, hostAddress)
				: ZERO,
			relayer: {
				address: this.config.get('settlement.relayerAddress'),
				maxBatchSize: MAX_BATCH_SIZE,
				signatureLifetimeSeconds: HOST_WITHDRAWAL_SIGNATURE_SECONDS.LIFETIME,
				quote: null,
			},
			latestSettlement: latestSettlement
				? HostSettlementDto.from(latestSettlement)
				: null,
			channels: hostAddress
				? await this.channels(manager, escrow, machine.id, hostAddress)
				: [],
		};
		if (document.payoutAddress === null) {
			await this.notifyPayoutWalletMissing(manager, machine, document.channels);
		}
		const digest = createHash(DIGEST_ALGORITHM)
			.update(canonicalJson(document))
			.digest(DIGEST_ENCODING);
		const quote = hostAddress ? await this.quote(hostAddress) : null;
		return {
			digest,
			...document,
			relayer: { ...document.relayer, quote },
		};
	}

	private async notifyPayoutWalletMissing(
		manager: EntityManager,
		machine: Pick<Machine, 'organizationId'>,
		channels: readonly MachineSettlementChannelDto[]
	): Promise<void> {
		const owed = channels.some(
			(channel) =>
				channel.voucher !== null &&
				microUsd(channel.voucher.cumulativeAmount) >
					microUsd(channel.claimedAmount)
		);
		if (!owed) return;
		const observedAt = await databaseNow(manager);
		const kind = HostNoticeKind.PAYOUT_WALLET_MISSING;
		await enqueueHostNotice(
			manager,
			new HostNoticeEvent(
				machine.organizationId,
				cooldownNoticeKey(
					observedAt,
					NOTICE_COOLDOWN_SECONDS.payoutWalletMissing,
					kind,
					machine.organizationId
				),
				{ kind },
				observedAt
			)
		);
	}

	private async channels(
		manager: EntityManager,
		escrow: EscrowIdentity,
		machineId: string,
		hostAddress: Address
	): Promise<MachineSettlementChannelDto[]> {
		const channels = (
			await manager.find(
				PaymentChannel,
				{ ...escrow, machineId, hostAddress },
				{ orderBy: { createdAt: QueryOrder.ASC, id: QueryOrder.ASC } }
			)
		).filter(
			(channel) =>
				channel.nextIssueAt !== null ||
				microUsd(channel.signedMicroUsd) > microUsd(channel.claimedMicroUsd)
		);
		if (channels.length === 0) return [];
		const ids = channels.map(({ id }) => id);
		const [signed, placementPrices, customers] = await Promise.all([
			latestVouchers(manager, ids, VoucherSelection.SIGNED),
			manager.find(
				PaymentChannelCharge,
				{ paymentChannelId: { $in: ids }, settledAt: null },
				{ orderBy: { createdAt: QueryOrder.ASC } }
			),
			manager.find(EscrowAccount, {
				...escrow,
				address: {
					$in: [...new Set(channels.map((channel) => channel.customerAddress))],
				},
			}),
		]);
		const signers = await this.signers(manager, escrow, [...signed.values()]);
		const accounts = new Map(
			customers.map((account) => [account.address, account])
		);
		return channels.map((channel) => {
			const voucher = signed.get(channel.id);
			const customer = accounts.get(channel.customerAddress);
			return {
				paymentChannelId: channel.id,
				channelId: channel.channelId,
				customerAddress: channel.customerAddress,
				hostAddress: channel.hostAddress,
				feeReceiverAddress: channel.feeReceiverAddress,
				feeBps: channel.feeBps,
				salt: channel.salt,
				signingMode: channel.signingMode,
				sandboxes: placementPrices
					.filter(({ paymentChannelId }) => paymentChannelId === channel.id)
					.map((placementPrice) => ({
						sandboxId: placementPrice.sandboxId,
						placementPriceId: placementPrice.placementPriceId,
						endedAt: placementPrice.endedAt,
					})),
				chargedAmount: channel.chargedMicroUsd,
				claimedAmount: channel.claimedMicroUsd,
				coveredAt: channel.coveredAt,
				voucherLimit: channel.voucherError,
				voucher:
					voucher?.signature && voucher.signerAddress
						? {
								...VoucherMessageDto.from(channel, voucher),
								sequence: voucher.sequence,
								digest: voucher.digest,
								signer: voucher.signerAddress,
								signature: voucher.signature,
							}
						: null,
				signer: voucher?.signerAddress
					? this.signerState(channel, voucher.signerAddress, signers)
					: null,
				customerPendingAmount: customer?.pendingMicroUsd ?? ZERO,
				customerWithdrawalUnlockAt: customer?.withdrawalUnlockAt ?? null,
			};
		});
	}

	private async credited(
		manager: EntityManager,
		escrow: EscrowIdentity,
		hostAddress: Address
	): Promise<string> {
		const account = await manager.findOne(
			EscrowAccount,
			{ ...escrow, address: hostAddress },
			{ fields: ['hostBalanceMicroUsd'] }
		);
		return account?.hostBalanceMicroUsd ?? ZERO;
	}

	private async quote(
		hostAddress: Address
	): Promise<MachineRelayFeeQuoteDto | null> {
		try {
			const [quote, nonce, quotedAt] = await Promise.all([
				this.quotes.hostSettlementQuote(),
				this.settlementChain.withdrawalNonce(hostAddress),
				this.chainClock.now(),
			]);
			return {
				baseMicroUsd: quote.baseMicroUsd.toString(),
				perClaimMicroUsd: quote.perClaimMicroUsd.toString(),
				maximumMicroUsd: quote.maximumMicroUsd.toString(),
				hostWithdrawalNonce: nonce.toString(),
				quotedAt,
			};
		} catch (error) {
			this.logger.warn(
				`Serving the settlement document without a relay fee quote: ${errorMessage(error)}`
			);
			return null;
		}
	}

	private signerState(
		channel: PaymentChannel,
		signerAddress: Address,
		signers: ReadonlyMap<Address, EscrowSigner>
	): MachineVoucherSignerDto {
		if (isAddressEqual(signerAddress, channel.customerAddress)) {
			return {
				signerAddress,
				customerWallet: true,
				expiresAt: null,
				thawEndsAt: null,
				revokedAt: null,
			};
		}
		const grant = signers.get(signerAddress);
		return {
			signerAddress,
			customerWallet: false,
			expiresAt: grant?.expiresAt ?? null,
			thawEndsAt: grant?.thawEndsAt ?? null,
			revokedAt: grant?.revokedAt ?? null,
		};
	}

	private async signers(
		manager: EntityManager,
		escrow: EscrowIdentity,
		vouchers: readonly PaymentVoucher[]
	): Promise<Map<Address, EscrowSigner>> {
		const addresses = vouchers.flatMap(({ signerAddress }) =>
			signerAddress ? [signerAddress] : []
		);
		if (addresses.length === 0) return new Map();
		const grants = await manager.find(EscrowSigner, {
			...escrow,
			signerAddress: { $in: [...new Set(addresses)] },
		});
		return new Map(grants.map((grant) => [grant.signerAddress, grant]));
	}
}

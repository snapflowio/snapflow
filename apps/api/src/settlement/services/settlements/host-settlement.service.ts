/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	Logger,
	UnprocessableEntityException,
} from '@nestjs/common';
import {
	escrowDomain,
	type HostWithdrawal,
	MAX_RELAY_FEE,
	recoverHostWithdrawalSigner,
} from '@snapflow/contracts';
import { type Address, getAddress, type Hex, isAddressEqual } from 'viem';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { addSeconds } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { Machine } from '../../../machine/entities/machine.entity';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	HOST_WITHDRAWAL_SIGNATURE_SECONDS,
	HostSettlementErrorCode,
} from '../../constants/host-settlement.constants';
import { SETTLEMENT_WAKE_TOPIC } from '../../constants/payment-channel.constants';
import {
	HostSettlementDto,
	type SettleMachineChannelsDto,
} from '../../dto/host-settlement.dto';
import { EscrowAccount } from '../../entities/escrow-account.entity';
import { HostSettlement } from '../../entities/host-settlement.entity';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { HostSettlementStatus } from '../../enums/host-settlement-status.enum';
import { currentHostKey } from '../../queries/host-keys.query';
import {
	latestVouchers,
	VoucherSelection,
} from '../../queries/latest-vouchers.query';
import { readyPayoutWallet } from '../../queries/payout-wallet.query';
import { settlementClaims } from '../../queries/settlement-claims.query';
import type { HostSettlementItem } from '../../types/host-settlement.types';
import { withSettlementChain } from '../../utils/chain-error.util';
import { microUsd } from '../../utils/escrow/escrow-amount.util';
import { chainTimestamp } from '../../utils/escrow/escrow-event-record.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import {
	hostShare,
	isSignerCapped,
	netPayout,
	payoutDue,
} from '../../utils/payouts/payout-due.util';
import {
	hostSettlementCalldata,
	settlementItem,
} from '../../utils/settlements/host-settlement-call.util';
import { ChainClockService } from '../escrow/chain-clock.service';
import { HostSettlementChainService } from './host-settlement-chain.service';

const ZERO_AMOUNT = '0';

interface SettlementItems {
	items: HostSettlementItem[];
	earnedMicroUsd: bigint;
	signerCapped: boolean;
}

interface RequestedPayout {
	machineId: string;
	host: Address;
	earnedMicroUsd: bigint;
	relayFeeMicroUsd: bigint;
	signerCapped: boolean;
}

@Injectable()
export class HostSettlementService {
	private readonly logger = new Logger(HostSettlementService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly chain: HostSettlementChainService,
		private readonly wakes: ControlWakeService,
		private readonly settings: SettingsService,
		private readonly chainClock: ChainClockService
	) {}

	async settle(
		machine: Pick<Machine, 'id' | 'organizationId'>,
		input: SettleMachineChannelsDto
	): Promise<HostSettlementDto> {
		const manager = this.entityManager.fork();
		const host = await currentHostKey(manager, machine.id);
		if (!host) {
			throw new ConflictException({
				code: HostSettlementErrorCode.HOST_KEY_REQUIRED,
				message: 'The machine has not enrolled a host key',
			});
		}
		const payout = await this.requestedPayout(manager, machine, input);
		const deadline = await this.checkedDeadline(input.deadline);
		const relayFee = BigInt(input.relayFee);
		if (relayFee > MAX_RELAY_FEE) {
			throw this.underpaid(`The relay fee is above ${MAX_RELAY_FEE}`);
		}
		const { items, earnedMicroUsd, signerCapped } = await this.items(
			manager,
			machine,
			host,
			input.channelIds
		);
		await this.assertPayoutDue(manager, {
			machineId: machine.id,
			host,
			earnedMicroUsd,
			relayFeeMicroUsd: relayFee,
			signerCapped,
		});
		const withdrawal: HostWithdrawal = {
			host,
			payout,
			relayer: this.config.get('settlement.relayerAddress'),
			relayFee,
			nonce: BigInt(input.nonce),
			deadline: BigInt(input.deadline),
		};
		await this.assertSigned(withdrawal, input.signature);
		await withSettlementChain(this.logger, () =>
			this.assertSettleable(manager, withdrawal, input.signature, items)
		);
		const settlement = await this.queue(manager, {
			...configuredEscrow(this.config),
			machineId: machine.id,
			hostAddress: host,
			payoutAddress: payout,
			relayFeeMicroUsd: relayFee.toString(),
			nonce: withdrawal.nonce.toString(),
			deadline,
			signature: input.signature,
			items,
			status: HostSettlementStatus.QUEUED,
			transactionHash: null,
			error: null,
			settledAt: null,
		});
		return HostSettlementDto.from(settlement);
	}

	private async requestedPayout(
		manager: EntityManager,
		machine: Pick<Machine, 'organizationId'>,
		input: SettleMachineChannelsDto
	): Promise<Address> {
		const wallet = await readyPayoutWallet(manager, machine.organizationId);
		if (!wallet) {
			throw new ConflictException({
				code: HostSettlementErrorCode.PAYOUT_WALLET_REQUIRED,
				message: 'The organization has no usable payout wallet',
			});
		}
		if (!isAddressEqual(wallet, input.payoutAddress)) {
			throw new ConflictException({
				code: HostSettlementErrorCode.PAYOUT_NOT_REQUESTED,
				message: "The payout address is not the organization's payout wallet",
				payoutWalletAddress: wallet,
			});
		}
		return getAddress(wallet);
	}

	private async checkedDeadline(deadline: string): Promise<Date> {
		const at = chainTimestamp(BigInt(deadline));
		const now = await this.chainClock.now();
		if (
			at <=
				addSeconds(now, HOST_WITHDRAWAL_SIGNATURE_SECONDS.MINIMUM_REMAINING) ||
			at > addSeconds(now, HOST_WITHDRAWAL_SIGNATURE_SECONDS.MAXIMUM_LIFETIME)
		) {
			throw new UnprocessableEntityException({
				code: HostSettlementErrorCode.DEADLINE_INVALID,
				message: `The deadline must lie between ${HOST_WITHDRAWAL_SIGNATURE_SECONDS.MINIMUM_REMAINING} and ${HOST_WITHDRAWAL_SIGNATURE_SECONDS.MAXIMUM_LIFETIME} seconds from now`,
			});
		}
		return at;
	}

	private async assertPayoutDue(
		manager: EntityManager,
		request: RequestedPayout
	): Promise<void> {
		const [settings, machine, account] = await Promise.all([
			this.settings.get(),
			manager.findOneOrFail(
				Machine,
				{ id: request.machineId },
				{ fields: ['draining'] }
			),
			manager.findOne(
				EscrowAccount,
				{ ...configuredEscrow(this.config), address: request.host },
				{ fields: ['hostBalanceMicroUsd'] }
			),
		]);
		const candidate = {
			withdrawableMicroUsd:
				request.earnedMicroUsd +
				microUsd(account?.hostBalanceMicroUsd ?? ZERO_AMOUNT),
			relayFeeMicroUsd: request.relayFeeMicroUsd,
			minimumMicroUsd: MicroUsd.fromCents(
				settings.hostPayoutMinimumCents
			).toBigInt(),
			draining: machine.draining,
			signerCapped: request.signerCapped,
		};
		if (payoutDue(candidate)) return;
		const net = netPayout(candidate);
		throw new ConflictException(
			net === 0n
				? {
						code: HostSettlementErrorCode.RELAY_FEE_EXCEEDS_PAYOUT,
						message:
							'The relay fee is not below what the payout withdraws; the earnings carry over until they cover it',
						withdrawableMicroUsd: candidate.withdrawableMicroUsd.toString(),
						relayFeeMicroUsd: candidate.relayFeeMicroUsd.toString(),
					}
				: {
						code: HostSettlementErrorCode.PAYOUT_BELOW_MINIMUM,
						message:
							'The payout after its relay fee is below the payout minimum; the earnings carry over, and Snapflow claims any that near a deadline',
						netPayoutMicroUsd: net.toString(),
						minimumMicroUsd: candidate.minimumMicroUsd.toString(),
					}
		);
	}

	private async items(
		manager: EntityManager,
		machine: Pick<Machine, 'id'>,
		host: Address,
		channelIds: readonly Hex[]
	): Promise<SettlementItems> {
		if (channelIds.length === 0) {
			return { items: [], earnedMicroUsd: 0n, signerCapped: false };
		}
		const channels = await manager.find(PaymentChannel, {
			...configuredEscrow(this.config),
			machineId: machine.id,
			hostAddress: host,
			channelId: { $in: [...channelIds] },
		});
		const signed = await latestVouchers(
			manager,
			channels.map(({ id }) => id),
			VoucherSelection.SIGNED
		);
		const byChannelId = new Map(
			channels.map((channel) => [channel.channelId.toLowerCase(), channel])
		);
		const unsettleable: Hex[] = [];
		let earnedMicroUsd = 0n;
		const items = channelIds.flatMap((channelId): HostSettlementItem[] => {
			const channel = byChannelId.get(channelId.toLowerCase());
			const voucher = channel ? signed.get(channel.id) : undefined;
			if (
				!channel ||
				!voucher ||
				microUsd(voucher.cumulativeMicroUsd) <=
					microUsd(channel.claimedMicroUsd)
			) {
				unsettleable.push(channelId);
				return [];
			}
			const item = settlementItem(channel, voucher);
			earnedMicroUsd += hostShare(
				microUsd(item.maxAmountMicroUsd),
				channel.feeBps
			);
			return [item];
		});
		if (unsettleable.length > 0) {
			throw new ConflictException({
				code: HostSettlementErrorCode.CHANNEL_NOT_SETTLEABLE,
				message:
					'These channels do not pay this machine or have no signed voucher left to claim',
				channelIds: unsettleable,
			});
		}
		return {
			items,
			earnedMicroUsd,
			signerCapped: channels.some(isSignerCapped),
		};
	}

	private async assertSigned(
		withdrawal: HostWithdrawal,
		signature: Hex
	): Promise<void> {
		const escrow = configuredEscrow(this.config);
		const signer = await recoverHostWithdrawalSigner(
			escrowDomain(escrow.chainId, escrow.contractAddress),
			withdrawal,
			signature
		).catch(() => null);
		if (!signer || !isAddressEqual(signer, withdrawal.host)) {
			throw new UnprocessableEntityException({
				code: HostSettlementErrorCode.SIGNATURE_INVALID,
				message:
					"The signature is not the host key's HostWithdrawal for Snapflow's relayer",
			});
		}
	}

	private async assertSettleable(
		manager: EntityManager,
		withdrawal: HostWithdrawal,
		signature: Hex,
		items: readonly HostSettlementItem[]
	): Promise<void> {
		const nonce = await this.chain.withdrawalNonce(withdrawal.host);
		if (nonce !== withdrawal.nonce) {
			throw new ConflictException({
				code: HostSettlementErrorCode.NONCE_STALE,
				message: `The host key's withdrawal nonce is ${nonce}`,
				nonce: nonce.toString(),
			});
		}
		const simulation = await this.chain.simulate(
			hostSettlementCalldata(
				{
					hostAddress: withdrawal.host,
					payoutAddress: withdrawal.payout,
					relayFeeMicroUsd: withdrawal.relayFee.toString(),
					deadline: chainTimestamp(withdrawal.deadline),
					signature,
				},
				await settlementClaims(manager, items)
			),
			items.length
		);
		if (simulation.failure !== null) {
			throw new UnprocessableEntityException({
				code: HostSettlementErrorCode.SIMULATION_FAILED,
				message: `The escrow would refuse the settlement: ${simulation.failure}`,
				reason: simulation.failure,
			});
		}
		if (withdrawal.relayFee < simulation.requiredFee) {
			throw this.underpaid(
				`The relay fee must be at least ${simulation.requiredFee} to repay the gas`,
				simulation.requiredFee
			);
		}
	}

	private async queue(
		manager: EntityManager,
		fields: Omit<HostSettlement, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<HostSettlement> {
		try {
			return await manager.transactional(async (transaction) => {
				const settlement = transaction.create(HostSettlement, fields);
				await transaction.flush();
				this.wakes.notifyAfterCommit(transaction, SETTLEMENT_WAKE_TOPIC, [
					fields.machineId,
				]);
				return settlement;
			});
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			throw new ConflictException({
				code: HostSettlementErrorCode.SETTLEMENT_IN_FLIGHT,
				message:
					'A settlement of this host key is still waiting to land; sign the next one once it settled',
			});
		}
	}

	private underpaid(
		message: string,
		requiredMicroUsd?: bigint
	): UnprocessableEntityException {
		return new UnprocessableEntityException({
			code: HostSettlementErrorCode.RELAY_FEE_TOO_LOW,
			message,
			...(requiredMicroUsd === undefined
				? {}
				: { requiredMicroUsd: requiredMicroUsd.toString() }),
		});
	}
}

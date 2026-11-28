/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { feeOf } from '@snapflow/contracts';
import { type Address, type Hex, isAddressEqual } from 'viem';
import { EscrowAccount } from '../../entities/escrow-account.entity';
import { EscrowClaimsFreeze } from '../../entities/escrow-claims-freeze.entity';
import { EscrowSigner } from '../../entities/escrow-signer.entity';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { EscrowBucket } from '../../enums/escrow-bucket.enum';
import { escrowUnfrozenSeconds } from '../../queries/escrow-unfrozen-time.query';
import type {
	EscrowIdentity,
	EscrowLog,
	EscrowLogOf,
	ProjectedEscrowEvent,
} from '../../types/escrow.types';
import {
	accountBlocked,
	blockReasonOf,
} from '../../utils/escrow/account-block.util';
import {
	projectAutoTopUpDisabled,
	projectAutoTopUpExecuted,
	projectAutoTopUpSet,
} from '../../utils/escrow/auto-top-up-projection.util';
import { nextClaimsFreeze } from '../../utils/escrow/claims-freeze.util';
import { microUsd, minBigInt } from '../../utils/escrow/escrow-amount.util';
import { chainTimestamp } from '../../utils/escrow/escrow-event-record.util';
import {
	adjustAmount,
	blockedMovements,
	creditBucket,
	movement,
	pairedMovements,
	projected,
	signerHostRestriction,
} from '../../utils/escrow/escrow-projection.util';
import {
	chargedSignerBudget,
	grantedSignerBudget,
	loweringScheduledSignerBudget,
	raisedSignerBudget,
} from '../../utils/escrow/signer-budget.util';

const ZERO = '0';

const EMPTY_ACCOUNT = {
	freeMicroUsd: ZERO,
	pendingMicroUsd: ZERO,
	withdrawalUnlockAt: null,
	hostBalanceMicroUsd: ZERO,
	hostWithdrawnMicroUsd: ZERO,
	feesAccruedMicroUsd: ZERO,
	frozenMicroUsd: ZERO,
	blockedAt: null,
	blockedUntil: null,
	blockReason: null,
	payoutAddress: null,
} as const;

@Injectable()
export class EscrowProjectionService {
	async apply(
		manager: EntityManager,
		escrow: EscrowIdentity,
		log: EscrowLog,
		blockTimestamp: Date
	): Promise<ProjectedEscrowEvent> {
		const context: ProjectionContext = {
			manager,
			escrow,
			blockTimestamp,
			unfrozenAt: () => escrowUnfrozenSeconds(manager, escrow, blockTimestamp),
		};
		switch (log.eventName) {
			case 'Deposited':
				return this.deposited(context, log);
			case 'WithdrawalRequested':
				return this.withdrawalRequested(context, log);
			case 'WithdrawalCancelled':
				return this.withdrawalCancelled(context, log);
			case 'Withdrawn':
				return this.withdrawn(context, log);
			case 'Claimed':
				return this.claimed(context, log);
			case 'ClaimResult':
				return this.channelParties(context, log.args.channelId);
			case 'SignerAuthorized':
				return this.signerAuthorized(context, log);
			case 'SignerLimitRaised':
				return this.signerLimitRaised(context, log);
			case 'SignerLimitLowerScheduled':
				return this.signerLimitLowerScheduled(context, log);
			case 'ClaimsFrozen':
				return this.claimsFrozen(context, log);
			case 'SignerThawed':
				return this.signerThawed(context, log);
			case 'SignerRevoked':
				return this.signerRevoked(context, log);
			case 'PayoutAddressSet':
				return this.payoutAddressSet(context, log);
			case 'HostWithdrawn':
				return this.hostWithdrawn(context, log);
			case 'FeesSwept':
				return this.feesSwept(context, log);
			case 'AccountBlocked':
				return this.accountBlocked(context, log);
			case 'AccountUnblocked':
				return this.accountUnblocked(context, log);
			case 'Frozen':
				return this.frozen(context, log);
			case 'FrozenReleased':
				return this.frozenReleased(context, log);
			case 'AutoTopUpSet':
				await projectAutoTopUpSet(manager, escrow, log);
				return projected({ customerAddress: log.args.customer });
			case 'AutoTopUpDisabled':
				await projectAutoTopUpDisabled(manager, escrow, log);
				return projected({ customerAddress: log.args.customer });
			case 'AutoTopUpExecuted':
				await projectAutoTopUpExecuted(manager, escrow, log, blockTimestamp);
				return projected({ customerAddress: log.args.customer });
			default:
				return projected();
		}
	}

	private async deposited(
		context: ProjectionContext,
		log: EscrowLogOf<'Deposited'>
	): Promise<ProjectedEscrowEvent> {
		const { customer, amount } = log.args;
		adjustAmount(await this.account(context, customer), 'freeMicroUsd', amount);
		return projected({
			customerAddress: customer,
			movements: movement(EscrowBucket.EXTERNAL, EscrowBucket.FREE, amount),
		});
	}

	private async withdrawalRequested(
		context: ProjectionContext,
		log: EscrowLogOf<'WithdrawalRequested'>
	): Promise<ProjectedEscrowEvent> {
		const { account: address, amount, pending, unlockAt } = log.args;
		const account = await this.account(context, address);
		adjustAmount(account, 'freeMicroUsd', -amount);
		account.pendingMicroUsd = pending.toString();
		account.withdrawalUnlockAt = chainTimestamp(unlockAt);
		return projected({
			customerAddress: address,
			movements: movement(EscrowBucket.FREE, EscrowBucket.PENDING, amount),
		});
	}

	private async withdrawalCancelled(
		context: ProjectionContext,
		log: EscrowLogOf<'WithdrawalCancelled'>
	): Promise<ProjectedEscrowEvent> {
		const { account: address, amount } = log.args;
		const account = await this.account(context, address);
		adjustAmount(account, 'freeMicroUsd', amount);
		account.pendingMicroUsd = ZERO;
		account.withdrawalUnlockAt = null;
		return projected({
			customerAddress: address,
			movements: movement(EscrowBucket.PENDING, EscrowBucket.FREE, amount),
		});
	}

	private async withdrawn(
		context: ProjectionContext,
		log: EscrowLogOf<'Withdrawn'>
	): Promise<ProjectedEscrowEvent> {
		const { account: address, amount } = log.args;
		const account = await this.account(context, address);
		adjustAmount(account, 'pendingMicroUsd', -amount);
		account.withdrawalUnlockAt = null;
		return projected({
			customerAddress: address,
			movements: movement(EscrowBucket.PENDING, EscrowBucket.EXTERNAL, amount),
		});
	}

	private async claimed(
		context: ProjectionContext,
		log: EscrowLogOf<'Claimed'>
	): Promise<ProjectedEscrowEvent> {
		const { channelId, customer, host, signer, feeReceiver, paid, fee } =
			log.args;
		const channel = await this.channel(context, channelId);
		if (channel) {
			if (fee !== feeOf(paid, channel.feeBps)) {
				throw new Error(
					`Claim on channel ${channelId} reports a fee of ${fee}, not ${channel.feeBps} basis points of ${paid}`
				);
			}
			channel.claimedMicroUsd = log.args.claimed.toString();
			channel.lastClaimedAt = context.blockTimestamp;
		}
		if (!isAddressEqual(signer, customer)) {
			const grant = await this.signer(context, signer);
			if (grant) {
				context.manager.assign(
					grant,
					chargedSignerBudget(grant, paid, await context.unfrozenAt())
				);
			}
		}
		const payer = await this.account(context, customer);
		const fromFree = minBigInt(paid, microUsd(payer.freeMicroUsd));
		adjustAmount(payer, 'freeMicroUsd', -fromFree);
		adjustAmount(payer, 'pendingMicroUsd', fromFree - paid);
		const hostAccount = await this.account(context, host);
		const hostBucket = creditBucket(
			hostAccount,
			EscrowBucket.HOST_CREDITED,
			context.blockTimestamp
		);
		if (hostBucket === EscrowBucket.HOST_CREDITED) {
			adjustAmount(hostAccount, 'hostBalanceMicroUsd', paid - fee);
		}
		const receiver = await this.account(context, feeReceiver);
		const feeBucket = creditBucket(
			receiver,
			EscrowBucket.FEES_ACCRUED,
			context.blockTimestamp
		);
		if (feeBucket === EscrowBucket.FEES_ACCRUED) {
			adjustAmount(receiver, 'feesAccruedMicroUsd', fee);
		}
		return projected({
			customerAddress: customer,
			hostAddress: host,
			channelId,
			movements: pairedMovements(
				[
					{ bucket: EscrowBucket.FREE, amount: fromFree },
					{ bucket: EscrowBucket.PENDING, amount: paid - fromFree },
				],
				[
					{ bucket: hostBucket, amount: paid - fee },
					{ bucket: feeBucket, amount: fee },
				]
			),
		});
	}

	private async signerAuthorized(
		context: ProjectionContext,
		log: EscrowLogOf<'SignerAuthorized'>
	): Promise<ProjectedEscrowEvent> {
		const { customer, signer } = log.args;
		context.manager.create(EscrowSigner, {
			...context.escrow,
			signerAddress: signer,
			customerAddress: customer,
			...grantedSignerBudget(log.args.hourlyCap, await context.unfrozenAt()),
			expiresAt: chainTimestamp(log.args.expiry),
			maxFeeBps: log.args.maxFeeBps,
			hostAddress: signerHostRestriction(log.args.host),
			thawEndsAt: null,
			revokedAt: null,
		});
		await context.manager.flush();
		return projected({ customerAddress: customer });
	}

	private async signerLimitRaised(
		context: ProjectionContext,
		log: EscrowLogOf<'SignerLimitRaised'>
	): Promise<ProjectedEscrowEvent> {
		const { customer, signer, hourlyCap, expiry } = log.args;
		const grant = await this.requiredSigner(context, signer);
		context.manager.assign(grant, {
			...raisedSignerBudget(grant, hourlyCap, await context.unfrozenAt()),
			expiresAt: chainTimestamp(expiry),
		});
		return projected({ customerAddress: customer });
	}

	private async signerLimitLowerScheduled(
		context: ProjectionContext,
		log: EscrowLogOf<'SignerLimitLowerScheduled'>
	): Promise<ProjectedEscrowEvent> {
		const { customer, signer, hourlyCap, effectiveAt } = log.args;
		const grant = await this.requiredSigner(context, signer);
		context.manager.assign(
			grant,
			loweringScheduledSignerBudget(
				grant,
				hourlyCap,
				effectiveAt,
				await context.unfrozenAt()
			)
		);
		return projected({ customerAddress: customer });
	}

	private async claimsFrozen(
		{ manager, escrow, blockTimestamp }: ProjectionContext,
		log: EscrowLogOf<'ClaimsFrozen'>
	): Promise<ProjectedEscrowEvent> {
		const existing = await manager.findOne(EscrowClaimsFreeze, { ...escrow });
		const freeze = nextClaimsFreeze(
			existing,
			blockTimestamp,
			chainTimestamp(log.args.until)
		);
		if (existing) {
			manager.assign(existing, freeze);
		} else {
			manager.create(EscrowClaimsFreeze, { ...escrow, ...freeze });
		}
		await manager.flush();
		return projected();
	}

	private async signerThawed(
		context: ProjectionContext,
		log: EscrowLogOf<'SignerThawed'>
	): Promise<ProjectedEscrowEvent> {
		const grant = await this.requiredSigner(context, log.args.signer);
		grant.thawEndsAt = chainTimestamp(log.args.thawEnd);
		return projected({ customerAddress: log.args.customer });
	}

	private async signerRevoked(
		context: ProjectionContext,
		log: EscrowLogOf<'SignerRevoked'>
	): Promise<ProjectedEscrowEvent> {
		const grant = await this.requiredSigner(context, log.args.signer);
		grant.revokedAt = context.blockTimestamp;
		return projected({ customerAddress: log.args.customer });
	}

	private async payoutAddressSet(
		context: ProjectionContext,
		log: EscrowLogOf<'PayoutAddressSet'>
	): Promise<ProjectedEscrowEvent> {
		const { host, payout } = log.args;
		(await this.account(context, host)).payoutAddress = payout;
		return projected({ hostAddress: host });
	}

	private async hostWithdrawn(
		context: ProjectionContext,
		log: EscrowLogOf<'HostWithdrawn'>
	): Promise<ProjectedEscrowEvent> {
		const { host, amount } = log.args;
		const account = await this.account(context, host);
		const balance = microUsd(account.hostBalanceMicroUsd);
		if (balance < amount) {
			throw new Error(
				`Host ${host} withdrew ${amount} with ${balance} credited`
			);
		}
		account.hostBalanceMicroUsd = ZERO;
		adjustAmount(account, 'hostWithdrawnMicroUsd', amount);
		return projected({
			hostAddress: host,
			movements: movement(
				EscrowBucket.HOST_CREDITED,
				EscrowBucket.EXTERNAL,
				balance
			),
		});
	}

	private async feesSwept(
		context: ProjectionContext,
		log: EscrowLogOf<'FeesSwept'>
	): Promise<ProjectedEscrowEvent> {
		const { feeReceiver, amount } = log.args;
		adjustAmount(
			await this.account(context, feeReceiver),
			'feesAccruedMicroUsd',
			-amount
		);
		return projected({
			movements: movement(
				EscrowBucket.FEES_ACCRUED,
				EscrowBucket.EXTERNAL,
				amount
			),
		});
	}

	private async accountBlocked(
		context: ProjectionContext,
		log: EscrowLogOf<'AccountBlocked'>
	): Promise<ProjectedEscrowEvent> {
		const { account: address, blockedAt, until, reason } = log.args;
		const account = await this.account(context, address);
		const block = {
			blockedAt: chainTimestamp(blockedAt),
			blockedUntil: chainTimestamp(until),
			blockReason: blockReasonOf(reason),
		};
		if (accountBlocked(account, context.blockTimestamp)) {
			context.manager.assign(account, block);
			return projected({ customerAddress: address, hostAddress: address });
		}
		const movements = blockedMovements(account);
		context.manager.assign(account, {
			...block,
			freeMicroUsd: ZERO,
			pendingMicroUsd: ZERO,
			withdrawalUnlockAt: null,
			hostBalanceMicroUsd: ZERO,
			feesAccruedMicroUsd: ZERO,
		});
		return projected({
			customerAddress: address,
			hostAddress: address,
			movements,
		});
	}

	private async accountUnblocked(
		context: ProjectionContext,
		log: EscrowLogOf<'AccountUnblocked'>
	): Promise<ProjectedEscrowEvent> {
		const address = log.args.account;
		context.manager.assign(await this.account(context, address), {
			blockedAt: null,
			blockedUntil: null,
			blockReason: null,
		});
		return projected({ customerAddress: address, hostAddress: address });
	}

	private async frozen(
		context: ProjectionContext,
		log: EscrowLogOf<'Frozen'>
	): Promise<ProjectedEscrowEvent> {
		const address = log.args.account;
		adjustAmount(
			await this.account(context, address),
			'frozenMicroUsd',
			log.args.amount
		);
		return projected({ customerAddress: address, hostAddress: address });
	}

	private async frozenReleased(
		context: ProjectionContext,
		log: EscrowLogOf<'FrozenReleased'>
	): Promise<ProjectedEscrowEvent> {
		const { account: address, amount } = log.args;
		const account = await this.account(context, address);
		adjustAmount(account, 'frozenMicroUsd', -amount);
		adjustAmount(account, 'freeMicroUsd', amount);
		return projected({
			customerAddress: address,
			hostAddress: address,
			movements: movement(EscrowBucket.FROZEN, EscrowBucket.FREE, amount),
		});
	}

	private channel(
		{ manager, escrow }: ProjectionContext,
		channelId: Hex
	): Promise<PaymentChannel | null> {
		return manager.findOne(PaymentChannel, { ...escrow, channelId });
	}

	private async channelParties(
		context: ProjectionContext,
		channelId: Hex
	): Promise<ProjectedEscrowEvent> {
		const channel = await this.channel(context, channelId);
		return projected({
			customerAddress: channel?.customerAddress ?? null,
			hostAddress: channel?.hostAddress ?? null,
			channelId,
		});
	}

	private async account(
		{ manager, escrow }: ProjectionContext,
		address: Address
	): Promise<EscrowAccount> {
		const existing = await manager.findOne(EscrowAccount, {
			...escrow,
			address,
		});
		if (existing) return existing;
		const created = manager.create(EscrowAccount, {
			...escrow,
			address,
			...EMPTY_ACCOUNT,
		});
		await manager.flush();
		return created;
	}

	private signer(
		{ manager, escrow }: ProjectionContext,
		signerAddress: Address
	): Promise<EscrowSigner | null> {
		return manager.findOne(EscrowSigner, { ...escrow, signerAddress });
	}

	private async requiredSigner(
		context: ProjectionContext,
		signerAddress: Address
	): Promise<EscrowSigner> {
		const grant = await this.signer(context, signerAddress);
		if (!grant) {
			throw new Error(`Escrow signer ${signerAddress} was never authorized`);
		}
		return grant;
	}
}

interface ProjectionContext {
	manager: EntityManager;
	escrow: EscrowIdentity;
	blockTimestamp: Date;
	unfrozenAt: () => Promise<bigint>;
}

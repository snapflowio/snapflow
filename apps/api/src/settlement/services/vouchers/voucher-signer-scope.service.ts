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
import { type Address, isAddressEqual } from 'viem';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { EscrowSigner } from '../../entities/escrow-signer.entity';
import type { PaymentChannel } from '../../entities/payment-channel.entity';
import { VoucherLimit } from '../../enums/voucher-limit.enum';
import { VoucherSigningMode } from '../../enums/voucher-signing-mode.enum';
import { activeDelegatedSigner } from '../../queries/delegated-signer.query';
import { escrowUnfrozenSeconds } from '../../queries/escrow-unfrozen-time.query';
import { signerOutstanding } from '../../queries/signer-outstanding.query';
import type {
	AdmissionSignerLimit,
	AdmissionVoucherLimit,
} from '../../types/automatic-payments.types';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import {
	signerAvailableNow,
	signerHourlyCapNow,
} from '../../utils/escrow/signer-budget.util';
import { channelBound } from '../../utils/vouchers/voucher-limit.util';

interface VoucherSignerScope {
	bound: bigint | null;
	unusable: VoucherLimit | null;
}

type GrantParties = Pick<
	PaymentChannel,
	'chainId' | 'contractAddress' | 'customerAddress'
>;

interface AdmissionTerms {
	customerAddress: Address;
	at: Date;
	feeBps: number;
	hourlySpendMicroUsd: bigint;
}

const UNCAPPED: VoucherSignerScope = { bound: null, unusable: null };

const unusable = (limit: VoucherLimit): VoucherSignerScope => ({
	bound: null,
	unusable: limit,
});

const SigningWhileThawing = { REFUSED: false, ALLOWED: true } as const;

type GrantCheck =
	| { usable: EscrowSigner; limit: null }
	| { usable: null; limit: AdmissionVoucherLimit };

function checkGrant(
	grant: EscrowSigner | null,
	at: Date,
	signsWhileThawing: boolean
): GrantCheck {
	if (!grant) return { usable: null, limit: VoucherLimit.SIGNER_MISSING };
	if (grant.revokedAt) {
		return { usable: null, limit: VoucherLimit.SIGNER_REVOKED };
	}
	if (grant.thawEndsAt && !signsWhileThawing) {
		return { usable: null, limit: VoucherLimit.SIGNER_THAWING };
	}
	if (at >= grant.expiresAt) {
		return { usable: null, limit: VoucherLimit.SIGNER_EXPIRED };
	}
	return { usable: grant, limit: null };
}

@Injectable()
export class VoucherSignerScopeService {
	constructor(private readonly config: TypedConfigService) {}

	async forIssuance(
		manager: EntityManager,
		channel: PaymentChannel,
		at: Date,
		claimed: bigint
	): Promise<VoucherSignerScope> {
		if (channel.signingMode !== VoucherSigningMode.DELEGATED) return UNCAPPED;
		const delegated = await activeDelegatedSigner(
			manager,
			channel,
			channel.customerAddress
		);
		if (!delegated) return unusable(VoucherLimit.SIGNER_MISSING);
		return this.scope(
			manager,
			channel,
			checkGrant(
				await this.grant(manager, channel, delegated.signerAddress),
				at,
				SigningWhileThawing.REFUSED
			),
			at,
			claimed
		);
	}

	async forSubmission(
		manager: EntityManager,
		channel: PaymentChannel,
		signerAddress: Address,
		at: Date,
		claimed: bigint
	): Promise<VoucherSignerScope> {
		return this.scope(
			manager,
			channel,
			checkGrant(
				await this.grant(manager, channel, signerAddress),
				at,
				SigningWhileThawing.ALLOWED
			),
			at,
			claimed
		);
	}

	async forAdmission(
		manager: EntityManager,
		terms: AdmissionTerms
	): Promise<AdmissionSignerLimit | null> {
		const escrow = configuredEscrow(this.config);
		const parties = { ...escrow, customerAddress: terms.customerAddress };
		const delegated = await activeDelegatedSigner(
			manager,
			escrow,
			terms.customerAddress
		);
		const grant = delegated
			? await this.grant(manager, parties, delegated.signerAddress)
			: null;
		const check = checkGrant(grant, terms.at, SigningWhileThawing.REFUSED);
		if (check.limit !== null) {
			return { limit: check.limit, grant, hourlyCapMicroUsd: null };
		}
		const usable = check.usable;
		if (terms.feeBps > usable.maxFeeBps || usable.hostAddress !== null) {
			return {
				limit: VoucherLimit.SIGNER_SCOPE,
				grant,
				hourlyCapMicroUsd: null,
			};
		}
		const hourlyCap = signerHourlyCapNow(
			usable,
			await escrowUnfrozenSeconds(manager, escrow, terms.at)
		);
		return hourlyCap < terms.hourlySpendMicroUsd
			? {
					limit: VoucherLimit.SIGNER_CAP,
					grant,
					hourlyCapMicroUsd: hourlyCap,
				}
			: null;
	}

	private grant(
		manager: EntityManager,
		parties: GrantParties,
		signerAddress: Address
	): Promise<EscrowSigner | null> {
		return manager.findOne(EscrowSigner, {
			chainId: parties.chainId,
			contractAddress: parties.contractAddress,
			signerAddress,
			customerAddress: parties.customerAddress,
		});
	}

	private async scope(
		manager: EntityManager,
		channel: PaymentChannel,
		check: GrantCheck,
		at: Date,
		claimed: bigint
	): Promise<VoucherSignerScope> {
		if (check.limit !== null) return unusable(check.limit);
		const grant = check.usable;
		if (
			channel.feeBps > grant.maxFeeBps ||
			(grant.hostAddress !== null &&
				!isAddressEqual(grant.hostAddress, channel.hostAddress))
		) {
			return unusable(VoucherLimit.SIGNER_SCOPE);
		}
		const outstanding = await signerOutstanding(
			manager,
			channel,
			grant.signerAddress,
			channel.id
		);
		const available = signerAvailableNow(
			grant,
			await escrowUnfrozenSeconds(manager, channel, at)
		);
		return {
			bound: channelBound(available, outstanding, claimed),
			unusable: null,
		};
	}
}

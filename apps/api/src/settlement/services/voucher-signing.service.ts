/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import { recoverVoucherSigner, voucherTypedData } from '@snapflow/contracts';
import { type Address, type Hex, isAddressEqual } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { SETTLEMENT_SESSION_KEY_LOCK_NAMESPACE } from '../../common/constants/advisory-lock.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import { lockAdvisoryKey } from '../../infra/database/utils/advisory-lock.util';
import { SETTLEMENT_VOUCHER_WAKE_TOPIC } from '../constants/payment-channel.constants';
import { SETTLEMENT_VOUCHER_SIGNER } from '../constants/settlement.constants';
import { EscrowSessionKey } from '../entities/escrow-session-key.entity';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import { VoucherRejection } from '../enums/voucher-rejection.enum';
import { sessionExposures } from '../queries/session-exposures.query';
import type { EscrowIdentity } from '../types/escrow.types';
import {
	sessionCommitment,
	sessionSpendRejection,
} from '../utils/session-allowance.util';
import { storedAmounts, voucherTotal } from '../utils/voucher-amounts.util';
import { channelDomain, voucherMessage } from '../utils/voucher-message.util';
import { signatureRejection } from '../utils/voucher-signature.util';

// Signs vouchers with Snapflow's delegated signer and accepts the
// signatures customers submit, refusing anything the escrow would refuse to
// pay. Both run under a per-customer lock, because a session key's limits
// are shared by all of its customer's channels.
@Injectable()
export class VoucherSigningService {
	constructor(
		@Inject(SETTLEMENT_VOUCHER_SIGNER)
		private readonly signer: PrivateKeyAccount,
		private readonly wakes: ControlWakeService
	) {}

	get signerAddress(): Address {
		return this.signer.address;
	}

	// The customer's session key for Snapflow's signer, while it can sign.
	delegatedKey(
		manager: EntityManager,
		customer: EscrowIdentity & Pick<PaymentChannel, 'customerAddress'>,
		now: Date
	): Promise<EscrowSessionKey | null> {
		return manager.findOne(EscrowSessionKey, {
			chainId: customer.chainId,
			contractAddress: customer.contractAddress,
			customerAddress: customer.customerAddress,
			keyAddress: this.signer.address,
			revokedAt: null,
			expiresAt: { $gte: now },
		});
	}

	// Leaves the voucher unsigned, with the reason on the channel, when the
	// customer granted no key or the voucher would exceed its limits.
	async signDelegated(
		manager: EntityManager,
		channel: PaymentChannel,
		voucher: PaymentVoucher,
		key: EscrowSessionKey | null,
		now: Date
	): Promise<void> {
		if (key === null) {
			channel.voucherError = VoucherRejection.SIGNER_NOT_AUTHORIZED;
			return;
		}
		await this.lockCustomer(manager, channel);
		const rejection = sessionSpendRejection(
			key,
			await this.committed(manager, channel, voucher, key),
			now
		);
		if (rejection !== null) {
			channel.voucherError = rejection;
			return;
		}
		const signature = await this.signer.signTypedData(
			voucherTypedData(channelDomain(channel), voucherMessage(channel, voucher))
		);
		this.record(manager, channel, voucher, {
			signerAddress: this.signer.address,
			signature,
			signedAt: now,
			claimableUntil: voucher.expiresAt,
		});
	}

	// Stores a signature the customer's SDK or agent submitted, or says why
	// the escrow would refuse it.
	async acceptSignature(
		manager: EntityManager,
		channel: PaymentChannel,
		voucher: PaymentVoucher,
		submitted: { signerAddress: Address; signature: Hex },
		now: Date
	): Promise<VoucherRejection | null> {
		const recoveredAddress = await this.recover(channel, voucher, submitted);
		if (recoveredAddress === null) return VoucherRejection.SIGNATURE_INVALID;
		await this.lockCustomer(manager, channel);
		const sessionKey = isAddressEqual(
			submitted.signerAddress,
			channel.customerAddress
		)
			? null
			: await manager.findOne(EscrowSessionKey, {
					chainId: channel.chainId,
					contractAddress: channel.contractAddress,
					customerAddress: channel.customerAddress,
					keyAddress: submitted.signerAddress,
				});
		const rejection = signatureRejection({
			customerAddress: channel.customerAddress,
			signerAddress: submitted.signerAddress,
			recoveredAddress,
			sessionKey,
			committedMicroUsd: sessionKey
				? await this.committed(manager, channel, voucher, sessionKey)
				: MicroUsd.ZERO,
			now,
		});
		if (rejection !== null) return rejection;
		this.record(manager, channel, voucher, {
			signerAddress: submitted.signerAddress,
			signature: submitted.signature,
			signedAt: now,
			claimableUntil:
				sessionKey && sessionKey.expiresAt < voucher.expiresAt
					? sessionKey.expiresAt
					: voucher.expiresAt,
		});
		if (voucher.issuedAt > channel.coveredAt) {
			channel.coveredAt = voucher.issuedAt;
		}
		return null;
	}

	private record(
		manager: EntityManager,
		channel: PaymentChannel,
		voucher: PaymentVoucher,
		signed: Pick<
			PaymentVoucher,
			'signerAddress' | 'signature' | 'signedAt' | 'claimableUntil'
		>
	): void {
		manager.assign(voucher, signed);
		channel.voucherError = null;
		// Only a lease's machine enforces its vouchers.
		if (channel.machineId !== null) {
			this.wakes.notifyAfterCommit(manager, SETTLEMENT_VOUCHER_WAKE_TOPIC, [
				channel.machineId,
			]);
		}
	}

	private async committed(
		manager: EntityManager,
		channel: PaymentChannel,
		voucher: PaymentVoucher,
		key: EscrowSessionKey
	): Promise<MicroUsd> {
		const exposures = await sessionExposures(manager, channel, key, channel);
		const current = exposures.find(
			(exposure) => exposure.paymentChannelId === channel.id
		);
		if (!current) {
			throw new Error(`Channel ${channel.channelId} has no session exposure`);
		}
		return sessionCommitment(exposures, {
			...current,
			signedMicroUsd: voucherTotal(storedAmounts(voucher)),
		});
	}

	// Recovery is pure computation over the stored voucher and the submitted
	// bytes; the curve library rejects a malformed signature (wrong length, r
	// or s out of range, bad recovery byte) with a plain Error, which only says
	// the submission is invalid.
	private async recover(
		channel: PaymentChannel,
		voucher: PaymentVoucher,
		submitted: { signature: Hex }
	): Promise<Address | null> {
		try {
			return await recoverVoucherSigner(
				channelDomain(channel),
				voucherMessage(channel, voucher),
				submitted.signature
			);
		} catch (error) {
			if (error instanceof Error) return null;
			throw error;
		}
	}

	private lockCustomer(
		manager: EntityManager,
		channel: PaymentChannel
	): Promise<void> {
		return lockAdvisoryKey(
			manager,
			`${channel.chainId}:${channel.contractAddress}:${channel.customerAddress}`,
			SETTLEMENT_SESSION_KEY_LOCK_NAMESPACE
		);
	}
}

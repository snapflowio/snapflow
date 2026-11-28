/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
	escrowDomain,
	hashSignerProof,
	signerProofMessage,
	snapflowEscrowAbi,
	type Voucher,
	voucherTypedData,
} from '@snapflow/contracts';
import {
	type Address,
	type Hex,
	isAddressEqual,
	type PublicClient,
	zeroAddress,
} from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';
import { DelegatedSigner } from '../../entities/delegated-signer.entity';
import { EscrowSigner } from '../../entities/escrow-signer.entity';
import { SignatureAudit } from '../../entities/signature-audit.entity';
import { SignatureAuditKind } from '../../enums/signature-audit-kind.enum';
import { activeDelegatedSigner } from '../../queries/delegated-signer.query';
import { escrowUnfrozenSeconds } from '../../queries/escrow-unfrozen-time.query';
import type { VoucherEvidence } from '../../types/payment-channel.types';
import { withSettlementChain } from '../../utils/chain-error.util';
import { delegatedSignerSpent } from '../../utils/delegated-signer/delegated-signer.util';
import { chainTimestamp } from '../../utils/escrow/escrow-event-record.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { ChainClockService } from '../escrow/chain-clock.service';
import { DelegatedSignerKeyService } from './delegated-signer-key.service';

export interface EnsuredDelegatedSigner {
	signer: DelegatedSigner;
	bound: boolean;
}

export interface SignedVoucherRecord {
	voucherId: string;
	digest: Hex;
	message: Voucher;
	evidence: VoucherEvidence;
}

@Injectable()
export class DelegatedSignerService {
	private readonly logger = new Logger(DelegatedSignerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly keys: DelegatedSignerKeyService,
		private readonly config: TypedConfigService,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly chainClock: ChainClockService
	) {}

	forCustomer(
		manager: EntityManager,
		customerAddress: Address
	): Promise<DelegatedSigner | null> {
		return activeDelegatedSigner(
			manager,
			configuredEscrow(this.config),
			customerAddress
		);
	}

	async ensure(
		organizationId: string,
		customerAddress: Address
	): Promise<EnsuredDelegatedSigner> {
		const manager = this.entityManager.fork();
		const active = await this.forCustomer(manager, customerAddress);
		if (active) {
			const grant = await this.grant(manager, active);
			const chainNow = await this.chainClock.now();
			const unfrozenNow = chainTimestamp(
				await escrowUnfrozenSeconds(manager, active, chainNow)
			);
			if (!delegatedSignerSpent(grant, unfrozenNow, chainNow)) {
				return {
					signer: active,
					bound: grant !== null || (await this.boundOnChain(active)),
				};
			}
		}
		return {
			signer: await this.rotate(organizationId, customerAddress, active),
			bound: false,
		};
	}

	private async boundOnChain(signer: DelegatedSigner): Promise<boolean> {
		const grant = await withSettlementChain(this.logger, () =>
			this.client.readContract({
				address: signer.contractAddress,
				abi: snapflowEscrowAbi,
				functionName: 'signerOf',
				args: [signer.signerAddress],
			})
		);
		return !isAddressEqual(grant.customer, zeroAddress);
	}

	private async rotate(
		organizationId: string,
		customerAddress: Address,
		active: DelegatedSigner | null
	): Promise<DelegatedSigner> {
		const manager = this.entityManager.fork();
		const key = await this.keys.generate();
		try {
			return await manager.transactional(async (transaction) => {
				if (active) {
					await transaction.nativeUpdate(
						DelegatedSigner,
						{ id: active.id, retiredAt: null },
						{ retiredAt: await databaseNow(transaction) }
					);
				}
				const created = transaction.create(DelegatedSigner, {
					...configuredEscrow(this.config),
					organizationId,
					customerAddress,
					signerAddress: key.address,
					encryptedPrivateKey: key.ciphertext,
					retiredAt: null,
				});
				await transaction.flush();
				return created;
			});
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			const winner = await this.forCustomer(
				this.entityManager.fork(),
				customerAddress
			);
			if (!winner) throw error;
			return winner;
		}
	}

	grant(
		manager: EntityManager,
		signer: DelegatedSigner
	): Promise<EscrowSigner | null> {
		return manager.findOne(EscrowSigner, {
			chainId: signer.chainId,
			contractAddress: signer.contractAddress,
			signerAddress: signer.signerAddress,
		});
	}

	async signProof(
		manager: EntityManager,
		signer: DelegatedSigner,
		proofDeadline: bigint,
		signedAt: Date
	): Promise<Hex> {
		const domain = this.domain();
		const proof = await this.sign(signer, (account) =>
			account.signMessage({
				message: signerProofMessage(
					domain,
					proofDeadline,
					signer.customerAddress
				),
			})
		);
		manager.create(SignatureAudit, {
			delegatedSignerId: signer.id,
			kind: SignatureAuditKind.SIGNER_PROOF,
			digest: hashSignerProof(domain, proofDeadline, signer.customerAddress),
			voucherId: null,
			evidence: {
				customerAddress: signer.customerAddress,
				proofDeadline: proofDeadline.toString(),
			},
			signedAt,
		});
		return proof;
	}

	async signVoucher(
		manager: EntityManager,
		signer: DelegatedSigner,
		record: SignedVoucherRecord,
		signedAt: Date
	): Promise<Hex> {
		const signature = await this.sign(signer, (account) =>
			account.signTypedData(voucherTypedData(this.domain(), record.message))
		);
		manager.create(SignatureAudit, {
			delegatedSignerId: signer.id,
			kind: SignatureAuditKind.VOUCHER,
			digest: record.digest,
			voucherId: record.voucherId,
			evidence: record.evidence,
			signedAt,
		});
		return signature;
	}

	private sign(
		signer: DelegatedSigner,
		use: (account: PrivateKeyAccount) => Promise<Hex>
	): Promise<Hex> {
		return this.keys.withAccount(signer.encryptedPrivateKey, (account) => {
			if (!isAddressEqual(account.address, signer.signerAddress)) {
				throw new Error(
					`Delegated signer ${signer.signerAddress} decrypted to another key`
				);
			}
			return use(account);
		});
	}

	private domain() {
		const escrow = configuredEscrow(this.config);
		return escrowDomain(escrow.chainId, escrow.contractAddress);
	}
}

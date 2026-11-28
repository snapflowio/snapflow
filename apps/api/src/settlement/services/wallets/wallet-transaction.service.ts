/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import {
	batchedSafeCall,
	decodeWebAuthnSignature,
	feePaidSafeCall,
	hashSafeTransaction,
	relayedSafeTransaction,
	type SafeCall,
	type SafeTransaction,
	safeCallBatch,
	safeContractSignature,
	type WalletFeeBatch,
	walletFeeBatch,
} from '@snapflow/contracts';
import {
	type Address,
	getAddress,
	type Hash,
	type Hex,
	isAddressEqual,
} from 'viem';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import {
	hasAcceptedTerms,
	type TermsActor,
	termsAcceptanceRequired,
} from '../../../legal/utils/terms-acceptance.util';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	UserWalletErrorCode,
	WALLET_TRANSACTION_LIMITS,
} from '../../constants/user-wallet.constants';
import { PreparedWalletTransactionDto } from '../../dto/wallet-transaction.dto';
import { UserWallet } from '../../entities/user-wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { RecoveryStatus } from '../../enums/recovery-status.enum';
import { SanctionsStatus } from '../../enums/sanctions-status.enum';
import { WalletTransactionStatus } from '../../enums/wallet-transaction-status.enum';
import { snapflowControlledAmong } from '../../queries/snapflow-controlled-addresses.query';
import { withSettlementChain } from '../../utils/chain-error.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import {
	type WalletCallContext,
	type WalletCallRefusal,
	walletCallNewOwners,
	walletCallRefusal,
} from '../../utils/wallets/wallet-call-policy.util';
import { walletCallCounterparties } from '../../utils/wallets/wallet-counterparties.util';
import type { WalletCallTargets } from '../../utils/wallets/wallet-decoded-calls.util';
import { isWalletExitCall } from '../../utils/wallets/wallet-exit-call.util';
import type { RecoveryOwner } from '../../utils/wallets/wallet-recovery.util';
import {
	nextSafeNonce,
	type PasskeySigner,
	type RelayCall,
	transactionSignerColumns,
	walletRelayCall,
} from '../../utils/wallets/wallet-relay-call.util';
import { DelegatedSignerService } from '../delegated-signer/delegated-signer.service';
import {
	SafeWalletChainService,
	type SafeWalletState,
} from './safe-wallet-chain.service';
import { SanctionsScreeningService } from './sanctions-screening.service';
import { UserWalletService } from './user-wallet.service';
import { WalletFeeService } from './wallet-fee.service';

const FEE_INVALID: WalletCallRefusal = {
	code: UserWalletErrorCode.FEE_INVALID,
	message:
		"The transaction is not a batch ending in its USDC fee to Snapflow's relayer; prepare it again",
};

const OPEN_STATUSES = [
	WalletTransactionStatus.QUEUED,
	WalletTransactionStatus.SENT,
] as const;

interface WalletSubmission {
	call: SafeCall;
	nonce: bigint;
	signature: Hex;
	signingPasskeyId?: string;
}

import { walletOwnerId } from '../../utils/wallets/user-wallet-owner.util';

@Injectable()
export class WalletTransactionService {
	private readonly logger = new Logger(WalletTransactionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly wallets: UserWalletService,
		private readonly chain: SafeWalletChainService,
		private readonly fees: WalletFeeService,
		private readonly settings: SettingsService,
		private readonly config: TypedConfigService,
		private readonly delegatedSigners: DelegatedSignerService,
		private readonly sanctions: SanctionsScreeningService
	) {}

	async refusal(
		wallet: UserWallet,
		call: SafeCall,
		owners: readonly Address[]
	): Promise<WalletCallRefusal | null> {
		const batch = this.feeBatch(call);
		return batch
			? this.callRefusal(wallet, batchedSafeCall(batch.calls), owners)
			: FEE_INVALID;
	}

	feePaid(call: SafeCall, feeMicroUsd: bigint): SafeCall {
		return feePaidSafeCall(safeCallBatch(call), this.fees.payee(), feeMicroUsd);
	}

	private feeBatch(call: SafeCall): WalletFeeBatch | null {
		return walletFeeBatch(call, this.fees.payee());
	}

	private async callRefusal(
		wallet: UserWallet,
		call: SafeCall,
		owners: readonly Address[]
	): Promise<WalletCallRefusal | null> {
		const context = await this.callContext(wallet, call);
		return (
			walletCallRefusal(call, context, owners) ??
			(await this.counterpartyRefusal(call, context))
		);
	}

	private async counterpartyRefusal(
		call: SafeCall,
		context: WalletCallContext
	): Promise<WalletCallRefusal | null> {
		const counterparties = walletCallCounterparties(call, context, [
			this.config.get('settlement.feeReceiverAddress'),
		]);
		for (const counterparty of counterparties) {
			const screening = await this.sanctions.screen(counterparty);
			if (screening.sanctionsStatus === SanctionsStatus.BLOCKED) {
				return {
					code: UserWalletErrorCode.COUNTERPARTY_SANCTIONED,
					message: `${counterparty} appears on a sanctions list, so Snapflow will not relay a transaction to it`,
				};
			}
		}
		return null;
	}

	relayCall(
		wallet: UserWallet,
		signer: PasskeySigner,
		transaction: SafeTransaction,
		signatures: Hex,
		state: SafeWalletState
	): RelayCall {
		return walletRelayCall({
			safe: wallet.safeAddress,
			owner: wallet.signerAddress,
			signer,
			transaction,
			signatures,
			deploySigner: !state.signerDeployed,
			deploySafe: !state.safeDeployed,
		});
	}

	private async callContext(
		wallet: UserWallet,
		call: SafeCall
	): Promise<WalletCallContext> {
		const manager = this.entityManager.fork();
		const delegated = await this.delegatedSigners.forCustomer(
			manager,
			wallet.safeAddress
		);
		return {
			...this.callTargets(wallet),
			signer: wallet.signerAddress,
			delegatedSigner: delegated?.signerAddress ?? null,
			relayer: this.config.get('settlement.relayerAddress'),
			minimumDepositMicroUsd: MicroUsd.fromCents(
				(await this.settings.get()).minimumDepositCents
			).toBigInt(),
			snapflowControlled: await this.snapflowControlled(
				manager,
				walletCallNewOwners(call, wallet.safeAddress)
			),
		};
	}

	private callTargets(wallet: UserWallet): WalletCallTargets {
		return {
			safe: wallet.safeAddress,
			usdc: this.config.get('settlement.usdcAddress'),
			escrow: this.config.get('settlement.escrowAddress'),
		};
	}

	private assertTermsAllow(
		wallet: UserWallet,
		call: SafeCall,
		actor: TermsActor
	): void {
		if (
			hasAcceptedTerms(actor) ||
			isWalletExitCall(call, this.callTargets(wallet))
		) {
			return;
		}
		throw termsAcceptanceRequired(actor.credential);
	}

	async controlledBySnapflow(address: Address): Promise<boolean> {
		const controlled = await this.snapflowControlled(
			this.entityManager.fork(),
			[address]
		);
		return controlled.length > 0;
	}

	private snapflowControlled(
		manager: EntityManager,
		candidates: readonly Address[]
	): Promise<Address[]> {
		return snapflowControlledAmong(
			manager,
			configuredEscrow(this.config),
			{
				relayer: this.config.get('settlement.relayerAddress'),
				feeReceiver: this.config.get('settlement.feeReceiverAddress'),
			},
			candidates
		);
	}

	prepare(
		wallet: UserWallet,
		call: SafeCall,
		actor: TermsActor
	): Promise<PreparedWalletTransactionDto> {
		return withSettlementChain(this.logger, async () => {
			this.assertTermsAllow(wallet, call, actor);
			const state = await this.chain.state(
				wallet.safeAddress,
				wallet.signerAddress,
				wallet.signerAddress
			);
			const refusal = await this.callRefusal(wallet, call, state.owners);
			if (refusal) throw new ForbiddenException(refusal);
			const nonce = nextSafeNonce(
				state.nonce,
				await this.openNonces(this.entityManager.fork(), wallet.id)
			);
			const { quote, refusal: unpaid } = await this.fees.quote(
				wallet,
				call,
				state,
				nonce
			);
			if (unpaid) throw new UnprocessableEntityException(unpaid);
			const transaction = relayedSafeTransaction(quote.call, nonce);
			return PreparedWalletTransactionDto.from(
				wallet.chainId,
				wallet.safeAddress,
				transaction,
				this.safeTxHash(wallet, transaction),
				{ feeMicroUsd: quote.feeMicroUsd, payee: this.fees.payee() }
			);
		});
	}

	async submit(
		wallet: UserWallet,
		submission: WalletSubmission,
		actor: TermsActor,
		recovery: RecoveryOwner | null = null
	): Promise<WalletTransaction> {
		const signer = await this.signingPasskey(wallet, submission);
		const call = { ...submission.call, to: getAddress(submission.call.to) };
		const batch = this.feeBatch(call);
		if (!batch) throw new UnprocessableEntityException(FEE_INVALID);
		this.assertTermsAllow(wallet, batchedSafeCall(batch.calls), actor);
		const transaction = relayedSafeTransaction(call, submission.nonce);
		const safeTxHash = this.safeTxHash(wallet, transaction);
		assertSignatureEncoding(submission.signature);
		const state = await withSettlementChain(this.logger, async () => {
			const current = await this.chain.state(
				wallet.safeAddress,
				wallet.signerAddress,
				signer.address
			);
			if (
				!current.owners.some((owner) => isAddressEqual(owner, signer.address))
			) {
				throw new ForbiddenException({
					code: UserWalletErrorCode.SIGNER_NOT_OWNER,
					message: "The signing passkey's signer does not own this wallet",
				});
			}
			const refusal = await this.callRefusal(
				wallet,
				batchedSafeCall(batch.calls),
				current.owners
			);
			if (refusal) throw new ForbiddenException(refusal);
			if (
				!(await this.chain.signatureValid(
					safeTxHash,
					submission.signature,
					signer
				))
			) {
				throw new BadRequestException({
					code: UserWalletErrorCode.SIGNATURE_INVALID,
					message: 'The passkey signature does not sign this transaction',
				});
			}
			return current;
		});
		const signatures = safeContractSignature(
			signer.address,
			submission.signature
		);
		const relay = this.relayCall(
			wallet,
			signer,
			transaction,
			signatures,
			state
		);
		return this.entityManager.fork().transactional(async (manager) => {
			const locked = await manager.findOneOrFail(
				UserWallet,
				{ id: wallet.id },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			const open = await this.openNonces(manager, wallet.id);
			if (open.length >= WALLET_TRANSACTION_LIMITS.OPEN_MAX) {
				throw new HttpException(
					{
						code: UserWalletErrorCode.QUEUE_FULL,
						message: `Your wallet has ${open.length} transactions waiting to be relayed; submit more once they landed`,
					},
					HttpStatus.TOO_MANY_REQUESTS
				);
			}
			const expected = nextSafeNonce(state.nonce, open);
			if (submission.nonce !== expected) {
				throw new ConflictException({
					code: UserWalletErrorCode.NONCE_MISMATCH,
					message: `The transaction must carry nonce ${expected}; prepare it again`,
				});
			}
			if (open.length === 0) {
				await this.assertRepaid(wallet, call, relay);
			}
			if (recovery) {
				manager.assign(locked, {
					recoveryStatus: RecoveryStatus.PENDING,
					recoveryOwnerAddress: recovery.address,
					recoveryOwnerKind: recovery.kind,
				});
			}
			return manager.create(WalletTransaction, {
				userWalletId: wallet.id,
				...transactionSignerColumns(signer),
				safeNonce: submission.nonce.toString(),
				to: call.to,
				data: call.data,
				operation: call.operation,
				feeMicroUsd: batch.feeMicroUsd.toString(),
				feePaidMicroUsd: null,
				safeTxHash,
				signatures,
				recoveryOwnerKind: recovery?.kind ?? null,
				recoveryOwnerAddress: recovery?.address ?? null,
				status: WalletTransactionStatus.QUEUED,
				transactionHash: null,
				error: null,
				settledAt: null,
			});
		});
	}

	list(walletId: string): Promise<WalletTransaction[]> {
		return this.entityManager.fork().find(
			WalletTransaction,
			{ userWalletId: walletId },
			{
				orderBy: { createdAt: QueryOrder.DESC },
				limit: WALLET_TRANSACTION_LIMITS.LIST_MAX,
			}
		);
	}

	async get(walletId: string, id: string): Promise<WalletTransaction> {
		const transaction = await this.entityManager
			.fork()
			.findOne(WalletTransaction, { id, userWalletId: walletId });
		if (!transaction) {
			throw new NotFoundException({
				code: UserWalletErrorCode.TRANSACTION_NOT_FOUND,
				message: 'Your wallet has no transaction with this id',
			});
		}
		return transaction;
	}

	private safeTxHash(wallet: UserWallet, transaction: SafeTransaction): Hash {
		return hashSafeTransaction(wallet.chainId, wallet.safeAddress, transaction);
	}

	private async signingPasskey(
		wallet: UserWallet,
		submission: WalletSubmission
	): Promise<PasskeySigner> {
		const passkeyId = submission.signingPasskeyId ?? wallet.passkeyId;
		if (!passkeyId) {
			throw new NotFoundException({
				code: UserWalletErrorCode.PASSKEY_NOT_FOUND,
				message:
					"The wallet's passkey was deleted; sign with another passkey that owns it",
			});
		}
		return this.wallets.passkeySigner(walletOwnerId(wallet), passkeyId);
	}

	private async openNonces(
		manager: EntityManager,
		walletId: string
	): Promise<bigint[]> {
		const open = await manager.find(
			WalletTransaction,
			{ userWalletId: walletId, status: { $in: [...OPEN_STATUSES] } },
			{ fields: ['safeNonce'] }
		);
		return open.map(({ safeNonce }) => BigInt(safeNonce));
	}

	private async assertRepaid(
		wallet: UserWallet,
		call: SafeCall,
		relay: RelayCall
	): Promise<void> {
		const refusal = await withSettlementChain(this.logger, () =>
			this.fees.refusal(wallet, call, relay)
		);
		if (refusal) throw new UnprocessableEntityException(refusal);
	}
}

function assertSignatureEncoding(signature: Hex): void {
	try {
		decodeWebAuthnSignature(signature);
	} catch {
		throw new BadRequestException({
			code: UserWalletErrorCode.SIGNATURE_INVALID,
			message:
				'The signature is not an ABI-encoded WebAuthn signature (authenticatorData, clientDataFields, r and s)',
		});
	}
}

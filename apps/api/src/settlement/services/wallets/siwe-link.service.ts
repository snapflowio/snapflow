/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { type Address, getAddress, type PublicClient } from 'viem';
import { generateSiweNonce, parseSiweMessage } from 'viem/siwe';
import { addMilliseconds } from '../../../common/utils/time.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import {
	PaymentWalletErrorCode,
	SIWE_LINK_STATEMENT,
	SIWE_MESSAGE_VERSION,
	SIWE_NONCE_KEY_PREFIX,
	SIWE_NONCE_SCOPE,
	SIWE_NONCE_TTL_MILLISECONDS,
	SIWE_RECOVERY_OWNER_STATEMENT,
} from '../../constants/payment-wallet.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';
import type {
	LinkPaymentWalletDto,
	SiweNonceDto,
	SiweProofDto,
} from '../../dto/payment-wallet.dto';
import type { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import {
	isChainUnreachable,
	withSettlementChain,
} from '../../utils/chain-error.util';

const REDIS_EXPIRY_MILLISECONDS = 'PX';
const NONCE_ISSUED = '1';

interface SiweChallenge {
	scope: string;
	statement: string;
}

function paymentWalletChallenge(
	organizationId: string,
	purpose: PaymentWalletPurpose
): SiweChallenge {
	return {
		scope: `${SIWE_NONCE_SCOPE.PAYMENT_WALLET}:${organizationId}:${purpose}`,
		statement: SIWE_LINK_STATEMENT[purpose],
	};
}

function recoveryOwnerChallenge(userId: string): SiweChallenge {
	return {
		scope: `${SIWE_NONCE_SCOPE.RECOVERY_OWNER}:${userId}`,
		statement: SIWE_RECOVERY_OWNER_STATEMENT,
	};
}

function nonceKey(challenge: SiweChallenge, nonce: string): string {
	return `${SIWE_NONCE_KEY_PREFIX}:${challenge.scope}:${nonce}`;
}

function messageInvalid(message: string): BadRequestException {
	return new BadRequestException({
		code: PaymentWalletErrorCode.MESSAGE_INVALID,
		message,
	});
}

@Injectable()
export class SiweLinkService {
	private readonly logger = new Logger(SiweLinkService.name);

	constructor(
		@InjectRedis() private readonly redis: Redis,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService
	) {}

	issueNonce(
		organizationId: string,
		purpose: PaymentWalletPurpose
	): Promise<SiweNonceDto> {
		return this.issue(paymentWalletChallenge(organizationId, purpose));
	}

	verify(
		organizationId: string,
		proof: LinkPaymentWalletDto
	): Promise<Address> {
		return this.verifyProof(
			paymentWalletChallenge(organizationId, proof.purpose),
			proof
		);
	}

	issueRecoveryOwnerNonce(userId: string): Promise<SiweNonceDto> {
		return this.issue(recoveryOwnerChallenge(userId));
	}

	verifyRecoveryOwner(userId: string, proof: SiweProofDto): Promise<Address> {
		return this.verifyProof(recoveryOwnerChallenge(userId), proof);
	}

	private async issue(challenge: SiweChallenge): Promise<SiweNonceDto> {
		const origin = this.origin();
		const issuedAt = new Date();
		const nonce = generateSiweNonce();
		await this.redis.set(
			nonceKey(challenge, nonce),
			NONCE_ISSUED,
			REDIS_EXPIRY_MILLISECONDS,
			SIWE_NONCE_TTL_MILLISECONDS
		);
		return {
			domain: origin.host,
			uri: origin.href,
			chainId: this.config.get('settlement.chainId'),
			statement: challenge.statement,
			version: SIWE_MESSAGE_VERSION,
			nonce,
			issuedAt,
			expirationTime: addMilliseconds(issuedAt, SIWE_NONCE_TTL_MILLISECONDS),
		};
	}

	private async verifyProof(
		challenge: SiweChallenge,
		proof: SiweProofDto
	): Promise<Address> {
		const fields = parseSiweMessage(proof.message);
		if (!fields.address || !fields.nonce) {
			throw messageInvalid(
				'The message is not a Sign-In With Ethereum message'
			);
		}
		const issued = await this.redis.getdel(nonceKey(challenge, fields.nonce));
		if (issued !== NONCE_ISSUED) {
			throw new BadRequestException({
				code: PaymentWalletErrorCode.NONCE_NOT_FOUND,
				message:
					'The nonce expired, was already used or was issued for another request; request a new one',
			});
		}
		const origin = this.origin();
		if (
			fields.chainId !== this.config.get('settlement.chainId') ||
			fields.uri !== origin.href ||
			fields.statement !== challenge.statement ||
			fields.version !== SIWE_MESSAGE_VERSION
		) {
			throw messageInvalid(
				'The message must use the chain, URI, statement and version the nonce was issued with'
			);
		}
		if (!(await this.signed(proof, origin.host, fields.nonce))) {
			throw new BadRequestException({
				code: PaymentWalletErrorCode.SIGNATURE_INVALID,
				message:
					'The signature does not prove control of the wallet, or the message expired',
			});
		}
		return getAddress(fields.address);
	}

	private origin(): URL {
		return new URL(this.config.getOrThrow('dashboardUrl'));
	}

	private signed(
		proof: SiweProofDto,
		domain: string,
		nonce: string
	): Promise<boolean> {
		return withSettlementChain(this.logger, async () => {
			try {
				return await this.client.verifySiweMessage({
					message: proof.message,
					signature: proof.signature,
					domain,
					nonce,
				});
			} catch (error) {
				if (isChainUnreachable(error)) throw error;
				return false;
			}
		});
	}
}

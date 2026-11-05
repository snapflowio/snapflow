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
	ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { type Address, getAddress, type PublicClient } from 'viem';
import {
	createSiweMessage,
	generateSiweNonce,
	parseSiweMessage,
} from 'viem/siwe';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	PaymentWalletErrorCode,
	SIWE_MESSAGE_VERSION,
	WALLET_CHALLENGE_KEY_PREFIX,
	WALLET_CHALLENGE_STATEMENT,
	WALLET_CHALLENGE_TTL_MILLISECONDS,
} from '../constants/payment-wallet.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../constants/settlement.constants';
import type {
	LinkPaymentWalletDto,
	WalletChallengeDto,
} from '../dto/payment-wallet.dto';
import type { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { isChainUnreachable } from '../utils/chain-error.util';

const REDIS_EXPIRY_MILLISECONDS = 'PX';

function challengeKey(
	organizationId: string,
	purpose: PaymentWalletPurpose,
	nonce: string
): string {
	return `${WALLET_CHALLENGE_KEY_PREFIX}:${organizationId}:${purpose}:${nonce}`;
}

// Sign-In With Ethereum challenges: the server issues the exact message and
// keeps it until it expires or is used once, so a signature only links the
// wallet to the organization and purpose it was requested for.
@Injectable()
export class WalletChallengeService {
	private readonly logger = new Logger(WalletChallengeService.name);

	constructor(
		@InjectRedis() private readonly redis: Redis,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService
	) {}

	async issue(
		organizationId: string,
		purpose: PaymentWalletPurpose,
		address: Address
	): Promise<WalletChallengeDto> {
		const origin = new URL(this.config.getOrThrow('dashboardUrl'));
		const issuedAt = new Date();
		const expiresAt = new Date(
			issuedAt.getTime() + WALLET_CHALLENGE_TTL_MILLISECONDS
		);
		const nonce = generateSiweNonce();
		const message = createSiweMessage({
			address: getAddress(address),
			chainId: this.config.get('settlement.chainId'),
			domain: origin.host,
			uri: origin.href,
			nonce,
			issuedAt,
			expirationTime: expiresAt,
			statement: WALLET_CHALLENGE_STATEMENT[purpose],
			version: SIWE_MESSAGE_VERSION,
		});
		await this.redis.set(
			challengeKey(organizationId, purpose, nonce),
			message,
			REDIS_EXPIRY_MILLISECONDS,
			WALLET_CHALLENGE_TTL_MILLISECONDS
		);
		return { message, expiresAt };
	}

	// Consumes the challenge and returns the checksummed address that signed it.
	async verify(
		organizationId: string,
		proof: LinkPaymentWalletDto
	): Promise<Address> {
		const { address, nonce } = parseSiweMessage(proof.message);
		if (!address || !nonce) {
			throw new BadRequestException({
				code: PaymentWalletErrorCode.MESSAGE_INVALID,
				message: 'The message is not a Sign-In With Ethereum message',
			});
		}
		const issued = await this.redis.getdel(
			challengeKey(organizationId, proof.purpose, nonce)
		);
		if (issued !== proof.message) {
			throw new BadRequestException({
				code: PaymentWalletErrorCode.CHALLENGE_NOT_FOUND,
				message:
					'The challenge expired, was already used or was issued for another wallet; request a new one',
			});
		}
		if (!(await this.signed(proof))) {
			throw new BadRequestException({
				code: PaymentWalletErrorCode.SIGNATURE_INVALID,
				message: 'The signature does not prove control of the wallet',
			});
		}
		return getAddress(address);
	}

	// The message matched the issued challenge, so its domain, chain, nonce and
	// address are ours; this checks the signature and the expiration time.
	private async signed(proof: LinkPaymentWalletDto): Promise<boolean> {
		try {
			return await this.client.verifySiweMessage({
				message: proof.message,
				signature: proof.signature,
			});
		} catch (error) {
			// viem throws on signatures it cannot even decode; those prove nothing.
			if (!isChainUnreachable(error)) return false;
			this.logger.error('Could not reach the settlement chain', error);
			throw new ServiceUnavailableException({
				code: PaymentWalletErrorCode.CHAIN_UNAVAILABLE,
				message: 'The settlement chain is unreachable; retry shortly',
			});
		}
	}
}

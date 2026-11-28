/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { Address } from 'viem';
import { SocialProvider } from '../../auth/constants/social-provider.constants';
import {
	SETTLEMENT_CHAIN_IDS,
	type SettlementChainId,
} from '../../config/constants/settlement-chain.constants';

@ApiSchema({ name: 'PublicSettlementConfig' })
class PublicSettlementConfigDto {
	@ApiProperty({
		description: 'EIP-155 chain id of the settlement chain',
		enum: SETTLEMENT_CHAIN_IDS,
	})
	chainId: SettlementChainId;

	@ApiProperty({
		type: String,
		description: 'Address of the USDC escrow contract',
	})
	escrowAddress: Address;

	@ApiProperty({ type: String, description: 'Address of the USDC token' })
	usdcAddress: Address;

	@ApiProperty({
		type: String,
		description:
			"Snapflow's fee receiver, which every voucher Snapflow accepts names",
	})
	feeReceiverAddress: Address;

	@ApiProperty({
		type: String,
		nullable: true,
		description:
			'WalletConnect project id the dashboard links phone wallets with; null when phone wallets are off',
	})
	walletConnectProjectId: string | null;
}

@ApiSchema({ name: 'PublicAnalyticsConfig' })
export class PublicAnalyticsConfigDto {
	@ApiProperty({ description: 'Public PostHog project API key' })
	projectKey: string;

	@ApiProperty({ description: 'PostHog ingestion origin' })
	host: string;
}

@ApiSchema({ name: 'PublicHumanVerificationConfig' })
export class PublicHumanVerificationConfigDto {
	@ApiProperty({ description: 'Cloudflare Turnstile sitekey' })
	siteKey: string;

	@ApiProperty({
		description:
			'Turnstile action the widget must send; the API rejects tokens issued for another action',
	})
	action: string;
}

@ApiSchema({ name: 'PublicLegalConfig' })
class PublicLegalConfigDto {
	@ApiProperty({ description: 'Current version of the Terms of Service' })
	termsVersion: string;

	@ApiProperty({ description: 'Current version of the host terms' })
	hostTermsVersion: string;

	@ApiProperty({
		type: 'integer',
		description:
			'Business days after a DMCA counter-notice before counter-noticed material is restored (17 USC 512(g)(2)(C))',
	})
	dmcaRestoreAfterBusinessDays: number;

	@ApiProperty({
		type: 'integer',
		description:
			'Business days after a DMCA counter-notice by which counter-noticed material must be restored (17 USC 512(g)(2)(C))',
	})
	dmcaRestoreByBusinessDays: number;
}

@ApiSchema({ name: 'PublicConfig' })
export class PublicConfigDto {
	@ApiProperty({
		type: PublicAnalyticsConfigDto,
		required: false,
		description:
			'Product analytics loaded after the visitor consents; absent when analytics is disabled',
	})
	analytics?: PublicAnalyticsConfigDto;

	@ApiProperty({
		type: PublicHumanVerificationConfigDto,
		description:
			'Bot protection the dashboard runs before it sends an email sign-in code',
	})
	humanVerification: PublicHumanVerificationConfigDto;

	@ApiProperty({ description: 'Public origin of the marketing website' })
	websiteUrl: string;

	@ApiProperty({ type: PublicLegalConfigDto })
	legal: PublicLegalConfigDto;

	@ApiProperty({
		description: 'Social sign-in providers enabled on this deployment',
		enum: Object.values(SocialProvider),
		enumName: 'SocialProvider',
		isArray: true,
	})
	socialProviders: SocialProvider[];

	@ApiProperty({ type: PublicSettlementConfigDto })
	settlement: PublicSettlementConfigDto;

	@ApiProperty({
		description:
			'Whether this deployment issues monthly receipts (it has a receipt issuer)',
	})
	receiptsAvailable: boolean;

	@ApiProperty({
		description:
			'WebAuthn relying party id of every passkey, including the ones that own wallets; passkey ceremonies must use it',
		example: 'snapflow.io',
	})
	passkeyRpId: string;
}

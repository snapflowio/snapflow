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
export class PublicSettlementConfigDto {
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
}

@ApiSchema({ name: 'PublicConfig' })
export class PublicConfigDto {
	@ApiProperty({ description: 'Public origin of the marketing website' })
	websiteUrl: string;

	@ApiProperty({
		description: 'Social sign-in providers enabled on this deployment',
		enum: Object.values(SocialProvider),
		enumName: 'SocialProvider',
		isArray: true,
	})
	socialProviders: SocialProvider[];

	@ApiProperty({ type: PublicSettlementConfigDto })
	settlement: PublicSettlementConfigDto;
}

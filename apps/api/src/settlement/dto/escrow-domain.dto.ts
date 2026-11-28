/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { EscrowDomain } from '@snapflow/contracts';
import type { Address } from 'viem';
import { EVM_ADDRESS_API_PROPERTY } from '../constants/settlement.constants';

@ApiSchema({ name: 'EscrowDomain' })
export class EscrowDomainDto {
	@ApiProperty()
	name: string;

	@ApiProperty()
	version: string;

	@ApiProperty({ type: 'integer', description: 'EIP-155 chain id' })
	chainId: number;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	verifyingContract: Address;

	static from(domain: EscrowDomain): EscrowDomainDto {
		return { ...domain };
	}
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsBoolean,
	IsInt,
	IsString,
	Max,
	Min,
	ValidateIf,
} from 'class-validator';
import {
	MAXIMUM_EGRESS_BANDWIDTH_BPS,
	MINIMUM_EGRESS_BANDWIDTH_BPS,
} from '../constants/network.constants';

@ApiSchema({ name: 'UpdateSandboxNetworkSettings' })
export class UpdateSandboxNetworkSettingsDto {
	@ApiPropertyOptional({
		description: 'Whether to block all network access for the sandbox',
		example: false,
	})
	@ValidateIf((_, value) => value !== undefined)
	@IsBoolean()
	networkBlockAll?: boolean;

	@ApiPropertyOptional({
		description:
			'Comma-separated list of allowed CIDR network addresses for the sandbox',
		example: '192.168.1.0/16,10.0.0.0/24',
	})
	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	networkAllowList?: string;

	@ApiPropertyOptional({
		description: 'Comma-separated list of allowed domains for the sandbox',
		example: 'example.com,api.snapflow.io',
	})
	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	domainAllowList?: string;

	@ApiPropertyOptional({
		description:
			'Maximum sandbox egress bandwidth in bits per second; null removes the limit',
		example: 10_000_000,
		minimum: MINIMUM_EGRESS_BANDWIDTH_BPS,
		maximum: MAXIMUM_EGRESS_BANDWIDTH_BPS,
		nullable: true,
		type: Number,
	})
	@ValidateIf((_, value) => value !== undefined && value !== null)
	@IsInt()
	@Min(MINIMUM_EGRESS_BANDWIDTH_BPS)
	@Max(MAXIMUM_EGRESS_BANDWIDTH_BPS)
	egressBandwidthBps?: number | null;
}

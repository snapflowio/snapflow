/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	Min,
	ValidateNested,
} from 'class-validator';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { FIRST_QUOTA_TIER } from '../constants/organization-quota-tier.constants';
import type {
	QuotaTier,
	QuotaTierClassLimits,
} from '../types/quota-tier.types';

const MINIMUM_QUANTITY = 0;
const SANDBOX_CLASS_COUNT = Object.values(SandboxClass).length;

function Quantity(description: string) {
	return applyDecorators(
		ApiProperty({ description, minimum: MINIMUM_QUANTITY }),
		IsInt(),
		Min(MINIMUM_QUANTITY)
	);
}

@ApiSchema({ name: 'QuotaTierClassLimits' })
export class QuotaTierClassLimitsDto implements QuotaTierClassLimits {
	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	@IsEnum(SandboxClass)
	sandboxClass: SandboxClass;

	@Quantity('vCPUs the sandboxes of this class may use in total')
	totalCpu: number;

	@Quantity('GiB of memory the sandboxes of this class may use in total')
	totalMemory: number;

	@Quantity('GiB of disk the sandboxes of this class may use in total')
	totalDisk: number;

	@Quantity('GPUs the sandboxes of this class may use in total')
	totalGpu: number;

	@Quantity('vCPUs one sandbox may use')
	maxCpuPerSandbox: number;

	@Quantity('GiB of memory one sandbox may use')
	maxMemoryPerSandbox: number;

	@Quantity('GiB of disk one sandbox may use')
	maxDiskPerSandbox: number;
}

@ApiSchema({ name: 'QuotaTier' })
export class QuotaTierDto implements QuotaTier {
	@ApiProperty({ minimum: FIRST_QUOTA_TIER })
	@IsInt()
	@Min(FIRST_QUOTA_TIER)
	tier: number;

	@ApiProperty({
		description:
			'An owner of the organization must have a verified email address',
	})
	@IsBoolean()
	requiresVerifiedEmail: boolean;

	@Quantity('Confirmed USDC deposits, cents, the organization made in total')
	lifetimeDepositCents: number;

	@Quantity(
		'Confirmed USDC deposits, cents, the organization made in the trailing window; 0 needs none'
	)
	trailingDepositCents: number;

	@ApiProperty({ type: [QuotaTierClassLimitsDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(SANDBOX_CLASS_COUNT)
	@ValidateNested({ each: true })
	@Type(() => QuotaTierClassLimitsDto)
	classLimits: QuotaTierClassLimitsDto[];
}

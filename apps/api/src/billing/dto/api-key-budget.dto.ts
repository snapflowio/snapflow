/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';
import { MICRO_USD_PATTERN } from '../../common/constants/money.constants';
import { FUNDING_POLICY } from '../constants/funding.constants';

const MINIMUM_CONCURRENT_SANDBOXES = 1;

const COMPUTE_SPEND_LIMIT_DESCRIPTION = `Most compute the sandboxes the key created may be charged over the last ${FUNDING_POLICY.apiKeyBudgetWindowDays} days, micro-USD; null for no limit. Compute is what a sandbox costs while it runs; the disk of stopped sandboxes is billed to the organization and does not count`;
const CONCURRENCY_DESCRIPTION =
	'Most sandboxes the key created may run at once; null for no limit';

@ApiSchema({ name: 'ApiKeyBudget' })
export class ApiKeyBudgetDto {
	@ApiProperty({ format: 'uuid' })
	apiKeyId: string;

	@ApiProperty({
		type: String,
		nullable: true,
		description: COMPUTE_SPEND_LIMIT_DESCRIPTION,
	})
	computeSpendLimitMicroUsd: string | null;

	@ApiProperty({
		type: Number,
		nullable: true,
		description: CONCURRENCY_DESCRIPTION,
	})
	maxConcurrentSandboxes: number | null;

	@ApiProperty({
		description: `What the sandboxes the key created were charged for running over the last ${FUNDING_POLICY.apiKeyBudgetWindowDays} days, micro-USD: billed compute plus the live accrual of the sandboxes running now. Stopped sandbox disk is billed to the organization and is not included`,
	})
	computeSpendMicroUsd: string;

	@ApiProperty({
		type: String,
		nullable: true,
		description:
			'What compute the key may still spend before its limit, micro-USD; null for no limit',
	})
	remainingMicroUsd: string | null;

	@ApiProperty({
		description:
			'What the running sandboxes the key created cost per hour right now, micro-USD; stopped sandboxes are not included',
	})
	computeBurnMicroUsdPerHour: string;

	@ApiProperty({ description: 'Sandboxes the key created that run now' })
	runningSandboxes: number;

	@ApiProperty({
		description:
			'Whether the key is at its budget: new starts answer 402, and once its remaining compute budget would not cover its running burn until the next check plus the stop margin, its running sandboxes stop',
	})
	exhausted: boolean;
}

@ApiSchema({ name: 'UpdateApiKeyBudget' })
export class UpdateApiKeyBudgetDto {
	@ApiProperty({
		type: String,
		nullable: true,
		description: COMPUTE_SPEND_LIMIT_DESCRIPTION,
	})
	@IsOptional()
	@Matches(MICRO_USD_PATTERN)
	computeSpendLimitMicroUsd: string | null;

	@ApiProperty({
		type: Number,
		nullable: true,
		minimum: MINIMUM_CONCURRENT_SANDBOXES,
		description: CONCURRENCY_DESCRIPTION,
	})
	@IsOptional()
	@IsInt()
	@Min(MINIMUM_CONCURRENT_SANDBOXES)
	maxConcurrentSandboxes: number | null;
}

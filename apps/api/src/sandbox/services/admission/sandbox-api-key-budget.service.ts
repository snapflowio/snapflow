/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { ApiKeyBudgetService } from '../../../billing/services/api-key-budget.service';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { SandboxPlacementControlService } from '../../../placement/services/sandbox-placement-control.service';
import { BUILD_SANDBOX_DEFAULT_RESOURCES } from '../../constants/sandbox-build.constants';
import type { CreateSandboxDto } from '../../dto/create-sandbox.dto';
import { SandboxService } from '../sandbox/sandbox.service';
import {
	type SandboxQuoteInput,
	SandboxQuoteService,
} from './sandbox-quote.service';

function createQuote(dto: CreateSandboxDto): SandboxQuoteInput {
	const quoted = {
		placement: dto.placement,
		gpu: dto.gpu,
		gpuType: dto.gpuType,
	};
	if (!dto.buildInfo) {
		return {
			...quoted,
			snapshot: dto.snapshot,
			cpu: dto.cpu,
			memory: dto.memory,
			disk: dto.disk,
		};
	}
	return {
		...quoted,
		cpu: dto.cpu ?? BUILD_SANDBOX_DEFAULT_RESOURCES.cpu,
		memory: dto.memory ?? BUILD_SANDBOX_DEFAULT_RESOURCES.memoryGiB,
		disk: dto.disk ?? BUILD_SANDBOX_DEFAULT_RESOURCES.diskGiB,
	};
}

@Injectable()
export class SandboxApiKeyBudgetService {
	constructor(
		private readonly apiKeyBudgets: ApiKeyBudgetService,
		private readonly quotes: SandboxQuoteService,
		private readonly sandboxes: SandboxService,
		private readonly placementControl: SandboxPlacementControlService
	) {}

	assertCreate(
		authContext: OrganizationAuthContext,
		dto: CreateSandboxDto,
		callerAddress: string | undefined
	): Promise<void> {
		return this.apiKeyBudgets.assertCanStart(authContext.credential, async () =>
			MicroUsd.parse(
				(
					await this.quotes.quote(
						createQuote(dto),
						authContext.organizationId,
						callerAddress
					)
				).hourlyPriceMicroUsd
			)
		);
	}

	assertRuns(
		authContext: OrganizationAuthContext,
		sandboxIdOrName: string
	): Promise<void> {
		return this.apiKeyBudgets.assertCanStart(
			authContext.credential,
			async () => {
				const sandbox = await this.sandboxes.findOneByIdOrName(
					sandboxIdOrName,
					authContext.organizationId
				);
				return (
					(await this.placementControl.currentHourlyGross(sandbox.id)) ??
					MicroUsd.ZERO
				);
			}
		);
	}
}

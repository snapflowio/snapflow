/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../common/utils/error/error.util';
import { constrainedContinents } from '../../location/utils/location-constraint.util';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import {
	GPU_PRICE_CLASS_PREFIX,
	UNMET_DEMAND,
} from '../constants/marketplace.constants';
import type { UnmetDemandDto } from '../dto/unmet-demand.dto';
import { UnmetDemand } from '../entities/unmet-demand.entity';
import { MachineCategory } from '../enums/machine-category.enum';
import { PlacementKind } from '../enums/placement-kind.enum';
import { unmetDemandSummary } from '../queries/unmet-demand.query';

const runDetached = AsyncLocalStorage.snapshot();

export function requestedPriceClass(
	params: Pick<CustomerMachineParams, 'gpu' | 'gpuType' | 'placement'>
): string {
	if (params.gpu > 0) {
		const gpuType = Array.isArray(params.gpuType)
			? params.gpuType[0]
			: params.gpuType;
		return `${GPU_PRICE_CLASS_PREFIX}${gpuType ?? UNMET_DEMAND.ANY_GPU}`;
	}
	return params.placement.kind === PlacementKind.FLEXIBLE
		? (params.placement.category ?? MachineCategory.GENERAL)
		: MachineCategory.GENERAL;
}

@Injectable()
export class UnmetDemandService {
	private readonly logger = new Logger(UnmetDemandService.name);

	constructor(private readonly entityManager: EntityManager) {}

	record(params: CustomerMachineParams): void {
		if (params.placement.kind !== PlacementKind.FLEXIBLE) return;
		runDetached(() => {
			this.persist(params).catch((error: unknown) => {
				this.logger.warn(
					`Failed to record unmet demand: ${errorMessage(error)}`
				);
			});
		});
	}

	summary(): Promise<UnmetDemandDto[]> {
		return unmetDemandSummary(
			this.entityManager.fork(),
			UNMET_DEMAND.SUMMARY_DAYS,
			UNMET_DEMAND.SUMMARY_LIMIT
		);
	}

	private async persist(params: CustomerMachineParams): Promise<void> {
		if (params.placement.kind !== PlacementKind.FLEXIBLE) return;
		const priceClass = requestedPriceClass(params);
		const [continent] = constrainedContinents(params.placement.locations);
		const cpu = params.cpu ?? 0;
		const memoryGiB = params.memoryGiB ?? 0;
		const bucket = Math.floor(
			Date.now() / UNMET_DEMAND.DEDUPLICATION_WINDOW_MILLISECONDS
		);
		await this.entityManager
			.fork()
			.createQueryBuilder(UnmetDemand)
			.insert({
				deduplicationKey: [
					params.customerOrganizationId,
					priceClass,
					continent ?? '',
					cpu,
					memoryGiB,
					params.gpu,
					params.placement.wholeMachine,
					bucket,
				].join(UNMET_DEMAND.KEY_SEPARATOR),
				organizationId: params.customerOrganizationId,
				priceClass,
				continent: continent ?? null,
				cpu,
				memoryGiB,
				gpu: params.gpu,
				wholeMachine: params.placement.wholeMachine,
			})
			.onConflict(['deduplicationKey'])
			.ignore()
			.execute('run');
	}
}

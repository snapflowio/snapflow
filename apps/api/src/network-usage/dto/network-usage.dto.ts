/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { PageLimit } from '../../common/decorators/page-limit.decorator';
import { TimeBound } from '../../common/decorators/time-bound.decorator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { NETWORK_USAGE_QUERY } from '../constants/network-usage.constants';
import type { NetworkUsagePeriod } from '../entities/network-usage-period.entity';

export class ListNetworkUsageQueryDto extends CursorPageQueryDto {
	@PageLimit(NETWORK_USAGE_QUERY.defaultLimit, NETWORK_USAGE_QUERY.maximumLimit)
	override limit = NETWORK_USAGE_QUERY.defaultLimit;

	@TimeBound()
	from?: Date;

	@TimeBound()
	to?: Date;
}

@ApiSchema({ name: 'NetworkUsagePeriod' })
export class NetworkUsagePeriodDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty()
	sandboxId: string;

	@ApiPropertyOptional({
		description:
			'Name of the sandbox; only on the customer view and omitted once the sandbox is deleted',
	})
	sandboxName?: string;

	@ApiProperty({ format: 'uuid' })
	leaseId: string;

	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty({ format: 'date-time' })
	periodStart: Date;

	@ApiProperty({ format: 'date-time' })
	periodEnd: Date;

	@ApiProperty({
		description: 'Response bytes the Edge served from the sandbox exposures',
	})
	edgeEgressBytes: string;

	@ApiProperty({
		description: 'Bytes the sandbox sent directly to the internet',
	})
	internetEgressBytes: string;

	@ApiProperty({ description: 'Egress bytes charged for this hour' })
	billedEgressBytes: string;

	@ApiProperty({
		description:
			'Request bytes the Edge delivered to the sandbox; never charged',
	})
	edgeIngressBytes: string;

	@ApiProperty({
		description:
			'Bytes the sandbox downloaded on connections it opened; never charged',
	})
	internetIngressBytes: string;

	@ApiProperty({ description: 'Host egress price, micro-USD per GiB' })
	egressRateMicroUsdPerGiB: string;

	@ApiProperty() markupBasisPoints: number;

	@ApiProperty() hostMicroUsd: string;

	@ApiProperty() markupMicroUsd: string;

	@ApiProperty() grossMicroUsd: string;

	static from(
		period: NetworkUsagePeriod,
		sandboxName?: string
	): NetworkUsagePeriodDto {
		return {
			id: period.id,
			sandboxId: period.sandboxId,
			sandboxName,
			leaseId: period.leaseId,
			machineId: period.machineId,
			periodStart: period.periodStart,
			periodEnd: period.periodEnd,
			edgeEgressBytes: period.edgeEgressBytes,
			internetEgressBytes: period.internetEgressBytes,
			billedEgressBytes: period.billedEgressBytes,
			edgeIngressBytes: period.edgeIngressBytes,
			internetIngressBytes: period.internetIngressBytes,
			egressRateMicroUsdPerGiB: period.egressRateMicroUsdPerGiB,
			markupBasisPoints: period.markupBasisPoints,
			hostMicroUsd: period.hostMicroUsd,
			markupMicroUsd: period.markupMicroUsd,
			grossMicroUsd: period.grossMicroUsd,
		};
	}
}

@ApiSchema({ name: 'NetworkUsagePeriodPage' })
export class NetworkUsagePeriodPageDto extends CursorPageDto<NetworkUsagePeriodDto> {
	@ApiProperty({ type: [NetworkUsagePeriodDto] })
	declare items: NetworkUsagePeriodDto[];
}

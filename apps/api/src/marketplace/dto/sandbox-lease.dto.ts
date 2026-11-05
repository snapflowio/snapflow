/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { SandboxLease } from '../entities/sandbox-lease.entity';
import { LeaseRenewalState } from '../enums/lease-renewal-state.enum';
import { PlacementKind } from '../enums/placement-kind.enum';
import type { LinePrice } from '../types/pricing.types';

export interface SandboxLeasePrices {
	hourly: LinePrice;
	stopped: LinePrice;
	egressPerGiB: LinePrice;
}

@ApiSchema({ name: 'SandboxLease' })
export class SandboxLeaseDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty() sandboxId: string;
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty({
		type: String,
		format: 'uuid',
		nullable: true,
		description:
			'Null when the sandbox runs unpriced on a machine of its organization',
	})
	priceCardId: string | null;
	@ApiProperty({ enum: PlacementKind, enumName: 'PlacementKind' })
	placementKind: PlacementKind;
	@ApiProperty() markupBasisPoints: number;
	@ApiProperty({ type: String, nullable: true })
	maxHourlyPriceMicroUsd: string | null;
	@ApiProperty({ type: String, nullable: true })
	maxEgressMicroUsdPerGiB: string | null;
	@ApiProperty() cpu: number;
	@ApiProperty() memoryGiB: number;
	@ApiProperty() diskGiB: number;
	@ApiProperty() gpu: number;
	@ApiProperty() hourlyPriceMicroUsd: string;
	@ApiProperty() hostHourlyMicroUsd: string;
	@ApiProperty() markupHourlyMicroUsd: string;
	@ApiProperty() stoppedHourlyPriceMicroUsd: string;
	@ApiProperty({
		description: 'All-in egress price locked with the lease, micro-USD per GiB',
	})
	egressMicroUsdPerGiB: string;
	@ApiProperty() hostEgressMicroUsdPerGiB: string;
	@ApiProperty() markupEgressMicroUsdPerGiB: string;
	@ApiProperty({ type: String, format: 'date-time' }) startedAt: Date;
	@ApiProperty({ type: String, format: 'date-time' }) priceLockedUntil: Date;
	@ApiProperty({ enum: LeaseRenewalState, enumName: 'LeaseRenewalState' })
	renewalState: LeaseRenewalState;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	renewalDeadline: Date | null;

	static from(
		lease: SandboxLease,
		prices: SandboxLeasePrices
	): SandboxLeaseDto {
		return {
			id: lease.id,
			sandboxId: lease.sandboxId,
			machineId: lease.machineId,
			priceCardId: lease.priceCardId,
			placementKind: lease.placementKind,
			markupBasisPoints: lease.markupBasisPoints,
			maxHourlyPriceMicroUsd: lease.maxHourlyPriceMicroUsd,
			maxEgressMicroUsdPerGiB: lease.maxEgressMicroUsdPerGiB,
			cpu: lease.cpu,
			memoryGiB: lease.memoryGib,
			diskGiB: lease.diskGib,
			gpu: lease.gpu,
			hourlyPriceMicroUsd: prices.hourly.grossMicroUsd.toString(),
			hostHourlyMicroUsd: prices.hourly.hostMicroUsd.toString(),
			markupHourlyMicroUsd: prices.hourly.markupMicroUsd.toString(),
			stoppedHourlyPriceMicroUsd: prices.stopped.grossMicroUsd.toString(),
			egressMicroUsdPerGiB: prices.egressPerGiB.grossMicroUsd.toString(),
			hostEgressMicroUsdPerGiB: prices.egressPerGiB.hostMicroUsd.toString(),
			markupEgressMicroUsdPerGiB: prices.egressPerGiB.markupMicroUsd.toString(),
			startedAt: lease.startedAt,
			priceLockedUntil: lease.priceLockedUntil,
			renewalState: lease.renewalState,
			renewalDeadline: lease.renewalDeadline,
		};
	}
}

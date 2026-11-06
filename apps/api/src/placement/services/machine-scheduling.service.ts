/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { placementPriceTerms } from '../../billing/utils/lease-pricing.util';
import { observeOperation } from '../../infra/logging/utils/operation-observability.util';
import { LocationDto } from '../../location/dto/location.dto';
import {
	geoPoint,
	proximityBand,
} from '../../location/utils/geo-distance.util';
import { locationPreferenceRank } from '../../location/utils/location-constraint.util';
import { Machine } from '../../machine/entities/machine.entity';
import type {
	GetMachineParams,
	PlacementRequest,
} from '../../machine/types/machine-scheduling.types';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { currentAssessmentSql } from '../../marketplace/queries/machine-assessment.query';
import type {
	LinePrice,
	PriceCardRates,
	PriceTerms,
} from '../../marketplace/types/pricing.types';
import {
	type MarkupSettings,
	marketMarkupBasisPoints,
} from '../../marketplace/utils/markup.util';
import {
	egressPricePerGiB,
	runningHourlyPrice,
} from '../../marketplace/utils/pricing.util';
import { PlacementLocality } from '../../sandbox/enums/placement-locality.enum';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SettingsService } from '../../settings/services/settings.service';
import { NoAvailableMachineError } from '../exceptions/no-available-machine.exception';
import {
	type MachineCandidateRow,
	machineCandidatesQuery,
	placementScopeQuery,
	requestedShape,
} from '../queries/machine-candidates.query';
import {
	type RankablePlacement,
	rankPlacements,
} from '../utils/placement-ranking.util';

export interface PlacementCandidate extends RankablePlacement {
	location: LocationDto | null;
	hostOrganizationId: string;
	priceCardId: string | null;
	selfUse: boolean;
	terms: PriceTerms;
	hourly: LinePrice;
}

function rowNearness(
	row: MachineCandidateRow,
	placement: PlacementRequest
): Pick<RankablePlacement, 'locationPreference' | 'proximityBand'> {
	if (placement.kind === PlacementKind.PINNED) {
		return { locationPreference: 0, proximityBand: 0 };
	}
	const area =
		row.country && row.continent
			? { country: row.country, continent: row.continent }
			: null;
	return {
		locationPreference: locationPreferenceRank(placement.locations, area),
		proximityBand: proximityBand(placement.origin, geoPoint(row)),
	};
}

function rowLocality(row: MachineCandidateRow): PlacementLocality {
	if (Number(row.template_prepared) > 0) return PlacementLocality.PREPARED;
	return Number(row.snapshot_present) > 0
		? PlacementLocality.PRESENT
		: PlacementLocality.REMOTE;
}

function rowRates(row: MachineCandidateRow): PriceCardRates | null {
	const {
		vcpu_hour_micro_usd,
		memory_gib_hour_micro_usd,
		gpu_hour_micro_usd,
		disk_gib_month_micro_usd,
		stopped_disk_gib_month_micro_usd,
		egress_micro_usd_per_gib,
	} = row;
	if (
		vcpu_hour_micro_usd === null ||
		memory_gib_hour_micro_usd === null ||
		gpu_hour_micro_usd === null ||
		disk_gib_month_micro_usd === null ||
		stopped_disk_gib_month_micro_usd === null ||
		egress_micro_usd_per_gib === null
	) {
		return null;
	}
	return {
		vcpuHourMicroUsd: vcpu_hour_micro_usd,
		memoryGibHourMicroUsd: memory_gib_hour_micro_usd,
		gpuHourMicroUsd: gpu_hour_micro_usd,
		diskGibMonthMicroUsd: disk_gib_month_micro_usd,
		stoppedDiskGibMonthMicroUsd: stopped_disk_gib_month_micro_usd,
		egressMicroUsdPerGiB: egress_micro_usd_per_gib,
	};
}

export function placementCandidate(
	row: MachineCandidateRow,
	params: GetMachineParams,
	markups: MarkupSettings
): PlacementCandidate | null {
	const selfUse = row.host_organization_id === params.customerOrganizationId;
	const rates = rowRates(row);
	if (!selfUse && !rates) return null;
	const terms = placementPriceTerms(
		selfUse ? null : rates,
		marketMarkupBasisPoints(markups, row.tier)
	);
	const hourly = runningHourlyPrice(terms, requestedShape(params));
	return {
		machineId: row.id,
		location: LocationDto.from({ ...row, city: null }),
		...rowNearness(row, params.placement),
		hostOrganizationId: row.host_organization_id,
		priceCardId: selfUse ? null : row.price_card_id,
		selfUse,
		terms,
		hourly,
		hourlyGrossMicroUsd: hourly.grossMicroUsd,
		egressGrossMicroUsdPerGiB: egressPricePerGiB(terms).grossMicroUsd,
		gpuTypePriority: Number(row.gpu_type_priority),
		reliabilityBasisPoints: Number(row.reliability_basis_points),
		locality: rowLocality(row),
	};
}

@Injectable()
export class MachineSchedulingService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService
	) {}

	async eligibleMachines(
		params: GetMachineParams,
		manager: EntityManager = this.entityManager,
		machineIds?: readonly string[]
	): Promise<PlacementCandidate[]> {
		const query = machineCandidatesQuery(params, machineIds);
		const rows = await observeOperation(
			'sandbox.scheduling.candidates',
			{
				'sandbox.class': params.sandboxClass,
				'sandbox.mode': params.mode ?? 'unspecified',
				'sandbox.gpu_requested': params.gpu > 0,
				'sandbox.placement_kind': params.placement.kind,
				'sandbox.template_locality_required': params.snapshotRef !== undefined,
			},
			() => manager.execute<MachineCandidateRow[]>(query.sql, query.bindings)
		);
		const settings = await this.settings.get();
		return rows.flatMap((row) => {
			const candidate = placementCandidate(row, params, settings);
			return candidate ? [candidate] : [];
		});
	}

	async rank(
		params: GetMachineParams,
		manager: EntityManager = this.entityManager
	): Promise<PlacementCandidate[]> {
		const eligible = await this.eligibleMachines(params, manager);
		return rankPlacements(
			eligible,
			params.placement.kind === PlacementKind.FLEXIBLE ? params.placement : {}
		);
	}

	async findBestMachine(
		params: GetMachineParams,
		manager: EntityManager = this.entityManager
	): Promise<Machine | null> {
		const [best] = await this.rank(params, manager);
		return best ? manager.findOneOrFail(Machine, { id: best.machineId }) : null;
	}

	async findBestAvailableMachine(params: GetMachineParams): Promise<Machine> {
		const machine = await this.findBestMachine(params);
		if (!machine) {
			throw new NoAvailableMachineError(params);
		}
		return machine;
	}

	async machineAccepts(
		machineId: string,
		params: GetMachineParams
	): Promise<boolean> {
		const eligible = await this.eligibleMachines(params, this.entityManager, [
			machineId,
		]);
		return eligible.length > 0;
	}

	async hasSchedulableMachine(sandboxClass: SandboxClass): Promise<boolean> {
		const rows = await this.entityManager.execute<{ exists: boolean }[]>(
			`SELECT EXISTS (
				SELECT 1 FROM machine
				WHERE machine."sandboxClass" = ?
					AND machine.unschedulable = false AND machine.draining = false
			) AS exists`,
			[sandboxClass]
		);
		return rows[0]?.exists === true;
	}

	async placementCanEverBeMet(
		params: Pick<
			GetMachineParams,
			'customerOrganizationId' | 'placement' | 'sandboxClass'
		>
	): Promise<boolean> {
		const query = placementScopeQuery(params);
		const [row] = await this.entityManager.execute<{ exists: boolean }[]>(
			query.sql,
			query.bindings
		);
		return row?.exists === true;
	}

	async machineIsEligible(machineId: string): Promise<boolean> {
		const [row] = await this.entityManager.execute<{ eligible: boolean }[]>(
			`SELECT EXISTS (
				SELECT 1 FROM machine_assessment assessment
				WHERE assessment."machineId" = ? AND ${currentAssessmentSql('assessment')}
			) AS eligible`,
			[machineId]
		);
		return row?.eligible === true;
	}
}

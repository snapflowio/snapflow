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
import { placementPriceTerms } from '../../billing/utils/placement-pricing.util';
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
	MachineComputeShape,
	PlacementRequest,
} from '../../machine/types/machine-scheduling.types';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { currentAssessmentSql } from '../../marketplace/queries/machine-assessment.query';
import type {
	LinePrice,
	PriceTerms,
} from '../../marketplace/types/pricing.types';
import {
	offerCard,
	offerFits,
} from '../../marketplace/utils/listings/machine-browse.util';
import {
	type MarkupSettings,
	marketMarkupBasisPoints,
} from '../../marketplace/utils/pricing/markup.util';
import { runningHourlyPrice } from '../../marketplace/utils/pricing/pricing.util';
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
	placementReliabilityBasisPoints,
	type RankablePlacement,
	rankPlacements,
} from '../utils/placement-ranking.util';
import { isInterruptiblePlacement } from '../utils/sandbox-placement.util';

export interface PlacementCandidate extends RankablePlacement {
	location: LocationDto | null;
	hostOrganizationId: string;
	priceCardId: string | null;
	selfUse: boolean;
	terms: PriceTerms;
	hourly: LinePrice;
	wholeMachineShape: MachineComputeShape | null;
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

function placementCandidate(
	row: MachineCandidateRow,
	params: GetMachineParams,
	settings: MarkupSettings
): PlacementCandidate | null {
	const selfUse = row.host_organization_id === params.customerOrganizationId;
	const shape = requestedShape(params);
	const card = offerCard(row);
	const { wholeMachine } = params.placement;
	if (
		wholeMachine
			? selfUse || card === null
			: !selfUse && (card === null || !offerFits(card, row, shape))
	) {
		return null;
	}
	const terms = placementPriceTerms(
		selfUse ? null : card,
		shape,
		marketMarkupBasisPoints(settings),
		{ wholeMachine, interruptible: isInterruptiblePlacement(params.placement) }
	);
	const hourly = runningHourlyPrice(terms, shape);
	return {
		machineId: row.id,
		location: LocationDto.from({ ...row, city: null }),
		...rowNearness(row, params.placement),
		hostOrganizationId: row.host_organization_id,
		priceCardId: selfUse ? null : row.price_card_id,
		selfUse,
		terms,
		hourly,
		wholeMachineShape:
			wholeMachine && card
				? { cpu: card.vcpu, memoryGiB: card.memoryGib, gpu: card.gpuCount }
				: null,
		hourlyGrossMicroUsd: hourly.grossMicroUsd,
		gpuTypePriority: Number(row.gpu_type_priority),
		reliabilityBasisPoints: placementReliabilityBasisPoints(
			Number(row.success_mass),
			Number(row.failure_mass)
		),
		loadBasisPoints: loadBasisPoints(row, params.gpu > 0),
		locality: rowLocality(row),
	};
}

const LOAD_SCALE = 10_000;

function loadBasisPoints(
	row: Pick<
		MachineCandidateRow,
		'load_cpu' | 'load_gpu' | 'capacity_cpu' | 'capacity_gpu'
	>,
	gpu: boolean
): number {
	const used = Number(gpu ? row.load_gpu : row.load_cpu);
	const capacity = Number(gpu ? row.capacity_gpu : row.capacity_cpu);
	return capacity > 0 ? Math.floor((LOAD_SCALE * used) / capacity) : 0;
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

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ResourceShape } from '../../common/values/resource-shape.value';
import type { Continent } from '../../location/enums/continent.enum';
import type { LocationConstraint } from '../../location/types/geo-location.types';
import {
	constrainedContinents,
	constrainedCountries,
} from '../../location/utils/location-constraint.util';
import { MachineHypervisor } from '../../machine/enums/machine-hypervisor.enum';
import { MachineRuntimeFeature } from '../../machine/enums/machine-runtime-feature.enum';
import { machineTrustPlacementCondition } from '../../machine/queries/machine-placement-trust.query';
import type {
	GetMachineParams,
	PlacementRequest,
	WorkloadRequirements,
} from '../../machine/types/machine-scheduling.types';
import { MACHINE_TIER_ORDER } from '../../marketplace/constants/marketplace.constants';
import { ListingState } from '../../marketplace/enums/listing-state.enum';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { currentAssessmentSql } from '../../marketplace/queries/machine-assessment.query';
import {
	hostGateSql,
	MACHINE_LOAD_BINDINGS,
	MACHINE_LOAD_SQL,
	type SqlFragment,
	workloadGateSql,
} from '../../marketplace/queries/machine-eligibility.query';
import type { SandboxCapability } from '../../sandbox/enums/sandbox-capability.enum';
import { SandboxMode } from '../../sandbox/enums/sandbox-mode.enum';
import { SnapshotMachineState } from '../../snapshot/enums/snapshot-machine-state.enum';

const MINIMUM_TIER_SQL = `machine."organizationId" = ?
	OR array_position(ARRAY[?]::varchar[], machine.tier) >= array_position(ARRAY[?]::varchar[], ?::varchar)`;

const ALWAYS = 'TRUE';

export interface MachineCandidateRow {
	id: string;
	country: string | null;
	continent: Continent | null;
	latitude: number | null;
	longitude: number | null;
	host_organization_id: string;
	tier: MachineTier;
	price_card_id: string | null;
	vcpu_hour_micro_usd: string | null;
	memory_gib_hour_micro_usd: string | null;
	gpu_hour_micro_usd: string | null;
	disk_gib_month_micro_usd: string | null;
	stopped_disk_gib_month_micro_usd: string | null;
	egress_micro_usd_per_gib: string | null;
	snapshot_present: number;
	template_prepared: number;
	gpu_type_priority: number;
	reliability_basis_points: number;
}

function conjunction(parts: readonly SqlFragment[]): SqlFragment {
	const filled = parts.filter(({ sql }) => sql.length > 0);
	return {
		sql:
			filled.length === 0
				? ALWAYS
				: filled.map(({ sql }) => `(${sql})`).join('\n AND '),
		bindings: filled.flatMap(({ bindings }) => bindings),
	};
}

function canonicalCapabilities(
	capabilities: readonly SandboxCapability[] | undefined
): SandboxCapability[] {
	return [...new Set(capabilities ?? [])].sort();
}

function placementHostGate(
	params: GetMachineParams,
	machineIds: readonly string[] | undefined
): SqlFragment {
	const parts: SqlFragment[] = [
		hostGateSql(),
		{ sql: 'machine."sandboxClass" = ?', bindings: [params.sandboxClass] },
	];
	const excluded = (params.excludedMachineIds ?? []).filter(Boolean);
	if (excluded.length > 0) {
		parts.push({
			sql: 'machine.id <> ALL(ARRAY[?]::uuid[])',
			bindings: [excluded],
		});
	}
	if (machineIds !== undefined) {
		parts.push({
			sql: 'machine.id = ANY(ARRAY[?]::uuid[])',
			bindings: [machineIds],
		});
	}
	parts.push(machineTrustPlacementCondition(params.workloadFingerprint));
	return conjunction(parts);
}

function runtimeGate(params: WorkloadRequirements): SqlFragment {
	const parts: SqlFragment[] = [];
	if (params.mode !== undefined) {
		parts.push({
			sql: `machine."runtimeCapabilities"->>'kvmAvailable' = 'true'
				AND jsonb_exists(machine."runtimeCapabilities"->'hypervisors', ?)`,
			bindings: [
				params.mode === SandboxMode.EPHEMERAL
					? MachineHypervisor.FIRECRACKER
					: MachineHypervisor.CLOUD_HYPERVISOR,
			],
		});
	}
	const volumeIds = params.volumeIds ?? [];
	if (params.requiresVolumes || volumeIds.length > 0) {
		parts.push({
			sql: `jsonb_exists(machine."runtimeCapabilities"->'features', ?)`,
			bindings: [MachineRuntimeFeature.VOLUME],
		});
	}
	if (volumeIds.length > 0) {
		parts.push({
			sql: `NOT EXISTS (SELECT 1 FROM volume WHERE volume.id = ANY(ARRAY[?]::uuid[]) AND volume."homeMachineId" IS NOT NULL AND volume."homeMachineId" <> machine.id)`,
			bindings: [[...volumeIds]],
		});
	}
	for (const capability of params.capabilities ?? []) {
		parts.push({
			sql: `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(machine."runtimeCapabilities"->'platformArtifacts', '[]'::jsonb)) AS artifact WHERE jsonb_exists(artifact->'capabilities', ?))`,
			bindings: [capability],
		});
	}
	return conjunction(parts);
}

function locationGate(constraints: readonly LocationConstraint[]): SqlFragment {
	const countries = constrainedCountries(constraints);
	const continents = constrainedContinents(constraints);
	const alternatives: SqlFragment[] = [];
	if (countries.length > 0) {
		alternatives.push({
			sql: 'machine.country = ANY(ARRAY[?]::varchar[])',
			bindings: [countries],
		});
	}
	if (continents.length > 0) {
		alternatives.push({
			sql: 'machine.continent::text = ANY(ARRAY[?]::varchar[])',
			bindings: [continents],
		});
	}
	return {
		sql: alternatives.map(({ sql }) => `(${sql})`).join(' OR '),
		bindings: alternatives.flatMap(({ bindings }) => bindings),
	};
}

function marketplaceGate(
	customerOrganizationId: string | null,
	placement: PlacementRequest
): SqlFragment {
	const parts: SqlFragment[] = [
		{
			sql: `listing.state = ? AND ((listing.visibility = ? AND machine.tier <> ? AND machine."restrictedAt" IS NULL)
				OR machine."organizationId" = ?)`,
			bindings: [
				ListingState.LISTED,
				ListingVisibility.PUBLIC,
				MachineTier.PRIVATE,
				customerOrganizationId,
			],
		},
	];
	if (placement.kind === PlacementKind.PINNED) {
		parts.push({ sql: 'machine.id = ?', bindings: [placement.machineId] });
		return conjunction(parts);
	}
	if (placement.locations.length > 0) {
		parts.push(locationGate(placement.locations));
	}
	if (placement.ownMachinesOnly) {
		parts.push({
			sql: 'machine."organizationId" = ?',
			bindings: [customerOrganizationId],
		});
	}
	if (placement.category !== undefined) {
		parts.push({
			sql: 'machine.category = ?',
			bindings: [placement.category],
		});
	}
	if (placement.minimumTier !== undefined) {
		parts.push({
			sql: MINIMUM_TIER_SQL,
			bindings: [
				customerOrganizationId,
				MACHINE_TIER_ORDER,
				MACHINE_TIER_ORDER,
				placement.minimumTier,
			],
		});
	}
	return conjunction(parts);
}

interface GpuPart {
	gate: SqlFragment;
	priority: SqlFragment;
}

function gpuGate(params: GetMachineParams): GpuPart {
	const noPriority = { sql: '0', bindings: [] };
	if (params.gpu <= 0) {
		return {
			gate: { sql: 'machine."gpuCount" = 0', bindings: [] },
			priority: noPriority,
		};
	}
	if (Array.isArray(params.gpuType) && params.gpuType.length > 0) {
		const gpuTypes = [...new Set(params.gpuType)];
		return {
			gate: {
				sql: 'machine."gpuType" = ANY(ARRAY[?]::varchar[])',
				bindings: [gpuTypes],
			},
			priority: {
				sql: `CASE ${gpuTypes
					.map(() => 'WHEN machine."gpuType" = ? THEN ?')
					.join(' ')} ELSE ? END`,
				bindings: [
					...gpuTypes.flatMap((gpuType, index) => [gpuType, index]),
					gpuTypes.length,
				],
			},
		};
	}
	if (typeof params.gpuType === 'string') {
		return {
			gate: { sql: 'machine."gpuType" = ?', bindings: [params.gpuType] },
			priority: noPriority,
		};
	}
	return { gate: { sql: '', bindings: [] }, priority: noPriority };
}

interface LocalityPart {
	join: SqlFragment;
	snapshotPresent: string;
	templatePrepared: SqlFragment;
	gate: SqlFragment;
}

function locality(params: GetMachineParams): LocalityPart {
	const part: LocalityPart = {
		join: { sql: '', bindings: [] },
		snapshotPresent: '0',
		templatePrepared: { sql: '0', bindings: [] },
		gate: { sql: '', bindings: [] },
	};
	if (params.snapshotRef === undefined) return part;
	part.join = {
		sql: `LEFT JOIN snapshot_machine ON snapshot_machine."machineId" = machine.id
		AND snapshot_machine."snapshotRef" = ? AND snapshot_machine.state = ?`,
		bindings: [params.snapshotRef, SnapshotMachineState.PRESENT],
	};
	part.snapshotPresent =
		'CASE WHEN snapshot_machine.id IS NOT NULL THEN 1 ELSE 0 END';
	if (params.snapshotRequired) {
		part.gate = { sql: 'snapshot_machine.id IS NOT NULL', bindings: [] };
	}
	if (params.mode === SandboxMode.EPHEMERAL) {
		const capabilities = JSON.stringify(
			canonicalCapabilities(params.capabilities)
		);
		part.templatePrepared = {
			sql: `CASE WHEN snapshot_machine."preparedTemplate" IS NOT NULL
				AND (snapshot_machine."preparedTemplate"->>'cpuQuota')::integer = ?
				AND (snapshot_machine."preparedTemplate"->>'memoryQuota')::integer = ?
				AND (snapshot_machine."preparedTemplate"->>'storageQuota')::integer = ?
				AND COALESCE(snapshot_machine."preparedTemplate"->'capabilities', '[]'::jsonb) @> CAST(? AS jsonb)
				AND CAST(? AS jsonb) @> COALESCE(snapshot_machine."preparedTemplate"->'capabilities', '[]'::jsonb)
				AND jsonb_exists(machine."runtimeCapabilities"->'preparedTemplateKeys', snapshot_machine."preparedTemplate"->>'key')
			THEN 1 ELSE 0 END`,
			bindings: [
				params.cpu ?? 0,
				params.memoryGiB ?? 0,
				params.diskGiB ?? 0,
				capabilities,
				capabilities,
			],
		};
	}
	return part;
}

export function requestedShape(params: GetMachineParams): ResourceShape {
	return ResourceShape.of({
		cpu: params.cpu ?? 0,
		memoryGiB: params.memoryGiB ?? 0,
		diskGiB: params.diskGiB ?? 0,
		gpu: params.gpu,
	});
}

export function placementScopeQuery(
	params: Pick<
		GetMachineParams,
		'customerOrganizationId' | 'placement' | 'sandboxClass'
	>
): SqlFragment {
	const where = conjunction([
		{
			sql: 'machine."sandboxClass" = ? AND machine.unschedulable = false AND machine.draining = false',
			bindings: [params.sandboxClass],
		},
		marketplaceGate(params.customerOrganizationId, params.placement),
	]);
	return {
		sql: `SELECT EXISTS (
				SELECT 1 FROM machine
				JOIN machine_listing listing ON listing."machineId" = machine.id
				WHERE ${where.sql}
			) AS exists`,
		bindings: where.bindings,
	};
}

export function machineCandidatesQuery(
	params: GetMachineParams,
	machineIds?: readonly string[]
): SqlFragment {
	const local = locality(params);
	const gpu = gpuGate(params);
	const where = conjunction([
		placementHostGate(params, machineIds),
		marketplaceGate(params.customerOrganizationId, params.placement),
		local.gate,
		runtimeGate(params),
		gpu.gate,
		workloadGateSql(requestedShape(params)),
	]);
	return {
		sql: `SELECT machine.id, machine.country, machine.continent,
				machine.latitude, machine.longitude,
				machine."organizationId" AS host_organization_id, machine.tier,
				listing."currentPriceCardId" AS price_card_id,
				card."vcpuHourMicroUsd"::text AS vcpu_hour_micro_usd,
				card."memoryGibHourMicroUsd"::text AS memory_gib_hour_micro_usd,
				card."gpuHourMicroUsd"::text AS gpu_hour_micro_usd,
				card."diskGibMonthMicroUsd"::text AS disk_gib_month_micro_usd,
				card."stoppedDiskGibMonthMicroUsd"::text AS stopped_disk_gib_month_micro_usd,
				card."egressMicroUsdPerGiB"::text AS egress_micro_usd_per_gib,
				${local.snapshotPresent} AS snapshot_present,
				${local.templatePrepared.sql} AS template_prepared,
				${gpu.priority.sql} AS gpu_type_priority,
				assessment."reliabilityBasisPoints" AS reliability_basis_points
			FROM machine
			JOIN machine_listing listing ON listing."machineId" = machine.id
			LEFT JOIN machine_price_card card ON card.id = listing."currentPriceCardId"
			JOIN machine_assessment assessment ON assessment."machineId" = machine.id
				AND ${currentAssessmentSql('assessment')}
			CROSS JOIN LATERAL (${MACHINE_LOAD_SQL}) load
			${local.join.sql}
			WHERE ${where.sql}
			ORDER BY gpu_type_priority ASC, machine.id ASC`,
		bindings: [
			...local.templatePrepared.bindings,
			...gpu.priority.bindings,
			...MACHINE_LOAD_BINDINGS,
			...local.join.bindings,
			...where.bindings,
		],
	};
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PlacementBillingCapacityService } from '../../../billing/ledger/services/placement/placement-billing-capacity.service';
import { GeoIpService } from '../../../location/services/geo-ip.service';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import { MachineBenchmark } from '../../../verification/qualification/entities/machine-benchmark.entity';
import { BenchmarkState } from '../../../verification/qualification/enums/benchmark-state.enum';
import { MACHINE_BENCHMARK_HISTORY_LIMIT } from '../../machine/constants/marketplace.constants';
import {
	type ListingPageDto,
	MachineDetailDto,
	MachineListingDto,
	MachinePassedBenchmarkDto,
} from '../../machine/dto/machine.dto';
import type {
	ListListingsQueryDto,
	MachineShapeQueryDto,
} from '../../machine/dto/machine-browse-query.dto';
import { MachineUnavailableReason } from '../../machine/enums/machine-unavailable-reason.enum';
import { MarketplaceErrorCode } from '../../machine/enums/marketplace-error-code.enum';
import {
	type MachineBrowseFilter,
	type MachineBrowseRow,
	machineBrowseQuery,
} from '../../machine/queries/machine-browse.query';
import {
	type BrowseMachine,
	browseFilter,
	browseSelection,
	browseShape,
	decodeBrowseCursor,
	hostUnavailableReason,
	machineOffer,
	selectBrowsePage,
} from '../../machine/utils/machine-browse.util';

const SINGLE_MACHINE_LIMIT = 1;

@Injectable()
export class MachineBrowseService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly capacity: PlacementBillingCapacityService,
		private readonly geoIp: GeoIpService
	) {}

	async list(
		query: ListListingsQueryDto,
		organizationId: string,
		callerAddress: string | undefined
	): Promise<ListingPageDto> {
		const cursor = query.cursor ? decodeBrowseCursor(query.cursor) : undefined;
		if (cursor === null) {
			throw new BadRequestException({
				code: MarketplaceErrorCode.CURSOR_INVALID,
				message: 'Pagination cursor is invalid',
			});
		}
		const machines = await this.machines(browseFilter(query, organizationId));
		const caller = this.geoIp.locate(callerAddress);
		const page = selectBrowsePage(
			machines,
			browseSelection(query, cursor, caller)
		);
		return {
			items: page.items.map(MachineListingDto.from),
			nextCursor: page.nextCursor,
			total: page.total,
		};
	}

	async get(
		machineId: string,
		query: MachineShapeQueryDto,
		organizationId: string
	): Promise<MachineDetailDto> {
		const [machine] = await this.machines({
			customerOrganizationId: organizationId,
			shape: browseShape(query),
			machineId,
			limit: SINGLE_MACHINE_LIMIT,
		});
		if (!machine) {
			throw new NotFoundException({
				code: MarketplaceErrorCode.MACHINE_NOT_FOUND,
				message: 'Machine not found',
			});
		}
		const benchmark = await this.entityManager.findOne(
			MachineBenchmark,
			{ machineId },
			{ orderBy: { issuedAt: QueryOrder.DESC } }
		);
		const passed = await this.entityManager.find(
			MachineBenchmark,
			{ machineId, state: BenchmarkState.PASSED, completedAt: { $ne: null } },
			{
				orderBy: { completedAt: QueryOrder.DESC, id: QueryOrder.DESC },
				limit: MACHINE_BENCHMARK_HISTORY_LIMIT,
			}
		);
		return MachineDetailDto.fromDetail(
			machine,
			benchmark
				? {
						state: benchmark.state,
						issuedAt: benchmark.issuedAt,
						completedAt: benchmark.completedAt,
					}
				: null,
			passed.flatMap((entry) =>
				entry.completedAt
					? [MachinePassedBenchmarkDto.from(entry, entry.completedAt)]
					: []
			)
		);
	}

	private async machines(
		filter: MachineBrowseFilter
	): Promise<BrowseMachine[]> {
		const query = machineBrowseQuery(filter);
		const [rows, settings] = await Promise.all([
			this.entityManager.execute<MachineBrowseRow[]>(query.sql, query.bindings),
			this.settings.get(),
		]);
		const priced = rows.flatMap((row) => {
			const offer = machineOffer(
				row,
				filter.shape,
				filter.customerOrganizationId,
				settings.platformMarkupBasisPoints
			);
			return offer
				? [
						{
							row,
							offer,
							selfUse: row.organization_id === filter.customerOrganizationId,
							unavailableReason: hostUnavailableReason(row),
						},
					]
				: [];
		});
		const admissible = await this.admissible(
			filter.customerOrganizationId,
			priced
		);
		return priced.map((machine) =>
			machine.unavailableReason === null &&
			!machine.selfUse &&
			!admissible.has(machine.row.machine_id)
				? {
						...machine,
						unavailableReason: MachineUnavailableReason.EXPOSURE_LIMITED,
					}
				: machine
		);
	}

	private async admissible(
		customerOrganizationId: string,
		machines: readonly BrowseMachine[]
	): Promise<Set<string>> {
		const candidates = machines
			.filter(
				(machine) => machine.unavailableReason === null && !machine.selfUse
			)
			.map((machine) => ({
				machineId: machine.row.machine_id,
				hostOrganizationId: machine.row.organization_id,
				hourlyGrossMicroUsd: machine.offer.hourly.grossMicroUsd,
			}));
		if (candidates.length === 0) return new Set();
		const admitted = await this.capacity.admissibleCandidates(
			this.entityManager,
			customerOrganizationId,
			candidates
		);
		return new Set(admitted.map((candidate) => candidate.machineId));
	}
}

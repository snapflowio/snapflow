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
import { BadRequestException, Injectable } from '@nestjs/common';
import { prefixPattern } from '../../../common/utils/pagination/like-pattern.util';
import { LocationDto } from '../../../location/dto/location.dto';
import {
	constrainedContinents,
	constrainedCountries,
	parseLocationConstraint,
} from '../../../location/utils/location-constraint.util';
import {
	ListSandboxesQueryDto,
	SandboxListSortDirection,
	SandboxListSortField,
} from '../../dto/list-sandboxes-query.dto';
import { ListSandboxesResponseDto } from '../../dto/list-sandboxes-response.dto';
import { SandboxListItemDto } from '../../dto/sandbox-list-item.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';

const SANDBOX_ALIAS = 'sandbox';
const LAST_ACTIVITY_ALIAS = 'lastActivity';
const SANDBOX_ID_COLUMN = 'sandbox.id';
const LAST_ACTIVITY_COLUMN = 'lastActivity.lastActivityAt';
const CURSOR_ENCODING = 'base64';
const ERROR_STATES: readonly SandboxState[] = [
	SandboxState.ERROR,
	SandboxState.BUILD_FAILED,
];

const SORT_COLUMNS = {
	[SandboxListSortField.NAME]: 'sandbox.name',
	[SandboxListSortField.CPU]: 'sandbox.cpu',
	[SandboxListSortField.MEMORY]: 'sandbox.mem',
	[SandboxListSortField.DISK]: 'sandbox.disk',
	[SandboxListSortField.LAST_ACTIVITY_AT]: LAST_ACTIVITY_COLUMN,
	[SandboxListSortField.CREATED_AT]: 'sandbox.createdAt',
} as const satisfies Record<SandboxListSortField, string>;

const SORT_ORDERS = {
	[SandboxListSortDirection.ASC]: QueryOrder.ASC,
	[SandboxListSortDirection.DESC]: QueryOrder.DESC,
} as const satisfies Record<SandboxListSortDirection, QueryOrder>;

function sandboxQuery(manager: EntityManager) {
	return manager
		.createQueryBuilder(Sandbox, SANDBOX_ALIAS)
		.joinAndSelect('sandbox.lastActivityAt', LAST_ACTIVITY_ALIAS);
}

type SandboxQuery = ReturnType<typeof sandboxQuery>;
type CursorSortValue = string | number;

interface SandboxCursor {
	sortValue: CursorSortValue;
	id: string;
}

@Injectable()
export class SandboxSearchService {
	constructor(private readonly entityManager: EntityManager) {}

	async search(
		organizationId: string,
		query: ListSandboxesQueryDto
	): Promise<ListSandboxesResponseDto> {
		const sortColumn = SORT_COLUMNS[query.sort];
		const sortOrder = SORT_ORDERS[query.order];
		const qb = sandboxQuery(this.entityManager).where({ organizationId });
		applyIdentityFilters(qb, query);
		applyResourceFilters(qb, query);
		applyTimeFilters(qb, query);
		applyStateFilter(qb, query);
		if (query.cursor) {
			const { sortValue, id } = decodeCursor(query.cursor);
			const comparison = sortOrder === QueryOrder.ASC ? '$gt' : '$lt';
			qb.andWhere({
				$or: [
					{ [sortColumn]: { [comparison]: sortValue } },
					{
						[sortColumn]: sortValue,
						[SANDBOX_ID_COLUMN]: { [comparison]: id },
					},
				],
			});
		}
		qb.orderBy({ [sortColumn]: sortOrder, [SANDBOX_ID_COLUMN]: sortOrder });
		qb.limit(query.limit + 1);

		const rows = await qb.getResultList();
		const items = rows.slice(0, query.limit);
		const last = items.at(-1);
		return {
			items: items.map(toListItem),
			nextCursor:
				rows.length > query.limit && last
					? encodeCursor(last, query.sort)
					: null,
		};
	}
}

function applyIdentityFilters(
	qb: SandboxQuery,
	query: ListSandboxesQueryDto
): void {
	const labels = parseLabels(query.labels);
	if (query.id) qb.andWhere({ id: { $ilike: prefixPattern(query.id) } });
	if (query.name) qb.andWhere({ name: { $ilike: prefixPattern(query.name) } });
	if (labels) qb.andWhere({ labels: { $contains: labels } });
	if (query.snapshots?.length) {
		qb.andWhere({ snapshot: { $in: query.snapshots } });
	}
	if (query.locations?.length) {
		const constraints = query.locations.map(parseLocationConstraint);
		qb.andWhere({
			$or: [
				{ country: { $in: constrainedCountries(constraints) } },
				{ continent: { $in: constrainedContinents(constraints) } },
			],
		});
	}
	if (query.sandboxClasses?.length) {
		qb.andWhere({ sandboxClass: { $in: query.sandboxClasses } });
	}
	if (query.isRecoverable !== undefined) {
		qb.andWhere({ recoverable: query.isRecoverable });
	}
}

function applyResourceFilters(
	qb: SandboxQuery,
	query: ListSandboxesQueryDto
): void {
	if (query.minCpu !== undefined) qb.andWhere({ cpu: { $gte: query.minCpu } });
	if (query.maxCpu !== undefined) qb.andWhere({ cpu: { $lte: query.maxCpu } });
	if (query.minMemoryGiB !== undefined) {
		qb.andWhere({ mem: { $gte: query.minMemoryGiB } });
	}
	if (query.maxMemoryGiB !== undefined) {
		qb.andWhere({ mem: { $lte: query.maxMemoryGiB } });
	}
	if (query.minDiskGiB !== undefined) {
		qb.andWhere({ disk: { $gte: query.minDiskGiB } });
	}
	if (query.maxDiskGiB !== undefined) {
		qb.andWhere({ disk: { $lte: query.maxDiskGiB } });
	}
}

function applyTimeFilters(
	qb: SandboxQuery,
	query: ListSandboxesQueryDto
): void {
	if (query.createdAtAfter) {
		qb.andWhere({ createdAt: { $gte: query.createdAtAfter } });
	}
	if (query.createdAtBefore) {
		qb.andWhere({ createdAt: { $lte: query.createdAtBefore } });
	}
	if (query.lastEventAfter) {
		qb.andWhere({ [LAST_ACTIVITY_COLUMN]: { $gte: query.lastEventAfter } });
	}
	if (query.lastEventBefore) {
		qb.andWhere({ [LAST_ACTIVITY_COLUMN]: { $lte: query.lastEventBefore } });
	}
}

function applyStateFilter(qb: SandboxQuery, query: ListSandboxesQueryDto) {
	const states = (query.states ?? Object.values(SandboxState)).filter(
		(state) => state !== SandboxState.DESTROYED
	);
	const healthyStates = states.filter((state) => !ERROR_STATES.includes(state));
	const errorStates = states.filter((state) => ERROR_STATES.includes(state));
	const alternatives = [
		...(healthyStates.length > 0 ? [{ state: { $in: healthyStates } }] : []),
		...(errorStates.length > 0
			? [
					{
						state: { $in: errorStates },
						...(query.includeErroredDeleted
							? {}
							: { desiredState: { $ne: SandboxDesiredState.DESTROYED } }),
					},
				]
			: []),
	];
	if (alternatives.length > 0) qb.andWhere({ $or: alternatives });
}

function parseLabels(
	labels: ListSandboxesQueryDto['labels']
): Record<string, string> | undefined {
	if (!labels) return undefined;
	try {
		return JSON.parse(labels);
	} catch {
		throw new BadRequestException('Invalid labels JSON format');
	}
}

function sortValueOf(
	sandbox: Sandbox,
	field: SandboxListSortField
): CursorSortValue {
	switch (field) {
		case SandboxListSortField.NAME:
			return sandbox.name;
		case SandboxListSortField.CPU:
			return sandbox.cpu;
		case SandboxListSortField.MEMORY:
			return sandbox.mem;
		case SandboxListSortField.DISK:
			return sandbox.disk;
		case SandboxListSortField.LAST_ACTIVITY_AT:
			return joinedLastActivityAt(sandbox).toISOString();
		case SandboxListSortField.CREATED_AT:
			return sandbox.createdAt.toISOString();
	}
}

function joinedLastActivityAt(sandbox: Sandbox): Date {
	if (!sandbox.lastActivityAt) {
		throw new Error(
			`Sandbox ${sandbox.id} was listed without its last activity`
		);
	}
	return sandbox.lastActivityAt.lastActivityAt;
}

function encodeCursor(sandbox: Sandbox, field: SandboxListSortField): string {
	const cursor: SandboxCursor = {
		sortValue: sortValueOf(sandbox, field),
		id: sandbox.id,
	};
	return Buffer.from(JSON.stringify(cursor)).toString(CURSOR_ENCODING);
}

function isSandboxCursor(value: unknown): value is SandboxCursor {
	if (typeof value !== 'object' || value === null) return false;
	const { sortValue, id } = value as Record<string, unknown>;
	return (
		typeof id === 'string' &&
		(typeof sortValue === 'string' || typeof sortValue === 'number')
	);
}

function decodeCursor(cursor: string): SandboxCursor {
	let decoded: unknown;
	try {
		decoded = JSON.parse(Buffer.from(cursor, CURSOR_ENCODING).toString());
	} catch {
		throw new BadRequestException('Invalid pagination cursor');
	}
	if (!isSandboxCursor(decoded)) {
		throw new BadRequestException('Invalid pagination cursor');
	}
	return decoded;
}

function toListItem(sandbox: Sandbox): SandboxListItemDto {
	return new SandboxListItemDto({
		id: sandbox.id,
		organizationId: sandbox.organizationId,
		name: sandbox.name,
		mode: sandbox.mode,
		location: LocationDto.from(sandbox),
		machineId: sandbox.machineId ?? undefined,
		sandboxClass: sandbox.sandboxClass,
		state: sandbox.state,
		desiredState: sandbox.desiredState,
		snapshot: sandbox.snapshot ?? undefined,
		user: sandbox.osUser,
		errorReason: sandbox.errorReason ?? undefined,
		recoverable: sandbox.recoverable,
		cpu: sandbox.cpu,
		gpu: sandbox.gpu,
		gpuType: sandbox.gpuType ?? undefined,
		memory: sandbox.mem,
		disk: sandbox.disk,
		labels: sandbox.labels ?? {},
		backupState: sandbox.backupState,
		autoStopInterval: sandbox.autoStopInterval,
		autoArchiveInterval: sandbox.autoArchiveInterval,
		autoDeleteInterval: sandbox.autoDeleteInterval,
		createdAt: sandbox.createdAt.toISOString(),
		updatedAt: sandbox.updatedAt.toISOString(),
		lastActivityAt: joinedLastActivityAt(sandbox).toISOString(),
		daemonVersion: sandbox.daemonVersion ?? undefined,
	});
}

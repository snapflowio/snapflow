/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingOverviewService } from '../../billing/services/billing-overview.service';
import { QUERY_ORDERS } from '../../common/constants/sort.constants';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { allConditions } from '../../common/utils/pagination/filter-conditions.util';
import { containsPattern } from '../../common/utils/pagination/like-pattern.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { Organization } from '../../organization/entities/organization.entity';
import { organizationNotFound } from '../../organization/utils/organization-error.util';
import {
	AdminOrganizationDto,
	type AdminOrganizationListQueryDto,
	type AdminOrganizationPageDto,
} from '../dto/admin-organization.dto';
import { AdminOrganizationSortField } from '../enums/admin-organization-sort-field.enum';
import { AdminOrganizationStatus } from '../enums/admin-organization-status.enum';
import { AdminOrganizationType } from '../enums/admin-organization-type.enum';

const MEMBER_COUNTS_SQL =
	'SELECT "organizationId", COUNT(*)::int AS "memberCount" FROM "member" WHERE "organizationId" IN (?) GROUP BY "organizationId"';

const SORT_PROPERTIES = {
	[AdminOrganizationSortField.NAME]: 'name',
	[AdminOrganizationSortField.CREATED_AT]: 'createdAt',
} as const satisfies Record<AdminOrganizationSortField, keyof Organization>;

const PERSONAL_BY_TYPE = {
	[AdminOrganizationType.PERSONAL]: true,
	[AdminOrganizationType.TEAM]: false,
} as const satisfies Record<AdminOrganizationType, boolean>;

const STATUS_FILTERS = {
	[AdminOrganizationStatus.ACTIVE]: { deletedAt: null, suspended: false },
	[AdminOrganizationStatus.SUSPENDED]: { deletedAt: null, suspended: true },
	[AdminOrganizationStatus.DELETED]: { deletedAt: { $ne: null } },
} as const satisfies Record<AdminOrganizationStatus, FilterQuery<Organization>>;

function organizationFilter(
	query: AdminOrganizationListQueryDto
): FilterQuery<Organization> {
	const conditions: FilterQuery<Organization>[] = [];
	const search = query.query?.trim();
	if (search) {
		const pattern = containsPattern(search);
		conditions.push({
			$or: [{ name: { $ilike: pattern } }, { slug: { $ilike: pattern } }],
		});
	}
	if (query.types?.length) {
		conditions.push({
			personal: { $in: query.types.map((type) => PERSONAL_BY_TYPE[type]) },
		});
	}
	if (query.statuses?.length) {
		conditions.push({
			$or: query.statuses.map((status) => STATUS_FILTERS[status]),
		});
	}
	return allConditions(conditions);
}

@Injectable()
export class AdminOrganizationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly billingOverviews: BillingOverviewService
	) {}

	async list(
		query: AdminOrganizationListQueryDto
	): Promise<AdminOrganizationPageDto> {
		const order = QUERY_ORDERS[query.order];
		const page = await findCursorPage(this.entityManager, Organization, {
			where: organizationFilter(query),
			orderBy: { [SORT_PROPERTIES[query.sort]]: order, id: order },
			limit: query.limit,
			cursor: query.cursor,
		});
		return {
			items: await this.toDtos(page.items),
			nextCursor: page.nextCursor,
		};
	}

	async get(organizationId: string): Promise<AdminOrganizationDto> {
		const organization = await this.entityManager.findOne(Organization, {
			id: organizationId,
		});
		if (!organization) {
			throw new NotFoundException(organizationNotFound(organizationId));
		}
		const [dto] = await this.toDtos([organization]);
		return dto;
	}

	private async toDtos(
		organizations: readonly Organization[]
	): Promise<AdminOrganizationDto[]> {
		const organizationIds = organizations.map(({ id }) => id);
		const memberCounts = await this.memberCounts(organizationIds);
		const creditBalances =
			await this.billingOverviews.creditBalances(organizationIds);
		return organizations.map((organization) =>
			AdminOrganizationDto.from(
				organization,
				memberCounts.get(organization.id) ?? 0,
				creditBalances.get(organization.id) ?? MicroUsd.ZERO
			)
		);
	}

	private async memberCounts(
		organizationIds: readonly string[]
	): Promise<Map<string, number>> {
		if (organizationIds.length === 0) return new Map();
		const rows = await this.entityManager.execute<
			{ organizationId: string; memberCount: number }[]
		>(MEMBER_COUNTS_SQL, [organizationIds]);
		return new Map(
			rows.map(({ organizationId, memberCount }) => [
				organizationId,
				memberCount,
			])
		);
	}
}

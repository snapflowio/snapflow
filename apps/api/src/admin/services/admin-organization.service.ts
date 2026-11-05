/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingOverviewService } from '../../billing/services/billing-overview.service';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { containsPattern } from '../../common/utils/pagination/like-pattern.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { Organization } from '../../organization/entities/organization.entity';
import {
	AdminOrganizationDto,
	type AdminOrganizationListQueryDto,
	type AdminOrganizationPageDto,
} from '../dto/admin-organization.dto';

const MEMBER_COUNTS_SQL =
	'SELECT "organizationId", COUNT(*)::int AS "memberCount" FROM "member" WHERE "organizationId" IN (?) GROUP BY "organizationId"';

@Injectable()
export class AdminOrganizationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly billingOverviews: BillingOverviewService
	) {}

	async list(
		query: AdminOrganizationListQueryDto
	): Promise<AdminOrganizationPageDto> {
		const search = query.query?.trim();
		const pattern = search ? containsPattern(search) : null;
		const page = await findCursorPage(this.entityManager, Organization, {
			where: pattern
				? {
						$or: [{ name: { $ilike: pattern } }, { slug: { $ilike: pattern } }],
					}
				: {},
			orderBy: { createdAt: 'DESC', id: 'DESC' },
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
			throw new NotFoundException(`Organization ${organizationId} not found`);
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

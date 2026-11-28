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
import { LEGAL_DOCUMENT_VERSION } from '../../legal/constants/legal-documents.constants';
import { assertCurrentVersion } from '../../legal/utils/legal-version.util';
import { HostProfileErrorCode } from '../constants/host-profile.constants';
import type {
	HostProfileDto,
	UpdateHostProfileDto,
} from '../dto/host-profile.dto';
import { HostProfile } from '../entities/host-profile.entity';
import {
	type HostProfileRow,
	type HostStatsRow,
	hostProfileQuery,
	hostStatsQuery,
	listingHostQuery,
} from '../queries/host-profile.query';
import { recordHostTermsAcceptance } from '../queries/host-terms.query';
import { hostStats } from '../utils/listings/host-stats.util';

interface ListingHostRow {
	organization_id: string;
}

function hostNotFound(): NotFoundException {
	return new NotFoundException({
		code: HostProfileErrorCode.HOST_NOT_FOUND,
		message: 'Host not found',
	});
}

@Injectable()
export class HostProfileService {
	constructor(private readonly entityManager: EntityManager) {}

	async get(organizationId: string): Promise<HostProfileDto> {
		const manager = this.entityManager.fork();
		const profile = hostProfileQuery(organizationId);
		const stats = hostStatsQuery(organizationId);
		const [[row], [statsRow]] = await Promise.all([
			manager.execute<HostProfileRow[]>(profile.sql, profile.bindings),
			manager.execute<HostStatsRow[]>(stats.sql, stats.bindings),
		]);
		if (!row) throw hostNotFound();
		return {
			displayName: row.display_name,
			description: row.description,
			hostTermsVersion: row.host_terms_version,
			stats: hostStats(statsRow),
		};
	}

	async update(
		organizationId: string,
		input: UpdateHostProfileDto
	): Promise<HostProfileDto> {
		await this.entityManager.fork().upsert(HostProfile, {
			organizationId,
			displayName: input.displayName.trim(),
			description: input.description?.trim() || null,
			updatedAt: new Date(),
		});
		return this.get(organizationId);
	}

	async acceptHostTerms(
		organizationId: string,
		userId: string,
		version: string
	): Promise<HostProfileDto> {
		assertCurrentVersion(version, LEGAL_DOCUMENT_VERSION.HOST_TERMS);
		await recordHostTermsAcceptance(
			this.entityManager.fork(),
			organizationId,
			userId,
			version
		);
		return this.get(organizationId);
	}

	async forListing(
		machineId: string,
		customerOrganizationId: string
	): Promise<HostProfileDto> {
		const query = listingHostQuery(machineId, customerOrganizationId);
		const [row] = await this.entityManager
			.fork()
			.execute<ListingHostRow[]>(query.sql, query.bindings);
		if (!row) throw hostNotFound();
		return this.get(row.organization_id);
	}
}
